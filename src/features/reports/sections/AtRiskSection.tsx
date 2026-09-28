'use client';
import { useId, useState } from 'react';
import { Disclosure } from '@/components/ui/Disclosure';
import { Icon } from '@/components/ui/icons/Icon';
import { Latin } from '@/components/ui/Latin';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Batch } from '@/domain/entities';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useJourney, useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { cx } from '@/lib/cx';
import type { AtRiskGroup } from '@/services/reports';
import { BatchLabel } from '../../common/BatchLabel';
import { batchTitle, batchWithTrade } from '../../common/labels';
import styles from '../Reports.module.css';

const ALL = 'all';

/**
 * At-risk students (brief §8): only students below the threshold, grouped by
 * batch, for intervention. Healthy students are not listed here; the batch
 * list above shows everyone.
 */
export function AtRiskSection() {
  const { t } = useI18n();
  const ctx = useSession();
  const j = useJourney();
  const { reports } = useServices();
  const [batchId, setBatchId] = useState(ALL);
  const { data: scope } = useQuery(`report-scope:${ctx.user.id}`, () => reports.batchesInScope(ctx), ['attendance']);
  const { data, stale } = useQuery(`report-risk:${ctx.user.id}:${batchId}`, () => reports.atRisk(ctx, { batchId: batchId === ALL ? undefined : batchId }), ['attendance', 'corrections']);
  const threshold = j.reports.eligibilityThresholdPct;
  // Spoken once the list for the chosen filter has arrived (the visible list changes silently otherwise).
  const flagged = data && !stale ? data.groups.reduce((a, g) => a + g.students.length, 0) : null;

  return (
    <Section id="at-risk" title={t('reports.student_percentage')} subtitle={t('reports.atRiskSub', { pct: threshold, days: j.reports.windowDays })}>
      {scope && scope.length > 1 && <BatchFilter batches={scope} value={batchId} onChange={setBatchId} />}
      <p className="visually-hidden" role="status">
        {flagged === null ? '' : flagged ? t('reports.atRiskCount', { count: flagged }) : batchId === ALL ? t('reports.noneAtRisk') : t('reports.noneInBatch')}
      </p>
      {/* A new filter shows a placeholder, never the previous filter's groups. */}
      {!data || stale ? (
        <Skeleton variant="rows" leading="tile" count={2} label={t('common.loading')} />
      ) : data.groups.length === 0 ? (
        <p className={cx(styles.allClear, styles.allClearCard)}>
          <Icon name="circle-check" size={20} />
          {batchId === ALL ? t('reports.noneAtRisk') : t('reports.noneInBatch')}
        </p>
      ) : (
        <>
          <div className={styles.listCard}>
            {data.groups.map((group) => (
              <RiskGroup key={`${batchId}:${group.batch.id}`} group={group} defaultOpen={data.groups.length === 1} />
            ))}
          </div>
          {batchId === ALL && data.batchesChecked > data.groups.length && (
            <p className={styles.allClear}>
              <Icon name="circle-check" size={20} />
              {t('reports.othersHealthy', { count: data.batchesChecked - data.groups.length })}
            </p>
          )}
        </>
      )}
    </Section>
  );
}

function RiskGroup({ group, defaultOpen }: { readonly group: AtRiskGroup; readonly defaultOpen: boolean }) {
  const { t, format } = useI18n();
  return (
    <Disclosure
      defaultOpen={defaultOpen}
      summary={
        <>
          <span className={styles.riskTile} aria-hidden="true">
            <Icon name="alert" size={20} />
          </span>
          <span className={styles.rowText}>
            <span className={styles.rowTitle}>
              <BatchLabel trade={group.trade} batch={group.batch} />
            </span>
            <span className={styles.riskNote}>{t('reports.atRiskCount', { count: group.students.length })}</span>
          </span>
        </>
      }
    >
      <div className={styles.board}>
        <ul className={styles.ranks}>
          {group.students.map((s) => (
            <li key={s.student.id} className={cx(styles.rankRow, styles.rankRisk)}>
              <span className={styles.rowText}>
                <span className={styles.name}>
                  <Latin>{s.student.name}</Latin>
                </span>
                <span className={styles.rowSub}>{t('reports.studentDays', { present: format.number(s.daysPresent), days: s.daysMarked })}</span>
              </span>
              <span className={styles.pct}>{`${s.pct}%`}</span>
            </li>
          ))}
        </ul>
      </div>
    </Disclosure>
  );
}

/** All batches, or one. A native select: the phone's own picker, and it holds a whole institute's batches. */
function BatchFilter({ batches, value, onChange }: { readonly batches: readonly Batch[]; readonly value: string; readonly onChange: (id: string) => void }) {
  const { t } = useI18n();
  const ctx = useSession();
  const id = useId();
  const trades = ctx.data.trades.filter((tr) => batches.some((b) => b.tradeId === tr.id));
  // A handful of batches: full names. Many (the principal): grouped under their trade.
  const grouped = batches.length > 4;
  return (
    <div className={styles.filter}>
      <label htmlFor={id} className={styles.filterLabel}>
        {t('reports.filterBatch')}
      </label>
      <span className={styles.selectWrap}>
        <select id={id} className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value={ALL}>{t('reports.allBatches')}</option>
          {grouped
            ? trades.map((trade) => (
                <optgroup key={trade.id} label={trade.name}>
                  {batches
                    .filter((b) => b.tradeId === trade.id)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {`${trade.name} · ${batchTitle(t, b)}`}
                      </option>
                    ))}
                </optgroup>
              ))
            : batches.map((b) => {
                const trade = trades.find((tr) => tr.id === b.tradeId);
                return (
                  <option key={b.id} value={b.id}>
                    {trade ? batchWithTrade(t, trade, b) : b.id}
                  </option>
                );
              })}
        </select>
        <Icon name="chevron-down" size={20} className={styles.selectIcon} />
      </span>
    </div>
  );
}
