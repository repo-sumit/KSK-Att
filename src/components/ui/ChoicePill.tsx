'use client';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon } from './icons/Icon';
import styles from './ChoicePill.module.css';

interface ChoicePillProps {
  readonly selected?: boolean;
  readonly onPress: () => void;
  readonly children: ReactNode;
  /** 'radio' for mutually exclusive follow-ups; 'button' for quick-fill chips. */
  readonly role?: 'radio' | 'button';
}

/** Follow-up choice (first/second half, leave type) and quick-fill chips. DS selection-card colours. */
export function ChoicePill({ selected = false, onPress, children, role = 'radio' }: ChoicePillProps) {
  return (
    <button
      type="button"
      role={role === 'radio' ? 'radio' : undefined}
      aria-checked={role === 'radio' ? selected : undefined}
      className={cx(styles.pill, selected && styles.selected)}
      onClick={onPress}
    >
      {selected && <Icon name="check" size={16} strokeWidth={2.5} />}
      <span>{children}</span>
    </button>
  );
}
