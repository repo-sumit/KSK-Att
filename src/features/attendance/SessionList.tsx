'use client';
import { Latin } from '@/components/ui/Latin';
import { List, ListRow } from '@/components/ui/ListRow';
import { useI18n } from '@/hooks/i18n';
import { useSession } from '@/hooks/session';
import { routes } from '@/lib/routes';
import type { SessionCard } from '@/services/attendance';
import { batchTitle } from '../common/labels';
import { SessionCardView, type CardViewer } from './cards/SessionCardView';
import styles from './SessionList.module.css';

interface SessionListProps {
  readonly cards: readonly SessionCard[];
  readonly viewer: CardViewer;
}

/** One card per batch; batches with several marks today (twice daily, periods, subjects) get a header + slot cards. */
export function SessionList({ cards, viewer }: SessionListProps) {
  const { t } = useI18n();
  const ctx = useSession();
  const twiceShape = ctx.config.marking.twiceShape;
  const subjectName = (id?: string) => (id ? ctx.data.subjects.find((s) => s.id === id)?.name : undefined);

  const byBatch = new Map<string, SessionCard[]>();
  for (const card of cards) byBatch.set(card.batch.id, [...(byBatch.get(card.batch.id) ?? []), card]);

  return (
    <div className={styles.list}>
      {[...byBatch.values()].map((group) => {
        const first = group[0];
        if (group.length === 1 && first.scheduled.slot.kind === 'daily')
          return <SessionCardView key={first.key} card={first} variant="batch" viewer={viewer} twiceShape={twiceShape} subjectName={viewer === 'monitor' ? subjectName(first.address.subjectId) : undefined} />;
        return (
          <section key={first.batch.id} className={styles.group} aria-label={batchTitle(t, first.batch)}>
            <div className={styles.groupHead}>
              <h3 className={styles.groupTitle}>{batchTitle(t, first.batch)}</h3>
              <span className={styles.groupMeta}>{t('common.students', { count: first.studentCount })}</span>
            </div>
            {group.map((card) => (
              <SessionCardView key={card.key} card={card} variant="slot" viewer={viewer} twiceShape={twiceShape} subjectName={subjectName(card.address.subjectId)} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

/** Timetable view: today's periods in time order. */
export function PeriodList({ cards }: { readonly cards: readonly SessionCard[] }) {
  const ctx = useSession();
  return (
    <div className={styles.list}>
      {cards.map((card) => (
        <SessionCardView key={card.key} card={card} variant="period" viewer="marker" twiceShape={ctx.config.marking.twiceShape} />
      ))}
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
    <List label={label}>
      {trades.map((trade) => (
        <ListRow key={trade.id} href={routes.trade(trade.id)} title={<Latin>{trade.name}</Latin>} subtitle={trade.meta} trailing="chevron" minHeight={64} />
      ))}
    </List>
  );
}
