import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { LiveCallbacks, LiveEvent, LiveSetup, LiveToken } from '@/services/voice/live/transport';
import { int16ToBase64 } from '@/services/voice/audio/pcm';

// A stub of the SDK: connect() hands the test the SDK callbacks and a session whose sends are spies.
const sdk = vi.hoisted(() => {
  const state = {
    ctor: [] as unknown[],
    connectArgs: null as null | { model: string; config: unknown; callbacks: Record<string, (e?: unknown) => void> },
    resolveConnect: (_s: unknown): void => undefined,
    session: null as unknown,
  };
  class GoogleGenAI {
    live = {
      connect: (args: NonNullable<typeof state.connectArgs>) => {
        state.connectArgs = args;
        return new Promise((resolve) => { state.resolveConnect = resolve; });
      },
    };
    constructor(opts: unknown) { state.ctor.push(opts); }
  }
  return { state, GoogleGenAI };
});
vi.mock('@google/genai', () => ({ GoogleGenAI: sdk.GoogleGenAI }));

import { geminiTransport } from '@/services/voice/live/gemini';

const TOKEN: LiveToken = { token: 'auth_tokens/abc', apiVersion: 'v1alpha', model: 'gemini-3.8-live', expiresAt: '2026-10-02T05:15:00.000Z' };
const SETUP: LiveSetup = { model: 'gemini-3.8-live', systemInstruction: 'hi', tools: [], voiceName: 'Kore' };

function fakeSession() {
  return { sendRealtimeInput: vi.fn(), sendToolResponse: vi.fn(), close: vi.fn() };
}
const cbs = (): LiveCallbacks & { onEvent: Mock<(e: LiveEvent) => void>; onClose: Mock<(code: number, reason: string) => void> } => ({
  onEvent: vi.fn<(e: LiveEvent) => void>(),
  onClose: vi.fn<(code: number, reason: string) => void>(),
});

beforeEach(() => {
  sdk.state.ctor = [];
  sdk.state.connectArgs = null;
});
afterEach(() => vi.useRealTimers());

async function connected() {
  const cb = cbs();
  const session = fakeSession();
  const p = geminiTransport.connect(TOKEN, SETUP, cb);
  sdk.state.resolveConnect(session);
  return { conn: await p, session, cb };
}

describe('geminiTransport.connect', () => {
  it('builds the client from the token and its api version and passes the live config', async () => {
    await connected();
    expect(sdk.state.ctor).toEqual([{ apiKey: 'auth_tokens/abc', httpOptions: { apiVersion: 'v1alpha' } }]);
    expect(sdk.state.connectArgs).toMatchObject({ model: 'gemini-3.8-live', config: { responseModalities: ['AUDIO'] } });
    expect(sdk.state.connectArgs?.config).not.toHaveProperty('httpOptions');
  });
  it("connects with the model the token was minted for, not the client's own copy (final fix m11)", async () => {
    const p = geminiTransport.connect({ ...TOKEN, model: 'gemini-3.9-live' }, SETUP, cbs());
    sdk.state.resolveConnect(fakeSession());
    await p;
    expect(sdk.state.connectArgs?.model).toBe('gemini-3.9-live');
  });
  it('requires a token', async () => {
    await expect(geminiTransport.connect(null, SETUP, cbs())).rejects.toThrow();
  });
  it('rejects when the socket closes before setup completes', async () => {
    const p = geminiTransport.connect(TOKEN, SETUP, cbs());
    sdk.state.connectArgs!.callbacks.onclose!({ code: 1008, reason: 'bad token' });
    await expect(p).rejects.toThrow(/1008/);
  });
  it('rejects after the timeout and closes a socket that resolves late', async () => {
    vi.useFakeTimers();
    const p = geminiTransport.connect(TOKEN, SETUP, cbs(), 50);
    const assertion = expect(p).rejects.toThrow(/setup/);
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
    const late = fakeSession();
    sdk.state.resolveConnect(late);
    await vi.advanceTimersByTimeAsync(0);
    expect(late.close).toHaveBeenCalledTimes(1);
  });
  it('delivers normalized messages, including those that arrive during setup, and later closes', async () => {
    const cb = cbs();
    const p = geminiTransport.connect(TOKEN, SETUP, cb);
    sdk.state.connectArgs!.callbacks.onmessage!({ serverContent: { outputTranscription: { text: 'hi' } } });
    sdk.state.resolveConnect(fakeSession());
    await p;
    sdk.state.connectArgs!.callbacks.onmessage!({ serverContent: { turnComplete: true } });
    expect(cb.onEvent.mock.calls.map((c) => c[0])).toEqual([{ audio: [], outputText: 'hi' }, { audio: [], turnComplete: true }]);
    sdk.state.connectArgs!.callbacks.onclose!({ code: 1006, reason: 'gone' });
    expect(cb.onClose).toHaveBeenCalledWith(1006, 'gone');
  });
  it('does not report a close it asked for', async () => {
    const { conn, session, cb } = await connected();
    conn.close();
    expect(session.close).toHaveBeenCalledTimes(1);
    sdk.state.connectArgs!.callbacks.onclose!({ code: 1000, reason: '' });
    expect(cb.onClose).not.toHaveBeenCalled();
  });
});

describe('geminiTransport connection sends', () => {
  it('maps audio, text and stream end to sendRealtimeInput', async () => {
    const { conn, session } = await connected();
    const pcm = new Int16Array([1, 2, 3]);
    conn.sendAudio(pcm);
    conn.sendText('[APP] x');
    conn.sendAudioStreamEnd();
    expect(session.sendRealtimeInput.mock.calls.map((c) => c[0])).toEqual([
      { audio: { data: int16ToBase64(pcm), mimeType: 'audio/pcm;rate=16000' } },
      { text: '[APP] x' },
      { audioStreamEnd: true },
    ]);
  });
  it('sends one tool response whose every function response has an own id key and an output wrapper', async () => {
    const { conn, session } = await connected();
    const result = { ok: true, instruction: 'next' };
    conn.sendToolResponses([{ id: 'c1', name: 'get_status', result }, { name: 'get_trades', result }]);
    expect(session.sendToolResponse).toHaveBeenCalledTimes(1);
    const { functionResponses } = session.sendToolResponse.mock.calls[0]![0] as { functionResponses: Array<Record<string, unknown>> };
    expect(functionResponses).toHaveLength(2);
    for (const r of functionResponses) expect(Object.prototype.hasOwnProperty.call(r, 'id')).toBe(true);
    expect(functionResponses[0]).toEqual({ id: 'c1', name: 'get_status', response: { output: result } });
    expect(functionResponses[1]!.id).toBeUndefined();
  });
  it('drops sends after close and after the server closed the socket', async () => {
    const a = await connected();
    a.conn.close();
    a.conn.sendText('late');
    a.conn.sendAudio(new Int16Array(2));
    a.conn.sendToolResponses([{ name: 'n', result: { ok: true, instruction: '' } }]);
    expect(a.session.sendRealtimeInput).not.toHaveBeenCalled();
    expect(a.session.sendToolResponse).not.toHaveBeenCalled();

    const b = await connected();
    sdk.state.connectArgs!.callbacks.onclose!({ code: 1006, reason: '' });
    b.conn.sendText('late');
    expect(b.session.sendRealtimeInput).not.toHaveBeenCalled();
  });
});
