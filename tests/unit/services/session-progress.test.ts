import { describe, expect, it } from 'vitest';
import type { SessionCard, SessionStatus } from '@/services/attendance';
import { sessionProgress } from '@/services/session-progress';

/** Only the fields the counter reads. */
function card(status: SessionStatus, shift: 1 | 2, start: string | null, subjectId?: string): SessionCard {
  return {
    status,
    address: { subjectId },
    batch: { shift },
    scheduled: { window: start ? { start, end: '23:00' } : null },
  } as unknown as SessionCard;
}

describe('sessionProgress', () => {
  it('counts submitted of every trade session today, opened or not (the prototype denominator)', () => {
    const p = sessionProgress([card('submitted', 1, '07:30'), card('open', 1, '07:30'), card('closed', 1, '07:30'), card('future', 2, '14:00'), card('future', 2, '14:00')]);
    expect(p).toEqual({ submitted: 1, total: 5, later: 2, nextOpen: '14:00', laterShift: 2 });
  });
  it('leaves subject classes out', () => {
    const p = sessionProgress([card('submitted', 1, '07:30'), card('open', 1, '07:30', 'es')]);
    expect(p.total).toBe(1);
  });
  it('names the earliest later start, and no shift when later sessions span shifts', () => {
    const p = sessionProgress([card('future', 2, '15:00'), card('future', 1, '11:00')]);
    expect(p.nextOpen).toBe('11:00');
    expect(p.laterShift).toBeUndefined();
  });
  it('has nothing later when every session is open', () => {
    const p = sessionProgress([card('open', 1, null)]);
    expect(p).toEqual({ submitted: 0, total: 1, later: 0, nextOpen: undefined, laterShift: undefined });
  });
});
