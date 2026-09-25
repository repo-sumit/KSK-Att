'use client';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icons/Icon';
import { Spinner } from './Spinner';
import type { Tone } from './Badge';
import tones from './tones.module.css';
import styles from './Banner.module.css';

interface BannerProps {
  readonly tone: Tone;
  readonly icon?: IconName;
  readonly spinner?: boolean;
  readonly children: ReactNode;
  /** bar: full-bleed strip (connectivity) · card: rounded block inside content · strip: compact status line (record header). */
  readonly layout?: 'bar' | 'card' | 'strip';
  readonly action?: { readonly label: string; readonly onPress: () => void };
  /** Announce changes politely to screen readers. */
  readonly live?: boolean;
  readonly strong?: boolean;
}

export function Banner({ tone, icon, spinner, children, layout = 'card', action, live, strong }: BannerProps) {
  return (
    <div className={cx(styles.banner, styles[layout], tones[tone], strong && styles.strong)} role={live ? 'status' : undefined}>
      {spinner ? <Spinner size={14} /> : icon && <Icon name={icon} size={layout === 'card' ? 20 : 16} />}
      <span className={styles.text}>{children}</span>
      {action && (
        <button type="button" className={styles.action} onClick={action.onPress}>
          {action.label}
        </button>
      )}
    </div>
  );
}
