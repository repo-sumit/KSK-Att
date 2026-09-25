'use client';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/icons/Icon';
import { Latin } from '@/components/ui/Latin';
import { List, ListRow } from '@/components/ui/ListRow';
import { Section } from '@/components/ui/Section';
import { useToast } from '@/components/ui/Toast';
import { InnerHeader } from '@/components/shell/Headers';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { parseSessionKey } from '@/domain/attendance';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { useSyncStatus } from '@/hooks/useSync';
import { routes } from '@/lib/routes';
import { toLocalDate } from '@/lib/time';
import { batchWithTrade } from '../common/labels';
import styles from './Profile.module.css';

/** PRD §20: what is on this phone, what is waiting to sync, and refresh / download. */
export function OfflineScreen() {
  const { t, format } = useI18n();
  const toast = useToast();
  const ctx = useSession();
  const { packs, sync } = useServices();
  const status = useSyncStatus();
  const j = ctx.journey.offline;
  const { data: rows } = useQuery(`packs:${ctx.user.id}`, () => packs.list(ctx), ['packs']);
  const { data: pending } = useQuery(`pending:${ctx.user.id}`, () => sync.pendingItems(), ['offline']);
  const today = toLocalDate(ctx.clock.now());

  const when = (iso: string) => (toLocalDate(new Date(iso)) === today ? t('offline.todayAt', { time: format.time(iso) }) : `${format.dayMonth(toLocalDate(new Date(iso)))}, ${format.time(iso)}`);
  const latest = rows?.map((r) => r.pack.downloadedAt).sort().at(-1);
  const pendingLabel = (label: string, kind: string) => {
    if (kind === 'staff_attendance') return t('offline.selfRecord');
    const address = parseSessionKey(label);
    const batch = ctx.data.batches.find((b) => b.id === address?.batchId);
    const trade = batch && ctx.data.trades.find((x) => x.id === batch.tradeId);
    return batch && trade ? batchWithTrade(t, trade, batch) : label;
  };

  const refresh = async () => {
    const result = await packs.refreshAll(ctx);
    toast.show(result.ok ? t('offline.refreshed') : t('offline.connectFirst'));
  };

  return (
    <ScreenLayout header={<InnerHeader title={t('offline.title')} backHref={routes.profile} />}>
      <Banner
        tone={status.pending ? 'warning' : 'success'}
        icon={status.pending ? 'cloud-upload' : 'circle-check'}
        strong
        action={status.pending && status.online ? { label: t('common.syncNow'), onPress: () => void sync.syncNow() } : undefined}
      >
        {status.pending ? t('offline.pending', { count: status.pending }) : t('offline.allSynced')}
        {latest && <span className={styles.inst}> · {t('offline.lastRefreshed', { when: when(latest) })}</span>}
      </Banner>
      {pending && pending.length > 0 && (
        <Section id="pending" variant="label" title={t('offline.pendingList')}>
          <List>
            {pending.map((item) => (
              <ListRow
                key={item.id}
                leading={<Icon name="cloud-upload" size={20} className={styles.warn} />}
                title={<Latin>{pendingLabel(item.label, item.kind)}</Latin>}
                subtitle={when(item.enqueuedAt)}
                minHeight={56}
              />
            ))}
          </List>
        </Section>
      )}
      <Section id="packs" variant="label" title={t('offline.downloaded')}>
        {rows && rows.length === 0 ? (
          <EmptyState icon="hard-drive" title={t('offline.noPacks')} />
        ) : (
          <List>
            {(rows ?? []).map((row) => (
              <ListRow
                key={row.batch.id}
                title={<Latin>{batchWithTrade(t, row.trade, row.batch)}</Latin>}
                subtitle={<span className={row.stale ? styles.warn : undefined}>{row.stale ? t('offline.stale', { date: format.dayMonth(toLocalDate(new Date(row.pack.downloadedAt))) }) : t('offline.fresh', { when: when(row.pack.downloadedAt) })}</span>}
                trailing={<Icon name={row.stale ? 'alert' : 'circle-check'} size={18} className={row.stale ? styles.warn : styles.ok} />}
              />
            ))}
          </List>
        )}
      </Section>
      <p className={styles.inst}>{t('offline.eodNote', { time: format.clockTime(today, ctx.config.offline.eodTriggerTime) })}</p>
      <div className={styles.actions}>
        {j.manualRefresh && (
          <Button variant="secondary" fullWidth leadingIcon="refresh" onClick={() => void refresh()}>
            {t('offline.refresh')}
          </Button>
        )}
        <Button variant="ghost" fullWidth href={routes.offlineDownload}>
          {t('offline.downloadMore')}
        </Button>
      </div>
    </ScreenLayout>
  );
}
