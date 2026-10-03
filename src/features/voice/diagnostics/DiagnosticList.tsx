import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { StatusLine } from '@/components/ui/StatusLine';
import type { IconName } from '@/components/ui/icons/Icon';
import { useT } from '@/hooks/i18n';
import type { DiagnosticRow, DiagnosticStatus } from '@/services/voice/diagnostics';
import styles from './VoiceDiagnostics.module.css';

const LOOK: Readonly<Record<DiagnosticStatus, { tone: 'success' | 'error' | 'info'; icon: IconName }>> = {
  pass: { tone: 'success', icon: 'circle-check' },
  fail: { tone: 'error', icon: 'circle-x' },
  info: { tone: 'info', icon: 'info' },
};

/** Pass / fail rows: the check's name, its reading beneath, and the result as icon + word + colour. */
export function DiagnosticList({ rows, label }: { readonly rows: readonly DiagnosticRow[]; readonly label: string }) {
  const t = useT();
  if (!rows.length) return null;
  return (
    <Card as="ul" divided aria-label={label}>
      {rows.map((row) => (
        <ListRow
          key={row.id}
          minHeight={56}
          titleStyle="label"
          title={t(`voice.diagnostics.check.${row.id}`)}
          subtitle={row.detail ? <span className={styles.detail}>{row.detail}</span> : undefined}
          trailing={
            <StatusLine tone={LOOK[row.status].tone} icon={LOOK[row.status].icon} nowrap>
              {t(`voice.diagnostics.status.${row.status}`)}
            </StatusLine>
          }
        />
      ))}
    </Card>
  );
}
