import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MarkScreen } from '@/features/attendance/mark/MarkScreen';

export const metadata: Metadata = { title: 'Student attendance' };

export default function Page() {
  return (
    <Suspense>
      <MarkScreen />
    </Suspense>
  );
}
