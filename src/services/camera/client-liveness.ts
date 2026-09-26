/**
 * BasicClientLivenessService — a PROTOTYPE movement check on the device.
 *
 * With face detection (MediaPipe BlazeFace): one face, close enough, inside
 * the oval, then straight / turn left / turn right as the steps ask, and a
 * photo is taken at each step. If detection can't start (no WebGL, old
 * WebView, assets unreachable), fails mid-way, or the caller asks for it
 * (repeated failed attempts, the demo's "Guided only"), the remaining steps
 * run as timed guided captures with a visible countdown.
 *
 * Not production liveness: it cannot tell a live person from a photo or a
 * video held up to the camera. Identity matching happens elsewhere (and is
 * simulated in this build).
 */
import { err, ok, type Result } from '@/lib/result';
import {
  LIVENESS_STEPS,
  type CameraSession,
  type CaptureGuidance,
  type CapturedFrame,
  type LivenessCallbacks,
  type LivenessError,
  type LivenessOptions,
  type LivenessPurpose,
  type LivenessService,
} from '../face';
import type { FaceDetectorPort } from './face-detector';
import { advance, assessFrame, diagnose, LIVENESS_RULES, START_PROGRESS, visibleRegion, type FrameObservation } from './liveness-rules';

const TICK_MS = 100;
/** Give up (and say why) after this long without finishing. */
const BUDGET_MS: Readonly<Record<LivenessPurpose, number>> = { enrol: 60_000, verify: 30_000 };
/** Detection start-up (download + compile) longer than this falls back to guided capture. */
const DETECTOR_START_MS = 12_000;
/** A preview that shows no frame by then never started (autoplay blocked, frozen track). */
const VIDEO_READY_MS = 8_000;
/** A new guidance must hold this many frames before it replaces the one on screen (no flicker at thresholds). */
const STABLE_FRAMES = 2;

export interface ClientLivenessOptions {
  /** 'guided' skips detection (demo setting); 'auto' tries detection first. */
  readonly mode: () => 'auto' | 'guided';
  readonly loadDetector: () => Promise<FaceDetectorPort>;
  /** Pauses for the guided countdown (scaled in automated tests). */
  readonly wait: (ms: number) => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Races the detector start against a timer; a detector that arrives after giving up is closed at once. */
async function startWithin(load: () => Promise<FaceDetectorPort>, ms: number): Promise<FaceDetectorPort | null> {
  let late = false;
  const loading = load();
  const timer = sleep(ms).then(() => {
    late = true;
    return null;
  });
  try {
    const winner = await Promise.race([loading, timer]);
    if (winner === null) {
      loading.then((d) => safeClose(d), () => undefined);
      return null;
    }
    return late ? null : winner;
  } catch {
    return null;
  }
}

function safeClose(detector: FaceDetectorPort | null) {
  try {
    detector?.close();
  } catch {
    // A runtime that already failed can throw on teardown; that must never replace a result.
  }
}

async function videoReady(video: HTMLVideoElement, signal: AbortSignal): Promise<boolean> {
  const until = Date.now() + VIDEO_READY_MS;
  while (!signal.aborted && Date.now() < until) {
    if (video.readyState >= 2 && video.videoWidth > 0) return true;
    await sleep(50);
  }
  return false;
}

/** Mean brightness of a 32×24 thumbnail of the current frame (0–255). */
function lumaOf(video: HTMLVideoElement, canvas: HTMLCanvasElement): number | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return sum / (data.length / 4);
}

/** Watches the camera track: another app taking the camera ends it mid-check. */
function watchTrack(session: CameraSession) {
  const state = { ended: false };
  const track = session.stream?.getVideoTracks()[0];
  const onEnded = () => {
    state.ended = true;
  };
  track?.addEventListener('ended', onEnded);
  return { state, stop: () => track?.removeEventListener('ended', onEnded) };
}

interface Run {
  readonly session: CameraSession;
  readonly video: HTMLVideoElement;
  readonly canvas: HTMLCanvasElement;
  readonly purpose: LivenessPurpose;
  readonly cb: LivenessCallbacks;
  readonly signal: AbortSignal;
  readonly frames: CapturedFrame[];
  readonly track: { readonly ended: boolean };
  readonly viewAspect?: number;
}

export class BasicClientLivenessService implements LivenessService {
  constructor(private readonly options: ClientLivenessOptions) {}

  async run(
    session: CameraSession,
    video: HTMLVideoElement | null,
    purpose: LivenessPurpose,
    cb: LivenessCallbacks,
    signal: AbortSignal,
    options: LivenessOptions = {},
  ): Promise<Result<CapturedFrame[], LivenessError>> {
    cb.onGuidance(1, 'starting');
    if (!video) return err('camera_failed');
    if (!(await videoReady(video, signal))) return err(signal.aborted ? 'cancelled' : 'camera_failed');
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 24;
    const watch = watchTrack(session);
    const run: Run = { session, video, canvas, purpose, cb, signal, frames: [], track: watch.state, viewAspect: options.viewAspect };

    let detector: FaceDetectorPort | null = null;
    try {
      if (!options.guided && this.options.mode() === 'auto') detector = await startWithin(this.options.loadDetector, DETECTOR_START_MS);
      if (signal.aborted) return err('cancelled');
      if (detector) {
        cb.onMode('detection');
        const result = await this.detect(detector, run);
        if (result !== 'fallback') return result;
      }
      cb.onMode('guided');
      return await this.guided(run);
    } finally {
      safeClose(detector);
      watch.stop();
    }
  }

  private async capture(run: Run, step: number): Promise<boolean> {
    const frame = await run.session.capture(run.video);
    // Left the screen while the photo was being encoded: drop it, don't hand it on.
    if (run.signal.aborted) return false;
    run.frames.push(frame);
    run.cb.onCapture(step, frame);
    return true;
  }

  private async detect(detector: FaceDetectorPort, run: Run): Promise<Result<CapturedFrame[], LivenessError> | 'fallback'> {
    const steps = LIVENESS_STEPS[run.purpose];
    const started = Date.now();
    const recent: CaptureGuidance[] = [];
    let progress = START_PROGRESS;
    let luma: number | null = null;
    let shown: CaptureGuidance | null = null;
    let candidate: CaptureGuidance | null = null;
    let held = 0;
    for (let tick = 0; ; tick++) {
      if (run.signal.aborted) return err('cancelled');
      if (run.track.ended) return err('camera_failed');
      if (Date.now() - started > BUDGET_MS[run.purpose]) return err(diagnose(recent.slice(-30)));
      if (tick % 5 === 0) luma = lumaOf(run.video, run.canvas);
      const { videoWidth: width, videoHeight: height } = run.video;
      let observation: FrameObservation;
      try {
        observation = { faces: detector.detect(run.video), width, height, luma, view: visibleRegion(width, height, run.viewAspect) };
      } catch {
        // The runtime failed mid-check: finish the remaining steps as guided captures.
        return 'fallback';
      }
      const step = advance(steps, progress, assessFrame(observation), Date.now());
      progress = step.progress;
      recent.push(step.guidance);
      if (step.capture && !(await this.capture(run, run.frames.length + 1))) return err('cancelled');
      if (progress.stepIndex >= steps.length) {
        run.cb.onGuidance(steps.length, 'good');
        return ok(run.frames);
      }
      // Show a new guidance once it has held for a moment; "Good" (a photo was taken) shows at once.
      if (step.guidance === candidate) held++;
      else [candidate, held] = [step.guidance, 1];
      if (step.guidance !== shown && (step.capture || held >= STABLE_FRAMES)) {
        shown = step.guidance;
        run.cb.onGuidance(progress.stepIndex + 1, step.guidance);
      }
      await sleep(TICK_MS);
    }
  }

  /** Detection unavailable: each remaining step shows its instruction, counts down, and takes the photo. */
  private async guided(run: Run): Promise<Result<CapturedFrame[], LivenessError>> {
    const steps = LIVENESS_STEPS[run.purpose];
    const { wait } = this.options;
    for (let i = run.frames.length; i < steps.length; i++) {
      const n = i + 1;
      const kind = steps[i];
      run.cb.onGuidance(n, kind === 'straight' ? 'look_straight' : kind);
      await wait(1200);
      // Too dark to be useful: wait for light (up to ~20 s) before counting down.
      for (let tries = 0; (lumaOf(run.video, run.canvas) ?? 255) < LIVENESS_RULES.dark; tries++) {
        if (run.signal.aborted) return err('cancelled');
        if (tries > 40) return err('poor_light');
        run.cb.onGuidance(n, 'more_light');
        await sleep(500);
      }
      for (let count = 3; count > 0; count--) {
        if (run.signal.aborted) return err('cancelled');
        if (run.track.ended) return err('camera_failed');
        run.cb.onGuidance(n, 'countdown', count);
        await wait(1000);
      }
      if (run.signal.aborted) return err('cancelled');
      if (!(await this.capture(run, n))) return err('cancelled');
      run.cb.onGuidance(n, 'good');
      await wait(500);
    }
    return ok(run.frames);
  }
}
