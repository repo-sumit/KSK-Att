'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/icons/Icon';
import { Latin } from '@/components/ui/Latin';
import { Section } from '@/components/ui/Section';
import { useToast } from '@/components/ui/Toast';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { AppHeader } from '@/features/shell/AppHeader';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { cx } from '@/lib/cx';
import { routes } from '@/lib/routes';
import { batchTitle } from '../common/labels';
import styles from './Download.module.css';

/** Choose batches to keep on the phone; only batches the user can mark online are offered (PRD §20.2). */
export function DownloadScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const ctx = useSession();
  const { packs } = useServices();
  const { data: held } = useQuery(`packs:${ctx.user.id}`, () => packs.list(ctx), ['packs']);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const have = new Set((held ?? []).map((r) => r.batch.id));
  const batches = packs.downloadable(ctx);
  const multi = ctx.journey.offline.multiSelect;
  const enabled = ctx.journey.offline.enabled;
  const fallback = ctx.journey.navTabs.includes('reports') ? routes.reports : routes.home;
  useEffect(() => {
    if (!enabled) router.replace(fallback);
  }, [enabled, fallback, router]);
  const max = ctx.journey.offline.maxBatches;

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(multi ? prev : []);
      if (prev.has(id)) next.delete(id);
      else if (max === null || have.size + next.size < max) next.add(id);
      else toast.show(t('offline.maxReached', { max }));
      return next;
    });

  const download = async () => {
    if (busy) return;
    setBusy(true);
    const result = await packs.download(ctx, [...chosen]);
    setBusy(false);
    toast.show(result.ok ? t('offline.downloadedToast', { count: result.value }) : result.error === 'offline' ? t('offline.connectFirst') : t('offline.maxReached', { max: max ?? 0 }));
    if (result.ok) router.replace(routes.offline);
  };

  if (!enabled) return null;
  return (
    <ScreenLayout
      width="reading"
      area="reports"
      header={<AppHeader back="back" title={t('offline.downloadTitle')} backHref={routes.offline} />}
      footer={
        chosen.size > 0 ? (
          <Button fullWidth leadingIcon="download" loading={busy} onClick={() => void download()}>
            {busy ? t('offline.downloading') : t('offline.downloadCta', { count: chosen.size })}
          </Button>
        ) : undefined
      }
    >
      {ctx.access.tradeIds.map((tradeId) => {
        const trade = ctx.data.trades.find((x) => x.id === tradeId);
        const list = batches.filter((b) => b.tradeId === tradeId);
        if (!trade || !list.length) return null;
        return (
          <Section key={tradeId} id={`dl-${tradeId}`} variant="label" title={<Latin>{trade.name}</Latin>}>
            <ul className={styles.list}>
              {list.map((batch) => {
                const done = have.has(batch.id);
                const on = chosen.has(batch.id);
                return (
                  <li key={batch.id}>
                    <button type="button" role="checkbox" aria-checked={done || on} aria-disabled={done || undefined} className={cx(styles.row, on && styles.on)} onClick={() => !done && toggle(batch.id)}>
                      <span className={cx(styles.box, (on || done) && styles.boxOn)} aria-hidden="true">
                        {(on || done) && <Icon name="check" size={16} strokeWidth={3} />}
                      </span>
                      <span className={styles.label}>{batchTitle(t, batch)}</span>
                      {done && <Badge tone="success">{t('offline.alreadyDownloaded')}</Badge>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Section>
        );
      })}
    </ScreenLayout>
  );
}
