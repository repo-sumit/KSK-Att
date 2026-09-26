/**
 * Face seams for demos and tests — SIMULATION ONLY.
 *
 *  - SimulatedFaceCaptureService: the demo's "no camera" option. No stream is
 *    opened; captures are placeholders.
 *  - SimulatedLivenessService: plays a realistic guidance sequence (and the
 *    demo's "too dark" / "two faces" outcomes) for simulated sessions.
 *  - MockFaceMatchService: the ONLY matcher in this build. It never compares
 *    faces: enrolment stores "enrolled at, N photos" (the photos themselves are
 *    dropped), and verification returns the outcome chosen in the demo panel.
 *    It must never be presented as biometric security.
 */
import type { FaceEnrolmentRepository } from '@/repositories/interfaces';
import { err, ok, type Result } from '@/lib/result';
import type { Clock } from '@/lib/time';
import {
  LIVENESS_STEPS,
  type CameraError,
  type CameraSession,
  type CaptureGuidance,
  type CapturedFrame,
  type FaceCaptureService,
  type FaceMatchService,
  type LivenessCallbacks,
  type LivenessError,
  type LivenessPurpose,
  type LivenessService,
  type LivenessStepKind,
} from '../face';
import { simulatedDelay, type SimulationSource } from '../simulation';

class SimulatedCameraSession implements CameraSession {
  readonly kind = 'simulated';
  readonly stream = null;
  constructor(private readonly clock: Clock) {}
  async capture(): Promise<CapturedFrame> {
    return { source: 'simulated', image: null, width: 0, height: 0, capturedAt: this.clock.now().toISOString() };
  }
  close(): void {}
}

export class SimulatedFaceCaptureService implements FaceCaptureService {
  constructor(
    private readonly sim: SimulationSource,
    private readonly clock: Clock,
  ) {}

  source() {
    return 'simulated' as const;
  }

  async permission() {
    return this.sim.get().permissions.camera;
  }

  /** Behaves like the real prompt: the first open "asks", a demo "camera denied" outcome refuses. */
  async open(): Promise<Result<CameraSession, CameraError>> {
    const state = this.sim.get();
    const denied = state.face === 'camera_denied' || state.permissions.camera === 'denied';
    this.sim.update({ permissions: { ...state.permissions, camera: denied ? 'denied' : 'granted' } });
    return denied ? err('permission_denied') : ok(new SimulatedCameraSession(this.clock));
  }
}

const SEQUENCE: Readonly<Record<LivenessStepKind, ReadonlyArray<readonly [CaptureGuidance, number]>>> = {
  straight: [['find_face', 700], ['move_closer', 700], ['hold_still', 800], ['good', 500]],
  turn_left: [['turn_left', 900], ['hold_still', 500], ['good', 500]],
  turn_right: [['turn_right', 900], ['hold_still', 500], ['good', 500]],
};

export class SimulatedLivenessService implements LivenessService {
  private readonly wait: (ms: number) => Promise<void>;
  constructor(private readonly sim: SimulationSource) {
    this.wait = simulatedDelay(sim);
  }

  async run(session: CameraSession, _video: HTMLVideoElement | null, purpose: LivenessPurpose, cb: LivenessCallbacks, signal: AbortSignal): Promise<Result<CapturedFrame[], LivenessError>> {
    // A simulated session has no preview, so framing options don't apply.
    cb.onMode('simulated');
    const issue = this.sim.get().enrolmentIssue;
    const frames: CapturedFrame[] = [];
    const steps = LIVENESS_STEPS[purpose];
    for (let i = 0; i < steps.length; i++) {
      if (i === 0 && purpose === 'enrol' && (issue === 'poor_light' || issue === 'multiple_faces')) {
        cb.onGuidance(1, 'find_face');
        await this.wait(800);
        cb.onGuidance(1, issue === 'poor_light' ? 'more_light' : 'one_face_only');
        await this.wait(2000);
        return err(signal.aborted ? 'cancelled' : issue);
      }
      for (const [guidance, ms] of purpose === 'verify' ? ([['hold_still', 1200], ['good', 400]] as const) : SEQUENCE[steps[i]]) {
        if (signal.aborted) return err('cancelled');
        cb.onGuidance(i + 1, guidance);
        await this.wait(ms);
      }
      const frame = await session.capture(null);
      frames.push(frame);
      cb.onCapture(i + 1, frame);
    }
    return signal.aborted ? err('cancelled') : ok(frames);
  }
}

export class MockFaceMatchService implements FaceMatchService {
  readonly simulated = true;
  private readonly wait: (ms: number) => Promise<void>;

  constructor(
    private readonly sim: SimulationSource,
    private readonly enrolments: FaceEnrolmentRepository,
    private readonly clock: Clock,
  ) {
    this.wait = simulatedDelay(sim);
  }

  async isEnrolled(staffId: string) {
    return Boolean(await this.enrolments.get(staffId));
  }

  async enrol(staffId: string, frames: readonly CapturedFrame[]) {
    await this.wait(600);
    if (this.sim.get().enrolmentIssue === 'save_failed') return err('save_failed');
    // Only the fact of enrolment is kept; the photos are not stored anywhere.
    await this.enrolments.save({ staffId, enrolledAt: this.clock.now().toISOString(), sampleCount: frames.length, simulated: true });
    return ok(true as const);
  }

  /** The photo is accepted and ignored: nothing is compared. */
  async verify(staffId: string, _frame: CapturedFrame) {
    void _frame;
    await this.wait(900);
    if (!(await this.isEnrolled(staffId))) return err('not_enrolled');
    return this.sim.get().face === 'no_match' ? err('no_match') : ok(true as const);
  }
}
