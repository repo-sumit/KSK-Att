import { describe, expect, it, vi } from 'vitest';
import { err } from '@/lib/result';
import type { CapturedFrame } from '@/services/face';
import type { LocationProvider } from '@/services/location';
import { VerificationService, type VerificationEvent } from '@/services/verification';
import { setup, signIn } from '../../helpers/app';

describe('VerificationService events', () => {
  it('reports a fence pass, then the grant', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10432');
    const seen = vi.fn();
    env.app.services.verification.subscribe(seen);
    const purpose = { kind: 'session' as const, key: 'ele-s1u2.2026-09-25.daily' };
    const loc = await env.app.services.verification.checkLocation(ctx, purpose);
    await env.app.services.verification.grant(ctx, purpose, loc.ok ? loc.value : undefined);
    expect(seen.mock.calls.map((c) => c[0])).toEqual([
      { type: 'location', purpose: 'session:ele-s1u2.2026-09-25.daily', result: 'inside', distanceM: expect.any(Number) },
      { type: 'granted', purpose: 'session:ele-s1u2.2026-09-25.daily' },
    ]);
  });
  it('reports outside with the distance', async () => {
    const env = setup();
    env.simulation.update({ location: 'outside', outsideDistanceM: 24_360 });
    const ctx = await signIn(env.app, 'TR-10432');
    const seen = vi.fn();
    env.app.services.verification.subscribe(seen);
    await env.app.services.verification.checkLocation(ctx, { kind: 'session', key: 'k' });
    expect(seen).toHaveBeenCalledWith({ type: 'location', purpose: 'session:k', result: 'outside', distanceM: expect.closeTo(24_360, -2) });
  });
  it('camera events fire on change only, and a throwing listener is contained', () => {
    const env = setup();
    const seen = vi.fn();
    env.app.services.verification.subscribe(() => { throw new Error('bad listener'); });
    env.app.services.verification.subscribe(seen);
    const p = { kind: 'session' as const, key: 'k' };
    env.app.services.verification.cameraActive(p, true);
    env.app.services.verification.cameraActive(p, true);
    env.app.services.verification.cameraActive(p, false);
    expect(seen.mock.calls.map((c) => c[0].on)).toEqual([true, false]);
  });
  it('emits nothing without a purpose (existing callers unchanged)', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10432');
    const seen = vi.fn();
    env.app.services.verification.subscribe(seen);
    await env.app.services.verification.checkLocation(ctx);
    expect(seen).not.toHaveBeenCalled();
  });
});

type Env = ReturnType<typeof setup>;

const session = { kind: 'session' as const, key: 'k' };
const frame: CapturedFrame = { source: 'simulated', image: null, width: 0, height: 0, capturedAt: '2026-09-25T04:45:00.000Z' };

/** Collects every event the service emits from here on. */
function record(env: Env): VerificationEvent[] {
  const seen: VerificationEvent[] = [];
  env.app.services.verification.subscribe((e) => seen.push(e));
  return seen;
}

describe('location events: every outcome, once per call', () => {
  it('geo-tagging reports "tagged" with no distance', async () => {
    const env = setup({ verification: { geoMode: 'tagging' } });
    const ctx = await signIn(env.app, 'TR-10432');
    const seen = record(env);
    expect((await env.app.services.verification.checkLocation(ctx, session)).ok).toBe(true);
    expect(seen).toEqual([{ type: 'location', purpose: 'session:k', result: 'tagged' }]);
    expect('distanceM' in seen[0]).toBe(false);
  });

  it.each(['permission_denied', 'unavailable'] as const)('reports the position error "%s" in fencing mode', async (outcome) => {
    const env = setup();
    env.simulation.update({ location: outcome });
    const ctx = await signIn(env.app, 'TR-10432');
    const seen = record(env);
    expect(await env.app.services.verification.checkLocation(ctx, session)).toMatchObject({ ok: false, error: outcome });
    expect(seen).toEqual([{ type: 'location', purpose: 'session:k', result: outcome }]);
  });

  it('reports a position error in geo-tagging mode too', async () => {
    const env = setup({ verification: { geoMode: 'tagging' } });
    env.simulation.update({ location: 'unavailable' });
    const ctx = await signIn(env.app, 'TR-10432');
    const seen = record(env);
    await env.app.services.verification.checkLocation(ctx, session);
    expect(seen).toEqual([{ type: 'location', purpose: 'session:k', result: 'unavailable' }]);
  });

  it('reports a timeout from the position provider (only the device GPS produces one)', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10432');
    const noFix: LocationProvider = { permission: async () => 'granted', requestPermission: async () => 'granted', currentPosition: async () => err('timeout') };
    const service = new VerificationService(env.app.repositories.verification, noFix, env.app.services.faceCapture, env.app.services.faceMatch);
    const seen: VerificationEvent[] = [];
    service.subscribe((e) => seen.push(e));
    expect(await service.checkLocation(ctx, session)).toMatchObject({ ok: false, error: 'timeout' });
    expect(seen).toEqual([{ type: 'location', purpose: 'session:k', result: 'timeout' }]);
  });

  it('emits once per call, and names the purpose "self" for self attendance', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10432');
    const seen = record(env);
    await env.app.services.verification.checkLocation(ctx, { kind: 'self' });
    await env.app.services.verification.checkLocation(ctx, { kind: 'self' });
    expect(seen).toEqual([
      { type: 'location', purpose: 'self', result: 'inside', distanceM: expect.any(Number) },
      { type: 'location', purpose: 'self', result: 'inside', distanceM: expect.any(Number) },
    ]);
  });

  it('says nothing when location is not part of the journey', async () => {
    const env = setup({ verification: { geoMode: 'off' } });
    const ctx = await signIn(env.app, 'TR-10432');
    const seen = record(env);
    expect(await env.app.services.verification.checkLocation(ctx, session)).toMatchObject({ ok: false, error: 'not_required' });
    expect(seen).toEqual([]);
  });
});

describe('location permission request events', () => {
  it('announces a refused primer once when a purpose is given', async () => {
    const env = setup();
    env.simulation.update({ location: 'permission_denied' });
    const seen = record(env);
    expect(await env.app.services.verification.requestLocationPermission(session)).toBe('denied');
    expect(seen).toEqual([{ type: 'location', purpose: 'session:k', result: 'permission_denied' }]);
  });

  it('says nothing without a purpose, even when refused', async () => {
    const env = setup();
    env.simulation.update({ location: 'permission_denied' });
    const seen = record(env);
    expect(await env.app.services.verification.requestLocationPermission()).toBe('denied');
    expect(seen).toEqual([]);
  });

  it('says nothing when the permission is granted', async () => {
    const env = setup();
    const seen = record(env);
    expect(await env.app.services.verification.requestLocationPermission(session)).toBe('granted');
    expect(seen).toEqual([]);
  });
});

describe('face events', () => {
  it('reports a match', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10432');
    const seen = record(env);
    expect((await env.app.services.verification.matchFace(ctx, frame, session)).ok).toBe(true);
    expect(seen).toEqual([{ type: 'face', purpose: 'session:k', result: 'match' }]);
  });

  it('reports no_match', async () => {
    const env = setup();
    env.simulation.update({ face: 'no_match' });
    const ctx = await signIn(env.app, 'TR-10432');
    const seen = record(env);
    expect(await env.app.services.verification.matchFace(ctx, frame, session)).toMatchObject({ ok: false, error: 'no_match' });
    expect(seen).toEqual([{ type: 'face', purpose: 'session:k', result: 'no_match' }]);
  });

  it('reports a person with no stored reference as no_match too: the screen shows the same failed-match problem', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10432');
    env.app.mockDatabase.setFaceEnrolled(ctx.user.id, false, env.clock.now().toISOString());
    const seen = record(env);
    expect(await env.app.services.verification.matchFace(ctx, frame, session)).toMatchObject({ ok: false, error: 'not_enrolled' });
    expect(seen).toEqual([{ type: 'face', purpose: 'session:k', result: 'no_match' }]);
  });

  it('reports a check that saw no clear face as check_failed, so voice counts the tries the screen counts', async () => {
    const env = setup();
    const seen = record(env);
    env.app.services.verification.faceCheckFailed(session);
    expect(seen).toEqual([{ type: 'face', purpose: 'session:k', result: 'check_failed' }]);
  });

  it('says nothing when face is not part of the journey, or when no purpose is given', async () => {
    const off = setup({ verification: { face: false } });
    const offCtx = await signIn(off.app, 'TR-10432');
    const offSeen = record(off);
    expect(await off.app.services.verification.matchFace(offCtx, frame, session)).toMatchObject({ ok: false, error: 'not_required' });
    expect(offSeen).toEqual([]);

    const on = setup();
    const onCtx = await signIn(on.app, 'TR-10432');
    const onSeen = record(on);
    expect((await on.app.services.verification.matchFace(onCtx, frame)).ok).toBe(true);
    expect(onSeen).toEqual([]);
  });
});

describe('camera, prompt and grant events', () => {
  it('tracks the camera per purpose: an "off" with no earlier "on" says nothing', () => {
    const env = setup();
    const seen = record(env);
    const a = { kind: 'session' as const, key: 'a' };
    const b = { kind: 'session' as const, key: 'b' };
    env.app.services.verification.cameraActive(a, false);
    env.app.services.verification.cameraActive(a, true);
    env.app.services.verification.cameraActive(b, true);
    env.app.services.verification.cameraActive(a, false);
    env.app.services.verification.cameraActive(a, false);
    expect(seen).toEqual([
      { type: 'camera', purpose: 'session:a', on: true },
      { type: 'camera', purpose: 'session:b', on: true },
      { type: 'camera', purpose: 'session:a', on: false },
    ]);
  });

  it('cameraIsOn and camerasOn say which cameras are on right now', () => {
    const env = setup();
    const v = env.app.services.verification;
    const a = { kind: 'session' as const, key: 'a' };
    expect(v.cameraIsOn()).toBe(false);
    expect(v.camerasOn()).toEqual([]);
    v.cameraActive(a, true);
    v.cameraActive({ kind: 'self' }, true);
    expect(v.cameraIsOn()).toBe(true);
    expect(v.camerasOn()).toEqual(['session:a', 'self']);
    v.cameraActive(a, false);
    v.cameraActive({ kind: 'self' }, false);
    expect(v.cameraIsOn()).toBe(false);
  });

  it('notify emits a prompt every time it is called', () => {
    const env = setup();
    const seen = record(env);
    env.app.services.verification.notify(session, 'confirm_location');
    env.app.services.verification.notify(session, 'confirm_location');
    env.app.services.verification.notify({ kind: 'self' }, 'face_enrolment');
    expect(seen).toEqual([
      { type: 'prompt', purpose: 'session:k', need: 'confirm_location' },
      { type: 'prompt', purpose: 'session:k', need: 'confirm_location' },
      { type: 'prompt', purpose: 'self', need: 'face_enrolment' },
    ]);
  });

  it('announces the grant only after the pass is stored', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10432');
    let stored: Promise<boolean> | undefined;
    env.app.services.verification.subscribe((e) => {
      if (e.type === 'granted') stored = env.app.services.verification.hasPass(ctx, session);
    });
    await env.app.services.verification.grant(ctx, session);
    expect(await stored).toBe(true);
  });

  it('stops delivering after the returned unsubscribe is called, without touching other listeners', () => {
    const env = setup();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribe = env.app.services.verification.subscribe(first);
    env.app.services.verification.subscribe(second);
    env.app.services.verification.notify(session, 'face_enrolment');
    unsubscribe();
    env.app.services.verification.notify(session, 'face_enrolment');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('the same function subscribed twice is called twice per event, and one unsubscribe leaves the other', () => {
    const env = setup();
    const same = vi.fn();
    const first = env.app.services.verification.subscribe(same);
    const second = env.app.services.verification.subscribe(same);
    env.app.services.verification.notify(session, 'face_enrolment');
    expect(same).toHaveBeenCalledTimes(2);
    first();
    env.app.services.verification.notify(session, 'face_enrolment');
    expect(same).toHaveBeenCalledTimes(3); // the second subscription still delivers, once per event
    first(); // unsubscribing twice changes nothing
    env.app.services.verification.notify(session, 'face_enrolment');
    expect(same).toHaveBeenCalledTimes(4);
    second();
    env.app.services.verification.notify(session, 'face_enrolment');
    expect(same).toHaveBeenCalledTimes(4);
  });

  it('a throwing listener never breaks a check or the grant', async () => {
    const env = setup();
    const ctx = await signIn(env.app, 'TR-10432');
    env.app.services.verification.subscribe(() => { throw new Error('bad listener'); });
    const seen = record(env);
    const loc = await env.app.services.verification.checkLocation(ctx, session);
    expect(loc.ok).toBe(true);
    expect(await env.app.services.verification.grant(ctx, session, loc.ok ? loc.value : undefined)).toMatchObject({ ok: true });
    expect(await env.app.services.verification.hasPass(ctx, session)).toBe(true);
    expect(seen.map((e) => e.type)).toEqual(['location', 'granted']);
  });
});
