/** Mock announcements: generated for "today" (like master data) and cached per day; read-only. */
import type { Announcement } from '@/domain/announcement';
import type { InstituteId } from '@/domain/entities';
import { buildAnnouncements } from '@/data/mock/announcements';
import type { LocalDate } from '@/lib/time';
import type { AnnouncementRepository } from '../interfaces';
import type { MockDatabase } from './database';

export class MockAnnouncementRepository implements AnnouncementRepository {
  private cache: { date: LocalDate; items: readonly Announcement[] } | undefined;

  constructor(private readonly db: MockDatabase) {}

  async listForInstitute(instituteId: InstituteId) {
    const today = this.db.today();
    if (!this.cache || this.cache.date !== today) this.cache = { date: today, items: buildAnnouncements(today) };
    return this.cache.items.filter((a) => a.instituteId === instituteId);
  }
}
