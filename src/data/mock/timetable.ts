/**
 * Demo timetable (an ERP input, PRD §15.2). Every batch runs four periods per
 * shift: theory and practical alternating. The mock repeats the same week
 * pattern every day — including Sunday — so a demo works on any day.
 */
import type { PeriodKind, TimetableEntry, TimeWindow } from '@/domain/entities';
import { BATCHES } from './trades';
import { HOME_INSTRUCTOR } from './staff';

const PERIODS: Record<1 | 2, ReadonlyArray<readonly [number, PeriodKind, TimeWindow]>> = {
  1: [
    [1, 'theory', { start: '07:00', end: '08:00' }],
    [2, 'practical', { start: '08:00', end: '10:00' }],
    [3, 'theory', { start: '10:00', end: '11:00' }],
    [4, 'practical', { start: '11:00', end: '13:00' }],
  ],
  2: [
    [1, 'theory', { start: '14:00', end: '15:00' }],
    [2, 'practical', { start: '15:00', end: '17:00' }],
    [3, 'theory', { start: '17:00', end: '18:00' }],
    [4, 'practical', { start: '18:00', end: '20:00' }],
  ],
};

/** Vikas Shinde's timetable (the prototype's timetable persona). Key: `${batchId}#${periodNo}`. */
const INSTRUCTOR_OVERRIDES: Readonly<Record<string, string>> = {
  'ele-s1u1#1': 'st-vikas',
  'ele-s1u2#2': 'st-vikas',
  'ele-s1u2#3': 'st-vikas',
  'ele-s1u2#4': 'st-vikas',
};

/** Employability Skills periods taught by Meera Kulkarni across trades. */
const ES_PERIODS: ReadonlySet<string> = new Set(['ele-s1u1#3', 'copa-s1u1#3', 'fit-s1u2#1', 'ele-s2u3#1', 'wel-s2u2#3']);

export const TIMETABLE: readonly TimetableEntry[] = BATCHES.flatMap((batch) =>
  [0, 1, 2, 3, 4, 5, 6].flatMap((weekday) =>
    PERIODS[batch.shift].map(([periodNo, kind, window]) => {
      const key = `${batch.id}#${periodNo}`;
      const es = ES_PERIODS.has(key);
      return {
        id: `tt-${batch.id}-d${weekday}-p${periodNo}`,
        batchId: batch.id,
        instructorId: es ? 'st-meera' : (INSTRUCTOR_OVERRIDES[key] ?? HOME_INSTRUCTOR[batch.id]),
        weekday,
        periodNo,
        kind: es ? 'theory' : kind,
        window,
        ...(es ? { subjectId: 'es' } : {}),
      } satisfies TimetableEntry;
    }),
  ),
);
