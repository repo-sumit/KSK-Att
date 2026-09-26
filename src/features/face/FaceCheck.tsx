'use client';
import type { CapturedFrame } from '@/services/face';
import { CameraView, VIEW_ASPECT } from './CameraView';
import { useFaceCapture, type FaceRunFailure } from './useFaceCapture';

interface FaceCheckProps {
  readonly onDone: (frame: CapturedFrame) => void;
  readonly onFail: (error: FaceRunFailure) => void;
  /** After repeated failed checks: timed guided capture instead of detection. */
  readonly guided?: boolean;
}

/** The daily face check inside the verification screen: live preview, one frontal photo. */
export function FaceCheck({ onDone, onFail, guided }: FaceCheckProps) {
  const { video, state, tapToStart } = useFaceCapture('verify', (frames) => frames[0] && onDone(frames[0]), onFail, { guided, viewAspect: VIEW_ASPECT.verify });
  return <CameraView video={video} state={state} size="verify" onTapToStart={tapToStart} />;
}
