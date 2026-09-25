import { cx } from '@/lib/cx';
import styles from './Avatar.module.css';

export function initials(name: string): string {
  return name
    .replace(/^(Dr|Mr|Mrs|Ms|Shri|Smt)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Initials avatar (decorative; the name is always shown next to it). */
export function Avatar({ name, size = 40 }: { readonly name: string; readonly size?: 32 | 40 | 44 | 48 | 56 }) {
  return (
    <span className={cx(styles.avatar, styles[`s${size}`])} aria-hidden="true" lang="en">
      {initials(name)}
    </span>
  );
}
