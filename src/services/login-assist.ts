/**
 * LoginAssist — an optional one-tap prefill for the two login inputs.
 *
 * The demo layer supplies one (credentials of the persona the presenter picked,
 * from demo data); production builds pass none, so the login screens render
 * nothing extra. A value only reaches a field when the user taps the assist:
 * the login steps and both confirmations are never skipped.
 */
export interface LoginAssist {
  /** The assist's button text, supplied by the source (demo tooling is English-only). */
  readonly label: string;
  /** Who the credentials belong to, e.g. "Rajesh Patil · Open instructor". */
  readonly who: string;
  readonly instituteCode: string;
  readonly trainerId: string;
}

export interface LoginAssistSource {
  get(): LoginAssist | null;
  subscribe(listener: () => void): () => void;
}
