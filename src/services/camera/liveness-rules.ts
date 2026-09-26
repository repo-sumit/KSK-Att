/**
 * Pure rules for the prototype face check (no DOM, no ML): what a detected
 * frame means, and how the steps advance. Unit-tested with synthetic
 * detections (tests/unit/services/liveness-rules.test.ts).
 *
 * Inputs follow MediaPipe BlazeFace: bounding box in PIXELS, six keypoints
 * NORMALISED to 0..1 in this order: right eye, left eye, nose tip, mouth,
 * right ear, left ear ("right" = the subject's own right). Camera frames are
 * not mirrored (only the preview is, with CSS), so a positive yaw ratio means
 * the person turned to their own left.
 *
 * Thresholds come from measurements on BlazeFace (docs/ARCHITECTURE.md → Face
 * capture). This is a movement check for a prototype, NOT liveness detection.
 */
import type { CaptureGuidance, LivenessStepKind } from '../face';

export interface FacePoint {
  readonly x: number;
  readonly y: number;
}
export interface FaceBox {
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}
export interface FaceObservation {
  readonly score: number;
  readonly box: FaceBox;
  readonly keypoints: readonly FacePoint[];
}
/** A region of the frame in normalised coordinates. */
export interface FrameRegion {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}
const FULL_FRAME: FrameRegion = { x0: 0, y0: 0, x1: 1, y1: 1 };

export interface FrameObservation {
  readonly faces: readonly FaceObservation[];
  readonly width: number;
  readonly height: number;
  /** Mean brightness 0–255, or null when it couldn't be measured. */
  readonly luma: number | null;
  /** The part of the frame the person sees in the preview (object-fit: cover crop); the whole frame when omitted. */
  readonly view?: FrameRegion;
}

/**
 * The centred region an object-fit: cover preview of `viewAspect` (width / height)
 * shows of a `width` × `height` frame: a landscape webcam in a portrait oval loses its sides.
 */
export function visibleRegion(width: number, height: number, viewAspect?: number): FrameRegion {
  if (!viewAspect || !width || !height) return FULL_FRAME;
  const frameAspect = width / height;
  if (frameAspect > viewAspect) {
    const w = viewAspect / frameAspect;
    return { x0: (1 - w) / 2, y0: 0, x1: (1 + w) / 2, y1: 1 };
  }
  const h = frameAspect / viewAspect;
  return { x0: 0, y0: (1 - h) / 2, x1: 1, y1: (1 + h) / 2 };
}

export const LIVENESS_RULES = {
  /** A face this confident counts as present; weaker ones still count as "someone else in the frame". */
  presentScore: 0.7,
  otherFaceScore: 0.5,
  /** Mean brightness below this: ask for more light. */
  dark: 40,
  /** Face width as a share of the frame's shorter side (BlazeFace needs ≥ 0.20; a normal selfie is ~0.36). */
  minSize: 0.28,
  maxSize: 0.65,
  /** Keypoints must stay this far inside the frame edges. */
  edge: 0.03,
  /** How far the face centre may drift from the oval's centre (share of the frame). */
  centreX: 0.2,
  centreY: 0.25,
  /**
   * Yaw ratio (nose offset / eye distance ≈ 0.64·tan(yaw)): straight (±0.05 noise when frontal),
   * turned "slightly" (~16°), and "back near centre". A frame just under `turned` while still
   * clearly turned (≥ released) holds the count instead of restarting it: video noise is ±0.03.
   */
  straight: 0.1,
  turned: 0.18,
  released: 0.12,
  /** Consecutive qualifying frames (~10 per second): "Face detected" for the first few, then "Hold still". */
  straightFrames: 8,
  faceFoundFrames: 3,
  turnFrames: 3,
  /** Eye distance may not shrink below this share of the frontal one (moving away is not a turn). */
  eyeDistance: 0.75,
  /** A turn held the opposite way this long is taken as this device's "left" (mirrored cameras). */
  calibrateMs: 1500,
} as const;

export type FrameProblem = Extract<CaptureGuidance, 'find_face' | 'one_face_only' | 'more_light' | 'move_closer' | 'move_back' | 'center_face'>;
export type FrameVerdict = { readonly kind: 'problem'; readonly guidance: FrameProblem } | { readonly kind: 'face'; readonly yaw: number; readonly eyeDistance: number };

const R = LIVENESS_RULES;

/** What one frame shows: a problem to fix, or one usable face with its yaw ratio. */
export function assessFrame(frame: FrameObservation): FrameVerdict {
  if (frame.luma !== null && frame.luma < R.dark) return { kind: 'problem', guidance: 'more_light' };
  const candidates = frame.faces.filter((f) => f.score >= R.otherFaceScore);
  const present = candidates.filter((f) => f.score >= R.presentScore);
  if (present.length === 0) return { kind: 'problem', guidance: 'find_face' };
  if (candidates.length > 1) return { kind: 'problem', guidance: 'one_face_only' };
  const face = present[0];
  const v = frame.view ?? FULL_FRAME;
  const vw = v.x1 - v.x0;
  const vh = v.y1 - v.y0;
  // Size, edges and centre are measured against what the person sees in the preview.
  const size = face.box.width / Math.min(vw * frame.width, vh * frame.height);
  if (size < R.minSize) return { kind: 'problem', guidance: 'move_closer' };
  if (size > R.maxSize) return { kind: 'problem', guidance: 'move_back' };
  const inside = face.keypoints.every((p) => p.x >= v.x0 + R.edge * vw && p.x <= v.x1 - R.edge * vw && p.y >= v.y0 + R.edge * vh && p.y <= v.y1 - R.edge * vh);
  const cx = ((face.box.originX + face.box.width / 2) / frame.width - v.x0) / vw;
  const cy = ((face.box.originY + face.box.height / 2) / frame.height - v.y0) / vh;
  if (!inside || Math.abs(cx - 0.5) > R.centreX || Math.abs(cy - 0.5) > R.centreY) return { kind: 'problem', guidance: 'center_face' };
  const [rightEye, leftEye, nose] = face.keypoints;
  if (!rightEye || !leftEye || !nose) return { kind: 'problem', guidance: 'find_face' };
  const eyeSpan = Math.abs(leftEye.x - rightEye.x);
  if (eyeSpan === 0) return { kind: 'problem', guidance: 'find_face' };
  const yaw = (nose.x - (rightEye.x + leftEye.x) / 2) / eyeSpan;
  return { kind: 'face', yaw, eyeDistance: eyeSpan * frame.width };
}

export interface LivenessProgress {
  /** 0-based index into the purpose's steps; equals steps.length when done. */
  readonly stepIndex: number;
  readonly streak: number;
  /** When an opposite-direction turn started (uncalibrated first turn). */
  readonly wrongSince: number | null;
  /** Sign of the yaw ratio that means "turned left" on this device (+1 for unmirrored frames). */
  readonly leftSign: 1 | -1;
  readonly calibrated: boolean;
  readonly frontalEyeDistance: number | null;
  /** After a turn the head must come back past centre before the next one counts. */
  readonly needsCentre: boolean;
}

export const START_PROGRESS: LivenessProgress = { stepIndex: 0, streak: 0, wrongSince: null, leftSign: 1, calibrated: false, frontalEyeDistance: null, needsCentre: false };

export interface LivenessTick {
  readonly progress: LivenessProgress;
  readonly guidance: CaptureGuidance;
  /** Take the photo for the step just completed. */
  readonly capture: boolean;
}

const instruction = (kind: LivenessStepKind): CaptureGuidance => (kind === 'straight' ? 'look_straight' : kind);

/** Advances the step machine by one frame. `now` is in ms. */
export function advance(steps: readonly LivenessStepKind[], p: LivenessProgress, verdict: FrameVerdict, now: number): LivenessTick {
  const kind = steps[p.stepIndex];
  if (!kind) return { progress: p, guidance: 'good', capture: false };
  const reset = { ...p, streak: 0, wrongSince: null };
  if (verdict.kind === 'problem') return { progress: reset, guidance: verdict.guidance, capture: false };
  const { yaw, eyeDistance } = verdict;
  const next = (extra: Partial<LivenessProgress>): LivenessTick => ({
    progress: { ...p, ...extra, stepIndex: p.stepIndex + 1, streak: 0, wrongSince: null },
    guidance: 'good',
    capture: true,
  });

  if (kind === 'straight') {
    if (Math.abs(yaw) > R.straight) return { progress: reset, guidance: 'look_straight', capture: false };
    const streak = p.streak + 1;
    if (streak >= R.straightFrames) return next({ frontalEyeDistance: eyeDistance, needsCentre: false });
    return { progress: { ...p, streak, wrongSince: null }, guidance: streak <= R.faceFoundFrames ? 'face_found' : 'hold_still', capture: false };
  }

  // Turns. First, the head has to have come back towards centre since the last photo
  // (reaching the new side counts: a quick swing on a slow phone can skip the centre frames).
  const want = kind === 'turn_left' ? p.leftSign : -p.leftSign;
  const toward = yaw * want;
  const needsCentre = p.needsCentre && Math.abs(yaw) >= R.released && toward <= 0;
  const eyesOk = p.frontalEyeDistance === null || eyeDistance >= p.frontalEyeDistance * R.eyeDistance;
  // Turned so far that the eyes crowd together (past ~40°): ask for a smaller turn, not the same instruction again.
  if (!needsCentre && !eyesOk && Math.abs(yaw) >= R.turned) return { progress: { ...p, streak: 0, wrongSince: null, needsCentre: false }, guidance: 'turn_less', capture: false };
  if (!needsCentre && eyesOk && toward >= R.turned) {
    const streak = p.streak + 1;
    if (streak >= R.turnFrames) return next({ needsCentre: true, calibrated: true });
    return { progress: { ...p, streak, wrongSince: null, needsCentre: false }, guidance: instruction(kind), capture: false };
  }
  if (!needsCentre && eyesOk && p.streak > 0 && toward >= R.released) {
    return { progress: { ...p, wrongSince: null, needsCentre: false }, guidance: instruction(kind), capture: false };
  }
  const wrongWay = -toward >= R.turned || (p.wrongSince !== null && -toward >= R.released);
  if (!needsCentre && eyesOk && wrongWay) {
    // Turned the other way. Before any turn is accepted this may be a mirrored camera:
    // a steady turn becomes this device's "left". Afterwards, ask for the other side.
    if (p.calibrated) return { progress: { ...reset, needsCentre: false }, guidance: 'turn_other_way', capture: false };
    const since = p.wrongSince ?? now;
    if (now - since >= R.calibrateMs) {
      const leftSign = (kind === 'turn_left' ? -p.leftSign : p.leftSign) as 1 | -1;
      return next({ leftSign, calibrated: true, needsCentre: true });
    }
    return { progress: { ...p, streak: 0, wrongSince: since, needsCentre: false }, guidance: instruction(kind), capture: false };
  }
  return { progress: { ...reset, needsCentre }, guidance: instruction(kind), capture: false };
}

type Diagnosis = 'poor_light' | 'multiple_faces' | 'no_face' | 'distance' | 'off_centre' | 'no_turn';
const CAUSE: Partial<Record<CaptureGuidance, Diagnosis>> = {
  more_light: 'poor_light',
  one_face_only: 'multiple_faces',
  find_face: 'no_face',
  move_closer: 'distance',
  move_back: 'distance',
  center_face: 'off_centre',
  look_straight: 'off_centre',
  turn_left: 'no_turn',
  turn_right: 'no_turn',
  turn_other_way: 'no_turn',
  turn_less: 'no_turn',
};

/** The most frequent recent problem decides what a timed-out check tells the user (the face may well have been seen). */
export function diagnose(recent: readonly CaptureGuidance[]): Diagnosis {
  const counts = new Map<Diagnosis, number>();
  for (const g of recent) {
    const cause = CAUSE[g];
    if (cause) counts.set(cause, (counts.get(cause) ?? 0) + 1);
  }
  let best: Diagnosis = 'no_face';
  let most = 0;
  for (const [cause, n] of counts) if (n > most) [best, most] = [cause, n];
  return best;
}
