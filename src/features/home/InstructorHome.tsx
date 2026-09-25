'use client';
import { Section } from '@/components/ui/Section';
import { AppBottomNav } from '@/components/shell/AppBottomNav';
import { HomeHeader } from '@/components/shell/Headers';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { useI18n } from '@/hooks/i18n';
import { useSession } from '@/hooks/session';
import { toLocalDate } from '@/lib/time';
import { AttendanceBoard } from '../attendance/AttendanceBoard';
import { Greeting, MyAttendanceCard, OpenAccessCard, PendingSyncCard, SubmittedToday, TradeOverviewCard } from './parts';
import { roleLine } from './roleLine';

/** Instructor home: greeting, today's classes (shape set by the mapping model), my attendance, submitted today. */
export function InstructorHome() {
  const { t, format } = useI18n();
  const ctx = useSession();
  const j = ctx.journey;
  const today = toLocalDate(ctx.clock.now());
  const subject = ctx.data.subjects.find((s) => s.id === ctx.access.subjectId);

  const access = (() => {
    switch (j.selection) {
      case 'trade_picker':
        return (
          <Section id="today" title={t('home.todays')}>
            <OpenAccessCard />
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
    <ScreenLayout header={<HomeHeader instituteName={ctx.institute.shortName} userName={ctx.user.name} />} nav={<AppBottomNav active="home" />}>
      <Greeting subtitle={t('common.dateRole', { date: format.longDate(today), role: roleLine(t, ctx) })} />
      <PendingSyncCard />
      {access}
      {j.tradeWideView && <TradeOverviewCard />}
      {j.staff.selfCard && <MyAttendanceCard />}
      <SubmittedToday />
    </ScreenLayout>
  );
}
