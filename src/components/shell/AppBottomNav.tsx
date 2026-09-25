'use client';
import { BottomNav, type NavItem } from '@/components/ui/BottomNav';
import type { NavTab } from '@/config/journey';
import { useT } from '@/hooks/i18n';
import { useJourney } from '@/hooks/session';
import { routes } from '@/lib/routes';
import type { IconName } from '@/components/ui/icons/Icon';

const TABS: Record<NavTab, { icon: IconName; href: string; key: 'nav.home' | 'nav.attendance' | 'nav.reports' | 'nav.profile' }> = {
  home: { icon: 'house', href: routes.home, key: 'nav.home' },
  attendance: { icon: 'clipboard-check', href: routes.attendance, key: 'nav.attendance' },
  reports: { icon: 'chart', href: routes.reports, key: 'nav.reports' },
  profile: { icon: 'user', href: routes.profile, key: 'nav.profile' },
};

/** Tabs come from the journey: Reports disappears when reports are disabled. */
export function AppBottomNav({ active }: { readonly active: NavTab }) {
  const t = useT();
  const journey = useJourney();
  const items: NavItem[] = journey.navTabs.map((id) => ({ id, label: t(TABS[id].key), icon: TABS[id].icon, href: TABS[id].href }));
  return <BottomNav items={items} activeId={active} label={t('nav.label')} />;
}
