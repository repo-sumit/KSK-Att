'use client';
import { memo } from 'react';
import { PressableCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/icons/Icon';
import { Latin } from '@/components/ui/Latin';
import { useI18n } from '@/hooks/i18n';
import { useSyncStatus } from '@/hooks/useSync';
import { cx } from '@/lib/cx';
import { routes } from '@/lib/routes';
import type { SessionCard } from '@/services/attendance';
import { batchTitle, batchWithTrade, sessionMeta, windowRange } from '../../common/labels';
import styles from './SessionCardView.module.css';

export type CardViewer = 'marker' | 'monitor';

interface SessionCardViewProps {
  readonly card: SessionCard;
  /** batch: prototype batch card · slot: one of several marks for a batch · period: timetable card. */
  readonly variant: 'batch' | 'slot' | 'period';
  /** marker: the user can mark · monitor: principal / trade overview. */
  readonly viewer: CardViewer;
  readonly twiceShape: 'halves' | 'signin_signout';
  readonly subjectName?: string;
}

export function hrefFor(card: SessionCard, viewer: CardViewer): string {
  if (card.status === 'submitted') return routes.record(card.key);
  if (card.canMark) return routes.open(card.key);
  return viewer === 'monitor' ? routes.record(card.key) : routes.open(card.key);
}

function StatusLine({ card, viewer }: { readonly card: SessionCard; readonly viewer: CardViewer }) {
  const { t, format } = useI18n();
  const { online } = useSyncStatus();
  switch (card.status) {
    case 'submitted':
      return (
        <span className={styles.submitted}>
          <span className={styles.statusSuccess}>
            <Icon name="circle-check" size={16} />
            {t('selection.submitted')}
          </span>
          <span className={styles.view}>
            {card.submission?.pendingSync ? t('selection.waitingToSync') : t('selection.submittedView', { time: format.time(card.submission?.at ?? '') })}
            <Icon name="chevron-right" size={14} />
          </span>
        </span>
      );
    case 'future':
      return (
        <span className={styles.status}>
          <Icon name="clock" size={16} />
          {card.scheduled.window ? t('selection.opensAt', { time: format.clockTime(card.address.date, card.scheduled.window.start) }) : null}
        </span>
      );
    case 'closed':
      return (
        <span className={cx(styles.status, viewer === 'monitor' && styles.statusError)}>
          <Icon name="lock" size={16} />
          {viewer === 'monitor'
            ? t('selection.closedPrincipal')
            : card.scheduled.window
              ? t('selection.closedAt', { time: format.clockTime(card.address.date, card.scheduled.window.end) })
              : t('selection.closed')}
        </span>
      );
    case 'open':
      // Offline and not on this phone: say so here instead of letting the tap end on "not downloaded".
      if (card.canMark && !online && !card.downloaded)
        return (
          <span className={cx(styles.status, styles.statusWarning)}>
            <Icon name="wifi-off" size={16} />
            {t('selection.needsInternet')}
          </span>
        );
      return card.canMark ? (
        <span className={styles.cta}>{t('selection.markAttendance')}</span>
      ) : (
        <span className={cx(styles.status, styles.statusWarning)}>
          <Icon name="circle" size={16} />
          {t('selection.pending')}
        </span>
      );
  }
}

export const SessionCardView = memo(function SessionCardView({ card, variant, viewer, twiceShape, subjectName }: SessionCardViewProps) {
  const { t, format } = useI18n();
  const { online } = useSyncStatus();
  const muted = card.status === 'future' || card.status === 'closed';
  const meta = sessionMeta(t, card, twiceShape, subjectName);
  const count = t('common.students', { count: card.studentCount });
  const byLine = viewer === 'monitor' && card.submission ? t('selection.submittedBy', { count: card.studentCount, name: card.submission.byName }) : count;

  if (variant === 'batch') {
    return (
      <PressableCard href={hrefFor(card, viewer)} className={styles.batch}>
        <span className={styles.left}>
          <span className={cx(styles.title, muted && styles.muted)}>{batchTitle(t, card.batch)}</span>
          <span className={styles.meta}>
            {meta ? `${meta} · ` : ''}
            <Latin>{byLine}</Latin>
          </span>
        </span>
        <span className={styles.right}>
          <StatusLine card={card} viewer={viewer} />
        </span>
      </PressableCard>
    );
  }

  const range = windowRange(format, card);
  const current = card.status === 'open' && Boolean(card.scheduled.window);
  const title = variant === 'period' ? batchWithTrade(t, card.trade, card.batch) : meta ?? batchTitle(t, card.batch);
  return (
    <PressableCard href={hrefFor(card, viewer)} highlighted={card.status === 'open' && card.canMark} className={styles.slot}>
      {(range || current) && (
        <span className={styles.timeRow}>
          {range && <span className={cx(styles.time, current && styles.timeNow)}>{range}</span>}
          {current && <Badge tone="brand">{t('selection.now')}</Badge>}
        </span>
      )}
      <span className={styles.left}>
        <span className={cx(styles.title, muted && styles.muted)}>{variant === 'period' ? <Latin>{title}</Latin> : title}</span>
        <span className={styles.meta}>{variant === 'period' ? [meta, count].filter(Boolean).join(' · ') : <Latin>{byLine}</Latin>}</span>
      </span>
      {card.status === 'open' && card.canMark && (online || card.downloaded) ? <span className={cx(styles.cta, styles.ctaFull)}>{t('selection.markAttendance')}</span> : <StatusLine card={card} viewer={viewer} />}
    </PressableCard>
  );
});
