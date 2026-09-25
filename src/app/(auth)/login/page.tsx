import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InstituteCodeScreen } from '@/features/auth/InstituteCodeScreen';

export const metadata: Metadata = { title: 'Log in' };

export default function Page() {
  return (
    <Suspense>
      <InstituteCodeScreen />
    </Suspense>
  );
}
