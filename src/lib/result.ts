/**
 * Typed success/failure values for domain and service operations.
 * Business-rule violations are returned, never thrown, so callers (and the UI)
 * must handle each named error code explicitly.
 */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E extends string> = { readonly ok: false; readonly error: E; readonly detail?: Record<string, unknown> };
export type Result<T, E extends string> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E extends string>(error: E, detail?: Record<string, unknown>): Err<E> =>
  detail ? { ok: false, error, detail } : { ok: false, error };

/** Unwraps a result in places where failure is a programming error (tests, seeds). */
export function unwrap<T, E extends string>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`Unexpected error result: ${result.error}`);
  return result.value;
}
