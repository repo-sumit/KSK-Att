'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AttendanceSummary, summaryItems } from '@/components/ui/AttendanceSummary';
import { Banner } from '@/components/ui/Banner';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DetailRows } from '@/components/ui/DetailRows';
import { Icon } from '@/components/ui/icons/Icon';
import { Latin } from '@/components/ui/Latin';
import { Skeleton } from '@/components/ui/Skeleton';
import { statusIcon, statusTone } from '@/components/ui/status-style';
import { useToast } from '@/components/ui/Toast';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { AppHeader } from '@/features/shell/AppHeader';
import { contributesToPresent, countMarks, effectivePresent, presentTerms, summaryStatuses } from '@/domain/marking';
import type { Mark, StatusCode } from '@/domain/status';
import type { Student } from '@/domain/entities';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { cx } from '@/lib/cx';
import { routes } from '@/lib/routes';
import type { MessageKey } from '@/i18n';
import { batchTitle, closingSoon, summaryLabels } from '../../common/labels';
import { useSessionLabel } from '../useSessionLabel';
import styles from './Review.module.css';
import { useAttendanceRoot } from '../useAttendanceRoot';

/** Group titles for the statuses listed as exceptions; a status added to the registry later falls back to "Name (n)". */
const GROUP_TITLES: Partial<Record<StatusCode, MessageKey>> = { absent: 'review.absent', half_day: 'review.halfDay', leave: 'review.leave', ojt: 'review.ojt' };

/** Last check before the irreversible submit (PRD §12.1): the totals, the exceptions, then a confirmation with the counts. */
export function ReviewScreen() {
  const { t, format } = useI18n();
  const root = useAttendanceRoot();
  const router = useRouter();
  const toast = useToast();
  const ctx = useSession();
  const { attendance, drafts } = useServices();
  const label = useSessionLabel();
  const key = useSearchParams().get('s') ?? '';
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const summary = useMemo(() => summaryLabels(t, format), [t, format]);
  // Review renders the live draft (D-084), so a voice change while it is open shows here too.
  const { data } = useQuery(
    `review:${key}`,
    async () => {
      const result = await attendance.openRoster(ctx, key);
      if (result.ok) drafts.open(ctx, result.value);
      else if (result.error === 'already_submitted') drafts.close(key, { kind: 'closed', via: 'system' }); // submitted elsewhere: the live draft is stale
      return result;
    },
    [],
  );
  const live = useSyncExternalStore(
    useCallback((onChange: () => void) => drafts.subscribe(key, onChange), [drafts, key]),
    () => drafts.get(key),
    () => undefined,
  );
  const redirect = data && !data.ok ? (data.error === 'already_submitted' ? routes.record(key) : routes.open(key)) : null;
  useEffect(() => {
    if (redirect && !busy) router.replace(redirect);
  }, [redirect, busy, router]);

  if (!data) return <ScreenLayout area={root.area} width="reading" header={<AppHeader back="back" title={t('review.title')} backHref={routes.mark(key)} />}><Skeleton variant="rows" count={3} label={t('common.loading')} /></ScreenLayout>;
  if (!data.ok) return null;

  const { card, students } = data.value;
  // After a submit closes the live draft, the screen keeps the roster's marks until it navigates away.
  const marks = live?.marks ?? data.value.marks;
  const counts = countMarks(marks);
  const statuses = ctx.journey.marking.statuses;
  const name = label(card);
  const meta = [name.meta, format.longDate(card.address.date)].filter(Boolean).join(' · ');

  const submit = async () => {
    setBusy(true);
    // The draft is held while it saves (until it is closed): a voice mark meanwhile is refused and told so, never
    // confirmed and then left out of the record. The submitted change carries exactly what was sent. Only a hold this
    // submit took is released (with no live draft there is none, and voice's must not end early).
    const result = await drafts.whileSubmitting(key, async (sent) => {
      const saved = await attendance.submit(ctx, key, sent?.marks ?? marks);
      if (saved.ok) drafts.close(key, { kind: 'submitted', via: 'tap', sent });
      return saved;
    });
    setBusy(false);
    setSheet(false);
    if (result.ok) return router.replace(routes.submitted(key));
    if (result.error === 'already_submitted') {
      drafts.close(key, { kind: 'closed', via: 'system' }); // submitted elsewhere: the live draft is stale
      return router.replace(routes.record(key));
    }
    if (result.error === 'window_closed') toast.show(t('roster.windowClosedToast'));
    router.replace(routes.open(key));
  };

  // Every status but Present is an exception worth a second look, in registry order.
  const exceptions = summaryStatuses(statuses, counts)
    .filter((status) => status !== 'present')
    .map((status) => ({ status, students: students.filter((s) => marks[s.id]?.status === status) }))
    .filter((g) => g.students.length > 0);
  const soon = closingSoon(card, ctx.clock.now());
  // The confirmation lists the same numbers as the summary (Present as it counts, the rest raw), never a copy that could disagree.
  const sheetRows = summaryItems(counts, statuses, summary)
    .filter((item) => item.key !== 'total' && (item.value > 0 || item.key === 'present' || item.key === 'absent'))
    .map((item) => ({
      key: item.key,
      label: (
        <>
          {item.icon && <Icon name={item.icon} size={16} strokeWidth={2.5} />}
          {item.label}
        </>
      ),
      value: format.number(item.value),
      tone: item.tone === 'neutral' ? ('default' as const) : item.tone,
    }));
  const breakdown = contributesToPresent(summaryStatuses(statuses, counts)) ? summary.breakdown({ total: effectivePresent(counts), terms: presentTerms(counts), statuses: summaryStatuses(statuses, counts) }) : null;

  /** The one thing a reviewer needs under each name: the detail of the status (the group already says which). */
  const detailOf = (student: Student, mark: Mark) => {
    if (mark.status === 'half_day' && mark.half) return t(mark.half === 1 ? 'status.firstHalf' : 'status.secondHalf');
    if (mark.status === 'leave' && mark.leaveType) {
      const type = t(`status.${mark.leaveType}`);
      return mark.leaveUntil ? t('status.withDetail', { status: type, detail: t('review.until', { date: format.dayMonth(mark.leaveUntil) }) }) : type;
    }
    return t('roster.father', { name: student.fatherName });
  };

  return (
    <ScreenLayout
      area={root.area}
      width="reading"
      footerLayout="row"
      header={<AppHeader back="back" title={t('review.title')} backHref={routes.mark(key)} />}
      footer={
        <>
          <Button fullWidth onClick={() => setSheet(true)}>
            {t('review.submit')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => router.back()}>
            {t('review.goBack')}
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        {/* What is being submitted and its totals, in one card: the batch is never hidden from the person about to submit it. */}
        <Card>
          <AttendanceSummary
            counts={counts}
            statuses={statuses}
            labels={summary}
            lead={
              <span className={styles.batch}>
                <span className={styles.trade}>
                  <Latin>{card.trade.name}</Latin>
                </span>
                <span className={styles.batchTitle}>{batchTitle(t, card.batch)}</span>
                <span className={styles.meta}>{meta}</span>
              </span>
            }
          />
        </Card>
        {soon && (
          <Banner tone="warning" icon="clock" live>
            {t('roster.closingSoon', { time: format.clockTime(card.address.date, soon) })}
          </Banner>
        )}
      </div>
      {exceptions.length === 0 ? (
        <p className={styles.allPresent}>{t('review.allPresent')}</p>
      ) : (
        exceptions.map((group) => {
          const title = GROUP_TITLES[group.status] ? t(GROUP_TITLES[group.status] as MessageKey, { count: group.students.length }) : `${summary.status[group.status]} (${group.students.length})`;
          return (
            <Card key={group.status} as="section" divided aria-label={title}>
              <h2 className={cx(styles.groupTitle, styles[statusTone(group.status)])}>
                <Icon name={statusIcon(group.status)} size={16} strokeWidth={2.5} />
                {title}
              </h2>
              <ul>
                {group.students.map((s) => (
                  <li key={s.id} className={styles.item}>
                    <span className={cx(styles.roll, 'tnum')}>{s.rollNo}</span>
                    <span className={styles.who}>
                      <span className={styles.name}>
                        <Latin>{s.name}</Latin>
                      </span>
                      <span className={styles.sub}>{detailOf(s, marks[s.id] as Mark)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}
      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={t('review.sheetTitle')}
        description={t('review.sheetBody')}
        actions={
          <>
            <Button fullWidth onClick={submit} loading={busy}>
              {busy ? t('review.submitting') : t('review.sheetCta')}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setSheet(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
          </>
        }
      >
        <DetailRows variant="hero" emphasis rows={sheetRows} />
        {breakdown && <p className={styles.breakdown}>{breakdown}</p>}
      </BottomSheet>
    </ScreenLayout>
  );
}
