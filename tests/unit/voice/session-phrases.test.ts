/**
 * A phrase built from a real session's shift, unit and slot (a half or a period) must open THAT session. Where
 * the words can be read two ways the engine must answer ambiguous or none, never FOUND on another session: the
 * trainer would be opening and marking the wrong class.
 *
 * The slot words (half, period) make a phrase carry three or four keywords. Hindi and Marathi put the number
 * before its keyword ("pehli shift"), English after ("shift 1"), and a trainer mixes them in one sentence
 * ("पहिली शिफ्ट unit 1 हाफ २"), so a number has to go to the keyword it stands next to, not to one direction
 * chosen for the whole phrase.
 */
import { describe, expect, it } from 'vitest';
import { FIRST_HALF_PHRASES, SECOND_HALF_PHRASES } from '@/domain/voice/lexicon';
import { readSessionWords } from '@/domain/voice/phrase';
import { parseShiftUnit, resolveSession, type Match, type SessionChoice } from '@/domain/voice/match';

type Slot = SessionChoice['slot'];
const SHIFTS = [1, 2];
const UNITS = [1, 2, 3];
const session = (key: string, shift: number, unit: number, slot: Slot): SessionChoice => ({ key, shift, unit, tradeName: 'Electrician', slot });

/** Twice-daily marking: 2 shifts x 3 units x 2 halves. Keys read "s<shift>u<unit>.h<part>". */
const halves = SHIFTS.flatMap((s) => UNITS.flatMap((u) => ([1, 2] as const).map((part) => session(`s${s}u${u}.h${part}`, s, u, { kind: 'half', part }))));
/** Timetable marking: 2 shifts x 3 units x 4 periods. Keys read "s<shift>u<unit>.p<period>". */
const periods = SHIFTS.flatMap((s) => UNITS.flatMap((u) => [1, 2, 3, 4].map((n) => session(`s${s}u${u}.p${n}`, s, u, { kind: 'period', periodNo: n }))));
const dailies = SHIFTS.flatMap((s) => UNITS.map((u) => session(`s${s}u${u}.daily`, s, u, { kind: 'daily' })));

/** The key it found, or the kind of answer (`ambiguous`, `none`) so a failure says what happened. */
const answer = (said: string, list: readonly SessionChoice[]): string => {
  const m: Match<SessionChoice> = resolveSession(said, list);
  return m.kind === 'found' ? m.value.key : m.kind === 'ambiguous' ? `ambiguous ${m.candidates.map((c) => c.key).join(' ')}` : 'none';
};

describe('mixed word order: a number belongs to the keyword it stands next to', () => {
  it.each([
    // the phrases a review found opening the wrong half, then their Hindi and Marathi twins
    ['second half shift 1 unit 2', 's1u2.h2'],
    ['first half shift 2 unit 1', 's2u1.h1'],
    ['पहिला हाफ शिफ्ट 2 युनिट 1', 's2u1.h1'],
    ['पहिली शिफ्ट unit 1 हाफ २', 's1u1.h2'],
    ['doosra half shift 1 unit 2', 's1u2.h2'],
    ['दुसरा हाफ शिफ्ट १ युनिट २', 's1u2.h2'],
    ['pehla half shift 2 unit 1', 's2u1.h1'],
    ['pehli shift unit 1 half 2', 's1u1.h2'],
    ['first shift unit 1 half 2', 's1u1.h2'],
    ['पहिली शिफ्ट युनिट १ हाफ २', 's1u1.h2'],
    ['unit 3 pehla half doosri shift', 's2u3.h1'],
    ['shift 1 unit 2 doosra half', 's1u2.h2'],
    ['half 2 shift 1 unit 2', 's1u2.h2'],
  ])('half: %j -> %s', (said, key) => {
    expect(answer(said, halves)).toBe(key);
  });

  it.each([
    ['first shift unit 1 period 3', 's1u1.p3'],
    ['third period shift 1 unit 2', 's1u2.p3'],
    ['pehli shift unit 1 period 3', 's1u1.p3'],
    ['पहिली शिफ्ट युनिट 1 तासिका 3', 's1u1.p3'],
    ['teesra period shift 1 unit 2', 's1u2.p3'],
    ['तिसरी तासिका शिफ्ट 1 युनिट 2', 's1u2.p3'],
    ['second shift unit 3 fourth period', 's2u3.p4'],
    ['चौथी तासिका दुसरी शिफ्ट तिसरी युनिट', 's2u3.p4'],
    ['unit 2 teesra ghanta pehli shift', 's1u2.p3'],
    ['period 4 shift 2 unit 3', 's2u3.p4'],
  ])('period: %j -> %s', (said, key) => {
    expect(answer(said, periods)).toBe(key);
  });
});

describe('every phrase built from a real session opens that session', () => {
  const digit = (n: number) => String.fromCodePoint(0x0966 + n); // Devanagari digit
  const cardinals = [['', 'one', 'two', 'three', 'four'], ['', 'ek', 'do', 'teen', 'char'], ['', 'एक', 'दोन', 'तीन', 'चार']];
  const ordinals = [['', 'first', 'second', 'third', 'fourth'], ['', 'pehli', 'doosri', 'teesri', ''], ['', 'पहिली', 'दुसरी', 'तिसरी', 'चौथी'], ['', 'pehla', 'doosra', 'teesra', '']];
  /** "shift 1", "शिफ्ट १", "shift ek": the number after the keyword. */
  const after = (keywords: readonly string[], n: number) => keywords.flatMap((k) => [String(n), digit(n), ...cardinals.map((c) => c[n])].filter(Boolean).map((x) => `${k} ${x}`));
  /** "first shift", "pehli shift", "पहिली शिफ्ट": the number before the keyword. */
  const before = (keywords: readonly string[], n: number) => keywords.flatMap((k) => ordinals.map((o) => o[n]).filter(Boolean).map((x) => `${x} ${k}`));

  type Style = 'after' | 'before' | 'phrase';
  const part = (keywords: readonly string[], n: number, style: Style, phrases: readonly string[] = []) => (style === 'after' ? after(keywords, n) : style === 'before' ? before(keywords, n) : [...phrases]);
  const SHIFT = ['shift', 'शिफ्ट'];
  const UNIT = ['unit', 'युनिट'];
  const HALF = ['half', 'हाफ'];
  const PERIOD = ['period', 'ghanta', 'तासिका', 'पीरियड'];
  const ORDERS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const FILLERS = ['', 'ka', 'wala', 'karo'];

  /** Every order of the three parts and every style (number before or after, per part, mixed freely), a few spellings each. */
  function sweep(list: readonly SessionChoice[], slotWords: (c: SessionChoice) => Record<Style, string[]>, repeats: number) {
    const bad: string[] = [];
    let checked = 0;
    for (const c of list) {
      const slot = slotWords(c);
      for (const order of ORDERS) {
        for (const sStyle of ['after', 'before'] as const) {
          for (const uStyle of ['after', 'before'] as const) {
            for (const kStyle of ['after', 'before', 'phrase'] as const) {
              const pools = [part(SHIFT, c.shift, sStyle), part(UNIT, c.unit, uStyle), slot[kStyle]];
              if (pools.some((p) => p.length === 0)) continue;
              for (let rep = 0; rep < repeats; rep++) {
                const chosen = pools.map((p, i) => p[(rep * 7 + i * 3 + c.shift + c.unit) % p.length]);
                const filler = FILLERS[(rep + order[0]) % FILLERS.length];
                const said = order.map((i) => chosen[i]).join(filler ? ` ${filler} ` : ' ');
                checked++;
                const got = answer(said, list);
                if (got !== c.key) bad.push(`${JSON.stringify(said)} -> ${got} (wanted ${c.key})`);
              }
            }
          }
        }
      }
    }
    return { bad, checked };
  }

  it('twice-daily halves, in every order and mix of styles and languages', () => {
    const { bad, checked } = sweep(
      halves,
      (c) => {
        const p = (c.slot as { part: 1 | 2 }).part;
        return { after: after(HALF, p), before: before(HALF, p), phrase: [...(p === 1 ? FIRST_HALF_PHRASES : SECOND_HALF_PHRASES)] };
      },
      6,
    );
    expect(checked).toBeGreaterThan(5000);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('timetable periods, in every order and mix of styles and languages', () => {
    const { bad, checked } = sweep(
      periods,
      (c) => {
        const n = (c.slot as { periodNo: number }).periodNo;
        return { after: after(PERIOD, n), before: before(PERIOD, n), phrase: [] };
      },
      6,
    );
    expect(checked).toBeGreaterThan(5000);
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('daily sessions, shift and unit in either order and style', () => {
    const bad: string[] = [];
    for (const c of dailies) {
      for (const sStyle of ['after', 'before'] as const) {
        for (const uStyle of ['after', 'before'] as const) {
          for (const swap of [false, true]) {
            const pools = [part(SHIFT, c.shift, sStyle), part(UNIT, c.unit, uStyle)];
            for (let rep = 0; rep < 6; rep++) {
              const chosen = pools.map((p, i) => p[(rep * 5 + i * 3 + c.shift) % p.length]);
              const said = (swap ? [chosen[1], chosen[0]] : chosen).join(' ka ');
              const got = answer(said, dailies);
              if (got !== c.key) bad.push(`${JSON.stringify(said)} -> ${got} (wanted ${c.key})`);
            }
          }
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
});

describe('a phrase that can be read two ways is refused, never guessed', () => {
  it.each([
    // bare numbers beside a slot word: "1 1 half 2" is shift 1 unit 1 half 2, or half 1 with numbers left over
    '1 1 half 2',
    '1 2 half 1',
    'one one half two',
    'ek do ghanta teen',
    '2 3 period 4',
    // a slot word with a number on each side
    'second half 1 2',
    // a keyword said without its number, next to a slot part
    'second half shift 1 unit',
    'shift 1 unit period 3',
    'period 3 shift',
    // a filler between a number and its keyword leaves numbers over: not guessed
    'pehli wali shift doosri wali unit teesra wali period',
    'pehli wali unit doosri wali shift second half',
  ])('%j opens nothing', (said) => {
    // `none`, not an ambiguous list: a list built on one reading of the phrase would carry the wrong sessions.
    for (const list of [halves, periods]) expect(answer(said, list), said).toBe('none');
  });

  it('lets a slot part count when another keyword was said without a number, apart from it', () => {
    // "shift" has no number but nothing is left over, and the filler keeps it apart from "period 3".
    expect(answer('period 3 ka shift', periods)).toBe('ambiguous s1u1.p3 s1u2.p3 s1u3.p3 s2u1.p3 s2u2.p3 s2u3.p3');
    expect(answer('second half ki unit', halves)).toBe('ambiguous s1u1.h2 s1u2.h2 s1u3.h2 s2u1.h2 s2u2.h2 s2u3.h2');
  });

  it('still reads bare numbers when the slot part is complete on its own', () => {
    expect(answer('1 2 first half', halves)).toBe('s1u2.h1');
    expect(answer('2 3 fourth period', periods)).toBe('s2u3.p4');
    expect(answer('period 3 1 2', periods)).toBe('s1u2.p3');
    expect(answer('half 2 1 1', halves)).toBe('s1u1.h2');
  });
});

describe('words that are not about a slot keep the MVP reading (the MVP loop is untouched)', () => {
  it('reads a filler between a number and its keyword as the MVP does, which a per-number rule would flip', () => {
    expect(parseShiftUnit('pehli wali shift doosri unit')).toStrictEqual({ shift: 1, unit: 2 });
    expect(answer('pehli wali shift doosri unit', dailies)).toBe('s1u2.daily');
  });

  it('reads shift and unit around a slot phrase that has no keyword ("subah", "lunch ke baad") with the MVP loop', () => {
    expect(answer('second shift unit 1 lunch ke baad', halves)).toBe('s2u1.h2');
    expect(answer('subah unit 3 first shift', halves)).toBe('s1u3.h1');
    expect(answer('पहिली शिफ्ट दुसरी युनिट दुपारी', halves)).toBe('s1u2.h2');
  });
});

describe('the filler "number" between a keyword and its number is not read as a pairing', () => {
  it.each([
    ['shift number 1 unit 2', { shift: 1, unit: 2 }],
    ['shift number one unit number two', { shift: 1, unit: 2 }],
    ['shift no 1 unit no 2', { shift: 1, unit: 2 }],
    ['shift nambar ek unit nambar do', { shift: 1, unit: 2 }],
    ['शिफ्ट नंबर एक युनिट नंबर दोन', { shift: 1, unit: 2 }],
    ['shift number 2 unit 1', { shift: 2, unit: 1 }],
    ['shift 1 unit number 2', { shift: 1, unit: 2 }],
    ['unit number 2', { unit: 2 }],
  ])('%s', (said, expected) => {
    const read = readSessionWords(said);
    expect(read).toMatchObject(expected);
    if (!('shift' in expected)) expect(read?.shift).toBeUndefined();
    if (!('unit' in expected)) expect(read?.unit).toBeUndefined();
  });

  it('opens the named session, and asks which when only the unit is named', () => {
    expect(answer('shift number 1 unit 2', dailies)).toBe('s1u2.daily');
    expect(answer('shift number 2 unit 1', dailies)).toBe('s2u1.daily');
    expect(answer('unit number 2', [session('s1u2', 1, 2, { kind: 'daily' }), session('s2u2', 2, 2, { kind: 'daily' })])).toBe('ambiguous s1u2 s2u2');
  });

  it('reads the slot phrases the filler used to confuse: "period number 3 shift 1 unit 2"', () => {
    expect(answer('period number 3 shift 1 unit 2', periods)).toBe('s1u2.p3');
    expect(answer('shift 1 unit 2 period number 3', periods)).toBe('s1u2.p3');
    expect(answer('period no 3 shift number 2 unit number 1', periods)).toBe('s2u1.p3');
  });

  it('drops the filler only as a whole word', () => {
    expect(readSessionWords('shift 1 unit 2 nokia')).toMatchObject({ shift: 1, unit: 2 });
  });

  it('reads digit ordinals: "3rd period", "2nd shift 1st unit"', () => {
    expect(readSessionWords('3rd period')).toMatchObject({ period: 3 });
    expect(readSessionWords('2nd shift 1st unit')).toMatchObject({ shift: 2, unit: 1 });
    expect(answer('2nd shift 1st unit', dailies)).toBe('s2u1.daily');
    expect(answer('3rd period shift 1 unit 2', periods)).toBe('s1u2.p3');
  });
});
