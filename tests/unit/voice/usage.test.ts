import { describe, expect, it } from 'vitest';
import { VoiceUsage } from '@/services/voice/usage';

const repo = () => {
  const m = new Map<string, number>();
  return { get: async (s: string, d: string) => m.get(`${s}:${d}`) ?? 0, add: async (s: string, d: string, sec: number) => void m.set(`${s}:${d}`, (m.get(`${s}:${d}`) ?? 0) + sec), m };
};
/** Lets every queued write finish (a macrotask: after all pending promise callbacks), without calling flush(). */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const limits = { sessionMinutes: 1, idleSeconds: 30, dailyMinutes: 2 };

describe('VoiceUsage', () => {
  it('stops at the session cap, counting across reconnects', async () => {
    const r = repo();
    const u = new VoiceUsage({ repo: r, staffId: 'st', today: () => '2026-10-02', limits });
    expect(await u.canStart()).toEqual({ ok: true, dailySecondsLeft: 120 });
    let stop = null;
    for (let s = 1; s <= 60 && !stop; s++) { u.activity(s * 1000); stop = u.tick(s * 1000); }
    expect(stop).toBe('session_limit');
  });
  it('stops when idle', async () => {
    const u = new VoiceUsage({ repo: repo(), staffId: 'st', today: () => '2026-10-02', limits: { ...limits, sessionMinutes: 10 } });
    await u.canStart();
    u.activity(0);
    let stop = null;
    for (let s = 1; s <= 31 && !stop; s++) stop = u.tick(s * 1000);
    expect(stop).toBe('idle');
  });
  it('refuses to start past the daily cap and persists usage', async () => {
    const r = repo();
    r.m.set('st:2026-10-02', 120);
    expect(await new VoiceUsage({ repo: r, staffId: 'st', today: () => '2026-10-02', limits }).canStart()).toEqual({ ok: false, reason: 'daily_limit' });
  });
  it('writes the repository every 15 s and flushes the rest', async () => {
    const r = repo();
    const u = new VoiceUsage({ repo: r, staffId: 'st', today: () => '2026-10-02', limits: { ...limits, sessionMinutes: 10 } });
    await u.canStart();
    for (let s = 1; s <= 20; s++) { u.activity(s * 1000); u.tick(s * 1000); }
    await settle();
    expect(r.m.get('st:2026-10-02')).toBe(15);
    await u.flush();
    expect(r.m.get('st:2026-10-02')).toBe(20);
  });
  it('stops at the daily cap mid-session and does not double-count on reconnect', async () => {
    const r = repo();
    r.m.set('st:2026-10-02', 100);
    const u = new VoiceUsage({ repo: r, staffId: 'st', today: () => '2026-10-02', limits: { ...limits, sessionMinutes: 10 } });
    expect(await u.canStart()).toEqual({ ok: true, dailySecondsLeft: 20 });
    let stop = null;
    for (let s = 1; s <= 10; s++) { u.activity(s * 1000); stop = u.tick(s * 1000); }
    expect(stop).toBeNull();
    await u.flush();
    expect(await u.canStart()).toEqual({ ok: true, dailySecondsLeft: 10 });
    for (let s = 11; s <= 20 && !stop; s++) { u.activity(s * 1000); stop = u.tick(s * 1000); }
    expect(stop).toBe('daily_limit');
    expect(u.sessionSecondsLeft).toBe(580);
  });
  it('secondsLeft is the nearer of the session and the daily cap', async () => {
    const r = repo();
    r.m.set('st:2026-10-02', 100);
    const u = new VoiceUsage({ repo: r, staffId: 'st', today: () => '2026-10-02', limits: { ...limits, sessionMinutes: 10 } });
    expect(u.secondsLeft).toBe(120);
    await u.canStart();
    expect(u.secondsLeft).toBe(20);
    u.tick(1000);
    expect(u.secondsLeft).toBe(19);
    const roomy = new VoiceUsage({ repo: repo(), staffId: 'st', today: () => '2026-10-02', limits });
    await roomy.canStart();
    roomy.tick(1000);
    expect(roomy.secondsLeft).toBe(59);
  });

  it('retries a failed write on the next tick and never loses the seconds', async () => {
    const r = repo();
    let failures = 1;
    const flaky = { get: r.get, add: async (s: string, d: string, sec: number) => { if (failures-- > 0) throw new Error('offline'); await r.add(s, d, sec); } };
    const u = new VoiceUsage({ repo: flaky, staffId: 'st', today: () => '2026-10-02', limits: { ...limits, sessionMinutes: 10 } });
    await u.canStart();
    for (let s = 1; s <= 15; s++) u.tick(s * 1000); // the 15th tick writes: it fails
    await settle();
    expect(r.m.get('st:2026-10-02')).toBeUndefined();
    u.tick(16_000); // the next tick tries again, with all 16 seconds
    await settle();
    expect(r.m.get('st:2026-10-02')).toBe(16);
    await u.flush();
    expect(r.m.get('st:2026-10-02')).toBe(16); // nothing written twice
  });

  it('keeps retrying while the repository is down, and flush retries too', async () => {
    const r = repo();
    let down = true;
    const flaky = { get: r.get, add: async (s: string, d: string, sec: number) => { if (down) throw new Error('offline'); await r.add(s, d, sec); } };
    const u = new VoiceUsage({ repo: flaky, staffId: 'st', today: () => '2026-10-02', limits: { ...limits, sessionMinutes: 10 } });
    await u.canStart();
    for (let s = 1; s <= 17; s++) { u.tick(s * 1000); await settle(); }
    expect(r.m.size).toBe(0);
    down = false;
    await u.flush();
    expect(r.m.get('st:2026-10-02')).toBe(17);
  });

  it('captures the seconds to write before the write starts', async () => {
    const calls: number[] = [];
    let release: () => void = () => {};
    const slow = { get: async () => 0, add: (_s: string, _d: string, sec: number) => { calls.push(sec); return new Promise<void>((resolve) => { release = resolve; }); } };
    const u = new VoiceUsage({ repo: slow, staffId: 'st', today: () => '2026-10-02', limits: { ...limits, sessionMinutes: 10 } });
    await u.canStart();
    for (let s = 1; s <= 15; s++) u.tick(s * 1000);
    await settle();
    for (let s = 16; s <= 20; s++) u.tick(s * 1000); // counted while the first write is in flight
    release();
    await settle();
    release();
    const done = u.flush();
    await settle();
    release();
    await done;
    expect(calls).toEqual([15, 5]);
  });

  it('starts the counters again when the IST date changes: seconds before midnight stay on the old day, the rest count toward the new one', async () => {
    const r = repo();
    let day = '2026-10-02';
    r.m.set('st:2026-10-03', 100);
    const u = new VoiceUsage({ repo: r, staffId: 'st', today: () => day, limits: { sessionMinutes: 10, idleSeconds: 600, dailyMinutes: 2 } });
    expect(await u.canStart()).toEqual({ ok: true, dailySecondsLeft: 120 });
    for (let s = 1; s <= 10; s++) u.tick(s * 1000);
    day = '2026-10-03';
    u.tick(11_000);
    await u.flush();
    expect(r.m.get('st:2026-10-02')).toBe(10);
    expect(r.m.get('st:2026-10-03')).toBe(101); // the 100 s seeded for that day plus this session's 1 s
    // the new day's earlier use (100 s) is read again on the next start; this session's 1 s after midnight counts, its 10 s before do not
    expect(await u.canStart()).toEqual({ ok: true, dailySecondsLeft: 19 });
    let stop = null;
    for (let s = 12; s <= 40 && !stop; s++) stop = u.tick(s * 1000);
    expect(stop).toBe('daily_limit');
    await u.flush();
    expect(r.m.get('st:2026-10-02')).toBe(10);
  });

  it('does not double-count a rollover across a reconnect on the new day', async () => {
    const r = repo();
    let day = '2026-10-02';
    const u = new VoiceUsage({ repo: r, staffId: 'st', today: () => day, limits: { sessionMinutes: 10, idleSeconds: 600, dailyMinutes: 2 } });
    await u.canStart();
    for (let s = 1; s <= 5; s++) u.tick(s * 1000);
    day = '2026-10-03';
    for (let s = 6; s <= 15; s++) u.tick(s * 1000);
    await u.flush();
    expect(r.m.get('st:2026-10-03')).toBe(10);
    expect(await u.canStart()).toEqual({ ok: true, dailySecondsLeft: 110 });
    expect(u.secondsLeft).toBe(110);
  });

  it('activity resets the idle clock, and the idle stop needs the full idle time since the last activity', async () => {
    const u = new VoiceUsage({ repo: repo(), staffId: 'st', today: () => '2026-10-02', limits: { sessionMinutes: 10, idleSeconds: 30, dailyMinutes: 60 } });
    await u.canStart();
    u.activity(0);
    let stop = null;
    for (let s = 1; s <= 29; s++) stop = u.tick(s * 1000);
    expect(stop).toBeNull();
    u.activity(29_000);
    for (let s = 30; s <= 58; s++) stop = u.tick(s * 1000);
    expect(stop).toBeNull(); // 29 s since the last activity
    expect(u.tick(59_000)).toBe('idle');
  });
});
