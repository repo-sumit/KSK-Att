import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { FixedWindowLimiter, clientKey, originAllowed } from '@/server/voice/guard';
import { LIVE_API_VERSION, VOICE_MODEL, mintVoiceToken } from '@/server/voice/token';

describe('originAllowed', () => {
  it('accepts the same origin and listed extras, refuses others and missing origins', () => {
    expect(originAllowed('https://ksk.example.in', 'ksk.example.in', [])).toBe(true);
    expect(originAllowed('http://localhost:3000', 'localhost:3000', [])).toBe(true);
    expect(originAllowed('https://evil.example', 'ksk.example.in', [])).toBe(false);
    expect(originAllowed('https://swiftchat.example', 'ksk.example.in', ['https://swiftchat.example'])).toBe(true);
    expect(originAllowed(null, 'ksk.example.in', [])).toBe(false);
  });

  it('refuses unparsable origins, look-alike hosts, other ports and a request without a Host', () => {
    expect(originAllowed('null', 'ksk.example.in', [])).toBe(false);
    expect(originAllowed('not a url', 'ksk.example.in', [])).toBe(false);
    expect(originAllowed('https://ksk.example.in.evil.example', 'ksk.example.in', [])).toBe(false);
    expect(originAllowed('http://localhost:3001', 'localhost:3000', [])).toBe(false);
    expect(originAllowed('https://ksk.example.in', null, [])).toBe(false);
  });

  it('compares the listed extras as origins: case and a trailing slash do not matter, the port does', () => {
    expect(originAllowed('https://swiftchat.example', 'ksk.example.in', ['https://SwiftChat.example/'])).toBe(true);
    expect(originAllowed('https://swiftchat.example:8443', 'ksk.example.in', ['https://swiftchat.example'])).toBe(false);
    expect(originAllowed('https://swiftchat.example', 'ksk.example.in', ['not a url'])).toBe(false);
    expect(originAllowed('https://swiftchat.example', null, ['https://swiftchat.example'])).toBe(true);
  });
});

describe('clientKey', () => {
  it('is the first x-forwarded-for hop, trimmed; "local" when there is none', () => {
    expect(clientKey('203.0.113.9, 10.0.0.1')).toBe('203.0.113.9');
    expect(clientKey('  203.0.113.9  ')).toBe('203.0.113.9');
    expect(clientKey(null)).toBe('local');
    expect(clientKey('')).toBe('local');
    expect(clientKey(' , 10.0.0.1')).toBe('local');
  });

  it('is capped at 64 characters, so two long headers with the same first 64 characters share one key', () => {
    const long = 'a'.repeat(1_000);
    expect(clientKey(long)).toHaveLength(64);
    expect(clientKey(`${'b'.repeat(64)}one`)).toBe(clientKey(`${'b'.repeat(64)}two, 10.0.0.1`));
    expect(clientKey('c'.repeat(63))).toHaveLength(63);
  });
});

describe('FixedWindowLimiter', () => {
  it('allows `limit` hits per window per key, then refuses until the window passes', () => {
    const l = new FixedWindowLimiter(2, 60_000);
    expect(l.hit('ip', 0)).toBe(true);
    expect(l.hit('ip', 1)).toBe(true);
    expect(l.hit('ip', 2)).toBe(false);
    expect(l.retryAfterMs('ip', 2)).toBe(59_998);
    expect(l.hit('other', 2)).toBe(true);
    expect(l.hit('ip', 60_000)).toBe(true);
  });

  it('does not count refused hits and has nothing to wait for on an unseen key or an expired window', () => {
    const l = new FixedWindowLimiter(1, 1_000);
    expect(l.retryAfterMs('nobody', 0)).toBe(0);
    expect(l.hit('ip', 0)).toBe(true);
    expect(l.hit('ip', 10)).toBe(false);
    expect(l.hit('ip', 999)).toBe(false);
    expect(l.retryAfterMs('ip', 999)).toBe(1);
    expect(l.retryAfterMs('ip', 1_000)).toBe(0);
    expect(l.retryAfterMs('ip', 5_000)).toBe(0); // long expired, never negative
    expect(l.hit('ip', 1_000)).toBe(true); // the refused hits did not carry over into the next window
    expect(l.hit('ip', 1_001)).toBe(false);
  });

  it('drops entries older than two windows when any key hits, so memory stays bounded', () => {
    const l = new FixedWindowLimiter(1, 1_000);
    const keys = () => [...l['hits'].keys()];
    l.hit('old', 0);
    l.hit('recent', 1_500); // 'old' is 1.5 windows old: kept
    expect(keys()).toEqual(['old', 'recent']);
    l.hit('new', 2_500); // 'old' is 2.5 windows old: dropped; 'recent' is one window old: kept
    expect(keys()).toEqual(['recent', 'new']);
  });
});

describe('mintVoiceToken', () => {
  const now = new Date('2026-10-02T04:45:00Z');
  let warn: MockInstance<Console['warn']>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); // a failed mint warns once: keep it out of the test output
  });
  it('is unavailable without a key or with the kill switch, and never calls Google then', async () => {
    const create = vi.fn();
    expect(await mintVoiceToken({}, now, create)).toEqual({ ok: false, error: 'unavailable' });
    expect(await mintVoiceToken({ GEMINI_API_KEY: 'k', VOICE_DISABLED: '1' }, now, create)).toEqual({ ok: false, error: 'unavailable' });
    expect(create).not.toHaveBeenCalled();
  });
  it('mints a single-use, model-locked token with a 30-minute expiry', async () => {
    const create = vi.fn().mockResolvedValue({ name: 'auth_tokens/abc' });
    const r = await mintVoiceToken({ GEMINI_API_KEY: 'k' }, now, create);
    expect(r).toEqual({ ok: true, token: 'auth_tokens/abc', expiresAt: '2026-10-02T05:15:00.000Z' });
    const [, config] = create.mock.calls[0];
    expect(config).toMatchObject({ uses: 1, expireTime: '2026-10-02T05:15:00.000Z', newSessionExpireTime: '2026-10-02T04:46:00.000Z', lockAdditionalFields: [], liveConnectConstraints: { model: 'gemini-3.8-live' } });
  });
  it('maps a Google failure to unavailable without leaking the error', async () => {
    const create = vi.fn().mockRejectedValue(new Error('quota exceeded for key k'));
    expect(await mintVoiceToken({ GEMINI_API_KEY: 'k' }, now, create)).toEqual({ ok: false, error: 'unavailable' });
  });

  it('passes the key and a config that locks only the model and the audio modality, on one API version, with a timeout', async () => {
    const create = vi.fn().mockResolvedValue({ name: 'auth_tokens/abc' });
    await mintVoiceToken({ GEMINI_API_KEY: 'the-key' }, now, create);
    expect(create).toHaveBeenCalledTimes(1);
    const [key, config] = create.mock.calls[0];
    expect(key).toBe('the-key');
    expect(config).toMatchObject({
      liveConnectConstraints: { model: VOICE_MODEL, config: { responseModalities: ['AUDIO'] } },
      httpOptions: { apiVersion: LIVE_API_VERSION, timeout: 8_000 },
    });
    expect(VOICE_MODEL).toBe('gemini-3.8-live');
  });
  it('passes LIVE_API_VERSION to the SDK, on the mint config and on the SDK client the mint builds', async () => {
    const create = vi.fn().mockResolvedValue({ name: 'auth_tokens/abc' });
    await mintVoiceToken({ GEMINI_API_KEY: 'k' }, now, create);
    const [, config] = create.mock.calls[0];
    expect(config.httpOptions.apiVersion).toBe(LIVE_API_VERSION);

    // The default creator builds the SDK client: its constructor must receive the same version.
    const ctor = vi.fn();
    vi.resetModules();
    try {
      vi.doMock('@google/genai', async (importOriginal) => ({
        ...(await importOriginal<typeof import('@google/genai')>()),
        GoogleGenAI: class {
          authTokens = { create: vi.fn().mockResolvedValue({ name: 'auth_tokens/sdk' }) };
          constructor(options: unknown) {
            ctor(options);
          }
        },
      }));
      const fresh = await import('@/server/voice/token');
      expect(await fresh.mintVoiceToken({ GEMINI_API_KEY: 'k' }, now)).toMatchObject({ ok: true, token: 'auth_tokens/sdk' });
      expect(ctor).toHaveBeenCalledWith({ apiKey: 'k', httpOptions: { apiVersion: fresh.LIVE_API_VERSION } });
    } finally {
      vi.doUnmock('@google/genai');
      vi.resetModules();
    }
  });
  it('treats only VOICE_DISABLED=1 as the kill switch', async () => {
    const create = vi.fn().mockResolvedValue({ name: 'auth_tokens/abc' });
    expect((await mintVoiceToken({ GEMINI_API_KEY: 'k', VOICE_DISABLED: '' }, now, create)).ok).toBe(true);
    expect((await mintVoiceToken({ GEMINI_API_KEY: 'k', VOICE_DISABLED: '0' }, now, create)).ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
  });
  it('is unavailable when Google answers without a token name', async () => {
    expect(await mintVoiceToken({ GEMINI_API_KEY: 'k' }, now, vi.fn().mockResolvedValue({}))).toEqual({ ok: false, error: 'unavailable' });
    expect(await mintVoiceToken({ GEMINI_API_KEY: 'k' }, now, vi.fn().mockResolvedValue({ name: '' }))).toEqual({ ok: false, error: 'unavailable' });
  });
  it('logs one fixed line on a failure, never the key or the error text', async () => {
    const create = vi.fn().mockRejectedValue(new Error('quota exceeded for key sk-secret-123'));
    await mintVoiceToken({ GEMINI_API_KEY: 'sk-secret-123' }, now, create);
    // Exactly one call with exactly one string: handing the Error itself to console.warn would print its message.
    expect(warn.mock.calls).toEqual([['[voice] token mint failed']]);
  });
  it('adds the HTTP status to that line when Google sent one (a number, so it cannot carry the key)', async () => {
    const create = vi.fn().mockRejectedValue(Object.assign(new Error('Too many requests, key sk-secret-123'), { status: 429 }));
    await mintVoiceToken({ GEMINI_API_KEY: 'sk-secret-123' }, now, create);
    expect(warn.mock.calls).toEqual([['[voice] token mint failed (HTTP 429)']]);
  });
});
