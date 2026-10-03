import { describe, expect, it } from 'vitest';
import { appendCaption, captionsAfter, closeCaptions, MAX_CAPTIONS, type Caption } from '@/services/voice/captions';

describe('captions', () => {
  it('joins interleaved fragments to the open line of the same speaker', () => {
    let lines: readonly Caption[] = [];
    lines = appendCaption(lines, 'trainer', ' Rahul');
    lines = appendCaption(lines, 'agent', 'Rahul ');
    lines = appendCaption(lines, 'trainer', ' absent');
    lines = appendCaption(lines, 'agent', 'absent.');
    expect(lines).toEqual([
      { who: 'trainer', text: 'Rahul absent', final: false },
      { who: 'agent', text: 'Rahul absent.', final: false },
    ]);
  });

  it('interrupted closes the agent line only; a closed line is never extended', () => {
    let lines = appendCaption(appendCaption([], 'agent', 'Shivam'), 'trainer', 'ruko');
    lines = closeCaptions(lines, 'agent');
    lines = appendCaption(lines, 'agent', 'Okay');
    lines = appendCaption(lines, 'trainer', ' ek minute');
    expect(lines).toEqual([
      { who: 'agent', text: 'Shivam', final: true },
      { who: 'trainer', text: 'ruko ek minute', final: false },
      { who: 'agent', text: 'Okay', final: false },
    ]);
  });

  it('inputFinished closes the trainer line; turn complete closes every line', () => {
    let lines = appendCaption(appendCaption([], 'trainer', 'haan'), 'agent', 'Theek');
    lines = closeCaptions(lines, 'trainer');
    expect(lines.map((l) => l.final)).toEqual([true, false]);
    lines = appendCaption(lines, 'trainer', 'present');
    expect(lines.at(-1)).toEqual({ who: 'trainer', text: 'present', final: false });
    expect(closeCaptions(lines).every((l) => l.final)).toBe(true);
  });

  it('captionsAfter applies one server event: fragments first, then the closes', () => {
    let lines = captionsAfter([], { inputText: 'Rahul', outputText: 'Okay' });
    lines = captionsAfter(lines, { inputText: ' absent', inputFinished: true, interrupted: true });
    expect(lines).toEqual([
      { who: 'trainer', text: 'Rahul absent', final: true },
      { who: 'agent', text: 'Okay', final: true },
    ]);
    lines = captionsAfter(lines, { outputText: 'Shivam?', turnComplete: true });
    expect(lines.at(-1)).toEqual({ who: 'agent', text: 'Shivam?', final: true });
    expect(captionsAfter(lines, {})).toBe(lines);
  });

  it('keeps the newest 14 lines and returns the same array when nothing changes', () => {
    let lines: readonly Caption[] = [];
    for (let i = 0; i < 20; i++) lines = closeCaptions(appendCaption(lines, i % 2 ? 'agent' : 'trainer', `line ${i}`));
    expect(MAX_CAPTIONS).toBe(14);
    expect(lines).toHaveLength(14);
    expect(lines[0]!.text).toBe('line 6');
    expect(lines.at(-1)!.text).toBe('line 19');
    expect(closeCaptions(lines)).toBe(lines);
    expect(appendCaption(lines, 'agent', '   ')).toBe(lines);
  });
});
