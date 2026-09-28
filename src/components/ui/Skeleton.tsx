import { cx } from '@/lib/cx';
import styles from './Skeleton.module.css';

const LINE_WIDTHS = ['62%', '48%', '70%', '55%'];

interface SkeletonProps {
  readonly count?: number;
  readonly height?: number;
  readonly label: string;
  /**
   * blocks: plain cards (default) · rows: list rows inside one card · summary: one
   * card shaped like a headline figure with two facts and a short trend.
   */
  readonly variant?: 'blocks' | 'rows' | 'summary';
  /** rows only: what starts each row, matching the content (a round avatar/rank, a square icon tile, or nothing). */
  readonly leading?: 'dot' | 'tile' | 'none';
}

/** Loading placeholder shaped like what is coming; announces the label once for screen readers. */
export function Skeleton({ count = 4, height = 72, label, variant = 'blocks', leading = 'dot' }: SkeletonProps) {
  if (variant === 'summary')
    return (
      <div className={cx(styles.card, styles.summary)} aria-busy="true">
        <span className="visually-hidden">{label}</span>
        <span className={styles.summaryTop} aria-hidden="true">
          <span className={styles.lines}>
            <span className={styles.figure} />
            <span className={styles.lineShort} />
          </span>
          <span className={styles.lines}>
            <span className={styles.line} style={{ width: '80%' }} />
            <span className={styles.line} style={{ width: '64%' }} />
          </span>
        </span>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={styles.trendRow} aria-hidden="true">
            <span className={styles.lineShort} />
            <span className={styles.bar} />
          </span>
        ))}
      </div>
    );
  if (variant === 'rows')
    return (
      <div className={styles.card} aria-busy="true">
        <span className="visually-hidden">{label}</span>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={styles.row} aria-hidden="true">
            {leading !== 'none' && <span className={leading === 'tile' ? styles.tile : styles.dot} />}
            <span className={styles.lines}>
              <span className={styles.line} style={{ width: LINE_WIDTHS[i % LINE_WIDTHS.length] }} />
              <span className={styles.lineShort} />
            </span>
            <span className={styles.pill} />
          </span>
        ))}
      </div>
    );
  return (
    <div className={styles.stack} aria-busy="true">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={styles.block} style={{ height }} />
      ))}
    </div>
  );
}
