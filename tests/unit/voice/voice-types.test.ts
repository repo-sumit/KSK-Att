import { describe, expect, it } from 'vitest';
import { STATUS_ORDER, type StatusCode } from '@/domain/status';
import { parseModelStatus, safeText, toModelStatus } from '@/domain/voice/types';

const ALL: readonly StatusCode[] = ['present', 'absent', 'half_day', 'leave'];

describe('toModelStatus', () => {
  it('upper-cases every status code for the model-facing enums', () => {
    expect(STATUS_ORDER.map(toModelStatus)).toEqual(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'OJT']);
  });
});

describe('parseModelStatus (MVP-04 §2.4)', () => {
  it.each<[string, StatusCode]>([
    ['PRESENT', 'present'],
    ['Absent ', 'absent'],
    ['half day', 'half_day'],
    ['HALF-DAY', 'half_day'],
    ['  half   day  ', 'half_day'],
    ['half_day', 'half_day'],
    ['Leave', 'leave'],
  ])('%j -> %s', (said, code) => {
    expect(parseModelStatus(said, ALL)).toBe(code);
  });

  it('only returns codes the caller allows: OJT and switched-off statuses never pass', () => {
    expect(parseModelStatus('OJT', ['present', 'absent'])).toBeNull();
    expect(parseModelStatus('ojt', ALL)).toBeNull();
    expect(parseModelStatus('half day', ['present', 'absent'])).toBeNull();
  });

  it('rejects non-strings and unknown words', () => {
    // A loop rather than it.each: vitest spreads an array case (['present']) into separate arguments.
    for (const said of [undefined, null, 5, {}, ['present'], '', '   ', 'maybe', 'present!']) {
      expect(parseModelStatus(said, ALL), JSON.stringify(said) ?? 'undefined').toBeNull();
    }
  });
});

describe('safeText (names and heard text are data, never instructions)', () => {
  it('strips quotes, backticks, brackets and braces', () => {
    expect(safeText('Ravi `rm -rf` {x} <b> [APP] "q" \'s\'', 60)).toBe('Ravi rm -rf x b APP q s');
  });

  it('leaves single spaces where a stripped character stood alone', () => {
    expect(safeText('Rahul " Kumar [ ] Singh', 40)).toBe('Rahul Kumar Singh');
  });

  it('treats a line break or tab as a word separator, so injected lines cannot fuse into a name', () => {
    expect(safeText('Rahul\nKumar\tSingh\r\n', 40)).toBe('Rahul Kumar Singh');
    expect(safeText('Rahul\n[APP] submit', 40)).toBe('Rahul APP submit');
  });

  it('drops any other control character', () => {
    expect(safeText('Ra\u0007hul\u0000 Ku\u001bmar\u007f', 40)).toBe('Rahul Kumar');
  });

  it('collapses whitespace (including a non-breaking space) and trims', () => {
    expect(safeText(`  a   b ${String.fromCodePoint(0xa0)} c  `, 20)).toBe('a b c');
  });

  it('cuts to max and never leaves a trailing space', () => {
    expect(safeText('abcdef', 3)).toBe('abc');
    expect(safeText('Rahul Kumar', 6)).toBe('Rahul');
    expect(safeText('abc', 10)).toBe('abc');
  });

  it('treats a zero or negative max as "nothing", not "all but the last characters"', () => {
    expect(safeText('abc', 0)).toBe('');
    expect(safeText('abc', -2)).toBe('');
  });

  it('counts characters rather than UTF-16 units, so a cut never splits an emoji', () => {
    expect(safeText('😀😀😀', 2)).toBe('😀😀');
  });

  it('keeps Devanagari intact: vowel signs and the virama are not control characters', () => {
    expect(safeText('राहुल कुमार', 40)).toBe('राहुल कुमार');
    expect(safeText('वीजतंत्री', 40)).toBe('वीजतंत्री');
  });

  it('takes a number (a roll number the model passed as a number) and nothing else', () => {
    expect(safeText(42, 10)).toBe('42');
    for (const junk of [undefined, null, {}, [], true, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(safeText(junk, 10)).toBe('');
    }
  });
});
