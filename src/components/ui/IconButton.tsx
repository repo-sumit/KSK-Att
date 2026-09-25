'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icons/Icon';
import styles from './IconButton.module.css';

interface IconButtonProps {
  /** Required accessible name. */
  readonly label: string;
  readonly icon?: IconName;
  /** Custom content (e.g. avatar initials) instead of an icon. */
  readonly children?: ReactNode;
  readonly variant?: 'ghost' | 'brandSubtle';
  readonly href?: string;
  readonly onClick?: () => void;
  readonly className?: string;
}

export function IconButton({ label, icon, children, variant = 'ghost', href, onClick, className }: IconButtonProps) {
  const classes = cx(styles.button, styles[variant], className);
  const content = icon ? <Icon name={icon} size={24} /> : children;
  if (href) {
    return (
      <Link href={href} aria-label={label} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} className={classes} onClick={onClick}>
      {content}
    </button>
  );
}
