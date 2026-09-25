import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ConfirmIdentityScreen } from '@/features/auth/ConfirmIdentityScreen';

export const metadata: Metadata = { title: 'Confirm identity' };

export default function Page() {
  return (
    <Suspense>
      <ConfirmIdentityScreen />
    </Suspense>
  );
}
