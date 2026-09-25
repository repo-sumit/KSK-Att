'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './Card.module.css';

interface CardProps {
  readonly children: ReactNode;
  readonly padded?: boolean;
  readonly flat?: boolean;
  readonly bordered?: boolean;
  readonly className?: string;
  readonly as?: 'div' | 'section' | 'li';
}

/** DS content card: surfaceRaised, radius lg, card shadow. */
export function Card({ children, padded = true, flat = false, bordered = false, className, as: Tag = 'div' }: CardProps) {
  return <Tag className={cx(styles.card, padded && styles.padded, flat && styles.flat, bordered && styles.bordered, className)}>{children}</Tag>;
}

interface PressableCardProps {
  readonly children: ReactNode;
  readonly href?: string;
  readonly onClick?: () => void;
  readonly highlighted?: boolean;
  readonly muted?: boolean;
  readonly className?: string;
  readonly ariaLabel?: string;
}

/** A whole card that is one link/button (replaces the prototype's div role=button). */
export function PressableCard({ children, href, onClick, highlighted, muted, className, ariaLabel }: PressableCardProps) {
  const classes = cx(styles.card, styles.padded, styles.pressable, highlighted && styles.highlighted, muted && styles.muted, className);
  if (href) {
    return (
      <Link href={href} className={classes} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
