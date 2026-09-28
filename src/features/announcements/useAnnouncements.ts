'use client';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';

/** Today's notices for this user, most important first (D-054). */
export function useAnnouncements() {
  const ctx = useSession();
  const { announcements } = useServices();
  return useQuery(`announcements:${ctx.user.id}`, () => announcements.forUser(ctx), []);
}
