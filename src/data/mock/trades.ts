/** Demo master data — trades, cross-trade subjects and batches ("units"). */
import type { Batch, ShiftNo, Subject, Trade } from '@/domain/entities';
import { INSTITUTE_PUNE_ID } from './institutes';

export const TRADES: readonly Trade[] = [
  { id: 'ele', instituteId: INSTITUTE_PUNE_ID, name: 'Electrician', durationYears: 2 },
  { id: 'fit', instituteId: INSTITUTE_PUNE_ID, name: 'Fitter', durationYears: 2 },
  { id: 'wel', instituteId: INSTITUTE_PUNE_ID, name: 'Welder', durationYears: 1 },
  { id: 'copa', instituteId: INSTITUTE_PUNE_ID, name: 'COPA', durationYears: 1 },
  { id: 'md', instituteId: INSTITUTE_PUNE_ID, name: 'Mechanic Diesel', durationYears: 1 },
  { id: 'nsk-ele', instituteId: 'inst-27613', name: 'Electrician', durationYears: 2 },
];

export const SUBJECTS: readonly Subject[] = [{ id: 'es', name: 'Employability Skills' }];

/** [tradeId, shift, unit, studentCount] — sizes match the approved prototype (417 students at Pune). */
const LAYOUT: ReadonlyArray<readonly [string, ShiftNo, number, number]> = [
  ['ele', 1, 1, 28], ['ele', 1, 2, 31], ['ele', 1, 3, 30], ['ele', 2, 1, 29], ['ele', 2, 2, 27], ['ele', 2, 3, 26],
  ['fit', 1, 1, 24], ['fit', 1, 2, 26], ['fit', 2, 1, 22], ['fit', 2, 2, 25],
  ['wel', 1, 1, 20], ['wel', 2, 1, 21], ['wel', 2, 2, 19],
  ['copa', 1, 1, 24], ['copa', 2, 1, 23],
  ['md', 1, 1, 22], ['md', 2, 1, 20],
  ['nsk-ele', 1, 1, 20],
];

export const batchId = (tradeId: string, shift: ShiftNo, unit: number) => `${tradeId}-s${shift}u${unit}`;

export const BATCHES: readonly Batch[] = LAYOUT.map(([tradeId, shift, unit]) => ({
  id: batchId(tradeId, shift, unit),
  tradeId,
  shift,
  unit,
  // Most institutes run first years in the morning shift (PRD §4.1); the model keeps them independent.
  year: shift === 1 ? 1 : 2,
}));

export const BATCH_SIZES: Readonly<Record<string, number>> = Object.fromEntries(
  LAYOUT.map(([tradeId, shift, unit, n]) => [batchId(tradeId, shift, unit), n]),
);
