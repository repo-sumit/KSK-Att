/**
 * FaceVerificationService contract (PRD §8.3, §8.5).
 *
 * IMPORTANT: this build ships only SimulatedFaceVerificationService. It captures
 * no images, performs no recognition and provides NO security. A production
 * implementation must wrap a certified liveness + match provider behind this
 * same interface (see docs/ARCHITECTURE.md → Face verification).
 */
import type { StaffId } from '@/domain/entities';
import type { Result } from '@/lib/result';
import type { PermissionState } from './simulation';

/** Live guidance shown on the camera screen while a capture is in progress. */
export type CaptureGuidance = 'find_face' | 'move_closer' | 'hold_still' | 'good' | 'more_light' | 'one_face_only';

export type EnrolmentError = 'camera_denied' | 'poor_light' | 'multiple_faces' | 'save_failed' | 'cancelled';
export type FaceMatchError = 'camera_denied' | 'no_match' | 'not_enrolled' | 'cancelled';

export interface CaptureCallbacks {
  /** Called for each guidance change; step is 1-based. */
  onGuidance(step: number, guidance: CaptureGuidance): void;
  onStepComplete(step: number): void;
}

export interface FaceVerificationService {
  /** True for the demo implementation: screens then label every face step as a simulation (D-009). */
  readonly simulated: boolean;
  readonly requiredCaptures: number;
  cameraPermission(): Promise<PermissionState>;
  requestCameraPermission(): Promise<PermissionState>;
  isEnrolled(staffId: StaffId): Promise<boolean>;
  enrol(staffId: StaffId, callbacks: CaptureCallbacks, signal: AbortSignal): Promise<Result<true, EnrolmentError>>;
  verify(staffId: StaffId, signal: AbortSignal): Promise<Result<true, FaceMatchError>>;
}
