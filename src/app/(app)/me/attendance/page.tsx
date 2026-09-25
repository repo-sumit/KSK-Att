import type { Metadata } from 'next';
import { SelfAttendanceScreen } from '@/features/staff/SelfAttendanceScreen';

export const metadata: Metadata = { title: 'My attendance' };

export default function Page() {
  return <SelfAttendanceScreen />;
}
