'use client';
import { memo } from 'react';
import type { StatusCode } from '@/domain/status';
import { cx } from '@/lib/cx';
import { Icon } from './icons/Icon';
import { statusIcon, statusTone } from './status-style';
import styles from './AttendanceStatusSelect.module.css';

export interface AttendanceStatusOption {
  readonly status: StatusCode;
  readonly label: string;
}

interface AttendanceStatusSelectProps {
  /** Whose status this is, e.g. "Attendance for Aditya Pingale" (the control's accessible name). */
  readonly label: string;
  /** Only the statuses configuration enables for this person, in display order. */
  readonly options: readonly AttendanceStatusOption[];
  /** null: not marked yet (the placeholder shows). */
  readonly value: StatusCode | null;
  readonly onChange: (status: StatusCode) => void;
  /** Shown while nothing is chosen, e.g. "Choose". */
  readonly placeholder: string;
  /** The roster's starting status: drawn calm, so the changes stand out. */
  readonly quiet?: boolean;
  /** Still needs a choice after Review was pressed. */
  readonly invalid?: boolean;
}

/**
 * One status control per person (D-062), used on every roster that marks
 * attendance (students, staff). It is the phone's own picker (a native
 * <select>): familiar, large, accessible and the same on every WebView. The
 * closed control carries the status icon, colour and label, and is the same
 * width in every row, so the column reads straight down. Options come only
 * from configuration: two statuses show two, five show five.
 */
export const AttendanceStatusSelect = memo(function AttendanceStatusSelect({ label, options, value, onChange, placeholder, quiet, invalid }: AttendanceStatusSelectProps) {
  const tone = value ? statusTone(value) : 'neutral';
  return (
    <span className={cx(styles.field, styles[tone], quiet && styles.quiet, invalid && styles.invalid)}>
      <Icon name={value ? statusIcon(value) : 'circle'} size={16} strokeWidth={2.5} className={styles.lead} />
      <select
        className={styles.pill}
        aria-label={label}
        aria-invalid={invalid || undefined}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value as StatusCode)}
      >
        {value === null && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.status} value={o.status}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={16} className={styles.end} />
    </span>
  );
});

interface LockedStatusProps {
  readonly status: StatusCode;
  readonly label: string;
  /** Why it can't be changed, for screen readers (the row says it visibly too), e.g. "Set by the ERP". */
  readonly reason: string;
}

/**
 * A status nobody can change here (OJT declared in the ERP, a staff member's
 * own verified mark): the same pill, with a lock instead of the chevron, and
 * not a control.
 */
export function LockedStatus({ status, label, reason }: LockedStatusProps) {
  return (
    <span className={cx(styles.field, styles[statusTone(status)], styles.locked)}>
      <Icon name={statusIcon(status)} size={16} strokeWidth={2.5} className={styles.lead} />
      <span className={styles.pill}>
        {label}
        <span className="visually-hidden">{` · ${reason}`}</span>
      </span>
      <Icon name="lock" size={14} className={styles.end} />
    </span>
  );
}
