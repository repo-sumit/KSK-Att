/**
 * Live captions from the two transcriptions (MVP-02 §6, appendCaption / closeCaptions). The input and output
 * transcripts arrive as fragments with no fixed order, so a fragment joins the newest open line of the same
 * speaker. Captions stay in memory only (voice design §6: transcriptRetentionDays 0). Pure TypeScript.
 */
export interface Caption {
  readonly who: 'trainer' | 'agent';
  readonly text: string;
  readonly final: boolean;
}

/** The dock shows the newest lines only. */
export const MAX_CAPTIONS = 14;

function lastOpen(lines: readonly Caption[], who: Caption['who']): number {
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].who === who && !lines[i].final) return i;
  return -1;
}

/** Joins `text` to the newest open line of `who` (keeping the model's spaces), or starts a line. */
export function appendCaption(lines: readonly Caption[], who: Caption['who'], text: string): readonly Caption[] {
  const i = lastOpen(lines, who);
  if (i >= 0) return lines.map((l, j) => (j === i ? { ...l, text: l.text + text } : l));
  const start = text.trimStart();
  if (!start) return lines;
  return [...lines, { who, text: start, final: false }].slice(-MAX_CAPTIONS);
}

/** Closes the open lines of `who`, or of both speakers. The same array when nothing was open. */
export function closeCaptions(lines: readonly Caption[], who?: Caption['who']): readonly Caption[] {
  const closing = (l: Caption) => !l.final && (!who || l.who === who);
  return lines.some(closing) ? lines.map((l) => (closing(l) ? { ...l, final: true } : l)) : lines;
}

/** The captions after one server event: fragments join, then the trainer line closes at inputFinished, the agent line at interrupted, every line at turnComplete. */
export function captionsAfter(
  lines: readonly Caption[],
  e: { readonly inputText?: string; readonly inputFinished?: boolean; readonly outputText?: string; readonly interrupted?: boolean; readonly turnComplete?: boolean },
): readonly Caption[] {
  let next = lines;
  if (e.inputText) next = appendCaption(next, 'trainer', e.inputText);
  if (e.inputFinished) next = closeCaptions(next, 'trainer');
  if (e.outputText) next = appendCaption(next, 'agent', e.outputText);
  if (e.interrupted) next = closeCaptions(next, 'agent');
  if (e.turnComplete) next = closeCaptions(next);
  return next;
}
