'use client';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { ToastViewport } from '@/components/ui/Toast';
import { ConnectivityBanner } from './ConnectivityBanner';
import styles from './ScreenLayout.module.css';

interface ScreenLayoutProps {
  readonly header?: ReactNode;
  /** Show the offline / sync banner under the header. */
  readonly banner?: boolean;
  /** Fixed region above the scroller (roster summary, segmented switch). */
  readonly top?: ReactNode;
  /** Fixed region below the scroller (primary action). */
  readonly footer?: ReactNode;
  readonly nav?: ReactNode;
  /** app: grey page with white cards · default/raised: white · inverse: dark camera. */
  readonly surface?: 'app' | 'default' | 'raised' | 'inverse';
  /** Padding for the scroll content; 'none' lets lists run edge to edge. */
  readonly padding?: 'page' | 'none' | 'center';
  readonly children: ReactNode;
}

/**
 * Every screen's frame. The main area is the ONLY scroller, so fixed regions
 * (summary, footer CTA, nav) can never cover a student row — the prototype's
 * "sticky" behaviour without position: sticky.
 */
export function ScreenLayout({ header, banner = true, top, footer, nav, surface = 'app', padding = 'page', children }: ScreenLayoutProps) {
  return (
    <div className={cx(styles.frame, styles[surface])}>
      {header}
      {banner && (
        // Always in the DOM, so screen readers announce going offline (a live region that arrives with its text is often missed).
        <div className={cx(styles.banner, !header && styles.bannerFirst)} role="status" aria-live="polite">
          <ConnectivityBanner />
        </div>
      )}
      {top && <div className={styles.top}>{top}</div>}
      <main id="main" tabIndex={-1} className={cx(styles.main, styles[`pad-${padding}`], !header && styles.headerless)}>
        {children}
      </main>
      <div className={styles.dock}>
        <ToastViewport />
        {footer && <div className={styles.footer}>{footer}</div>}
        {nav}
      </div>
    </div>
  );
}
