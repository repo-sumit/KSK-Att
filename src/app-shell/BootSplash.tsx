import Image from 'next/image';
import styles from './BootSplash.module.css';

/** Shown until the on-device data layer is ready (also the server-rendered shell). */
export function BootSplash() {
  return (
    <div className={styles.splash} aria-busy="true">
      <Image src="/branding/ksk-emblem.png" alt="" width={72} height={72} loading="eager" />
      <span className="visually-hidden">Loading</span>
    </div>
  );
}
