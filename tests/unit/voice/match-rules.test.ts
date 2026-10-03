/**
 * The matching engine's rules, beyond the smoke tests in match.test.ts.
 *
 * Part 1 re-runs the MVP's documented vectors (docs/Voice Agent Docs reference/05-executor-and-matching.md
 * section 9) on KSK-shaped data, so the port is pinned to the proven behaviour. Part 2 covers what KSK adds:
 * sessions with halves and periods, trades inside a mixed list, and the app's own labels in both languages.
 */
import { describe, expect, it } from 'vitest';
import { createI18n, localeFor } from '@/i18n';
import { FIRST_HALF_PHRASES, SECOND_HALF_PHRASES, TRADE_ALIASES } from '@/domain/voice/lexicon';
import {
  levenshtein,
  near,
  normalize,
  parseShiftUnit,
  resolveSession,
  resolveStudent,
  resolveTrade,
  wordNumber,
  type Match,
  type SessionChoice,
} from '@/domain/voice/match';

/** The Devanagari nukta (U+093C), the dot under letters like ज and फ. Built from its code point so no invisible character sits in this file. */
const NUKTA = String.fromCodePoint(0x093c);

/** A resolver's answer reduced to ids, so a failure reads clearly. */
const outcome = <T>(m: Match<T>, id: (item: T) => string) =>
  m.kind === 'found' ? { found: id(m.value) } : m.kind === 'ambiguous' ? { ambiguous: m.candidates.map(id) } : ('none' as const);

// ---------------------------------------------------------------------------------------------
// Part 1: the MVP's vectors
// ---------------------------------------------------------------------------------------------

describe('normalize (MVP-05 §9.1)', () => {
  it.each([
    ['  Shift-1, UNIT 2! ', 'shift 1 unit 2'],
    ['Akash Kumar (father: Sunil Yadav)', 'akash kumar father sunil yadav'],
    ['Roll No. 5', 'roll no 5'],
    ['शिफ्ट १', 'शिफ्ट 1'],
    ['०३', '03'],
    ["D'Souza", 'd souza'],
    ['Ram-Lal', 'ram lal'],
    ['S041', 's041'],
    ['', ''],
    ['   ', ''],
    ['?!...', ''],
  ])('%j -> %j', (said, expected) => {
    expect(normalize(said)).toBe(expected);
  });

  it('drops the nukta, composed or not, and keeps vowel signs and the virama', () => {
    expect(normalize(`हाज${NUKTA}िर`)).toBe('हाजिर');
    expect(normalize(String.fromCodePoint(0x095b))).toBe('ज'); // the precomposed letter U+095B decomposes under NFC, then loses its nukta
    expect(normalize('वीजतंत्री')).toBe('वीजतंत्री');
  });
});

describe('wordNumber (MVP-05 §9.2)', () => {
  it.each<[string, number]>([
    ['1', 1], ['one', 1], ['first', 1], ['Pehli', 1], ['एक', 1], ['पहली', 1], ['पहिली', 1],
    ['2', 2], ['two', 2], ['Do', 2], ['doosri', 2], ['दो', 2], ['दूसरी', 2], ['दोन', 2], ['दुसरी', 2], ['second', 2],
    ['teesri', 3], ['तीन', 3], ['तिसरी', 3],
    ['चौथी', 4], ['fourth', 4],
    ['paanch', 5], ['पाच', 5],
    ['छः', 6], ['सहा', 6],
    ['दहा', 10], ['das', 10], ['ten', 10],
    ['12', 12], ['०३', 3], ['१०', 10],
  ])('%j is %i', (word, n) => {
    expect(wordNumber(word)).toBe(n);
  });

  it.each(['eleven', 'eleventh', 'Rahul', '', '   ', 'doosri shift'])('%j is not a number', (word) => {
    expect(wordNumber(word)).toBeUndefined();
  });
});

describe('levenshtein and near (MVP-05 §9.3)', () => {
  it('counts insertions, deletions and substitutions', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
    expect(levenshtein('राहुल', 'राहूल')).toBe(1);
  });

  it('is near for one edit, for two only when the shorter string has 8+ characters, never under 4', () => {
    expect(near('weldar', 'welder')).toBe(true);
    expect(near('fiter', 'fitter')).toBe(true);
    expect(near('imraan', 'imran')).toBe(true);
    expect(near('mechanik diesel', 'mechanic diesel')).toBe(true);
    expect(near('mechanik diesal', 'mechanic diesel')).toBe(true);
    expect(near('electricion', 'electrician')).toBe(true);
    expect(near('rahool', 'rahul')).toBe(false);
    expect(near('puja', 'pooja')).toBe(false);
    expect(near('electrcn', 'electrician')).toBe(false);
    expect(near('abc', 'abd')).toBe(false);
    expect(near('', '')).toBe(false);
  });
});

describe('resolveTrade (MVP-05 §9.4, on the Maharashtra trades)', () => {
  const trades = [
    { id: 'ele', name: 'Electrician' },
    { id: 'fit', name: 'Fitter' },
    { id: 'wel', name: 'Welder' },
    { id: 'copa', name: 'COPA' },
    { id: 'md', name: 'Mechanic Diesel' },
  ];
  const trade = (said: string) => outcome(resolveTrade(said, trades), (t) => t.id);

  it.each([
    // exact id, name or alias
    ['Fitter', 'fit'], ['FIT', 'fit'], ['fit', 'fit'], ['फिटर', 'fit'], [`फ${NUKTA}िटर`, 'fit'], ['जोडारी', 'fit'],
    ['वीजतंत्री', 'ele'], ['विजतंत्री', 'ele'], ['बिजली', 'ele'], ['bijli', 'ele'], ['wireman', 'ele'], ['इलेक्ट्रिशियन', 'ele'],
    ['वेल्डर', 'wel'], ['संधाता', 'wel'], ['sandhata', 'wel'],
    ['COPA', 'copa'], ['computer', 'copa'], ['कोपा', 'copa'],
    ['md', 'md'], ['diesel', 'md'], ['डिझेल', 'md'], ['मेकॅनिक डिझेल', 'md'],
    // the trade named inside a longer sentence (whole words)
    ['fitter karo', 'fit'], ['Fitter wala batch', 'fit'], ['copa trade', 'copa'], ['Shift 1 unit 2 Fitter', 'fit'],
    // near spellings
    ['weldar', 'wel'], ['weldr', 'wel'], ['fittar', 'fit'], ['fiter', 'fit'], ['mechanic diesal', 'md'], ['fittar karo', 'fit'], ['weldar shift 1', 'wel'],
  ])('%j -> %s', (said, id) => {
    expect(trade(said)).toEqual({ found: id });
  });

  it.each(['plumber', 'dijal', 'sangnak', '', '   ', '???'])('%j names no trade', (said) => {
    expect(trade(said)).toBe('none');
  });

  it('reads two trades said at once as ambiguous, in list order', () => {
    expect(trade('fitter welder')).toEqual({ ambiguous: ['fit', 'wel'] });
  });

  it('stops at an ambiguous whole-word tier instead of falling through to a unique fuzzy hit', () => {
    const list = [
      { id: 'a', name: 'Fitter' },
      { id: 'b', name: 'Fitter Mechanic' },
      { id: 'c', name: 'Mechanik' },
    ];
    // "fitter" and "fitter mechanic" are both inside the sentence; "mechanik" is only a near spelling of "mechanic".
    expect(outcome(resolveTrade('fitter mechanic karo', list), (t) => t.id)).toEqual({ ambiguous: ['a', 'b'] });
  });

  it('prefers an exact name over a trade whose name merely contains it', () => {
    const list = [
      { id: 'a', name: 'Fitter' },
      { id: 'b', name: 'Fitter Mechanic' },
    ];
    expect(outcome(resolveTrade('fitter', list), (t) => t.id)).toEqual({ found: 'a' });
  });

  it('does not choke on a trade whose name is an Object property', () => {
    expect(outcome(resolveTrade('constructor', [{ id: 'k', name: 'Constructor' }]), (t) => t.id)).toEqual({ found: 'k' });
  });

  it('knows its alias table: one entry per Maharashtra trade, keyed by the normalised name, no alias shared', () => {
    expect(Object.keys(TRADE_ALIASES)).toEqual(['electrician', 'fitter', 'welder', 'copa', 'mechanic diesel']);
    for (const key of Object.keys(TRADE_ALIASES)) expect(normalize(key)).toBe(key);
    const aliases = Object.values(TRADE_ALIASES).flat().map(normalize);
    expect(aliases.every(Boolean)).toBe(true);
    expect(new Set(aliases).size).toBe(aliases.length);
  });
});

describe('parseShiftUnit (MVP-05 §9.5)', () => {
  it.each<[string, { shift?: number; unit?: number }]>([
    ['shift 1 unit 2', { shift: 1, unit: 2 }],
    ['Shift ek, unit do', { shift: 1, unit: 2 }],
    ['shift one unit two', { shift: 1, unit: 2 }],
    ['sift 1 unit 2', { shift: 1, unit: 2 }],
    ['pehli shift, doosri unit', { shift: 1, unit: 2 }],
    ['first shift second unit', { shift: 1, unit: 2 }],
    ['pehli shift ka doosra unit', { shift: 1, unit: 2 }],
    ['doosri unit, pehli shift', { shift: 1, unit: 2 }],
    ['unit 2 shift 1', { shift: 1, unit: 2 }],
    ['शिफ्ट एक युनिट दोन', { shift: 1, unit: 2 }],
    ['पहिली शिफ्ट दुसरी युनिट', { shift: 1, unit: 2 }],
    ['शिफ्ट १ युनिट २', { shift: 1, unit: 2 }],
    ['1 2', { shift: 1, unit: 2 }],
    ['shift 1 2', { shift: 1, unit: 2 }],
    ['ek do', { shift: 1, unit: 2 }],
    ['Shift 1, Unit 2, Fitter', { shift: 1, unit: 2 }],
    ['shift do unit ek', { shift: 2, unit: 1 }],
    ['unit ek shift do', { shift: 2, unit: 1 }],
    ['unit do', { unit: 2 }],
    ['doosri shift', { shift: 2 }],
    ['shift 2', { shift: 2 }],
    ['2', { shift: 2 }],
    ['second batch', { shift: 2 }],
    ['teesri', { shift: 3 }],
    ['batch 3', { shift: 3 }],
    ['shift 1 unit', { shift: 1 }],
    // The first value per keyword wins, and a surplus number is dropped.
    ['shift 1 unit 2 shift 3', { shift: 1, unit: 2 }],
    ['shift 1 unit 2 3', { shift: 1, unit: 2 }],
    // A number with no keyword on its own side falls back to the keyword on the other side (the MVP's code).
    ['shift ka 1 unit', { unit: 1 }],
    ['2 ka shift 1', { shift: 1, unit: 2 }],
    ['BT202', {}],
    ['', {}],
  ])('%j', (said, expected) => {
    expect(parseShiftUnit(said)).toStrictEqual(expected);
  });
});

describe('resolveSession on daily sessions (MVP-05 §9.6: shift 1 unit 1, shift 1 unit 2, shift 2 unit 1)', () => {
  const F11 = 'fit-s1u1.2026-10-02.daily';
  const F12 = 'fit-s1u2.2026-10-02.daily';
  const F21 = 'fit-s2u1.2026-10-02.daily';
  const fitter: SessionChoice[] = [
    { key: F11, shift: 1, unit: 1, tradeName: 'Fitter', slot: { kind: 'daily' } },
    { key: F12, shift: 1, unit: 2, tradeName: 'Fitter', slot: { kind: 'daily' } },
    { key: F21, shift: 2, unit: 1, tradeName: 'Fitter', slot: { kind: 'daily' } },
  ];
  const pick = (said: string) => outcome(resolveSession(said, fitter), (s) => s.key);

  it.each([
    F12,
    F12.toUpperCase(),
    'Shift 1, Unit 2, Fitter',
    'shift 1 unit 2',
    'pehli shift doosri unit',
    '1 2',
    'शिफ्ट एक युनिट दोन',
    'unit 2',
    'Fitter shift 1 unit 2',
  ])('%j -> shift 1, unit 2', (said) => {
    expect(pick(said)).toEqual({ found: F12 });
  });

  it.each(['doosri shift', 'second', '2', 'the second one', 'shift 2'])('%j -> shift 2, the only one', (said) => {
    expect(pick(said)).toEqual({ found: F21 });
  });

  it('refuses an ambiguous shift or unit and lists the candidates in order', () => {
    expect(pick('shift 1')).toEqual({ ambiguous: [F11, F12] });
    expect(pick('unit 1')).toEqual({ ambiguous: [F11, F21] });
  });

  it.each(['shift 3', 'Fitter', 'BT202', '', '   '])('%j names no session', (said) => {
    expect(pick(said)).toBe('none');
  });

  it('names no session when the phrase names a known trade that none of the offered sessions belongs to', () => {
    const electrician: SessionChoice[] = [
      { key: 'ele-s1u1', shift: 1, unit: 1, tradeName: 'Electrician', slot: { kind: 'daily' } },
      { key: 'ele-s1u2', shift: 1, unit: 2, tradeName: 'Electrician', slot: { kind: 'daily' } },
    ];
    const ask = (said: string) => outcome(resolveSession(said, electrician), (s) => s.key);
    expect(ask('fitter shift 1 unit 2')).toBe('none'); // a Fitter batch is not offered: never open the Electrician one
    expect(ask('जोडारी शिफ्ट 1 युनिट 2')).toBe('none'); // by a spoken alias
    expect(ask('shift 1 unit 2')).toEqual({ found: 'ele-s1u2' });
    expect(ask('electrician shift 1 unit 2')).toEqual({ found: 'ele-s1u2' });
    expect(ask('banana shift 1 unit 2')).toEqual({ found: 'ele-s1u2' }); // an unknown word keeps today's behaviour
  });

  it('returns the caller\'s own object', () => {
    const m = resolveSession('shift 2', fitter);
    expect(m.kind === 'found' && m.value).toBe(fitter[2]);
  });

  it('finds nothing in an empty list', () => {
    expect(resolveSession('shift 1', [])).toEqual({ kind: 'none' });
  });
});

describe('resolveStudent (MVP-05 §9.7, on a roster shaped like the MVP\'s)', () => {
  const roster = [
    { id: 'S041', rollNo: 1, name: 'Rahul Kumar', fatherName: 'Mohan Kumar' },
    { id: 'S042', rollNo: 2, name: 'Shivam Kumar', fatherName: 'Anil Kumar' },
    { id: 'S043', rollNo: 3, name: 'Akash Kumar', fatherName: 'Ramesh Prasad' },
    { id: 'S044', rollNo: 4, name: 'Akash Kumar', fatherName: 'Sunil Yadav' },
    { id: 'S045', rollNo: 5, name: 'Neha Kumari', fatherName: 'Vinod Kumar' },
    { id: 'S046', rollNo: 6, name: 'Amit Raj', fatherName: 'Rajesh Raj' },
    { id: 'S047', rollNo: 7, name: 'Sneha Jadhav', fatherName: 'Prakash Jadhav' },
    { id: 'S048', rollNo: 8, name: 'Vikas Yadav', fatherName: 'Suresh Yadav' },
    { id: 'S049', rollNo: 9, name: 'Imran Ansari', fatherName: 'Salim Ansari' },
    { id: 'S050', rollNo: 10, name: 'Omkar Shinde', fatherName: 'Dilip Shinde' },
    { id: 'S051', rollNo: 11, name: 'Kajal Kumari', fatherName: 'Ravi Kumar' },
    { id: 'S052', rollNo: 12, name: 'Pooja Kumari', fatherName: 'Ajay Kumar' },
  ];
  const student = (said: string) => outcome(resolveStudent(said, roster), (s) => s.id);

  it.each([
    // student id
    ['S041', 'S041'], ['s041', 'S041'],
    // roll number, with or without a prefix, in digits or words
    ['3', 'S043'], ['roll 3', 'S043'], ['teen', 'S043'],
    ['roll number paanch', 'S045'], ['रोल 5', 'S045'], ['नंबर 5', 'S045'], ['रोल नंबर ५', 'S045'],
    ['number 7', 'S047'], ['no 7', 'S047'], ['Roll No. 7', 'S047'],
    ['das', 'S050'], ['ten', 'S050'],
    // name plus father (full or first name of the father)
    ['Akash Kumar, father Sunil Yadav', 'S044'], ['Akash Sunil', 'S044'], ['akash kumar sunil', 'S044'], ['Akash, Sunil Yadav ka beta', 'S044'],
    ['Akash Sunil wala', 'S044'],
    ['Akash Ramesh wala', 'S043'], ['Akash father Ramesh Prasad', 'S043'],
    ['Neha Kumari Vinod', 'S045'],
    // the name tiers
    ['Rahul', 'S041'], ['rahul kumar', 'S041'], ['rahul ko absent karo', 'S041'], ['Neha ji', 'S045'], ['Pooja Kumary', 'S052'], ['Rahul Kumaar', 'S041'],
    // near spellings
    ['Imraan', 'S049'], ['Snehaa', 'S047'], ['Poojaa', 'S052'],
  ])('%j -> %s', (said, id) => {
    expect(student(said)).toEqual({ found: id });
  });

  it.each(['Akash', 'Akash Kumar', 'Akash Yadav', 'Akash Prasad', 'Akash S', 'Akash Kumar father Suresh'])(
    '%j is ambiguous between both Akash Kumar (a father\'s surname or initial does not count)',
    (said) => {
      expect(student(said)).toEqual({ ambiguous: ['S043', 'S044'] });
    },
  );

  it('keeps roster order for two names in one argument', () => {
    expect(student('Shivam aur Rahul')).toEqual({ ambiguous: ['S041', 'S042'] });
  });

  it('accepts a whole name that is near a long full name, though its first word alone is too far', () => {
    // "Rahool" alone is two edits from "Rahul", too far (the second assertion). "Rahool Kumar" is two edits from
    // "Rahul Kumar", a full name long enough to allow two.
    expect(student('Rahool Kumar')).toEqual({ found: 'S041' });
    expect(student('Rahool')).toBe('none');
  });

  it('counts an item listed twice once', () => {
    expect(resolveStudent('Rahul', [roster[0], roster[0]])).toEqual({ kind: 'found', value: roster[0] });
  });

  it.each(['Kumar', 'Kumari', 'Sunil', 'Ramesh', 'Rahool', 'Puja', 'Zorawar', '13', 'roll 13', '', '   ', '...'])(
    '%j names nobody (surnames and fathers alone, too far, no such roll)',
    (said) => {
      expect(student(said)).toBe('none');
    },
  );

  it('lets an exact tier with several hits stop the search: never falls through to a unique fuzzy hit', () => {
    const list = [
      { id: 'a', rollNo: 1, name: 'Akash Kumar', fatherName: 'Ramesh Prasad' },
      { id: 'b', rollNo: 2, name: 'Akash Kumar', fatherName: 'Sunil Yadav' },
      { id: 'c', rollNo: 3, name: 'Akaash Kumar', fatherName: 'Mohan Kumar' },
    ];
    expect(outcome(resolveStudent('Akash Kumar', list), (s) => s.id)).toEqual({ ambiguous: ['a', 'b'] });
    expect(outcome(resolveStudent('Akaash Kumar', list), (s) => s.id)).toEqual({ found: 'c' });
  });

  it('prefers an exact full name over a student whose shorter name it contains', () => {
    const list = [
      { id: 'a', rollNo: 1, name: 'Akash', fatherName: 'Ramesh Prasad' },
      { id: 'b', rollNo: 2, name: 'Akash Kumar', fatherName: 'Sunil Yadav' },
    ];
    expect(outcome(resolveStudent('Akash Kumar', list), (s) => s.id)).toEqual({ found: 'b' });
    expect(outcome(resolveStudent('Akash', list), (s) => s.id)).toEqual({ found: 'a' });
  });

  it('prefers a full name said inside a sentence over a namesake who shares only the first name', () => {
    const list = [
      { id: 'a', rollNo: 1, name: 'Akash Kumar', fatherName: 'Ramesh Prasad' },
      { id: 'b', rollNo: 2, name: 'Akash Yadav', fatherName: 'Sunil Yadav' },
    ];
    expect(outcome(resolveStudent('Akash Kumar ko absent karo', list), (s) => s.id)).toEqual({ found: 'a' });
    expect(outcome(resolveStudent('Akash ko absent karo', list), (s) => s.id)).toEqual({ ambiguous: ['a', 'b'] });
  });

  it('counts the father only when he leaves exactly one student, otherwise goes on with the name', () => {
    const list = [
      { id: 'a', rollNo: 1, name: 'Akash Kumar', fatherName: 'Sunil Yadav' },
      { id: 'b', rollNo: 2, name: 'Akash Kumar', fatherName: 'Sunil Pawar' },
      { id: 'c', rollNo: 3, name: 'Akash Kumar', fatherName: 'Ramesh Prasad' },
    ];
    // "Sunil" fits two fathers, so it does not narrow: all three Akash Kumar stay candidates (MVP-05 §9.7 step 3).
    expect(outcome(resolveStudent('Akash Sunil', list), (s) => s.id)).toEqual({ ambiguous: ['a', 'b', 'c'] });
    // One father fits: found.
    expect(outcome(resolveStudent('Akash Ramesh', list), (s) => s.id)).toEqual({ found: 'c' });
  });

  it('never picks the first of two students who share a roll number', () => {
    const list = [
      { id: 'p', rollNo: 5, name: 'Pavan Rao', fatherName: 'Ravi Rao' },
      { id: 'q', rollNo: 5, name: 'Qadir Khan', fatherName: 'Salim Khan' },
    ];
    expect(outcome(resolveStudent('roll 5', list), (s) => s.id)).toEqual({ ambiguous: ['p', 'q'] });
  });

  it('copes with a blank father name or a blank name', () => {
    const list = [
      { id: 'x', rollNo: 1, name: 'Rahul Kumar', fatherName: '' },
      { id: 'y', rollNo: 2, name: '', fatherName: '' },
    ];
    expect(outcome(resolveStudent('Rahul', list), (s) => s.id)).toEqual({ found: 'x' });
    expect(outcome(resolveStudent('Rahul Mohan', list), (s) => s.id)).toEqual({ found: 'x' });
  });

  it('returns the caller\'s own objects', () => {
    const m = resolveStudent('Rahul', roster);
    expect(m.kind === 'found' && m.value).toBe(roster[0]);
    const both = resolveStudent('Akash', roster);
    expect(both.kind === 'ambiguous' && both.candidates).toEqual([roster[2], roster[3]]);
  });
});

describe('resolveStudent with names stored in Devanagari (father names are compared in their stored script)', () => {
  const marathi = [
    { id: 'm1', rollNo: 1, name: 'आकाश कुमार', fatherName: 'Ramesh Prasad' },
    { id: 'm2', rollNo: 2, name: 'आकाश कुमार', fatherName: 'सुनील यादव' },
    { id: 'm3', rollNo: 3, name: 'राहुल कुमार', fatherName: 'Mohan Kumar' },
  ];
  const student = (said: string) => outcome(resolveStudent(said, marathi), (s) => s.id);

  it('finds a Devanagari name, whole or first, and a near spelling of it', () => {
    expect(student('राहुल')).toEqual({ found: 'm3' });
    expect(student('राहुल कुमार')).toEqual({ found: 'm3' });
    expect(student('राहूल')).toEqual({ found: 'm3' });
  });

  it('asks which Akash when the father is not said in the script he is stored in', () => {
    expect(student('आकाश')).toEqual({ ambiguous: ['m1', 'm2'] });
    expect(student('आकाश रमेश')).toEqual({ ambiguous: ['m1', 'm2'] });
  });

  it('uses a father name that is stored in Devanagari', () => {
    expect(student('आकाश सुनील')).toEqual({ found: 'm2' });
  });

  it('does not transliterate: Latin speech finds no Devanagari name', () => {
    expect(student('Akash Ramesh')).toBe('none');
  });
});

// ---------------------------------------------------------------------------------------------
// Part 2: what KSK adds
// ---------------------------------------------------------------------------------------------

type Slot = SessionChoice['slot'];
const half = (part: 1 | 2): Slot => ({ kind: 'half', part });
const period = (periodNo: number): Slot => ({ kind: 'period', periodNo });
const session = (key: string, shift: number, unit: number, tradeName: string, slot: Slot = { kind: 'daily' }): SessionChoice => ({ key, shift, unit, tradeName, slot });

describe('resolveSession on a mixed list: the trade word picks between trades', () => {
  const mixed = [
    session('ele-s1u1', 1, 1, 'Electrician'),
    session('ele-s1u2', 1, 2, 'Electrician'),
    session('fit-s1u1', 1, 1, 'Fitter'),
    session('fit-s2u1', 2, 1, 'Fitter'),
  ];
  const pick = (said: string) => outcome(resolveSession(said, mixed), (s) => s.key);

  it('stays ambiguous across trades until the trade is said', () => {
    expect(pick('shift 1 unit 1')).toEqual({ ambiguous: ['ele-s1u1', 'fit-s1u1'] });
    expect(pick('shift 1')).toEqual({ ambiguous: ['ele-s1u1', 'ele-s1u2', 'fit-s1u1'] });
  });

  it.each([
    ['Fitter shift 1 unit 1', 'fit-s1u1'],
    ['shift 1 unit 1 fitter', 'fit-s1u1'],
    ['second shift fitter', 'fit-s2u1'],
    ['Shift 1, Unit 1, Fitter', 'fit-s1u1'],
    ['Electrician shift 1 unit 2', 'ele-s1u2'],
    ['वीजतंत्री शिफ्ट 1 युनिट 2', 'ele-s1u2'],
    ['जोडारी शिफ्ट २', 'fit-s2u1'],
    ['fiter shift 2', 'fit-s2u1'],
    ['fiter shift 1 unit 1', 'fit-s1u1'],
  ])('%j -> %s', (said, key) => {
    expect(pick(said)).toEqual({ found: key });
  });

  it('lets the trade alone narrow the list', () => {
    expect(pick('Fitter')).toEqual({ ambiguous: ['fit-s1u1', 'fit-s2u1'] });
  });

  it('does not let a trade word hide a shift that the trade does not have', () => {
    expect(pick('Electrician shift 2')).toBe('none');
  });

  it('reads the label exactly even when one trade name contains another', () => {
    const nested = [session('ele-s1u1', 1, 1, 'Electrician'), session('epd-s1u1', 1, 1, 'Electrician Power Distribution')];
    const label = (said: string) => outcome(resolveSession(said, nested), (s) => s.key);
    expect(label('Shift 1, Unit 1, Electrician Power Distribution')).toEqual({ found: 'epd-s1u1' });
    expect(label('Shift 1, Unit 1, Electrician')).toEqual({ found: 'ele-s1u1' });
  });
});

describe('resolveSession on halves (twice-daily marking, and sign in / sign out)', () => {
  const halves = [
    session('a.h1', 1, 1, 'Electrician', half(1)),
    session('a.h2', 1, 1, 'Electrician', half(2)),
    session('b.h1', 1, 2, 'Electrician', half(1)),
    session('b.h2', 1, 2, 'Electrician', half(2)),
    session('c.h1', 2, 1, 'Electrician', half(1)),
    session('c.h2', 2, 1, 'Electrician', half(2)),
  ];
  const pick = (said: string) => outcome(resolveSession(said, halves), (s) => s.key);

  it.each([...FIRST_HALF_PHRASES, 'first half', 'पहिला हाफ'])('%j names the first half', (words) => {
    expect(pick(`shift 2 ${words}`)).toEqual({ found: 'c.h1' });
  });

  it.each([...SECOND_HALF_PHRASES, 'second half', 'दुसरा हाफ'])('%j names the second half', (words) => {
    expect(pick(`shift 2 ${words}`)).toEqual({ found: 'c.h2' });
  });

  it('knows the half words the brief lists, in English, Hindi and Marathi', () => {
    for (const w of ['pehla half', 'subah', 'morning', 'sakali', 'सकाळी', 'sign in']) expect(FIRST_HALF_PHRASES).toContain(w);
    for (const w of ['doosra half', 'lunch ke baad', 'after lunch', 'dupari', 'दुपारी', 'sign out']) expect(SECOND_HALF_PHRASES).toContain(w);
    const first = new Set(FIRST_HALF_PHRASES.map(normalize));
    expect(SECOND_HALF_PHRASES.map(normalize).filter((p) => first.has(p))).toEqual([]);
  });

  it('leaves one candidate per batch when only a half is said', () => {
    expect(pick('second half')).toEqual({ ambiguous: ['a.h2', 'b.h2', 'c.h2'] });
    expect(pick('lunch ke baad')).toEqual({ ambiguous: ['a.h2', 'b.h2', 'c.h2'] });
  });

  it('reads the half in either word order, mixed with shift and unit in another language', () => {
    expect(pick('pehli shift doosri unit lunch ke baad')).toEqual({ found: 'b.h2' });
    expect(pick('unit 2 half 2')).toEqual({ found: 'b.h2' });
    expect(pick('shift 1 half 2')).toEqual({ ambiguous: ['a.h2', 'b.h2'] });
    expect(pick('doosra half shift 2')).toEqual({ found: 'c.h2' });
    expect(pick('pehli shift doosra half')).toEqual({ ambiguous: ['a.h2', 'b.h2'] });
    expect(pick('shift 1 unit 1 subah')).toEqual({ found: 'a.h1' });
  });

  it('does not read the number inside "pehla half" or "first half" as a shift', () => {
    expect(pick('pehla half')).toEqual({ ambiguous: ['a.h1', 'b.h1', 'c.h1'] });
    expect(pick('first half')).toEqual({ ambiguous: ['a.h1', 'b.h1', 'c.h1'] });
  });

  it('treats two different halves in one sentence as no half at all, so the batch stays ambiguous', () => {
    expect(pick('morning ya after lunch shift 1')).toEqual({ ambiguous: ['a.h1', 'a.h2', 'b.h1', 'b.h2'] });
  });

  it('reads the label with its half', () => {
    expect(pick('Shift 1, Unit 1, Electrician')).toEqual({ ambiguous: ['a.h1', 'a.h2'] });
    expect(pick('Shift 1, Unit 1, Electrician, Second half')).toEqual({ found: 'a.h2' });
  });

  it('never silently drops a slot the sessions do not have', () => {
    expect(pick('period 3')).toBe('none');
    expect(pick('half 3')).toBe('none');
    const daily = [session('d1', 1, 1, 'Electrician'), session('d2', 1, 2, 'Electrician')];
    expect(resolveSession('second half', daily)).toEqual({ kind: 'none' });
  });
});

describe('resolveSession on periods (timetable marking)', () => {
  const periods = [
    session('x.p2', 1, 1, 'Electrician', period(2)),
    session('x.p3', 1, 1, 'Electrician', period(3)),
    session('y.p3', 1, 2, 'Electrician', period(3)),
  ];
  const pick = (said: string) => outcome(resolveSession(said, periods), (s) => s.key);

  it.each(['period 3', 'Period 3', 'ghanta 3', 'तास ३', 'तासिका 3', 'पीरियड 3', 'teesra period', 'तिसरी तासिका', 'third period'])('%j -> period 3', (said) => {
    expect(pick(said)).toEqual({ ambiguous: ['x.p3', 'y.p3'] });
  });

  it('narrows by batch, in either word order and language', () => {
    expect(pick('period 3 unit 2')).toEqual({ found: 'y.p3' });
    expect(pick('unit 2 period 3')).toEqual({ found: 'y.p3' });
    expect(pick('teesra ghanta unit 2')).toEqual({ found: 'y.p3' });
    expect(pick('shift 1 period 2')).toEqual({ found: 'x.p2' });
    expect(pick('period 2')).toEqual({ found: 'x.p2' });
    expect(pick('Shift 1, Unit 2, Electrician, Period 3')).toEqual({ found: 'y.p3' });
  });

  it('finds the only session of a batch without the period being said', () => {
    expect(pick('unit 2')).toEqual({ found: 'y.p3' });
  });

  it('finds nothing for a period that is not on the list', () => {
    expect(pick('period 7')).toBe('none');
  });

  it('keeps the MVP rule that a lone number is a shift, never a period', () => {
    expect(pick('3')).toBe('none');
  });
});

describe("the app's own session labels, in both languages (what the model reads out and the trainer repeats)", () => {
  const languages = [
    ['English', createI18n('en', localeFor('en', 'locale'))],
    ['Marathi with Devanagari digits', createI18n('mr', localeFor('mr', 'locale'))],
    ['Marathi with Latin digits', createI18n('mr', localeFor('mr', 'latin'))],
  ] as const;

  const mixed = [session('ele-s1u2', 1, 2, 'Electrician'), session('fit-s1u1', 1, 1, 'Fitter'), session('fit-s2u1', 2, 1, 'Fitter')];
  const halves = [
    session('a.h1', 1, 1, 'Electrician', half(1)),
    session('a.h2', 1, 1, 'Electrician', half(2)),
    session('b.h1', 2, 1, 'Electrician', half(1)),
    session('b.h2', 2, 1, 'Electrician', half(2)),
  ];
  const periods = [session('x.p2', 1, 1, 'Electrician', period(2)), session('x.p3', 1, 1, 'Electrician', period(3)), session('y.p3', 1, 2, 'Electrician', period(3))];
  const keys = (said: string, list: readonly SessionChoice[]) => outcome(resolveSession(said, list), (s) => s.key);

  describe.each(languages)('%s', (_name, { t }) => {
    it('daily batches, with and without the trade', () => {
      expect(keys(t('session.batchWithTrade', { trade: 'Fitter', shift: 2, unit: 1 }), mixed)).toEqual({ found: 'fit-s2u1' });
      expect(keys(t('session.batchWithTrade', { trade: 'Electrician', shift: 1, unit: 2 }), mixed)).toEqual({ found: 'ele-s1u2' });
      expect(keys(t('session.batch', { shift: 2, unit: 1 }), mixed)).toEqual({ found: 'fit-s2u1' });
    });

    it('first half, second half, sign in and sign out', () => {
      const batch = t('session.batch', { shift: 2, unit: 1 });
      expect(keys(`${batch} ${t('session.halfFirst')}`, halves)).toEqual({ found: 'b.h1' });
      expect(keys(`${batch} ${t('session.halfSecond')}`, halves)).toEqual({ found: 'b.h2' });
      expect(keys(`${batch} ${t('session.signIn')}`, halves)).toEqual({ found: 'b.h1' });
      expect(keys(`${batch} ${t('session.signOut')}`, halves)).toEqual({ found: 'b.h2' });
      expect(keys(t('session.halfSecond'), halves)).toEqual({ ambiguous: ['a.h2', 'b.h2'] });
    });

    it('periods', () => {
      expect(keys(t('session.period', { n: 3 }), periods)).toEqual({ ambiguous: ['x.p3', 'y.p3'] });
      expect(keys(`${t('session.batch', { shift: 1, unit: 2 })} ${t('session.period', { n: 3 })}`, periods)).toEqual({ found: 'y.p3' });
    });
  });
});
