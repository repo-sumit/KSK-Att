/**
 * Face verification seams (PRD §8.3, §8.5), kept as three separate concepts
 * so a production provider can replace each one without touching the UI (D-048):
 *
 *  - FaceCaptureService — the camera. CameraFaceCaptureService opens the real
 *    front camera (getUserMedia); SimulatedFaceCaptureService is the demo's
 *    "no camera" option.
 *  - LivenessService — guides the user through the steps and takes the photos.
 *    BasicClientLivenessService uses on-device face detection (MediaPipe
 *    BlazeFace) to check that one face is present, close enough, inside the
 *    oval and turning when asked, and falls back to timed guided captures when
 *    detection can't start. It is a PROTOTYPE movement check, not production
 *    liveness detection: a printed photo moved by hand or a replayed video can pass it.
 *  - FaceMatchService — enrolment and identity matching. Only
 *    MockFaceMatchService exists: it never compares faces and its outcome is
 *    simulated. There is NO biometric security in this build.
 *
 * Photos are ephemeral: they live in memory for the current screen only and
 * are never stored (no localStorage) or sent anywhere.
 */
import type { StaffId } from '@/domain/entities';
import type { Result } from '@/lib/result';
import type { PermissionState } from './simulation';

// ---- Camera ----

/** permission_denied: blocked by the user, browser or host app · not_found: no camera · busy: in use elsewhere · unsupported: no camera API / insecure page. */
export type CameraError = 'permission_denied' | 'not_found' | 'busy' | 'unsupported' | 'failed';

export interface CapturedFrame {
  readonly source: 'device' | 'simulated';
  /** In-memory JPEG taken from the live video (device only). Never persisted. */
  readonly image: Blob | null;
  readonly width: number;
  readonly height: number;
  readonly capturedAt: string;
}

export interface CameraSession {
  readonly kind: 'device' | 'simulated';
  /** The live preview (device only); the screen attaches it to its <video>. */
  readonly stream: MediaStream | null;
  /** Grabs the current video frame (device) or a placeholder (simulated). */
  capture(video: HTMLVideoElement | null): Promise<CapturedFrame>;
  /** Stops the camera. Always called when the screen leaves. */
  close(): void;
}

export interface FaceCaptureService {
  /** Which camera the next open() uses: screens label a simulated one as such. */
  source(): 'device' | 'simulated';
  /** Best effort: 'prompt' when the platform can't tell (the permission primer then explains first). */
  permission(): Promise<PermissionState>;
  /** Opens the front camera; the first call triggers the browser / OS prompt. */
  open(): Promise<Result<CameraSession, CameraError>>;
}

// ---- Liveness-style guidance ----

export type LivenessPurpose = 'enrol' | 'verify';
export type LivenessStepKind = 'straight' | 'turn_left' | 'turn_right';

/** Registration: three angles (brief §12). Daily check: one frontal photo. */
export const LIVENESS_STEPS: Readonly<Record<LivenessPurpose, readonly LivenessStepKind[]>> = {
  enrol: ['straight', 'turn_left', 'turn_right'],
  verify: ['straight'],
};

/** detection: on-device face detection · guided: timed captures (detection unavailable) · simulated: no camera. */
export type LivenessMode = 'detection' | 'guided' | 'simulated';

/** Live guidance shown on the camera screen. */
export type CaptureGuidance =
  | 'starting'
  | 'find_face'
  | 'face_found'
  | 'move_closer'
  | 'move_back'
  | 'center_face'
  | 'one_face_only'
  | 'more_light'
  | 'look_straight'
  | 'hold_still'
  | 'turn_left'
  | 'turn_right'
  | 'turn_other_way'
  | 'turn_less'
  | 'countdown'
  | 'good';

export interface LivenessCallbacks {
  onMode(mode: LivenessMode): void;
  /** `step` is 1-based; `countdown` accompanies the 'countdown' guidance (guided mode). */
  onGuidance(step: number, guidance: CaptureGuidance, countdown?: number): void;
  onCapture(step: number, frame: CapturedFrame): void;
}

/**
 * Why a check gave up: the screen explains the one thing to change.
 * distance: too far or too close · off_centre: not inside the oval / not looking straight ·
 * no_turn: the head turn wasn't seen · camera_failed: the preview never started or the camera stopped.
 */
export type LivenessError = 'cancelled' | 'poor_light' | 'multiple_faces' | 'no_face' | 'distance' | 'off_centre' | 'no_turn' | 'camera_failed';

export interface LivenessOptions {
  /** Skip detection: timed guided captures (after repeated failed attempts, or the demo's "Guided only"). */
  readonly guided?: boolean;
  /** Width / height of the on-screen preview: framing is checked against what the person can actually see. */
  readonly viewAspect?: number;
}

export interface LivenessService {
  run(
    session: CameraSession,
    video: HTMLVideoElement | null,
    purpose: LivenessPurpose,
    callbacks: LivenessCallbacks,
    signal: AbortSignal,
    options?: LivenessOptions,
  ): Promise<Result<CapturedFrame[], LivenessError>>;
}

// ---- Matching ----

export type EnrolmentError = 'save_failed';
export type FaceMatchError = 'no_match' | 'not_enrolled';

export interface FaceMatchService {
  /** True while matching is simulated: every face screen then says so (D-040). */
  readonly simulated: boolean;
  isEnrolled(staffId: StaffId): Promise<boolean>;
  /** Registers a reference from the enrolment photos. The mock keeps only "enrolled at, N photos". */
  enrol(staffId: StaffId, frames: readonly CapturedFrame[]): Promise<Result<true, EnrolmentError>>;
  verify(staffId: StaffId, frame: CapturedFrame): Promise<Result<true, FaceMatchError>>;
}
