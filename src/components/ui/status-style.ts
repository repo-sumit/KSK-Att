/** Visual mapping for attendance statuses: icon + tone + label, always together. */
import { STATUS_REGISTRY, type StatusCode } from '@/domain/status';
import type { IconName } from './icons/Icon';
import type { Tone } from './Badge';

export type StatusLike = StatusCode | 'not_marked';

export function statusIcon(status: StatusLike): IconName {
  return status === 'not_marked' ? 'circle' : STATUS_REGISTRY[status].icon;
}

export function statusTone(status: StatusLike): Tone {
  return status === 'not_marked' ? 'neutral' : STATUS_REGISTRY[status].tone;
}
