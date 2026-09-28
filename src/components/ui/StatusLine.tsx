import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icons/Icon';
import styles from './StatusLine.module.css';

export type StatusLineTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusLineProps {
  readonly tone: StatusLineTone;
  readonly icon: IconName;
  readonly children: ReactNode;
  /** Keep it on one line (short trailing labels in a row, e.g. "Registered"). */
  readonly nowrap?: boolean;
  readonly className?: string;
}

/**
 * A short state under or beside a row's title: icon + coloured text, never
 * colour alone ("Ready offline", "Refresh needed", "3 students at risk",
 * "Registered"). One size everywhere: label-small-strong, a 16px icon, 4 apart.
 */
export function StatusLine({ tone, icon, children, nowrap = false, className }: StatusLineProps) {
  return (
    <span className={cx(styles.line, styles[tone], nowrap && styles.nowrap, className)}>
      <Icon name={icon} size={16} />
      <span>{children}</span>
    </span>
  );
}
