/** Fetches the single-use Gemini Live token from our own route (D-078). Never logs the token. */
import { err, ok, type Result } from '@/lib/result';
import type { LiveToken } from './transport';

export type TokenError = 'unavailable' | 'rate_limited' | 'origin' | 'network';

const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function parseToken(body: unknown): LiveToken | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (!text(b.token) || !text(b.apiVersion) || !text(b.model) || !text(b.expiresAt)) return null;
  return { token: b.token, apiVersion: b.apiVersion, model: b.model, expiresAt: b.expiresAt };
}

export async function fetchLiveToken(
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Promise<Result<LiveToken, TokenError>> {
  let res: Response;
  try {
    res = await fetchImpl('/api/voice/token', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
  } catch {
    return err('network');
  }
  if (res.status === 403) return err('origin');
  if (res.status === 429) return err('rate_limited');
  if (!res.ok) return err('unavailable');
  try {
    const token = parseToken(await res.json());
    return token ? ok(token) : err('unavailable');
  } catch {
    return err('unavailable');
  }
}
