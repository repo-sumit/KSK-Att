'use client';
import { memo } from 'react';
import { cx } from '@/lib/cx';
import { Icon } from './icons/Icon';
import { statusIcon, statusTone, type StatusLike } from './status-style';
import styles from './StatusPill.module.css';

interface StatusPillProps {
  readonly status: StatusLike;
  readonly label: string;
  readonly pressed: boolean;
  readonly onPress: () => void;
  readonly stretch?: boolean;
}

/**
 * One-tap attendance button. The icon shows only when pressed; since exactly
 * one pill of a pair is pressed, the pair's total width never changes, so rows
 * do not reflow while marking. In a full-width row the cells are equal width.
 */
export const StatusPill = memo(function StatusPill({ status, label, pressed, onPress, stretch }: StatusPillProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cx(styles.pill, styles[statusTone(status)], pressed && styles.pressed, stretch && styles.stretch)}
      onClick={onPress}
    >
      {pressed && <Icon name={statusIcon(status)} size={16} strokeWidth={2.5} />}
      <span>{label}</span>
    </button>
  );
});
