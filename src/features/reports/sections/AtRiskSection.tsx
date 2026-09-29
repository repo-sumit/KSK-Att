'use client';
import { Banner } from '@/components/ui/Banner';
import { Card } from '@/components/ui/Card';
import { Disclosure } from '@/components/ui/Disclosure';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusLine } from '@/components/ui/StatusLine';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useJourney, useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import type { AtRiskGroup } from '@/services/reports';
import { BatchLabel } from '../../common/BatchLabel';
import { StandingList, StandingPanel } from './StandingList';
import styles from '../Reports.module.css';

/**
 * At-risk students: only students below the threshold, already grouped by
 * batch (so there is no batch filter, D-063), for intervention. Healthy
 * students are not listed here; the batch list above shows everyone. Each
 * student keeps the rank their batch's leaderboard gives them (RPT-1).
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
        // A calm confirmation, like Offline data's "All attendance synced" (D-068).
        <Banner tone="success" icon="circle-check">
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
  const { t } = useI18n();
  return (
    <Disclosure
      defaultOpen={defaultOpen}
      summary={
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>
            <BatchLabel trade={group.trade} batch={group.batch} />
          </span>
          {/* The group's one status carrier; its rows show the amber rank and % only. */}
          <StatusLine tone="warning" icon="alert">
            {t('reports.atRiskCount', { count: group.students.length })}
          </StatusLine>
        </span>
      }
    >
      <StandingPanel>
        <StandingList as="ul" items={group.students.map((standing) => ({ standing, rank: standing.rank }))} />
      </StandingPanel>
    </Disclosure>
  );
}
