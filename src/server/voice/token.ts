/**
 * Mints the single-use ephemeral token the browser connects to Gemini Live with (D-078, spec §2 and §10).
 * The API key stays on the server; the token is what reaches the browser. Plain TypeScript apart from the
 * SDK, so the same code can later sit behind a real backend.
 */
import { GoogleGenAI, Modality, type CreateAuthTokenConfig } from '@google/genai';

/** The Live model. The token locks it, so the browser cannot ask for another one. */
export const VOICE_MODEL = 'gemini-3.8-live';

/**
 * The API version for both the mint and the browser's connect; the route sends it to the client so the two can
 * never differ. Spike of 2 Oct 2026 (`npm run voice:spike-token`, @google/genai 2.26.0): the whole path (mint,
 * connect, first audio) worked on v1alpha and on v1beta. v1alpha stays: it is the version the MVP ran on and the
 * only one the SDK's own docs list for ephemeral tokens (on v1beta the SDK warns "v1alpha only").
 */
export const LIVE_API_VERSION: 'v1alpha' | 'v1beta' = 'v1alpha';

export interface MintEnv {
  readonly GEMINI_API_KEY?: string;
  /** Kill switch: exactly "1" turns voice off (the route answers 503). */
  readonly VOICE_DISABLED?: string;
}

export type MintResult = { ok: true; token: string; expiresAt: string } | { ok: false; error: 'unavailable' };

type CreateToken = (key: string, config: object) => Promise<{ name?: string }>;

/** After this, messages in a session opened with the token are rejected (a connection lasts about 10 minutes). */
const TOKEN_LIFETIME_MS = 30 * 60_000;
/** A new session must start within this long of the mint; the browser connects right after it fetches the token. */
const NEW_SESSION_WINDOW_MS = 60_000;
/** The mint call to Google gives up after this long (the SDK has no default timeout and does not retry). */
const MINT_TIMEOUT_MS = 8_000;

const sdkCreate: CreateToken = (key, config) =>
  new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: LIVE_API_VERSION } }).authTokens.create({ config });

/** The HTTP status of a failed Google call, when the SDK's error carries one. A number, so it cannot hold the key. */
function statusOf(error: unknown): number | undefined {
  const status = typeof error === 'object' && error !== null ? (error as { status?: unknown }).status : undefined;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Asks Google for a token that is good for one connection, for the Live model, with audio-only replies. Every
 * failure (no key, kill switch, quota, network, timeout) is the same `unavailable`: the browser gets no detail
 * and nothing that could contain the key is logged.
 */
export async function mintVoiceToken(env: MintEnv, now: Date, create: CreateToken = sdkCreate): Promise<MintResult> {
  const key = env.GEMINI_API_KEY;
  if (!key || env.VOICE_DISABLED === '1') return { ok: false, error: 'unavailable' };

  const expiresAt = new Date(now.getTime() + TOKEN_LIFETIME_MS).toISOString();
  const config = {
    uses: 1,
    expireTime: expiresAt,
    newSessionExpireTime: new Date(now.getTime() + NEW_SESSION_WINDOW_MS).toISOString(),
    liveConnectConstraints: { model: VOICE_MODEL, config: { responseModalities: [Modality.AUDIO] } },
    // Lock only what the constraints set (the model and AUDIO). Without this empty list the SDK sends no field
    // mask and the server locks every field, silently ignoring the prompt and tools the browser sets.
    lockAdditionalFields: [],
    httpOptions: { apiVersion: LIVE_API_VERSION, timeout: MINT_TIMEOUT_MS },
  } satisfies CreateAuthTokenConfig;

  try {
    const created = await create(key, config);
    if (!created.name) {
      console.warn('[voice] token mint failed');
      return { ok: false, error: 'unavailable' };
    }
    return { ok: true, token: created.name, expiresAt };
  } catch (error) {
    const status = statusOf(error);
    console.warn(status === undefined ? '[voice] token mint failed' : `[voice] token mint failed (HTTP ${status})`);
    return { ok: false, error: 'unavailable' };
  }
}
