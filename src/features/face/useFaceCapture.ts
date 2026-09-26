'use client';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useServices } from '@/hooks/services';
import type { CameraError, CameraSession, CaptureGuidance, CapturedFrame, LivenessError, LivenessMode, LivenessOptions, LivenessPurpose } from '@/services/face';

export type FaceRunFailure = CameraError | Exclude<LivenessError, 'cancelled'>;

export type FaceRunState =
  | { readonly phase: 'opening' }
  /** The WebView refused to start the preview without a gesture: one tap starts it. */
  | { readonly phase: 'tap' }
  | {
      readonly phase: 'running';
      readonly source: 'device' | 'simulated';
      readonly mode: LivenessMode | null;
      readonly step: number;
      readonly guidance: CaptureGuidance;
      readonly countdown?: number;
      /** Object URLs of the photos taken so far (revoked when the screen leaves). Empty string: simulated photo. */
      readonly thumbs: readonly string[];
    };

/**
 * Opens the camera, shows its preview in `video`, and runs the guided check.
 * The camera stops when the screen leaves; photos go to `onDone` in memory only.
 */
export function useFaceCapture(purpose: LivenessPurpose, onDone: (frames: CapturedFrame[]) => void, onFail: (error: FaceRunFailure) => void, options: LivenessOptions = {}) {
  const { faceCapture, liveness } = useServices();
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<FaceRunState>({ phase: 'opening' });
  const resume = useRef<(() => void) | null>(null);
  const done = useEffectEvent(onDone);
  const fail = useEffectEvent(onFail);
  const { guided = false, viewAspect } = options;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const urls: string[] = [];
    let session: CameraSession | null = null;
    let attached: HTMLVideoElement | null = null;
    const update = (patch: Partial<Extract<FaceRunState, { phase: 'running' }>>) =>
      !signal.aborted && setState((s) => (s.phase === 'running' ? { ...s, ...patch } : s));

    /** muted + playsInline plays without a gesture almost everywhere; where it doesn't, wait for one tap. */
    const play = async (el: HTMLVideoElement) => {
      try {
        await el.play();
        return;
      } catch {
        if (signal.aborted) return;
      }
      setState({ phase: 'tap' });
      await new Promise<void>((resolve) => {
        resume.current = () => void el.play().then(resolve, () => undefined);
        signal.addEventListener('abort', () => resolve(), { once: true });
      });
      resume.current = null;
    };

    const start = async () => {
      const opened = await faceCapture.open();
      if (signal.aborted) {
        if (opened.ok) opened.value.close();
        return;
      }
      if (!opened.ok) return fail(opened.error);
      session = opened.value;
      const el = video.current;
      if (el && session.stream) {
        attached = el;
        el.srcObject = session.stream;
        await play(el);
        if (signal.aborted) return;
      }
      setState({ phase: 'running', source: session.kind, mode: null, step: 1, guidance: 'starting', thumbs: [] });
      const result = await liveness.run(
        session,
        el,
        purpose,
        {
          onMode: (mode) => update({ mode }),
          onGuidance: (step, guidance, countdown) => update({ step, guidance, countdown }),
          onCapture: (_step, frame) => {
            if (signal.aborted) return;
            const url = frame.image ? URL.createObjectURL(frame.image) : '';
            if (url) urls.push(url);
            setState((s) => (s.phase === 'running' ? { ...s, thumbs: [...s.thumbs, url] } : s));
          },
        },
        signal,
        { guided, viewAspect },
      );
      if (signal.aborted) return;
      if (result.ok) done(result.value);
      else if (result.error !== 'cancelled') fail(result.error);
    };
    // Started from a task, not synchronously in the effect body; aborted (and the camera stopped) on unmount.
    const timer = setTimeout(() => {
      start().catch(() => {
        // Anything unexpected in the camera or detection runtime: say the camera didn't start, never hang.
        if (!signal.aborted) fail('failed');
      });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
      session?.close();
      if (attached) attached.srcObject = null;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [faceCapture, liveness, purpose, guided, viewAspect]);

  /** The "Tap to start the camera" button (a user gesture, so the WebView lets the preview play). */
  const tapToStart = useCallback(() => resume.current?.(), []);

  return { video, state, tapToStart };
}
