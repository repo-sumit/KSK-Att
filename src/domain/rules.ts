/**
 * Non-configurable integrity rules (PRD §5.3, §12, §18.5, §20.4). These hold in
 * every state and under every configuration, so they live here — enforced by the
 * services and repositories, never only by hiding buttons in the UI.
 */
import type { AppConfiguration } from '@/config/types';
import type { AttendanceSubmission, SessionAddress, StaffAttendanceRecord } from './attendance';
import type { StaffMember, StudentId } from './entities';
import { completenessIssues, isMarkAllowed, type CompletenessIssue } from './marking';
import { marksEqual, type Mark, type StatusCode } from './status';
import type { WindowState } from './schedule';
import { err, ok, type Result } from '@/lib/result';
import type { LocalDate } from '@/lib/time';

export type SubmitError =
  | 'already_submitted'
  | 'not_today'
  | 'window_not_open'
  | 'window_closed'
  | 'no_access'
  | 'not_verified'
  | 'incomplete'
  | 'invalid_mark'
  | 'roster_mismatch';

export interface SubmitCheck {
  readonly address: SessionAddress;
  readonly today: LocalDate;
  readonly existing: AttendanceSubmission | undefined;
  readonly windowState: WindowState;
  readonly hasAccess: boolean;
  readonly verificationRequired: boolean;
  readonly verified: boolean;
  readonly marks: Readonly<Record<StudentId, Mark>>;
  readonly rosterIds: readonly StudentId[];
  readonly config: AppConfiguration;
}

/** Everything that must be true before a marking session can be written. */
export function checkSubmission(c: SubmitCheck): Result<true, SubmitError> {
  // INV-01: a session is submitted exactly once, then locked for everyone.
  if (c.existing) return err('already_submitted', { submittedBy: c.existing.markedBy });
  // INV-05: no backdating (or forward-dating) for any role.
  if (c.address.date !== c.today) return err('not_today');
  if (!c.hasAccess) return err('no_access');
  // INV-20: hard time fence, no grace period.
  if (c.windowState === 'future') return err('window_not_open');
  if (c.windowState === 'closed') return err('window_closed');
  // INV-16: verification runs before the list is shown; submission re-checks it.
  if (c.verificationRequired && !c.verified) return err('not_verified');

  const rosterSet = new Set(c.rosterIds);
  const markIds = Object.keys(c.marks);
  if (markIds.length !== rosterSet.size || markIds.some((id) => !rosterSet.has(id))) return err('roster_mismatch');

  const issues: CompletenessIssue[] = completenessIssues(c.marks, c.config.marking);
  if (issues.length) return err('incomplete', { issues });
  if (Object.values(c.marks).some((m) => !isMarkAllowed(m, c.config.marking))) return err('invalid_mark');
  return ok(true);
}

export type CorrectionError =
  | 'forbidden'
  | 'not_today'
  | 'reason_required'
  | 'no_change'
  | 'invalid_mark'
  | 'not_synced'
  | 'ojt_locked'
  | 'unknown_student';

export interface CorrectionCheck {
  readonly actor: StaffMember;
  readonly config: AppConfiguration;
  readonly submission: AttendanceSubmission;
  readonly studentId: StudentId;
  readonly currentMark: Mark | undefined;
  readonly newMark: Mark;
  readonly reason: string;
  readonly today: LocalDate;
}

/** PRD §12.2: principal only, today only, reason required, logged. */
export function checkCorrection(c: CorrectionCheck): Result<true, CorrectionError> {
  // INV-07
  if (c.actor.role !== 'principal' || !c.config.identity.principalCanCorrect) return err('forbidden');
  // INV-06: yesterday's record cannot be touched, by anyone, ever.
  if (c.submission.address.date !== c.today) return err('not_today');
  // INV-14: the record must be on the server first (§20.4).
  if (c.submission.syncState !== 'synced') return err('not_synced');
  if (!c.currentMark) return err('unknown_student');
  // OJT comes only from the ERP declaration (§9.6).
  if (c.currentMark.status === 'ojt' || c.newMark.status === 'ojt') return err('ojt_locked');
  // INV-08
  if (c.reason.trim().length === 0) return err('reason_required');
  // INV-09
  if (marksEqual(c.currentMark, c.newMark)) return err('no_change');
  if (!isMarkAllowed(c.newMark, c.config.marking)) return err('invalid_mark');
  return ok(true);
}

export type StaffMarkError = 'already_marked' | 'not_today' | 'forbidden' | 'disabled' | 'invalid_status' | 'not_verified';

export interface StaffMarkCheck {
  readonly actor: StaffMember;
  readonly target: StaffMember;
  readonly source: 'self' | 'principal';
  readonly existing: StaffAttendanceRecord | undefined;
  readonly date: LocalDate;
  readonly today: LocalDate;
  readonly status: StatusCode;
  readonly config: AppConfiguration;
  readonly verificationRequired: boolean;
  readonly verified: boolean;
}

/** PRD §18: one mark per person per day across both paths; own mark takes precedence. */
export function checkStaffMark(c: StaffMarkCheck): Result<true, StaffMarkError> {
  const staff = c.config.staff;
  if (!staff.enabled) return err('disabled');
  if (c.source === 'self' && (!staff.selfMarking || c.actor.id !== c.target.id)) return err('forbidden');
  if (c.source === 'principal' && (!staff.principalMarking || c.actor.role !== 'principal')) return err('forbidden');
  // INV-22
  if (c.existing) return err('already_marked', { source: c.existing.source });
  if (c.date !== c.today) return err('not_today');
  if (!staff.statusSet.includes(c.status)) return err('invalid_status');
  if (c.source === 'self' && c.verificationRequired && !c.verified) return err('not_verified');
  return ok(true);
}
