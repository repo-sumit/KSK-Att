// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoAdapters, DEMO_ACCOUNTS, type DemoAdapters } from '@/demo/adapters';
import { DemoController, prepareScenario } from '@/demo/controller';
import { PERSONAS } from '@/demo/personas';
import { PRESETS } from '@/demo/presets';
import { DEFAULT_DEMO_TIME } from '@/demo/state';
import { createMockContainer, type AppContainer } from '@/services/container';
import { DEFAULT_SIMULATION, StaticSimulationSource } from '@/services/simulation';
import { MemoryStore } from '@/lib/kv-store';
import { FixedClock, instantAt } from '@/lib/time';

beforeEach(() => localStorage.clear());

/** The demo branch of boot.ts: demo adapters, the mock container on top, the chooser connected. */
function demoApp(): { demo: DemoAdapters; app: AppContainer } {
  const demo = createDemoAdapters();
  const app = createMockContainer({ store: new MemoryStore(), preferencesStore: new MemoryStore(), clock: demo.clock, simulation: demo.simulation, configOverrides: demo.configOverrides, loginAssist: demo.loginAssist });
  demo.loginAssist.connect((id) => prepareScenario(app, demo, id));
  // Instant simulated delays; the story choice must keep this machine setting.
  demo.repo.update((s) => ({ ...s, simulation: { ...s.simulation, speed: 0 } }));
  return { demo, app };
}

describe('"Use demo account" on the login screens', () => {
  it('offers exactly the five demo accounts, in order, labelled by the demo source', () => {
    const { demo } = demoApp();
    const assist = demo.loginAssist.get();
    expect(assist).toMatchObject({ label: 'Use demo account', chosenLabel: 'Demo account', changeLabel: 'Change' });
    expect(assist.options).toEqual([
      { id: 'open', label: 'Open instructor', who: 'Rajesh Patil' },
      { id: 'batch', label: 'Batch-mapped instructor', who: 'Sunita Jadhav' },
      { id: 'timetable', label: 'Timetable instructor', who: 'Vikas Shinde' },
      { id: 'es', label: 'Employability Skills instructor', who: 'Meera Kulkarni' },
      { id: 'principal', label: 'Principal', who: 'Dr. Anil Deshmukh' },
    ]);
    // Every account tells the story of the preset with the same id.
    for (const id of DEMO_ACCOUNTS) expect(PRESETS.find((p) => p.id === id)?.persona).toBe(id);
  });

  it('highlights the persona the presenter picked last, and stays referentially stable', () => {
    const { demo } = demoApp();
    let changes = 0;
    demo.loginAssist.subscribe(() => changes++);
    expect(demo.loginAssist.get().suggested).toBe('open');
    demo.repo.update((s) => ({ ...s, persona: 'principal' }));
    expect(demo.loginAssist.get().suggested).toBe('principal');
    expect(changes).toBe(1);
    // Stable identity while nothing changed (React external-store contract).
    expect(demo.loginAssist.get()).toBe(demo.loginAssist.get());
    // Personas without a demo account are never suggested.
    demo.repo.update((s) => ({ ...s, persona: 'group' }));
    expect(demo.loginAssist.get().suggested).toBeNull();
  });

  it('choosing an account prepares its story without signing in, and returns what to fill', async () => {
    const { demo, app } = demoApp();
    demo.repo.update((s) => ({ ...s, presetId: null, clock: { mode: 'fixed', time: '14:30' }, config: { staff: { enabled: false } }, simulation: { ...s.simulation, online: false } }));
    const credentials = await demo.loginAssist.choose('principal');
    expect(credentials).toEqual({ instituteCode: '27410', trainerId: 'PR-2741', who: 'Dr. Anil Deshmukh · Principal' });
    const state = demo.repo.get();
    const principal = PRESETS.find((p) => p.id === 'principal')!;
    expect(state).toMatchObject({ presetId: 'principal', persona: 'principal', config: principal.config, clock: { mode: 'fixed', time: DEFAULT_DEMO_TIME } });
    // Fresh simulated outcomes, but this machine's speed survives.
    expect(state.simulation).toMatchObject({ online: true, speed: 0 });
    expect(await app.services.faceMatch.isEnrolled('st-anil')).toBe(true);
    // Nobody is signed in: the user still goes through every login step.
    expect(await app.repositories.session.get()).toBeUndefined();
  });

  it('keeps a story that starts at login when its own account is picked (First-time user)', async () => {
    const { demo, app } = demoApp();
    prepareScenario(app, demo, 'first_time');
    await demo.loginAssist.choose('open');
    expect(demo.repo.get().presetId).toBe('first_time');
    expect(await app.services.faceMatch.isEnrolled('st-rajesh')).toBe(false);
    // Another account is that account's everyday story.
    await demo.loginAssist.choose('batch');
    expect(demo.repo.get()).toMatchObject({ presetId: 'batch', persona: 'batch' });
  });

  it('unknown accounts fill nothing and change nothing', async () => {
    const { demo } = demoApp();
    const before = demo.repo.get();
    expect(await demo.loginAssist.choose('trade')).toBeNull();
    expect(demo.loginAssist.credentials('nobody')).toBeNull();
    expect(demo.repo.get()).toBe(before);
  });

  it.each(DEMO_ACCOUNTS.map((id) => [id] as const))('%s: the credentials it fills log in through the real auth service', async (id) => {
    const { demo, app } = demoApp();
    const credentials = demo.loginAssist.credentials(id)!;
    const persona = PERSONAS.find((p) => p.id === id)!;
    expect(credentials.who).toBe(`${persona.name} · ${persona.title}`);
    const institute = await app.services.auth.lookupInstitute(credentials.instituteCode);
    expect(institute.ok).toBe(true);
    if (!institute.ok) return;
    const who = await app.services.auth.lookupInstructor(institute.value.id, credentials.trainerId);
    expect(who.ok && who.value).toMatchObject({ id: persona.staffId, name: persona.name });
  });

  it('presets share the same preparation, then sign in and navigate', async () => {
    const { demo, app } = demoApp();
    const visited: string[] = [];
    await new DemoController(app, demo, (href) => visited.push(href)).applyPreset('batch');
    expect(demo.repo.get()).toMatchObject({ presetId: 'batch', persona: 'batch', clock: { mode: 'fixed', time: DEFAULT_DEMO_TIME } });
    expect((await app.repositories.session.get())?.staffId).toBe('st-sunita');
    expect(visited).toEqual(['/home']);
  });
});

describe('demo personas', () => {
  it.each(PERSONAS.map((p) => [p.id, p] as const))('%s: its demo credentials log in through the real auth service', async (_id, persona) => {
    const app = createMockContainer({
      store: new MemoryStore(),
      preferencesStore: new MemoryStore(),
      clock: new FixedClock(instantAt('2026-09-25', '10:15')),
      simulation: new StaticSimulationSource({ ...DEFAULT_SIMULATION, speed: 0 }),
    });
    const institute = await app.services.auth.lookupInstitute(persona.instituteCode);
    expect(institute.ok).toBe(true);
    if (!institute.ok) return;
    const who = await app.services.auth.lookupInstructor(institute.value.id, persona.trainerId);
    expect(who.ok && who.value).toMatchObject({ id: persona.staffId, name: persona.name });
  });

  it('production builds have no assist (nothing renders on the login screens)', () => {
    const app = createMockContainer({
      store: new MemoryStore(),
      preferencesStore: new MemoryStore(),
      clock: new FixedClock(instantAt('2026-09-25', '10:15')),
      simulation: new StaticSimulationSource(),
    });
    expect(app.services.loginAssist).toBeNull();
  });
});
