import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './Section.module.css';

interface SectionProps {
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly children: ReactNode;
  /** 'title' = Title/Large heading; 'label' = small secondary group label. */
  readonly variant?: 'title' | 'label';
  readonly className?: string;
  readonly id?: string;
  /** Heading level: 2 for a page section, 3 for a group inside one (a trade under "Your batches"). */
  readonly level?: 2 | 3;
}

/** Titled group of content: 16 between title and content (replaces the prototype's negative margin). */
export function Section({ title, subtitle, children, variant = 'title', className, id, level = 2 }: SectionProps) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <section className={cx(styles.section, variant === 'label' && styles.tight, className)} aria-labelledby={title && id ? `${id}-title` : undefined}>
      {title && (
        <div className={styles.head}>
          <Heading id={id ? `${id}-title` : undefined} className={variant === 'title' ? styles.title : styles.label}>
            {title}
          </Heading>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
