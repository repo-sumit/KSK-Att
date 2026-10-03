/**
 * Text primitives of the matching engine: normalising what was said, number words in English, Hindi and
 * Marathi, and edit distance. Pure and stateless. `phrase.ts` and `match.ts` build on it (it imports neither),
 * and `match.ts` re-exports the public ones.
 */

/** Lower case, NFC, no nukta, Devanagari digits as ASCII, punctuation to spaces, single spaces. */
export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/\u{093C}/gu, '') // the nukta (U+093C): letters written with it match their plain forms
    .replace(/[\u{0966}-\u{096F}]/gu, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// -- Numbers ---------------------------------------------------------------------------------------

// A word is matched exactly and before names, so words that are also everyday words or given names stay out
// of the table: pehle, doosre, dusre (before, other), nava, navi (Marathi "new"), chhata, chhati (umbrella,
// chest), satvi, saatvi (given names), and their Devanagari spellings. Both ँ and ं are listed: normalize keeps ँ.
export const NUMBER_WORDS: Readonly<Record<number, readonly string[]>> = {
  1: ['one', 'first', 'ek', 'pehli', 'pahli', 'pehla', 'pahla', 'एक', 'पहली', 'पहला', 'पहिली', 'पहिला'],
  2: ['two', 'second', 'do', 'doosri', 'dusri', 'doosra', 'dusra', 'don', 'दो', 'दूसरी', 'दूसरा', 'दोन', 'दुसरी', 'दुसरा'],
  3: [
    'three', 'third', 'teen', 'teesri', 'tisri', 'teesra', 'तीन', 'तीसरी', 'तीसरा', 'तिसरी', 'तिसरा',
    'tisra', 'teesre', 'tisre', 'तीसरे', 'तिसरे',
  ],
  4: ['four', 'fourth', 'char', 'chaar', 'चार', 'चौथी', 'चौथा', 'chautha', 'chauthi', 'chauthe', 'चौथे'],
  5: [
    'five', 'fifth', 'panch', 'paanch', 'पांच', 'पाँच', 'पाच',
    'paanchva', 'paanchvi', 'paanchvan', 'paanchven', 'panchva', 'panchvi', 'pachva', 'pachvi',
    'पाँचवाँ', 'पाँचवां', 'पाँचवा', 'पाँचवीं', 'पाँचवी', 'पाँचवें',
    'पांचवाँ', 'पांचवां', 'पांचवा', 'पांचवीं', 'पांचवी', 'पांचवें',
    'पाचवा', 'पाचवी', 'पाचवे',
  ],
  6: [
    'six', 'chhe', 'che', 'छह', 'छः', 'सहा',
    'sixth', 'chhatha', 'chhathi', 'chhathe', 'sahava', 'sahavi',
    'छठा', 'छठी', 'छठे', 'छठवाँ', 'छठवां', 'छठवीं', 'छठवें', 'सहावा', 'सहावी', 'सहावे',
  ],
  7: [
    'seven', 'saat', 'सात',
    'seventh', 'saatva', 'saatvan', 'saatven', 'satva',
    'सातवाँ', 'सातवां', 'सातवा', 'सातवीं', 'सातवी', 'सातवें', 'सातवे',
  ],
  8: [
    'eight', 'aath', 'आठ',
    'eighth', 'aathva', 'aathvi', 'aathvan', 'aathven', 'athva', 'athvi',
    'आठवाँ', 'आठवां', 'आठवा', 'आठवीं', 'आठवी', 'आठवें', 'आठवे',
  ],
  9: [
    'nine', 'nau', 'नौ', 'नऊ',
    'ninth', 'nauva', 'nauvi', 'nauvan', 'nauven', 'navva', 'navvi',
    'नौवाँ', 'नौवां', 'नौवा', 'नौवीं', 'नौवी', 'नौवें', 'नववा', 'नववी', 'नववे',
  ],
  10: [
    'ten', 'das', 'दस', 'दहा',
    'tenth', 'dasva', 'dasvi', 'dasvan', 'dasven', 'dahava', 'dahavi',
    'दसवाँ', 'दसवां', 'दसवा', 'दसवीं', 'दसवी', 'दसवें', 'दहावा', 'दहावी', 'दहावे',
  ],
};
const WORD_TO_NUMBER = new Map<string, number>();
for (const [n, words] of Object.entries(NUMBER_WORDS)) for (const w of words) WORD_TO_NUMBER.set(normalize(w), Number(n));

/**
 * A word as a number: digits of any length (Devanagari too), a digit ordinal ("3rd"), or a number word or ordinal in English,
 * Hindi or Marathi. Words and ordinals cover 1 to 10; larger numbers must come as digits.
 */
export function wordNumber(word: string): number | undefined {
  const t = normalize(word);
  if (/^\d+$/.test(t)) return Number(t);
  const ordinal = /^(\d+)(?:st|nd|rd|th)$/.exec(t);
  if (ordinal) return Number(ordinal[1]);
  return WORD_TO_NUMBER.get(t);
}

// -- Edit distance and the tier helpers ----------------------------------------------------------

/** Insertions, deletions and substitutions between two strings, counted in UTF-16 units (one per Devanagari code point). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Both at least 4 characters, at most 1 edit apart, or 2 when the shorter has 8 or more. Inputs are normalised. */
export function near(a: string, b: string): boolean {
  return a.length >= 4 && b.length >= 4 && levenshtein(a, b) <= (Math.min(a.length, b.length) >= 8 ? 2 : 1);
}

/** The phrase appears in the text as whole words. An empty phrase never matches. Inputs are normalised. */
export const hasWords = (text: string, phrase: string) => !!phrase && ` ${text} `.includes(` ${phrase} `);
