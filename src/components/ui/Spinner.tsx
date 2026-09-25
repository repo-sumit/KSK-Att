import styles from './Spinner.module.css';

/** Indeterminate progress ring; decorative (pair it with text). */
export function Spinner({ size = 16 }: { readonly size?: number }) {
  return <span className={styles.spinner} style={{ width: size, height: size }} aria-hidden="true" />;
}
