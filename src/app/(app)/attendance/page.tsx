import type { Metadata } from 'next';
import { AttendanceTabScreen } from '@/features/attendance/AttendanceTabScreen';

export const metadata: Metadata = { title: 'Attendance' };

export default function Page() {
  return <AttendanceTabScreen />;
}
