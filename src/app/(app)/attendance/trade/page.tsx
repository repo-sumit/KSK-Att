import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TradeScreen } from '@/features/attendance/TradeScreen';

export const metadata: Metadata = { title: 'Select batch' };

export default function Page() {
  return (
    <Suspense>
      <TradeScreen />
    </Suspense>
  );
}
