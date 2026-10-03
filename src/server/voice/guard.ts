/**
 * Request guards for the voice token route (D-078, spec §10): who may ask for a token, and how often.
 * Plain TypeScript with no framework imports, so it is unit-testable and can move behind a real backend later.
 */

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * True when the browser's `Origin` is this site (its host, port included, equals the request's `Host`) or one of
 * the `extra` origins (compared as origins, so case and a trailing slash do not matter). A missing or unparsable
 * origin (no header, the literal "null" of a sandboxed frame) is refused.
 */
export function originAllowed(origin: string | null, host: string | null, extra: readonly string[]): boolean {
  const parsed = origin ? parseUrl(origin) : null;
  if (!parsed) return false;
  if (host && parsed.host === host) return true;
  return extra.some((listed) => parseUrl(listed)?.origin === parsed.origin);
}

/** The longest rate-limit key: an `x-forwarded-for` header is client-controlled text, so the key is capped. */
const MAX_CLIENT_KEY = 64;

/**
 * The rate-limit key for a request: the first `x-forwarded-for` hop (the client; the platform sets it), trimmed
 * and capped at 64 characters so a hostile header cannot grow the limiter's map. 'local' when there is none (local dev).
 */
export function clientKey(forwardedFor: string | null): string {
  return forwardedFor?.split(',')[0]?.trim().slice(0, MAX_CLIENT_KEY) || 'local';
}

/**
 * At most `limit` hits per key in each fixed window that starts at a key's first hit. State lives in this
 * instance (one serverless instance, one process), which is enough for a per-IP brake; it is not a quota.
 */
export class FixedWindowLimiter {
  private readonly hits = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** true = allowed; records the hit. A refused hit is not recorded, so it does not extend the wait. */
  hit(key: string, nowMs: number): boolean {
    this.prune(nowMs);
    const current = this.hits.get(key);
    const entry = current && nowMs - current.start < this.windowMs ? current : { start: nowMs, count: 0 };
    this.hits.set(key, entry);
    if (entry.count >= this.limit) return false;
    entry.count += 1;
    return true;
  }

  /** Milliseconds until `key` may hit again; 0 when it may now (unseen key or expired window). */
  retryAfterMs(key: string, nowMs: number): number {
    const entry = this.hits.get(key);
    return entry ? Math.max(0, entry.start + this.windowMs - nowMs) : 0;
  }

  /** Forget keys whose window ended more than one whole window ago, so the map cannot grow without bound. */
  private prune(nowMs: number): void {
    for (const [key, entry] of this.hits) {
      if (nowMs - entry.start > 2 * this.windowMs) this.hits.delete(key);
    }
  }
}
