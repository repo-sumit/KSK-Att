import { describe, expect, it } from 'vitest';
import { LIVENESS_STEPS, type CaptureGuidance } from '@/services/face';
import { advance, assessFrame, diagnose, LIVENESS_RULES, START_PROGRESS, visibleRegion, type FaceObservation, type FrameObservation, type LivenessProgress } from '@/services/camera/liveness-rules';
import { cameraErrorFrom } from '@/services/camera/device-camera';

/** A BlazeFace-like detection on a 480×640 frame: `yaw` shifts the nose, `size` and `cx/cy` place the box. */
function face({ yaw = 0, size = 0.35, cx = 0.5, cy = 0.5, score = 0.92, eye = 0.15 } = {}): FaceObservation {
  const w = 480 * size;
  const ex = cx - eye / 2;
  const nose = cx + yaw * eye;
  return {
    score,
    box: { originX: cx * 480 - w / 2, originY: cy * 640 - w / 2, width: w, height: w },
    keypoints: [
      { x: ex, y: cy - 0.03 },
      { x: ex + eye, y: cy - 0.03 },
      { x: nose, y: cy + 0.01 },
      { x: cx, y: cy + 0.06 },
      { x: cx - 0.16, y: cy },
      { x: cx + 0.16, y: cy },
    ],
  };
}
const frame = (faces: FaceObservation[], luma: number | null = 120): FrameObservation => ({ faces, width: 480, height: 640, luma });

describe('assessFrame (what one detected frame means)', () => {
  it('asks for light, a face, one face, closer, back, or the oval before anything else', () => {
    expect(assessFrame(frame([face()], 20))).toEqual({ kind: 'problem', guidance: 'more_light' });
    expect(assessFrame(frame([]))).toEqual({ kind: 'problem', guidance: 'find_face' });
    expect(assessFrame(frame([face({ score: 0.6 })]))).toEqual({ kind: 'problem', guidance: 'find_face' });
    expect(assessFrame(frame([face(), face({ cx: 0.2, score: 0.55 })]))).toEqual({ kind: 'problem', guidance: 'one_face_only' });
    expect(assessFrame(frame([face({ size: 0.2 })]))).toEqual({ kind: 'problem', guidance: 'move_closer' });
    expect(assessFrame(frame([face({ size: 0.75 })]))).toEqual({ kind: 'problem', guidance: 'move_back' });
    expect(assessFrame(frame([face({ cx: 0.8 })]))).toEqual({ kind: 'problem', guidance: 'center_face' });
    expect(assessFrame(frame([face({ cy: 0.2 })]))).toEqual({ kind: 'problem', guidance: 'center_face' });
  });
  it('a good frontal face yields a yaw ratio near zero; turning moves the nose off the eye midpoint', () => {
    const straight = assessFrame(frame([face()]));
    expect(straight.kind).toBe('face');
    expect(straight.kind === 'face' && Math.abs(straight.yaw)).toBeLessThan(0.01);
    const left = assessFrame(frame([face({ yaw: 0.3 })]));
    expect(left.kind === 'face' && left.yaw).toBeCloseTo(0.3);
  });
  it('an unknown brightness (no canvas) does not block the check', () => {
    expect(assessFrame(frame([face()], null)).kind).toBe('face');
  });
  it('framing is judged against the visible preview: a landscape webcam in a portrait oval loses its sides', () => {
    const view = visibleRegion(640, 480, 4 / 5);
    expect(view.x0).toBeCloseTo(0.2);
    expect(view.x1).toBeCloseTo(0.8);
    expect(visibleRegion(480, 640, 4 / 5)).toMatchObject({ x0: 0, x1: 1 });
    // A 640×480 frame: a face centred at x = 0.32 is fine for the whole frame, but sits near the
    // edge of what the person sees (x 0.2–0.8), so they're asked to move into the oval.
    const landscape = (cx: number, withView = true): FrameObservation => {
      const w = 150;
      const kp = (x: number, y: number) => ({ x: cx + x, y: 0.5 + y });
      return {
        faces: [{ score: 0.92, box: { originX: cx * 640 - w / 2, originY: 240 - w / 2, width: w, height: w }, keypoints: [kp(-0.05, -0.04), kp(0.05, -0.04), kp(0, 0.01), kp(0, 0.08), kp(-0.1, 0), kp(0.1, 0)] }],
        width: 640,
        height: 480,
        luma: 120,
        view: withView ? view : undefined,
      };
    };
    expect(assessFrame(landscape(0.32, false)).kind).toBe('face');
    expect(assessFrame(landscape(0.32))).toEqual({ kind: 'problem', guidance: 'center_face' });
    expect(assessFrame(landscape(0.5)).kind).toBe('face');
  });
});

/** Feeds verdicts through the step machine, 100 ms apart, and records captures. */
function run(steps: readonly ('straight' | 'turn_left' | 'turn_right')[], yaws: number[], start: LivenessProgress = START_PROGRESS) {
  let p = start;
  const captures: number[] = [];
  const guidance: CaptureGuidance[] = [];
  yaws.forEach((yaw, i) => {
    const tick = advance(steps, p, assessFrame(frame([face({ yaw })])), i * 100);
    p = tick.progress;
    guidance.push(tick.guidance);
    if (tick.capture) captures.push(i);
  });
  return { progress: p, captures, guidance };
}
const repeat = (yaw: number, n: number) => Array.from({ length: n }, () => yaw);

describe('advance (the three-angle registration and the daily check)', () => {
  const enrol = LIVENESS_STEPS.enrol;

  it('straight: says "Face detected", then "Hold still", then takes the photo', () => {
    const n = LIVENESS_RULES.straightFrames;
    const r = run(LIVENESS_STEPS.verify, repeat(0.02, n));
    expect(r.captures).toEqual([n - 1]);
    expect(r.progress.stepIndex).toBe(1);
    expect(r.guidance.slice(0, LIVENESS_RULES.faceFoundFrames).every((g) => g === 'face_found')).toBe(true);
    expect(r.guidance.slice(LIVENESS_RULES.faceFoundFrames, -1).every((g) => g === 'hold_still')).toBe(true);
    expect(r.guidance.at(-1)).toBe('good');
  });

  it('asks to look straight while the head is turned', () => {
    expect(run(LIVENESS_STEPS.verify, repeat(0.3, 8)).guidance.every((g) => g === 'look_straight')).toBe(true);
  });

  it('full registration: straight, left, back past centre, right', () => {
    const r = run(enrol, [...repeat(0, LIVENESS_RULES.straightFrames), ...repeat(0.3, 3), ...repeat(0, 2), ...repeat(-0.3, 3)]);
    expect(r.captures).toHaveLength(3);
    expect(r.progress.stepIndex).toBe(3);
  });

  it('a quick swing straight through to the other side counts as passing centre (slow phones skip frames)', () => {
    const r = run(enrol, [...repeat(0, LIVENESS_RULES.straightFrames), ...repeat(0.3, 3), ...repeat(-0.3, 3)]);
    expect(r.captures).toHaveLength(3);
  });

  it('the second turn only counts after the head came back towards centre', () => {
    // Still turned left: nothing counts for "turn right", and no "other way" nagging yet.
    const r = run(enrol, [...repeat(0, LIVENESS_RULES.straightFrames), ...repeat(0.3, 3), ...repeat(0.3, 6)]);
    expect(r.captures).toHaveLength(2);
    expect(r.guidance.at(-1)).toBe('turn_right');
  });

  it('turning the same way again at the last step asks for the other way', () => {
    const r = run(enrol, [...repeat(0, LIVENESS_RULES.straightFrames), ...repeat(0.3, 3), ...repeat(0, 2), ...repeat(0.3, 3)]);
    expect(r.captures).toHaveLength(2);
    expect(r.guidance.at(-1)).toBe('turn_other_way');
  });

  it('a mirrored camera: a steady opposite turn becomes this device’s "left", and the next turn must be the other way', () => {
    // 1.5 s (16 frames) of r < 0 while asked to turn left, then back to centre, then r > 0.
    const r = run(enrol, [...repeat(0, LIVENESS_RULES.straightFrames), ...repeat(-0.3, 17), ...repeat(0, 2), ...repeat(0.3, 3)]);
    expect(r.captures).toHaveLength(3);
    expect(r.progress.leftSign).toBe(-1);
  });

  it('video noise just under the threshold holds the count instead of restarting it', () => {
    const t = LIVENESS_RULES.turned;
    const r = run(enrol, [...repeat(0, LIVENESS_RULES.straightFrames), t + 0.02, t - 0.03, t + 0.02, t + 0.02]);
    expect(r.captures).toHaveLength(2);
  });

  it('moving away from the camera is not a turn (eye distance must stay near its frontal value)', () => {
    let p = START_PROGRESS;
    for (let i = 0; i < LIVENESS_RULES.straightFrames; i++) p = advance(enrol, p, assessFrame(frame([face()])), i * 100).progress;
    for (let i = 0; i < 5; i++) {
      const tick = advance(enrol, p, assessFrame(frame([face({ yaw: 0.3, eye: 0.08, size: 0.3 })])), 1000 + i * 100);
      p = tick.progress;
      expect(tick.capture).toBe(false);
      // Turned too far for the eyes to be read: a smaller turn is asked for, not the same instruction again.
      expect(tick.guidance).toBe('turn_less');
    }
  });
});

describe('diagnose (why a timed-out check stopped)', () => {
  it('names the dominant problem: the face may well have been seen', () => {
    expect(diagnose(['more_light', 'more_light', 'find_face'])).toBe('poor_light');
    expect(diagnose(['one_face_only', 'one_face_only', 'find_face'])).toBe('multiple_faces');
    expect(diagnose(['find_face', 'find_face', 'center_face'])).toBe('no_face');
    expect(diagnose(['move_closer', 'move_back', 'move_closer', 'find_face'])).toBe('distance');
    expect(diagnose(['center_face', 'look_straight', 'hold_still', 'face_found'])).toBe('off_centre');
    expect(diagnose(['turn_left', 'turn_left', 'turn_other_way', 'hold_still'])).toBe('no_turn');
    expect(diagnose(['hold_still', 'good'])).toBe('no_face');
  });
});

describe('cameraErrorFrom (getUserMedia failures, including legacy WebView names)', () => {
  it.each([
    ['NotAllowedError', 'permission_denied'],
    ['PermissionDeniedError', 'permission_denied'],
    ['SecurityError', 'permission_denied'],
    ['NotFoundError', 'not_found'],
    ['DevicesNotFoundError', 'not_found'],
    ['OverconstrainedError', 'not_found'],
    ['NotReadableError', 'busy'],
    ['TrackStartError', 'busy'],
    ['TypeError', 'unsupported'],
    ['AbortError', 'failed'],
  ])('%s → %s', (name, expected) => {
    expect(cameraErrorFrom({ name })).toBe(expected);
  });
  it('anything unknown is a generic failure', () => expect(cameraErrorFrom(new Error('boom'))).toBe('failed'));
});
