import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeEnvironment, testMicrophone, testSpeaker } from '@/services/voice/audio/probes';
import { startMic } from '@/services/voice/audio/recorder';

vi.mock('@/services/voice/audio/recorder', () => ({ startMic: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** An AudioContext whose actual rate is the asked one (or `forced`), and which records what is done to it. */
function stubAudioContext(forced?: number, log: string[] = []) {
  class Ctx {
    sampleRate: number;
    constructor(opts: { sampleRate: number }) {
      this.sampleRate = forced ?? opts.sampleRate;
      log.push(`new ${opts.sampleRate}`);
    }
    resume = () => (log.push('resume'), Promise.resolve());
    close = () => (log.push('close'), Promise.resolve());
  }
  Object.defineProperty(Ctx.prototype, 'audioWorklet', { value: {} });
  vi.stubGlobal('AudioContext', Ctx);
  return log;
}

describe('probeEnvironment', () => {
  it('passes on a capable browser and shows the actual rates', () => {
    stubAudioContext();
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => Promise.resolve() } });
    const rows = probeEnvironment();
    expect(rows.map((r) => `${r.id}:${r.status}`)).toEqual(['secureContext:pass', 'getUserMedia:pass', 'audioWorklet:pass', 'rate16:pass', 'rate24:pass']);
    expect(rows.find((r) => r.id === 'rate24')?.detail).toBe('24000 Hz');
  });

  it('fails each missing capability with a reason, and a context that ignores the asked rate', () => {
    stubAudioContext(48000);
    vi.stubGlobal('window', { isSecureContext: false });
    vi.stubGlobal('navigator', {});
    const rows = probeEnvironment();
    expect(rows.map((r) => r.status)).toEqual(['fail', 'fail', 'pass', 'fail', 'fail']);
    expect(rows.find((r) => r.id === 'rate16')?.detail).toBe('asked for 16000 Hz, got 48000 Hz');
  });

  it('fails the rates when AudioContext does not exist at all', () => {
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => Promise.resolve() } });
    expect(probeEnvironment().map((r) => r.status)).toEqual(['pass', 'pass', 'fail', 'fail', 'fail']);
  });
});

describe('testMicrophone', () => {
  it('stops at a refused permission and releases the context', async () => {
    const log = stubAudioContext();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })) } });
    const rows = await testMicrophone();
    expect(rows).toEqual([{ id: 'micPermission', status: 'fail', detail: 'NotAllowedError (permission_denied)' }]);
    expect(log).toEqual(['new 16000', 'resume', 'close']);
    expect(startMic).not.toHaveBeenCalled();
  });

  it('reports permission, settings, worklet and two seconds of levels, and stops every track', async () => {
    vi.useFakeTimers();
    stubAudioContext();
    const stop = vi.fn();
    const track = { stop, getSettings: () => ({ echoCancellation: true, noiseSuppression: true, autoGainControl: false, sampleRate: 48000, channelCount: 1 }) };
    const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => Promise.resolve(stream) } });
    let onChunk: (pcm: Int16Array) => void = () => undefined;
    const micStop = vi.fn();
    vi.mocked(startMic).mockImplementation((_ctx, chunk) => {
      onChunk = chunk;
      return Promise.resolve({ ok: true, mic: { stop: micStop, setEnabled: () => undefined, level: () => 0.25 } });
    });
    const pending = testMicrophone();
    await vi.advanceTimersByTimeAsync(0);
    onChunk(new Int16Array(640));
    await vi.advanceTimersByTimeAsync(2000);
    const rows = await pending;
    expect(rows.map((r) => `${r.id}:${r.status}`)).toEqual(['micPermission:pass', 'micSettings:info', 'workletLoad:pass', 'micLevel:pass']);
    expect(rows[1].detail).toBe('echoCancellation=true, noiseSuppression=true, autoGainControl=false, sampleRate=48000, channelCount=1');
    expect(rows[3].detail).toMatch(/^(19|20) readings, 1 chunks, peak 25%$/); // the last tick races the 2 s timer
    expect(stop).toHaveBeenCalled();
    expect(micStop).toHaveBeenCalled();
  });

  it('a context that cannot be made is its own row, never the permission (C14): the permission was never asked', async () => {
    vi.stubGlobal('AudioContext', function () {
      throw Object.assign(new Error('x'), { name: 'NotSupportedError' });
    });
    const getUserMedia = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    expect(await testMicrophone()).toEqual([{ id: 'micContext', status: 'fail', detail: 'NotSupportedError' }]);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('an unexpected failure after the permission keeps the passed rows, adds a failed micTest row and closes the context (C13)', async () => {
    const log = stubAudioContext();
    const track = { stop: vi.fn(), getSettings: () => ({}) };
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => Promise.resolve({ getAudioTracks: () => [track], getTracks: () => [track] }) } });
    vi.mocked(startMic).mockRejectedValue(Object.assign(new Error('boom'), { name: 'InvalidStateError' }));
    const rows = await testMicrophone();
    expect(rows.map((r) => `${r.id}:${r.status}`)).toEqual(['micPermission:pass', 'micSettings:info', 'micTest:fail']);
    expect(rows.at(-1)?.detail).toBe('InvalidStateError');
    expect(log.at(-1)).toBe('close');
  });

  it('fails the worklet row with the recorder error', async () => {
    stubAudioContext();
    const track = { stop: vi.fn(), getSettings: () => ({}) };
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => Promise.resolve({ getAudioTracks: () => [track], getTracks: () => [track] }) } });
    vi.mocked(startMic).mockResolvedValue({ ok: false, error: 'failed' });
    const rows = await testMicrophone();
    expect(rows.at(-1)).toEqual({ id: 'workletLoad', status: 'fail', detail: 'failed' });
  });
});

describe('testSpeaker', () => {
  it('plays a 0.5 s tone at 24 kHz and closes the contexts afterwards', () => {
    vi.useFakeTimers();
    const created: number[] = [];
    const sources: { start: ReturnType<typeof vi.fn> }[] = [];
    const lengths: number[] = [];
    class Ctx {
      currentTime = 0;
      destination = {};
      constructor(opts: { sampleRate: number }) {
        created.push(opts.sampleRate);
      }
      resume = () => Promise.resolve();
      close = vi.fn(() => Promise.resolve());
      createBuffer = (_channels: number, length: number) => (lengths.push(length), { duration: length / 24000, getChannelData: () => new Float32Array(length) });
      createBufferSource = () => {
        const source = { start: vi.fn(), stop: vi.fn(), connect: vi.fn(), buffer: null, onended: null };
        sources.push(source);
        return source;
      };
    }
    vi.stubGlobal('AudioContext', Ctx);
    // played, not proven heard: a note for the person to judge, never a pass (C12)
    const speaker = testSpeaker();
    expect(speaker).toMatchObject({ id: 'speaker', status: 'info' });
    expect(speaker.detail).toMatch(/not checked whether it was heard/);
    expect(created).toEqual([16000, 24000]);
    expect(lengths).toEqual([12000]);
    expect(sources).toHaveLength(1);
    expect(sources[0].start).toHaveBeenCalledTimes(1);
  });

  it('fails with the error name when no AudioContext can be made', () => {
    vi.stubGlobal('AudioContext', function () {
      throw Object.assign(new Error('x'), { name: 'NotSupportedError' });
    });
    expect(testSpeaker()).toEqual({ id: 'speaker', status: 'fail', detail: 'NotSupportedError' });
  });
});
