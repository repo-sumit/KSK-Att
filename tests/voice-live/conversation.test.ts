/**
 * Live-model harness (Task 20, Step 3): the REAL Gemini Live model, the real executor and the mock container. The
 * trainer is a script of typed turns; verification is granted through the service where the screen would do it.
 * Run with `npm run test:voice-live` (GEMINI_API_KEY from .env.development); without a key every test is skipped.
 * Costs quota: a run is three conversations. VOICE_LIVE_TRANSCRIPT=1 prints what the model said (mock names only).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { compileFlowPlan } from '@/domain/voice/plan';
import type { ConfigLayer } from '@/config/types';
import { createExecutor, type VoiceExecutor } from '@/services/voice/executor';
import { ActionBus } from '@/services/voice/action-bus';
import type { LiveSetup } from '@/services/voice/live/transport';
import { buildSystemPrompt, SPEECH_LANGUAGE } from '@/services/voice/prompt';
import { buildTools } from '@/services/voice/tools';
import { setup as appSetup, signIn } from '../helpers/app';
import { LiveDriver, type TurnReport } from './driver';

const MODEL = 'gemini-3.8-live';
const apiKey = process.env.GEMINI_API_KEY ?? '';
const TODAY_TEXT = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

const drivers: LiveDriver[] = [];
afterEach(() => {
  for (const d of drivers.splice(0)) d.close();
});

/** A signed-in trainer with voice on, the real executor, and a live connection with the production prompt and tools. */
async function conversation(layer: ConfigLayer = {}) {
  const env = appSetup({ voice: { enabled: true }, ...layer });
  const ctx = await signIn(env.app, 'TR-10432');
  const plan = compileFlowPlan(ctx, 'en')!;
  const holder: { driver?: LiveDriver } = {}; // the executor reads the trainer's turn count live, from the driver built next
  const executor: VoiceExecutor = createExecutor({
    ctx, plan, bus: new ActionBus(),
    attendance: env.app.services.attendance, verification: env.app.services.verification, drafts: env.app.services.drafts,
    isOnline: () => true, nowMs: () => performance.now(), speechSeq: () => holder.driver?.speech.counts.speechSeq ?? 0, turnSeq: () => holder.driver?.speech.counts.turnSeq ?? 0,
    spokeAtTurn: () => holder.driver?.speech.counts.spokeAtTurn ?? 0, generation: () => 1,
    entropy: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
  });
  const who = { trainerFirstName: ctx.user.name.trim().split(/\s+/)[0] ?? '', instituteName: ctx.institute.shortName, todayText: TODAY_TEXT.format(env.clock.now()) };
  const liveSetup: LiveSetup = { model: MODEL, systemInstruction: buildSystemPrompt(plan, who), tools: buildTools(plan), voiceName: ctx.journey.voice.voiceName };
  const driver = await LiveDriver.open(apiKey, liveSetup, executor);
  holder.driver = driver;
  drivers.push(driver);
  const log: string[] = [];
  const say = async (text: string, trainer = true): Promise<TurnReport> => {
    const turn = await driver.say(text, trainer);
    const calls = turn.tools.map((t) => `${t.name}${t.error ? `!${t.error}` : ''}`).join(', ') || '-';
    const ms = (v: number | null) => (v === null ? '-' : String(v));
    log.push(`${trainer ? 'trainer' : '[APP]  '} "${text.slice(0, 60)}"  tools: ${calls}  first audio ${ms(turn.firstAudioMs)} ms, first tool ${ms(turn.firstToolMs)} ms, turn ${turn.totalMs} ms`);
    if (process.env.VOICE_LIVE_TRANSCRIPT) log.push(`        model: ${turn.said}`);
    return turn;
  };
  /** Prints the timeline once the scenario is over, pass or fail. */
  const report = (title: string) => console.info(`\n[voice-live] ${title}\n${log.join('\n')}`);

  const flow = () => executor.flow();
  const key = () => flow().sessionKey!;
  const sessionStart = async () => say(await executor.kickoff('start', SPEECH_LANGUAGE.en), false);
  /** The trainer's face and location pass, as the verification screen would grant it, then the executor's [APP] text. */
  const verifyPass = async () => {
    const target = { kind: 'session', key: key() } as const;
    const loc = await env.app.services.verification.checkLocation(ctx, target);
    await env.app.services.verification.grant(ctx, target, loc.ok ? loc.value : undefined);
    const text = await executor.onVerification({ type: 'granted', purpose: `session:${key()}` });
    expect(text, 'the executor tells the model the batch opened').toMatch(/^\[APP\]/);
    return say(text!, false);
  };
  /** Trade, batch and the verification pass: the batch is open for marking. */
  const openBatch = async () => {
    await sessionStart();
    await say('Electrician');
    expect(flow().step, 'after the trade').toBe('SELECT_BATCH');
    await say('shift 1 unit 2');
    expect(flow().step, 'after the batch').toBe('VERIFY');
    await verifyPass();
    expect(flow().step, 'after the pass').toBe('ROLL_CALL');
  };
  const draft = () => env.app.services.drafts.get(key())!;
  const submission = () => env.app.repositories.attendance.getSubmission(key());
  const toolsOf = () => driver.turns.flatMap((t) => t.tools);
  return { env, say, report, flow, key, openBatch, draft, submission, toolsOf, turns: driver.turns };
}

const absents = (marks: Readonly<Record<string, { status: string | null }>>) => Object.entries(marks).filter(([, m]) => m.status === 'absent').map(([id]) => id);

describe.skipIf(!apiKey)('voice mode against the live model', () => {
  it('(a) by exception: one absent, a check question, then one confirmed submission', async () => {
    const c = await conversation();
    try {
      await c.openBatch();
      await c.say('sab present, sirf Aditi absent');
      expect(absents(c.draft().marks), 'Aditi is marked absent by voice').toEqual(['ele-s1u2-r02']);
      // The model asks the check question, then the submit question (each with its own yes): the trainer answers each.
      for (let i = 0; i < 4 && !(await c.submission()); i++) await c.say('haan');
      const done = await c.submission();
      expect(done, 'a submission exists').toBeDefined();
      expect(absents(done!.marks)).toEqual(['ele-s1u2-r02']);
      expect(Object.keys(done!.marks)).toHaveLength(31);
      expect(c.toolsOf().filter((t) => t.name === 'submit_attendance' && t.ok), 'submitted exactly once').toHaveLength(1);
      expect(c.flow().step).toBe('SUBMITTED');
    } finally {
      c.report('(a) by exception');
    }
  });

  it('(b) roll call: three answers, then mark_remaining only after a confirmation', async () => {
    const c = await conversation({ marking: { defaultStatus: 'blank' } });
    try {
      await c.openBatch();
      for (let i = 0; i < 3; i++) await c.say('present');
      const voiced = Object.values(c.draft().sources).filter((s) => s.via === 'voice');
      expect(voiced, 'three students were marked by voice').toHaveLength(3);
      expect(Object.values(c.draft().marks).filter((m) => m.status === 'present')).toHaveLength(3);

      await c.say('baaki sab present');
      const remaining = c.toolsOf().filter((t) => t.name === 'mark_remaining');
      expect(remaining[0], 'mark_remaining first asks for a confirmation').toMatchObject({ ok: false, error: 'NEEDS_CONFIRMATION' });
      expect(Object.keys(c.draft().sources), 'nobody else is marked before the yes').toHaveLength(3);

      await c.say('haan');
      expect(c.toolsOf().some((t) => t.name === 'mark_remaining' && t.ok && t.args.confirm_token !== undefined), 'the confirmed call went through').toBe(true);
      expect(Object.values(c.draft().marks).filter((m) => m.status === 'present')).toHaveLength(31);
      expect(await c.submission(), 'nothing was submitted').toBeUndefined();
    } finally {
      c.report('(b) roll call');
    }
  });

  it('(c) a misheard name: the model asks again instead of marking', async () => {
    const c = await conversation();
    try {
      await c.openBatch();
      const turn = await c.say('sirf Quentin absent');
      expect(absents(c.draft().marks), 'nobody is marked absent').toEqual([]);
      expect(Object.keys(c.draft().sources), 'nobody is marked at all').toEqual([]);
      expect(turn.tools.some((t) => t.name === 'mark_remaining')).toBe(false);
      expect(await c.submission()).toBeUndefined();
      // It either tried the name (NOT_FOUND) or asked at once; either way it ends on a question to the trainer.
      expect(turn.tools.every((t) => t.name !== 'set_student_status' || t.error === 'NOT_FOUND')).toBe(true);
      expect(turn.said, 'the model asks again').toMatch(/\?|कृपया|फिर से|पुन्हा|again|repeat|dobara/i);
    } finally {
      c.report('(c) misheard name');
    }
  });
});
