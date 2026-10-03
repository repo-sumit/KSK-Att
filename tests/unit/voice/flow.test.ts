// tests/unit/voice/flow.test.ts
import { describe, expect, it } from 'vitest';
import type { Mark, StatusCode } from '@/domain/status';
import {
  advance,
  initialFlow,
  isCalled,
  progressOf,
  uncalledIds,
  withBatch,
  withBatchList,
  withList,
  withMarked,
  withOpening,
  withRemaining,
  withReview,
  withRollCall,
  withSkip,
  withSubmitted,
  withTrade,
  withTradeList,
  type DraftView,
  type VoiceFlowState,
} from '@/domain/voice/flow';

const view = (sources: string[] = [], presets: string[] = []): DraftView => ({
  order: ['a', 'b', 'c', 'd'],
  marks: { a: { status: null }, b: { status: null }, c: { status: 'ojt' }, d: { status: null } },
  sources: Object.fromEntries(sources.map((id) => [id, { via: 'voice' as const, at: 't' }])),
  presets: new Set(presets),
});

describe('advance (MVP R1–R4)', () => {
  it('roll call starts at the first uncalled student and skips presets (OJT)', () => {
    const s = withBatch(initialFlow({ tradeStep: true }), 'k', view([], ['c']), 'roll_call');
    expect(s).toMatchObject({ step: 'ROLL_CALL', currentId: 'a', rollCall: true });
  });
  it('R1 keeps the current student until marked; R2 moves to the next uncalled, wrapping', () => {
    let s = withBatch(initialFlow({ tradeStep: true }), 'k', view([], ['c']), 'roll_call');
    s = withMarked(s, view(['a'], ['c']), 'a', 'present');
    expect(s.currentId).toBe('b');
    expect(s.lastMarked).toEqual({ id: 'a', status: 'present' });
    s = withMarked(s, view(['a', 'b'], ['c']), 'b', 'absent');
    expect(s.currentId).toBe('d');
  });
  it('R3 returns to a skipped student, never the same one twice in a row unless it is the last', () => {
    let s = withBatch(initialFlow({ tradeStep: true }), 'k', view([], ['c']), 'roll_call');
    s = withSkip(s, view([], ['c']), 'a');
    expect(s.currentId).toBe('b');
    s = withMarked(s, view(['b'], ['c']), 'b', 'present');
    s = withMarked(s, view(['b', 'd'], ['c']), 'd', 'present');
    expect(s.currentId).toBe('a');
  });
  it('R4 goes to REVIEW when the roll call runs out', () => {
    let s = withBatch(initialFlow({ tradeStep: true }), 'k', view(['a', 'b'], ['c']), 'roll_call');
    s = withMarked(s, view(['a', 'b', 'd'], ['c']), 'd', 'present');
    expect(s).toMatchObject({ step: 'REVIEW', currentId: null });
  });
  it('by exception nobody is called; start_roll_call calls the first uncalled', () => {
    let s = withBatch(initialFlow({ tradeStep: true }), 'k', view([], ['c']), 'exceptions');
    expect(s).toMatchObject({ step: 'ROLL_CALL', rollCall: false, currentId: null });
    s = withRollCall(s, view(['b'], ['c']));
    expect(s).toMatchObject({ rollCall: true, currentId: 'a' });
  });
  it('progress counts trainer marks and presets', () => {
    expect(progressOf(view(['a'], ['c']))).toEqual({ called: 2, total: 4 });
  });
  it('advance is a no-op outside ROLL_CALL/REVIEW', () => {
    const s = initialFlow({ tradeStep: true });
    expect(advance(s, view())).toBe(s);
  });
});

/** The MVP's five-student batch [A..E] (advance.test.ts), no default status: a roll call. A tiny draft stands in for the draft service. */
function batchOfFive(opts: { halfDayHalves?: boolean } = {}) {
  let draft: DraftView = {
    order: ['A', 'B', 'C', 'D', 'E'],
    marks: { A: { status: null }, B: { status: null }, C: { status: null }, D: { status: null }, E: { status: null } },
    sources: {},
    presets: new Set(),
    ...opts,
  };
  let s: VoiceFlowState = withBatch(initialFlow({ tradeStep: false }), 'k', draft, 'roll_call');
  const write = (id: string, mark: Mark) => {
    draft = { ...draft, marks: { ...draft.marks, [id]: mark }, sources: { ...draft.sources, [id]: { via: 'voice', at: 't' } } };
  };
  return {
    get s() { return s; },
    set s(next: VoiceFlowState) { s = next; },
    get draft() { return draft; },
    mark(id: string, status: StatusCode = 'present', detail: Omit<Mark, 'status'> = {}) {
      write(id, { status, ...detail });
      s = withMarked(s, draft, id, status);
    },
    skip(id: string) { s = withSkip(s, draft, id); },
    remaining(status: StatusCode) {
      for (const id of uncalledIds(draft)) write(id, { status });
      s = withRemaining(s, draft);
    },
  };
}

describe('advance: the MVP advance.test.ts cases against the draft', () => {
  it('starts at the first student and moves on after each mark', () => {
    const t = batchOfFive();
    expect(t.s).toMatchObject({ step: 'ROLL_CALL', currentId: 'A', skipped: [], lastMarked: null });
    t.mark('A');
    expect(progressOf(t.draft)).toEqual({ called: 1, total: 5 });
    expect(t.s).toMatchObject({ currentId: 'B', lastMarked: { id: 'A', status: 'present' } });
  });

  it('keeps the current student when someone else is corrected (R1), then passes over the pre-marked one (R2)', () => {
    const t = batchOfFive();
    t.mark('A');
    t.mark('D', 'absent');
    expect(t.s.currentId).toBe('B');
    expect(t.s.lastMarked).toEqual({ id: 'D', status: 'absent' });
    t.mark('B');
    t.mark('C');
    expect(t.s.currentId).toBe('E');
    t.mark('A', 'absent');
    expect(t.s.currentId).toBe('E');
  });

  it('moves on when the current student is corrected, never calls a pre-marked student, and the last mark opens REVIEW (R4)', () => {
    const t = batchOfFive();
    t.mark('A');
    t.mark('C');
    t.mark('B', 'absent');
    expect(t.s.currentId).toBe('D');
    t.mark('D');
    expect(t.s.currentId).toBe('E');
    t.mark('E');
    expect(t.s).toMatchObject({ step: 'REVIEW', currentId: null, skipped: [] });
  });

  it('brings a skipped student back exactly once, at the end (R3)', () => {
    const t = batchOfFive();
    t.mark('A');
    t.mark('B');
    t.skip('C');
    expect(t.s).toMatchObject({ currentId: 'D', skipped: ['C'], lastSkippedId: 'C' });
    t.mark('D');
    t.mark('E');
    expect(t.s).toMatchObject({ currentId: 'C', skipped: [], lastSkippedId: null });
    t.mark('C');
    expect(t.s).toMatchObject({ step: 'REVIEW', currentId: null, skipped: [] });
  });

  it('returns the same student when they are the only one left (R3, last one)', () => {
    const t = batchOfFive();
    for (const id of ['A', 'B', 'C', 'D']) t.mark(id);
    expect(t.s.currentId).toBe('E');
    t.skip('E');
    expect(t.s).toMatchObject({ step: 'ROLL_CALL', currentId: 'E', skipped: [], lastSkippedId: 'E' });
  });

  it('alternates between two skipped students and never returns the same one twice in a row', () => {
    const t = batchOfFive();
    t.mark('A');
    t.skip('B');
    t.mark('C');
    t.skip('D');
    t.mark('E');
    expect(t.s).toMatchObject({ currentId: 'B', skipped: ['D'] });
    t.skip('B');
    expect(t.s.currentId).toBe('D');
    t.skip('D');
    expect(t.s.currentId).toBe('B');
  });

  it('wraps past the end of the list (pure), and a clean advance with everyone marked opens REVIEW', () => {
    const t = batchOfFive();
    t.mark('D');
    t.mark('E');
    const onD: VoiceFlowState = { ...t.s, currentId: 'D' };
    expect(advance(onD, t.draft).currentId).toBe('A');

    const all = batchOfFive();
    for (const id of ['A', 'B', 'C', 'D', 'E']) all.mark(id);
    const stale: VoiceFlowState = { ...all.s, step: 'ROLL_CALL', currentId: 'C', skipped: ['C'] };
    expect(advance(stale, all.draft)).toMatchObject({ step: 'REVIEW', currentId: null, skipped: [] });
  });

  it('mark_remaining marks skipped students too and opens REVIEW; last_marked stays', () => {
    const t = batchOfFive();
    t.mark('A');
    t.skip('B');
    expect(t.s.currentId).toBe('C');
    expect(uncalledIds(t.draft)).toEqual(['B', 'C', 'D', 'E']);
    t.remaining('present');
    expect(t.s).toMatchObject({ step: 'REVIEW', currentId: null, skipped: [], lastMarked: { id: 'A', status: 'present' } });
  });

  it('allows corrections in REVIEW and has no current student to skip there', () => {
    const t = batchOfFive();
    for (const id of ['A', 'B', 'C', 'D', 'E']) t.mark(id);
    expect(t.s.step).toBe('REVIEW');
    t.mark('B', 'leave', { leaveType: 'sick' });
    expect(t.s).toMatchObject({ step: 'REVIEW', currentId: null, lastMarked: { id: 'B', status: 'leave' } });
    const before = t.s;
    expect(withSkip(before, t.draft, 'B')).toBe(before);
  });
});

describe('advance: details and reviews opened early (MVP examples 11 to 13b)', () => {
  it('a missing half on the last student keeps the list instead of opening REVIEW', () => {
    const t = batchOfFive({ halfDayHalves: true });
    for (const id of ['A', 'B', 'C', 'D']) t.mark(id);
    t.mark('E', 'half_day');
    expect(t.s).toMatchObject({ step: 'ROLL_CALL', currentId: null });
    t.mark('E', 'half_day', { half: 1 });
    expect(t.s).toMatchObject({ step: 'ROLL_CALL', currentId: null });
    expect(withReview(t.s).step).toBe('REVIEW');
  });

  it('half day without halves configured needs no detail; a leave without its type does', () => {
    const t = batchOfFive();
    for (const id of ['A', 'B', 'C', 'D']) t.mark(id);
    t.mark('E', 'half_day');
    expect(t.s.step).toBe('REVIEW');
    t.mark('C', 'leave');
    expect(t.s).toMatchObject({ step: 'ROLL_CALL', currentId: null });
  });

  it('a change on a review opened before everyone was called resumes the roll call from the top', () => {
    const t = batchOfFive();
    t.mark('A');
    t.s = withReview(t.s);
    expect(t.s.step).toBe('REVIEW');
    t.mark('B');
    expect(t.s).toMatchObject({ step: 'ROLL_CALL', currentId: 'C' });
    t.s = withReview(t.s);
    expect(withList(t.s, t.draft)).toMatchObject({ step: 'ROLL_CALL', currentId: 'C' });
  });

  it('by exception a mark moves nobody, and start_roll_call skips students already marked', () => {
    let s = withBatch(initialFlow({ tradeStep: false }), 'k', view([], ['c']), 'exceptions');
    s = withMarked(s, view(['a'], ['c']), 'a', 'absent');
    expect(s).toMatchObject({ step: 'ROLL_CALL', rollCall: false, currentId: null, lastMarked: { id: 'a', status: 'absent' } });
    expect(withRollCall(s, view(['a'], ['c'])).currentId).toBe('b');
  });
});

describe('flow transitions', () => {
  const marking = () => withBatch(withTrade(initialFlow({ tradeStep: true }), 'fitter'), 'k', view(['a'], ['c']), 'roll_call');

  it('starts on the trade list only when the plan has a trade step', () => {
    expect(initialFlow({ tradeStep: true })).toEqual({ step: 'SELECT_TRADE', tradeId: null, sessionKey: null, currentId: null, skipped: [], rollCall: true, lastMarked: null, lastSkippedId: null });
    expect(initialFlow({ tradeStep: false }).step).toBe('SELECT_BATCH');
  });

  it('trade, batch list and trade list drop the open batch', () => {
    const s = withMarked(marking(), view(['a', 'b'], ['c']), 'b', 'present');
    expect(withTrade(s, 'electrician')).toMatchObject({ step: 'SELECT_BATCH', tradeId: 'electrician', sessionKey: null, currentId: null, skipped: [], lastMarked: null });
    expect(withBatchList(s)).toMatchObject({ step: 'SELECT_BATCH', tradeId: 'fitter', sessionKey: null, currentId: null, lastMarked: null });
    expect(withTradeList(s)).toMatchObject({ step: 'SELECT_TRADE', tradeId: null, sessionKey: null, currentId: null });
  });

  it('opening a batch waits in VERIFY, where marking transitions are refused', () => {
    const s = withOpening(withTrade(initialFlow({ tradeStep: true }), 'fitter'), 'k');
    expect(s).toMatchObject({ step: 'VERIFY', tradeId: 'fitter', sessionKey: 'k', currentId: null });
    expect(withMarked(s, view(['a']), 'a', 'present')).toBe(s);
    expect(withRollCall(s, view())).toBe(s);
    expect(withReview(s)).toBe(s);
    expect(withList(s, view())).toBe(s);
    expect(advance(s, view())).toBe(s);
  });

  it('refuses a mark the draft does not hold: unknown student, no trainer source, OJT', () => {
    const s = marking();
    expect(withMarked(s, view(['a'], ['c']), 'zz', 'present')).toBe(s);
    expect(withMarked(s, view(['a'], ['c']), 'b', 'present')).toBe(s);
    expect(withMarked(s, view(['a', 'c'], ['c']), 'c', 'present')).toBe(s);
    expect(withMarked(s, view(['a', 'b'], ['c']), 'b', 'ojt')).toBe(s);
  });

  it('skip only applies to the current student', () => {
    const s = marking();
    expect(s.currentId).toBe('b');
    expect(withSkip(s, view(['a'], ['c']), 'd')).toBe(s);
    const byException = withBatch(initialFlow({ tradeStep: false }), 'k', view(), 'exceptions');
    expect(withSkip(byException, view(), 'a')).toBe(byException);
  });

  it('review clears the pointer and skips; list returns to the roll call; submitted locks', () => {
    const s = withSkip(marking(), view(['a'], ['c']), 'b');
    const review = withReview(s);
    expect(review).toMatchObject({ step: 'REVIEW', currentId: null, skipped: [], lastSkippedId: null, rollCall: true });
    expect(withList(review, view(['a'], ['c']))).toMatchObject({ step: 'ROLL_CALL', currentId: 'b' });
    expect(withSubmitted(review)).toMatchObject({ step: 'SUBMITTED', currentId: null, sessionKey: 'k' });
  });

  it('without an open batch, list and review refuse and remaining changes nothing', () => {
    const s = initialFlow({ tradeStep: false });
    expect(withList(s, view())).toBe(s);
    expect(withReview(s)).toBe(s);
    expect(withRollCall(s, view())).toBe(s);
    expect(withRemaining(s, view())).toEqual(s);
  });

  it('called means a trainer source or a preset', () => {
    const d = view(['a'], ['c']);
    expect(['a', 'b', 'c', 'd'].map((id) => isCalled(d, id))).toEqual([true, false, true, false]);
    expect(isCalled(d, 'constructor')).toBe(false);
    expect(uncalledIds(d)).toEqual(['b', 'd']);
  });
});

describe('refusals and purity', () => {
  it('withRemaining with no open batch returns the same state, like the other transitions', () => {
    for (const s of [initialFlow({ tradeStep: true }), withTrade(initialFlow({ tradeStep: true }), 't'), withOpening(initialFlow({ tradeStep: false }), 'k')]) {
      expect(withRemaining(s, view())).toBe(s);
    }
  });

  it('no transition mutates its input state or draft', () => {
    const deepFreeze = <T,>(value: T): T => {
      if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const inner of Object.values(value as object)) deepFreeze(inner);
      }
      return value;
    };
    const draft = deepFreeze(view(['a'], ['c']));
    const base = initialFlow({ tradeStep: true });
    const open = deepFreeze(withBatch(base, 'k', draft, 'roll_call'));
    const reviewing = deepFreeze(withReview(open));
    const states = [deepFreeze(base), open, reviewing, deepFreeze(withSubmitted(open))];
    const before = JSON.stringify(states);
    for (const s of states) {
      const results = [
        withTradeList(s),
        withTrade(s, 't'),
        withBatchList(s),
        withOpening(s, 'k2'),
        withBatch(s, 'k2', draft, 'roll_call'),
        withBatch(s, 'k2', draft, 'exceptions'),
        withRollCall(s, draft),
        withReview(s),
        withList(s, draft),
        withMarked(s, draft, 'a', 'present'),
        withMarked(s, draft, 'b', 'absent'),
        withSkip(s, draft, 'b'),
        withRemaining(s, draft),
        withSubmitted(s),
        advance(s, draft),
      ];
      expect(results.length).toBe(15); // each call above returned without a frozen-object TypeError
    }
    expect(JSON.stringify(states)).toBe(before);
  });
});
