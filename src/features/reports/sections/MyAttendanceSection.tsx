'use client';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { ReportSummaryCard } from './ReportSummaryCard';

/** "My attendance" (brief §7): this month's %, days present and absent, and a short monthly trend. */
export function MyAttendanceSection() {
  const { t, format } = useI18n();
  const ctx = useSession();
  const { reports } = useServices();
  const { data } = useQuery(`report-me:${ctx.user.id}`, () => reports.myAttendance(ctx), ['staff']);

  return (
    // "This month" is said once, by the section; the figure's own caption says what it measures.
    <Section id="my-attendance" title={t('reports.my_attendance')} subtitle={t('reports.thisMonth')}>
      {!data ? (
        <Skeleton variant="summary" count={Math.max(0, ctx.config.reports.trendMonths)} label={t('common.loading')} />
      ) : data.workingDays === 0 ? (
        <ReportSummaryCard figures={[]} empty={t('reports.noDaysYet')} trend={data.trend} />
      ) : (
        <ReportSummaryCard
          figures={[{ value: data.pct === null ? t('reports.noValue') : format.percent(data.pct), label: t('reports.attendanceLabel') }]}
          facts={[
            { icon: 'circle-check', tone: 'success', text: t('reports.presentDays', { count: data.presentDays }) },
            { icon: 'circle-x', tone: data.absentDays ? 'error' : 'muted', text: t('reports.absentDays', { count: data.absentDays }) },
          ]}
          trend={data.trend}
        />
      )}
    </Section>
  );
}
