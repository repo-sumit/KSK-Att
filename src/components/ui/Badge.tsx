import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icons/Icon';
import tones from './tones.module.css';
import styles from './Badge.module.css';

export type Tone = 'success' | 'error' | 'warning' | 'info' | 'brand' | 'neutral';

interface BadgeProps {
  readonly tone?: Tone;
  readonly icon?: IconName;
  readonly children: ReactNode;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}

/** Small status label: DS Chip/Badge (Caption, radius md, padding 4/8). */
export function Badge({ tone = 'neutral', icon, children, size = 'sm', className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[size], tones[tone], className)}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} strokeWidth={2.5} />}
      <span>{children}</span>
    </span>
  );
}
