/**
 * On-device face detection for the prototype face check: MediaPipe Tasks
 * Vision FaceDetector (BlazeFace short range), loaded lazily on the face
 * screens only, from this app's own origin (public/vendor, public/models).
 *
 * Pinned to 0.10.35: 1.0.x sends usage metrics to a Google endpoint with no
 * opt-out (D-049). CPU delegate: faster than GPU for this 128×128 model and
 * avoids known Android WebView GPU failures. It detects faces; it does not
 * recognise anyone.
 */
import type { FaceObservation } from './liveness-rules';

/** Keep in step with scripts/vendor-mediapipe.mjs (it refuses any other installed version). */
export const MEDIAPIPE_VERSION = '0.10.35';
const WASM_BASE = `/vendor/mediapipe/${MEDIAPIPE_VERSION}`;
const MODEL_PATH = '/models/blaze_face_short_range_f16_v1.tflite';

export interface FaceDetectorPort {
  /** Faces in the video's current frame. Throws if the runtime fails (the caller falls back to guided capture). */
  detect(video: HTMLVideoElement): FaceObservation[];
  close(): void;
}

/** The runtime uploads frames through WebGL even on the CPU delegate; without it, it crashes. Probed once. */
let webgl: boolean | undefined;
function hasWebGL(): boolean {
  if (webgl !== undefined) return webgl;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    webgl = Boolean(gl);
    // Release the probe context: WebViews cap how many can be alive.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

// One task at a time: the runtime is not safe to initialise twice concurrently (React dev double effects).
let queue: Promise<unknown> = Promise.resolve();

export function loadFaceDetector(): Promise<FaceDetectorPort> {
  const task = queue.then(create);
  queue = task.catch(() => undefined);
  return task;
}

async function create(): Promise<FaceDetectorPort> {
  if (!hasWebGL()) throw new Error('WebGL unavailable');
  const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  // The wasm runtime prints TensorFlow Lite notices through console.error: route them nowhere.
  // It reads self.Module once while starting and clears it afterwards.
  (globalThis as { Module?: unknown }).Module = { print: () => undefined, printErr: () => undefined };
  const detector = await FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
    runningMode: 'VIDEO',
    // Low enough that a second person still registers (the rules then ask for one face only).
    minDetectionConfidence: 0.5,
  });
  let last = 0;
  return {
    detect(video) {
      // Timestamps must strictly increase, or the graph breaks for good.
      const ts = Math.max(performance.now(), last + 1);
      last = ts;
      return detector.detectForVideo(video, ts).detections.map((d) => ({
        score: d.categories[0]?.score ?? 0,
        box: { originX: d.boundingBox?.originX ?? 0, originY: d.boundingBox?.originY ?? 0, width: d.boundingBox?.width ?? 0, height: d.boundingBox?.height ?? 0 },
        keypoints: d.keypoints.map((k) => ({ x: k.x, y: k.y })),
      }));
    },
    close() {
      try {
        detector.close();
      } catch {
        // An aborted runtime throws on every call, including close().
      }
    },
  };
}
