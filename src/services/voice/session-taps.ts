/**
 * What reaches a voice session from outside the conversation (voice design §5.3, D-085, D-086): taps on the
 * shared draft, verification events, the agent's focus_student events and connectivity. Every listener is
 * synchronous: the draft and verification services catch a throwing listener but not a rejected promise, so
 * async work goes to the session's tool queue, which owns its rejections.
 */
import type { VerificationEvent } from '../verification';
import type { VoiceSessionDeps, VoiceState } from './session-types';

export interface TapHandlers {
  /** An [APP] text for the model (null: nothing to say). */
  text(text: string | null): void;
  /** Whether a text sent now reaches the model (false while paused or not live: it would be dropped). */
  live(): boolean;
  /** The trainer did something by hand (a tap): resets the idle clock. */
  activity(): void;
  verification(e: VerificationEvent): void;
  focus(focus: VoiceState['focus']): void;
  offline(): void;
}

/** Subscribes everything; the returned functions unsubscribe. */
export function attachTaps(deps: VoiceSessionDeps, on: TapHandlers): (() => void)[] {
  return [
    // Called for every change, synchronously: the executor voids an open confirmation on any of them (D-082).
    // While the text would be dropped (paused, not live), the executor only follows the tap: it asks nothing.
    // A tap is activity (voice's own marks count through their tool call).
    deps.drafts.subscribe('*', (change) => {
      if (change.via === 'tap') on.activity();
      on.text(deps.executor.onDraftChange(change, !on.live()));
    }),
    deps.verification.subscribe((e) => on.verification(e)),
    deps.bus.subscribe((e) => {
      if (e.type === 'focus_student') on.focus({ sessionKey: e.sessionKey, studentId: e.studentId, seq: e.seq });
    }),
    deps.onOnlineChange((online) => {
      if (!online) on.offline();
    }),
  ];
}

/** The purposes whose face camera is on: the mic pauses while any is (D-086). Seeded from the service when the taps attach. */
export class CameraWatch {
  private readonly on = new Set<string>();

  /** Starts from the cameras that are already on (a session can start mid-check). */
  reset(seed: readonly string[] = []): void {
    this.on.clear();
    for (const purpose of seed) this.on.add(purpose);
  }

  apply(e: VerificationEvent): void {
    if (e.type !== 'camera') return;
    if (e.on) this.on.add(e.purpose);
    else this.on.delete(e.purpose);
  }

  get isOn(): boolean {
    return this.on.size > 0;
  }
}
