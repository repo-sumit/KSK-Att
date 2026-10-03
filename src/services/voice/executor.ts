/**
 * The voice executor (voice design §5, D-079): every tool call runs through the same services and rules as
 * a tap (AttendanceService, VerificationService, MarkingDraftService, src/domain/rules.ts), and the
 * executor keeps the voice flow state, the open-names memory and the confirmation ticket. Ported from the
 * MVP's createExecutor (MVP-05 §3–4, §10; MVP-04) with KSK services in place of the zustand store; the
 * handlers live in ./handlers (context, select, marking, submit, status), the tap, screen and verification
 * hooks in ./handlers/events. No browser globals: it can move behind a relay unchanged.
 */
import type { VoiceFlowState } from '@/domain/voice/flow';
import { parseModelStatus, safeText } from '@/domain/voice/types';
import type { DraftChange, DraftSnapshot } from '@/services/marking-draft';
import type { VerificationEvent } from '@/services/verification';
import { reconnectEvent, refreshEvent, sessionStartEvent } from './app-events';
import { confirmSubmitInstruction, type VoiceView } from './instructions';
import { countsOf, word } from './labels';
import { buildTools, type ToolCall, type ToolName, type ToolResult } from './tools';
import { createHandlerContext, dropStaleSubmit, fail, has, INTERNAL_RESULT, sameId, str, type Args, type ExecutorDeps, type Handler, type HandlerContext } from './handlers/context';
import { draftChangeEvent, screenEvent, verificationHook } from './handlers/events';
import { markAttendance, markRemaining, setStudentStatus, skipStudent, startRollCall } from './handlers/marking';
import { getTrades, goBack, navigateTool, selectBatch, selectTrade, verifyAgain } from './handlers/select';
import { getStatus, endVoiceSession } from './handlers/status';
import { reviewTicket } from './handlers/review';
import { submitAttendance } from './handlers/submit';

export type { ToolCall, ToolResult } from './tools';
export type { ExecutorDeps } from './handlers/context';
export { INTERNAL_RESULT } from './handlers/context';

/** Where the screen is, from the route (Task 18's screenSignal): the executor compares it with the flow. */
export type ScreenSignal =
  | { readonly kind: 'home' }
  | { readonly kind: 'trade'; readonly tradeId: string }
  | { readonly kind: 'open' | 'mark' | 'review' | 'submitted' | 'record'; readonly sessionKey: string }
  | { readonly kind: 'other' };

export interface VoiceExecutor {
  execute(call: ToolCall): Promise<ToolResult>;
  flow(): VoiceFlowState;
  view(): Promise<VoiceView>;
  kickoff(kind: 'start' | 'reconnect', languageName: string): Promise<string>;
  /** `heard`: what the trainer last said, passed only with a pending question (never logged). */
  refresh(pendingQuestion: string | null, heard?: string): Promise<string>;
  /**
   * `quiet`: the session would drop the text (paused for Use screen, or not live). The flow follows the tap, but
   * nothing is asked: no submit code and no navigation; Resume's get_status asks with the review.
   */
  onDraftChange(change: DraftChange, quiet?: boolean): string | null;
  /**
   * `quiet` (read when the hook would ask): as for onDraftChange, the session would drop the text; the flow follows the
   * screen, but no submit code is issued and no screen is pushed (Resume's get_status asks with the review).
   */
  onScreen(signal: ScreenSignal, quiet?: () => boolean): Promise<string | null>;
  onVerification(event: VerificationEvent): Promise<string | null>;
  voidConfirmations(): void;
  readonly endRequested: boolean;
}

const HANDLERS: Readonly<Record<ToolName, Handler>> = {
  get_trades: getTrades,
  select_trade: selectTrade,
  select_batch: selectBatch,
  start_roll_call: startRollCall,
  mark_attendance: markAttendance,
  set_student_status: setStudentStatus,
  skip_student: skipStudent,
  mark_remaining: markRemaining,
  go_back: goBack,
  get_status: getStatus,
  verify_again: verifyAgain,
  navigate: navigateTool,
  submit_attendance: submitAttendance,
  end_voice_session: endVoiceSession,
};

/**
 * Run order for the calls of one toolCall message: a mark_remaining sent before set_student_status or
 * mark_attendance calls runs right after the last of them, so for "sab present, sirf Rahul aur Shivam
 * absent" its count already leaves out the named students. Everything else keeps its order (MVP-05 L474).
 */
export function toolCallOrder<T extends { name?: string }>(calls: readonly T[]): T[] {
  const last = calls.map((c) => c.name === 'set_student_status' || c.name === 'mark_attendance').lastIndexOf(true);
  const early = calls.filter((c, i) => c.name === 'mark_remaining' && i < last);
  if (!early.length) return [...calls];
  const rest = calls.filter((c) => !early.includes(c));
  const at = rest.indexOf(calls[last]) + 1;
  return [...rest.slice(0, at), ...early, ...rest.slice(at)];
}

const quoted = (o: { text: string; status: string | null }) => `"${o.text}"${o.status ? ` (${word(o.status)})` : ''}`;

/** A question that carried a confirmation code: every code is void on a new connection, so it is asked again with a new one. */
const CODED = /confirm_token "/;

/**
 * Before each call (MVP-05 §4.4): forget names of another batch, of a batch that started over (fewer
 * trainer marks than when the name was noted), and names whose students all have a trainer mark now.
 */
function prune(h: HandlerContext, draft: DraftSnapshot | undefined): void {
  const key = h.state.flow.sessionKey;
  const sourced = draft ? Object.keys(draft.sources).length : 0;
  const marked = (id: string) => !!draft && has(draft.sources, id);
  h.state.open = h.state.open.filter((o) => o.key === key && sourced >= o.marked && !(o.ids.length && o.ids.every(marked)));
  if (h.state.named.key !== key) h.state.named = { key, ids: [] };
}

/** The open-names guard (MVP-05 §4.5): while a named student could not be marked, mark_remaining is refused once. */
function openNamesFirst(h: HandlerContext, args: Args, draft: DraftSnapshot | undefined): ToolResult | null {
  const status = parseModelStatus(args.status, h.deps.plan.statuses);
  if (h.state.flow.step !== 'ROLL_CALL' || !status || !draft) return null;
  const pending = h.state.open.filter((o) => o.status !== status);
  if (!pending.some((o) => !o.asked)) return null;
  for (const o of pending) o.asked = true;
  return fail(
    'WRONG_STEP',
    `Nobody else was marked: ${pending.map(quoted).join(' and ')} could not be marked yet. Ask the trainer about that first (by father's name when two students share the name) and mark them with set_student_status, then call mark_remaining again.`,
    { unresolved: pending.map((o) => o.text), counts: countsOf(draft, h.deps.plan.statuses) },
  );
}

/** After each call (MVP-05 §4.3), with the draft as it was before the call. */
function remember(h: HandlerContext, name: ToolName, args: Args, result: ToolResult, draft: DraftSnapshot | undefined): void {
  const key = draft?.key;
  if (!key) return;
  const status = parseModelStatus(args.status, h.deps.plan.statuses);
  const marked = Object.keys(draft.sources).length;
  if (name === 'set_student_status' && (result.error === 'NOT_FOUND' || result.error === 'AMBIGUOUS')) {
    const ids = ((result.candidates as { id: string }[] | undefined) ?? []).map((c) => c.id);
    h.state.open.push({ key, text: safeText(str(args.student), 60), status, ids, marked, asked: false });
  } else if (name === 'set_student_status' && result.ok) {
    const id = (result.student as { id: string }).id;
    const fresh = result.fresh === true;
    h.state.open = h.state.open.filter((o) => !o.ids.includes(id) && !(fresh && !o.ids.length)); // that name is sorted out
    if (fresh) h.state.named.ids.push(id);
  } else if (name === 'mark_attendance' && result.error === 'NOT_CURRENT') {
    const st = draft.students.find((x) => sameId(x.id, str(args.student_id)));
    if (st && !has(draft.sources, st.id)) h.state.open.push({ key, text: safeText(st.name, 60), status, ids: [st.id], marked, asked: false });
  } else if (result.ok && (name === 'mark_attendance' || name === 'skip_student' || name === 'mark_remaining')) {
    h.state.named.ids = []; // the roll call moved on
    if (name === 'mark_remaining') h.state.open = [];
  }
}

export function createExecutor(deps: ExecutorDeps): VoiceExecutor {
  const h = createHandlerContext(deps);
  // A feature that is switched off has no tool (D-081): an undeclared name is unknown, whatever the model sends.
  const declared = new Set<string>(buildTools(deps.plan).map((t) => t.name));
  const draftNow = () => (h.state.flow.sessionKey ? deps.drafts.get(h.state.flow.sessionKey) : undefined);

  async function run(name: string, args: Args): Promise<ToolResult> {
    if (!declared.has(name)) return fail('UNKNOWN_TOOL', `The app has no tool called ${safeText(name, 60) || 'that'}. Use only the tools you were given.`);
    const tool = name as ToolName;
    const before = draftNow();
    prune(h, before);
    dropStaleSubmit(h.state); // a code from a review the trainer has left
    if (tool === 'mark_remaining') {
      const refused = openNamesFirst(h, args, before);
      if (refused) return refused;
    }
    const result = await HANDLERS[tool](h, args);
    remember(h, tool, args, result, before);
    dropStaleSubmit(h.state);
    return result;
  }

  return {
    async execute(call) {
      const args: Args = call.args && typeof call.args === 'object' && !Array.isArray(call.args) ? call.args : {};
      try {
        return await run(typeof call.name === 'string' ? call.name : '', args);
      } catch {
        return { ...INTERNAL_RESULT };
      }
    },
    flow: () => h.state.flow,
    view: () => h.view(),
    // Called after the new connection voided every code (D-082): a code issued here is bound to that connection.
    // At the review, while a submit could go ahead, the text asks the submit question with it, so one yes submits.
    async kickoff(kind, languageName) {
      const view = await h.view();
      if (kind === 'start') return sessionStartEvent(view, languageName);
      const token = reviewTicket(h, view);
      return reconnectEvent(token ? confirmSubmitInstruction(view, token) : null);
    },
    async refresh(pendingQuestion, heard = '') {
      const view = await h.view();
      const coded = !!pendingQuestion && CODED.test(pendingQuestion);
      // a pending question without a code (which of two students) is asked again as it was; one with a code is asked
      // with a code issued now, or, when none can be (submitted meanwhile, back on the list), the step hint stands
      const token = !pendingQuestion || coded ? reviewTicket(h, view) : null;
      const question = token ? confirmSubmitInstruction(view, token) : coded ? null : pendingQuestion;
      return refreshEvent(view, question, question && pendingQuestion ? heard : '', !!pendingQuestion);
    },
    onDraftChange: (change, quiet = false) => draftChangeEvent(h, change, quiet),
    onScreen: (signal, quiet) => screenEvent(h, signal, quiet).finally(() => dropStaleSubmit(h.state)),
    onVerification: (event) => verificationHook(h, event).finally(() => dropStaleSubmit(h.state)),
    voidConfirmations() {
      h.state.ticket = null;
    },
    get endRequested() {
      return h.state.endRequested;
    },
  };
}
