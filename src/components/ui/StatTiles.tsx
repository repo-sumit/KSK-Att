import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icons/Icon';
import styles from './StatTiles.module.css';

export interface StatTile {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly tone: 'neutral' | 'success' | 'error' | 'warning';
  readonly icon?: IconName;
}

interface StatTilesProps {
  readonly tiles: readonly StatTile[];
  readonly size?: 'lg' | 'md';
  /** hero: tiles on white · raised: tinted tiles on the grey page · plain: white tiles, tone in the text only (staff view). */
  readonly surface?: 'hero' | 'raised' | 'plain';
}

/** Running totals: three-up grid, tabular numerals (roster, review, records, staff). */
export function StatTiles({ tiles, size = 'lg', surface = 'hero' }: StatTilesProps) {
  return (
    <div className={styles.grid}>
      {tiles.map((tile) => (
        <div key={tile.key} className={cx(styles.tile, styles[tile.tone], styles[surface])}>
          <span className={cx(styles.value, styles[size], 'tnum')}>{tile.value}</span>
          <span className={styles.label}>
            {tile.icon && <Icon name={tile.icon} size={12} strokeWidth={3} />}
            {tile.label}
          </span>
        </div>
      ))}
    </div>
  );
}
