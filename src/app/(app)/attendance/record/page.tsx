import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RecordScreen } from '@/features/attendance/record/RecordScreen';

export const metadata: Metadata = { title: 'Attendance record' };

export default function Page() {
  return (
    <Suspense>
      <RecordScreen />
    </Suspense>
  );
}
