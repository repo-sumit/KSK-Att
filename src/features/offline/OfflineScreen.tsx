'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/icons/Icon';
import { List, ListRow } from '@/components/ui/ListRow';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { AppHeader } from '@/features/shell/AppHeader';
import { parseSessionKey } from '@/domain/attendance';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { useSyncStatus } from '@/hooks/useSync';
import { routes } from '@/lib/routes';
import { toLocalDate } from '@/lib/time';
import { BatchLabel } from '../common/BatchLabel';
import { OfflineBatchRow } from './OfflineBatchRow';
import { JUST_NOW_MS, type RefreshState } from './useBatchRefresh';
import styles from './Offline.module.css';

/**
 * Offline data = "what is on this phone, and is it synced?" (PRD §20, D-056):
 * each downloaded batch with its own refresh, what is waiting to sync, refresh
 * everything, and download more. Reached from Reports.
 */
export function OfflineScreen() {
  const { t, format } = useI18n();
  const toast = useToast();
  const ctx = useSession();
  const { packs, sync } = useServices();
  const status = useSyncStatus();
  const router = useRouter();
  const j = ctx.journey.offline;
  // No offline data for this user (e.g. the principal): an old link goes to Reports or Home.
  const fallback = ctx.journey.navTabs.includes('reports') ? routes.reports : routes.home;
  useEffect(() => {
    if (!j.enabled) router.replace(fallback);
  }, [j.enabled, fallback, router]);
  const { data: rows } = useQuery(`packs:${ctx.user.id}`, () => (j.enabled ? packs.list(ctx) : Promise.resolve([])), ['packs', 'offline']);
  const { data: pending } = useQuery(`pending:${ctx.user.id}`, () => sync.pendingItems(), ['offline']);
  const [all, setAll] = useState<RefreshState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const today = toLocalDate(ctx.clock.now());

  const when = (iso: string) => (toLocalDate(new Date(iso)) === today ? t('offline.todayAt', { time: format.time(iso) }) : `${format.dayMonth(toLocalDate(new Date(iso)))}, ${format.time(iso)}`);
  const pendingLabel = (label: string, kind: string) => {
    if (kind === 'staff_attendance') return t('offline.selfRecord');
    const address = parseSessionKey(label);
    const batch = ctx.data.batches.find((b) => b.id === address?.batchId);
    const trade = batch && ctx.data.trades.find((x) => x.id === batch.tradeId);
    return batch && trade ? <BatchLabel trade={trade} batch={batch} /> : label;
  };

  const refreshAll = async () => {
    if (all === 'refreshing') return;
    clearTimeout(timer.current);
    setAll('refreshing');
    const result = await packs.refreshAll(ctx);
    setAll(result.ok ? 'done' : 'idle');
    if (result.ok) timer.current = setTimeout(() => setAll('idle'), JUST_NOW_MS);
    toast.show(result.ok ? t('offline.refreshed') : t('offline.connectFirst'));
  };
  const syncing = status.phase === 'syncing';
  const stale = all === 'idle' ? (rows?.filter((r) => r.stale).length ?? 0) : 0;
  // What needs the instructor comes first: waiting to sync, then refresh needed, then the rest in order.
  const rank = (r: NonNullable<typeof rows>[number]) => (r.pendingSync ? 0 : r.stale ? 1 : 2);
  const ordered = rows ? [...rows].sort((a, b) => rank(a) - rank(b)) : undefined;
  if (!j.enabled) return null;

  return (
    <ScreenLayout width="reading" area="reports" header={<AppHeader back="back" title={t('offline.title')} backHref={routes.reports} />}>
      <Banner
        tone={status.pending ? 'warning' : 'success'}
        icon={status.pending ? 'cloud-upload' : 'circle-check'}
        spinner={syncing}
        strong
        live
        action={status.pending && status.online && !syncing ? { label: t('common.syncNow'), onPress: () => void sync.syncNow() } : undefined}
      >
        {/* Sync state only: each batch below says when it was last updated (one can be refreshed on its own). */}
        {syncing ? t('sync.syncingNow') : status.pending ? t('offline.pending', { count: status.pending }) : t('offline.allSynced')}
      </Banner>
      {stale > 0 && (
        <Banner tone="warning" icon="alert" strong action={j.manualRefresh && status.online ? { label: t('common.refresh'), onPress: () => void refreshAll() } : undefined}>
          {t('offline.needsRefresh', { count: stale })}
        </Banner>
      )}
      {pending && pending.length > 0 && (
        <Section id="pending" variant="label" title={t('offline.pendingList')}>
          <List>
            {pending.map((item) => (
              <ListRow
                key={item.id}
                leading={<Icon name="cloud-upload" size={20} className={styles.warn} />}
                title={pendingLabel(item.label, item.kind)}
                subtitle={when(item.enqueuedAt)}
                minHeight={56}
              />
            ))}
          </List>
        </Section>
      )}
      <Section id="packs" variant="label" title={t('offline.downloaded')}>
        {!ordered ? (
          <Skeleton variant="rows" count={2} label={t('common.loading')} />
        ) : ordered.length === 0 ? (
          <EmptyState icon="hard-drive" title={t('offline.noPacks')} />
        ) : (
          <ul className={styles.packs}>
            {ordered.map((row) => (
              <OfflineBatchRow key={row.batch.id} row={row} all={all} canRefresh={j.manualRefresh} />
            ))}
          </ul>
        )}
      </Section>
      <p className={styles.inst}>{t('offline.eodNote', { time: format.clockTime(today, ctx.config.offline.eodTriggerTime) })}</p>
      <div className={styles.actions}>
        {j.manualRefresh && rows && rows.length > 0 && (
          <Button variant="secondary" fullWidth leadingIcon="refresh" loading={all === 'refreshing'} onClick={() => void refreshAll()}>
            {all === 'refreshing' ? t('offline.refreshingAll') : t('offline.refreshAll')}
          </Button>
        )}
        <Button variant="ghost" fullWidth leadingIcon="download" href={routes.offlineDownload}>
          {t('offline.downloadMore')}
        </Button>
      </div>
    </ScreenLayout>
  );
}
