import { describe, expect, it } from 'vitest';
import { normalizeMessage, parseDurationMs } from '@/services/voice/live/normalize';
import { int16ToBase64 } from '@/services/voice/audio/pcm';

describe('normalizeMessage', () => {
  it('collects every audio part and every field of one message', () => {
    const a = int16ToBase64(new Int16Array([1, 2])), b = int16ToBase64(new Int16Array([3]));
    const e = normalizeMessage({
      serverContent: { modelTurn: { parts: [{ inlineData: { data: a, mimeType: 'audio/pcm;rate=24000' } }, { inlineData: { data: b } }] }, outputTranscription: { text: 'Namaskar' }, turnComplete: true },
      toolCall: { functionCalls: [{ id: 'c1', name: 'get_status', args: {} }, { name: 'get_trades' }] },
      sessionResumptionUpdate: { newHandle: 'h1', resumable: true },
      goAway: { timeLeft: '9.5s' },
    });
    expect(e.audio.map((x) => Array.from(x))).toEqual([[1, 2], [3]]);
    expect(e).toMatchObject({ outputText: 'Namaskar', turnComplete: true, resumption: { handle: 'h1', resumable: true }, goAwayMs: 9500 });
    expect(e.toolCalls).toEqual([{ id: 'c1', name: 'get_status', args: {} }, { id: undefined, name: 'get_trades', args: {} }]);
  });
  it('reports interruption and cancellations', () => {
    expect(normalizeMessage({ serverContent: { interrupted: true } })).toMatchObject({ interrupted: true, audio: [] });
    expect(normalizeMessage({ toolCallCancellation: { ids: ['c1'] } }).cancelledIds).toEqual(['c1']);
  });
  it('parses durations', () => {
    expect(parseDurationMs('2s')).toBe(2000);
    expect(parseDurationMs({ seconds: 3, nanos: 500_000_000 })).toBe(3500);
  });

  it('reads both transcriptions with their finished flags and the generation flag', () => {
    const e = normalizeMessage({
      serverContent: { inputTranscription: { text: 'haan', finished: true }, outputTranscription: { text: 'ok', finished: true }, generationComplete: true },
    });
    expect(e).toMatchObject({ inputText: 'haan', inputFinished: true, outputText: 'ok', outputFinished: true, generationComplete: true });
  });
  it('skips empty audio parts and parts that are not valid base64 without losing the rest of the message', () => {
    const good = int16ToBase64(new Int16Array([7]));
    const e = normalizeMessage({
      serverContent: {
        modelTurn: { parts: [{ inlineData: { data: '' } }, { text: 'no audio' }, { inlineData: { data: '***not base64***' } }, { inlineData: { data: good } }] },
        outputTranscription: { text: 'still here' },
      },
    });
    expect(e.audio.map((x) => Array.from(x))).toEqual([[7]]);
    expect(e.outputText).toBe('still here');
  });
  it('leaves absent fields out and tolerates junk', () => {
    expect(normalizeMessage({ setupComplete: {} })).toEqual({ audio: [] });
    expect(normalizeMessage(null)).toEqual({ audio: [] });
    expect(normalizeMessage('x')).toEqual({ audio: [] });
  });
  it('a resumption update without a usable handle is still reported', () => {
    expect(normalizeMessage({ sessionResumptionUpdate: { resumable: false } }).resumption).toEqual({ resumable: false });
  });
  it('treats a tool call without args as empty args and ignores a non-array functionCalls', () => {
    expect(normalizeMessage({ toolCall: { functionCalls: [{ id: 'x', name: 'n' }] } }).toolCalls).toEqual([{ id: 'x', name: 'n', args: {} }]);
    expect(normalizeMessage({ toolCall: { functionCalls: 'nope' } }).toolCalls).toBeUndefined();
  });
});

describe('parseDurationMs', () => {
  it('handles strings, protobuf objects with string seconds, numbers (seconds) and junk', () => {
    expect(parseDurationMs('9.5s')).toBe(9500);
    expect(parseDurationMs({ seconds: '4' })).toBe(4000);
    expect(parseDurationMs(1.5)).toBe(1500);
    expect(parseDurationMs('soon')).toBeUndefined();
    expect(parseDurationMs(undefined)).toBeUndefined();
    expect(parseDurationMs(Number.NaN)).toBeUndefined();
  });
});
