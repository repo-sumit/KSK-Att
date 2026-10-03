/**
 * Selection tools: get_trades, select_trade, select_batch, go_back, verify_again, navigate. Ported from the
 * MVP handlers (MVP-05 §3.3, §7, §8, §13; MVP-04 §4.1–4.3, §4.9, §4.12–4.13) with KSK services: the trade
 * board and the trainer's lists come from AttendanceService, the check from VerificationService, and the
 * roster only through openRoster (INV-16). Leaving a batch never asks: its marks stay in the draft (D-083).
 * Navigation follows the tap flow's history: forward steps push (D-085). Whatever can throw is awaited before
 * the flow and the screen move, so a failure leaves both as they were.
 */
import type { OpenRosterError, SessionCard } from '@/services/attendance';
import { uncalledIds, withBatchList, withOpening, withTrade, withTradeList } from '@/domain/voice/flow';
import { resolveSession, resolveTrade } from '@/domain/voice/match';
import { routes } from '@/lib/routes';
import { needText } from '../app-events';
import { currentView, openBatchInstruction, readSessions, readTrades, stepHint, verifyingInstruction, type VoiceView } from '../instructions';
import { nameText, sessionLabel, spokenTime } from '../labels';
import type { ToolResult } from '../tools';
import { batchEntries, batchInfo, fail, snapshot, str, tradeList, wrongStep, type Handler, type HandlerContext } from './context';
import { hintOf, reviewTicket, stepNow, toReview, tokenField } from './review';

export const getTrades: Handler = async (h) => {
  const view = await h.view();
  const { step } = view.flow;
  // A trade tapped while the model was greeting: say what the screen needs now, not "which trade?".
  const hint = step === 'SELECT_TRADE' || step === 'IDLE' || step === 'SUBMITTED' ? { instruction: readTrades(view.trades), token: null } : hintOf(h, view);
  return { ok: true, step, trades: tradeList(view), ...tokenField(hint.token), instruction: hint.instruction };
};

/** select_trade and go_back answer with the list, never with a batch (MVP-04 §2.3). */
function batchListResult(view: VoiceView): ToolResult {
  const trade = view.trades.find((t) => t.id === view.flow.tradeId);
  return {
    ok: true,
    step: view.flow.step,
    ...(view.plan.tradeStep && trade ? { trade: { id: trade.id, name: nameText(trade.name) } } : {}),
    batches: batchEntries(view.cards, view.plan),
    counts: null,
    last_marked: null,
    current: null,
    instruction: readSessions(view),
  };
}

/** The trade picker shows a trade's batches on their own route; the switcher keeps the trade in Home's local state. */
function showTrade(h: HandlerContext, tradeId: string, from: VoiceView['flow']): void {
  if (h.deps.plan.selection !== 'trade_switcher') return h.navigate(routes.trade(tradeId), false);
  if (from.step !== 'SELECT_TRADE' && from.step !== 'SELECT_BATCH') h.navigate(routes.home, false);
  h.deps.bus.emit({ type: 'show_trade', tradeId });
}

export const selectTrade: Handler = async (h, args) => {
  const before = await h.view();
  const asked = str(args.trade);
  const match = resolveTrade(asked, before.trades);
  const names = before.trades.map((t) => nameText(t.name));
  if (match.kind === 'none') {
    return fail('NOT_FOUND', `"${nameText(asked)}" is not a trade here. Say so briefly and read the trades: ${names.join(', ')}. Ask which one.`, { suggestions: names });
  }
  if (match.kind === 'ambiguous') {
    const suggestions = match.candidates.map((t) => nameText(t.name));
    return fail('AMBIGUOUS', `That could be ${suggestions.join(' or ')}. Ask which one.`, { suggestions });
  }
  const from = h.state.flow;
  const view = await h.moveTo((flow) => withTrade(flow, match.value.id));
  showTrade(h, match.value.id, from);
  return batchListResult(view);
};

/** A window time read out ("2:00 pm"), from the card the service returned. */
function windowTimes(card: SessionCard): Record<string, string> {
  const w = card.scheduled.window;
  return w ? { opens: spokenTime(card.address.date, w.start), closes: spokenTime(card.address.date, w.end) } : {};
}

/** Why a session cannot be opened, as the model says it (MVP-04 §4.3). */
function refusal(h: HandlerContext, view: VoiceView, card: SessionCard, error: OpenRosterError): ToolResult {
  const label = sessionLabel(card, view.plan.slotWords);
  const times = windowTimes(card);
  switch (error) {
    case 'already_submitted':
      // the record replaces nothing: like a tap on a submitted card, it is pushed; the open batch is left (marks kept)
      h.deps.drafts.close(card.key, { kind: 'closed', via: 'system' }); // a live draft of a submitted batch is stale
      if (h.state.flow.sessionKey) h.state.flow = withBatchList(h.state.flow);
      h.navigate(routes.record(card.key), false);
      return fail('ALREADY_SUBMITTED', `${label} was already submitted today and is locked; the screen shows what was saved. Say so in one short line and ask for another batch.`, { batch: batchInfo(card, view.plan) });
    case 'window_not_open':
      return fail('WINDOW_NOT_OPEN', `The attendance window for ${label} opens at ${times.opens ?? 'a later time'}. Say so in one line and ask for another batch.`, times);
    case 'window_closed':
      return fail('WINDOW_CLOSED', `The attendance window for ${label} closed at ${times.closes ?? 'an earlier time'} today, so it cannot be marked now; only the principal can correct it. Say so in one line and ask for another batch.`, times);
    case 'no_access':
      return fail('NO_ACCESS', `${label} is not one of the trainer's batches, so it cannot be marked here. Say so in one line and ask for another batch.`);
    case 'not_downloaded':
      return fail('OFFLINE_NOT_DOWNLOADED', `There is no connection and ${label} is not saved on this phone, so it cannot be opened now. Say so in one line.`);
    case 'needs_connection':
      return fail('NEEDS_CONNECTION', `There is no connection, and marking needs one. Say so in one line.`);
    default: {
      const hint = hintOf(h, view);
      return fail('NOT_FOUND', `${label} cannot be marked today. ${hint.instruction}`, tokenField(hint.token));
    }
  }
}

/** The checks the card already answers, in the order openRoster makes them. */
function precheck(card: SessionCard, online: boolean): OpenRosterError | null {
  if (card.status === 'submitted') return 'already_submitted';
  if (card.status === 'future') return 'window_not_open';
  if (card.status === 'closed') return 'window_closed';
  if (!card.canMark) return 'no_access';
  return !online && !card.downloaded ? 'not_downloaded' : null;
}

/** VERIFY: the gateway checks location (and face) before the names (MVP-11 §3.2). */
function toGateway(h: HandlerContext, card: SessionCard): ToolResult {
  const { ctx, plan } = h.deps;
  let flow = h.state.flow;
  if (plan.tradeStep && flow.tradeId !== card.trade.id) flow = withTrade(flow, card.trade.id);
  h.state.flow = withOpening(flow, card.key);
  const memory = h.startVerify(card.key); // the gateway screen starts its own count again
  h.navigate(routes.open(card.key), false);
  const view = h.viewOf({ card, draft: undefined });
  const label = sessionLabel(card, plan.slotWords);
  let instruction = verifyingInstruction(view);
  if (ctx.journey.faceEnrolmentRequired && plan.verification.face) {
    // the gateway sends the trainer to face registration first; its own prompt for that would say it again
    memory.prompts.add(`session:${card.key}|face_enrolment`);
    memory.need = 'face_enrolment';
    instruction = `Before the student list, the trainer must register their face on the screen first. Say in one short line, in the trainer's language: please follow the screen to register your face. Then stop and wait: the app tells you when the list of ${label} is open.`;
  }
  return { ok: true, step: 'VERIFY', batch: batchInfo(card, plan), total: card.studentCount, instruction };
}

export const selectBatch: Handler = async (h, args) => {
  const { ctx, plan, verification } = h.deps;
  const view = await h.view();
  const trade = view.trades.find((t) => t.id === view.flow.tradeId);
  if (plan.tradeStep && !trade) return fail('NO_TRADE_SELECTED', `Choose the trade first. ${readTrades(view.trades)}`);
  const choices = view.cards.map((card) => ({ key: card.key, shift: card.batch.shift, unit: card.batch.unit, tradeName: card.trade.name, slot: card.address.slot, card }));
  const match = resolveSession(str(args.batch), choices);
  if (match.kind === 'none') {
    const period = plan.slotWords === 'period';
    const list = view.cards.map((c) => sessionLabel(c, plan.slotWords)).join('; ');
    const head = trade ? `${nameText(trade.name)} has these batches` : `Today's ${period ? 'periods' : 'batches'} are`;
    const hint = period ? ' Pass a period as "period <n>" (a number alone is read as a shift).' : '';
    return fail('NOT_FOUND', `${head}: ${list || 'none'}. Read them and ask which one.${hint}`, { batches: batchEntries(view.cards, plan) });
  }
  if (match.kind === 'ambiguous') {
    const cards = match.candidates.map((c) => c.card);
    return fail('AMBIGUOUS', `That matches ${cards.map((c) => sessionLabel(c, plan.slotWords)).join(' or ')}. Ask which one.`, { batches: batchEntries(cards, plan) });
  }
  const card = match.value.card;
  const { flow } = h.state;
  if (flow.sessionKey === card.key && (flow.step === 'ROLL_CALL' || flow.step === 'REVIEW') && view.draft) {
    // the list back on screen (voice may have shown Home meanwhile); in the review, hintOf shows the review
    if (flow.step === 'ROLL_CALL' && h.state.screen !== routes.mark(card.key)) h.navigate(routes.mark(card.key), false);
    const hint = hintOf(h, view);
    return { ok: true, batch: batchInfo(card, plan), total: card.studentCount, ...snapshot(view), ...tokenField(hint.token), instruction: `This batch is already open. ${hint.instruction}` };
  }
  const refused = precheck(card, h.deps.isOnline());
  if (refused) return refusal(h, view, card, refused);
  const passed = !plan.verification.required || (await verification.hasPass(ctx, { kind: 'session', key: card.key }));
  if (!passed) {
    const waiting = h.state.flow.step === 'VERIFY' && h.state.flow.sessionKey === card.key;
    return waiting ? { ok: true, step: 'VERIFY', instruction: stepHint(view) } : toGateway(h, card);
  }
  const opened = await h.openBatch(card);
  if (!opened.ok) {
    if (opened.error === 'stale') return stepNow(h, opened.view); // a tap or another tool moved on meanwhile
    return opened.error === 'not_verified' ? toGateway(h, card) : refusal(h, view, card, opened.error);
  }
  // everyone already has a status (OJT, carried leave, earlier marks): nobody to call or ask about, so the review
  const draft = opened.view.draft;
  const done = draft && !uncalledIds(h.draftView(draft)).length ? toReview(h) : opened.view;
  // only one screen is pushed: the list, or the review alone (a list pushed first could send its screen signal and
  // take the review back to the list, voiding the code)
  const review = routes.review(card.key);
  if (done.flow.step !== 'REVIEW') h.navigate(routes.mark(card.key), false);
  const token = reviewTicket(h, done); // pushes the review with its code
  if (done.flow.step === 'REVIEW' && h.state.screen !== review) h.navigate(review, false);
  h.focus(done);
  return { ok: true, batch: batchInfo(card, plan), total: card.studentCount, ...snapshot(done), ...tokenField(token), instruction: openBatchInstruction(done, token ?? undefined) };
};

export const goBack: Handler = async (h, args) => {
  const { plan, bus } = h.deps;
  const toBatch = !plan.tradeStep || str(args.to).toLowerCase() === 'batch';
  if (!toBatch) {
    const view = await h.moveTo(withTradeList);
    h.navigate(routes.home, false);
    return { ok: true, step: 'SELECT_TRADE', trades: tradeList(view), counts: null, last_marked: null, current: null, instruction: readTrades(view.trades) };
  }
  if (plan.tradeStep && !h.state.flow.tradeId) return fail('NO_TRADE_SELECTED', `No trade is chosen yet. ${readTrades(h.viewOf().trades)}`);
  const view = await h.moveTo(withBatchList);
  const { tradeId } = view.flow; // read after the load: a trade tapped meanwhile is where the list is
  if (plan.selection === 'trade_picker' && tradeId) h.navigate(routes.trade(tradeId), false);
  else h.navigate(routes.home, false);
  if (plan.selection === 'trade_switcher' && tradeId) bus.emit({ type: 'show_trade', tradeId });
  return batchListResult(view);
};

/**
 * "Check again": the screen's own retry, which it honours only on a problem with a retry. When voice knows the screen
 * cannot retry now (no face tries left, a tap it waits for, a check already running), it says so instead of promising
 * a check that never runs.
 */
export const verifyAgain: Handler = async (h) => {
  const { flow } = h.state;
  if (flow.step !== 'VERIFY' || !flow.sessionKey) return wrongStep(await h.view());
  const v = h.verifyFor(flow.sessionKey);
  const limit = h.deps.ctx.journey.verification.faceRetryLimit;
  if (limit !== null && v.faceFailures >= limit) {
    return fail('NO_TRIES_LEFT', "No face tries are left today, so the screen cannot check again. Say in one short line, in the trainer's language: please ask your principal to mark your attendance today. Then wait.", { step: 'VERIFY' });
  }
  if (v.need) {
    return fail('WAITING_FOR_SCREEN', `The screen is not checking yet: it waits for the trainer to ${needText(v.need)}. Ask them to do that in one short line, in the trainer's language. Then wait for the next [APP] message.`, { step: 'VERIFY' });
  }
  if (v.cameraPending) return { ok: true, step: 'VERIFY', instruction: 'The check is running on the screen now. Say in a few words: please wait. Then stop and wait for the app.' };
  v.prompts.clear();
  h.deps.bus.emit({ type: 'verify_retry', sessionKey: flow.sessionKey });
  return { ok: true, step: 'VERIFY', instruction: 'Checking again. Say in a few words: please wait. Then stop and wait for the app. If no [APP] message follows, ask the trainer to follow the screen.' };
};

const SCREENS = { home: { name: 'Home', href: routes.home }, reports: { name: 'Reports', href: routes.reports } } as const;

/** "home dikhao", "open reports": the screen only; the attendance flow moves with its own tools (MVP-05 §13). */
export const navigateTool: Handler = async (h, args) => {
  const targets = h.deps.plan.navTargets;
  const target = targets.find((t) => t === str(args.to).toLowerCase());
  if (!target) {
    return fail('INVALID', `There is no "${nameText(str(args.to))}" screen. The screens are ${targets.map((t) => SCREENS[t].name).join(' and ')}.`);
  }
  h.navigate(SCREENS[target].href, false);
  const view = await h.view();
  const cur = currentView(view);
  const then = cur && view.flow.step === 'ROLL_CALL' ? ` The roll call is still open: then call out ${cur.call_as}.` : '';
  return { ok: true, screen: target, instruction: `The ${SCREENS[target].name} screen is open. Say so in a few words.${then}` };
};
