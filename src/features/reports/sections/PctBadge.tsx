import { Badge } from '@/components/ui/Badge';
import { useI18n } from '@/hooks/i18n';

/**
 * A batch or institute percentage. Only an exception carries status colour
 * (RPT-9): below the threshold it is amber with a warning icon and a spoken
 * "below 75%"; a healthy figure is a plain neutral chip, as a healthy student
 * is plain text in the leaderboard. Tabular digits keep the column aligned.
 */
export function PctBadge({ pct, low, threshold }: { readonly pct: number | null; readonly low: boolean; readonly threshold: number }) {
  const { t, format } = useI18n();
  if (pct === null) return <Badge size="md">{t('reports.noValue')}</Badge>;
  const figure = format.percent(pct);
  if (!low) return <Badge size="md">{figure}</Badge>;
  return (
    <Badge tone="warning" icon="alert" size="md">
      {figure}
      <span className="visually-hidden">{` · ${t('reports.belowTarget', { pct: threshold })}`}</span>
    </Badge>
  );
}
