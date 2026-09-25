/**
 * Attendance status registry. The status SET is data (PRD §9.3): states enable
 * a subset via configuration; present and absent are always on. Adding a new
 * status means adding a registry entry, not new branching in screens.
 */
export type StatusCode = 'present' | 'absent' | 'half_day' | 'leave' | 'ojt';
export type Half = 1 | 2;
export type LeaveType = 'sick' | 'casual' | 'medical';

export const LEAVE_TYPES: readonly LeaveType[] = ['sick', 'casual', 'medical'];

/** One student's mark. `status: null` means "not yet marked" (blank default). */
export interface Mark {
  readonly status: StatusCode | null;
  readonly half?: Half;
  readonly leaveType?: LeaveType;
  readonly leaveUntil?: string;
}

export type StatusTone = 'success' | 'error' | 'warning' | 'info' | 'brand';

export interface StatusDefinition {
  readonly code: StatusCode;
  /** i18n key for the status name. */
  readonly labelKey: `status.${StatusCode}`;
  readonly icon: 'check' | 'x' | 'half' | 'calendar' | 'briefcase';
  readonly tone: StatusTone;
  readonly alwaysOn: boolean;
  /** OJT is declared by the principal in the ERP, never chosen at the marking screen (PRD §9.6). */
  readonly instructorSelectable: boolean;
  /** Counts as present for attendance percentages. */
  readonly presenceWeight: number;
}

export const STATUS_REGISTRY: Readonly<Record<StatusCode, StatusDefinition>> = {
  present: { code: 'present', labelKey: 'status.present', icon: 'check', tone: 'success', alwaysOn: true, instructorSelectable: true, presenceWeight: 1 },
  absent: { code: 'absent', labelKey: 'status.absent', icon: 'x', tone: 'error', alwaysOn: true, instructorSelectable: true, presenceWeight: 0 },
  half_day: { code: 'half_day', labelKey: 'status.half_day', icon: 'half', tone: 'warning', alwaysOn: false, instructorSelectable: true, presenceWeight: 0.5 },
  leave: { code: 'leave', labelKey: 'status.leave', icon: 'calendar', tone: 'info', alwaysOn: false, instructorSelectable: true, presenceWeight: 0 },
  ojt: { code: 'ojt', labelKey: 'status.ojt', icon: 'briefcase', tone: 'brand', alwaysOn: false, instructorSelectable: false, presenceWeight: 1 },
};

export const STATUS_ORDER: readonly StatusCode[] = ['present', 'absent', 'half_day', 'leave', 'ojt'];

export const blankMark: Mark = { status: null };
export const markOf = (status: StatusCode | null): Mark => ({ status });

export function marksEqual(a: Mark, b: Mark): boolean {
  return a.status === b.status && a.half === b.half && a.leaveType === b.leaveType && a.leaveUntil === b.leaveUntil;
}

/** Whether a mark still needs a follow-up choice (half, leave type) before it can be submitted. */
export function needsDetail(mark: Mark, opts: { halfDayHalves: boolean }): 'half' | 'leaveType' | null {
  if (mark.status === 'half_day' && opts.halfDayHalves && !mark.half) return 'half';
  if (mark.status === 'leave' && !mark.leaveType) return 'leaveType';
  return null;
}
