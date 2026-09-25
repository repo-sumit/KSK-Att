import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ConfirmInstituteScreen } from '@/features/auth/ConfirmInstituteScreen';

export const metadata: Metadata = { title: 'Confirm institute' };

export default function Page() {
  return (
    <Suspense>
      <ConfirmInstituteScreen />
    </Suspense>
  );
}
