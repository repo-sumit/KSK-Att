/**
 * Which marking slots exist for a batch on a day, and whether each is open now.
 * Driven by mark.frequency, time.* windows and the ERP timetable (PRD §10, §11).
 */
import type { AppConfiguration } from '@/config/types';
import type { Batch, Institute, StaffId, SubjectId, TimeWindow, TimetableEntry } from './entities';
import type { MarkingSlot } from './attendance';
import { dayOfWeek, minutesOfDay, parseTime, type LocalDate } from '@/lib/time';

export type WindowState = 'open' | 'future' | 'closed';

export interface ScheduledSlot {
  readonly slot: MarkingSlot;
  /** null when time fencing is off: the slot is markable all day. */
  readonly window: TimeWindow | null;
  readonly timetableEntry?: TimetableEntry;
}

export function shiftWindow(batch: Batch, config: AppConfiguration, institute: Institute): TimeWindow {
  const override = config.time.instituteOverride ? institute.shiftWindows?.[batch.shift] : undefined;
  return override ?? config.time.shiftWindows[batch.shift];
}

/** Timetable entries for a batch on a date, in period order. */
export function timetableFor(timetable: readonly TimetableEntry[], batchId: string, date: LocalDate): TimetableEntry[] {
  const weekday = dayOfWeek(date);
  return timetable.filter((t) => t.batchId === batchId && t.weekday === weekday).sort((a, b) => a.periodNo - b.periodNo);
}

interface SlotQuery {
  readonly batch: Batch;
  readonly institute: Institute;
  readonly date: LocalDate;
  readonly config: AppConfiguration;
  readonly timetable: readonly TimetableEntry[];
  /** Cross-trade subject being marked (e.g. Employability Skills); periods are filtered to it. */
  readonly subjectId?: SubjectId;
  /** Under timetable mapping only this instructor's periods are offered. */
  readonly instructorId?: StaffId;
}

export function slotsForBatch(q: SlotQuery): ScheduledSlot[] {
  const { config } = q;
  const fence = config.time.fencing;
  const shift = shiftWindow(q.batch, config, q.institute);
  switch (config.marking.frequency) {
    case 'once':
      return [{ slot: { kind: 'daily' }, window: fence ? shift : null }];
    case 'twice': {
      const split = config.time.twiceSplit[q.batch.shift];
      return [
        { slot: { kind: 'half', part: 1 }, window: fence ? { start: shift.start, end: split } : null },
        { slot: { kind: 'half', part: 2 }, window: fence ? { start: split, end: shift.end } : null },
      ];
    }
    case 'period':
      return timetableFor(q.timetable, q.batch.id, q.date)
        .filter((t) => (q.subjectId ? t.subjectId === q.subjectId : !t.subjectId))
        .filter((t) => (q.instructorId ? t.instructorId === q.instructorId : true))
        .map((t) => ({ slot: { kind: 'period', periodNo: t.periodNo }, window: fence ? t.window : null, timetableEntry: t }));
  }
}

/** Open while start <= now < end (a hard fence: no grace period, PRD §11.4). */
export function windowState(window: TimeWindow | null, now: Date): WindowState {
  if (!window) return 'open';
  const m = minutesOfDay(now);
  if (m < parseTime(window.start)) return 'future';
  if (m >= parseTime(window.end)) return 'closed';
  return 'open';
}

export function sameSlot(a: MarkingSlot, b: MarkingSlot): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'half' && b.kind === 'half') return a.part === b.part;
  if (a.kind === 'period' && b.kind === 'period') return a.periodNo === b.periodNo;
  return true;
}
