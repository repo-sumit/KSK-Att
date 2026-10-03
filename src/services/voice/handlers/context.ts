/**
 * What every voice tool handler shares (voice design §5, D-079): the executor's dependencies and state,
 * the handler context, the result helpers (`fail`, `snapshot`) and the `VoiceView` builder. Ported from the
 * MVP executor's result conventions (MVP-05 §3.5, MVP-04 §2.3–2.4) with KSK services in place of the store.
 * A view carries a draft only while a batch is open for the selected session: student fields come from
 * nowhere else, and a draft can only be opened through `openRoster`, which requires the pass (INV-16).
 */
import type { OpenRosterError, AttendanceService, SessionCard } from '@/services/attendance';
import type { SessionContext } from '@/services/context';
import type { DraftSnapshot, MarkingDraftService } from '@/services/marking-draft';
import type { VerificationNeed, VerificationService } from '@/services/verification';
import type { SessionKey } from '@/domain/attendance';
import type { Trade } from '@/domain/entities';
import type { Mark, StatusCode } from '@/domain/status';
import { checkConfirm, issueConfirm, type ConfirmAction, type ConfirmNow, type ConfirmTicket } from '@/domain/voice/confirm';
import { initialFlow, progressOf, withBatch, withTrade, type DraftView, type VoiceFlowState } from '@/domain/voice/flow';
import type { FlowPlan } from '@/domain/voice/plan';
import { toModelStatus } from '@/domain/voice/types';
import type { ActionBus } from '../action-bus';
import { byException, currentView, openDraft, selectedLabel, stepHint, studentOf, viewCounts, type VoiceView } from '../instructions';
import { nameText, sessionLabel, windowNote } from '../labels';
import type { ToolResult } from '../tools';

export interface ExecutorDeps {
  readonly ctx: SessionContext;
  readonly plan: FlowPlan;
  readonly attendance: AttendanceService;
  readonly verification: VerificationService;
  readonly drafts: MarkingDraftService;
  readonly bus: ActionBus;
  readonly isOnline: () => boolean;
  /** Real elapsed time for the confirmation TTL (never the demo's frozen business clock). */
  readonly nowMs: () => number;
  /** The confirmation counters (D-082, ../trainer-turns): trainer turns, ended model turns, and turnSeq when the trainer's latest turn began. */
  readonly speechSeq: () => number;
  readonly turnSeq: () => number;
  readonly spokeAtTurn: () => number;
  readonly generation: () => number;
  /** A number in [0, 1). */
  readonly entropy: () => number;
}

export type Args = Readonly<Record<string, unknown>>;

/** A name the trainer gave that could not be marked yet: unknown, ambiguous, or not the current student (MVP-05 §4.2). */
export interface OpenNameEntry {
  readonly key: SessionKey;
  readonly text: string;
  readonly status: StatusCode | null;
  /** The students it could mean (empty when unknown). */
  readonly ids: readonly string[];
  /** Trainer marks in the batch when it was noted: fewer later means the batch started over. */
  readonly marked: number;
  /** mark_remaining was refused once for it. */
  asked: boolean;
}

export interface ExecState {
  flow: VoiceFlowState;
  /** At most one open confirmation (D-082). */
  ticket: ConfirmTicket | null;
  /** The last href voice navigated to, consumed by the next screen signal. */
  lastNav: string | null;
  /** Where the screen is: the href of the latest screen signal, or of voice's own latest navigation (null: unknown). */
  screen: string | null;
  open: OpenNameEntry[];
  /** Students set_student_status just marked fresh: the exceptions of "sab present, sirf ...". */
  named: { key: SessionKey | null; ids: string[] };
  /** The locked draft of the last submit (the live draft is closed after a submit). */
  submitted: { readonly key: SessionKey; readonly snapshot: DraftSnapshot } | null;
  endRequested: boolean;
  /** The sessions on offer and the selected session's card, as last loaded. */
  cards: readonly SessionCard[];
  card: SessionCard | undefined;
  readonly inFlight: Map<SessionKey, Promise<ToolResult>>;
  verify: VerifyMemory;
  /** A pass found everyone in this batch set: the gateway's list screen signal asks the submit question (with its code). */
  askOnList: SessionKey | null;
}

/** What voice knows of the check on screen for one session, as the gateway screen counts it (it starts again with the screen). */
export interface VerifyMemory {
  readonly key: SessionKey | null;
  readonly prompts: Set<string>;
  cameraPending: boolean;
  /** Failed face tries, counted as the screen counts them toward faceRetryLimit: no match, or a check that could not see one clear face. */
  faceFailures: number;
  /** The tap the screen is waiting for (its latest prompt), until anything else happens. */
  need: VerificationNeed | null;
}

const freshVerify = (key: SessionKey | null): VerifyMemory => ({ key, prompts: new Set(), cameraPending: false, faceFailures: 0, need: null });

export type Opened =
  | { readonly ok: true; readonly view: VoiceView }
  | { readonly ok: false; readonly error: OpenRosterError }
  /** A tap or another tool moved the flow on while the roster loaded: nothing was opened; `view` is the current state. */
  | { readonly ok: false; readonly error: 'stale'; readonly view: VoiceView };

export interface HandlerContext {
  readonly deps: ExecutorDeps;
  readonly state: ExecState;
  /** Reloads the sessions on offer; the draft is read after the last await. */
  view(): Promise<VoiceView>;
  /**
   * Loads the sessions on offer for `step(flow)`, then moves to `step` of the flow as it is after the load (a tap or a
   * screen signal meanwhile is kept, never overwritten by a target computed before it): when loading throws, the
   * flow is left as it was.
   */
  moveTo(step: (flow: VoiceFlowState) => VoiceFlowState): Promise<VoiceView>;
  /** The view from the last loaded sessions, with the current flow and draft (or the given overrides). */
  viewOf(over?: Partial<VoiceView>): VoiceView;
  draftView(snapshot: DraftSnapshot): DraftView;
  /** Every href is built with `routes.*` from ids the services returned, never from a model string. */
  navigate(href: string, replace: boolean): void;
  /** The current student, else `fallback` (the student just marked). */
  focus(view: VoiceView, fallback?: string): void;
  issue(action: ConfirmAction, key: SessionKey, argsKey: string): string;
  /** True (and the ticket is dropped) when `token` confirms the action now. */
  confirm(action: ConfirmAction, key: SessionKey, argsKey: string, token: unknown): boolean;
  /** openRoster (the pass is checked there) → drafts.open → withBatch, unless the flow moved on meanwhile. */
  openBatch(card: SessionCard): Promise<Opened>;
  /** Per-session verification memory, reset when another session is being verified. */
  verifyFor(key: SessionKey): VerifyMemory;
  /** The gateway screen opens for `key` (a new screen counts from zero): fresh verification memory. */
  startVerify(key: SessionKey): VerifyMemory;
}

export type Handler = (h: HandlerContext, args: Args) => Promise<ToolResult>;

/** `instruction` last, so an extra field can never replace it (MVP-05 L430-L435). */
export function fail(error: string, instruction: string, extra: Record<string, unknown> = {}): ToolResult {
  return { ok: false, error, ...extra, instruction };
}

export const INTERNAL_RESULT: ToolResult = {
  ok: false,
  error: 'INTERNAL',
  instruction: 'Something went wrong in the app. Say sorry in a few words and repeat your last question.',
};

/** Loose model input (MVP-04 §2.4): a trimmed string, a number as text, anything else empty. */
export const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
export const sameId = (a: string, b: string | null): boolean => !!b && a.toLowerCase() === b.toLowerCase();
export const has = (record: Readonly<Record<string, unknown>>, id: string): boolean => Object.prototype.hasOwnProperty.call(record, id);

export const labelOf = (view: VoiceView): string => selectedLabel(view) ?? 'this batch';
export const wrongStep = (view: VoiceView): ToolResult => fail('WRONG_STEP', stepHint(view), { step: view.flow.step });

export function locked(view: VoiceView): ToolResult {
  const other = view.plan.tradeStep ? 'another batch or trade' : 'another batch';
  return fail(
    'LOCKED',
    `Attendance for ${labelOf(view)} is submitted and locked; nothing can change now (only the principal can correct it today). Say so in one short line. The trainer can choose ${other}.`,
    { step: view.flow.step },
  );
}

export const toDraftView = (s: DraftSnapshot, plan: FlowPlan): DraftView => ({
  order: s.students.map((st) => st.id),
  marks: s.marks,
  sources: s.sources,
  presets: s.presets,
  halfDayHalves: plan.details.half,
});

export const tradeList = (view: VoiceView) => view.trades.map((t) => ({ id: t.id, name: nameText(t.name) }));
export const batchInfo = (card: SessionCard, plan: FlowPlan) => ({ id: card.key, label: sessionLabel(card, plan.slotWords) });

/** The sessions as tool results list them: the id to pass back, the label, and a shut window or a submission. */
export function batchEntries(cards: readonly SessionCard[], plan: FlowPlan) {
  return cards.map((c) => {
    const window = windowNote(c);
    return { ...batchInfo(c, plan), ...(window ? { window } : {}), ...(c.status === 'submitted' ? { submitted: true } : {}) };
  });
}

/** The half and leave detail of a mark, as results name them. */
export function detailFields(mark: Mark | undefined): Record<string, string> {
  if (!mark) return {};
  return {
    ...(mark.half ? { half: mark.half === 1 ? 'first' : 'second' } : {}),
    ...(mark.leaveType ? { leave_type: mark.leaveType.toUpperCase() } : {}),
    ...(mark.leaveUntil ? { leave_until: mark.leaveUntil } : {}),
  };
}

/** Every result that opens a batch, changes marks or reports them (MVP-05 §3.5). Call only with a batch open. */
export function snapshot(view: VoiceView): Record<string, unknown> {
  const draft = openDraft(view);
  const current = currentView(view);
  const lm = view.flow.lastMarked;
  const progress = draft ? progressOf(toDraftView(draft, view.plan)) : { called: 0, total: 0 };
  return {
    step: view.flow.step,
    counts: viewCounts(view),
    progress: `${progress.called}/${progress.total}`,
    last_marked: lm ? { id: lm.id, name: studentOf(view, lm.id)?.name ?? '', status: toModelStatus(lm.status) } : null,
    ...(current ? { current } : { all_marked: true }),
    ...(byException(view) ? { by_exception: true } : {}),
  };
}

const tradesOf = (ctx: SessionContext): Trade[] =>
  ctx.access.tradeIds.map((id) => ctx.data.trades.find((t) => t.id === id)).filter((t): t is Trade => t !== undefined);

async function cardsOnOffer(deps: ExecutorDeps, flow: VoiceFlowState): Promise<SessionCard[]> {
  const { ctx, plan, attendance } = deps;
  if (plan.tradeStep) return flow.tradeId ? attendance.boardForTrade(ctx, flow.tradeId) : [];
  if (plan.selection === 'timetable') return attendance.timetableBoard(ctx);
  return (await attendance.myBoard(ctx)).flatMap((group) => group.cards);
}

/**
 * A submit code belongs to the review it was asked in (D-082): every submit ticket is issued in REVIEW, so one held
 * while the flow is anywhere else is stale (the trainer left the review by voice or on screen) and is dropped; a
 * later yes is asked again, never taken for the old question. mark_remaining's ticket lives in ROLL_CALL and stays.
 */
export function dropStaleSubmit(state: ExecState): void {
  if (state.ticket?.action === 'submit_attendance' && state.flow.step !== 'REVIEW') state.ticket = null;
}

/** A batch is open for marking in this step: the list or the review. */
export const markingStep = (step: string): boolean => step === 'ROLL_CALL' || step === 'REVIEW';

/** Another step, batch or trade: what the flow targets changed (a pointer move on the same list does not count). */
const movedOn = (a: VoiceFlowState, b: VoiceFlowState): boolean => a.step !== b.step || a.sessionKey !== b.sessionKey || a.tradeId !== b.tradeId;

export function createHandlerContext(deps: ExecutorDeps): HandlerContext {
  const { ctx, plan, drafts, bus } = deps;
  const trades = tradesOf(ctx);
  const state: ExecState = {
    flow: initialFlow(plan),
    ticket: null,
    lastNav: null,
    screen: null,
    open: [],
    named: { key: null, ids: [] },
    submitted: null,
    endRequested: false,
    cards: [],
    card: undefined,
    inFlight: new Map(),
    verify: freshVerify(null),
    askOnList: null,
  };
  const draftView = (s: DraftSnapshot) => toDraftView(s, plan);

  function draftOf(flow: VoiceFlowState): DraftSnapshot | undefined {
    const key = flow.sessionKey;
    if (!key) return undefined;
    if (markingStep(flow.step)) return drafts.get(key);
    return flow.step === 'SUBMITTED' && state.submitted?.key === key ? state.submitted.snapshot : undefined;
  }

  function viewOf(over: Partial<VoiceView> = {}): VoiceView {
    const flow = over.flow ?? state.flow;
    const key = flow.sessionKey;
    const card = over.card ?? (key ? (state.cards.find((c) => c.key === key) ?? (state.card?.key === key ? state.card : undefined)) : undefined);
    const draft = 'draft' in over ? over.draft : draftOf(flow);
    // a submit holding the open draft: voice's own while its save runs, else the screen's Submit
    const held = key && markingStep(flow.step) && drafts.isSubmitting(key) ? { submitting: state.inFlight.has(key) ? ('voice' as const) : ('screen' as const) } : {};
    return { plan, flow, trades, cards: over.cards ?? state.cards, card, draft, faceRetryLimit: ctx.journey.verification.faceRetryLimit, ...held };
  }

  async function view(): Promise<VoiceView> {
    const cards = await cardsOnOffer(deps, state.flow);
    const key = state.flow.sessionKey;
    state.cards = cards;
    state.card = key ? (cards.find((c) => c.key === key) ?? (await deps.attendance.findCard(ctx, key))) : undefined;
    return viewOf();
  }

  async function moveTo(step: (flow: VoiceFlowState) => VoiceFlowState): Promise<VoiceView> {
    let target = step(state.flow);
    for (let load = 1; ; load++) {
      const key = target.sessionKey;
      const cards = await cardsOnOffer(deps, target);
      const card = key ? (cards.find((c) => c.key === key) ?? (await deps.attendance.findCard(ctx, key))) : undefined;
      const now = step(state.flow);
      // the flow moved to another trade or batch while loading: load again for where the move lands now (bounded)
      if (load < 3 && (now.tradeId !== target.tradeId || now.sessionKey !== target.sessionKey)) {
        target = now;
        continue;
      }
      state.flow = now;
      state.cards = cards;
      state.card = card;
      return viewOf();
    }
  }

  const confirmNow = (action: ConfirmAction, key: SessionKey, argsKey: string): ConfirmNow => ({
    action,
    argsKey,
    revision: drafts.get(key)?.revision ?? -1,
    now: deps.nowMs(),
    speechSeq: deps.speechSeq(),
    turnSeq: deps.turnSeq(),
    spokeAtTurn: deps.spokeAtTurn(),
    generation: deps.generation(),
  });

  return {
    deps,
    state,
    view,
    moveTo,
    viewOf,
    draftView,
    navigate(href, replace) {
      state.lastNav = href;
      state.screen = href;
      bus.emit({ type: 'navigate', href, replace });
    },
    focus(v, fallback) {
      const studentId = v.flow.currentId ?? fallback;
      if (studentId && v.flow.sessionKey) bus.emit({ type: 'focus_student', sessionKey: v.flow.sessionKey, studentId });
    },
    issue(action, key, argsKey) {
      state.ticket = issueConfirm(confirmNow(action, key, argsKey), [deps.entropy(), deps.entropy(), deps.entropy(), deps.entropy()]);
      return state.ticket.token;
    },
    confirm(action, key, argsKey, token) {
      if (!checkConfirm(state.ticket, token, confirmNow(action, key, argsKey)).ok) return false;
      state.ticket = null;
      return true;
    },
    async openBatch(card) {
      state.askOnList = null;
      const from = state.flow;
      const roster = await deps.attendance.openRoster(ctx, card.key);
      // a tap or another tool may have moved on (or opened this batch) meanwhile: never overwrite that
      if (movedOn(from, state.flow)) return { ok: false, error: 'stale', view: await view() };
      if (!roster.ok) return { ok: false, error: roster.error };
      const opened = drafts.open(ctx, roster.value);
      let flow = state.flow;
      if (plan.tradeStep && flow.tradeId !== card.trade.id) flow = withTrade(flow, card.trade.id);
      state.flow = withBatch(flow, card.key, draftView(opened), plan.startStyle);
      return { ok: true, view: await view() };
    },
    verifyFor(key) {
      if (state.verify.key !== key) state.verify = freshVerify(key);
      return state.verify;
    },
    startVerify(key) {
      state.verify = freshVerify(key);
      return state.verify;
    },
  };
}
