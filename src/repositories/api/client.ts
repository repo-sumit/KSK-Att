/**
 * Minimal typed HTTP client for the future backend. Not used by the demo build.
 * Auth: the SwiftChat host is expected to provide a session token; it is sent
 * as a bearer header and never stored in client code or the repository.
 */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet — the demo uses repositories/mock (see docs/ARCHITECTURE.md).`);
    this.name = 'NotImplementedError';
  }
}

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly getToken: () => string | undefined;
  readonly fetchImpl?: typeof fetch;
}

export class ApiClient {
  constructor(private readonly opts: ApiClientOptions) {}

  async request<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
    const token = this.opts.getToken();
    const res = await (this.opts.fetchImpl ?? fetch)(`${this.opts.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  }
}
