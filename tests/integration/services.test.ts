import { beforeEach, describe, expect, it } from 'vitest';
import { createMockContainer, type AppContainer } from '@/services/container';
import type { SessionContext } from '@/services/context';
import { DEFAULT_SIMULATION, StaticSimulationSource } from '@/services/simulation';
import { MemoryStore } from '@/lib/kv-store';
import { FixedClock, instantAt } from '@/lib/time';
import type { ConfigLayer } from '@/config/types';

const TODAY = '2026-09-25';

function setup(overrides: ConfigLayer = {}) {
  const clock = new FixedClock(instantAt(TODAY, '10:15'));
  const simulation = new StaticSimulationSource({ ...DEFAULT_SIMULATION, speed: 0 });
  let layer = overrides;
  const app = createMockContainer({ store: new MemoryStore(), preferencesStore: new MemoryStore(), clock, simulation, configOverrides: { get: () => layer } });
  app.services.sync.start();
  return { app, clock, simulation, setConfig: (l: ConfigLayer) => (layer = l) };
}

async function signIn(app: AppContainer, trainerId: string): Promise<SessionContext> {
  const inst = await app.services.auth.lookupInstitute('27410');
  if (!inst.ok) throw new Error('institute');
  const who = await app.services.auth.lookupInstructor(inst.value.id, trainerId);
  if (!who.ok) throw new Error(`instructor ${trainerId}: ${who.error}`);
  await app.services.auth.startSession(inst.value.id, who.value.id);
  const ctx = await app.services.session.load();
  if (!ctx) throw new Error('session');
  return ctx;
}

async function verify(app: AppContainer, ctx: SessionContext, key: string) {
  const loc = await app.services.verification.checkLocation(ctx);
  expect(loc.ok).toBe(true);
  await app.services.verification.grant(ctx, { kind: 'session', key }, loc.ok ? loc.value : undefined);
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('login (PRD §6)', () => {
  it('accepts a Trainer ID typed without the hyphen or with a space', async () => {
    const env = setup();
    const inst = await env.app.services.auth.lookupInstitute('27410');
    if (!inst.ok) throw new Error('institute');
    for (const typed of ['tr10432', 'TR 10432', 'TR–10432', ' TR-10432 ']) {
      expect(await env.app.services.auth.lookupInstructor(inst.value.id, typed)).toMatchObject({ ok: true, value: { id: 'st-rajesh' } });
    }
    expect(await env.app.services.auth.lookupInstructor(inst.value.id, 'T10432')).toMatchObject({ error: 'invalid_format' });
  });

  it('finds the institute, then an instructor scoped to it', async () => {
    const { app } = setup();
    const inst = await app.services.auth.lookupInstitute('27410');
    expect(inst).toMatchObject({ ok: true, value: { name: 'Government Industrial Training Institute, Pune' } });
    expect(await app.services.auth.lookupInstitute('27499')).toMatchObject({ ok: false, error: 'not_found' });
    if (!inst.ok) return;
    expect((await app.services.auth.lookupInstructor(inst.value.id, 'tr-10432')).ok).toBe(true);
    // Valid in the state (Nashik) but not at this institute → treated as not found.
    expect(await app.services.auth.lookupInstructor(inst.value.id, 'TR-20411')).toMatchObject({ ok: false, error: 'not_found' });
  });
});

describe('marking, submit and lock (PRD §9, §12.1)', () => {
  let env: ReturnType<typeof setup>;
  let ctx: SessionContext;
  beforeEach(async () => {
    env = setup();
    ctx = await signIn(env.app, 'TR-10432');
  });

  it('shows open, future and submitted sessions for the trade', async () => {
    const cards = await env.app.services.attendance.boardForTrade(ctx, 'ele');
    const status = Object.fromEntries(cards.map((c) => [c.batch.id, c.status]));
    expect(status).toMatchObject({ 'ele-s1u1': 'submitted', 'ele-s1u2': 'open', 'ele-s2u1': 'future' });
  });

  it('refuses the roster before verification, then locks after one submit', async () => {
    const key = 'ele-s1u2.2026-09-25.daily';
    expect(await env.app.services.attendance.openRoster(ctx, key)).toMatchObject({ ok: false, error: 'not_verified' });
    await verify(env.app, ctx, key);
    const roster = await env.app.services.attendance.openRoster(ctx, key);
    if (!roster.ok) throw new Error(roster.error);
    expect(Object.values(roster.value.marks).every((m) => m.status === 'present')).toBe(true);
    const marks = { ...roster.value.marks, [roster.value.students[2].id]: { status: 'absent' as const } };
    const first = await env.app.services.attendance.submit(ctx, key, marks);
    expect(first.ok).toBe(true);
    expect(await env.app.services.attendance.submit(ctx, key, marks)).toMatchObject({ ok: false, error: 'already_submitted' });
    expect(await env.app.services.attendance.openRoster(ctx, key)).toMatchObject({ ok: false, error: 'already_submitted' });
    const detail = await env.app.services.attendance.getDetail(ctx, key);
    expect(detail?.card.submission?.counts).toMatchObject({ present: 30, absent: 1 });
  });

  it('refuses batches outside the time window and outside the mapping', async () => {
    env.setConfig({ mapping: { model: 'batch' } });
    const batchCtx = await env.app.services.session.load();
    expect(await env.app.services.attendance.openRoster(batchCtx!, 'ele-s2u1.2026-09-25.daily')).toMatchObject({ error: 'window_not_open' });
    expect(await env.app.services.attendance.openRoster(batchCtx!, 'ele-s1u2.2026-09-25.daily')).toMatchObject({ error: 'no_access' });
  });

  it('keeps a draft across reloads', async () => {
    const key = 'ele-s1u2.2026-09-25.daily';
    await verify(env.app, ctx, key);
    const roster = await env.app.services.attendance.openRoster(ctx, key);
    if (!roster.ok) throw new Error();
    const id = roster.value.students[0].id;
    await env.app.services.attendance.saveDraft(ctx, key, { ...roster.value.marks, [id]: { status: 'absent' } });
    const again = await env.app.services.attendance.openRoster(ctx, key);
    expect(again.ok && again.value.marks[id].status).toBe('absent');
  });
});

describe('offline marking and sync (PRD §20)', () => {
  it('locks locally offline, then syncs automatically on reconnect', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10432');
    const key = 'ele-s1u2.2026-09-25.daily';
    await verify(env.app, ctx, key);
    env.simulation.update({ online: false });
    const roster = await env.app.services.attendance.openRoster(ctx, key);
    if (!roster.ok) throw new Error(roster.error);
    const sub = await env.app.services.attendance.submit(ctx, key, roster.value.marks);
    expect(sub.ok).toBe(true);
    await flush();
    expect(env.app.services.sync.status()).toMatchObject({ phase: 'pending', pending: 1, online: false });
    expect(await env.app.services.attendance.submit(ctx, key, roster.value.marks)).toMatchObject({ error: 'already_submitted' });
    env.simulation.update({ online: true });
    await env.app.services.sync.syncNow();
    expect(env.app.services.sync.status()).toMatchObject({ phase: 'synced', pending: 0 });
    expect((await env.app.repositories.attendance.getSubmission(key))?.syncState).toBe('synced');
  });

  it('sends records left by an earlier visit as soon as the app opens online', async () => {
    const store = new MemoryStore();
    const clock = new FixedClock(instantAt(TODAY, '10:15'));
    const offline = new StaticSimulationSource({ ...DEFAULT_SIMULATION, speed: 0, online: false });
    const first = createMockContainer({ store, preferencesStore: new MemoryStore(), clock, simulation: offline });
    first.services.sync.start();
    const ctx = await signIn(first, 'TR-10432');
    const key = 'ele-s1u2.2026-09-25.daily';
    await verify(first, ctx, key);
    const roster = await first.services.attendance.openRoster(ctx, key);
    if (!roster.ok) throw new Error(roster.error);
    await first.services.attendance.submit(ctx, key, roster.value.marks);
    first.services.sync.stop();

    const online = new StaticSimulationSource({ ...DEFAULT_SIMULATION, speed: 0 });
    const next = createMockContainer({ store, preferencesStore: new MemoryStore(), clock, simulation: online });
    next.services.sync.start();
    for (let i = 0; i < 10 && next.services.sync.status().phase !== 'synced'; i++) await flush();
    expect(next.services.sync.status()).toMatchObject({ phase: 'synced', pending: 0 });
    expect((await next.repositories.attendance.getSubmission(key))?.syncState).toBe('synced');
  });

  it('reports a failed sync and recovers on retry', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10432');
    const key = 'ele-s1u2.2026-09-25.daily';
    await verify(env.app, ctx, key);
    env.simulation.update({ nextSyncFails: true });
    const roster = await env.app.services.attendance.openRoster(ctx, key);
    if (!roster.ok) throw new Error();
    await env.app.services.attendance.submit(ctx, key, roster.value.marks);
    await env.app.services.sync.syncNow();
    expect(env.app.services.sync.status().phase).toBe('failed');
    env.simulation.update({ nextSyncFails: false });
    await env.app.services.sync.syncNow();
    expect(env.app.services.sync.status()).toMatchObject({ phase: 'synced', pending: 0 });
  });

  it('refuses a batch that was never downloaded while offline', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10432');
    env.simulation.update({ online: false });
    expect(await env.app.services.attendance.openRoster(ctx, 'fit-s1u1.2026-09-25.daily')).toMatchObject({ error: 'already_submitted' });
    expect(await env.app.services.attendance.openRoster(ctx, 'md-s1u1.2026-09-25.daily')).toMatchObject({ error: 'not_downloaded' });
  });

  it('needs a connection when the state has not enabled offline marking, even for a downloaded batch', async () => {
    const env = setup({ offline: { enabled: false } });
    const ctx = await signIn(env.app, 'TR-10432');
    env.simulation.update({ online: false });
    expect(await env.app.services.attendance.openRoster(ctx, 'ele-s1u2.2026-09-25.daily')).toMatchObject({ error: 'needs_connection' });
  });
});

describe('principal correction (PRD §12.2–12.4)', () => {
  const key = 'ele-s1u1.2026-09-25.daily';
  const rahul = 'ele-s1u1-r21';

  it('keeps a quick reason as a code so every language can show it in its own words', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'PR-2741');
    const result = await env.app.services.corrections.correct(ctx, key, rahul, { status: 'present' }, 'विद्यार्थी उशिरा आले', 'late');
    expect(result).toMatchObject({ ok: true, value: { reasonCode: 'late', reason: 'विद्यार्थी उशिरा आले' } });
    const log = await env.app.services.corrections.log(ctx, '2026-09-25', '2026-09-25');
    expect(log.find((e) => e.studentId === rahul)?.reasonCode).toBe('late');
  });

  it('corrects today with a reason, appends to the audit log and never overwrites the record', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'PR-2741');
    const result = await env.app.services.corrections.correct(ctx, key, rahul, { status: 'present' }, 'Student arrived late');
    expect(result.ok).toBe(true);
    const original = await env.app.repositories.attendance.getSubmission(key);
    expect(original?.marks[rahul].status).toBe('absent');
    const detail = await env.app.services.attendance.getDetail(ctx, key);
    expect(detail?.marks[rahul].status).toBe('present');
    const log = await env.app.services.corrections.log(ctx, TODAY, TODAY);
    expect(log[0]).toMatchObject({ studentName: 'Rahul Kumar', reason: 'Student arrived late', actorName: 'Dr. Anil Deshmukh' });
  });

  it('refuses instructors, missing reasons and past days', async () => {
    const env = setup();
    const instructor = await signIn(env.app, 'TR-10432');
    expect(await env.app.services.corrections.correct(instructor, key, rahul, { status: 'present' }, 'x')).toMatchObject({ error: 'forbidden' });
    const principal = await signIn(env.app, 'PR-2741');
    expect(await env.app.services.corrections.correct(principal, key, rahul, { status: 'present' }, '  ')).toMatchObject({ error: 'reason_required' });
    expect(await env.app.services.corrections.correct(principal, 'fit-s1u1.2026-09-24.daily', 'fit-s1u1-r04', { status: 'present' }, 'late')).toMatchObject({ error: 'not_today' });
  });
});

describe('staff attendance (PRD §18)', () => {
  it('self-mark after verification; principal cannot duplicate it but fills gaps', async () => {
    const env = setup();
    const rajesh = await signIn(env.app, 'TR-10432');
    expect(await env.app.services.staffAttendance.markSelf(rajesh)).toMatchObject({ error: 'not_verified' });
    await env.app.services.verification.grant(rajesh, { kind: 'self' });
    expect((await env.app.services.staffAttendance.markSelf(rajesh)).ok).toBe(true);
    const principal = await signIn(env.app, 'PR-2741');
    expect(await env.app.services.staffAttendance.markByPrincipal(principal, [{ staffId: 'st-rajesh', status: 'absent' }, { staffId: 'st-sanjay', status: 'present' }])).toMatchObject({ ok: true, value: { saved: 1, skipped: ['st-rajesh'] } });
    const day = await env.app.services.staffAttendance.day(principal);
    expect(day.find((r) => r.member.id === 'st-sanjay')?.record?.source).toBe('principal');
    expect(day.some((r) => r.member.role === 'principal')).toBe(true);
  });
});

describe('reports (PRD §19)', () => {
  it('computes student percentages from history and flags low attendance', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10518');
    const range = env.app.services.reports.rangeFor(ctx, 'month');
    const report = await env.app.services.reports.build(ctx, 'student_percentage', range, 'ele-s1u2');
    if (report.block !== 'student_percentage') throw new Error();
    expect(report.students[0].student.name).toBe('Tushar Yadav');
    expect(report.students[0].batch.id).toBe('ele-s1u2');
    expect(report.belowThreshold).toBeGreaterThanOrEqual(2);
  });

  it('shows the seeded correction in the principal log', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'PR-2741');
    const report = await env.app.services.reports.build(ctx, 'correction_log', env.app.services.reports.rangeFor(ctx, 'month'));
    expect(report.block === 'correction_log' && report.entries[0].studentName).toBe('Kiran Wagh');
  });
});

describe('demo reset', () => {
  it('restores seeded submissions and clears new records', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10432');
    const key = 'ele-s1u2.2026-09-25.daily';
    await verify(env.app, ctx, key);
    const roster = await env.app.services.attendance.openRoster(ctx, key);
    if (!roster.ok) throw new Error();
    await env.app.services.attendance.submit(ctx, key, roster.value.marks);
    env.app.mockDatabase.reset();
    expect(await env.app.repositories.attendance.getSubmission(key)).toBeUndefined();
    expect(await env.app.repositories.attendance.getSubmission('ele-s1u1.2026-09-25.daily')).toBeDefined();
    expect(await env.app.repositories.session.get()).toBeUndefined();
  });
});

describe('submit lock under concurrency (INV-01)', () => {
  it('two simultaneous submits create exactly one record and one queue item', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10432');
    const key = 'ele-s1u2.2026-09-25.daily';
    await verify(env.app, ctx, key);
    env.simulation.update({ online: false });
    const roster = await env.app.services.attendance.openRoster(ctx, key);
    if (!roster.ok) throw new Error();
    const results = await Promise.all([
      env.app.services.attendance.submit(ctx, key, roster.value.marks),
      env.app.services.attendance.submit(ctx, key, roster.value.marks),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).map((r) => !r.ok && r.error)).toEqual(['already_submitted']);
    expect(await env.app.repositories.offlineQueue.list()).toHaveLength(1);
  });

  it('never keeps a draft for a submitted session', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10432');
    await env.app.services.attendance.saveDraft(ctx, 'ele-s1u1.2026-09-25.daily', {});
    expect(await env.app.repositories.attendance.getDraft('ele-s1u1.2026-09-25.daily')).toBeUndefined();
  });
});

describe('location results say whether they are real or simulated (brief §18)', () => {
  it('the demo simulation tags its fixes "simulated"; the record keeps it for audit', async () => {
    const { app } = setup({ verification: { geoMode: 'fencing' } });
    const ctx = await signIn(app, 'TR-10432');
    const loc = await app.services.verification.checkLocation(ctx);
    expect(loc.ok && loc.value.location.source).toBe('simulated');
  });
});
