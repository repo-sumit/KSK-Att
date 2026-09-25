import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OpenSessionScreen } from '@/features/attendance/OpenSessionScreen';

export const metadata: Metadata = { title: 'Verify your presence' };

export default function Page() {
  return (
    <Suspense>
      <OpenSessionScreen />
    </Suspense>
  );
}
