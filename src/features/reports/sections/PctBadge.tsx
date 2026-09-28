import { Badge } from '@/components/ui/Badge';
import { useT } from '@/hooks/i18n';

/** A batch or institute percentage: amber with a warning icon (and spoken "below 75%") when low, green otherwise. */
export function PctBadge({ pct, low, threshold }: { readonly pct: number | null; readonly low: boolean; readonly threshold: number }) {
  const t = useT();
  if (pct === null) return <Badge size="md">{t('reports.noValue')}</Badge>;
  return (
    <Badge tone={low ? 'warning' : 'success'} icon={low ? 'alert' : 'check'} size="md">
      {`${pct}%`}
      {low && <span className="visually-hidden">{` · ${t('reports.belowTarget', { pct: threshold })}`}</span>}
    </Badge>
  );
}
