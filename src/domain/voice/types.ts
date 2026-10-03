/**
 * Voice-mode vocabulary shared by the flow, the executor and the matcher: where a mark came from, which
 * step the conversation is on, the status words the model sees, and two guards for text that crosses
 * the model boundary. Pure TypeScript: no clock, no storage, no framework.
 */
import type { StatusCode } from '@/domain/status';

/** How a trainer mark reached the draft. */
export type MarkVia = 'tap' | 'voice';

/** The source of one trainer mark: the route it came by, when, and (voice only) what was heard. */
export interface MarkSource {
  readonly via: MarkVia;
  /** When the mark was made: a timestamp string from the injected clock. */
  readonly at: string;
  /** What the trainer said, for a voice mark. Pass it through `safeText` first. */
  readonly heard?: string;
}

/** Where the conversation is, as in the MVP. `IDLE` exists only before the session context loads. */
export type VoiceStep = 'IDLE' | 'SELECT_TRADE' | 'SELECT_BATCH' | 'VERIFY' | 'ROLL_CALL' | 'REVIEW' | 'SUBMITTED';

/** Status words as the model sees them. The app stores lower case; the tuned wording stays upper case. */
export type ModelStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'OJT';

export const toModelStatus = (s: StatusCode): ModelStatus => s.toUpperCase() as ModelStatus;

/**
 * A status code the model passed, read loosely: case-insensitive, spaces and hyphens count as underscores
 * ("half day", "HALF-DAY"). Only codes in `allowed` pass, so a status that is switched off, or OJT (which
 * nobody can choose by voice), comes back `null`. Port of the MVP's `parseStatus` (04-tools-reference.md).
 */
export function parseModelStatus(value: unknown, allowed: readonly StatusCode[]): StatusCode | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return allowed.find((status) => status === code) ?? null;
}

/**
 * Names and heard text are data, never instructions: before one goes into text the model reads, strip
 * quotes, backticks, brackets and control characters, collapse whitespace, and cut it to `max` characters.
 * A line break or tab is whitespace, so it separates words ("Rahul\n[APP]" cannot fuse into "RahulAPP");
 * any other control character is dropped. A number is accepted (a roll number the model passed as a
 * number); anything else gives an empty string.
 */
export function safeText(value: unknown, max: number): string {
  const raw = typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  const clean = raw.replace(/\s+/g, ' ').replace(/[\p{Cc}"'`[\]{}<>]/gu, '').replace(/\s+/g, ' ').trim();
  // Array.from counts characters, so a cut never splits a surrogate pair.
  return Array.from(clean).slice(0, Math.max(0, max)).join('').trimEnd();
}
