import { describe, expect, it, vi } from 'vitest';
import { MarkingDraftService } from '@/services/marking-draft';
import { setup, signIn, verify } from '../../helpers/app';

const KEY = 'ele-s1u2.2026-09-25.daily'; // prototype roster; rolls 6 and 13 are on OJT today (seeds.ts)

async function opened() {
  const env = setup({ marking: { statusSet: ['present', 'absent', 'ojt'] } });
  const ctx = await signIn(env.app, 'TR-10432');
  await verify(env.app, ctx, KEY);
  const roster = await env.app.services.attendance.openRoster(ctx, KEY);
  if (!roster.ok) throw new Error(roster.error);
  const drafts = env.app.services.drafts;
  const snap = drafts.open(ctx, roster.value);
  const ojt = roster.value.students.filter((s) => roster.value.marks[s.id].status === 'ojt').map((s) => s.id);
  const plain = roster.value.students.filter((s) => !ojt.includes(s.id)).map((s) => s.id);
  return { env, ctx, roster: roster.value, drafts, snap, ojt, plain };
}

describe('MarkingDraftService', () => {
  it('open is idempotent and seeds presets (OJT) without sources', async () => {
    const t = await opened();
    expect(t.ojt.length).toBeGreaterThan(0);
    expect([...t.snap.presets].sort()).toEqual([...t.ojt].sort());
    expect(t.snap.sources).toEqual({});
    expect(t.drafts.open(t.ctx, t.roster)).toBe(t.drafts.get(KEY));
  });

  it('setMark bumps the revision, records the source and notifies key and * listeners', async () => {
    const t = await opened();
    const onKey = vi.fn(), onAll = vi.fn();
    t.drafts.subscribe(KEY, onKey);
    t.drafts.subscribe('*', onAll);
    const after = t.drafts.setMark(KEY, t.plain[0], { status: 'absent' }, { via: 'voice', heard: 'absent' })!;
    expect(after.revision).toBe(t.snap.revision + 1);
    expect(after.marks[t.plain[0]]).toEqual({ status: 'absent' });
    expect(after.sources[t.plain[0]]).toMatchObject({ via: 'voice', heard: 'absent', at: expect.any(String) });
    expect(onKey).toHaveBeenCalledWith(expect.objectContaining({ kind: 'mark', via: 'voice', studentIds: [t.plain[0]] }));
    expect(onAll).toHaveBeenCalledTimes(1);
  });

  it('refuses OJT, unknown students and a locked draft (same snapshot, no event)', async () => {
    const t = await opened();
    const listener = vi.fn();
    t.drafts.subscribe(KEY, listener);
    expect(t.drafts.setMark(KEY, t.ojt[0], { status: 'absent' }, { via: 'tap' })).toBe(t.drafts.get(KEY));
    expect(t.drafts.setMark(KEY, 'nobody', { status: 'absent' }, { via: 'tap' })).toBe(t.drafts.get(KEY));
    t.drafts.close(KEY, { kind: 'submitted', via: 'tap' });
    expect(t.drafts.setMark(KEY, t.plain[0], { status: 'absent' }, { via: 'tap' })).toBeUndefined();
    expect(listener.mock.calls.map((c) => c[0].kind)).toEqual(['submitted']);
  });

  it('an equal mark without a new detail is a no-op; a detail is merged', async () => {
    const t = await opened();
    const same = t.drafts.setMark(KEY, t.plain[0], { status: 'present' }, { via: 'tap' });
    expect(same!.revision).toBe(t.snap.revision);
    expect(same!.sources[t.plain[0]]).toBeUndefined();
  });

  it('a spoken answer equal to the default records the voice source once (a roll call over a default status)', async () => {
    const t = await opened();
    const spoken = t.drafts.setMark(KEY, t.plain[0], { status: 'present' }, { via: 'voice', heard: 'haan' })!;
    expect(spoken.revision).toBe(t.snap.revision + 1);
    expect(spoken.marks[t.plain[0]]).toEqual({ status: 'present' });
    expect(spoken.sources[t.plain[0]]).toMatchObject({ via: 'voice', heard: 'haan' });
    expect(t.drafts.setMark(KEY, t.plain[0], { status: 'present' }, { via: 'voice' })).toBe(spoken);
  });

  it('setMany marks only the given ids with one revision', async () => {
    const t = await opened();
    const after = t.drafts.setMany(KEY, t.plain.slice(0, 3), { status: 'absent' }, { via: 'voice', heard: 'mark_remaining' })!;
    expect(after.revision).toBe(t.snap.revision + 1);
    expect(t.plain.slice(0, 3).map((id) => after.marks[id].status)).toEqual(['absent', 'absent', 'absent']);
    expect(after.marks[t.plain[3]].status).toBe('present');
  });

  it('persists marks and sources so a reload restores them', async () => {
    const t = await opened();
    t.drafts.setMark(KEY, t.plain[1], { status: 'absent' }, { via: 'tap' });
    await t.drafts.flush(KEY);
    const reloaded = new MarkingDraftService({ attendance: t.env.app.repositories.attendance, now: () => t.env.clock.now() });
    const persisted = await t.env.app.repositories.attendance.getDraft(KEY);
    const again = await t.env.app.services.attendance.openRoster(t.ctx, KEY);
    if (!again.ok) throw new Error(again.error);
    const snap = reloaded.open(t.ctx, again.value, persisted);
    expect(snap.marks[t.plain[1]].status).toBe('absent');
    expect(snap.sources[t.plain[1]]).toMatchObject({ via: 'tap' });
  });

  it('close(submitted) locks and emits once', async () => {
    const t = await opened();
    const listener = vi.fn();
    t.drafts.subscribe(KEY, listener);
    t.drafts.close(KEY, { kind: 'submitted', via: 'voice' });
    t.drafts.close(KEY, { kind: 'submitted', via: 'voice' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(t.drafts.get(KEY)?.locked ?? true).toBe(true);
  });

  it('a submit holds the draft: every mark is refused with no event until the last overlapping submit ends', async () => {
    const t = await opened();
    const listener = vi.fn();
    t.drafts.subscribe(KEY, listener);
    const sent = t.drafts.beginSubmit(KEY)!;
    expect(sent).toBe(t.drafts.get(KEY));
    expect(t.drafts.beginSubmit(KEY)).toBe(sent); // the screen's and voice's submits can overlap
    expect(t.drafts.isSubmitting(KEY)).toBe(true);
    expect(t.drafts.setMark(KEY, t.plain[0], { status: 'absent' }, { via: 'voice', heard: 'absent' })).toBe(sent);
    expect(t.drafts.setMany(KEY, t.plain, { status: 'absent' }, { via: 'tap' })).toBe(sent);
    t.drafts.endSubmit(KEY);
    expect(t.drafts.setMark(KEY, t.plain[0], { status: 'absent' }, { via: 'tap' })).toBe(sent); // one submit still runs
    t.drafts.endSubmit(KEY);
    expect(t.drafts.isSubmitting(KEY)).toBe(false);
    expect(t.drafts.setMark(KEY, t.plain[0], { status: 'absent' }, { via: 'tap' })!.marks[t.plain[0]]).toEqual({ status: 'absent' });
    expect(listener.mock.calls.map((c) => c[0].kind)).toEqual(['mark']);
    expect(t.drafts.beginSubmit('nobody')).toBeUndefined();
  });

  it('whileSubmitting releases only a hold it took: with no live draft, a voice hold taken meanwhile survives (E3)', async () => {
    const t = await opened();
    t.drafts.close(KEY, { kind: 'closed', via: 'system' }); // the screen's Submit finds no live draft
    let voiceSent: ReturnType<typeof t.drafts.beginSubmit>;
    const screen = await t.drafts.whileSubmitting(KEY, async (sent) => {
      expect(sent).toBeUndefined(); // no hold was taken
      t.drafts.open(t.ctx, t.roster); // voice opens the batch again and starts its own submit
      voiceSent = t.drafts.beginSubmit(KEY);
      return 'screen done';
    });
    expect(screen).toBe('screen done');
    expect(voiceSent).toBeDefined();
    expect(t.drafts.isSubmitting(KEY)).toBe(true); // voice's hold is still on
    expect(t.drafts.setMark(KEY, t.plain[0], { status: 'absent' }, { via: 'tap' })).toBe(t.drafts.get(KEY));
    t.drafts.endSubmit(KEY); // voice's own end
    expect(t.drafts.isSubmitting(KEY)).toBe(false);
  });

  it('whileSubmitting holds a live draft while it saves and releases it after, also when the save throws', async () => {
    const t = await opened();
    await t.drafts.whileSubmitting(KEY, async (sent) => {
      expect(sent).toBe(t.drafts.get(KEY));
      expect(t.drafts.isSubmitting(KEY)).toBe(true);
    });
    expect(t.drafts.isSubmitting(KEY)).toBe(false);
    await expect(t.drafts.whileSubmitting(KEY, async () => { throw new Error('save failed'); })).rejects.toThrow('save failed');
    expect(t.drafts.isSubmitting(KEY)).toBe(false);
  });

  it('close(submitted) carries the snapshot that was sent, so the change always equals the stored record', async () => {
    const t = await opened();
    const sent = t.drafts.beginSubmit(KEY)!;
    const listener = vi.fn();
    t.drafts.subscribe(KEY, listener);
    t.drafts.close(KEY, { kind: 'submitted', via: 'tap', sent });
    t.drafts.endSubmit(KEY);
    expect(listener.mock.calls[0][0].after).toEqual({ ...sent, locked: true });
  });

  it('restores sources through openRoster alone (the screens pass no persisted draft)', async () => {
    const t = await opened();
    t.drafts.setMark(KEY, t.plain[2], { status: 'absent' }, { via: 'voice', heard: 'absent' });
    await t.drafts.flush(KEY);
    const again = await t.env.app.services.attendance.openRoster(t.ctx, KEY);
    if (!again.ok) throw new Error(again.error);
    const snap = new MarkingDraftService({ attendance: t.env.app.repositories.attendance, now: () => t.env.clock.now() }).open(t.ctx, again.value);
    expect(snap.sources[t.plain[2]]).toEqual({ via: 'voice', at: expect.any(String) });
    expect(Object.keys(snap.sources)).toEqual([t.plain[2]]);
  });

  it('keeps what was heard in memory only: the saved draft carries { via, at } while transcriptRetentionDays is 0', async () => {
    const t = await opened();
    expect(t.ctx.config.voice.transcriptRetentionDays).toBe(0);
    const marked = t.drafts.setMark(KEY, t.plain[0], { status: 'absent' }, { via: 'voice', heard: 'Rahul nahi aaya, bimar hai' })!;
    t.drafts.setMany(KEY, [t.plain[1], t.plain[2]], { status: 'absent' }, { via: 'voice', heard: 'baaki sab absent' });
    expect(marked.sources[t.plain[0]]).toMatchObject({ heard: 'Rahul nahi aaya, bimar hai' }); // the live snapshot still has it
    await t.drafts.flush(KEY);
    const saved = await t.env.app.repositories.attendance.getDraft(KEY);
    expect(saved?.sources?.[t.plain[0]]).toEqual({ via: 'voice', at: expect.any(String) });
    expect(saved?.sources?.[t.plain[1]]).toEqual({ via: 'voice', at: expect.any(String) });
    expect(JSON.stringify(saved)).not.toContain('heard');
    expect(JSON.stringify(saved)).not.toContain('bimar');
  });

  it('saves what was heard when a retention period is configured', async () => {
    const t = await opened();
    const ctx = { ...t.ctx, config: { ...t.ctx.config, voice: { ...t.ctx.config.voice, transcriptRetentionDays: 7 } } };
    const again = await t.env.app.services.attendance.openRoster(ctx, KEY);
    if (!again.ok) throw new Error(again.error);
    t.drafts.open(ctx, again.value);
    t.drafts.setMark(KEY, t.plain[0], { status: 'absent' }, { via: 'voice', heard: 'absent' });
    await t.drafts.flush(KEY);
    const saved = await t.env.app.repositories.attendance.getDraft(KEY);
    expect(saved?.sources?.[t.plain[0]]).toMatchObject({ via: 'voice', heard: 'absent' });
  });

  it('a changed configuration rebuilds from the roster, keeping surviving sources and a growing revision', async () => {
    const t = await opened();
    const marked = t.drafts.setMark(KEY, t.plain[0], { status: 'absent' }, { via: 'tap' })!;
    await t.drafts.flush(KEY);
    const ctx = { ...t.ctx, config: { ...t.ctx.config, voice: { ...t.ctx.config.voice, voiceName: 'Puck' } } };
    const again = await t.env.app.services.attendance.openRoster(ctx, KEY);
    if (!again.ok) throw new Error(again.error);
    const listener = vi.fn();
    t.drafts.subscribe(KEY, listener);
    const rebuilt = t.drafts.open(ctx, again.value);
    expect(rebuilt).not.toBe(marked);
    expect(rebuilt.revision).toBe(marked.revision + 1);
    expect(rebuilt.marks[t.plain[0]]).toEqual({ status: 'absent' });
    expect(rebuilt.sources[t.plain[0]]).toEqual(marked.sources[t.plain[0]]);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'opened', via: 'system', before: marked, after: rebuilt }));
  });

  it('a new but equal configuration object keeps the live draft: same snapshot, same revision, no rebuild', async () => {
    const t = await opened();
    const marked = t.drafts.setMark(KEY, t.plain[0], { status: 'absent' }, { via: 'tap' })!;
    const listener = vi.fn();
    t.drafts.subscribe(KEY, listener);
    // SessionService builds a new configuration object on every reload: structurally the same one
    const ctx = { ...t.ctx, config: structuredClone(t.ctx.config) };
    const again = await t.env.app.services.attendance.openRoster(ctx, KEY);
    if (!again.ok) throw new Error(again.error);
    expect(t.drafts.open(ctx, again.value)).toBe(marked);
    expect(t.drafts.open(t.ctx, t.roster)).toBe(marked);
    expect(t.drafts.get(KEY)!.revision).toBe(marked.revision);
    expect(listener).not.toHaveBeenCalled();
  });

  it('revisions only grow: a re-open after close continues above the highest revision reached', async () => {
    const t = await opened();
    t.drafts.setMark(KEY, t.plain[0], { status: 'absent' }, { via: 'tap' });
    const before = t.drafts.setMark(KEY, t.plain[1], { status: 'absent' }, { via: 'tap' })!;
    t.drafts.close(KEY, { kind: 'closed', via: 'system' });
    const again = await t.env.app.services.attendance.openRoster(t.ctx, KEY);
    if (!again.ok) throw new Error(again.error);
    expect(t.drafts.open(t.ctx, again.value).revision).toBeGreaterThan(before.revision);
  });
});
