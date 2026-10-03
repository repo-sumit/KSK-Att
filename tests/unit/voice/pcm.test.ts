import { describe, expect, it } from 'vitest';
import { base64ToInt16, int16ToBase64 } from '@/services/voice/audio/pcm';

describe('pcm', () => {
  it('round-trips PCM16 little-endian', () => {
    const pcm = new Int16Array([0, 1, -1, 32767, -32768, 1234]);
    expect(Array.from(base64ToInt16(int16ToBase64(pcm)))).toEqual(Array.from(pcm));
  });
  it('drops an odd trailing byte and accepts empty input', () => {
    expect(base64ToInt16(Buffer.from([1, 0, 2]).toString('base64'))).toEqual(new Int16Array([1]));
    expect(base64ToInt16('')).toHaveLength(0);
  });
  it('writes little-endian bytes', () => {
    expect(Array.from(Buffer.from(int16ToBase64(new Int16Array([0x0102])), 'base64'))).toEqual([2, 1]);
  });
  it('encodes a buffer larger than one slice', () => {
    const pcm = new Int16Array(40000).map((_, i) => (i % 65536) - 32768);
    expect(Array.from(base64ToInt16(int16ToBase64(pcm)))).toEqual(Array.from(pcm));
  });
});
