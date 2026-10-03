'use client';
import { useRouter } from 'next/navigation';
import { useVoiceBusEvent } from '@/hooks/useVoiceBus';

/**
 * The provider's half of the Action Bus (D-085): navigation and the end of voice. `show_trade` belongs to
 * AttendanceBoard and `verify_retry` to VerificationFlow, which own that state. `focus_student` becomes the session's
 * `focus` (VoiceFocusContext): the current StudentRow outlines and scrolls itself, also when it renders later (m13).
 */
export function useActionBus(voice: { readonly running: boolean; stop(): void }): void {
  const router = useRouter();

  useVoiceBusEvent('navigate', (e) => {
    // The executor repeats the review navigation with every submit code: the same URL again is not a new step.
    const target = new URL(e.href, window.location.origin);
    if (target.pathname + target.search === window.location.pathname + window.location.search) return;
    if (e.replace) router.replace(e.href);
    else router.push(e.href);
  });

  // A running session ends itself after its goodbye line (the next turnComplete, or 4 s): stopping now would cut it off.
  useVoiceBusEvent('end_voice', () => {
    if (!voice.running) voice.stop();
  });
}
