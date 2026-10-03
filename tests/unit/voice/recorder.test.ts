import { afterEach, describe, expect, it, vi } from 'vitest';
import { startMic } from '@/services/voice/audio/recorder';

const domError = (name: string) => Object.assign(new Error(name), { name });

function stubMediaDevices(getUserMedia: () => Promise<unknown>, secure = true) {
  vi.stubGlobal('isSecureContext', secure);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startMic errors', () => {
  const ctx = {} as AudioContext;
  const cases: Array<[unknown, string]> = [
    [domError('NotAllowedError'), 'permission_denied'],
    [domError('NotFoundError'), 'not_found'],
    [domError('NotReadableError'), 'busy'],
    [new TypeError('nope'), 'unsupported'],
    [new Error('weird'), 'failed'],
  ];
  it.each(cases)('maps %s to %s', async (thrown, expected) => {
    stubMediaDevices(() => Promise.reject(thrown));
    expect(await startMic(ctx, vi.fn(), vi.fn())).toEqual({ ok: false, error: expected });
  });

  it('reports insecure when the page is not a secure context', async () => {
    const getUserMedia = vi.fn();
    stubMediaDevices(getUserMedia, false);
    expect(await startMic(ctx, vi.fn(), vi.fn())).toEqual({ ok: false, error: 'insecure' });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('reports unsupported when there is no getUserMedia', async () => {
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', {});
    expect(await startMic(ctx, vi.fn(), vi.fn())).toEqual({ ok: false, error: 'unsupported' });
  });
});

describe('startMic graph', () => {
  function setup(addModule: () => Promise<void> = async () => undefined) {
    const track = { stop: vi.fn(), addEventListener: vi.fn() };
    const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
    stubMediaDevices(async () => stream);
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
    const ctx = {
      destination: {},
      audioWorklet: { addModule: vi.fn(addModule) },
      createMediaStreamSource: vi.fn(() => source),
      createGain: vi.fn(() => gain),
    };
    const node = { port: { onmessage: null as ((e: { data: ArrayBuffer }) => void) | null }, connect: vi.fn(), disconnect: vi.fn() };
    vi.stubGlobal('AudioWorkletNode', vi.fn(function () { return node; }));
    return { track, ctx, node, source, gain };
  }
  const post = (node: { port: { onmessage: ((e: { data: ArrayBuffer }) => void) | null } }, value: number, n = 640) => {
    node.port.onmessage?.({ data: new Int16Array(n).fill(value).buffer });
  };

  it('wires source to worklet to a silent destination and forwards chunks while enabled', async () => {
    const { ctx, node, track, gain } = setup();
    const onChunk = vi.fn();
    const onEnded = vi.fn();
    const result = await startMic(ctx as unknown as AudioContext, onChunk, onEnded);
    if (!result.ok) throw new Error('expected ok');
    expect(ctx.audioWorklet.addModule).toHaveBeenCalledWith('/voice/mic-worklet.js');
    expect(track.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function), { once: true });
    expect(gain.gain.value).toBe(0);

    post(node, 16384);
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk.mock.calls[0][0]).toBeInstanceOf(Int16Array);
    expect(onChunk.mock.calls[0][0]).toHaveLength(640);
    expect(result.mic.level()).toBeCloseTo(0.5, 2);

    result.mic.setEnabled(false);
    post(node, 16384);
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(result.mic.level()).toBe(0);
    result.mic.setEnabled(true);
    post(node, 100);
    expect(onChunk).toHaveBeenCalledTimes(2);

    track.addEventListener.mock.calls[0][1]();
    expect(onEnded).toHaveBeenCalledTimes(1);

    result.mic.stop();
    result.mic.stop();
    expect(node.port.onmessage).toBeNull();
    expect(track.stop).toHaveBeenCalled();
  });

  it('listens for "ended" on every audio track and reports it once', async () => {
    const tracks = [0, 1].map(() => ({ stop: vi.fn(), addEventListener: vi.fn() }));
    stubMediaDevices(async () => ({ getAudioTracks: () => tracks, getTracks: () => tracks }));
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
    const ctx = { destination: {}, audioWorklet: { addModule: vi.fn(async () => undefined) }, createMediaStreamSource: vi.fn(() => source), createGain: vi.fn(() => gain) };
    vi.stubGlobal('AudioWorkletNode', vi.fn(function () { return { port: { onmessage: null }, connect: vi.fn(), disconnect: vi.fn() }; }));
    const onEnded = vi.fn();
    expect((await startMic(ctx as unknown as AudioContext, vi.fn(), onEnded)).ok).toBe(true);
    for (const track of tracks) expect(track.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function), { once: true });
    for (const track of tracks) track.addEventListener.mock.calls[0][1]();
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('stops the tracks and maps the error when the worklet cannot load', async () => {
    const { ctx, track } = setup(() => Promise.reject(new Error('404')));
    const result = await startMic(ctx as unknown as AudioContext, vi.fn(), vi.fn());
    expect(result).toEqual({ ok: false, error: 'failed' });
    expect(track.stop).toHaveBeenCalled();
  });
});
