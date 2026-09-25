import styles from './Skeleton.module.css';

/** Loading placeholder blocks; announces "Loading…" once for screen readers. */
export function Skeleton({ count = 4, height = 72, label }: { readonly count?: number; readonly height?: number; readonly label: string }) {
  return (
    <div className={styles.stack} aria-busy="true">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={styles.block} style={{ height }} />
      ))}
    </div>
  );
}
