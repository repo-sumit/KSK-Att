'use client';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/icons/Icon';
import { localized, type Announcement } from '@/domain/announcement';
import { useI18n } from '@/hooks/i18n';
import { useSession } from '@/hooks/session';
import { addDays, toLocalDate } from '@/lib/time';
import { batchWithTrade } from '../common/labels';
import { CATEGORY_STYLE } from './categories';
import styles from './Announcements.module.css';

/** The event dates ("Tue, 29 Sep" or "30 Sep – 5 Oct") and when/who posted it, for one notice. */
export function useAnnouncementText() {
  const { t, format, language } = useI18n();
  const ctx = useSession();
  const today = toLocalDate(ctx.clock.now());
  return {
    title: (a: Announcement) => localized(a.title, language),
    body: (a: Announcement) => localized(a.body, language),
    dates: (a: Announcement) => {
      if (!a.eventFrom) return null;
      const to = a.eventTo ?? a.eventFrom;
      if (to === a.eventFrom) return a.eventFrom === today ? t('common.today') : format.shortDate(a.eventFrom);
      return t('announce.dates', { from: format.dayMonth(a.eventFrom), to: format.dayMonth(to) });
    },
    posted: (a: Announcement) => {
      const day = toLocalDate(new Date(a.publishedAt));
      const when = day === today ? t('common.today') : day === addDays(today, -1) ? t('common.yesterday') : format.dayMonth(day);
      return t('announce.posted', { source: t(`announce.source.${a.source}`), when });
    },
    audience: (a: Announcement) => {
      switch (a.audience.kind) {
        case 'institute':
          return t('announce.audienceInstitute');
        case 'trade': {
          const names = a.audience.tradeIds.map((id) => ctx.data.trades.find((x) => x.id === id)?.name ?? id);
          return t('announce.audienceTrade', { trade: names.join(', ') });
        }
        case 'batch': {
          const names = a.audience.batchIds.map((id) => {
            const batch = ctx.data.batches.find((b) => b.id === id);
            const trade = batch && ctx.data.trades.find((x) => x.id === batch.tradeId);
            return batch && trade ? batchWithTrade(t, trade, batch) : id;
          });
          return t('announce.audienceBatch', { batch: names.join(', ') });
        }
        case 'staff':
          return a.audience.staffIds.includes(ctx.user.id) ? t('announce.audienceYou') : t('announce.audienceStaff');
      }
    },
  };
}

export function CategoryBadge({ announcement }: { readonly announcement: Announcement }) {
  const { t } = useI18n();
  const style = CATEGORY_STYLE[announcement.category];
  return (
    <Badge tone={style.tone} icon={style.icon} size="md">
      {t(`announce.category.${announcement.category}`)}
    </Badge>
  );
}

/** One notice in the list: category, title, the full text, its dates and who it is for. */
export function AnnouncementItem({ announcement }: { readonly announcement: Announcement }) {
  const text = useAnnouncementText();
  const dates = text.dates(announcement);
  return (
    <li className={styles.item}>
      <div className={styles.itemTop}>
        <CategoryBadge announcement={announcement} />
        <span className={styles.posted}>{text.posted(announcement)}</span>
      </div>
      <h3 className={styles.itemTitle}>{text.title(announcement)}</h3>
      <p className={styles.itemBody}>{text.body(announcement)}</p>
      <p className={styles.itemMeta}>
        {dates && (
          <span className={styles.metaPart}>
            <Icon name="calendar" size={16} />
            {dates}
          </span>
        )}
        <span className={styles.metaPart}>
          <Icon name="users" size={16} />
          {/* A translated phrase around a trade or batch name: not Latin master data, so no lang="en". */}
          {text.audience(announcement)}
        </span>
      </p>
    </li>
  );
}
