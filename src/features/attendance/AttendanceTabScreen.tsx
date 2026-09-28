'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { AppHeader } from '@/features/shell/AppHeader';
import { useI18n } from '@/hooks/i18n';
import { useSession } from '@/hooks/session';
import { routes } from '@/lib/routes';
import { AttendanceBoard } from './AttendanceBoard';
import styles from './AttendanceTab.module.css';

/** Students / Staff switch for the institute view (only when staff attendance is on). */
/** `onSwitch` lets a screen intercept the change (e.g. to protect unsaved staff marks). */
export function ViewSwitch({ value, onSwitch }: { readonly value: 'students' | 'staff'; readonly onSwitch?: (go: () => void) => void }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Segmented
      label={t('principal.view')}
      fullWidth
      value={value}
      onChange={(v) => {
        const go = () => router.replace(v === 'staff' ? routes.staff : routes.attendance);
        if (onSwitch) onSwitch(go);
        else go();
      }}
      options={[
        { value: 'students', label: t('principal.students') },
        { value: 'staff', label: t('principal.staff') },
      ]}
    />
  );
}

/**
 * The Attendance tab exists only where it adds a view Home doesn't have: the
 * principal's institute board with the Students / Staff switch (D-052). For
 * everyone else Home owns today's classes, so an old /attendance link goes there.
 */
export function AttendanceTabScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const ctx = useSession();
  const j = ctx.journey;
  const exists = j.navTabs.includes('attendance');
  useEffect(() => {
    if (!exists) router.replace(routes.home);
  }, [exists, router]);
  if (!exists) return null;

  return (
    <ScreenLayout
      header={<AppHeader title={t('nav.attendance')} />}
      top={j.staff.principalStaffView ? <div className={styles.switch}><ViewSwitch value="students" /></div> : undefined}
      area="attendance"
      bottomNav
    >
      <AttendanceBoard />
    </ScreenLayout>
  );
}
