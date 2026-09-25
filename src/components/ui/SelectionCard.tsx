'use client';
import { cx } from '@/lib/cx';
import type { Tone } from './Badge';
import { Icon, type IconName } from './icons/Icon';
import styles from './SelectionCard.module.css';

interface SelectionCardProps {
  readonly icon: IconName;
  /** Colours the leading status glyph so it reads as a status symbol, not as a selection mark. */
  readonly iconTone?: Tone;
  readonly label: string;
  readonly selected: boolean;
  /** The option the record already has: shown, but not choosable. */
  readonly current?: boolean;
  readonly currentTag?: string;
  readonly onSelect: () => void;
}

/** Large radio option (DS selection card) used on the correction screen. */
export function SelectionCard({ icon, iconTone, label, selected, current, currentTag, onSelect }: SelectionCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={current || undefined}
      className={cx(styles.card, selected && styles.selected, current && styles.current)}
      onClick={() => {
        if (!current) onSelect();
      }}
    >
      <Icon name={icon} size={20} strokeWidth={2.5} className={iconTone && !current ? styles[`glyph-${iconTone}`] : undefined} />
      <span className={styles.label}>{label}</span>
      {current && currentTag && <span className={styles.tag}>{currentTag}</span>}
      {selected && <Icon name="circle-check" size={20} />}
    </button>
  );
}
