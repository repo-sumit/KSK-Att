'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSessionState } from '@/hooks/session';
import { routes } from '@/lib/routes';
import { BootSplash } from './BootSplash';

/** "/" sends a signed-in user home and everyone else to login. */
export function EntryRedirect() {
  const { state } = useSessionState();
  const router = useRouter();
  useEffect(() => {
    if (state.status === 'ready') router.replace(routes.home);
    if (state.status === 'signed_out') router.replace(routes.login);
  }, [state.status, router]);
  return <BootSplash />;
}
