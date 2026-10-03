/**
 * The submit question asked with its code (D-082, Task 23 Part A): whenever a result or an [APP] text asks the
 * trainer whether to submit, the flow is in REVIEW and the text carries a code issued for that question, so one
 * clear yes submits, provided a submit could go ahead now. When it cannot (nothing open, a submit running,
 * someone or a detail missing, the window shut), no code is issued and the caller's text stands; submit_attendance
 * then says why. The ticket is the usual one: this draft revision and connection, good only after the trainer
 * speaks again, voided by any change.
 */
import { completenessIssues } from '@/domain/marking';
import type { SessionKey } from '@/domain/attendance';
import { withReview } from '@/domain/voice/flow';
import { routes } from '@/lib/routes';
import { byException, confirmSubmitInstruction, currentView, openDraft, stepHint, type VoiceView } from '../instructions';
import type { ToolResult } from '../tools';
import { fail, type HandlerContext } from './context';

/** The review (PRD 12.1: the counts before a final submit) on screen, unless the screen already shows it, and its ticket. */
export function askReview(h: HandlerContext, key: SessionKey): string {
  const href = routes.review(key);
  if (h.state.screen !== href) h.navigate(href, false); // a skipped navigation leaves lastNav alone: no screen signal will come
  return h.issue('submit_attendance', key, key);
}

/** The code of a submit ticket for a view in REVIEW, issued with the review on screen; null (no ticket) when a submit could not go ahead now. */
export function reviewTicket(h: HandlerContext, view: VoiceView): string | null {
  const key = view.flow.sessionKey;
  const draft = openDraft(view);
  if (view.flow.step !== 'REVIEW' || !key || !draft || draft.locked || h.state.inFlight.has(key) || h.deps.drafts.isSubmitting(key)) return null;
  if (completenessIssues(draft.marks, h.deps.ctx.config.marking).length || view.card?.status === 'closed') return null;
  return askReview(h, key);
}

/**
 * The list is done: nobody is being called and nobody is left to call (a roll call that ran out, or the list the
 * trainer went back to from the review). Never while marking by exception, which waits for "that is all".
 */
export const listDone = (view: VoiceView): boolean => view.flow.step === 'ROLL_CALL' && !!openDraft(view) && !byException(view) && !currentView(view);

/** Marking is done (the caller says when): the flow moves to the review once nobody misses a status or a detail. */
export function toReview(h: HandlerContext): VoiceView {
  const key = h.state.flow.sessionKey;
  const draft = key ? h.deps.drafts.get(key) : undefined;
  if (draft && !completenessIssues(draft.marks, h.deps.ctx.config.marking).length) h.state.flow = withReview(h.state.flow);
  return h.viewOf();
}

/** The code field beside an instruction that names it. */
export const tokenField = (token: string | null): Record<string, string> => (token ? { confirm_token: token } : {});

/** The step hint; in the review, the submit question with its code. */
export function hintOf(h: HandlerContext, view: VoiceView): { readonly instruction: string; readonly token: string | null } {
  const token = reviewTicket(h, view);
  return { instruction: token ? `Everyone is marked. ${confirmSubmitInstruction(view, token)}` : stepHint(view), token };
}

/** WRONG_STEP with the step hint (in the review, the submit question with its code). */
export function stepNow(h: HandlerContext, view: VoiceView): ToolResult {
  const hint = hintOf(h, view);
  return fail('WRONG_STEP', hint.instruction, { step: view.flow.step, ...tokenField(hint.token) });
}
