import type { Metadata } from 'next';
import { StaffScreen } from '@/features/staff/StaffScreen';

export const metadata: Metadata = { title: 'Staff attendance' };

export default function Page() {
  return <StaffScreen />;
}
