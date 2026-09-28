/**
 * Announcements (extension, D-054): short notices from the state office, the
 * institute office or the principal, shown on Home. They are information only:
 * they never change what can be marked. An OJT notice does not mark anyone
 * OJT; that status comes from the ERP declaration (PRD §9.6).
 */
import type { Language } from '@/config/types';
import type { BatchId, InstituteId, StaffId, TradeId } from './entities';
import { compareDates, type LocalDate } from '@/lib/time';

export type AnnouncementCategory = 'info' | 'important' | 'holiday' | 'ojt';
export type AnnouncementSource = 'state' | 'institute' | 'principal';

/** Who a notice is for. Institute-wide notices reach everyone at the institute. */
export type AnnouncementAudience =
  | { readonly kind: 'institute' }
  | { readonly kind: 'trade'; readonly tradeIds: readonly TradeId[] }
  | { readonly kind: 'batch'; readonly batchIds: readonly BatchId[] }
  | { readonly kind: 'staff'; readonly staffIds: readonly StaffId[] };

/** Text as the server sends it, per language; English is always present and is the fallback. */
export type LocalizedText = { readonly en: string } & Partial<Record<Exclude<Language, 'en'>, string>>;

export interface Announcement {
  readonly id: string;
  readonly instituteId: InstituteId;
  readonly category: AnnouncementCategory;
  /** High-priority notices lead the Home banner. */
  readonly priority: 'high' | 'normal';
  readonly source: AnnouncementSource;
  readonly audience: AnnouncementAudience;
  readonly title: LocalizedText;
  readonly body: LocalizedText;
  readonly publishedAt: string;
  /** Shown on Home from this day to this day, inclusive. */
  readonly showFrom: LocalDate;
  readonly showUntil: LocalDate;
  /** The day(s) the notice is about (a holiday, an OJT period), when it has any. */
  readonly eventFrom?: LocalDate;
  readonly eventTo?: LocalDate;
}

/** What a user's reach looks like to the targeting rule. */
export interface AnnouncementReader {
  readonly staffId: StaffId;
  readonly instituteId: InstituteId;
  /** The principal reads everything posted for the institute. */
  readonly instituteWide: boolean;
  readonly tradeIds: ReadonlySet<TradeId>;
  readonly batchIds: ReadonlySet<BatchId>;
}

export function isForReader(a: Announcement, reader: AnnouncementReader): boolean {
  if (a.instituteId !== reader.instituteId) return false;
  if (reader.instituteWide) return true;
  switch (a.audience.kind) {
    case 'institute':
      return true;
    case 'trade':
      return a.audience.tradeIds.some((id) => reader.tradeIds.has(id));
    case 'batch':
      return a.audience.batchIds.some((id) => reader.batchIds.has(id));
    case 'staff':
      return a.audience.staffIds.includes(reader.staffId);
  }
}

export const isShowing = (a: Announcement, today: LocalDate) => compareDates(a.showFrom, today) <= 0 && compareDates(today, a.showUntil) <= 0;

const CATEGORY_RANK: Readonly<Record<AnnouncementCategory, number>> = { important: 0, holiday: 1, ojt: 2, info: 3 };

/** Banner order: high priority first, then the more consequential category, then the newest. */
export function compareAnnouncements(a: Announcement, b: Announcement): number {
  if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
  if (a.category !== b.category) return CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
  return b.publishedAt.localeCompare(a.publishedAt);
}

export const localized = (text: LocalizedText, language: Language) => (language === 'en' ? text.en : (text[language] ?? text.en));
