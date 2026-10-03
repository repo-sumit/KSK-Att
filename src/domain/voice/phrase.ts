/**
 * Reading the numbers in a spoken session phrase: "shift 1 unit 2", "pehli shift doosri unit", and, with a slot,
 * "second half shift 1 unit 2", "teesra period shift 1 unit 2".
 *
 * Hindi and Marathi put the number before its keyword ("pehli shift"), English after ("shift 1"), and a trainer
 * mixes both in one sentence. There are two readers, because one direction chosen for the whole phrase serves two
 * keywords but not three or four: an ordinal before one keyword ("second half") must not turn around the digits
 * that follow the others ("shift 1 unit 2").
 *
 *  - `parseShiftUnit` is the MVP's loop, verbatim, and reads every phrase without a half or period word. Those
 *    phrases read exactly as they did in the MVP, quirks included.
 *  - The slot reader reads the phrases that contain a half or period word. Each number goes to the keyword it
 *    stands next to that has no number yet, the one before it first, so "unit 1 period 3" cannot swap its numbers
 *    whatever else the phrase says. When the words can be paired two ways it answers `null` instead of guessing,
 *    and the session is not opened.
 */
import { FIRST_HALF_PHRASES, HALF_WORDS, PERIOD_WORDS, SECOND_HALF_PHRASES, SHIFT_WORDS, UNIT_WORDS } from './lexicon';
import { hasWords, normalize, wordNumber } from './text';

// -- The MVP's loop --------------------------------------------------------------------------------

const SHIFT = SHIFT_WORDS.map(normalize);
const UNIT = UNIT_WORDS.map(normalize);

/**
 * Reads "shift 1 unit 2", "pehli shift doosri unit", "shift ek, unit do", "1 2". A lone number or ordinal is a
 * shift, never a position in a list: "the second one" means shift 2. The MVP's loop, verbatim (MVP-05 L1428).
 */
export function parseShiftUnit(text: string): { shift?: number; unit?: number } {
  const tokens = normalize(text).split(' ');
  const keyword = (t: string | undefined) => (t && SHIFT.includes(t) ? 'shift' : t && UNIT.includes(t) ? 'unit' : null);
  // Hindi and Marathi put the number first ("pehli shift"), English after ("shift 1"). A number between two
  // keywords ("pehli shift doosri unit") belongs to the keyword on the phrase's side.
  const firstNumber = tokens.findIndex((t) => wordNumber(t) !== undefined);
  const firstKeyword = tokens.findIndex((t) => keyword(t) !== null);
  const numberFirst = firstNumber !== -1 && (firstKeyword === -1 || firstNumber < firstKeyword);
  const out: { shift?: number; unit?: number } = {};
  const loose: number[] = [];
  tokens.forEach((tok, i) => {
    const n = wordNumber(tok);
    if (n === undefined) return;
    const before = keyword(tokens[i - 1]);
    const after = keyword(tokens[i + 1]);
    const kw = numberFirst ? (after ?? before) : (before ?? after);
    if (kw === 'shift' && out.shift === undefined) out.shift = n;
    else if (kw === 'unit' && out.unit === undefined) out.unit = n;
    else loose.push(n);
  });
  if (out.shift === undefined && loose.length) out.shift = loose.shift();
  if (out.unit === undefined && loose.length) out.unit = loose.shift();
  return out;
}

// -- The slot reader -------------------------------------------------------------------------------

type Keyword = 'shift' | 'unit' | 'half' | 'period';
type Numbers = Partial<Record<Keyword, number>>;

const KEYWORD_OF = new Map<string, Keyword>();
for (const [keyword, words] of [['shift', SHIFT_WORDS], ['unit', UNIT_WORDS], ['half', HALF_WORDS], ['period', PERIOD_WORDS]] as const) {
  for (const w of words) KEYWORD_OF.set(normalize(w), keyword);
}

/**
 * Pairs each number with the keyword it stands next to, in the order said. A keyword takes one number, so a
 * number between two keywords goes to the one before it, unless that already has one ("pehli shift doosri unit":
 * "doosri" has "shift" before it, but "pehli" took it, so "doosri" goes to "unit"). Numbers with no keyword beside
 * them are loose: the first fills the shift and the next the unit, as in the MVP ("1 2 first half").
 *
 * It answers `null`, because the pairing is not forced, when
 *  - a run of keywords and numbers standing side by side starts and ends with the same kind ("shift 1 unit",
 *    "2 period 3"): one keyword has no number, or one number has no keyword, and either could be the odd one; or
 *  - a number is left over while a keyword has none ("pehli wali shift doosri wali unit"): a filler sits between
 *    a number and its keyword and the numbers cannot be told apart.
 */
function readAroundSlots(tokens: readonly string[], keywords: readonly (Keyword | undefined)[]): Numbers | null {
  const numbers = tokens.map((t) => wordNumber(t));
  const out: Numbers = {};
  const paired = new Set<number>();
  const loose: number[] = [];
  const free = (i: number) => {
    const keyword = keywords[i];
    return keyword !== undefined && out[keyword] === undefined;
  };
  numbers.forEach((n, i) => {
    if (n === undefined) return;
    const at = free(i - 1) ? i - 1 : free(i + 1) ? i + 1 : -1;
    const keyword = at === -1 ? undefined : keywords[at];
    if (keyword === undefined) {
      loose.push(n);
    } else {
      out[keyword] = n;
      paired.add(at);
    }
  });

  // Runs of keywords (K) and numbers (N) side by side. An odd run of three or more has one extra keyword or number.
  const kinds = tokens.map((_, i) => (keywords[i] ? 'K' : numbers[i] !== undefined ? 'N' : 'O'));
  let run = 0;
  let twoWays = false;
  const endRun = () => {
    if (run >= 3 && run % 2 === 1) twoWays = true;
    run = 0;
  };
  kinds.forEach((kind, i) => {
    if (kind === 'O' || kind === kinds[i - 1]) endRun();
    if (kind !== 'O') run++;
  });
  endRun();

  const keywordWithoutNumber = keywords.some((k, i) => k !== undefined && !paired.has(i));
  if (twoWays || (keywordWithoutNumber && loose.length > 0)) return null;

  if (out.shift === undefined && loose.length) out.shift = loose.shift();
  if (out.unit === undefined && loose.length) out.unit = loose.shift();
  return out;
}

/** The filler a trainer puts between a keyword and its number: "shift number 1", "unit no 2", "शिफ्ट नंबर १". */
const NUMBER_FILLER = new Set(['number', 'no', 'num', 'nambar', 'nambr', 'नंबर', 'क्रमांक'].map(normalize));

const FIRST_HALF = FIRST_HALF_PHRASES.map(normalize);
const SECOND_HALF = SECOND_HALF_PHRASES.map(normalize);

export interface SessionWords {
  readonly shift?: number;
  readonly unit?: number;
  readonly half?: number;
  readonly period?: number;
}

/**
 * The shift, unit, half and period a phrase names, or `null` when its words can be read more than one way.
 * A phrase with a half or period word goes to the slot reader, every other phrase to the MVP's loop. A half is also
 * named without the word "half" ("subah", "lunch ke baad", "sign out"); two different halves in one sentence cancel
 * out, so the batch stays ambiguous and the model asks which.
 */
export function readSessionWords(text: string): SessionWords | null {
  const q = normalize(text);
  // "shift number 1 unit number 2": the filler "number" sits between a keyword and its number and must not pair
  // the number with the keyword after it. Neither reader sees it (as a whole token only; "no" in "nokia" stays).
  const tokens = q.split(' ').filter((t) => !NUMBER_FILLER.has(t));
  const said = tokens.join(' ');
  const keywords = tokens.map((t) => KEYWORD_OF.get(t));
  const numbers: Numbers | null = keywords.some((k) => k === 'half' || k === 'period') ? readAroundSlots(tokens, keywords) : parseShiftUnit(said);
  if (!numbers) return null;
  const halves = new Set<number>(numbers.half === undefined ? [] : [numbers.half]);
  if (FIRST_HALF.some((p) => hasWords(q, p))) halves.add(1);
  if (SECOND_HALF.some((p) => hasWords(q, p))) halves.add(2);
  return { shift: numbers.shift, unit: numbers.unit, period: numbers.period, half: halves.size === 1 ? [...halves][0] : undefined };
}
