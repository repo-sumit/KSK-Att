/** Problem screens as data (the prototype's `errDef`): tone, icon, title, body. */
import type { IconName } from '@/components/ui/icons/Icon';
import type { Tone } from '@/components/ui/Badge';
import type { MessageKey } from '@/i18n';

export type ProblemKind =
  | 'outside'
  | 'gps'
  | 'noFix'
  | 'locationDenied'
  | 'cameraDeniedEnrol'
  | 'cameraDeniedVerify'
  | 'face'
  | 'faceLimit'
  | 'enrolFail'
  | 'light'
  | 'multi'
  | 'notOpen'
  | 'closed'
  | 'noPack'
  | 'noConnection'
  | 'noAccess'
  | 'notFound';

export const PROBLEMS: Readonly<Record<ProblemKind, { tone: Tone; icon: IconName; title: MessageKey; body: MessageKey }>> = {
  outside: { tone: 'error', icon: 'map-pin', title: 'problem.outsideTitle', body: 'problem.outsideBody' },
  gps: { tone: 'warning', icon: 'navigation-off', title: 'problem.gpsTitle', body: 'problem.gpsBody' },
  noFix: { tone: 'warning', icon: 'map-pin', title: 'problem.noFixTitle', body: 'problem.noFixBody' },
  locationDenied: { tone: 'warning', icon: 'map-pin', title: 'problem.locationDeniedTitle', body: 'problem.locationDeniedBody' },
  cameraDeniedEnrol: { tone: 'warning', icon: 'camera-off', title: 'problem.cameraDeniedTitle', body: 'problem.cameraDeniedBodyEnrol' },
  cameraDeniedVerify: { tone: 'warning', icon: 'camera-off', title: 'problem.cameraDeniedTitle', body: 'problem.cameraDeniedBodyVerify' },
  face: { tone: 'error', icon: 'scan-face', title: 'problem.faceTitle', body: 'problem.faceBody' },
  faceLimit: { tone: 'error', icon: 'scan-face', title: 'problem.faceLimitTitle', body: 'problem.faceLimitBody' },
  enrolFail: { tone: 'error', icon: 'camera', title: 'problem.enrolFailTitle', body: 'problem.enrolFailBody' },
  light: { tone: 'warning', icon: 'sun', title: 'problem.lightTitle', body: 'problem.lightBody' },
  multi: { tone: 'warning', icon: 'users', title: 'problem.multiTitle', body: 'problem.multiBody' },
  notOpen: { tone: 'info', icon: 'clock', title: 'problem.notOpenTitle', body: 'problem.notOpenBody' },
  closed: { tone: 'neutral', icon: 'lock', title: 'problem.closedTitle', body: 'problem.closedBody' },
  noPack: { tone: 'warning', icon: 'wifi-off', title: 'problem.noPackTitle', body: 'problem.noPackBody' },
  noConnection: { tone: 'warning', icon: 'wifi-off', title: 'problem.noConnectionTitle', body: 'problem.noConnectionBody' },
  noAccess: { tone: 'neutral', icon: 'lock', title: 'problem.noAccessTitle', body: 'problem.noAccessBody' },
  notFound: { tone: 'neutral', icon: 'info', title: 'problem.notFoundTitle', body: 'problem.notFoundBody' },
};
