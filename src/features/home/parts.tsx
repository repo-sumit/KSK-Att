'use client';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card, PressableCard } from '@/components/ui/Card';
import { Icon } from '@/components/ui/icons/Icon';
import { IconTile } from '@/components/ui/IconWell';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { useSyncStatus } from '@/hooks/useSync';
import { routes } from '@/lib/routes';
import { BatchLabel } from '../common/BatchLabel';
import { firstName, greetingKey, markLabel } from '../common/labels';
import styles from './Home.module.css';

export function Greeting({ subtitle, name }: { readonly subtitle: string; readonly name?: string }) {
  const { t } = useI18n();
  const ctx = useSession();
  return (
    <div className={styles.greeting}>
      <h2 className={styles.hello}>{t(greetingKey(ctx.clock.now()), { name: name ?? firstName(ctx.user) })}</h2>
      <p className={styles.sub}>{subtitle}</p>
    </div>
  );
}

export function PendingSyncCard() {
  const { t } = useI18n();
  const { sync } = useServices();
  const status = useSyncStatus();
  if (!status.pending || status.phase === 'syncing' || status.phase === 'synced') return null;
  return (
    <Banner tone="warning" icon="cloud-upload" strong action={status.online ? { label: t('common.syncNow'), onPress: () => void sync.syncNow() } : undefined}>
      {t('home.pendingSync', { count: status.pending })}
    </Banner>
  );
}

export function MyAttendanceCard() {
  const { t, format } = useI18n();
  const ctx = useSession();
  const { staffAttendance } = useServices();
  const { data: record, loading } = useQuery(`my-staff:${ctx.user.id}`, () => staffAttendance.myRecord(ctx), ['staff']);
  // Hold the card's space while loading so the page doesn't jump when it arrives.
  if (loading && !record) return <Skeleton count={1} height={120} label={t('common.loading')} />;
  const marked = Boolean(record);
  const bySelf = record?.source === 'self';
  const sub = !record
    ? t('home.notMarked')
    : bySelf
      ? t('home.markedToday', { time: format.time(record.deviceTimestamp) })
      : t('home.markedByPrincipal', { status: markLabel(t, { status: record.status }).toLowerCase() });
  return (
    <Card>
      <div className={styles.cardRow}>
        <IconTile icon="user-check" tint="green" />
        <div className={styles.cardText}>
          <p className={styles.cardTitle}>{t('home.myAttendance')}</p>
          <p className={marked ? (bySelf ? styles.subSuccess : styles.cardSub) : styles.subWarning}>{sub}</p>
        </div>
        {record?.status === 'present' && (
          <Badge tone="success" icon="check">
            {t('status.present')}
          </Badge>
        )}
      </div>
      {!marked && ctx.journey.staff.selfCanMark && (
        <Button variant="secondary" size="md" fullWidth href={routes.selfAttendance}>
          {t('home.markAttendance')}
        </Button>
      )}
    </Card>
  );
}

export function TradeOverviewCard() {
  const { t } = useI18n();
  const ctx = useSession();
  const { attendance } = useServices();
  const tradeId = ctx.access.tradeWideViewTradeId;
  const { data } = useQuery(`trade-overview:${tradeId}`, async () => (tradeId ? attendance.boardForTrade(ctx, tradeId) : []), ['attendance']);
  const trade = ctx.data.trades.find((x) => x.id === tradeId);
  if (!trade || !data) return null;
  const cards = data.filter((c) => !c.address.subjectId);
  const done = cards.filter((c) => c.status === 'submitted').length;
  return (
    <PressableCard href={routes.trade(trade.id)}>
      <div className={styles.cardRow}>
        <IconTile icon="users" tint="blue" />
        <div className={styles.cardText}>
          <p className={styles.cardTitle}>{t('home.tradeOverview', { trade: trade.name })}</p>
          <p className={styles.cardSub}>{t('selection.tradeSubmitted', { done, total: cards.length, count: cards.length })}</p>
        </div>
        <Icon name="chevron-right" size={20} className={styles.chevron} />
      </div>
      <ProgressBar value={cards.length ? done / cards.length : 0} label={t('selection.tradeSubmitted', { done, total: cards.length, count: cards.length })} />
    </PressableCard>
  );
}

export function SubmittedToday() {
  const { t, format } = useI18n();
  const ctx = useSession();
  const { attendance } = useServices();
  const { data, loading } = useQuery(`submitted-today:${ctx.user.id}`, () => attendance.submittedTodayBy(ctx, ctx.user.id), ['attendance', 'offline']);
  return (
    <section className={styles.recent} aria-labelledby="recent-title">
      <h2 id="recent-title" className={styles.recentTitle}>
        {t('home.submittedToday')}
      </h2>
      {!data && loading ? (
        <Skeleton count={1} height={64} label={t('common.loading')} />
      ) : !data?.length ? (
        <p className={styles.empty}>{t('home.nothingYet')}</p>
      ) : (
        <ul className={styles.recentList}>
          {data.map((card) => {
            const s = card.submission;
            const summary = s ? t('result.summary', { present: s.counts.present, absent: s.counts.absent }) : '';
            return (
              <li key={card.key}>
                <Link href={routes.record(card.key)} className={styles.recentRow}>
                  <Icon name={s?.pendingSync ? 'cloud-upload' : 'circle-check'} size={20} className={s?.pendingSync ? styles.iconWarning : styles.iconSuccess} />
                  <span className={styles.cardText}>
                    <span className={styles.recentName}>
                      <BatchLabel trade={card.trade} batch={card.batch} />
                    </span>
                    <span className={styles.cardSub}>
                      <span className={styles.phrase}>{s?.pendingSync ? t('selection.waitingToSync') : t('home.submittedAt', { time: format.time(s?.at ?? '') })}</span>
                      {' · '}
                      <span className={styles.phrase}>{summary}</span>
                    </span>
                  </span>
                  <Icon name="chevron-right" size={20} className={styles.chevron} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
