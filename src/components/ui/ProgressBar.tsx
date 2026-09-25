import styles from './ProgressBar.module.css';

/** 0–1 progress; always shown next to a number, so it is labelled but not relied on alone. */
export function ProgressBar({ value, label }: { readonly value: number; readonly label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <span className={styles.track} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span className={styles.fill} style={{ width: `${pct}%` }} />
    </span>
  );
}
