'use client';
import { useEffect, useEffectEvent, useState } from 'react';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useSimDelay } from '@/hooks/useSimDelay';
import type { LocationCheck } from '@/services/location';
import type { VerificationPurpose } from '@/services/verification';
import type { ProblemKind } from '../feedback/problems';

export type VerifyPhase =
  | { readonly kind: 'starting' }
  | { readonly kind: 'primer'; readonly permission: 'location' | 'camera' }
  | { readonly kind: 'locating'; readonly visible: boolean }
  | { readonly kind: 'located' }
  | { readonly kind: 'confirm'; readonly distanceM: number }
  | { readonly kind: 'facing' }
  | { readonly kind: 'faced' }
  | { readonly kind: 'problem'; readonly problem: ProblemKind; readonly distanceM?: number; readonly retry: 'all' | 'face' | 'none' }
  | { readonly kind: 'passed' };

/** Prototype hold times: long enough to read "Location verified", short enough not to slow marking. */
const HOLD_MS = 900;

/**
 * The verification module (PRD §8) as a state machine the screen renders.
 * Location runs before face. Location failures are not retryable from the same
 * place ("go to the institute"); face failures retry up to the configured limit.
 */
export function useVerification(purpose: VerificationPurpose, onPassed: () => void) {
  const ctx = useSession();
  const { verification } = useServices();
  const hold = useSimDelay();
  const j = ctx.journey.verification;
  const [phase, setPhase] = useState<VerifyPhase>({ kind: 'starting' });
  const [attempt, setAttempt] = useState(0);
  const [faceFailures, setFaceFailures] = useState(0);
  const [location, setLocation] = useState<LocationCheck | undefined>(undefined);

  const runFace = async (signal: AbortSignal, loc: LocationCheck | undefined) => {
    if (j.face) {
      if ((await verification.cameraPermission()) !== 'granted') {
        if (!signal.aborted) setPhase({ kind: 'primer', permission: 'camera' });
        return;
      }
      setPhase({ kind: 'facing' });
      const face = await verification.checkFace(ctx, signal);
      if (signal.aborted) return;
      if (!face.ok) {
        if (face.error === 'camera_denied') return setPhase({ kind: 'problem', problem: 'cameraDeniedVerify', retry: 'face' });
        const failures = faceFailures + 1;
        setFaceFailures(failures);
        const limited = j.faceRetryLimit !== null && failures >= j.faceRetryLimit;
        return setPhase({ kind: 'problem', problem: limited ? 'faceLimit' : 'face', retry: limited ? 'none' : 'face' });
      }
      setPhase({ kind: 'faced' });
      if (!(await hold(HOLD_MS, signal))) return;
    }
    await verification.grant(ctx, purpose, loc);
    if (!signal.aborted) {
      setPhase({ kind: 'passed' });
      onPassed();
    }
  };

  const runAll = useEffectEvent(async (signal: AbortSignal, from: 'all' | 'face') => {
    if (from === 'face') return runFace(signal, location);
    if (j.location !== 'none') {
      const permission = await verification.locationPermission();
      if (signal.aborted) return;
      if (permission === 'prompt') return setPhase({ kind: 'primer', permission: 'location' });
      if (permission === 'denied') return setPhase({ kind: 'problem', problem: 'locationDenied', retry: 'all' });
      setPhase({ kind: 'locating', visible: j.location === 'fence' || j.face });
      const result = await verification.checkLocation(ctx);
      if (signal.aborted) return;
      if (!result.ok) {
        if (result.error === 'outside_fence') {
          const distanceM = Number(result.detail?.distanceM ?? 0);
          return setPhase({ kind: 'problem', problem: 'outside', distanceM, retry: 'all' });
        }
        if (result.error === 'permission_denied') return setPhase({ kind: 'problem', problem: 'locationDenied', retry: 'all' });
        // A timeout means GPS is on but found no fix (common indoors); "unavailable" means location is off.
        if (result.error === 'timeout') return setPhase({ kind: 'problem', problem: 'noFix', retry: 'all' });
        if (result.error !== 'not_required') return setPhase({ kind: 'problem', problem: 'gps', retry: 'all' });
      }
      const loc = result.ok ? result.value : undefined;
      setLocation(loc);
      if (j.location === 'fence') {
        if (j.fencePassPrompt === 'confirm' && loc) return setPhase({ kind: 'confirm', distanceM: loc.location.distanceM ?? 0 });
        setPhase({ kind: 'located' });
        if (!(await hold(HOLD_MS, signal))) return;
      }
      return runFace(signal, loc);
    }
    return runFace(signal, undefined);
  });

  const [from, setFrom] = useState<'all' | 'face'>('all');
  useEffect(() => {
    const controller = new AbortController();
    // Started from a task, not synchronously in the effect body; aborted on unmount.
    const timer = setTimeout(() => void runAll(controller.signal, from), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt, from]);

  const restart = (next: 'all' | 'face') => {
    setFrom(next);
    setAttempt((a) => a + 1);
  };

  return {
    phase,
    location,
    retry: () => restart(phase.kind === 'problem' && phase.retry === 'face' ? 'face' : 'all'),
    allowLocation: async () => {
      const state = await verification.requestLocationPermission();
      if (state === 'granted') restart('all');
      else setPhase({ kind: 'problem', problem: 'locationDenied', retry: 'all' });
    },
    allowCamera: async () => {
      const state = await verification.requestCameraPermission();
      if (state === 'granted') restart('face');
      else setPhase({ kind: 'problem', problem: 'cameraDeniedVerify', retry: 'face' });
    },
    confirmLocation: () => restart('face'),
  };
}
