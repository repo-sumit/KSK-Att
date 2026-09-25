'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/icons/Icon';
import { Latin } from '@/components/ui/Latin';
import { Section } from '@/components/ui/Section';
import { useToast } from '@/components/ui/Toast';
import { InnerHeader } from '@/components/shell/Headers';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
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
  const have = new Set((held ?? []).map((r) => r.batch.id));
  const batches = packs.downloadable(ctx);
  const multi = ctx.journey.offline.multiSelect;
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
    const result = await packs.download(ctx, [...chosen]);
    toast.show(result.ok ? t('offline.downloadedToast', { count: result.value }) : result.error === 'offline' ? t('offline.connectFirst') : t('offline.maxReached', { max: max ?? 0 }));
    if (result.ok) router.replace(routes.offline);
  };

  return (
    <ScreenLayout
      header={<InnerHeader title={t('offline.downloadTitle')} backHref={routes.offline} />}
      footer={chosen.size > 0 ? <Button fullWidth leadingIcon="download" onClick={() => void download()}>{t('offline.downloadCta', { count: chosen.size })}</Button> : undefined}
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
