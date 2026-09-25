import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReviewScreen } from '@/features/attendance/review/ReviewScreen';

export const metadata: Metadata = { title: 'Review attendance' };

export default function Page() {
  return (
    <Suspense>
      <ReviewScreen />
    </Suspense>
  );
}
