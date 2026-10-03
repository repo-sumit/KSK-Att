// tests/unit/voice/tools.test.ts
import { describe, expect, it } from 'vitest';
import type { FlowPlan } from '@/domain/voice/plan';
import { buildTools } from '@/services/voice/tools';

const PLAN: FlowPlan = {
  selection: 'trade_picker', tradeStep: true, slotWords: 'once',
  verification: { location: 'fence', face: true, required: true },
  defaultStatus: 'present', startStyle: 'exceptions', rollCallSwitch: true,
  statuses: ['present', 'absent'], ojtVisible: false,
  details: { half: false, leaveType: false, leaveDays: false },
  navTargets: ['home', 'reports'], languages: ['en', 'mr'], openingLanguage: 'en', timeFencing: true,
};
const names = (p: FlowPlan) => buildTools(p).map((t) => t.name);
const tool = (p: FlowPlan, n: string) => buildTools(p).find((t) => t.name === n)!;

describe('buildTools', () => {
  it('declares every tool BLOCKING', () => {
    expect(buildTools(PLAN).every((t) => t.behavior === 'BLOCKING')).toBe(true);
  });
  it('Maharashtra open mapping: the full set', () => {
    expect(names(PLAN)).toEqual(['get_trades', 'select_trade', 'select_batch', 'start_roll_call', 'mark_attendance', 'set_student_status', 'skip_student', 'mark_remaining', 'go_back', 'get_status', 'verify_again', 'navigate', 'submit_attendance', 'end_voice_session']);
  });
  it('a disabled feature has no tool', () => {
    const p = { ...PLAN, tradeStep: false, rollCallSwitch: false, verification: { location: 'none' as const, face: false, required: false } };
    expect(names(p)).not.toEqual(expect.arrayContaining(['get_trades']));
    expect(names(p)).not.toContain('select_trade');
    expect(names(p)).not.toContain('start_roll_call');
    expect(names(p)).not.toContain('verify_again');
    expect(tool(p, 'go_back').parameters!.properties.to.enum).toEqual(['batch']);
  });
  it('status enums come from the status set; details only where the state uses them', () => {
    expect(tool(PLAN, 'mark_attendance').parameters!.properties.status.enum).toEqual(['PRESENT', 'ABSENT']);
    expect(Object.keys(tool(PLAN, 'mark_attendance').parameters!.properties)).toEqual(['student_id', 'status', 'heard']);
    const rich = { ...PLAN, statuses: ['present', 'absent', 'half_day', 'leave'] as const, details: { half: true, leaveType: true, leaveDays: true } };
    const props = tool(rich as FlowPlan, 'set_student_status').parameters!.properties;
    expect(props.status.enum).toEqual(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE']);
    expect(props.half.enum).toEqual(['first', 'second']);
    expect(props.leave_type.enum).toEqual(['SICK', 'CASUAL', 'MEDICAL']);
    expect(props.leave_days.type).toBe('INTEGER');
  });
  it('confirmations are codes, never booleans', () => {
    const json = JSON.stringify(buildTools(PLAN));
    expect(json).not.toContain('confirmed');
    expect(tool(PLAN, 'submit_attendance').parameters!.properties.confirm_token.type).toBe('STRING');
    expect(tool(PLAN, 'submit_attendance').parameters!.required).toBeUndefined();
  });
  it('keeps the MVP wording of the select_batch and set_student_status texts', () => {
    const batch = tool(PLAN, 'select_batch');
    expect(batch.description).toBe('Choose a batch, half or period of the selected trade and start marking: a roll call (it returns the first student to call) or, where everyone starts present, by exception (ask who is not).');
    expect(batch.parameters!.properties.batch.description).toBe('Batch id from the last tool result, or the spoken label such as "shift 1 unit 2"');
    const student = tool(PLAN, 'set_student_status');
    expect(student.description).toBe('Change the status of any student in the batch: corrections ("Rahul absent tha"), "the last one was wrong" (use last_marked), or several students named at once (one call each).');
    expect(student.parameters!.properties.student.description).toBe('Student id, roll number or name (add the father name if the name repeats)');
  });
  it('select_trade, select_batch and go_back have no confirm_token and no marks-lost text (spec section 7, D-083)', () => {
    for (const n of ['select_trade', 'select_batch', 'go_back']) {
      const t = tool(PLAN, n);
      expect(Object.keys(t.parameters!.properties)).not.toContain('confirm_token');
      expect(t.description).not.toMatch(/NEEDS_CONFIRMATION|marks would be lost|confirm_token/);
    }
    expect(tool(PLAN, 'select_trade').description).toBe('Choose the trade the trainer named, in any language or phrasing. Returns its batches.');
    expect(tool(PLAN, 'go_back').description).toBe('Go back to trade selection or batch selection. To fix one student use set_student_status instead.');
    expect(Object.keys(tool(PLAN, 'mark_remaining').parameters!.properties)).toContain('confirm_token');
    expect(Object.keys(tool(PLAN, 'submit_attendance').parameters!.properties)).toContain('confirm_token');
  });
  it('the confirmation code may come from a result that asked the submit question up front (Task 23)', () => {
    const code = 'The confirmation code from the latest result that asked this question (NEEDS_CONFIRMATION, or an instruction that gives the code). Pass it only after the trainer clearly said yes to that question.';
    expect(tool(PLAN, 'submit_attendance').parameters!.properties.confirm_token.description).toBe(code);
    expect(tool(PLAN, 'mark_remaining').parameters!.properties.confirm_token.description).toBe(code);
    expect(tool(PLAN, 'submit_attendance').description).toBe(
      'Submit the attendance for the batch. Final: it locks the record. Returns NEEDS_CONFIRMATION with the counts first (the screen shows the review), unless an earlier result already asked to submit and gave its confirm_token; call it with the confirm_token only after a clear yes. Also call it when the trainer says that is all ("bas", "aur koi nahi").',
    );
  });
  it('argument-less tools declare no parameters; navigate offers the plan targets', () => {
    expect(tool(PLAN, 'get_status').parameters).toBeUndefined();
    expect(tool(PLAN, 'end_voice_session').parameters).toBeUndefined();
    expect(tool(PLAN, 'navigate').parameters!.properties.to.enum).toEqual(['home', 'reports']);
    expect(tool(PLAN, 'go_back').parameters!.properties.to.enum).toEqual(['trade', 'batch']);
  });
});
