import type { Metadata } from 'next';
import { DownloadScreen } from '@/features/offline/DownloadScreen';

export const metadata: Metadata = { title: 'Download batches' };

export default function Page() {
  return <DownloadScreen />;
}
