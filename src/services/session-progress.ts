/**
 * How far today's student attendance has got, counted one way everywhere it is
 * shown: the principal's Home card, the Attendance tab's trade rows and a group
 * instructor's trade overview. Pure: it only reads the session cards it is given.
 */
import type { ShiftNo } from '@/domain/entities';
import type { LocalTime } from '@/lib/time';
import type { SessionCard } from './attendance';

export interface SessionProgress {
  /** Trade sessions submitted today. */
  readonly submitted: number;
  /** The denominator: every trade session today (subject classes are not counted), opened or not, as the prototype. */
  readonly total: number;
  /** Sessions whose window has not opened yet. */
  readonly later: number;
  /** When the first of them opens. */
  readonly nextOpen?: LocalTime;
  /** The shift of the later sessions when they all share one ("9 Shift 2 batches open at 2:00 PM"). */
  readonly laterShift?: ShiftNo;
}

export function sessionProgress(cards: readonly SessionCard[]): SessionProgress {
  const sessions = cards.filter((c) => !c.address.subjectId);
  const later = sessions.filter((c) => c.status === 'future');
  const starts = later.map((c) => c.scheduled.window?.start).filter((t): t is LocalTime => Boolean(t));
  const shifts = new Set(later.map((c) => c.batch.shift));
  return {
    submitted: sessions.filter((c) => c.status === 'submitted').length,
    total: sessions.length,
    later: later.length,
    nextOpen: starts.sort()[0],
    laterShift: shifts.size === 1 ? later[0].batch.shift : undefined,
  };
}
