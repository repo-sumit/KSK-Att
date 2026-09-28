/**
 * LoginAssist — an optional "pick an account" helper for the login inputs.
 *
 * The demo layer supplies one (its demo accounts, from demo data); production
 * builds pass none, so the login screens render nothing extra. A value only
 * reaches a field after the user picks an account: the login steps and both
 * confirmations are never skipped, and nothing is ever submitted for the user.
 */
export interface LoginCredentials {
  readonly instituteCode: string;
  readonly trainerId: string;
  /** Who the credentials belong to, e.g. "Dr. Anil Deshmukh · Principal". */
  readonly who: string;
}

export interface LoginAssistOption {
  readonly id: string;
  /** What the account demonstrates, e.g. "Principal". */
  readonly label: string;
  /** The person, e.g. "Dr. Anil Deshmukh". */
  readonly who: string;
}

/** Everything the helper shows. The source supplies all its text (demo tooling is English-only). */
export interface LoginAssist {
  /** The control, e.g. "Use demo account". */
  readonly label: string;
  /** Prefix of the confirmation line once an account is picked, e.g. "Demo account". */
  readonly chosenLabel: string;
  /** The action that reopens the choices, e.g. "Change". */
  readonly changeLabel: string;
  readonly options: readonly LoginAssistOption[];
  /** An option to highlight (e.g. the one the presenter picked elsewhere). Highlighted only: never filled. */
  readonly suggested: string | null;
}

export interface LoginAssistSource {
  /** Referentially stable while nothing changed (read with useSyncExternalStore). */
  get(): LoginAssist | null;
  subscribe(listener: () => void): () => void;
  /** The user picked an account: the source gets it ready and returns what to fill (null for an unknown id). */
  choose(id: string): Promise<LoginCredentials | null>;
  /** The credentials of an account picked earlier in this login, for a later step (null for an unknown id). */
  credentials(id: string): LoginCredentials | null;
}
