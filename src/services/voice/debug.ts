/**
 * The one `?voiceDebug=1` gate for voice debug lines (service and action bus). Debug lines are
 * `console.info('[voice] …')`, ids and codes only, never `console.error` (E2E fails on console errors).
 */

/**
 * Once seen, the flag holds for the rest of the page load: voice's first step navigates (router.push to a URL
 * without the parameter), and the lines must not stop there. Read at module load too, so a page opened with the
 * flag keeps it even when the first line comes after a navigation.
 */
let seen = false;

function read(): boolean {
  try {
    return typeof location !== 'undefined' && new URLSearchParams(location.search).get('voiceDebug') === '1';
  } catch {
    return false;
  }
}

seen = read();

/** True in a browser page that was opened with `?voiceDebug=1` (or has shown it since it loaded). */
export function voiceDebugEnabled(): boolean {
  if (!seen) seen = read();
  return seen;
}

/** One `[voice]` line when the gate is on; nothing otherwise. */
export function voiceDebug(line: string): void {
  if (voiceDebugEnabled()) console.info('[voice] ' + line);
}
