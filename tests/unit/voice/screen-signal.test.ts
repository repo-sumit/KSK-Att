import { describe, expect, it } from 'vitest';
import { screenSignal, voiceFingerprint } from '@/features/voice/screen-signal';

const q = (s: string) => new URLSearchParams(s);
describe('screenSignal', () => {
  it('maps every attendance route', () => {
    expect(screenSignal('/home', q(''))).toEqual({ kind: 'home' });
    expect(screenSignal('/attendance/trade', q('trade=ele'))).toEqual({ kind: 'trade', tradeId: 'ele' });
    for (const kind of ['open', 'mark', 'review', 'submitted', 'record'] as const)
      expect(screenSignal(`/attendance/${kind}`, q('s=ele-s1u2.2026-09-25.daily'))).toEqual({ kind, sessionKey: 'ele-s1u2.2026-09-25.daily' });
    expect(screenSignal('/reports', q(''))).toEqual({ kind: 'other' });
    expect(screenSignal('/attendance/mark', q(''))).toEqual({ kind: 'other' });
  });
});

describe('voiceFingerprint (Review Focus 2)', () => {
  it('ignores a rebuilt context with the same configuration, changes with the configuration or the user', async () => {
    const { setup, signIn } = await import('../../helpers/app');
    const env = setup({ voice: { enabled: true } });
    const a = await signIn(env.app, 'TR-10432');
    const b = (await env.app.services.session.load())!;   // a new SessionContext object, same configuration
    expect(b).not.toBe(a);
    expect(voiceFingerprint(b)).toBe(voiceFingerprint(a));
    env.setConfig({ voice: { enabled: true }, marking: { defaultStatus: 'blank' } });
    const c = (await env.app.services.session.load())!;
    expect(voiceFingerprint(c)).not.toBe(voiceFingerprint(a));
  });
});
