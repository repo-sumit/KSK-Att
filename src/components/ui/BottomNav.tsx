'use client';
import Link from 'next/link';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './icons/Icon';
import styles from './BottomNav.module.css';

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  readonly href: string;
}

/** DS BottomNav as links; the active tab carries aria-current. */
export function BottomNav({ items, activeId, label }: { readonly items: readonly NavItem[]; readonly activeId: string; readonly label: string }) {
  return (
    <nav className={styles.nav} aria-label={label}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <Link key={item.id} href={item.href} className={cx(styles.item, active && styles.active)} aria-current={active ? 'page' : undefined}>
            <Icon name={item.icon} size={24} />
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
