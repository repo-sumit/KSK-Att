import type { Metadata } from 'next';
import { OfflineScreen } from '@/features/profile/OfflineScreen';

export const metadata: Metadata = { title: 'Offline data' };

export default function Page() {
  return <OfflineScreen />;
}
