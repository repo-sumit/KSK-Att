'use client';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/icons/Icon';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { cx } from '@/lib/cx';
import type { MonthStat } from '@/services/reports';
import styles from '../Reports.module.css';

/** "My attendance" (brief §7): this month's %, days present and absent, and a short monthly trend. */
export function MyAttendanceSection() {
  const { t } = useI18n();
  const ctx = useSession();
  const { reports } = useServices();
  const { data } = useQuery(`report-me:${ctx.user.id}`, () => reports.myAttendance(ctx), ['staff']);

  return (
    <Section id="my-attendance" title={t('reports.my_attendance')} subtitle={t('reports.thisMonth')}>
      {!data ? (
        <Skeleton variant="summary" count={Math.max(0, ctx.config.reports.trendMonths)} label={t('common.loading')} />
      ) : (
        <Card>
          {data.workingDays === 0 ? (
            <p className={styles.empty}>{t('reports.noDaysYet')}</p>
          ) : (
            <div className={styles.summaryRow}>
              <span className={styles.big}>
                <span className={styles.bigPct}>{data.pct === null ? t('reports.noValue') : `${data.pct}%`}</span>
                <span className={styles.bigLabel}>{t('reports.thisMonth')}</span>
              </span>
              <span className={styles.counts}>
                <span className={styles.count}>
                  <Icon name="circle-check" size={20} className={styles.iconSuccess} />
                  {t('reports.presentDays', { count: data.presentDays })}
                </span>
                <span className={styles.count}>
                  <Icon name="circle-x" size={20} className={data.absentDays ? styles.iconError : styles.iconMuted} />
                  {t('reports.absentDays', { count: data.absentDays })}
                </span>
              </span>
            </div>
          )}
          {data.trend.length > 1 && <Trend months={data.trend} />}
        </Card>
      )}
    </Section>
  );
}

function Trend({ months }: { readonly months: readonly MonthStat[] }) {
  const { t, format } = useI18n();
  return (
    <div className={styles.trend}>
      <p className={styles.trendTitle}>{t('reports.trend', { count: months.length })}</p>
      <ul className={styles.trendList}>
        {months.map((m, i) => (
          <li key={m.month} className={cx(styles.trendRow, i === months.length - 1 && styles.trendNow)}>
            <span className={styles.trendMonth}>{format.monthShort(m.month)}</span>
            <span className={styles.trendBar} aria-hidden="true">
              <span className={styles.trendFill} style={{ width: `${m.pct ?? 0}%` }} />
            </span>
            <span className={styles.trendPct}>{m.pct === null ? t('reports.noValue') : `${m.pct}%`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
