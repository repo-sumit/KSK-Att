import { afterEach, describe, expect, it, vi } from 'vitest';
import { startMic } from '@/services/voice/audio/recorder';
import { createBrowserAudio } from '@/services/voice/audio/browser-audio';

vi.mock('@/services/voice/audio/recorder', () => ({ startMic: vi.fn() }));

afterEach(() => {
  vi.mocked(startMic).mockReset();
  vi.unstubAllGlobals();
});

describe('createBrowserAudio', () => {
  it('creates and resumes both contexts synchronously, and closes output first', () => {
    const calls: string[] = [];
    const ctor = vi.fn(function (this: Record<string, unknown>, opts: { sampleRate: number }) {
      const rate = opts.sampleRate;
      calls.push(`new ${rate}`);
      this.resume = () => (calls.push(`resume ${rate}`), Promise.resolve());
      this.close = () => (calls.push(`close ${rate}`), Promise.resolve());
    });
    vi.stubGlobal('AudioContext', ctor);
    const audio = createBrowserAudio();
    expect(calls).toEqual(['new 16000', 'new 24000', 'resume 16000', 'resume 24000']);
    expect(audio.isPlaying()).toBe(false);
    expect(audio.level()).toBe(0);
    audio.close();
    audio.close();
    expect(calls.slice(4)).toEqual(['close 24000', 'close 16000']);
  });

  it('closes the 16 kHz context before rethrowing when the 24 kHz one cannot be created', () => {
    const calls: string[] = [];
    const failure = new Error('too many contexts');
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function (this: Record<string, unknown>, opts: { sampleRate: number }) {
        const rate = opts.sampleRate;
        if (rate === 24000) throw failure;
        calls.push(`new ${rate}`);
        this.resume = () => (calls.push(`resume ${rate}`), Promise.resolve());
        this.close = () => (calls.push(`close ${rate}`), Promise.resolve());
      }),
    );
    expect(() => createBrowserAudio()).toThrow(failure);
    expect(calls).toEqual(['new 16000', 'close 16000']);
  });

  describe('startMic', () => {
    function stubContexts() {
      vi.stubGlobal(
        'AudioContext',
        vi.fn(function (this: Record<string, unknown>) {
          this.resume = () => Promise.resolve();
          this.close = () => Promise.resolve();
        }),
      );
    }
    const fakeMic = () => ({ stop: vi.fn(), setEnabled: vi.fn(), level: vi.fn(() => 0) });

    it('stops the previous microphone stream before opening another', async () => {
      stubContexts();
      const first = fakeMic();
      const second = fakeMic();
      vi.mocked(startMic).mockResolvedValueOnce({ ok: true, mic: first });
      const audio = createBrowserAudio();
      expect(await audio.startMic(vi.fn(), vi.fn())).toEqual({ ok: true });
      expect(first.stop).not.toHaveBeenCalled();
      const order: string[] = [];
      first.stop.mockImplementation(() => order.push('stop first'));
      vi.mocked(startMic).mockImplementationOnce(async () => (order.push('open second'), { ok: true as const, mic: second }));
      expect(await audio.startMic(vi.fn(), vi.fn())).toEqual({ ok: true });
      expect(order).toEqual(['stop first', 'open second']);
      audio.setMicEnabled(false);
      expect(second.setEnabled).toHaveBeenLastCalledWith(false);
      expect(first.setEnabled).not.toHaveBeenCalledWith(false);
      audio.close();
      expect(second.stop).toHaveBeenCalledTimes(1);
      expect(first.stop).toHaveBeenCalledTimes(1);
    });

    it('two overlapping starts: only the newest keeps its stream, the other is stopped whenever it finishes (no leak)', async () => {
      stubContexts();
      const first = fakeMic();
      const second = fakeMic();
      const gates: ((value: { ok: true; mic: ReturnType<typeof fakeMic> }) => void)[] = [];
      vi.mocked(startMic).mockImplementation(() => new Promise((resolve) => void gates.push(resolve)));
      const audio = createBrowserAudio();
      const a = audio.startMic(vi.fn(), vi.fn());
      const b = audio.startMic(vi.fn(), vi.fn()); // both started before either stream opened: both saw no microphone
      gates[1]({ ok: true, mic: second });
      expect(await b).toEqual({ ok: true });
      gates[0]({ ok: true, mic: first });
      expect(await a).toEqual({ ok: false, error: 'failed' });
      expect(first.stop).toHaveBeenCalledTimes(1);
      expect(second.stop).not.toHaveBeenCalled();
      audio.setMicEnabled(false);
      expect(second.setEnabled).toHaveBeenLastCalledWith(false);
      expect(first.setEnabled).not.toHaveBeenCalled();
      audio.close();
      expect(second.stop).toHaveBeenCalledTimes(1);
    });

    it('stops a microphone that finished opening after close()', async () => {
      stubContexts();
      const mic = fakeMic();
      let finish: (value: { ok: true; mic: ReturnType<typeof fakeMic> }) => void = () => {};
      vi.mocked(startMic).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
      const audio = createBrowserAudio();
      const pending = audio.startMic(vi.fn(), vi.fn());
      audio.close();
      finish({ ok: true, mic });
      expect(await pending).toEqual({ ok: false, error: 'failed' });
      expect(mic.stop).toHaveBeenCalledTimes(1);
    });
  });
});
