import { Badge } from './Badge';
import { statusIcon, statusTone, type StatusLike } from './status-style';

interface StatusChipProps {
  readonly status: StatusLike;
  /** The already-translated label, e.g. "Half day · First half". */
  readonly label: string;
  readonly size?: 'sm' | 'md';
}

/** Read-only status: icon + text + tone. */
export function StatusChip({ status, label, size = 'sm' }: StatusChipProps) {
  return (
    <Badge tone={statusTone(status)} icon={statusIcon(status)} size={size}>
      {label}
    </Badge>
  );
}
