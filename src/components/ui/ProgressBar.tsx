import { cx } from '@/lib/cx';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  /** 0–1. */
  readonly value: number;
  /** Spoken name; not needed when decorative. */
  readonly label?: string;
  /** success: progress toward done (the default) · info / brand: a plain measure (a month's attendance in a trend). */
  readonly tone?: 'success' | 'info' | 'brand';
  /** The words beside it carry the number (a trend row): hidden from assistive tech, no progressbar role. */
  readonly decorative?: boolean;
  readonly className?: string;
}

/** 0–1 progress; always shown next to a number, so it is labelled but not relied on alone. */
export function ProgressBar({ value, label, tone = 'success', decorative = false, className }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct };
  return (
    <span className={cx(styles.track, className)} {...a11y}>
      <span className={cx(styles.fill, styles[tone])} style={{ width: `${pct}%` }} />
    </span>
  );
}
