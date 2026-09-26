/** How each live guidance reads on the camera screen: text, icon, tone and the oval's state. */
import type { IconName } from '@/components/ui/icons/Icon';
import type { MessageKey } from '@/i18n';
import type { CameraError, CaptureGuidance, LivenessError, LivenessPurpose } from '@/services/face';
import type { ProblemKind } from '../feedback/problems';

export type GuideTone = 'error' | 'warning' | 'info' | 'success';
export type RingState = 'muted' | 'on' | 'good' | 'warn';

export const GUIDE: Readonly<Record<CaptureGuidance, { readonly text: MessageKey; readonly icon: IconName; readonly tone: GuideTone; readonly ring: RingState }>> = {
  starting: { text: 'face.guideStarting', icon: 'camera', tone: 'info', ring: 'muted' },
  find_face: { text: 'face.guideFind', icon: 'user', tone: 'error', ring: 'muted' },
  face_found: { text: 'face.guideFound', icon: 'check', tone: 'success', ring: 'on' },
  move_closer: { text: 'face.guideCloser', icon: 'scan-face', tone: 'warning', ring: 'warn' },
  move_back: { text: 'face.guideBack', icon: 'scan-face', tone: 'warning', ring: 'warn' },
  center_face: { text: 'face.guideCenter', icon: 'scan-face', tone: 'warning', ring: 'warn' },
  one_face_only: { text: 'face.guideAlone', icon: 'users', tone: 'warning', ring: 'warn' },
  more_light: { text: 'face.guideLight', icon: 'sun', tone: 'warning', ring: 'warn' },
  look_straight: { text: 'face.guideStraight', icon: 'scan-face', tone: 'info', ring: 'on' },
  hold_still: { text: 'face.guideStill', icon: 'camera', tone: 'info', ring: 'on' },
  turn_left: { text: 'face.guideLeft', icon: 'arrow-left', tone: 'info', ring: 'on' },
  turn_right: { text: 'face.guideRight', icon: 'arrow-right', tone: 'info', ring: 'on' },
  turn_other_way: { text: 'face.guideOtherWay', icon: 'rotate-ccw', tone: 'warning', ring: 'warn' },
  turn_less: { text: 'face.guideLess', icon: 'rotate-ccw', tone: 'warning', ring: 'warn' },
  countdown: { text: 'face.guideCountdown', icon: 'camera', tone: 'info', ring: 'on' },
  good: { text: 'face.guideGood', icon: 'check', tone: 'success', ring: 'good' },
};

/** Each camera or check failure has one screen that says what happened and what to do. */
export function faceProblem(error: CameraError | Exclude<LivenessError, 'cancelled'>, purpose: LivenessPurpose): ProblemKind {
  switch (error) {
    case 'permission_denied':
      return purpose === 'enrol' ? 'cameraDeniedEnrol' : 'cameraDeniedVerify';
    case 'not_found':
      return 'cameraNotFound';
    case 'busy':
      return 'cameraBusy';
    case 'unsupported':
      return 'cameraUnsupported';
    case 'failed':
      return 'cameraFailed';
    case 'poor_light':
      return 'light';
    case 'multiple_faces':
      return 'multi';
    case 'no_face':
      return 'faceNotSeen';
    case 'distance':
      return 'faceDistance';
    case 'off_centre':
      return 'faceOffCentre';
    case 'no_turn':
      return 'faceNoTurn';
    case 'camera_failed':
      return 'cameraFailed';
  }
}

/** Failures of the movement check itself (not of the camera): they count as attempts, and repeated ones switch to guided capture. */
export const isCheckFailure = (error: CameraError | Exclude<LivenessError, 'cancelled'>) =>
  error === 'poor_light' || error === 'multiple_faces' || error === 'no_face' || error === 'distance' || error === 'off_centre' || error === 'no_turn';
