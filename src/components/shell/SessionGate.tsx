'use client';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { BootSplash } from '@/app-shell/BootSplash';
import { useSessionState } from '@/hooks/session';
import { routes } from '@/lib/routes';

/** Guards the signed-in route group: no session → login (deep links stay safe on refresh). */
export function SessionGate({ children }: { readonly children: ReactNode }) {
  const { state } = useSessionState();
  const router = useRouter();
  useEffect(() => {
    if (state.status === 'signed_out') router.replace(routes.login);
  }, [state.status, router]);
  if (state.status !== 'ready') return <BootSplash />;
  return <>{children}</>;
}
