import type { ReactNode } from 'react';
import { SessionGate } from '@/components/shell/SessionGate';

export default function AppLayout({ children }: { readonly children: ReactNode }) {
  return <SessionGate>{children}</SessionGate>;
}
