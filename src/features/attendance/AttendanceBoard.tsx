'use client';
import { useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Latin } from '@/components/ui/Latin';
import { Section } from '@/components/ui/Section';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { StatusLine } from '@/components/ui/StatusLine';
import { useI18n } from '@/hooks/i18n';
import { useSession } from '@/hooks/session';
import { toLocalDate } from '@/lib/time';
import { PeriodList, SessionList, TradeRows } from './SessionList';
import { useBoard } from './useBoard';
import styles from './AttendanceBoard.module.css';

/** The instructor/principal "which class?" block; the same component serves Home and the Attendance tab. */
export function AttendanceBoard({ showGroupTitles = true }: { readonly showGroupTitles?: boolean }) {
  const { t, format } = useI18n();
  const ctx = useSession();
  const toast = useToast();
  const board = useBoard();
  const [tradeId, setTradeId] = useState<string | null>(null);

  if (!board.data) return <Skeleton label={t('common.loading')} />;
  const data = board.data;

  switch (data.kind) {
    case 'trades':
      return (
        <TradeRows
          label={t('selection.trades')}
          trades={data.trades.map((tr) => {
            const p = tr.progress;
            if (!p) return { id: tr.id, name: tr.name, meta: t('selection.tradeBatches', { count: tr.batches }) };
            const today = toLocalDate(ctx.clock.now());
            const opens = p.nextOpen ? format.clockTime(today, p.nextOpen) : null;
            const missing = p.total - p.done - p.later;
            // The same denominator as Home's "4 of 17" (every trade session today), then the one thing to know next.
            return {
              id: tr.id,
              name: tr.name,
              meta: t('selection.tradeSubmitted', { ...p, count: p.total }),
              state:
                p.total > 0 && p.done === p.total ? (
                  <StatusLine tone="success" icon="circle-check" nowrap>
                    {t('principal.tradeAllSubmitted')}
                  </StatusLine>
                ) : missing > 0 ? (
                  <StatusLine tone="warning" icon="alert" nowrap>
                    {t('principal.tradeNotSubmitted', { count: missing })}
                  </StatusLine>
                ) : opens ? (
                  <StatusLine tone="neutral" icon="clock" nowrap>
                    {t('selection.opensAt', { time: opens })}
                  </StatusLine>
                ) : undefined,
            };
          })}
        />
      );
    case 'periods':
      return <PeriodList cards={data.cards} />;
    case 'switcher': {
      const active = data.groups.find((g) => g.trade.id === tradeId) ?? data.groups[0];
      if (!active) return null;
      return (
        <>
          <Segmented
            label={t('selection.trades')}
            fullWidth
            value={active.trade.id}
            onChange={setTradeId}
            options={data.groups.map((g) => ({ value: g.trade.id, label: g.trade.name, lang: 'en' }))}
          />
          <SessionList cards={active.cards} viewer="marker" />
        </>
      );
    }
    case 'groups':
      if (!data.groups.length)
        return (
          <EmptyState
            icon="users"
            title={t('selection.emptyTitle')}
            body={t('selection.emptyBody')}
            action={
              <Button variant="secondary" size="md" onClick={() => toast.show(t('selection.noNewBatches'))}>
                {t('common.refresh')}
              </Button>
            }
          />
        );
      if (data.groups.length === 1 && !showGroupTitles) return <SessionList cards={data.groups[0].cards} viewer="marker" />;
      // One grid for every trade: a trade with a single batch takes one column, a bigger one the full width,
      // so batches across several trades (Employability Skills) don't all stack in the left column.
      return (
        <div className={styles.groups}>
          <div className={styles.groupGrid}>
            {data.groups.map((group) => (
              <Section key={group.trade.id} variant="label" title={<Latin>{group.trade.name}</Latin>} className={group.cards.length > 1 ? styles.span : undefined}>
                <SessionList cards={group.cards} viewer="marker" />
              </Section>
            ))}
          </div>
        </div>
      );
  }
}
