/**
 * Voice flow state machine (voice design §5.1): the MVP's step machine, its pure transitions and the one
 * pointer rule `advance()` (MVP-06 §3.4–3.5, rules R1 to R4). Marks are not held here: they live in the
 * shared draft (D-084) and every transition that moves the pointer reads them through a `DraftView`.
 * A refused transition returns the same object; every other one spreads `...s`. Pure TypeScript: no
 * clock, no ids, no framework.
 */
import { needsDetail, type Mark, type StatusCode } from '@/domain/status';
import type { FlowPlan } from './plan';
import type { MarkSource, VoiceStep } from './types';

/** The read-only part of the live draft the flow needs. */
export interface DraftView {
  /** Student ids in roll order. */
  readonly order: readonly string[];
  readonly marks: Readonly<Record<string, Mark>>;
  /** Trainer marks only (D-084): defaults and presets have no source. */
  readonly sources: Readonly<Record<string, MarkSource>>;
  /** OJT and carried leave: never called. */
  readonly presets: ReadonlySet<string>;
  /**
   * Whether a half day needs its half (`marking.halfDayHalves`, `FlowPlan.details.half`). Read only to
   * keep the list on screen while a trainer mark waits for its detail (MVP `detailPending`). Off when absent.
   */
  readonly halfDayHalves?: boolean;
}

export interface VoiceFlowState {
  readonly step: VoiceStep;
  readonly tradeId: string | null;
  /** The session being verified (VERIFY) or marked (ROLL_CALL, REVIEW, SUBMITTED). */
  readonly sessionKey: string | null;
  /** The student being called; null while marking by exception, outside ROLL_CALL, or with nobody left. */
  readonly currentId: string | null;
  /** Students skipped in this roll call, oldest first. */
  readonly skipped: readonly string[];
  /** true: every name is called in turn; false: marking by exception, nobody is called. */
  readonly rollCall: boolean;
  readonly lastMarked: { readonly id: string; readonly status: StatusCode } | null;
  /**
   * The student the latest transition skipped, else null. After `withSkip`, `currentId === lastSkippedId`
   * means the skip came back to the same student (MVP: "Only <name> is left").
   */
  readonly lastSkippedId: string | null;
}

/** Everything that belongs to the open batch; changing the batch drops it (MVP `noBatch`). `rollCall` survives. */
const noBatch = { sessionKey: null, currentId: null, skipped: [], lastMarked: null, lastSkippedId: null } as const;

const has = (record: Readonly<Record<string, unknown>>, id: string): boolean => Object.prototype.hasOwnProperty.call(record, id);

/** A batch is open for marking: its session is set and the step is the list or the review. */
const marking = (s: VoiceFlowState): boolean => s.sessionKey !== null && (s.step === 'ROLL_CALL' || s.step === 'REVIEW');

/** Called: the trainer marked the student, or the system did (a preset). The roll call never calls them. */
export const isCalled = (draft: DraftView, id: string): boolean => has(draft.sources, id) || draft.presets.has(id);

/** Students the trainer has not marked and the system knows nothing about: the roll call calls these. */
export function uncalledIds(draft: DraftView): string[] {
  return draft.order.filter((id) => !isCalled(draft, id));
}

export function progressOf(draft: DraftView): { readonly called: number; readonly total: number } {
  const total = draft.order.length;
  return { called: total - uncalledIds(draft).length, total };
}

/** Trainer marks still waiting for their half or leave type: they keep the list on screen. */
function detailPending(draft: DraftView): string[] {
  const opts = { halfDayHalves: draft.halfDayHalves ?? false };
  return draft.order.filter((id) => has(draft.sources, id) && has(draft.marks, id) && needsDetail(draft.marks[id], opts) !== null);
}

export function initialFlow(plan: Pick<FlowPlan, 'tradeStep'>): VoiceFlowState {
  return { step: plan.tradeStep ? 'SELECT_TRADE' : 'SELECT_BATCH', tradeId: null, ...noBatch, rollCall: true };
}

/** Back to the trade list. Drops the batch (the draft keeps its marks, D-083). */
export function withTradeList(s: VoiceFlowState): VoiceFlowState {
  return { ...s, ...noBatch, step: 'SELECT_TRADE', tradeId: null };
}

/** Trade chosen: show its batches. Drops the batch. */
export function withTrade(s: VoiceFlowState, tradeId: string): VoiceFlowState {
  return { ...s, ...noBatch, step: 'SELECT_BATCH', tradeId };
}

/** Back to the batch list of the same trade (or the only list, without a trade step). Drops the batch. */
export function withBatchList(s: VoiceFlowState): VoiceFlowState {
  return { ...s, ...noBatch, step: 'SELECT_BATCH' };
}

/** VERIFY: the gateway checks location (and face) before the names of `sessionKey`. */
export function withOpening(s: VoiceFlowState, sessionKey: string): VoiceFlowState {
  return { ...s, ...noBatch, step: 'VERIFY', sessionKey };
}

/**
 * Batch opened: marking starts. By exception nobody is called; a roll call starts from the top
 * (`currentId` is null, so `advance` takes R2 from the first uncalled student).
 */
export function withBatch(s: VoiceFlowState, sessionKey: string, draft: DraftView, startStyle: 'roll_call' | 'exceptions'): VoiceFlowState {
  return advance({ ...s, ...noBatch, step: 'ROLL_CALL', sessionKey, rollCall: startStyle === 'roll_call' }, draft);
}

/** "Naam se bulao": call every student not called yet, one by one, from the top. */
export function withRollCall(s: VoiceFlowState, draft: DraftView): VoiceFlowState {
  if (!marking(s)) return s;
  return advance({ ...s, rollCall: true, currentId: null, step: 'ROLL_CALL', lastSkippedId: null }, draft);
}

/** The review before submit. The caller checks first that nobody is unmarked and no detail is missing. */
export function withReview(s: VoiceFlowState): VoiceFlowState {
  if (!marking(s)) return s;
  return { ...s, step: 'REVIEW', currentId: null, skipped: [], lastSkippedId: null };
}

/** From the review back to the list (a roll call carries on from the first uncalled student). */
export function withList(s: VoiceFlowState, draft: DraftView): VoiceFlowState {
  if (!marking(s)) return s;
  return advance({ ...s, step: 'ROLL_CALL', currentId: null, lastSkippedId: null }, draft);
}

/**
 * A trainer mark (voice, correction or tap) is in the draft: remember it as last_marked, drop the
 * student's skip, then advance. Refused when no batch is open, or the draft holds no trainer mark for
 * the student (unknown, a preset the draft refused, OJT).
 * `status` is read only as the new `lastMarked`: the caller passes the status the draft already accepted
 * for `id` (this function does not check it against `draft.marks`, apart from refusing OJT).
 */
export function withMarked(s: VoiceFlowState, draft: DraftView, id: string, status: StatusCode): VoiceFlowState {
  if (!marking(s) || status === 'ojt' || !draft.order.includes(id) || !has(draft.sources, id)) return s;
  if (draft.marks[id]?.status === 'ojt') return s;
  return advance({ ...s, skipped: s.skipped.filter((x) => x !== id), lastMarked: { id, status }, lastSkippedId: null }, draft);
}

/** Skip the current student; advance() brings them back later. Refused for anyone but the current student. */
export function withSkip(s: VoiceFlowState, draft: DraftView, id: string): VoiceFlowState {
  if (!marking(s) || !s.currentId || id !== s.currentId) return s;
  const next = advance({ ...s, skipped: [...s.skipped.filter((x) => x !== id), id] }, draft);
  return { ...next, lastSkippedId: id };
}

/** mark_remaining wrote every uncalled student (skipped ones included) into the draft. last_marked stays. */
export function withRemaining(s: VoiceFlowState, draft: DraftView): VoiceFlowState {
  if (!marking(s)) return s;
  return advance({ ...s, lastSkippedId: null }, draft);
}

/** The session is saved and locked. */
export function withSubmitted(s: VoiceFlowState): VoiceFlowState {
  return { ...s, step: 'SUBMITTED', currentId: null, lastSkippedId: null };
}

/**
 * The one function that moves the pointer, after every change (voice, tap, correction, skip, bulk):
 * R1 keep the current student while uncalled and not skipped (corrections of others never move it);
 * R2 else the next uncalled, non-skipped student after the pointer, wrapping;
 * R3 else the next skipped student after the pointer (never the same one twice in a row, unless it is
 *    the only uncalled student left), clearing its skip flag;
 * R4 else nobody is uncalled: REVIEW (all_marked), when the roll call just ran out; a change made
 *    with nobody being called (on the list after the review) stays where it is.
 * Marking by exception (no roll call) never calls anyone.
 */
export function advance(s: VoiceFlowState, draft: DraftView): VoiceFlowState {
  if (!marking(s)) return s;
  if (!s.rollCall) return { ...s, currentId: null, skipped: [] };
  const open = (id: string) => !isCalled(draft, id);
  const skipped = s.skipped.filter(open);
  const cur = s.currentId;
  if (cur && open(cur) && !skipped.includes(cur)) return { ...s, skipped, step: 'ROLL_CALL' };
  const ids = draft.order.filter((id) => !draft.presets.has(id) || has(draft.sources, id));
  const p = cur ? ids.indexOf(cur) : -1;
  const ring = [...ids.slice(p + 1), ...ids.slice(0, p + 1)];
  const next =
    ring.find((id) => open(id) && !skipped.includes(id)) ??
    ring.find((id) => open(id) && id !== cur) ??
    (cur && open(cur) ? cur : undefined);
  if (next) return { ...s, currentId: next, skipped: skipped.filter((id) => id !== next), step: 'ROLL_CALL' };
  // a half or a leave type still missing keeps the list on screen (the review has no control for it)
  const review = (cur || s.step === 'REVIEW') && !detailPending(draft).length;
  return { ...s, currentId: null, skipped: [], step: review ? 'REVIEW' : s.step === 'REVIEW' ? 'ROLL_CALL' : s.step };
}
