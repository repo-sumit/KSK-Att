/**
 * The counters behind D-082's "the trainer has spoken since the question" (src/domain/voice/confirm.ts).
 * Transcript events are not utterances: one utterance arrives as several fragments, and the Live API does not
 * order transcription messages against toolCall messages, so fragments of the words that led to a question can
 * arrive after its code was issued. So this counts turns, not events:
 *  - `turnSeq` goes up when a model turn ends (turnComplete, or interrupted when the trainer barged in);
 *  - `speechSeq` goes up once per trainer turn, at its first words after a model turn ended (later fragments,
 *    and a bare `finished` flag, never count);
 *  - `spokeAtTurn` is `turnSeq` when the trainer's latest turn began.
 * Used by VoiceSession (fed every server event) and by the live harness (typed trainer turns).
 */

export interface SpeechCounts {
  readonly turnSeq: number;
  readonly speechSeq: number;
  readonly spokeAtTurn: number;
}

export class TrainerTurns {
  private turns = 0;
  private spoken = 0;
  private spokeAt = 0;
  /** A model turn ended and the trainer has not spoken since: their next words start a new trainer turn. */
  private open = true;

  /** One server event: an interruption ends the model's turn before its words count; a turnComplete after them. */
  observe(e: { readonly inputText?: string; readonly interrupted?: boolean; readonly turnComplete?: boolean }): void {
    if (e.interrupted) this.endModelTurn();
    if (e.inputText?.trim()) this.spoke();
    if (e.turnComplete) this.endModelTurn();
  }

  /** The trainer said something: counts only as the first words after a model turn ended. */
  spoke(): void {
    if (!this.open) return;
    this.open = false;
    this.spoken += 1;
    this.spokeAt = this.turns;
  }

  get counts(): SpeechCounts {
    return { turnSeq: this.turns, speechSeq: this.spoken, spokeAtTurn: this.spokeAt };
  }

  private endModelTurn(): void {
    this.turns += 1;
    this.open = true;
  }
}
