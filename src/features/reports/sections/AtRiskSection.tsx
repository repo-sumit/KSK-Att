'use client';
import { Disclosure } from '@/components/ui/Disclosure';
import { Latin } from '@/components/ui/Latin';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { Banner } from '@/components/ui/Banner';
import { Card } from '@/components/ui/Card';
import { StatusLine } from '@/components/ui/StatusLine';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useJourney, useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { cx } from '@/lib/cx';
import type { AtRiskGroup } from '@/services/reports';
import { BatchLabel } from '../../common/BatchLabel';
import styles from '../Reports.module.css';

/**
 * At-risk students: only students below the threshold, already grouped by
 * batch (so there is no batch filter, D-063), for intervention. Healthy
 * students are not listed here; the batch list above shows everyone.
 */
export function AtRiskSection() {
  const { t } = useI18n();
  const ctx = useSession();
  const j = useJourney();
  const { reports } = useServices();
  const { data } = useQuery(`report-risk:${ctx.user.id}`, () => reports.atRisk(ctx), ['attendance', 'corrections']);
  const threshold = j.reports.eligibilityThresholdPct;

  return (
    <Section id="at-risk" title={t('reports.student_percentage')} subtitle={t('reports.atRiskSub', { pct: threshold, days: j.reports.windowDays })}>
      {!data ? (
        <Skeleton variant="rows" leading="none" count={2} label={t('common.loading')} />
      ) : data.groups.length === 0 ? (
        <Banner tone="success" icon="circle-check" strong>
          {t('reports.noneAtRisk')}
        </Banner>
      ) : (
        <>
          <Card divided>
            {data.groups.map((group) => (
              <RiskGroup key={group.batch.id} group={group} defaultOpen={data.groups.length === 1} />
            ))}
          </Card>
          {data.batchesChecked > data.groups.length && (
            <StatusLine tone="success" icon="circle-check">
              {t('reports.othersHealthy', { count: data.batchesChecked - data.groups.length })}
            </StatusLine>
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
          <span className={styles.rowText}>
            <span className={styles.rowTitle}>
              <BatchLabel trade={group.trade} batch={group.batch} />
            </span>
            <StatusLine tone="warning" icon="alert">
              {t('reports.atRiskCount', { count: group.students.length })}
            </StatusLine>
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
