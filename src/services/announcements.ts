/**
 * AnnouncementService — the notices Home shows (extension, D-054). Filters by
 * who is reading and what is showing today; the banner shows the first one.
 */
import { compareAnnouncements, isForReader, isShowing, type Announcement, type AnnouncementReader } from '@/domain/announcement';
import { toLocalDate } from '@/lib/time';
import type { AnnouncementRepository } from '@/repositories/interfaces';
import type { SessionContext } from './context';

/**
 * Open mapping can reach every batch, but trade and batch notices follow the
 * batches a person actually teaches (their home batches and trades).
 */
export function readerFor(ctx: SessionContext): AnnouncementReader {
  const batchIds = new Set(ctx.access.selection === 'trade_picker' ? ctx.user.batchIds : ctx.access.batchIds);
  const tradeIds = new Set<string>([
    ...ctx.data.batches.filter((b) => batchIds.has(b.id)).map((b) => b.tradeId),
    ...(ctx.user.primaryTradeId ? [ctx.user.primaryTradeId] : []),
    ...ctx.user.secondaryTradeIds,
  ]);
  return { staffId: ctx.user.id, instituteId: ctx.institute.id, instituteWide: ctx.access.isInstituteWide, tradeIds, batchIds };
}

export class AnnouncementService {
  constructor(private readonly repo: AnnouncementRepository) {}

  /** Notices showing today for this user, in banner order (most important first). */
  async forUser(ctx: SessionContext): Promise<Announcement[]> {
    if (!ctx.journey.announcements.enabled) return [];
    const today = toLocalDate(ctx.clock.now());
    const reader = readerFor(ctx);
    const all = await this.repo.listForInstitute(ctx.institute.id);
    return all.filter((a) => isShowing(a, today) && isForReader(a, reader)).sort(compareAnnouncements);
  }
}
