import { describe, expect, it } from 'vitest';
import type { AttendanceSubmission } from '@/domain/attendance';
import { completenessIssues, contributesToPresent, countMarks, effectivePresent, initialMarks, presentTerms, summaryStatuses } from '@/domain/marking';
import { checkCorrection, checkStaffMark, checkSubmission, type SubmitCheck } from '@/domain/rules';
import { TODAY, configWith, data, staff } from '../../helpers/fixtures';

const roster = data.students.filter((s) => s.batchId === 'ele-s1u2');
const ids = roster.map((s) => s.id);
const noCarry = { ojt: [], carriedLeave: {} };

describe('initial marks (PRD §9.2)', () => {
  it('present default: everyone starts present', () => {
    const marks = initialMarks(roster, { marking: configWith().marking, date: TODAY, ...noCarry });
    expect(countMarks(marks)).toMatchObject({ total: 31, present: 31, absent: 0 });
  });
  it('absent default: everyone starts absent', () => {
    const marks = initialMarks(roster, { marking: configWith({ marking: { defaultStatus: 'absent' } }).marking, date: TODAY, ...noCarry });
    expect(countMarks(marks).absent).toBe(31);
  });
  it('blank default: nobody is marked and submit is blocked', () => {
    const marking = configWith({ marking: { defaultStatus: 'blank' } }).marking;
    const marks = initialMarks(roster, { marking, date: TODAY, ...noCarry });
    expect(countMarks(marks).unmarked).toBe(31);
    expect(completenessIssues(marks, marking)[0]).toMatchObject({ kind: 'unmarked' });
  });
  it('OJT declarations pre-set students only when OJT is enabled', () => {
    const on = configWith({ marking: { statusSet: ['present', 'absent', 'ojt'] } }).marking;
    const withOjt = initialMarks(roster, { marking: on, date: TODAY, ojt: data.ojt, carriedLeave: {} });
    expect(countMarks(withOjt).ojt).toBe(2);
    const off = initialMarks(roster, { marking: configWith().marking, date: TODAY, ojt: data.ojt, carriedLeave: {} });
    expect(countMarks(off).ojt).toBe(0);
  });
  it('half day needs a half only when the halves flag is on', () => {
    const marks = { a: { status: 'half_day' as const } };
    expect(completenessIssues(marks, configWith({ marking: { statusSet: ['present', 'absent', 'half_day'], halfDayHalves: true } }).marking)).toHaveLength(1);
    expect(completenessIssues(marks, configWith({ marking: { statusSet: ['present', 'absent', 'half_day'], halfDayHalves: false } }).marking)).toHaveLength(0);
  });
});

describe('effective Present (D-069: half day ½, OJT as present)', () => {
  // The owner's example: 31 students, 24 present, 2 half day, 2 leave, 2 OJT, 1 absent.
  const counts = { total: 31, present: 24, absent: 1, half_day: 2, leave: 2, ojt: 2, unmarked: 0 };
  it('counts each status by its presence weight: 24 + 2 × ½ + 2 OJT = 27', () => {
    expect(effectivePresent(counts)).toBe(27);
    expect(presentTerms(counts)).toEqual([
      { status: 'present', count: 24, weight: 1 },
      { status: 'half_day', count: 2, weight: 0.5 },
      { status: 'ojt', count: 2, weight: 1 },
    ]);
  });
  it('a single half day gives a half: 24.5', () => {
    expect(effectivePresent({ ...counts, half_day: 1, ojt: 0, leave: 5 })).toBe(24.5);
  });
  it('leave, absent and unmarked add nothing', () => {
    expect(effectivePresent({ total: 10, present: 0, absent: 4, half_day: 0, leave: 3, ojt: 0, unmarked: 3 })).toBe(0);
  });
  it('summaries show every configured status in registry order, plus any status an older record used', () => {
    const none = { total: 5, present: 5, absent: 0, half_day: 0, leave: 0, ojt: 0, unmarked: 0 };
    expect(summaryStatuses(['present', 'absent'], none)).toEqual(['present', 'absent']);
    expect(summaryStatuses(['ojt', 'leave', 'present', 'absent', 'half_day'], none)).toEqual(['present', 'absent', 'half_day', 'leave', 'ojt']);
    expect(summaryStatuses(['present', 'absent'], { ...none, present: 4, leave: 1 })).toEqual(['present', 'absent', 'leave']);
  });
  it('knows when a configuration has statuses that count toward Present', () => {
    expect(contributesToPresent(['present', 'absent'])).toBe(false);
    expect(contributesToPresent(['present', 'absent', 'leave'])).toBe(false);
    expect(contributesToPresent(['present', 'absent', 'half_day'])).toBe(true);
    expect(contributesToPresent(['present', 'absent', 'ojt'])).toBe(true);
  });
});

function submitCheck(over: Partial<SubmitCheck> = {}): SubmitCheck {
  const config = configWith();
  return {
    address: { batchId: 'ele-s1u2', date: TODAY, slot: { kind: 'daily' } },
    today: TODAY,
    existing: undefined,
    windowState: 'open',
    hasAccess: true,
    verificationRequired: true,
    verified: true,
    marks: initialMarks(roster, { marking: config.marking, date: TODAY, ...noCarry }),
    rosterIds: ids,
    config,
    ...over,
  };
}

const submission: AttendanceSubmission = {
  id: 'att-1',
  sessionKey: 'ele-s1u2.2026-09-25.daily',
  address: { batchId: 'ele-s1u2', date: TODAY, slot: { kind: 'daily' } },
  marks: { [ids[0]]: { status: 'absent' } },
  markedBy: 'st-sunita',
  deviceTimestamp: '2026-09-25T05:00:00.000Z',
  syncState: 'synced',
};

describe('submission invariants (PRD §12.1, §5.3)', () => {
  it('accepts a complete, verified, in-window submission', () => expect(checkSubmission(submitCheck()).ok).toBe(true));
  it('rejects a second submit of the same session', () => expect(checkSubmission(submitCheck({ existing: submission }))).toMatchObject({ ok: false, error: 'already_submitted' }));
  it('rejects backdating', () => expect(checkSubmission(submitCheck({ address: { batchId: 'ele-s1u2', date: '2026-09-24', slot: { kind: 'daily' } } }))).toMatchObject({ error: 'not_today' }));
  it('rejects outside the time window', () => {
    expect(checkSubmission(submitCheck({ windowState: 'future' }))).toMatchObject({ error: 'window_not_open' });
    expect(checkSubmission(submitCheck({ windowState: 'closed' }))).toMatchObject({ error: 'window_closed' });
  });
  it('rejects without verification when verification is on', () => expect(checkSubmission(submitCheck({ verified: false }))).toMatchObject({ error: 'not_verified' }));
  it('rejects a partial roster', () => expect(checkSubmission(submitCheck({ rosterIds: [...ids, 'ghost'] }))).toMatchObject({ error: 'roster_mismatch' }));
});

describe('principal correction (PRD §12.2)', () => {
  const base = { config: configWith(), submission, studentId: ids[0], currentMark: { status: 'absent' as const }, newMark: { status: 'present' as const }, reason: 'Student arrived late', today: TODAY };
  it('allows the principal, today, with a reason', () => expect(checkCorrection({ ...base, actor: staff('st-anil') }).ok).toBe(true));
  it('refuses instructors', () => expect(checkCorrection({ ...base, actor: staff('st-sunita') })).toMatchObject({ error: 'forbidden' }));
  it('refuses a past day', () => expect(checkCorrection({ ...base, actor: staff('st-anil'), today: '2026-09-26' })).toMatchObject({ error: 'not_today' }));
  it('requires a reason', () => expect(checkCorrection({ ...base, actor: staff('st-anil'), reason: '   ' })).toMatchObject({ error: 'reason_required' }));
  it('refuses a no-op change', () => expect(checkCorrection({ ...base, actor: staff('st-anil'), newMark: { status: 'absent' } })).toMatchObject({ error: 'no_change' }));
  it('refuses records not yet synced', () => expect(checkCorrection({ ...base, actor: staff('st-anil'), submission: { ...submission, syncState: 'pending' } })).toMatchObject({ error: 'not_synced' }));
});

describe('staff attendance (PRD §18)', () => {
  const base = { date: TODAY, today: TODAY, status: 'present' as const, config: configWith(), verificationRequired: true, verified: true, existing: undefined };
  it('self-mark after verification', () => expect(checkStaffMark({ ...base, actor: staff('st-rajesh'), target: staff('st-rajesh'), source: 'self' }).ok).toBe(true));
  it('one mark per person per day across both paths', () => {
    const existing = { id: 'x', staffId: 'st-rajesh', date: TODAY, status: 'present' as const, source: 'self' as const, markedBy: 'st-rajesh', deviceTimestamp: '', syncState: 'synced' as const };
    expect(checkStaffMark({ ...base, actor: staff('st-anil'), target: staff('st-rajesh'), source: 'principal', existing })).toMatchObject({ error: 'already_marked' });
  });
  it('only the principal marks others', () => expect(checkStaffMark({ ...base, actor: staff('st-sunita'), target: staff('st-rajesh'), source: 'principal' })).toMatchObject({ error: 'forbidden' }));
});
