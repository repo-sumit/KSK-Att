import { describe, expect, it } from 'vitest';
import { rankStandings } from '@/features/reports/sections/Leaderboard';
import type { StudentStanding } from '@/services/reports';
import { endOfMonth, shiftMonth } from '@/lib/time';

const s = (name: string, pct: number | null): StudentStanding => ({
  student: { id: name, batchId: 'b', rollNo: 1, name, fatherName: '' },
  pct,
  daysPresent: 0,
  daysMarked: pct === null ? 0 : 10,
  atRisk: pct !== null && pct < 75,
});

describe('leaderboard ranking (brief §7)', () => {
  const standings = [s('Rahul', 76), s('Amit', 94), s('Priya', 69), s('Sneha', 88), s('Asha', 88), s('New', null)];
  it('highest first, numbered 1…n; equal percentages in a stable order; unmarked students last with no rank', () => {
    expect(rankStandings(standings, 'high_first').map((r) => [r.standing.student.name, r.rank])).toEqual([
      ['Amit', 1],
      ['Asha', 2],
      ['Sneha', 3],
      ['Rahul', 4],
      ['Priya', 5],
      ['New', null],
    ]);
  });
  it('lowest first keeps each student’s position', () => {
    expect(rankStandings(standings, 'low_first').map((r) => [r.standing.student.name, r.rank])).toEqual([
      ['Priya', 5],
      ['Rahul', 4],
      ['Sneha', 3],
      ['Asha', 2],
      ['Amit', 1],
      ['New', null],
    ]);
  });
});

describe('month arithmetic for the trend', () => {
  it('shifts across years and finds month ends', () => {
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-01');
    expect(shiftMonth('2026-09-25', -2)).toBe('2026-07-01');
    expect(shiftMonth('2026-12-31', 1)).toBe('2027-01-01');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-01')).toBe('2028-02-29');
  });
});
