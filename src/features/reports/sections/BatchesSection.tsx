'use client';
import { useRef, useState } from 'react';
import { Disclosure } from '@/components/ui/Disclosure';
import { EmptyState } from '@/components/ui/EmptyState';
import { Latin } from '@/components/ui/Latin';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useJourney, useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import type { BatchOverview } from '@/services/reports';
import { batchTitle } from '../../common/labels';
import { TradeGroups } from '../../common/TradeGroups';
import { Leaderboard } from './Leaderboard';
import { PctBadge } from './PctBadge';
import styles from '../Reports.module.css';

const TOPICS = ['attendance', 'corrections'] as const;

/**
 * "My batches" / every batch (brief §7): the average over the report window,
 * grouped under the trade as on Home; a tap opens the batch's students.
 */
export function BatchesSection({ title }: { readonly title: string }) {
  const { t } = useI18n();
  const ctx = useSession();
  const j = useJourney();
  const { reports } = useServices();
  const { data } = useQuery(`report-batches:${ctx.user.id}`, () => reports.batchOverview(ctx), TOPICS);

  return (
    <Section id="batches" title={title} subtitle={t('reports.batchesSub', { days: j.reports.windowDays })}>
      {!data ? (
        <Skeleton variant="rows" leading="none" count={2} label={t('common.loading')} />
      ) : !data.batches.length ? (
        <EmptyState icon="users" title={t('reports.noStudentData')} />
      ) : (
        <TradeGroups trades={ctx.data.trades} items={data.batches} tradeId={(b) => b.trade.id} idPrefix="batches">
          {(item) => <BatchRow key={item.batch.id} item={item} threshold={data.threshold} />}
        </TradeGroups>
      )}
    </Section>
  );
}

function BatchRow({ item, threshold }: { readonly item: BatchOverview; readonly threshold: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const hide = () => {
    setOpen(false);
    // Back to the row that was opened, not wherever the long list ended; focus goes with it
    // (the Hide button it was on is gone), so a keyboard or screen reader user lands on the batch.
    row.current?.querySelector('button')?.focus({ preventScroll: true });
    row.current?.scrollIntoView({ block: 'nearest' });
  };
  return (
    <div ref={row}>
      <Disclosure
        open={open}
        onOpenChange={setOpen}
        summary={
          <>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>
                {/* Shown under its trade; the trade is still part of the name a screen reader hears. */}
                <span className="visually-hidden">
                  <Latin>{item.trade.name}</Latin>
                  {' · '}
                </span>
                {batchTitle(t, item.batch)}
              </span>
              <span className={styles.rowSub}>{t('common.students', { count: item.students })}</span>
            </span>
            <PctBadge pct={item.pct} low={item.low} threshold={threshold} />
          </>
        }
      >
        <Leaderboard batchId={item.batch.id} expected={item.students} onHide={hide} />
      </Disclosure>
    </div>
  );
}
