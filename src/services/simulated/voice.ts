/**
 * Voice transport and audio for demos and tests — SIMULATION ONLY: no network, no microphone, no speaker.
 * `ScriptedLiveTransport` stands in for the Gemini Live socket; `SilentAudio` for the browser audio devices.
 */
import type { AudioIO, MicError } from '../voice/audio/types';
import type { ToolResult } from '../voice/tools';
import type {
  LiveCallbacks,
  LiveConnection,
  LiveEvent,
  LiveSetup,
  LiveToken,
  LiveToolResponse,
  LiveTransport,
} from '../voice/live/transport';

export class ScriptedLiveTransport implements LiveTransport {
  readonly needsToken = false as const;
  /** Every sendText, in order. */
  readonly texts: string[] = [];
  readonly toolResponses: LiveToolResponse[] = [];
  private streamEndCount = 0;
  private audioCount = 0;
  private readonly connectFailures: number[] = [];
  private cb: LiveCallbacks | null = null;
  private live = false;
  private setup: LiveSetup | null = null;
  private nextCallId = 0;
  private micDenial: MicError | null = null;
  private readonly waiting = new Map<string, (result: ToolResult) => void>();

  get streamEnds(): number { return this.streamEndCount; }
  /** Mic chunks sent while connected (counted, never kept). */
  get audioChunks(): number { return this.audioCount; }
  get lastSetup(): LiveSetup | null { return this.setup; }
  connected(): boolean { return this.live; }

  async connect(_token: LiveToken | null, setup: LiveSetup, cb: LiveCallbacks): Promise<LiveConnection> {
    const failure = this.connectFailures.shift();
    if (failure !== undefined) throw new Error(`Live socket closed before setup completed (code ${failure})`);
    this.setup = setup;
    this.cb = cb;
    this.live = true;
    const open = (): boolean => this.live && this.cb === cb;
    const connection: LiveConnection = {
      sendAudio: () => { if (open()) this.audioCount += 1; },
      sendText: (text) => { if (open()) this.texts.push(text); },
      sendAudioStreamEnd: () => { if (open()) this.streamEndCount += 1; },
      sendToolResponses: (responses) => {
        if (!open()) return;
        for (const r of responses) {
          this.toolResponses.push(r);
          const resolve = r.id === undefined ? undefined : this.waiting.get(r.id);
          if (resolve && r.id !== undefined) {
            this.waiting.delete(r.id);
            resolve(r.result);
          }
        }
      },
      close: () => { if (this.cb === cb) this.live = false; },
    };
    return connection;
  }

  /** Delivers one server event (`audio` defaults to none). Ignored while not connected. */
  emit(event: Partial<LiveEvent>): void {
    if (!this.live) return;
    this.cb?.onEvent({ audio: [], ...event });
  }

  /** Emits one toolCall and resolves with the response the app sends for it. Rejects when nothing is connected (it would never be answered). */
  toolCall(name: string, args: Record<string, unknown> = {}, id?: string): Promise<ToolResult> {
    if (!this.live) return Promise.reject(new Error('not connected'));
    const callId = id ?? `scripted-${++this.nextCallId}`;
    const answer = new Promise<ToolResult>((resolve) => this.waiting.set(callId, resolve));
    this.emit({ toolCalls: [{ id: callId, name, args }] });
    return answer;
  }

  /** Simulates the trainer finishing an utterance (input transcription, finished). */
  speak(text: string): void {
    this.emit({ inputText: text, inputFinished: true });
  }

  /** Simulates the connection dropping (default: abnormal close). */
  drop(code = 1006): void {
    if (!this.live) return;
    this.live = false;
    this.cb?.onClose(code, 'scripted drop');
  }

  goAway(ms: number): void {
    this.emit({ goAwayMs: ms });
  }

  /** The next connect() fails as a socket that closed before setup completed; each call queues one more failure (tests). */
  failNextConnect(code = 1006): void {
    this.connectFailures.push(code);
  }

  /** The next SilentAudio.startMic() on this transport fails with `error` (demo and E2E). */
  denyNextMic(error: MicError): void {
    this.micDenial = error;
  }

  takeMicDenial(): MicError | null {
    const denial = this.micDenial;
    this.micDenial = null;
    return denial;
  }
}

/** AudioIO without devices: startMic succeeds (or fails once with the transport's queued denial), play counts chunks, level 0. */
export class SilentAudio implements AudioIO {
  private played = 0;
  constructor(private readonly transport: ScriptedLiveTransport) {}

  get playedChunks(): number { return this.played; }

  async startMic(_onChunk: (pcm: Int16Array) => void, _onEnded: () => void): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: MicError }> {
    const denial = this.transport.takeMicDenial();
    return denial ? { ok: false, error: denial } : { ok: true };
  }
  setMicEnabled(_on: boolean): void {}
  play(_pcm: Int16Array): void { this.played += 1; }
  flush(): void {}
  /** Never "playing": scripted audio has no duration, and a speaking state that never ends would stall waits for the model to finish. */
  isPlaying(): boolean { return false; }
  level(): number { return 0; }
  close(): void {}
}
