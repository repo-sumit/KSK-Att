import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './DetailRows.module.css';

export interface DetailRow {
  readonly key: string;
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly tone?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'brand';
}

interface DetailRowsProps {
  readonly rows: readonly DetailRow[];
  /** plain: divider above every row (follows other content) · list: dividers between rows only. */
  readonly variant?: 'card' | 'plain' | 'hero' | 'list';
  readonly emphasis?: boolean;
}

/** Label / value pairs (identity confirmation, results, confirm sheets, profile). */
export function DetailRows({ rows, variant = 'plain', emphasis = false }: DetailRowsProps) {
  return (
    <dl className={cx(styles.rows, styles[variant])}>
      {rows.map((row) => (
        <div key={row.key} className={cx(styles.row, row.tone && styles[row.tone])}>
          <dt className={styles.label}>{row.label}</dt>
          <dd className={cx(styles.value, emphasis && styles.emphasis)}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
