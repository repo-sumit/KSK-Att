import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FaceEnrolScreen } from '@/features/face/FaceEnrolScreen';

export const metadata: Metadata = { title: 'Face registration' };

export default function Page() {
  return (
    <Suspense>
      <FaceEnrolScreen />
    </Suspense>
  );
}
