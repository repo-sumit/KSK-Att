/**
 * Instruction texts, the shared part (voice design §8): every tool result and `[APP]` event tells the model
 * exactly what to say next, built from app state; the model never decides it (MVP principles P1, P5).
 * Ported verbatim from the MVP executor's phrase helpers (MVP-04 §3.7, MVP-05 §5, MVP-08 blocks H and I),
 * changing only names and protocol: KSK sessions for batches, the shared draft for the store, KSK tool
 * names. This module holds the view, the counts, the selection questions and the step hint; the marking
 * texts are in instructions.ts, which re-exports everything here. Tuned against the live model: change
 * wording only with a rehearsal (`npm run test:voice-live`).
 * Pure TypeScript: no I/O, no clock, no framework.
 */
import type { Trade } from '@/domain/entities';
import type { StatusCode } from '@/domain/status';
import type { VoiceFlowState } from '@/domain/voice/flow';
import type { FlowPlan } from '@/domain/voice/plan';
import type { SessionCard } from '../attendance';
import type { DraftSnapshot } from '../marking-draft';
import {
  batchLabel, countsOf, nameText, sessionLabel, shortLabel, slotLabel, spokenTime, studentView, verificationPhrase, word, type StudentView,
} from './labels';

/** What the texts are built from: the flow plan, the flow state and, once a batch is open, its draft. */
export interface VoiceView {
  readonly plan: FlowPlan;
  readonly flow: VoiceFlowState;
  /** The live draft of `flow.sessionKey`: absent until the batch is open, so no name leaves before verification. */
  readonly draft?: DraftSnapshot;
  /** The card of `flow.sessionKey` (being verified, marked or submitted). */
  readonly card?: SessionCard;
  readonly trades: readonly Trade[];
  /** The sessions on offer: the selected trade's board, or the trainer's own list without a trade step. */
  readonly cards: readonly SessionCard[];
  /** `verification.faceRetryLimit` (null: unlimited). The plan does not carry it; absent counts as unlimited. */
  readonly faceRetryLimit?: number | null;
  /** A submit is saving the open batch's draft now (the screen's Submit, or voice's own): nothing can change or be asked. */
  readonly submitting?: 'screen' | 'voice';
}

/** The draft of the selected session only: student names come from nowhere else (verification before names). */
export function openDraft(view: VoiceView): DraftSnapshot | undefined {
  const draft = view.draft;
  return draft && view.flow.sessionKey !== null && draft.key === view.flow.sessionKey ? draft : undefined;
}

/** The full label of the selected session ("Shift 1, Unit 2, Electrician", plus the slot), when known. */
export function selectedLabel(view: VoiceView): string | undefined {
  const card = view.card;
  return card && card.key === view.flow.sessionKey ? sessionLabel(card, view.plan.slotWords) : undefined;
}

/** The student being called (MVP `currentView`). */
export function currentView(view: VoiceView): StudentView | null {
  const draft = openDraft(view);
  const st = draft?.students.find((x) => x.id === view.flow.currentId);
  return draft && st ? studentView(st, draft.students) : null;
}

/** A student of the open batch by id. */
export function studentOf(view: VoiceView, id: string): StudentView | null {
  const draft = openDraft(view);
  const st = draft?.students.find((x) => x.id === id);
  return draft && st ? studentView(st, draft.students) : null;
}

/** The counts of the open batch; none before it is open. */
export const viewCounts = (view: VoiceView): Record<string, number> => {
  const draft = openDraft(view);
  return draft ? countsOf(draft, view.plan.statuses) : {};
};

/** The configured default status, or null when the state starts blank. */
export const defaultOf = (plan: FlowPlan): Exclude<StatusCode, 'ojt'> | null => (plan.defaultStatus === 'blank' ? null : plan.defaultStatus);

/** Marking by exception: everyone has the default, the trainer names the others (PRD 9.2). */
export const byException = (view: VoiceView): boolean => view.flow.step === 'ROLL_CALL' && !view.flow.rollCall && defaultOf(view.plan) !== null;

/** The other statuses, as the question names them: "absent or leave". */
export const othersThan = (plan: FlowPlan, code: StatusCode): string =>
  plan.statuses
    .filter((c) => c !== code && c !== 'ojt')
    .map(word)
    .join(' or ');

/** "10 present, 1 absent, 1 leave" (zero counts left out, OJT last); withUnmarked adds "3 unmarked". */
export function countsText(counts: Record<string, number>, withUnmarked = false): string {
  const codes = Object.keys(counts).filter((c) => c !== 'UNMARKED' && c !== 'OJT');
  const parts = [...codes, 'OJT'].filter((c) => (counts[c] ?? 0) > 0).map((c) => `${counts[c]} ${c === 'OJT' ? 'on OJT' : word(c)}`);
  if (withUnmarked && counts.UNMARKED) parts.push(`${counts.UNMARKED} unmarked`);
  return parts.length ? parts.join(', ') : 'nobody marked yet';
}

export function readTrades(trades: readonly Trade[]): string {
  return `Read the trade names: ${trades.map((t) => nameText(t.name)).join(', ')}. Ask which trade.`;
}

/** The question while marking by exception. */
export function askExceptions(view: VoiceView): string {
  const def = defaultOf(view.plan) ?? 'present';
  return `ask who else is not ${word(def)} (${othersThan(view.plan, def)}), or whether that is all`;
}

/** Why a group of sessions cannot be marked now: the next window to open, else the last one that closed. */
function shutText(pending: readonly SessionCard[]): string | null {
  if (!pending.length || pending.some((c) => c.status === 'open')) return null;
  const future = pending.find((c) => c.status === 'future' && c.scheduled.window);
  if (future) return `not open yet (it opens at ${spokenTime(future.address.date, future.scheduled.window!.start)})`;
  const closed = pending.filter((c) => c.status === 'closed' && c.scheduled.window).at(-1);
  return closed ? `closed (it closed at ${spokenTime(closed.address.date, closed.scheduled.window!.end)})` : null;
}

/**
 * The batch question (MVP `readBatches`) over sessions: one entry per batch (its halves together) or per
 * period; notes on what is submitted, which half is next and which windows are shut.
 */
export function readSessions(view: VoiceView): string {
  const { plan, cards } = view;
  const trade = plan.tradeStep ? view.trades.find((t) => t.id === view.flow.tradeId) : undefined;
  const confirm = trade ? `Say just "${nameText(trade.name)}." to confirm. ` : '';
  if (!cards.length) return `${confirm}There is no batch to mark today. Say so in one short line.`;
  const period = plan.slotWords === 'period';
  const base = (c: SessionCard) => (trade ? shortLabel(c.batch) : batchLabel(c.batch, c.trade));
  const label = (c: SessionCard) => (period ? `${base(c)}, ${slotLabel(c, plan.slotWords)}` : base(c));
  const groups = new Map<string, SessionCard[]>();
  for (const c of cards) {
    const key = period ? c.key : c.batch.id;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  const done: string[] = [];
  const next = new Map<string, string[]>();
  const shut: { label: string; text: string }[] = [];
  for (const group of groups.values()) {
    const pending = group.filter((c) => c.status !== 'submitted');
    if (!pending.length) done.push(label(group[0]));
    else if (pending.length < group.length) {
      const said = (list: readonly SessionCard[]) => list.map((c) => slotLabel(c, plan.slotWords)).join(' and ');
      const key = `the ${said(group.filter((c) => c.status === 'submitted'))} attendance is in; the ${said(pending)} one is next.`;
      next.set(key, [...(next.get(key) ?? []), label(group[0])]);
    }
    const text = shutText(pending);
    if (text) shut.push({ label: label(group[0]), text });
  }
  const note =
    (done.length ? ` Mention that ${done.join(' and ')} is already submitted today.` : '') +
    [...next].map(([text, labels]) => ` For ${labels.join(' and ')} ${text}`).join('') +
    (shut.length ? ` Also say that ${shut.map((s) => s.label).join(' and ')} cannot be marked right now: its attendance window is ${shut.map((s) => s.text).join('; ')}.` : '');
  const pattern = `Shift <n>, Unit <n>${trade ? '' : ', <trade>'}${period ? ', Period <n>' : ''}`;
  const ask = period ? ' Pass a period as "period <n>" (a number alone is read as a shift).' : '';
  return `${confirm}Read the ${period ? 'periods' : 'batches'} as "${pattern}", with numbers said the way the trainer's language says them: ${[...groups.values()].map((g) => label(g[0])).join('; ')}.${note} Then ask which one in two or three words.${ask}`;
}

/** A submit is saving the draft (view.submitting): nothing to ask; the trainer waits for its result. */
export function submittingHint(view: VoiceView): string {
  const where = view.submitting === 'screen' ? ' on screen' : '';
  return `The attendance of ${selectedLabel(view) ?? 'this batch'} is being submitted${where} right now. Say so in one short line and ask the trainer to wait a moment; the screen shows when it is saved.`;
}

/** Students of the open batch still without a status, named as a question names them (at most 5, else none). */
function unmarkedText(view: VoiceView): { readonly count: number; readonly names: string } {
  const draft = openDraft(view);
  const left = draft ? draft.students.filter((st) => !draft.marks[st.id]?.status) : [];
  const names = draft && left.length <= 5 ? left.map((st) => studentView(st, draft.students).call_as).join('; ') : '';
  return { count: left.length, names };
}

/** What to do in the current step, used by WRONG_STEP and similar errors (MVP-04 §3.7). */
export function stepHint(view: VoiceView): string {
  const { plan, flow } = view;
  const cur = currentView(view);
  const counts = countsText(viewCounts(view));
  if (view.submitting && (flow.step === 'ROLL_CALL' || flow.step === 'REVIEW') && openDraft(view)) return submittingHint(view);
  switch (flow.step) {
    case 'IDLE':
      return 'The roster is still loading. Ask the trainer to wait a moment.';
    case 'SELECT_TRADE':
      return `We are choosing the trade. ${readTrades(view.trades)}`;
    case 'SELECT_BATCH': {
      const chosen = !plan.tradeStep || view.trades.some((t) => t.id === flow.tradeId);
      return chosen ? `We are choosing the batch. ${readSessions(view)}` : readTrades(view.trades);
    }
    case 'VERIFY': {
      const phrase = verificationPhrase(plan);
      const checks = phrase ? `: it checks the trainer's ${phrase} first` : '';
      return `The app is opening ${selectedLabel(view) ?? 'the batch'}${checks}. Wait; the app tells you when the student list is open.`;
    }
    case 'ROLL_CALL':
      if (byException(view)) return `Marking by exception: ${counts}. In the trainer's language, ${askExceptions(view)}. When that is all, call submit_attendance.`;
      // nobody to call on the list (the trainer went back to it from the review, or a detail is still to choose):
      // the submit question is asked by submit_attendance itself, with its code
      if (!cur) {
        // nobody is being called, yet someone may still be without a status (a skipped or untouched student)
        const left = unmarkedText(view);
        if (left.count) {
          const who = left.names ? `: ${left.names}` : '';
          return `Nobody is being called, and ${left.count} ${left.count === 1 ? 'student has' : 'students have'} no status yet${who} (${countsText(viewCounts(view), true)}). In the trainer's language, ask about ${left.count === 1 ? 'that student' : 'them'} and mark each with set_student_status. Attendance can be submitted once everyone has a status.`;
        }
        return `Everyone has a status: ${counts}. Answer the trainer in one short line and wait. When the trainer wants to submit, call submit_attendance (it reads the counts and asks once).`;
      }
      return `Roll call is in progress. Call out ${cur.call_as}.`;
    case 'REVIEW':
      return `Everyone is marked: ${counts}. Say submit is final and ask whether to submit.`;
    case 'SUBMITTED':
      return `Attendance for ${selectedLabel(view) ?? 'this batch'} is already submitted and locked.`;
  }
}

/** select_batch when the gateway checks first (MVP-11 §3.2), built from the plan's checks. */
export function verifyingInstruction(view: VoiceView): string {
  const label = selectedLabel(view) ?? 'the batch';
  const phrase = verificationPhrase(view.plan);
  if (!phrase) return `Say just that you are opening ${label}, then wait for the next [APP] message.`;
  return `Before the student list, the app checks the trainer's ${phrase}. Say in one short line, in the trainer's language: please stay where you are and look at the screen. Then stop and wait: the app tells you when the list of ${label} is open.`;
}
