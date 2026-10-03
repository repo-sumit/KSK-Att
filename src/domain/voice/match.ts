/**
 * The matching engine: what the trainer said -> one trade, session or student, several candidates, or
 * nothing. The model never matches names itself. It passes what it heard ("वीजतंत्री", "pehli shift doosri
 * unit", "Akash Sunil wala", "das") and the app resolves it here. Pure and stateless: no clock, no
 * storage, no framework.
 *
 * Ported from the MVP's match.ts (docs/Voice Agent Docs reference/05-executor-and-matching.md section 9),
 * with its batch resolver generalised to a SESSION: a batch on a date in a slot (daily, a half, or a
 * timetable period). The MVP's rules stay:
 *  - The first tier with a hit wins. A tier with several hits is `ambiguous` and stops the search, so an
 *    ambiguous exact match never falls through to a unique fuzzy one.
 *  - A lone number is a shift for sessions and a roll number for students.
 *  - Fuzzy matching is tight (`near`): "Rahool" is not "Rahul".
 *  - Father names are compared as stored: there is no transliteration.
 * Where things live: the spoken vocabulary (trade aliases, shift, unit, half and period words) in lexicon.ts,
 * the text primitives (normalising, number words, edit distance) in text.ts, and the reading of the numbers in
 * a shift, unit, half or period phrase in phrase.ts. The public ones are re-exported here, so callers import
 * the whole engine from this module.
 */
import type { MarkingSlot } from '@/domain/attendance';
import { TRADE_ALIASES } from './lexicon';
import { parseShiftUnit, readSessionWords, type SessionWords } from './phrase';
import { hasWords, levenshtein, near, normalize, wordNumber } from './text';

export { levenshtein, near, normalize, parseShiftUnit, wordNumber };

export type Match<T> =
  | { readonly kind: 'found'; readonly value: T }
  | { readonly kind: 'ambiguous'; readonly candidates: readonly T[] }
  | { readonly kind: 'none' };

/** One distinct item is `found`, several are `ambiguous`, none is `null` so the next tier may try. */
function pick<T>(items: readonly T[]): Match<T> | null {
  const unique = [...new Set(items)];
  if (unique.length === 1) return { kind: 'found', value: unique[0] };
  if (unique.length > 1) return { kind: 'ambiguous', candidates: unique };
  return null;
}

// -- Trades ----------------------------------------------------------------------------------------

const aliasesOf = (tradeName: string): readonly string[] => {
  const key = normalize(tradeName);
  return Object.prototype.hasOwnProperty.call(TRADE_ALIASES, key) ? TRADE_ALIASES[key] : [];
};

/** A trade by its id, name or spoken alias: exact, then inside a longer sentence, then a near spelling. */
export function resolveTrade<T extends { id: string; name: string }>(text: string, trades: readonly T[]): Match<T> {
  const q = normalize(text);
  if (!q) return { kind: 'none' };
  const names = (t: T) => [t.id, t.name, ...aliasesOf(t.name)].map(normalize);
  return (
    pick(trades.filter((t) => names(t).includes(q))) ??
    pick(trades.filter((t) => names(t).some((n) => hasWords(q, n)))) ??
    pick(trades.filter((t) => names(t).some((n) => near(q, n) || q.split(' ').some((w) => near(w, n))))) ?? { kind: 'none' }
  );
}

/** True when `text` names a trade the app knows by name or spoken alias (the lexicon's trades). */
function namesKnownTrade(text: string): boolean {
  const known = Object.keys(TRADE_ALIASES).map((name) => ({ id: name, name }));
  return resolveTrade(text, known).kind !== 'none';
}

// -- Sessions --------------------------------------------------------------------------------------

/** One session the trainer can open: a batch of a trade, in a slot. The key is the session key. */
export interface SessionChoice {
  readonly key: string;
  readonly shift: number;
  readonly unit: number;
  readonly tradeName: string;
  readonly slot: MarkingSlot;
}

/** The label as the MVP read it out ("Shift 1, Unit 2, Fitter"). Halves and periods of a batch share it. */
const labelOf = (c: SessionChoice) => `Shift ${c.shift}, Unit ${c.unit}, ${c.tradeName}`;

/** A slot the text names must be the session's slot: a half word never matches a daily session. */
function slotFits(slot: MarkingSlot, w: SessionWords): boolean {
  if (w.half !== undefined && !(slot.kind === 'half' && slot.part === w.half)) return false;
  if (w.period !== undefined && !(slot.kind === 'period' && slot.periodNo === w.period)) return false;
  return true;
}

/**
 * The session the trainer means, among the sessions offered. Tiers: the session key (an id from an earlier
 * result), the label read out, then words. Words are: the trade, only when the list spans several trades
 * (in a one-trade list a trade word is ignored, as in the MVP); shift and unit in any language; and the
 * slot ("second half", "lunch ke baad", "period 3"). Anything the text names must hold, and unnamed parts
 * match any, so "shift 1" is ambiguous when two units run in shift 1. A phrase whose numbers can be paired with
 * its keywords two ways ("1 2 period 3") opens nothing: the answer is `none` and the model asks again.
 */
export function resolveSession<T extends SessionChoice>(text: string, choices: readonly T[]): Match<T> {
  const q = normalize(text);
  if (!q) return { kind: 'none' };

  const exact = pick(choices.filter((c) => normalize(c.key) === q)) ?? pick(choices.filter((c) => normalize(labelOf(c)) === q));
  if (exact) return exact;

  let pool: readonly T[] = choices;
  let narrowed = false;
  const tradeNames = [...new Set(choices.map((c) => c.tradeName))];
  const offeredTrade = resolveTrade(q, tradeNames.map((name) => ({ id: name, name })));
  if (tradeNames.length > 1 && offeredTrade.kind === 'found') {
    const trade = offeredTrade.value;
    pool = choices.filter((c) => c.tradeName === trade.name);
    narrowed = true;
  }
  // A known trade that none of the offered sessions belongs to: never open another trade's batch because it shares
  // the shift and unit. Words that name no known trade are ignored, as before.
  if (offeredTrade.kind === 'none' && namesKnownTrade(q)) return { kind: 'none' };

  const words = readSessionWords(q);
  if (!words) return { kind: 'none' };
  const named = narrowed || [words.shift, words.unit, words.half, words.period].some((n) => n !== undefined);
  if (!named) return { kind: 'none' };
  const hits = pool.filter(
    (c) => (words.shift === undefined || c.shift === words.shift) && (words.unit === undefined || c.unit === words.unit) && slotFits(c.slot, words),
  );
  return pick(hits) ?? { kind: 'none' };
}

// -- Students --------------------------------------------------------------------------------------

export interface StudentChoice {
  readonly id: string;
  readonly rollNo: number;
  readonly name: string;
  readonly fatherName: string;
}

const ROLL_PREFIX = /^(roll number|roll no|roll|number|no|रोल नंबर|नंबर|रोल)\s+/;

/**
 * The student the trainer means, among one roster. Tiers: the student id; a roll number ("5", "roll 5",
 * "number paanch"); name plus father ("Akash Kumar father Sunil Yadav", "Akash Sunil wala"), which counts
 * only when it leaves exactly one student; then the name, whole, contained, first name, and a near
 * spelling. A father's surname alone does not count, and a father name is compared in the script it is
 * stored in. One argument should name one student: two names in one argument come back ambiguous.
 */
export function resolveStudent<T extends StudentChoice>(text: string, students: readonly T[]): Match<T> {
  const q = normalize(text);
  if (!q) return { kind: 'none' };

  const byId = pick(students.filter((s) => normalize(s.id) === q));
  if (byId) return byId;

  // "5", "roll 5", "number paanch": a single number means the roll number. With no such roll, go on with names.
  const roll = wordNumber(q.replace(ROLL_PREFIX, ''));
  if (roll !== undefined) {
    const byRoll = pick(students.filter((s) => s.rollNo === roll));
    if (byRoll) return byRoll;
  }

  const rows = students.map((student) => {
    const name = normalize(student.name);
    const father = normalize(student.fatherName);
    return { student, name, first: name.split(' ')[0], father, fatherFirst: father.split(' ')[0] };
  });
  type Row = (typeof rows)[number];
  const pickRows = (hits: readonly Row[]) => pick(hits.map((r) => r.student));
  const qFirst = q.split(' ')[0];

  const named = rows.filter((r) => hasWords(q, r.name) || hasWords(q, r.first));
  const fatherHit = pickRows(named.filter((r) => hasWords(q, r.father) || hasWords(q, r.fatherFirst)));
  if (fatherHit?.kind === 'found') return fatherHit;

  return (
    pickRows(rows.filter((r) => r.name === q)) ??
    pickRows(rows.filter((r) => hasWords(q, r.name))) ??
    pickRows(rows.filter((r) => r.first === q || hasWords(q, r.first))) ??
    pickRows(rows.filter((r) => near(q, r.name) || near(qFirst, r.first))) ?? { kind: 'none' }
  );
}
