import Link from 'next/link';
import styles from './not-found.module.css';

/** Server-rendered 404 (outside the app providers, so plain markup; English + Marathi). */
export default function NotFound() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Page not found · पान सापडले नाही</h1>
      <p className={styles.body}>This link doesn’t match anything in the app.</p>
      <Link href="/" className={styles.link}>
        Go to Home · मुख्यपृष्ठावर जा
      </Link>
    </main>
  );
}
