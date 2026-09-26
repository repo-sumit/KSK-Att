'use client';
import { IconTile } from '@/components/ui/IconWell';
import { List, ListRow } from '@/components/ui/ListRow';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { AppHeader } from '@/features/shell/AppHeader';
import { useI18n } from '@/hooks/i18n';
import { useJourney } from '@/hooks/session';
import { routes } from '@/lib/routes';
import { REPORT_META } from './reportRows';

/** One row per enabled report block (report.blocks), filtered to the user's role. */
export function ReportsScreen() {
  const { t } = useI18n();
  const j = useJourney();
  const defaultRange = j.reports.dateRanges.includes('month') ? 'month' : j.reports.dateRanges[0];
  return (
    <ScreenLayout header={<AppHeader title={t('reports.title')} />} area="reports" bottomNav>
      <List label={t('reports.title')} grid>
        {j.reports.blocks.map((block) => (
          <ListRow
            key={block}
            href={routes.report(block, defaultRange)}
            leading={<IconTile icon={REPORT_META[block].icon} tint="blue" size={40} />}
            title={t(REPORT_META[block].title)}
            subtitle={t(REPORT_META[block].desc, { pct: j.reports.eligibilityThresholdPct })}
            trailing="chevron"
            minHeight={72}
          />
        ))}
      </List>
    </ScreenLayout>
  );
}
