import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CorrectScreen } from '@/features/principal/CorrectScreen';

export const metadata: Metadata = { title: 'Correct attendance' };

export default function Page() {
  return (
    <Suspense>
      <CorrectScreen />
    </Suspense>
  );
}
