'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, type MouseEvent } from 'react';
import { BottomNav, type NavItem } from '@/components/ui/BottomNav';
import { Icon, type IconName } from '@/components/ui/icons/Icon';
import type { NavTab } from '@/config/journey';
import { useT } from '@/hooks/i18n';
import { useJourney } from '@/hooks/session';
import { cx } from '@/lib/cx';
import { routes } from '@/lib/routes';
import styles from './AppNav.module.css';

const TABS: Record<NavTab, { icon: IconName; href: string; key: 'nav.home' | 'nav.attendance' | 'nav.reports' }> = {
  home: { icon: 'house', href: routes.home, key: 'nav.home' },
  attendance: { icon: 'clipboard-check', href: routes.attendance, key: 'nav.attendance' },
  reports: { icon: 'chart', href: routes.reports, key: 'nav.reports' },
};

/** A screen with unsaved work intercepts navigation (e.g. staff marks not yet saved): `go` completes it. */
export type NavigationGuard = (go: () => void) => void;
export const NavigationGuardContext = createContext<NavigationGuard | undefined>(undefined);

/** Link click handler that asks the screen's guard first. */
export function useGuardedNavigate() {
  const guard = useContext(NavigationGuardContext);
  const router = useRouter();
  return (href: string) => (event: MouseEvent) => {
    if (!guard || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    guard(() => router.push(href));
  };
}

function useItems(): NavItem[] {
  const t = useT();
  return useJourney().navTabs.map((id) => ({ id, label: t(TABS[id].key), icon: TABS[id].icon, href: TABS[id].href }));
}

/** Phones: the DS bottom navigation on tab roots. Tabs come from the journey (Reports disappears when reports are off). */
export function AppBottomNav({ active }: { readonly active: NavTab }) {
  const t = useT();
  const guarded = useGuardedNavigate();
  return <BottomNav items={useItems()} activeId={active} label={t('nav.label')} onNavigate={guarded} />;
}

/**
 * Tablets and desktops: the same destinations as a compact row in the header
 * (never a sidebar). Hidden on phones, where the bottom navigation is used.
 */
export function HeaderNav({ active }: { readonly active?: NavTab }) {
  const t = useT();
  const guarded = useGuardedNavigate();
  return (
    <nav className={styles.headerNav} aria-label={t('nav.label')}>
      {useItems().map((item) => {
        const current = item.id === active;
        return (
          <Link key={item.id} href={item.href} className={cx(styles.item, current && styles.current)} aria-current={current ? 'page' : undefined} onClick={guarded(item.href)}>
            <Icon name={item.icon} size={20} className={styles.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
