import { describe, expect, it } from 'vitest';
import { toolCallOrder } from '@/services/voice/executor';

/** Distinct call objects, as the SDK's FunctionCalls are (the order is decided by identity, MVP-05 §3.6). */
const calls = (...names: string[]) => names.map((name, i) => ({ id: `c${i}`, name }));
const names = (list: readonly { name?: string }[]) => list.map((c) => c.name);

describe('toolCallOrder (MVP-05 §3.6)', () => {
  it('runs an early mark_remaining right after the last set_student_status', () => {
    expect(names(toolCallOrder(calls('mark_remaining', 'set_student_status', 'set_student_status', 'submit_attendance')))).toEqual([
      'set_student_status',
      'set_student_status',
      'mark_remaining',
      'submit_attendance',
    ]);
  });

  it('keeps other calls in their place around the moved mark_remaining', () => {
    expect(names(toolCallOrder(calls('mark_remaining', 'set_student_status', 'get_status', 'set_student_status', 'submit_attendance')))).toEqual([
      'set_student_status',
      'get_status',
      'set_student_status',
      'mark_remaining',
      'submit_attendance',
    ]);
  });

  it('leaves "haan, submit bhi kar do" (mark_remaining then submit) unchanged', () => {
    expect(names(toolCallOrder(calls('mark_remaining', 'submit_attendance')))).toEqual(['mark_remaining', 'submit_attendance']);
  });

  it('leaves a mark_remaining that already comes after the marks unchanged', () => {
    expect(names(toolCallOrder(calls('set_student_status', 'get_status', 'mark_remaining')))).toEqual(['set_student_status', 'get_status', 'mark_remaining']);
  });

  it('counts mark_attendance like set_student_status', () => {
    expect(names(toolCallOrder(calls('mark_remaining', 'mark_attendance')))).toEqual(['mark_attendance', 'mark_remaining']);
  });

  it('returns the same call objects in a new array and never changes the input', () => {
    const input = calls('mark_remaining', 'set_student_status');
    const copy = [...input];
    const out = toolCallOrder(input);
    expect(out).not.toBe(input);
    expect(input).toEqual(copy);
    expect(out[0]).toBe(input[1]);
    expect(out[1]).toBe(input[0]);
    expect(toolCallOrder([])).toEqual([]);
  });
});
