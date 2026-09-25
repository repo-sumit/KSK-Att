import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TrainerIdScreen } from '@/features/auth/TrainerIdScreen';

export const metadata: Metadata = { title: 'Trainer ID' };

export default function Page() {
  return (
    <Suspense>
      <TrainerIdScreen />
    </Suspense>
  );
}
