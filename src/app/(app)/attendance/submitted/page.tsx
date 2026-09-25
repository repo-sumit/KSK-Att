import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SubmittedScreen } from '@/features/attendance/review/SubmittedScreen';

export const metadata: Metadata = { title: 'Attendance submitted' };

export default function Page() {
  return (
    <Suspense>
      <SubmittedScreen />
    </Suspense>
  );
}
