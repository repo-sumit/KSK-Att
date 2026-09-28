'use client';
import { memo } from 'react';
import type { Student } from '@/domain/entities';
import type { LeaveType, Mark, StatusCode } from '@/domain/status';
import { AttendanceStatusSelect, LockedStatus } from '@/components/ui/AttendanceStatusSelect';
import { ChoicePill } from '@/components/ui/ChoicePill';
import { Latin } from '@/components/ui/Latin';
import { StatusChip } from '@/components/ui/StatusChip';
import { cx } from '@/lib/cx';
import styles from './StudentRow.module.css';

export interface RowLabels {
  readonly status: Readonly<Record<StatusCode, string>>;
  readonly father: (name: string) => string;
  readonly presentFor: string;
  readonly firstHalf: string;
  readonly secondHalf: string;
  readonly leaveType: string;
  readonly leaveTypes: Readonly<Record<LeaveType, string>>;
  readonly leaveUntil: string;
  readonly ojtNote: string;
  readonly notMarked: string;
  readonly needsHalf: string;
  readonly needsLeaveType: string;
  /** The status control's accessible name: "Attendance for {name}". */
  readonly statusFor: (name: string) => string;
  /** Placeholder while a student has no status yet (blank default). */
  readonly choose: string;
  /** Why an OJT row can't be changed (screen readers; the row's note says it visibly). */
  readonly lockedReason: string;
}

interface StudentRowProps {
  readonly student: Student;
  readonly mark: Mark;
  readonly selectable: readonly StatusCode[];
  readonly defaultStatus: StatusCode | null;
  readonly halfDayHalves: boolean;
  readonly leaveTypes: readonly LeaveType[];
  readonly leaveRange: { readonly min: string; readonly max: string } | null;
  readonly attention: boolean;
  readonly labels: RowLabels;
  readonly onStatus: (id: string, status: StatusCode) => void;
  readonly onDetail: (id: string, mark: Mark) => void;
}

/** Tint rows whose status differs from the starting default, so exceptions scan fast. */
function tintOf(mark: Mark, defaultStatus: StatusCode | null): string | undefined {
  if (!mark.status) return undefined;
  if (mark.status === 'present') return defaultStatus === 'absent' ? styles.tintSuccess : undefined;
  return { absent: styles.tintError, half_day: styles.tintWarning, leave: styles.tintInfo, ojt: styles.tintHero }[mark.status];
}

/**
 * One student: name, father's name beneath (PRD §4.3) and one status control
 * on the right (D-062): the same compact row whether the state enables two
 * statuses or five. Half day and leave ask their detail underneath; OJT from
 * the ERP is a locked value.
 */
export const StudentRow = memo(function StudentRow(p: StudentRowProps) {
  const { student, mark, labels } = p;
  const locked = mark.status === 'ojt';
  const unmarked = mark.status === null;
  const needs = mark.status === 'half_day' && p.halfDayHalves && !mark.half ? 'half' : mark.status === 'leave' && !mark.leaveType ? 'leave' : null;
  const options = p.selectable.map((status) => ({ status, label: labels.status[status] }));

  return (
    <li
      className={cx(styles.row, tintOf(mark, p.defaultStatus), p.attention && (unmarked || mark.status === 'half_day' || mark.status === 'leave') && styles.attention)}
      data-student={student.id}
      data-incomplete={p.attention || undefined}
    >
      <div className={styles.main}>
        <span className={cx(styles.roll, 'tnum')} aria-hidden="true">
          {student.rollNo}
        </span>
        <div className={styles.who}>
          <span className={styles.name}>
            <Latin>{student.name}</Latin>
          </span>
          <span className={styles.father}>{labels.father(student.fatherName)}</span>
          {p.attention && unmarked && <StatusChip status="not_marked" label={labels.notMarked} />}
          {p.attention && needs && <StatusChip status="not_marked" label={needs === 'half' ? labels.needsHalf : labels.needsLeaveType} />}
        </div>
        <span className={styles.status}>
          {locked ? (
            <LockedStatus status="ojt" label={labels.status.ojt} reason={labels.lockedReason} />
          ) : (
            <AttendanceStatusSelect
              label={labels.statusFor(student.name)}
              options={options}
              value={mark.status}
              placeholder={labels.choose}
              quiet={mark.status !== null && mark.status === p.defaultStatus}
              invalid={p.attention && unmarked}
              onChange={(status) => p.onStatus(student.id, status)}
            />
          )}
        </span>
      </div>
      {locked && <p className={styles.note}>{labels.ojtNote}</p>}
      {mark.status === 'half_day' && p.halfDayHalves && (
        <div className={styles.follow} role="radiogroup" aria-label={labels.presentFor} data-needs={needs === 'half' || undefined} aria-invalid={(p.attention && needs === 'half') || undefined}>
          <span className={styles.followLabel}>{labels.presentFor}</span>
          <ChoicePill selected={mark.half === 1} onPress={() => p.onDetail(student.id, { status: 'half_day', half: 1 })}>
            {labels.firstHalf}
          </ChoicePill>
          <ChoicePill selected={mark.half === 2} onPress={() => p.onDetail(student.id, { status: 'half_day', half: 2 })}>
            {labels.secondHalf}
          </ChoicePill>
        </div>
      )}
      {mark.status === 'leave' && (
        <div className={styles.follow} role="radiogroup" aria-label={labels.leaveType} data-needs={needs === 'leave' || undefined} aria-invalid={(p.attention && needs === 'leave') || undefined}>
          <span className={styles.followLabel}>{labels.leaveType}</span>
          {p.leaveTypes.map((type) => (
            <ChoicePill key={type} selected={mark.leaveType === type} onPress={() => p.onDetail(student.id, { ...mark, status: 'leave', leaveType: type })}>
              {labels.leaveTypes[type]}
            </ChoicePill>
          ))}
          {p.leaveRange && mark.leaveType && (
            <label className={styles.until}>
              <span className={styles.followLabel}>{labels.leaveUntil}</span>
              <input
                type="date"
                className={styles.date}
                min={p.leaveRange.min}
                max={p.leaveRange.max}
                value={mark.leaveUntil ?? ''}
                onChange={(e) => p.onDetail(student.id, { ...mark, leaveUntil: e.target.value || undefined })}
              />
            </label>
          )}
        </div>
      )}
    </li>
  );
});
