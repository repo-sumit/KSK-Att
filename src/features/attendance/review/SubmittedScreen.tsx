'use client';
import { useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/Skeleton';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { Latin } from '@/components/ui/Latin';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { useSyncStatus } from '@/hooks/useSync';
import { routes } from '@/lib/routes';
import { ResultScreen } from '../../feedback/ResultScreen';
import { useSessionLabel } from '../useSessionLabel';

/**
 * Submitted — or "saved on this phone" when it cannot be sent right now
 * (offline, failed, or waiting). While a send is in flight it reads as
 * submitted, as in the prototype; the sync banner shows the send itself.
 */
export function SubmittedScreen() {
  const { t, format } = useI18n();
  const ctx = useSession();
  const { attendance } = useServices();
  const label = useSessionLabel();
  const sync = useSyncStatus();
  const key = useSearchParams().get('s') ?? '';
  const { data: card } = useQuery(`submitted:${key}`, () => attendance.findCard(ctx, key), ['attendance', 'offline']);

  if (!card?.submission) return <ScreenLayout card><Skeleton label={t('common.loading')} /></ScreenLayout>;
  const s = card.submission;
  const extras = [
    s.counts.half_day ? t('result.summaryHalf', { count: s.counts.half_day }) : null,
    s.counts.leave ? t('result.summaryLeave', { count: s.counts.leave }) : null,
    s.counts.ojt ? t('result.summaryOjt', { count: s.counts.ojt }) : null,
  ].filter(Boolean);
  const summary = [t('result.summary', { present: s.counts.present, absent: s.counts.absent }), ...extras].join(' · ');
  const name = label(card);
  const saved = s.pendingSync && sync.phase !== 'syncing';
  return (
    <ResultScreen
      tone={saved ? 'warning' : 'success'}
      icon={saved ? 'cloud-upload' : 'circle-check'}
      title={saved ? t('result.savedTitle') : t('result.submittedTitle')}
      sub={summary}
      meta={
        <>
          <Latin>{name.title}</Latin> · {format.time(s.at)}
        </>
      }
      note={saved ? t(sync.online ? 'result.savedNoteLater' : 'result.savedNote') : undefined}
      primary={{ label: t('common.done'), href: routes.home }}
    />
  );
}
