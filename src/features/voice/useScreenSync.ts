'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type { VoiceSession } from '@/services/voice/session';
import { screenSignal } from './screen-signal';

/**
 * Tells a running voice session which screen the trainer reached (a tap, Back, a link). VoiceSession.onScreen is
 * the only entry point: it runs the executor on the session's tool queue and sends its text while live. The screen
 * voice started on is not reported (the kickoff reads the state); only later changes of the URL are.
 * Uses useSearchParams: render it inside <Suspense>.
 */
export function useScreenSync(session: VoiceSession | null): void {
  const pathname = usePathname();
  const search = useSearchParams();
  const url = `${pathname}?${search.toString()}`;
  const last = useRef<{ readonly session: VoiceSession | null; readonly url: string } | null>(null);

  useEffect(() => {
    const before = last.current;
    last.current = { session, url };
    if (!session || before?.session !== session || before.url === url) return;
    session.onScreen(screenSignal(pathname, new URLSearchParams(search.toString())));
  }, [session, url, pathname, search]);
}

export function ScreenSync({ session }: { readonly session: VoiceSession | null }) {
  useScreenSync(session);
  return null;
}
