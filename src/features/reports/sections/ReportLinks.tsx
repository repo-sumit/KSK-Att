'use client';
import { IconTile } from '@/components/ui/IconWell';
import { List, ListRow } from '@/components/ui/ListRow';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusLine } from '@/components/ui/StatusLine';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useJourney, useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { useSyncStatus } from '@/hooks/useSync';
import { routes } from '@/lib/routes';
import { isDetailBlock } from '@/services/reports';
import { DETAIL_META } from '../reportRows';
import styles from '../Reports.module.css';

/** Offline data (brief §5, §9 C): what is on this phone and whether it is synced, one tap from the full screen. */
export function OfflineEntry() {
  const { t } = useI18n();
  const ctx = useSession();
  const { packs } = useServices();
  const status = useSyncStatus();
  const { data: rows } = useQuery(`packs:${ctx.user.id}`, () => packs.list(ctx), ['packs', 'offline']);
  const stale = rows?.filter((r) => r.stale).length ?? 0;
  // Anything that needs the instructor's attention is amber with its icon; all good is plain.
  const subtitle = (
    <span className={styles.rowSub}>
      {status.pending ? (
        <StatusLine tone="warning" icon="cloud-upload">
          {t('offline.pending', { count: status.pending })}
        </StatusLine>
      ) : (
        <span>{t('offline.allSynced')}</span>
      )}
      {stale > 0 && (
        <StatusLine tone="warning" icon="alert">
          {t('offline.needsRefresh', { count: stale })}
        </StatusLine>
      )}
    </span>
  );
  return (
    <Section id="offline" title={t('offline.title')}>
      {!rows ? (
        <Skeleton variant="rows" leading="tile" count={1} label={t('common.loading')} />
      ) : (
        <List>
          <ListRow
            href={routes.offline}
            leading={<IconTile icon="hard-drive" tint="blue" size={40} />}
            title={t('offline.onPhone', { count: rows.length })}
            subtitle={subtitle}
            trailing="chevron"
          />
        </List>
      )}
    </Section>
  );
}

/** Reports that keep their own screen with a date range and print (staff attendance, correction log). */
export function MoreReports() {
  const { t } = useI18n();
  const j = useJourney();
  const blocks = j.reports.enabled ? j.reports.blocks.filter(isDetailBlock) : [];
  if (!blocks.length) return null;
  const range = j.reports.dateRanges.includes('month') ? 'month' : j.reports.dateRanges[0];
  return (
    <Section id="more-reports" title={t('reports.moreReports')}>
      <List label={t('reports.moreReports')}>
        {blocks.map((block) => (
          <ListRow
            key={block}
            href={routes.report(block, range)}
            leading={<IconTile icon={DETAIL_META[block].icon} tint="blue" size={40} />}
            title={t(DETAIL_META[block].title)}
            subtitle={t(DETAIL_META[block].desc)}
            trailing="chevron"
          />
        ))}
      </List>
    </Section>
  );
}
