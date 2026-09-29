'use client';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useJourney, useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { ReportSummaryCard, type SummaryFigure } from './ReportSummaryCard';

/** The principal's headline over the report window: institute attendance and staff presence, side by side and equal in weight. */
export function InstituteSection() {
  const { t, format } = useI18n();
  const ctx = useSession();
  const j = useJourney();
  const { reports } = useServices();
  const { data } = useQuery(`report-institute:${ctx.institute.id}`, () => reports.instituteSummary(ctx), ['attendance', 'corrections', 'staff']);
  const figures: SummaryFigure[] = data
    ? [
        { value: data.pct === null ? t('reports.noValue') : format.percent(data.pct), label: [t('common.students', { count: data.students }), t('reports.batchCount', { count: data.batches })] },
        ...(data.staffPct === null ? [] : [{ value: format.percent(data.staffPct), label: t('reports.staff_summary') }]),
      ]
    : [];
  return (
    <Section id="institute" title={t('reports.institute_summary')} subtitle={t('reports.lastDays', { count: j.reports.windowDays })}>
      {!data ? <Skeleton variant="summary" count={0} label={t('common.loading')} /> : <ReportSummaryCard figures={figures} />}
    </Section>
  );
}
