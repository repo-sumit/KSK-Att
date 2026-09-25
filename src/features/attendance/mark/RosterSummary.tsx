'use client';
import { Banner } from '@/components/ui/Banner';
import { Icon } from '@/components/ui/icons/Icon';
import { StatTiles } from '@/components/ui/StatTiles';
import type { MarkCounts } from '@/domain/marking';
import { useI18n } from '@/hooks/i18n';
import styles from './Mark.module.css';

interface RosterSummaryProps {
  /** Omit to show only the totals. */
  readonly meta?: string;
  /** Formatted close time when the window closes within minutes: "Attendance closes at 11:00 AM. Submit now." */
  readonly closingAt?: string;
  /** strip: fixed white band above the roster · plain: tiles inside page content. */
  readonly variant?: 'strip' | 'plain';
  readonly counts: MarkCounts;
  readonly staleSince?: string;
  readonly surface?: 'hero' | 'raised';
  readonly size?: 'lg' | 'md';
}

/** Running totals, always visible above the list: "30 students · 28 present · 2 absent". */
export function RosterSummary({ meta, counts, staleSince, closingAt, surface = 'hero', size = 'lg', variant = 'strip' }: RosterSummaryProps) {
  const { t } = useI18n();
  const extra = [
    counts.half_day ? t('roster.extraHalf', { count: counts.half_day }) : null,
    counts.leave ? t('roster.extraLeave', { count: counts.leave }) : null,
    counts.ojt ? t('roster.extraOjt', { count: counts.ojt }) : null,
    counts.unmarked ? t('roster.extraUnmarked', { count: counts.unmarked }) : null,
  ].filter(Boolean);
  return (
    <div className={variant === 'strip' ? styles.summary : styles.summaryPlain}>
      {meta && (
        <p className={styles.meta}>
          <Icon name="clock" size={14} />
          <span>{meta}</span>
        </p>
      )}
      <StatTiles
        size={size}
        surface={surface}
        tiles={[
          { key: 'total', label: t('roster.tileStudents'), value: String(counts.total), tone: 'neutral' },
          { key: 'present', label: t('status.present'), value: String(counts.present), tone: 'success', icon: 'check' },
          { key: 'absent', label: t('status.absent'), value: String(counts.absent), tone: 'error', icon: 'x' },
        ]}
      />
      {extra.length > 0 && <p className={styles.extra}>{extra.join(' · ')}</p>}
      {closingAt && (
        <Banner tone="warning" icon="clock" live>
          {t('roster.closingSoon', { time: closingAt })}
        </Banner>
      )}
      {staleSince && (
        <Banner tone="warning" icon="alert">
          {t('roster.stale', { date: staleSince })}
        </Banner>
      )}
    </div>
  );
}
