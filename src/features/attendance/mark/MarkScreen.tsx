'use client';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/icons/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { AppHeader } from '@/features/shell/AppHeader';
import { LEAVE_TYPES } from '@/domain/status';
import { useI18n } from '@/hooks/i18n';
import { useSession } from '@/hooks/session';
import { addDays, toLocalDate } from '@/lib/time';
import { batchTitle, closingSoon } from '../../common/labels';
import { useSessionLabel } from '../useSessionLabel';
import { RosterSummary } from './RosterSummary';
import { StudentRow, type RowLabels } from './StudentRow';
import { useRoster } from './useRoster';
import styles from './Mark.module.css';
import { useAttendanceRoot } from '../useAttendanceRoot';

/** The screen instructors use every day (PRD §9): tap the exceptions, review, submit. */
export function MarkScreen() {
  const { t, format } = useI18n();
  const root = useAttendanceRoot();
  const ctx = useSession();
  const label = useSessionLabel();
  const key = useSearchParams().get('s') ?? '';
  const { roster, marks, counts, issues, attention, onStatus, onDetail, goToReview } = useRoster(key);
  const m = ctx.journey.marking;

  const labels = useMemo<RowLabels>(
    () => ({
      status: { present: t('status.present'), absent: t('status.absent'), half_day: t('status.half_day'), leave: t('status.leave'), ojt: t('status.ojt') },
      father: (name) => t('roster.father', { name }),
      presentFor: t('roster.presentFor'),
      firstHalf: t('status.firstHalf'),
      secondHalf: t('status.secondHalf'),
      leaveType: t('roster.leaveType'),
      leaveTypes: { sick: t('status.sick'), casual: t('status.casual'), medical: t('status.medical') },
      leaveUntil: t('roster.leaveUntil'),
      ojtNote: t('roster.ojtNote'),
      notMarked: t('status.not_marked'),
      needsHalf: t('roster.needsHalf'),
      needsLeaveType: t('roster.needsLeaveType'),
      groupLabel: (name) => t('roster.statusFor', { name }),
    }),
    [t],
  );

  if (!roster) {
    return (
      <ScreenLayout area={root.area} width="reading" header={<AppHeader back="back" title={t('common.loading')} backHref={root.href} />}>
        <Skeleton variant="rows" count={6} label={t('common.loading')} />
      </ScreenLayout>
    );
  }

  const card = roster.card;
  const name = label(card);
  const w = card.scheduled.window;
  const range = w ? t('session.windowRange', { start: format.clockTime(card.address.date, w.start), end: format.clockTime(card.address.date, w.end) }) : null;
  // Daily marks show the date (as the prototype); periods and halves show their slot and window.
  // Daily marks under a time fence also say when the window closes: a closed, unsubmitted batch can't be recovered.
  const closes = card.scheduled.slot.kind === 'daily' && w ? t('roster.closesAt', { time: format.clockTime(card.address.date, w.end) }) : null;
  const meta = card.scheduled.slot.kind === 'daily' ? [name.meta, format.longDate(card.address.date), closes].filter(Boolean).join(' · ') : [name.meta, range].filter(Boolean).join(' · ');
  const soon = closingSoon(card, ctx.clock.now());
  const defaultStatus = m.defaultStatus === 'blank' ? null : m.defaultStatus;
  const hint = m.defaultStatus === 'present' ? t('roster.hintPresent') : m.defaultStatus === 'absent' ? t('roster.hintAbsent') : t('roster.hintBlank');
  const issue = issues[0];
  const blockMsg = !issue
    ? null
    : issue.kind === 'unmarked'
      ? t('roster.blockUnmarked', { count: issue.studentIds.length })
      : issue.kind === 'half'
        ? t('roster.blockHalf', { count: issue.studentIds.length })
        : t('roster.blockLeave', { count: issue.studentIds.length });
  const leaveRange = m.leaveDateRange ? { min: card.address.date, max: addDays(card.address.date, 30) } : null;
  const incomplete = new Set(issues.flatMap((i) => i.studentIds));

  return (
    <ScreenLayout
      area={root.area}
      width="reading"
      surface="raised"
      padding="none"
      header={<AppHeader back="back" title={card.trade.name} subtitle={batchTitle(t, card.batch)} backHref={root.href} />}
      top={<RosterSummary meta={meta} counts={counts} closingAt={soon ? format.clockTime(card.address.date, soon) : undefined} staleSince={roster.packStale && roster.packDownloadedAt ? format.dayMonth(toLocalDate(new Date(roster.packDownloadedAt))) : undefined} />}
      footer={
        <>
          {blockMsg && (
            <p className={styles.block} id="roster-block">
              <Icon name="info" size={14} />
              {blockMsg}
            </p>
          )}
          <Button fullWidth inactive={Boolean(blockMsg)} onInactivePress={goToReview} onClick={goToReview} aria-describedby={blockMsg ? 'roster-block' : undefined}>
            {t('roster.reviewSubmit')}
          </Button>
        </>
      }
    >
      <p className={styles.hint}>{hint}</p>
      <ol className={styles.list} aria-label={name.title}>
        {roster.students.map((student) => (
          <StudentRow
            key={student.id}
            student={student}
            mark={marks[student.id] ?? { status: null }}
            selectable={m.selectable}
            defaultStatus={defaultStatus}
            halfDayHalves={m.halfDayHalves}
            leaveTypes={LEAVE_TYPES}
            leaveRange={leaveRange}
            attention={attention && incomplete.has(student.id)}
            labels={labels}
            onStatus={onStatus}
            onDetail={onDetail}
          />
        ))}
      </ol>
      <p className="visually-hidden" aria-live="polite">
        {t('roster.totalsLive', { present: counts.present, absent: counts.absent, total: counts.total })}
      </p>
    </ScreenLayout>
  );
}
