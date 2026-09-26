'use client';
import { useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/Skeleton';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { AppHeader } from '@/features/shell/AppHeader';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { routes } from '@/lib/routes';
import { toLocalDate } from '@/lib/time';
import { ProblemScreen } from '../feedback/ProblemScreen';
import { SessionList } from './SessionList';

/** Batches of one trade: pick a batch (open / trade mapping) or monitor it (principal, group instructor). */
export function TradeScreen() {
  const { t, format } = useI18n();
  const ctx = useSession();
  const { attendance } = useServices();
  const tradeId = useSearchParams().get('trade') ?? '';
  const trade = ctx.data.trades.find((x) => x.id === tradeId);
  const monitoring = ctx.journey.homeVariant === 'institute' || (ctx.access.tradeWideViewTradeId === tradeId && !ctx.access.tradeIds.includes(tradeId));
  const visible = trade && (ctx.access.tradeIds.includes(trade.id) || ctx.access.tradeWideViewTradeId === trade.id);
  const { data } = useQuery(`trade:${tradeId}`, () => (visible ? attendance.boardForTrade(ctx, tradeId) : Promise.resolve([])), ['attendance', 'offline', 'corrections']);

  if (!trade || !visible) return <ProblemScreen kind="notFound" />;
  const overview = ctx.access.tradeWideViewTradeId === tradeId;
  return (
    <ScreenLayout
      area="attendance"
      header={
        <AppHeader back="back"
          title={trade.name}
          subtitle={monitoring || overview ? t('common.todayDate', { date: format.longDate(toLocalDate(ctx.clock.now())) }) : t('selection.selectBatch')}
          backHref={routes.attendance}
        />
      }
    >
      {data ? <SessionList cards={data} viewer={monitoring || overview ? 'monitor' : 'marker'} /> : <Skeleton label={t('common.loading')} />}
    </ScreenLayout>
  );
}
