'use client';
import { useEffect, useRef } from 'react';
import { Latin } from '@/components/ui/Latin';
import { List, ListRow } from '@/components/ui/ListRow';
import { useI18n } from '@/hooks/i18n';
import { useSession } from '@/hooks/session';
import { routes } from '@/lib/routes';
import type { SessionCard } from '@/services/attendance';
import { batchTitle, batchWithTrade } from '../common/labels';
import { BatchDataRow } from '../offline/BatchDataRow';
import { SessionCardView, type CardViewer } from './cards/SessionCardView';
import styles from './SessionList.module.css';

interface SessionListProps {
  readonly cards: readonly SessionCard[];
  readonly viewer: CardViewer;
}

/**
 * Which card carries a downloaded batch's "Updated · Refresh data" strip: one per
 * batch, on its next session still to come (else its first), never repeated.
 */
function dataOwners(cards: readonly SessionCard[]): ReadonlySet<string> {
  const owners = new Set<string>();
  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.batch.id) || !card.pack) continue;
    seen.add(card.batch.id);
    const mine = cards.filter((c) => c.batch.id === card.batch.id);
    owners.add((mine.find((c) => c.status === 'open' || c.status === 'future') ?? mine[0]).key);
  }
  return owners;
}

/** The strip for a card, if it is this batch's owner and the user keeps batches offline (markers only); its button follows offline.manualRefresh. */
function useDataFooter(cards: readonly SessionCard[], viewer: CardViewer) {
  const { t } = useI18n();
  const ctx = useSession();
  const offline = ctx.journey.offline;
  const owners = offline.enabled && viewer === 'marker' ? dataOwners(cards) : new Set<string>();
  return function footerFor(card: SessionCard) {
    return card.pack && owners.has(card.key) ? <BatchDataRow batchId={card.batch.id} batchLabel={batchWithTrade(t, card.trade, card.batch)} pack={card.pack} canRefresh={offline.manualRefresh} /> : undefined;
  };
}

/** One card per batch; batches with several marks today (twice daily, periods, subjects) get a header + slot cards. */
export function SessionList({ cards, viewer }: SessionListProps) {
  const { t } = useI18n();
  const ctx = useSession();
  const twiceShape = ctx.config.marking.twiceShape;
  const subjectName = (id?: string) => (id ? ctx.data.subjects.find((s) => s.id === id)?.name : undefined);
  const footer = useDataFooter(cards, viewer);

  const byBatch = new Map<string, SessionCard[]>();
  for (const card of cards) byBatch.set(card.batch.id, [...(byBatch.get(card.batch.id) ?? []), card]);

  return (
    <div className={styles.board}>
      <div className={styles.list}>
        {[...byBatch.values()].map((group) => {
          const first = group[0];
          if (group.length === 1 && first.scheduled.slot.kind === 'daily')
            return <SessionCardView key={first.key} card={first} variant="batch" viewer={viewer} twiceShape={twiceShape} subjectName={viewer === 'monitor' ? subjectName(first.address.subjectId) : undefined} footer={footer(first)} />;
          return (
            <section key={first.batch.id} className={styles.group} aria-label={batchTitle(t, first.batch)}>
              <div className={styles.groupHead}>
                <h3 className={styles.groupTitle}>{batchTitle(t, first.batch)}</h3>
                <span className={styles.groupMeta}>{t('common.students', { count: first.studentCount })}</span>
              </div>
              {group.map((card) => (
                <SessionCardView key={card.key} card={card} variant="slot" viewer={viewer} twiceShape={twiceShape} subjectName={subjectName(card.address.subjectId)} footer={footer(card)} />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Timetable view: today's periods in time order (prototype). On first load the
 * period happening now is brought into view if it starts below the fold, so the
 * one thing to do is visible without scrolling past closed periods.
 */
export function PeriodList({ cards }: { readonly cards: readonly SessionCard[] }) {
  const ctx = useSession();
  const footer = useDataFooter(cards, 'marker');
  const list = useRef<HTMLDivElement>(null);
  const shown = useRef(false);
  const now = cards.findIndex((c) => c.status === 'open' && Boolean(c.scheduled.window));
  useEffect(() => {
    if (shown.current || now < 0) return;
    shown.current = true;
    const el = list.current?.children[now];
    const scroller = el?.closest('main');
    // Instant, not smooth: nothing to tone down for reduced motion.
    if (el && scroller && el.getBoundingClientRect().bottom > scroller.getBoundingClientRect().bottom) el.scrollIntoView({ block: 'nearest' });
  }, [now]);
  return (
    <div className={styles.board}>
      <div ref={list} className={styles.list}>
        {cards.map((card) => (
          <SessionCardView key={card.key} card={card} variant="period" viewer="marker" twiceShape={ctx.config.marking.twiceShape} footer={footer(card)} />
        ))}
      </div>
    </div>
  );
}

export interface TradeRowData {
  readonly id: string;
  readonly name: string;
  readonly meta: string;
}

export function TradeRows({ trades, label }: { readonly trades: readonly TradeRowData[]; readonly label: string }) {
  return (
    <List label={label} grid>
      {trades.map((trade) => (
        <ListRow key={trade.id} href={routes.trade(trade.id)} title={<Latin>{trade.name}</Latin>} subtitle={trade.meta} trailing="chevron" minHeight={64} />
      ))}
    </List>
  );
}
