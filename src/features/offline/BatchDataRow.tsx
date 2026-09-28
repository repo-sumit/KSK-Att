'use client';
import { Icon } from '@/components/ui/icons/Icon';
import { useI18n } from '@/hooks/i18n';
import { cx } from '@/lib/cx';
import { useBatchRefresh, useUpdatedLabel } from './useBatchRefresh';
import styles from './BatchDataRow.module.css';

interface BatchDataRowProps {
  readonly batchId: string;
  /** Spoken with the button: "Refresh data for Electrician · Shift 1 · Unit 1". */
  readonly batchLabel: string;
  readonly pack: { readonly downloadedAt: string; readonly stale: boolean };
  /** offline.manualRefresh: without it the strip only says when the list was downloaded. */
  readonly canRefresh?: boolean;
}

/**
 * The foot of a downloaded batch's card: when its student list was last
 * downloaded, and a quiet "Refresh data" for just that batch (brief §4).
 */
export function BatchDataRow({ batchId, batchLabel, pack, canRefresh = true }: BatchDataRowProps) {
  const { t } = useI18n();
  const { state, refresh } = useBatchRefresh(batchId);
  const label = useUpdatedLabel()(state, pack);
  const warn = state === 'idle' && pack.stale;
  return (
    <div className={styles.row}>
      {/* One stable live region; only its words change (and settle in), so the change is announced. */}
      <span className={cx(styles.meta, warn && styles.warn, state === 'done' && styles.done)} role="status">
        <Icon name={state === 'done' ? 'circle-check' : warn ? 'alert' : 'hard-drive'} size={16} />
        <span key={state} className={styles.text}>
          {label}
        </span>
      </span>
      {canRefresh && (
        <button type="button" className={styles.refresh} onClick={() => void refresh()} aria-disabled={state === 'refreshing' || undefined} aria-label={t('batchData.refreshFor', { batch: batchLabel })}>
          <Icon name="refresh" size={16} className={state === 'refreshing' ? styles.spin : undefined} />
          {/* Words only while idle: the status beside it says what is happening, on one line. */}
          {state === 'idle' && <span>{t('batchData.refresh')}</span>}
        </button>
      )}
    </div>
  );
}
