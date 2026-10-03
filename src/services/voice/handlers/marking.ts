/**
 * Marking tools: start_roll_call, mark_attendance, set_student_status, skip_student, mark_remaining. Ported
 * from the MVP handlers (MVP-05 §3.3, §4.6, §5.6, §6; MVP-04 §4.4–4.8) with the shared draft in place of
 * the store: every mark goes through MarkingDraftService (OJT stays locked there), and the flow moves only
 * after the draft recorded the trainer's source (withMarked). Checks run in the MVP order: step, status,
 * student, OJT, detail; a wrong status is reported before an unknown student (MVP-05 L988). A result that
 * leaves everyone marked moves to the review and asks the submit question with its code (./review), so one
 * clear yes submits; mark_remaining's check question in the review carries none.
 */
import { routes } from '@/lib/routes';
import { addDays, type LocalDate } from '@/lib/time';
import { parseSessionKey } from '@/domain/attendance';
import { LEAVE_TYPES, type Mark, type StatusCode } from '@/domain/status';
import { uncalledIds, withMarked, withRemaining, withRollCall, withSkip } from '@/domain/voice/flow';
import { resolveStudent } from '@/domain/voice/match';
import { parseModelStatus, safeText, toModelStatus } from '@/domain/voice/types';
import {
  afterMark, askExceptions, byException, confirmRemainingInstruction, confirmSubmitInstruction, countsText, currentView, defaultOf, openDraft,
  othersText, stepHint, studentOf, viewCounts, type VoiceView,
} from '../instructions';
import { first, nameText, studentView, word, type StudentView } from '../labels';
import type { ToolResult } from '../tools';
import { detailFields, fail, has, labelOf, locked, sameId, snapshot, str, wrongStep, type Args, type Handler, type HandlerContext } from './context';
import { listDone, reviewTicket, toReview, tokenField } from './review';

/** The longest leave set in one go (PRD 9.5 date range, MVP MAX_LEAVE_DAYS). */
const MAX_LEAVE_DAYS = 60;

/**
 * The step guard of the current-student tools (MVP rollCallOnly). In the review it asks the submit question with its
 * code; while a submit saves the draft it says so instead (no question).
 */
function rollCallOnly(h: HandlerContext, view: VoiceView): ToolResult | null {
  const { step } = view.flow;
  if (step === 'SUBMITTED') return locked(view);
  if (step === 'REVIEW' && openDraft(view)) {
    const token = reviewTicket(h, view);
    if (token) return fail('WRONG_STEP', `Everyone is already marked. ${confirmSubmitInstruction(view, token)}`, { step, confirm_token: token });
    if (view.submitting) return fail('SUBMITTING', stepHint(view), { step });
    return fail('WRONG_STEP', `Everyone is already marked (${countsText(viewCounts(view))}). To change someone use set_student_status. Say submit is final and ask whether to submit.`, { step });
  }
  return step === 'ROLL_CALL' && openDraft(view) ? null : wrongStep(view);
}

/** set_student_status and start_roll_call: the list or the review of an open batch. */
function markingOnly(view: VoiceView): ToolResult | null {
  const { step } = view.flow;
  if (step === 'SUBMITTED') return locked(view);
  return (step === 'ROLL_CALL' || step === 'REVIEW') && openDraft(view) ? null : wrongStep(view);
}

/**
 * A submit is saving the draft (the screen's Submit, or voice's own): the draft takes no change until it ends, so
 * the change is refused here, never confirmed and then left out of the record.
 */
function savingNow(h: HandlerContext, view: VoiceView): ToolResult | null {
  const key = view.flow.sessionKey;
  if (!key || !h.deps.drafts.isSubmitting(key)) return null;
  return fail(
    'SUBMITTING',
    `The attendance of ${labelOf(view)} is being submitted right now, so this change was not made and is not part of it. Say so in one short line, then wait for the trainer.`,
    { step: view.flow.step },
  );
}

function invalidStatus(view: VoiceView, value: unknown): ToolResult {
  const allowed = view.plan.statuses.map(toModelStatus);
  const cur = currentView(view);
  return fail('INVALID_STATUS', `"${nameText(str(value))}" is not a status. Use one of ${allowed.join(', ')}.${cur ? ` Ask again: ${cur.call_as}?` : ''}`, { allowed });
}

/** mark_attendance / skip_student with nobody being called (MVP noneCalled). */
function noneCalled(view: VoiceView): ToolResult {
  const def = defaultOf(view.plan);
  if (!byException(view) || !def) return fail('NO_CURRENT', `Nobody is being called now. Use set_student_status for the student the trainer named. ${stepHint(view)}`, { step: view.flow.step });
  return fail('NO_CURRENT', `Nobody is being called: every student is ${word(def)} unless the trainer names them. Use set_student_status for the student the trainer named, then ${askExceptions(view)}.`, { step: view.flow.step });
}

/**
 * The half or leave detail from the arguments (PRD 9.4, 9.5; MVP detailFor). A detail the state needs but
 * the trainer did not give is one question, before anything changes. The same status keeps its earlier
 * detail ("Neha abhi bhi leave pe hai" keeps a carried leave's type and end). `leave_days` counts the
 * session date as day 1; one day sets an explicit `leaveUntil: undefined`, which shortens a longer leave.
 */
function detailFor(view: VoiceView, status: StatusCode, args: Args, who: string, prev: Mark | undefined, date: LocalDate): { mark: Mark } | { error: ToolResult } {
  const { details } = view.plan;
  const same = prev?.status === status ? prev : undefined;
  let mark: Mark = { status };
  if (status === 'half_day' && details.half) {
    const said = str(args.half).toLowerCase();
    const half = said === 'first' ? 1 : said === 'second' ? 2 : same?.half;
    if (!half) return { error: fail('NEEDS_DETAIL', `Ask in a few words, in the trainer's language: ${who}, first half or second half? Then call this tool again with half.`, { need: 'half' }) };
    mark = { ...mark, half };
  }
  if (status === 'leave' && details.leaveType) {
    const type = LEAVE_TYPES.find((t) => t === str(args.leave_type).toLowerCase()) ?? same?.leaveType;
    if (!type) {
      const leaveTypes = LEAVE_TYPES.map((t) => t.toUpperCase());
      return { error: fail('NEEDS_DETAIL', `Ask in a few words which leave ${who} is on: ${LEAVE_TYPES.join(', ')}. Then call this tool again with leave_type.`, { need: 'leave_type', leave_types: leaveTypes }) };
    }
    mark = { ...mark, leaveType: type };
  }
  if (status === 'leave' && details.leaveDays && str(args.leave_days) !== '') {
    const days = Math.round(Number(args.leave_days));
    if (!(days >= 1 && days <= MAX_LEAVE_DAYS)) return { error: fail('INVALID', `leave_days must be 1 to ${MAX_LEAVE_DAYS} (today is day 1). Ask how many days, including today.`) };
    mark = { ...mark, leaveUntil: days > 1 ? addDays(date, days - 1) : undefined };
  }
  return { mark };
}

const sessionDate = (view: VoiceView): LocalDate => view.card?.address.date ?? parseSessionKey(view.flow.sessionKey ?? '')?.date ?? '';

/**
 * Writes one trainer mark by voice, then moves the flow (only once the draft holds the source). A mark that
 * leaves the list done (the trainer went back to it from the review) moves to the review, as the last mark of
 * a roll call does.
 */
function applyMark(h: HandlerContext, view: VoiceView, sv: StudentView, mark: Mark, args: Args): { next: VoiceView; fresh: boolean } | null {
  const key = view.flow.sessionKey;
  const before = openDraft(view);
  if (!key || !before || !mark.status) return null;
  const after = h.deps.drafts.setMark(key, sv.id, mark, { via: 'voice', heard: safeText(args.heard, 160) });
  if (!after || !has(after.sources, sv.id)) return null;
  h.state.flow = withMarked(h.state.flow, h.draftView(after), sv.id, mark.status);
  if (listDone(h.viewOf({ draft: after }))) toReview(h);
  const next = h.viewOf({ flow: h.state.flow, draft: after });
  h.focus(next, sv.id);
  return { next, fresh: !has(before.sources, sv.id) };
}

export const markAttendance: Handler = async (h, args) => {
  const view = await h.view();
  const guard = savingNow(h, view) ?? rollCallOnly(h, view);
  if (guard) return guard;
  const cur = currentView(view);
  if (!cur) return noneCalled(view);
  if (!sameId(str(args.student_id), cur.id)) {
    return fail('NOT_CURRENT', `The current student is ${cur.call_as}. To change an earlier student use set_student_status. Ask about ${cur.call_as} now.`, { current: cur });
  }
  const status = parseModelStatus(args.status, view.plan.statuses);
  if (!status) return invalidStatus(view, args.status);
  const detail = detailFor(view, status, args, cur.call_as, undefined, sessionDate(view));
  if ('error' in detail) return detail.error;
  const prevCurrentId = h.state.flow.currentId;
  const done = applyMark(h, view, cur, detail.mark, args);
  if (!done) return wrongStep(await h.view());
  const mark = done.next.draft?.marks[cur.id];
  const token = reviewTicket(h, done.next);
  return {
    ok: true,
    marked: { name: cur.name, status: toModelStatus(status), ...detailFields(mark) },
    ...snapshot(done.next),
    ...tokenField(token),
    instruction: afterMark(done.next, cur, status, { via: 'mark_attendance', prevCurrentId, ...(token ? { submitToken: token } : {}) }),
  };
};

export const setStudentStatus: Handler = async (h, args) => {
  const view = await h.view();
  const guard = markingOnly(view) ?? savingNow(h, view);
  if (guard) return guard;
  const status = parseModelStatus(args.status, view.plan.statuses);
  if (!status) return invalidStatus(view, args.status);
  const draft = openDraft(view)!;
  const asked = str(args.student);
  const match = resolveStudent(asked, draft.students);
  if (match.kind === 'none') {
    return fail('NOT_FOUND', `There is no "${nameText(asked)}" in ${labelOf(view)}. Ask the trainer to say the name again, then mark that student ${word(status)}.`);
  }
  if (match.kind === 'ambiguous') {
    const candidates = match.candidates.map((st) => studentView(st, draft.students));
    return fail(
      'AMBIGUOUS',
      `More than one student matches "${nameText(asked)}": ${candidates.map((c) => c.call_as).join('; ')}. Ask which one, by father's name, then mark that student ${word(status)} with set_student_status and that student's id.`,
      { candidates: candidates.map((c) => ({ id: c.id, name: c.name, father_name: c.father_name, roll: c.roll })) },
    );
  }
  const sv = studentView(match.value, draft.students);
  const prev = draft.marks[sv.id];
  if (prev?.status === 'ojt') {
    return fail('LOCKED_OJT', `${sv.call_as} is on OJT (on-the-job training) today, set by the principal; that cannot be changed here. Say so in a few words.`);
  }
  const detail = detailFor(view, status, args, sv.call_as, prev, sessionDate(view));
  if ('error' in detail) return detail.error;
  const prevCurrentId = h.state.flow.currentId;
  const done = applyMark(h, view, sv, detail.mark, args);
  if (!done) return wrongStep(await h.view());
  const token = reviewTicket(h, done.next);
  return {
    ok: true,
    student: { id: sv.id, name: sv.name, roll: sv.roll },
    old_status: prev?.status ? toModelStatus(prev.status) : 'UNMARKED',
    new_status: toModelStatus(status),
    fresh: done.fresh,
    ...detailFields(done.next.draft?.marks[sv.id]),
    ...snapshot(done.next),
    ...tokenField(token),
    instruction: afterMark(done.next, sv, status, { via: 'set_student_status', prevCurrentId, fresh: done.fresh, ...(token ? { submitToken: token } : {}) }),
  };
};

export const skipStudent: Handler = async (h, args) => {
  const view = await h.view();
  const guard = rollCallOnly(h, view);
  if (guard) return guard;
  const cur = currentView(view);
  if (!cur) return noneCalled(view);
  if (!sameId(str(args.student_id), cur.id)) {
    return fail('NOT_CURRENT', `The current student is ${cur.call_as}. Only the current student can be skipped. Ask about ${cur.call_as}.`, { current: cur });
  }
  h.state.flow = withSkip(h.state.flow, h.draftView(openDraft(view)!), cur.id);
  const next = h.viewOf({ flow: h.state.flow });
  const after = currentView(next);
  h.focus(next);
  const instruction =
    !after || after.id === cur.id
      ? `Only ${cur.call_as} is left. Ask for their status again.`
      : `Say you will come back to ${first(cur.name)} later, in a few words. Then call out: ${after.call_as}. Then stop and wait.`;
  return { ok: true, skipped: { id: cur.id, name: cur.name }, ...snapshot(next), instruction };
};

export const startRollCall: Handler = async (h) => {
  const view = await h.view();
  const guard = markingOnly(view);
  if (guard) return guard;
  const prev = h.state.flow;
  const flow = withRollCall(prev, h.draftView(openDraft(view)!));
  const next = h.viewOf({ flow });
  const cur = currentView(next);
  if (!cur) {
    // everyone already has a source: nobody to call, so the review
    h.state.flow = flow;
    const done = toReview(h);
    const token = reviewTicket(h, done);
    const instruction = token
      ? `Every student is already marked. Say so. ${confirmSubmitInstruction(done, token)}`
      : done.submitting
        ? `Every student is already marked. ${stepHint(done)}`
        : `Every student is already marked: ${countsText(viewCounts(done))}. Say so, say submit is final and ask whether to submit.`;
    return { ok: true, ...snapshot(done), ...tokenField(token), instruction };
  }
  h.state.flow = flow;
  // from the review back to the list (the review screen's own Back does the same)
  if (prev.step === 'REVIEW' && flow.sessionKey) h.navigate(routes.mark(flow.sessionKey), true);
  h.focus(next);
  const lead = prev.rollCall ? 'The names are already being called.' : 'Now every name is called in turn; students already marked are not called again.';
  return { ok: true, ...snapshot(next), instruction: `${lead} Call out: ${cur.call_as}. Then stop and wait.` };
};

/** The open-names guard has already run in the executor (MVP-05 §4.5); this is the MVP handler with tokens (D-082). */
export const markRemaining: Handler = async (h, args) => {
  const view = await h.view();
  const saving = savingNow(h, view); // nothing is changed or checked while a submit saves the draft
  if (saving) return saving;
  const status = parseModelStatus(args.status, view.plan.statuses);
  const draft = openDraft(view);
  if (view.flow.step === 'REVIEW' && status && draft) {
    // "Nahi, sab present, sirf Rahul absent" after everyone is marked: one check question, never also a yes to submitting,
    // so an open submit code is dropped (a yes to the check is not a yes to the submit).
    h.state.ticket = null;
    const others = othersText(view, status, draft.students.map((st) => studentView(st, draft.students)));
    const head = `Everyone is already marked (${countsText(viewCounts(view))}), so nobody was changed.`;
    if (others) {
      const check = ` Not ${word(status)}: ${others}. Read that out in one line and ask only whether it is right. On a yes, call submit_attendance (it reads the counts and asks once, with its code); if the trainer names someone, change them with set_student_status.`;
      return fail('WRONG_STEP', `${head}${check}`, { step: view.flow.step });
    }
    // nobody to check: the submit question itself, with its code
    const token = reviewTicket(h, view);
    const ask = token ? ` ${confirmSubmitInstruction(view, token)}` : ' Say submit is final and ask whether to submit.';
    return fail('WRONG_STEP', `${head}${ask}`, { step: view.flow.step, ...tokenField(token) });
  }
  const guard = rollCallOnly(h, view);
  if (guard) return guard;
  if (!status) return invalidStatus(view, args.status);
  const key = view.flow.sessionKey!;
  if (byException(view) && status === defaultOf(view.plan)) {
    // "baaki sab present": that is all, so the review
    const done = toReview(h);
    const token = reviewTicket(h, done);
    const said = `Everyone not named is already ${word(status)}: ${countsText(viewCounts(done))}. Say that in one line`;
    return { ok: true, count_marked: 0, ...snapshot(done), ...tokenField(token), instruction: token ? `${said}. ${confirmSubmitInstruction(done, token)}` : `${said}, say submit is final and ask whether to submit.` };
  }
  const ids = uncalledIds(h.draftView(draft!));
  if (!ids.length) {
    const done = listDone(view) ? toReview(h) : view;
    const token = reviewTicket(h, done);
    return { ok: true, count_marked: 0, ...snapshot(done), ...tokenField(token), instruction: `Nobody is left to mark. ${token ? `Everyone is marked. ${confirmSubmitInstruction(done, token)}` : stepHint(done)}` };
  }
  const argsKey = `${key}|${status}`;
  if (!h.confirm('mark_remaining', key, argsKey, args.confirm_token)) {
    const token = h.issue('mark_remaining', key, argsKey);
    const named = h.state.named.ids.map((id) => studentOf(view, id)).filter((sv): sv is StudentView => sv !== null);
    const open = h.state.open.filter((o) => o.status !== status).map((o) => ({ text: o.text, status: o.status }));
    return fail('NEEDS_CONFIRMATION', confirmRemainingInstruction(view, ids.length, status, token, named, open), { count: ids.length, counts: viewCounts(view), confirm_token: token });
  }
  const after = h.deps.drafts.setMany(key, ids, { status }, { via: 'voice', heard: 'mark_remaining' });
  if (!after) return wrongStep(await h.view());
  h.state.flow = withRemaining(h.state.flow, h.draftView(after));
  // everyone not called is marked now: by exception too, the batch is complete, so the review
  if (h.state.flow.step === 'ROLL_CALL' && !h.state.flow.currentId) toReview(h);
  const next = h.viewOf({ flow: h.state.flow, draft: after });
  h.focus(next);
  const token = reviewTicket(h, next);
  const instruction = token
    ? `Say everyone is marked. ${confirmSubmitInstruction(next, token)}`
    : `Say everyone is marked: ${countsText(viewCounts(next))}. Say submit is final and ask whether to submit.`;
  return { ok: true, count_marked: ids.length, ...snapshot(next), ...tokenField(token), instruction };
};
