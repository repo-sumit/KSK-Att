/** Visual mapping for attendance statuses: icon + tone + label, always together. */
import { STATUS_REGISTRY, type StatusCode } from '@/domain/status';
import type { IconName } from './icons/Icon';
import type { Tone } from './Badge';

export type StatusLike = StatusCode | 'not_marked';

export function statusIcon(status: StatusLike): IconName {
  return status === 'not_marked' ? 'circle' : STATUS_REGISTRY[status].icon;
}

export function statusTone(status: StatusLike): Tone {
  // Not marked is work still to do: warning, as the DS status table says (D-069).
  return status === 'not_marked' ? 'warning' : STATUS_REGISTRY[status].tone;
}
