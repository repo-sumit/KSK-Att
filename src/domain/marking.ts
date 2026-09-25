/**
 * Marking-screen rules (PRD §9): the initial state of every row, which statuses
 * an instructor may choose, running totals and the submit-completeness check.
 * Pure functions — the roster UI and the attendance service share them.
 */
import type { MarkingConfig } from '@/config/types';
import type { OjtDeclaration, Student, StudentId } from './entities';
import { STATUS_ORDER, STATUS_REGISTRY, blankMark, markOf, needsDetail, type Mark, type StatusCode } from './status';
import { compareDates, type LocalDate } from '@/lib/time';

/** Statuses enabled for this state, in display order. Present and absent are always on (PRD §9.3). */
export function enabledStatuses(marking: MarkingConfig): StatusCode[] {
  const set = new Set<StatusCode>(['present', 'absent', ...marking.statusSet]);
  return STATUS_ORDER.filter((code) => set.has(code));
}

/** Statuses an instructor can tap on a row (OJT is ERP-declared, never chosen here). */
export function selectableStatuses(marking: MarkingConfig): StatusCode[] {
  return enabledStatuses(marking).filter((code) => STATUS_REGISTRY[code].instructorSelectable);
}

export function isOnOjt(studentId: StudentId, date: LocalDate, ojt: readonly OjtDeclaration[]): boolean {
  return ojt.some((d) => d.studentIds.includes(studentId) && compareDates(d.from, date) <= 0 && compareDates(date, d.to) <= 0);
}

export interface InitialMarkContext {
  readonly marking: MarkingConfig;
  readonly date: LocalDate;
  readonly ojt: readonly OjtDeclaration[];
  /** Leave ranges recorded on earlier days that still cover `date` (PRD §9.5 auto-shown leave). */
  readonly carriedLeave: Readonly<Record<StudentId, Mark>>;
}

/**
 * Row state before the instructor touches anything:
 * OJT (when enabled) > carried-over leave suggestion > configured default.
 */
export function initialMark(studentId: StudentId, ctx: InitialMarkContext): Mark {
  const enabled = new Set(enabledStatuses(ctx.marking));
  if (enabled.has('ojt') && isOnOjt(studentId, ctx.date, ctx.ojt)) return markOf('ojt');
  const leave = ctx.carriedLeave[studentId];
  if (leave && enabled.has('leave')) return leave;
  switch (ctx.marking.defaultStatus) {
    case 'present':
      return markOf('present');
    case 'absent':
      return markOf('absent');
    case 'blank':
      return blankMark;
  }
}

export function initialMarks(students: readonly Student[], ctx: InitialMarkContext): Record<StudentId, Mark> {
  const marks: Record<StudentId, Mark> = {};
  for (const s of students) marks[s.id] = initialMark(s.id, ctx);
  return marks;
}

export interface MarkCounts {
  readonly total: number;
  readonly present: number;
  readonly absent: number;
  readonly half_day: number;
  readonly leave: number;
  readonly ojt: number;
  readonly unmarked: number;
}

export function countMarks(marks: Readonly<Record<StudentId, Mark>>): MarkCounts {
  const c = { total: 0, present: 0, absent: 0, half_day: 0, leave: 0, ojt: 0, unmarked: 0 };
  for (const mark of Object.values(marks)) {
    c.total++;
    if (mark.status === null) c.unmarked++;
    else c[mark.status]++;
  }
  return c;
}

export type CompletenessIssue =
  | { readonly kind: 'unmarked'; readonly studentIds: readonly StudentId[] }
  | { readonly kind: 'half'; readonly studentIds: readonly StudentId[] }
  | { readonly kind: 'leaveType'; readonly studentIds: readonly StudentId[] };

/** Everything that blocks submission, in the order the UI reports it. Empty = ready. */
export function completenessIssues(marks: Readonly<Record<StudentId, Mark>>, marking: MarkingConfig): CompletenessIssue[] {
  const unmarked: StudentId[] = [];
  const half: StudentId[] = [];
  const leaveType: StudentId[] = [];
  for (const [id, mark] of Object.entries(marks)) {
    if (mark.status === null) {
      unmarked.push(id);
      continue;
    }
    const detail = needsDetail(mark, { halfDayHalves: marking.halfDayHalves });
    if (detail === 'half') half.push(id);
    if (detail === 'leaveType') leaveType.push(id);
  }
  const issues: CompletenessIssue[] = [];
  if (unmarked.length) issues.push({ kind: 'unmarked', studentIds: unmarked });
  if (half.length) issues.push({ kind: 'half', studentIds: half });
  if (leaveType.length) issues.push({ kind: 'leaveType', studentIds: leaveType });
  return issues;
}

/** Whether a mark is allowed under the configuration (used to validate submissions and corrections). */
export function isMarkAllowed(mark: Mark, marking: MarkingConfig): boolean {
  if (mark.status === null) return false;
  if (!enabledStatuses(marking).includes(mark.status)) return false;
  if (mark.half !== undefined && (mark.status !== 'half_day' || !marking.halfDayHalves)) return false;
  if (mark.leaveUntil !== undefined && (mark.status !== 'leave' || !marking.leaveDateRange)) return false;
  return true;
}

/** Share of attendance for percentage reports: present = 1, half day = 0.5, OJT counts as present. */
export function presenceWeight(mark: Mark): number {
  return mark.status ? STATUS_REGISTRY[mark.status].presenceWeight : 0;
}
