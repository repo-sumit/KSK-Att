/**
 * MockFaceVerificationService — SIMULATION ONLY. Plays a realistic guidance
 * sequence and returns the outcome chosen in the demo panel. No camera frames
 * are read, stored or compared; it must never be presented as biometric
 * security. Replace with a RealFaceVerificationService behind the same interface.
 */
import type { FaceEnrolmentRepository } from '@/repositories/interfaces';
import { err, ok } from '@/lib/result';
import type { Clock } from '@/lib/time';
import type { CaptureCallbacks, CaptureGuidance, FaceVerificationService } from '../face';
import { simulatedDelay, type SimulationSource } from '../simulation';

const FIRST_STEP: ReadonlyArray<readonly [CaptureGuidance, number]> = [['find_face', 900], ['move_closer', 900], ['hold_still', 900], ['good', 700]];
const LATER_STEP: ReadonlyArray<readonly [CaptureGuidance, number]> = [['hold_still', 900], ['good', 700]];

export class SimulatedFaceVerificationService implements FaceVerificationService {
  readonly simulated = true;
  readonly requiredCaptures = 3;
  private readonly wait: (ms: number) => Promise<void>;

  constructor(
    private readonly sim: SimulationSource,
    private readonly enrolments: FaceEnrolmentRepository,
    private readonly clock: Clock,
  ) {
    this.wait = simulatedDelay(sim);
  }

  async cameraPermission() {
    return this.sim.get().permissions.camera;
  }

  async requestCameraPermission() {
    const state = this.sim.get();
    const next = state.face === 'camera_denied' ? 'denied' : 'granted';
    this.sim.update({ permissions: { ...state.permissions, camera: next } });
    return next;
  }

  async isEnrolled(staffId: string) {
    return Boolean(await this.enrolments.get(staffId));
  }

  async enrol(staffId: string, cb: CaptureCallbacks, signal: AbortSignal) {
    const state = this.sim.get();
    if (state.permissions.camera !== 'granted') return err('camera_denied');
    for (let step = 1; step <= this.requiredCaptures; step++) {
      if (step === 1 && (state.enrolmentIssue === 'poor_light' || state.enrolmentIssue === 'multiple_faces')) {
        cb.onGuidance(1, 'find_face');
        await this.wait(800);
        cb.onGuidance(1, state.enrolmentIssue === 'poor_light' ? 'more_light' : 'one_face_only');
        await this.wait(2000);
        return err(state.enrolmentIssue);
      }
      for (const [guidance, ms] of step === 1 ? FIRST_STEP : LATER_STEP) {
        if (signal.aborted) return err('cancelled');
        cb.onGuidance(step, guidance);
        await this.wait(ms);
      }
      cb.onStepComplete(step);
    }
    if (signal.aborted) return err('cancelled');
    if (state.enrolmentIssue === 'save_failed') return err('save_failed');
    await this.enrolments.save({ staffId, enrolledAt: this.clock.now().toISOString(), sampleCount: this.requiredCaptures, simulated: true });
    return ok(true as const);
  }

  async verify(staffId: string, signal: AbortSignal) {
    const state = this.sim.get();
    if (!(await this.isEnrolled(staffId))) return err('not_enrolled');
    if (state.permissions.camera !== 'granted' || state.face === 'camera_denied') return err('camera_denied');
    await this.wait(1800);
    if (signal.aborted) return err('cancelled');
    return state.face === 'no_match' ? err('no_match') : ok(true as const);
  }
}
