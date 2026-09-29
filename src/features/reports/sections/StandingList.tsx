'use client';
import type { ReactNode } from 'react';
import { Latin } from '@/components/ui/Latin';
import { StatusLine } from '@/components/ui/StatusLine';
import { useI18n } from '@/hooks/i18n';
import { cx } from '@/lib/cx';
import type { RankedStanding } from '@/services/reports';
import styles from './StandingList.module.css';

/**
 * The panel an expanded batch or at-risk group opens onto: white, like its
 * card, set apart only by the summary's divider (the open Disclosure draws it).
 */
export function StandingPanel({ children }: { readonly children: ReactNode }) {
  return <div className={styles.panel}>{children}</div>;
}

interface StandingListProps {
  /** ol: the batch leaderboard (a ranking) · ul: an at-risk group (lowest first). */
  readonly as: 'ol' | 'ul';
  readonly items: readonly RankedStanding[];
  /**
   * A list that mixes healthy and at-risk students (the leaderboard) says "At
   * risk" on each at-risk row; an at-risk group's header already says it, so
   * its rows carry the amber rank and percentage only (one carrier per context).
   */
  readonly flagAtRisk?: boolean;
}

/**
 * One row anatomy for both student lists on Reports (RPT-1): the student's
 * rank in the batch in a 32px disc (amber when at risk), the name over "n of m
 * days", and a right-aligned tabular percentage. Names line up in both lists.
 */
export function StandingList({ as: List, items, flagAtRisk = false }: StandingListProps) {
  const { t, format } = useI18n();
  return (
    <List className={styles.list}>
      {items.map(({ standing, rank }) => (
        <li key={standing.student.id} className={cx(styles.row, standing.atRisk && styles.risk)}>
          <span className={styles.rank}>
            {rank === null ? (
              t('reports.noValue')
            ) : (
              <>
                <span aria-hidden="true">{format.number(rank)}</span>
                <span className="visually-hidden">{t('reports.rankLabel', { rank })}</span>
              </>
            )}
          </span>
          <span className={styles.text}>
            <span className={styles.name}>
              <Latin>{standing.student.name}</Latin>
            </span>
            <span className={styles.sub}>
              <span>{t('reports.studentDays', { present: standing.daysPresent, days: standing.daysMarked })}</span>
              {flagAtRisk && standing.atRisk && (
                <StatusLine tone="warning" icon="alert">
                  {t('reports.atRiskTag')}
                </StatusLine>
              )}
            </span>
          </span>
          <span className={styles.pct}>{standing.pct === null ? t('reports.noValue') : format.percent(standing.pct)}</span>
        </li>
      ))}
    </List>
  );
}
