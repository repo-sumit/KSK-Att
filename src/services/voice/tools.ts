/**
 * Tool declarations sent in the Live setup (voice design §7, D-081). Built per session from the flow plan,
 * so a feature that is switched off has no tool. Every declaration is BLOCKING: the 3.8 Live model defaults
 * to non-blocking and would say the next name before the app has answered. Descriptions are ported from
 * MVP-04 (the per-tool sections) with KSK names. Model-facing text is English.
 * Pure TypeScript: no I/O, no framework.
 */
import type { FlowPlan } from '@/domain/voice/plan';
import { toModelStatus } from '@/domain/voice/types';

export type ToolName =
  | 'get_trades' | 'select_trade' | 'select_batch' | 'start_roll_call' | 'mark_attendance' | 'set_student_status'
  | 'skip_student' | 'mark_remaining' | 'go_back' | 'get_status' | 'verify_again' | 'navigate' | 'submit_attendance' | 'end_voice_session';

export const TOOL_NAMES: readonly ToolName[] = [
  'get_trades', 'select_trade', 'select_batch', 'start_roll_call', 'mark_attendance', 'set_student_status',
  'skip_student', 'mark_remaining', 'go_back', 'get_status', 'verify_again', 'navigate', 'submit_attendance', 'end_voice_session',
];

export interface ToolParam { readonly type: 'STRING' | 'INTEGER'; readonly description: string; readonly enum?: readonly string[] }
export interface ToolDeclaration {
  readonly name: ToolName;
  readonly description: string;
  readonly behavior: 'BLOCKING';
  readonly parameters?: { readonly type: 'OBJECT'; readonly properties: Readonly<Record<string, ToolParam>>; readonly required?: readonly string[] };
}

/** The tool contract (MVP-04 §2.7): every handler returns this; the model receives it wrapped as { output }. Defined here so the transport (Task 15) and the executor (Task 13) share it. */
export interface ToolResult { readonly ok: boolean; readonly instruction: string; readonly error?: string; readonly [key: string]: unknown }
export interface ToolCall { readonly id?: string; readonly name?: string; readonly args?: Record<string, unknown> }

const LEAVE_TYPES = ['SICK', 'CASUAL', 'MEDICAL'] as const;

/** `required` is left out when empty (submit_attendance requires nothing). */
const obj = (properties: Record<string, ToolParam>, required: readonly string[]): NonNullable<ToolDeclaration['parameters']> =>
  required.length ? { type: 'OBJECT', properties, required } : { type: 'OBJECT', properties };

const CONFIRM_TOKEN: ToolParam = {
  type: 'STRING',
  description: 'The confirmation code from the latest result that asked this question (NEEDS_CONFIRMATION, or an instruction that gives the code). Pass it only after the trainer clearly said yes to that question.',
};

export function buildTools(plan: FlowPlan): ToolDeclaration[] {
  const codes = plan.statuses.map(toModelStatus);
  const status: ToolParam = { type: 'STRING', enum: codes, description: `Attendance status: ${codes.join(', ')}` };
  // The extra input of half day and leave, declared only where the state uses it.
  const details: Record<string, ToolParam> = {
    ...(plan.details.half
      ? { half: { type: 'STRING', enum: ['first', 'second'], description: 'HALF_DAY only: which half the student was there ("pehla half", "lunch ke baad" = second)' } }
      : {}),
    ...(plan.details.leaveType
      ? { leave_type: { type: 'STRING', enum: LEAVE_TYPES, description: `LEAVE only: the kind of leave (${LEAVE_TYPES.join(', ')})` } }
      : {}),
    ...(plan.details.leaveDays
      ? { leave_days: { type: 'INTEGER', description: 'LEAVE only, when the trainer says how long: days of leave counting today (1 = only today)' } }
      : {}),
  };
  const heard: ToolParam = { type: 'STRING', description: 'What the trainer actually said, verbatim' };
  const tool = (name: ToolName, description: string, parameters?: ToolDeclaration['parameters']): ToolDeclaration =>
    parameters ? { name, description, behavior: 'BLOCKING', parameters } : { name, description, behavior: 'BLOCKING' };

  const tools: (ToolDeclaration | false)[] = [
    plan.tradeStep && tool('get_trades', 'List the trades of this institute. Call it at the start, then read the trade names and ask which one.'),
    plan.tradeStep && tool(
      'select_trade',
      'Choose the trade the trainer named, in any language or phrasing. Returns its batches.',
      obj({ trade: { type: 'STRING', description: 'Trade id from get_trades, or the trade name as spoken' } }, ['trade']),
    ),
    tool(
      'select_batch',
      `Choose a batch, half or period${plan.tradeStep ? ' of the selected trade' : ''} and start marking: a roll call (it returns the first student to call) or, where everyone starts present, by exception (ask who is not).`,
      obj({
        batch: { type: 'STRING', description: 'Batch id from the last tool result, or the spoken label such as "shift 1 unit 2"' },
      }, ['batch']),
    ),
    plan.rollCallSwitch && tool(
      'start_roll_call',
      'Call every student by name, one by one, instead of asking only who is not present ("naam se bulao", "ek ek karke bulao", "call the names"). Students the trainer already marked are not called again.',
    ),
    tool(
      'mark_attendance',
      'Record the status of the CURRENT student and move to the next one. Use only right after the trainer answers for the student you just called. To change anyone else use set_student_status.',
      obj({ student_id: { type: 'STRING', description: 'id of the current student, exactly as in the last tool result' }, status, ...details, heard }, ['student_id', 'status']),
    ),
    tool(
      'set_student_status',
      'Change the status of any student in the batch: corrections ("Rahul absent tha"), "the last one was wrong" (use last_marked), or several students named at once (one call each).',
      obj({
        student: { type: 'STRING', description: 'Student id, roll number or name (add the father name if the name repeats)' },
        status,
        ...details,
        heard,
      }, ['student', 'status']),
    ),
    tool(
      'skip_student',
      'Skip the current student for now ("skip", "baad mein"). They are asked again later.',
      obj({ student_id: { type: 'STRING', description: 'id of the current student' } }, ['student_id']),
    ),
    tool(
      'mark_remaining',
      'Mark every student not yet marked with one status ("baaki sab present"). For "sab present, sirf Rahul absent" first mark the named students with set_student_status, then call this for the rest. Returns NEEDS_CONFIRMATION first; call again with the confirm_token only after a clear yes.',
      obj({ status, confirm_token: CONFIRM_TOKEN }, ['status']),
    ),
    tool(
      'go_back',
      'Go back to trade selection or batch selection. To fix one student use set_student_status instead.',
      obj({
        to: { type: 'STRING', enum: plan.tradeStep ? ['trade', 'batch'] : ['batch'], description: 'Where to go back to' },
      }, ['to']),
    ),
    tool('get_status', 'Where we are: step, counts, who is left, the current student. Use it for "kitne bache?" and after a reconnect.'),
    plan.verification.required && tool('verify_again', 'Run the location / face check again when the trainer asks ("phir se check karo", "check again") after it failed.'),
    tool(
      'navigate',
      'Open a screen the trainer asks for: home or reports. Never use it to choose a trade or batch.',
      obj({ to: { type: 'STRING', enum: plan.navTargets, description: 'The screen to open' } }, ['to']),
    ),
    tool(
      'submit_attendance',
      'Submit the attendance for the batch. Final: it locks the record. Returns NEEDS_CONFIRMATION with the counts first (the screen shows the review), unless an earlier result already asked to submit and gave its confirm_token; call it with the confirm_token only after a clear yes. Also call it when the trainer says that is all ("bas", "aur koi nahi").',
      obj({ confirm_token: CONFIRM_TOKEN }, []),
    ),
    tool('end_voice_session', 'End voice mode when the trainer asks to stop talking to you or wants to use the screen. The attendance marked so far stays on screen and is kept.'),
  ];
  return tools.filter((t): t is ToolDeclaration => t !== false);
}
