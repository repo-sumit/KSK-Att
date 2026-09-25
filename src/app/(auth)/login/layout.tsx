import type { ReactNode } from 'react';
import { LoginFlowProvider } from '@/features/auth/LoginFlow';

export default function LoginLayout({ children }: { readonly children: ReactNode }) {
  return <LoginFlowProvider>{children}</LoginFlowProvider>;
}
