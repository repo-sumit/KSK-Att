'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/icons/Icon';
import { Latin } from '@/components/ui/Latin';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { AppHeader } from '@/features/shell/AppHeader';
import { parseSessionKey, toSessionKey } from '@/domain/attendance';
import { countMarks } from '@/domain/marking';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { cx } from '@/lib/cx';
import { routes } from '@/lib/routes';
import { addDays, toLocalDate } from '@/lib/time';
import { batchTitle, batchWithTrade, markLabel, statusOf } from '../../common/labels';
import { RosterSummary } from '../mark/RosterSummary';
import { useSessionLabel } from '../useSessionLabel';
import styles from './Record.module.css';
import { useAttendanceRoot } from '../useAttendanceRoot';

/**
 * Read-only record of a submitted session. Instructors see the lock; the
 * principal can switch Today/Yesterday and tap a student to correct today's
 * record (only once it has synced).
 */
export function RecordScreen() {
  const { t, format } = useI18n();
  const root = useAttendanceRoot();
  const router = useRouter();
  const ctx = useSession();
  const { attendance } = useServices();
  const label = useSessionLabel();
  const key = useSearchParams().get('s') ?? '';
  const address = parseSessionKey(key);
  const today = toLocalDate(ctx.clock.now());
  const { data: detail, loading } = useQuery(`record:${key}`, () => attendance.getDetail(ctx, key), ['attendance', 'corrections', 'offline']);
  const { data: card } = useQuery(`record-card:${key}`, () => attendance.findCard(ctx, key), ['attendance']);

  const isToday = address?.date === today;
  const canCorrect = ctx.journey.corrections && isToday;
  const dailySlot = address?.slot.kind === 'daily';
  const dayKey = (day: 'today' | 'yesterday') => (address ? toSessionKey({ ...address, date: day === 'today' ? today : addDays(today, -1) }) : key);
  const batch = ctx.data.batches.find((b) => b.id === address?.batchId);
  const trade = ctx.data.trades.find((x) => x.id === batch?.tradeId);

  const header = <AppHeader back="back" title={trade?.name ?? t('common.loading')} subtitle={batch ? batchTitle(t, batch) : undefined} backHref={root.href} />;
  const daySwitch =
    ctx.journey.corrections && dailySlot ? (
      <Segmented
        label={t('record.sessions')}
        size="sm"
        fullWidth
        value={isToday ? 'today' : 'yesterday'}
        onChange={(d) => router.replace(routes.record(dayKey(d)))}
        options={[
          { value: 'today', label: t('common.today') },
          { value: 'yesterday', label: t('common.yesterday') },
        ]}
      />
    ) : null;

  if (loading && !detail) return <ScreenLayout area={root.area} width="reading" header={header}><Skeleton variant="rows" count={6} label={t('common.loading')} /></ScreenLayout>;

  const submission = detail?.submission;
  if (!detail || !submission) {
    // A past day with nothing submitted has no card: name the batch itself.
    const session = card ? [label(card).title, label(card).meta].filter(Boolean).join(' · ') : batch && trade ? batchWithTrade(t, trade, batch) : '';
    return (
      <ScreenLayout area={root.area} width="reading" header={header} top={daySwitch ? <div className={styles.top}>{daySwitch}</div> : undefined}>
        <EmptyState
          icon="clipboard-check"
          title={t('record.notSubmittedTitle')}
          body={isToday ? t('record.notSubmittedBody', { session }) : t('record.notSubmittedPast', { session, date: format.dayMonth(address?.date ?? today) })}
          action={
            card?.canMark ? (
              <Button size="md" href={routes.open(key)}>
                {t('home.markAttendance')}
              </Button>
            ) : undefined
          }
        />
      </ScreenLayout>
    );
  }

  const pending = submission.syncState !== 'synced';
  const by = ctx.data.staff.find((s) => s.id === submission.markedBy)?.name ?? '';
  const time = format.time(submission.deviceTimestamp);
  const status = pending ? t('record.pending') : !isToday ? t('record.submittedOn', { date: format.dayMonth(submission.address.date), time, name: by }) : ctx.journey.corrections ? t('record.submittedBy', { time, name: by }) : t('record.submitted', { time });
  const note = pending && ctx.journey.corrections ? t('record.notePending') : !ctx.journey.corrections ? t('record.noteInstructor') : isToday ? t('record.notePrincipalToday') : t('record.notePrincipalPast');
  const counts = countMarks(detail.marks);

  return (
    <ScreenLayout
      area={root.area}
      width="reading"
      surface="raised"
      padding="none"
      header={header}
      top={
        <div className={styles.top}>
          {daySwitch}
          <Banner layout="strip" tone={pending ? 'warning' : 'success'} icon={pending ? 'cloud-upload' : 'lock'}>
            <Latin>{status}</Latin>
          </Banner>
          <RosterSummary counts={counts} size="md" variant="plain" />
          <p className={styles.note}>
            <Icon name="info" size={16} />
            {note}
          </p>
        </div>
      }
    >
      <ol className={styles.list}>
        {detail.students.map((student) => {
          const mark = detail.marks[student.id];
          const correctable = canCorrect && !pending && mark?.status !== 'ojt';
          const content = (
            <>
              <span className={cx(styles.roll, 'tnum')}>{student.rollNo}</span>
              <span className={styles.who}>
                <span className={styles.name}>
                  <Latin>{student.name}</Latin>
                </span>
                <span className={styles.father}>{t('roster.father', { name: student.fatherName })}</span>
                {isToday && detail.correctedStudentIds.has(student.id) && (
                  <span className={styles.corrected}>
                    <Icon name="history" size={12} />
                    {t('record.corrected')}
                  </span>
                )}
              </span>
              <StatusChip status={statusOf(mark)} label={markLabel(t, mark)} />
              {correctable && (
                <span className={styles.pencil} aria-hidden="true">
                  <Icon name="pencil" size={16} />
                </span>
              )}
            </>
          );
          return (
            <li key={student.id} className={styles.itemWrap}>
              {correctable ? (
                <Link href={routes.correct(key, student.id)} className={styles.item}>
                  {content}
                </Link>
              ) : (
                <div className={styles.item}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </ScreenLayout>
  );
}
