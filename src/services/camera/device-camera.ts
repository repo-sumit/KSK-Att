/**
 * CameraFaceCaptureService — the REAL front camera through getUserMedia.
 * Frames are grabbed into an in-memory JPEG only when a step captures; nothing
 * is written to storage or sent anywhere. The stream is stopped on close().
 */
import { err, ok, type Result } from '@/lib/result';
import type { Clock } from '@/lib/time';
import type { CameraError, CameraSession, CapturedFrame, FaceCaptureService } from '../face';
import type { PermissionState } from '../simulation';

/** Longest side of a captured photo: enough for a future matcher, small in memory. */
const CAPTURE_MAX_SIDE = 640;

/** Maps getUserMedia failures, including legacy Chromium WebView names, to what a screen can explain. */
export function cameraErrorFrom(error: unknown): CameraError {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'permission_denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'not_found';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'busy';
    case 'TypeError':
      return 'unsupported';
    default:
      return 'failed';
  }
}

/** Secure context + the camera API: without both the browser can't even ask. */
export function cameraSupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

export class CameraFaceCaptureService implements FaceCaptureService {
  /** The camera opened in this app session: the primer is not needed again, whatever the Permissions API says. */
  private opened = false;

  constructor(private readonly clock: Clock) {}

  source() {
    return 'device' as const;
  }

  async permission(): Promise<PermissionState> {
    if (this.opened) return 'granted';
    if (!cameraSupported()) return 'prompt';
    try {
      const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return status.state === 'granted' ? 'granted' : status.state === 'denied' ? 'denied' : 'prompt';
    } catch {
      // Not every WebView can query the camera permission; the primer then explains before the prompt.
      return 'prompt';
    }
  }

  async open(): Promise<Result<CameraSession, CameraError>> {
    if (!cameraSupported()) return err('unsupported');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // `ideal`, not `exact`: laptops whose only webcam isn't labelled "user" still work.
        video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      this.opened = true;
      return ok(new DeviceCameraSession(stream, this.clock));
    } catch (error) {
      return err(cameraErrorFrom(error));
    }
  }
}

class DeviceCameraSession implements CameraSession {
  readonly kind = 'device';
  constructor(
    readonly stream: MediaStream,
    private readonly clock: Clock,
  ) {}

  async capture(video: HTMLVideoElement | null): Promise<CapturedFrame> {
    const capturedAt = this.clock.now().toISOString();
    const w = video?.videoWidth ?? 0;
    const h = video?.videoHeight ?? 0;
    if (!video || !w || !h) return { source: 'device', image: null, width: 0, height: 0, capturedAt };
    const scale = Math.min(1, CAPTURE_MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    const frame = { source: 'device' as const, image, width: canvas.width, height: canvas.height, capturedAt };
    // Release the pixels now rather than whenever the canvas is collected.
    canvas.width = 0;
    canvas.height = 0;
    return frame;
  }

  close(): void {
    this.stream.getTracks().forEach((track) => track.stop());
  }
}
