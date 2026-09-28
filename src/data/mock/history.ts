/**
 * Deterministic attendance history for past working days, so reports are
 * computed from records rather than hard-coded numbers. The same inputs always
 * produce the same history (seeded by student and date).
 */
import type { AttendanceSubmission, StaffAttendanceRecord } from '@/domain/attendance';
import { toSessionKey } from '@/domain/attendance';
import type { Mark } from '@/domain/status';
import { randomFor } from '@/lib/prng';
import { addDays, dayOfWeek, formatMinutes, instantAt, type LocalDate } from '@/lib/time';
import { STAFF, HOME_INSTRUCTOR } from './staff';
import { STUDENTS } from './students';
import { BATCHES } from './trades';

/** How far back generated history reaches. */
export const HISTORY_DAYS = 45;

/** Students whose attendance the prototype's reports call out as low. */
const PROPENSITY_OVERRIDES: Readonly<Record<string, number>> = {
  'ele-s1u2-r30': 0.64, // Tushar Yadav
  'ele-s1u2-r23': 0.71, // Sagar Nikam
};

function propensity(studentId: string): number {
  if (PROPENSITY_OVERRIDES[studentId] !== undefined) return PROPENSITY_OVERRIDES[studentId];
  const r = randomFor(`prop:${studentId}`);
  // ~8% of trainees commute far and fall below the eligibility line.
  return r < 0.08 ? 0.58 + randomFor(`low:${studentId}`) * 0.16 : 0.86 + randomFor(`hi:${studentId}`) * 0.13;
}

export const isWorkingDay = (date: LocalDate) => dayOfWeek(date) !== 0;

/**
 * Marks pinned relative to today so the seeded audit entry stays consistent:
 * Kiran Wagh was absent yesterday and the principal corrected it (seeds.ts).
 */
const PINNED_MARKS: ReadonlyArray<{ studentId: string; daysAgo: number; status: 'present' | 'absent' }> = [
  { studentId: 'fit-s1u1-r04', daysAgo: 1, status: 'absent' },
];

function pinnedStatus(studentId: string, date: LocalDate, today: LocalDate): 'present' | 'absent' | undefined {
  return PINNED_MARKS.find((p) => p.studentId === studentId && addDays(today, -p.daysAgo) === date)?.status;
}

/**
 * Subject sessions taught across trades (Employability Skills): the subject
 * instructor's own daily record per batch, so their reports have history too.
 */
export const SUBJECT_HISTORY: ReadonlyArray<{ readonly subjectId: string; readonly staffId: string; readonly batchIds: readonly string[] }> = STAFF.filter(
  (s) => s.subjectId && s.role !== 'office_staff',
).map((s) => ({ subjectId: s.subjectId!, staffId: s.id, batchIds: s.batchIds }));

export const subjectsWithHistory = (batchId: string) => SUBJECT_HISTORY.filter((h) => h.batchIds.includes(batchId));

/** The daily record of a batch on a past working day; with `subjectId`, that subject's session instead. */
export function historicalSubmission(batchId: string, date: LocalDate, today: LocalDate, subjectId?: string): AttendanceSubmission | undefined {
  if (!isWorkingDay(date) || date >= today) return undefined;
  const students = STUDENTS.filter((s) => s.batchId === batchId);
  if (!students.length) return undefined;
  const subject = subjectId ? SUBJECT_HISTORY.find((h) => h.subjectId === subjectId && h.batchIds.includes(batchId)) : undefined;
  if (subjectId && !subject) return undefined;
  const marks: Record<string, Mark> = {};
  for (const s of students) {
    // Same student, same habits: a subject session draws on the student's own propensity.
    const pinned = subjectId ? undefined : pinnedStatus(s.id, date, today);
    const present = pinned ? pinned === 'present' : randomFor(`att:${subjectId ?? ''}${s.id}:${date}`) < propensity(s.id);
    marks[s.id] = { status: present ? 'present' : 'absent' };
  }
  const address = { batchId, date, slot: { kind: 'daily' as const }, ...(subjectId ? { subjectId } : {}) };
  const minute = (subjectId ? 11 * 60 + 5 : 9 * 60 + 25) + Math.floor(randomFor(`time:${subjectId ?? ''}${batchId}:${date}`) * 35);
  const at = instantAt(date, formatMinutes(minute)).toISOString();
  return {
    id: subjectId ? `hist-${subjectId}~${batchId}-${date}` : `hist-${batchId}-${date}`,
    sessionKey: toSessionKey(address),
    address,
    marks,
    markedBy: subject ? subject.staffId : HOME_INSTRUCTOR[batchId],
    deviceTimestamp: at,
    serverTimestamp: at,
    syncState: 'synced',
  };
}

export function historicalStaffRecord(staffId: string, date: LocalDate, today: LocalDate): StaffAttendanceRecord | undefined {
  if (!isWorkingDay(date) || date >= today) return undefined;
  const member = STAFF.find((s) => s.id === staffId);
  if (!member || member.role === 'office_staff') return undefined;
  const present = randomFor(`staff:${staffId}:${date}`) < 0.95;
  const self = randomFor(`staffsrc:${staffId}:${date}`) < 0.85;
  const minute = 8 * 60 + 25 + Math.floor(randomFor(`stime:${staffId}:${date}`) * 45);
  const at = instantAt(date, formatMinutes(minute)).toISOString();
  return {
    id: `hist-staff-${staffId}-${date}`,
    staffId,
    date,
    status: present ? 'present' : 'absent',
    source: present && self ? 'self' : 'principal',
    markedBy: present && self ? staffId : 'st-anil',
    deviceTimestamp: at,
    syncState: 'synced',
  };
}

/** Past dates (most recent first) covered by generated history. */
export function historyDates(today: LocalDate): LocalDate[] {
  return Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(today, -(i + 1)));
}

export const HISTORY_BATCH_IDS = BATCHES.map((b) => b.id);
