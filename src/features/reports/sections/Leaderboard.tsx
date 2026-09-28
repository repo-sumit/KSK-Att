'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Latin } from '@/components/ui/Latin';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusLine } from '@/components/ui/StatusLine';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useJourney, useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { cx } from '@/lib/cx';
import type { StudentStanding } from '@/services/reports';
import styles from '../Reports.module.css';

type Sort = 'high_first' | 'low_first';

/**
 * Leaderboard positions (brief §7: "1. Amit 94% · 2. Sneha 88%"): 1 is the best
 * attendance; equal percentages keep a stable order (more days present, then
 * name) instead of a column of repeated 1s. A student keeps their position when
 * the list is shown lowest first. Students with no marks yet come last, unranked.
 */
export function rankStandings(standings: readonly StudentStanding[], sort: Sort): Array<{ readonly standing: StudentStanding; readonly rank: number | null }> {
  const byName = (a: StudentStanding, b: StudentStanding) => a.student.name.localeCompare(b.student.name);
  const scored = standings.filter((s) => s.pct !== null);
  const best = [...scored].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || b.daysPresent - a.daysPresent || byName(a, b));
  const rank = new Map(best.map((s, i) => [s.student.id, i + 1]));
  const ordered = sort === 'high_first' ? best : [...best].reverse();
  const unscored = standings.filter((s) => s.pct === null).sort(byName);
  return [...ordered.map((standing) => ({ standing, rank: rank.get(standing.student.id) ?? null })), ...unscored.map((standing) => ({ standing, rank: null }))];
}

/** One batch's students this month as a light leaderboard (brief §7): rank, name, %, at risk flagged. */
export function Leaderboard({ batchId, expected, onHide }: { readonly batchId: string; readonly expected: number; readonly onHide: () => void }) {
  const { t, format } = useI18n();
  const ctx = useSession();
  const j = useJourney();
  const { reports } = useServices();
  const [sort, setSort] = useState<Sort>(j.reports.leaderboardSort);
  const { data } = useQuery(`report-students:${ctx.user.id}:${batchId}`, () => reports.batchStudents(ctx, batchId), ['attendance', 'corrections']);

  if (!data)
    return (
      <div className={styles.board}>
        <Skeleton variant="rows" count={Math.max(1, Math.min(expected, 4))} label={t('common.loading')} />
      </div>
    );
  const rows = rankStandings(data, sort);
  return (
    <div className={styles.board}>
      {rows.length === 0 ? (
        <p className={styles.boardEmpty}>{t('reports.noStudentData')}</p>
      ) : (
        <>
          <Segmented
            className={styles.sort}
            label={t('reports.sortLabel')}
            size="sm"
            fullWidth
            value={sort}
            onChange={setSort}
            options={[
              { value: 'high_first', label: t('reports.sortHigh') },
              { value: 'low_first', label: t('reports.sortLow') },
            ]}
          />
          <ol className={styles.ranks}>
            {rows.map(({ standing, rank }) => (
              <li key={standing.student.id} className={cx(styles.rankRow, standing.atRisk && styles.rankRisk)}>
                <span className={styles.rank}>{rank ?? t('reports.noValue')}</span>
                <span className={styles.rowText}>
                  <span className={styles.name}>
                    <Latin>{standing.student.name}</Latin>
                  </span>
                  <span className={styles.rowSub}>
                    <span>{t('reports.studentDays', { present: format.number(standing.daysPresent), days: standing.daysMarked })}</span>
                    {standing.atRisk && (
                      <StatusLine tone="warning" icon="alert">
                        {t('reports.atRiskTag')}
                      </StatusLine>
                    )}
                  </span>
                </span>
                <span className={styles.pct}>{standing.pct === null ? t('reports.noValue') : `${standing.pct}%`}</span>
              </li>
            ))}
          </ol>
          {/* A long list can be closed from its end, back to its batch. */}
          <Button variant="ghost" size="md" fullWidth trailingIcon="chevron-down" className={styles.hide} onClick={onHide}>
            {t('reports.hideStudents')}
          </Button>
        </>
      )}
    </div>
  );
}
