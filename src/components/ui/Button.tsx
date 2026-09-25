'use client';
import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icons/Icon';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'inverse';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly children: ReactNode;
  readonly variant?: Variant;
  readonly size?: Size;
  readonly fullWidth?: boolean;
  readonly leadingIcon?: IconName;
  readonly trailingIcon?: IconName;
  readonly loading?: boolean;
  /**
   * Looks disabled but stays focusable and tappable, so a tap can explain why
   * (aria-disabled + onInactivePress) instead of silently doing nothing.
   */
  readonly inactive?: boolean;
  readonly onInactivePress?: () => void;
  readonly href?: string;
}

const ICON_SIZE: Record<Size, number> = { lg: 20, md: 18, sm: 16 };

export function Button({
  children,
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  loading = false,
  inactive = false,
  onInactivePress,
  href,
  className,
  onClick,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  const classes = cx(styles.button, styles[variant], styles[size], fullWidth && styles.full, className);
  const content = (
    <>
      {loading ? <Spinner size={ICON_SIZE[size]} /> : leadingIcon && <Icon name={leadingIcon} size={ICON_SIZE[size]} />}
      <span className={styles.label}>{children}</span>
      {trailingIcon && <Icon name={trailingIcon} size={ICON_SIZE[size]} />}
    </>
  );
  if (href && !inactive && !disabled) {
    return (
      <Link href={href} className={classes} data-variant={variant}>
        {content}
      </Link>
    );
  }
  return (
    <button
      {...rest}
      type={type}
      className={classes}
      data-variant={variant}
      data-inactive={inactive || undefined}
      aria-disabled={inactive || undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      onClick={(event) => {
        if (inactive) {
          event.preventDefault();
          onInactivePress?.();
          return;
        }
        onClick?.(event);
      }}
    >
      {content}
    </button>
  );
}
