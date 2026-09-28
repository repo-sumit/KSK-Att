import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icons/Icon';
import type { Tone } from './Badge';
import styles from './IconWell.module.css';

/** Large circular icon well for problem, result, intro and permission screens. */
export function IconWell({ icon, tone, size = 88, settle = false }: { readonly icon: IconName; readonly tone: Tone; readonly size?: 88 | 96; readonly settle?: boolean }) {
  return (
    <span className={cx(styles.well, styles[tone], styles[`s${size}`], settle && styles.settle)} aria-hidden="true">
      <Icon name={icon} size={size === 96 ? 48 : 44} />
    </span>
  );
}

/** Rounded-square icon chip used in cards and list rows. */
export function IconTile({ icon, tint = 'blue', size = 48 }: { readonly icon: IconName; readonly tint?: 'blue' | 'green'; readonly size?: 40 | 48 }) {
  return (
    <span className={cx(styles.tile, styles[tint], styles[`t${size}`])} aria-hidden="true">
      <Icon name={icon} size={size === 48 ? 24 : 20} />
    </span>
  );
}
