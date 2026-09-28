'use client';
import type { NavTab } from '@/config/journey';
import { useJourney } from '@/hooks/session';
import { routes } from '@/lib/routes';

/**
 * Where marking screens belong (D-052): the Attendance tab where it exists (the
 * principal's institute board), otherwise Home, which owns today's work.
 */
export function useAttendanceRoot(): { readonly href: string; readonly area: NavTab } {
  const tabs = useJourney().navTabs;
  return tabs.includes('attendance') ? { href: routes.attendance, area: 'attendance' } : { href: routes.home, area: 'home' };
}
