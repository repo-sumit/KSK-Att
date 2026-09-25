'use client';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import type { SessionCard } from '@/services/attendance';
import type { StaffDayRow } from '@/services/staff-attendance';

export interface PrincipalOverview {
  /** Trade sessions (not subject classes) across the institute today. */
  readonly sessions: readonly SessionCard[];
  readonly staff: readonly StaffDayRow[];
}

export function usePrincipalOverview() {
  const ctx = useSession();
  const { attendance, staffAttendance } = useServices();
  return useQuery<PrincipalOverview>(
    `principal-overview:${ctx.institute.id}`,
    async () => {
      const boards = await Promise.all(ctx.access.tradeIds.map((id) => attendance.boardForTrade(ctx, id)));
      const staff = ctx.journey.staff.principalStaffView ? await staffAttendance.day(ctx) : [];
      return { sessions: boards.flat().filter((c) => !c.address.subjectId), staff };
    },
    ['attendance', 'staff', 'offline', 'corrections'],
  );
}
