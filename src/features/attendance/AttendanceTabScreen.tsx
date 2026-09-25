'use client';
import { useRouter } from 'next/navigation';
import { Section } from '@/components/ui/Section';
import { Segmented } from '@/components/ui/Segmented';
import { AppBottomNav } from '@/components/shell/AppBottomNav';
import { InnerHeader } from '@/components/shell/Headers';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { useI18n } from '@/hooks/i18n';
import { useSession } from '@/hooks/session';
import { routes } from '@/lib/routes';
import { toLocalDate } from '@/lib/time';
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

export function AttendanceTabScreen() {
  const { t, format } = useI18n();
  const ctx = useSession();
  const j = ctx.journey;
  const title =
    j.selection === 'trade_picker' ? t('selection.selectTrade') : j.selection === 'timetable' ? t('home.timetable') : j.selection === 'institute' ? null : t('home.yourBatches');
  const subtitle = j.selection === 'timetable' ? format.longDate(toLocalDate(ctx.clock.now())) : undefined;

  return (
    <ScreenLayout
      header={<InnerHeader title={t('nav.attendance')} back={false} />}
      top={j.staff.principalStaffView ? <div className={styles.switch}><ViewSwitch value="students" /></div> : undefined}
      nav={<AppBottomNav active="attendance" />}
    >
      {title ? (
        <Section id="classes" title={title} subtitle={subtitle}>
          <AttendanceBoard />
        </Section>
      ) : (
        <AttendanceBoard />
      )}
    </ScreenLayout>
  );
}
