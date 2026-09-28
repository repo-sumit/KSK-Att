'use client';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/icons/Icon';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useJourney, useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import styles from '../Reports.module.css';

/** The principal's headline for the month: institute attendance, its size, and staff presence. */
export function InstituteSection() {
  const { t } = useI18n();
  const ctx = useSession();
  const j = useJourney();
  const { reports } = useServices();
  const { data } = useQuery(`report-institute:${ctx.institute.id}`, () => reports.instituteSummary(ctx), ['attendance', 'corrections', 'staff']);
  return (
    <Section id="institute" title={t('reports.institute_summary')} subtitle={t('reports.lastDays', { count: j.reports.windowDays })}>
      {!data ? (
        <Skeleton variant="summary" count={0} label={t('common.loading')} />
      ) : (
        <Card>
          <div className={styles.summaryRow}>
            <span className={styles.big}>
              <span className={styles.bigPct}>{data.pct === null ? t('reports.noValue') : `${data.pct}%`}</span>
              <span className={styles.bigLabel}>{t('reports.instituteMeta', { students: data.students, batches: data.batches })}</span>
            </span>
            {data.staffPct !== null && (
              <span className={styles.count}>
                <Icon name="user-check" size={20} className={styles.iconSuccess} />
                {t('reports.staffPct', { pct: data.staffPct })}
              </span>
            )}
          </div>
        </Card>
      )}
    </Section>
  );
}
