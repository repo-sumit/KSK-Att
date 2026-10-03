/**
 * Ordinals to ten in English, Hindi and Marathi: the matcher's number vocabulary (text.ts `NUMBER_WORDS`) and
 * what every consumer reads through it (session words, roll numbers).
 */
import { describe, expect, it } from 'vitest';
import { HALF_WORDS, PERIOD_WORDS, SHIFT_WORDS, UNIT_WORDS } from '@/domain/voice/lexicon';
import { resolveStudent } from '@/domain/voice/match';
import { readSessionWords } from '@/domain/voice/phrase';
import { NUMBER_WORDS, normalize, wordNumber } from '@/domain/voice/text';

const ADDED: Readonly<Record<number, readonly string[]>> = {
  3: ['tisra', 'teesre', 'tisre', 'तीसरे', 'तिसरे'],
  4: ['chautha', 'chauthi', 'chauthe', 'चौथे'],
  5: [
    'paanchva', 'paanchvi', 'paanchvan', 'paanchven', 'panchva', 'panchvi', 'pachva', 'pachvi',
    'पाँचवाँ', 'पाँचवां', 'पाँचवा', 'पाँचवीं', 'पाँचवी', 'पाँचवें',
    'पांचवाँ', 'पांचवां', 'पांचवा', 'पांचवीं', 'पांचवी', 'पांचवें',
    'पाचवा', 'पाचवी', 'पाचवे',
  ],
  6: ['sixth', 'chhatha', 'chhathi', 'chhathe', 'sahava', 'sahavi', 'छठा', 'छठी', 'छठे', 'छठवाँ', 'छठवां', 'छठवीं', 'छठवें', 'सहावा', 'सहावी', 'सहावे'],
  7: ['seventh', 'saatva', 'saatvan', 'saatven', 'satva', 'सातवाँ', 'सातवां', 'सातवा', 'सातवीं', 'सातवी', 'सातवें', 'सातवे'],
  8: ['eighth', 'aathva', 'aathvi', 'aathvan', 'aathven', 'athva', 'athvi', 'आठवाँ', 'आठवां', 'आठवा', 'आठवीं', 'आठवी', 'आठवें', 'आठवे'],
  9: ['ninth', 'nauva', 'nauvi', 'nauvan', 'nauven', 'navva', 'navvi', 'नौवाँ', 'नौवां', 'नौवा', 'नौवीं', 'नौवी', 'नौवें', 'नववा', 'नववी', 'नववे'],
  10: ['tenth', 'dasva', 'dasvi', 'dasvan', 'dasven', 'dahava', 'dahavi', 'दसवाँ', 'दसवां', 'दसवा', 'दसवीं', 'दसवी', 'दसवें', 'दहावा', 'दहावी', 'दहावे'],
};

const ADDED_ROWS = Object.entries(ADDED).flatMap(([n, words]) => words.map((w): [string, number] => [w, Number(n)]));

/** Everyday words and given names that must not read as numbers. */
const LEFT_OUT = [
  'pehle', 'पहले', 'पहिले', 'doosre', 'dusre', 'दूसरे', 'दुसरे',
  'nava', 'navi', 'नवा', 'नवी', 'नवे', 'chhata', 'chhati', 'satvi', 'saatvi',
];

describe('number words: ordinals to ten', () => {
  it.each(ADDED_ROWS)('%s is %i', (word, n) => {
    expect(wordNumber(word)).toBe(n);
  });

  it.each([['1st', 1], ['2nd', 2], ['3rd', 3], ['4th', 4], ['10th', 10], ['3RD', 3], ['१ला', undefined]] as const)('digit ordinal %s is %s', (word, n) => {
    expect(wordNumber(word)).toBe(n);
  });

  it.each(['rd', 'th3', '3rdx', 'st1'])('%s is not a digit ordinal', (word) => {
    expect(wordNumber(word)).toBeUndefined();
  });

  it.each(LEFT_OUT)('%s stays unmapped', (word) => {
    expect(wordNumber(word)).toBeUndefined();
  });

  it('maps no word to two numbers', () => {
    const seen = new Map<string, number>();
    const clashes: string[] = [];
    for (const [n, words] of Object.entries(NUMBER_WORDS)) {
      for (const w of words) {
        const key = normalize(w);
        const earlier = seen.get(key);
        if (earlier !== undefined && earlier !== Number(n)) clashes.push(`${key}: ${earlier} and ${n}`);
        seen.set(key, Number(n));
      }
    }
    expect(clashes).toEqual([]);
  });

  it('has no number word that is also a shift, unit, half or period keyword', () => {
    const keywords = new Set([...SHIFT_WORDS, ...UNIT_WORDS, ...HALF_WORDS, ...PERIOD_WORDS].map(normalize));
    const shared = Object.values(NUMBER_WORDS).flatMap((words) => words.map(normalize).filter((w) => keywords.has(w)));
    expect(shared).toEqual([]);
  });
});

describe('spoken periods read as numbers', () => {
  it.each<[string, { shift?: number; unit?: number; period: number }]>([
    ['seventh period', { period: 7 }],
    ['सातवी तासिका', { period: 7 }],
    ['saatva ghanta', { period: 7 }],
    ['सातवें पीरियड', { period: 7 }],
    ['sixth period', { period: 6 }],
    ['छठा पीरियड', { period: 6 }],
    ['eighth period', { period: 8 }],
    ['आठवा तास', { period: 8 }],
    ['nauva period', { period: 9 }],
    ['नववी तासिका', { period: 9 }],
    ['tenth period', { period: 10 }],
    ['दहावी तासिका', { period: 10 }],
    ['chautha period', { period: 4 }],
    ['चौथे पीरियड', { period: 4 }],
    ['shift 1 unit 2 dasva period', { shift: 1, unit: 2, period: 10 }],
    ['teesre period shift 2 unit 1', { shift: 2, unit: 1, period: 3 }],
  ])('%s', (said, expected) => {
    const read = readSessionWords(said);
    expect(read).toMatchObject(expected);
    expect(read?.half).toBeUndefined();
  });
});

describe('shift and unit ordinals', () => {
  it.each<[string, { shift?: number; unit?: number }]>([
    ['तिसरे युनिट पहिली शिफ्ट', { shift: 1, unit: 3 }],
    ['पाचवे युनिट', { unit: 5 }],
    ['chauthi shift', { shift: 4 }],
  ])('%s', (said, expected) => {
    const read = readSessionWords(said);
    expect(read).toMatchObject(expected);
    expect(read?.half).toBeUndefined();
    expect(read?.period).toBeUndefined();
  });
});

describe('roll numbers by ordinal', () => {
  const roster = [
    { id: 's6', rollNo: 6, name: 'Aarav Pawar', fatherName: 'Sunil Pawar' },
    { id: 's7', rollNo: 7, name: 'Akash Kumar', fatherName: 'Ramesh Prasad' },
    { id: 's10', rollNo: 10, name: 'Rahul Kumar', fatherName: 'Mohan Kumar' },
  ];

  it.each<[string, string]>([
    ['number saatva', 's7'],
    ['dasva', 's10'],
    ['sixth', 's6'],
  ])('%s', (said, id) => {
    const m = resolveStudent(said, roster);
    expect(m.kind).toBe('found');
    if (m.kind === 'found') expect(m.value.id).toBe(id);
  });
});
