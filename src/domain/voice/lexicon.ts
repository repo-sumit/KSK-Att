/**
 * What trainers say: the spoken names of the trades, and the words around shift, unit, half and period.
 * Data only. The matching code normalises every entry (`phrase.ts` once when it loads, `match.ts` for the
 * trade aliases), so case, the nukta and punctuation here do not matter; the TRADE_ALIASES keys are the one
 * exception and must already be normalised.
 * Adding a language or a spelling means adding words here (MVP-05 section 9.9). There is no
 * transliteration: a Latin trade name matches Devanagari speech only through an alias listed here.
 */

/**
 * Spoken names of each trade in Marathi, Hindi and common spellings, keyed by the normalised English
 * trade name (lower case, single spaces). A trade is also matched by its id and its own name, which
 * need no entry.
 */
export const TRADE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  electrician: ['वीजतंत्री', 'विजतंत्री', 'बिजली', 'bijli', 'wireman', 'इलेक्ट्रिशियन', 'elec'],
  fitter: ['जोडारी', 'फिटर'],
  welder: ['वेल्डर', 'संधाता', 'sandhata'],
  copa: ['कोपा', 'computer', 'संगणक'],
  'mechanic diesel': ['डिझेल', 'diesel', 'मेकॅनिक डिझेल', 'mechanic', 'मेकॅनिक'],
};

/** "shift", and "sift", a common mishearing. */
export const SHIFT_WORDS: readonly string[] = ['shift', 'शिफ्ट', 'sift'];

export const UNIT_WORDS: readonly string[] = ['unit', 'यूनिट', 'युनिट'];

/** The word "half", which takes a number beside it: "first half", "pehla half", "half 2". */
export const HALF_WORDS: readonly string[] = ['half', 'हाफ'];

/** "period" as the timetable says it, and the Marathi and Hindi words for a class hour: "period 3", "teesra ghanta". */
export const PERIOD_WORDS: readonly string[] = ['period', 'ghanta', 'तास', 'तासिका', 'पीरियड'];

/**
 * Phrases that name the first half of a shift. "sign in" is the same session when a state marks arrival
 * and departure. The last two are the app's own Marathi labels (`session.halfFirst`, `session.signIn`),
 * which the model reads out and the trainer repeats.
 */
export const FIRST_HALF_PHRASES: readonly string[] = ['pehla half', 'subah', 'morning', 'sakali', 'सकाळी', 'sign in', 'पूर्वार्ध', 'आगमन'];

/** Phrases that name the second half: the counterparts of the first-half ones, then "afternoon" to match "morning". */
export const SECOND_HALF_PHRASES: readonly string[] = ['doosra half', 'lunch ke baad', 'after lunch', 'dupari', 'दुपारी', 'sign out', 'उत्तरार्ध', 'निर्गमन', 'afternoon'];
