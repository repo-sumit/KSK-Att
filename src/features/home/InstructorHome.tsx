'use client';
import { Section } from '@/components/ui/Section';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { AppHeader } from '@/features/shell/AppHeader';
import { useI18n } from '@/hooks/i18n';
import { useSession } from '@/hooks/session';
import { cx } from '@/lib/cx';
import { toLocalDate } from '@/lib/time';
import { AnnouncementBanner } from '../announcements/AnnouncementBanner';
import { AttendanceBoard } from '../attendance/AttendanceBoard';
import { Greeting, MyAttendanceCard, PendingSyncCard, SubmittedToday, TradeOverviewCard } from './parts';
import { roleLine } from './roleLine';
import styles from './Home.module.css';

/**
 * Instructor home = "what do I need to do today?" (D-052): notices, today's
 * classes (shape set by the mapping model), my attendance, submitted today.
 * Past attendance lives in Reports.
 */
export function InstructorHome() {
  const { t, format } = useI18n();
  const ctx = useSession();
  const j = ctx.journey;
  const today = toLocalDate(ctx.clock.now());
  const subject = ctx.data.subjects.find((s) => s.id === ctx.access.subjectId);

  const access = (() => {
    switch (j.selection) {
      case 'trade_picker':
        // Open mapping: any trade, then a batch. The trades are right here, one tap from marking.
        return (
          <Section id="today" title={t('home.todays')} subtitle={t('home.chooseTrade')}>
            <AttendanceBoard />
          </Section>
        );
      case 'timetable':
        return (
          <Section id="today" title={t('home.timetable')} subtitle={format.longDate(today)}>
            <AttendanceBoard />
          </Section>
        );
      default:
        return (
          <Section
            id="today"
            title={t('home.yourBatches')}
            subtitle={subject ? t('home.subjectSub', { subject: subject.name, count: ctx.access.batchIds.size, trades: ctx.access.tradeIds.length }) : undefined}
          >
            <AttendanceBoard />
          </Section>
        );
    }
  })();

  return (
    <ScreenLayout header={<AppHeader />} area="home" bottomNav>
      <Greeting subtitle={t('common.dateRole', { date: format.longDate(today), role: roleLine(t, ctx) })} />
      <AnnouncementBanner />
      <PendingSyncCard />
      {access}
      {/* Wide screens: two things side by side (one column on phones), never a lone half-width card. */}
      {j.tradeWideView && j.staff.selfCard ? (
        <>
          <div className={styles.pair}>
            <TradeOverviewCard />
            <MyAttendanceCard />
          </div>
          <SubmittedToday />
        </>
      ) : (
        <div className={cx(styles.pair, styles.loose)}>
          {j.tradeWideView && <TradeOverviewCard />}
          {j.staff.selfCard && <MyAttendanceCard />}
          <SubmittedToday />
        </div>
      )}
    </ScreenLayout>
  );
}
