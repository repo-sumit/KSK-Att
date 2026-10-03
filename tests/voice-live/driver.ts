/**
 * The live-model driver (Task 20): one Gemini Live connection used the way VoiceSession uses it, minus audio. Trainer
 * turns are typed text (`sendRealtimeInput({ text })`), tool calls run through the REAL executor on one queue, in
 * `toolCallOrder`, answered with one sendToolResponse in the model's order, and a turn is over when the model has
 * finished (turnComplete) and no tool call is running or arrived in a short grace window after it.
 * The API key never leaves this file's SDK call: every message that could carry it goes through redact().
 */
import { GoogleGenAI, type LiveConnectConfig, type Session } from '@google/genai';
import { LIVE_API_VERSION } from '@/server/voice/token';
import { INTERNAL_RESULT, toolCallOrder, type VoiceExecutor } from '@/services/voice/executor';
import { liveConfig, type LiveSetup, type LiveToolCall } from '@/services/voice/live/transport';
import { normalizeMessage } from '@/services/voice/live/normalize';
import type { ToolResult } from '@/services/voice/tools';
import { TrainerTurns } from '@/services/voice/trainer-turns';

const CONNECT_TIMEOUT_MS = 20_000;
const TURN_TIMEOUT_MS = 70_000;
const GRACE_MS = 1500;
const POLL_MS = 50;

export interface ToolLogEntry { readonly name: string; readonly args: Record<string, unknown>; readonly ok: boolean; readonly error?: string; readonly instruction: string }
export interface TurnReport {
  readonly sent: string;
  readonly trainer: boolean;
  readonly tools: readonly ToolLogEntry[];
  /** What the model said (output transcript), for diagnosing wording. */
  readonly said: string;
  /** ms from the send to the first audio / first tool call / the end of the turn (null when none came). */
  readonly firstAudioMs: number | null;
  readonly firstToolMs: number | null;
  readonly totalMs: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class LiveDriver {
  readonly turns: TurnReport[] = [];
  /**
   * The session's confirmation counters (D-082): model turns from the real server's turnComplete/interrupted, and a
   * trainer turn for each typed trainer text (no input transcription comes for text), so a code is accepted only
   * when the model's asking turn ended before the trainer's next turn, as in production.
   */
  readonly speech = new TrainerTurns();
  private session: Session | null = null;
  private closed: string | null = null;
  /** The first failure the queue could not turn into a tool result (sendToolResponse threw): settle() throws it at once. */
  private fault: string | null = null;
  private activity = 0;
  private completes = 0;
  private running = 0;
  private queue: Promise<void> = Promise.resolve();
  private cur = { said: '', tools: [] as ToolLogEntry[], firstAudio: null as number | null, firstTool: null as number | null, sentAt: 0 };

  private constructor(private readonly apiKey: string, private readonly executor: VoiceExecutor) {}

  /** Redacts the key from anything printed or thrown. */
  private redact(value: unknown): string {
    return String(value instanceof Error ? value.message : value).split(this.apiKey).join('[redacted]').replace(/(access_token|key)=[^&\s"']+/gi, '$1=[redacted]');
  }

  static async open(apiKey: string, setup: LiveSetup, executor: VoiceExecutor): Promise<LiveDriver> {
    const driver = new LiveDriver(apiKey, executor);
    // The plan's API-key connection, on the API version production connects with (the token route's LIVE_API_VERSION).
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: LIVE_API_VERSION } });
    const connecting = ai.live.connect({
      model: setup.model,
      config: liveConfig(setup) as LiveConnectConfig,
      callbacks: {
        onmessage: (msg) => driver.onMessage(msg),
        onerror: () => undefined, // onclose follows with the code
        onclose: (e) => {
          driver.closed = `closed (${e?.code ?? 1006}) ${driver.redact(e?.reason ?? '')}`.trim();
        },
      },
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`No setupComplete within ${CONNECT_TIMEOUT_MS / 1000} s`)), CONNECT_TIMEOUT_MS);
    });
    try {
      driver.session = await Promise.race([connecting, timeout]);
    } catch (error) {
      // A session that resolves after the race was lost is closed when it arrives: no socket is left open.
      void connecting.then((late) => { try { late.close(); } catch { /* already closed */ } }, () => undefined);
      throw new Error(`Live connect failed: ${driver.redact(error)}${driver.closed ? ` [${driver.closed}]` : ''}`);
    } finally {
      clearTimeout(timer);
    }
    return driver;
  }

  close(): void {
    try {
      this.session?.close();
    } catch {
      // already closed
    }
    this.session = null;
  }

  /** Sends a trainer turn (`trainer: true`, the default) or an [APP] text, and returns when the model is done with it. */
  async say(text: string, trainer = true): Promise<TurnReport> {
    if (!this.session) throw new Error(`The Live connection is not open${this.closed ? `: ${this.closed}` : ''}`);
    if (trainer) this.speech.spoke();
    this.cur = { said: '', tools: [], firstAudio: null, firstTool: null, sentAt: performance.now() };
    this.fault = null;
    const baseline = this.completes;
    this.session.sendRealtimeInput({ text });
    await this.settle(baseline);
    const report: TurnReport = {
      sent: text,
      trainer,
      tools: this.cur.tools,
      said: this.cur.said.trim(),
      firstAudioMs: this.cur.firstAudio,
      firstToolMs: this.cur.firstTool,
      totalMs: Math.round(performance.now() - this.cur.sentAt),
    };
    this.turns.push(report);
    return report;
  }

  private async settle(baseline: number): Promise<void> {
    const deadline = performance.now() + TURN_TIMEOUT_MS;
    let seen = baseline;
    for (;;) {
      while (this.completes === seen) {
        this.throwFault();
        if (this.closed) throw new Error(`The model closed the connection: ${this.closed}`);
        if (performance.now() > deadline) throw new Error(`The model did not finish its turn within ${TURN_TIMEOUT_MS / 1000} s`);
        await sleep(POLL_MS);
      }
      seen = this.completes;
      const before = this.activity;
      await sleep(GRACE_MS);
      while (this.running > 0 && performance.now() < deadline) await sleep(POLL_MS); // a tool call is still running
      this.throwFault();
      if (this.activity === before && this.running === 0) return;
    }
  }

  private throwFault(): void {
    if (this.fault) throw new Error(`A tool call could not be answered: ${this.fault}`);
  }

  private onMessage(msg: unknown): void {
    const e = normalizeMessage(msg);
    this.speech.observe(e);
    const since = Math.round(performance.now() - this.cur.sentAt);
    if (e.audio.length && this.cur.firstAudio === null) this.cur.firstAudio = since;
    if (e.outputText) this.cur.said += e.outputText;
    if (e.audio.length || e.outputText || e.toolCalls?.length) this.activity += 1;
    if (e.toolCalls?.length) {
      if (this.cur.firstTool === null) this.cur.firstTool = since;
      this.running += 1; // counted at once: the grace window must not end before the queue starts
      this.queue = this.queue.then(() => this.answer(e.toolCalls ?? [])).catch((error: unknown) => void (this.fault ??= this.redact(error))).finally(() => void (this.running -= 1));
    }
    if (e.turnComplete) this.completes += 1;
  }

  /** The calls of one toolCall message: run in toolCallOrder, answered together in the model's order. */
  private async answer(calls: readonly LiveToolCall[]): Promise<void> {
    const results = new Map<LiveToolCall, ToolResult>();
    for (const call of toolCallOrder(calls)) {
      // A throwing executor answers INTERNAL, as production does (session-tools.ts), and the turn report records it.
      let result: ToolResult;
      try {
        result = await this.executor.execute({ id: call.id, name: call.name, args: call.args });
      } catch (error) {
        result = { ...INTERNAL_RESULT };
        console.info(`[live] ${call.name} threw, answered INTERNAL: ${this.redact(error)}`);
      }
      results.set(call, result);
      this.cur.tools.push({ name: call.name, args: call.args, ok: result.ok, ...(result.error ? { error: result.error } : {}), instruction: result.instruction });
    }
    this.activity += 1;
    // `id` is always an own key (the SDK throws without it in Gemini API mode).
    this.session?.sendToolResponse({ functionResponses: calls.map((c) => ({ id: c.id, name: c.name, response: { output: results.get(c) } })) });
  }
}
