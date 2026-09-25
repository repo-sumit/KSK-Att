'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DetailRows } from '@/components/ui/DetailRows';
import { Icon, type IconName } from '@/components/ui/icons/Icon';
import { Latin } from '@/components/ui/Latin';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { InnerHeader } from '@/components/shell/Headers';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { countMarks } from '@/domain/marking';
import type { Mark, StatusCode } from '@/domain/status';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { cx } from '@/lib/cx';
import { routes } from '@/lib/routes';
import type { MessageKey } from '@/i18n';
import { batchTitle, closingSoon, markLabel } from '../../common/labels';
import { RosterSummary } from '../mark/RosterSummary';
import { useSessionLabel } from '../useSessionLabel';
import styles from './Review.module.css';

const GROUPS: ReadonlyArray<{ status: StatusCode; title: MessageKey; icon: IconName; tone: string }> = [
  { status: 'absent', title: 'review.absent', icon: 'x', tone: styles.error },
  { status: 'half_day', title: 'review.halfDay', icon: 'half', tone: styles.warning },
  { status: 'leave', title: 'review.leave', icon: 'calendar', tone: styles.info },
  { status: 'ojt', title: 'review.ojt', icon: 'briefcase', tone: styles.brand },
];

/** Last check before the irreversible submit (PRD §12.1): the exceptions, then a confirmation with the counts. */
export function ReviewScreen() {
  const { t, format } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const ctx = useSession();
  const { attendance } = useServices();
  const label = useSessionLabel();
  const key = useSearchParams().get('s') ?? '';
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery(`review:${key}`, () => attendance.openRoster(ctx, key), []);
  const redirect = data && !data.ok ? (data.error === 'already_submitted' ? routes.record(key) : routes.open(key)) : null;
  useEffect(() => {
    if (redirect && !busy) router.replace(redirect);
  }, [redirect, busy, router]);

  if (!data) return <ScreenLayout header={<InnerHeader title={t('review.title')} />}><Skeleton label={t('common.loading')} /></ScreenLayout>;
  if (!data.ok) return null;

  const { card, students, marks } = data.value;
  const counts = countMarks(marks);
  const name = label(card);
  const meta = [name.meta, format.longDate(card.address.date)].filter(Boolean).join(' · ');

  const submit = async () => {
    setBusy(true);
    const result = await attendance.submit(ctx, key, marks);
    setBusy(false);
    setSheet(false);
    if (result.ok) return router.replace(routes.submitted(key));
    if (result.error === 'already_submitted') return router.replace(routes.record(key));
    if (result.error === 'window_closed') toast.show(t('roster.windowClosedToast'));
    router.replace(routes.open(key));
  };

  const rowsFor = (status: StatusCode) => students.filter((s) => marks[s.id]?.status === status);
  const exceptions = GROUPS.map((g) => ({ ...g, students: rowsFor(g.status) })).filter((g) => g.students.length > 0);
  const soon = closingSoon(card, ctx.clock.now());
  const sheetRows = [
    { key: 'present', label: <><Icon name="check" size={16} strokeWidth={2.5} />{t('status.present')}</>, value: String(counts.present), tone: 'success' as const },
    { key: 'absent', label: <><Icon name="x" size={16} strokeWidth={2.5} />{t('status.absent')}</>, value: String(counts.absent), tone: 'error' as const },
    ...(counts.half_day ? [{ key: 'half', label: <><Icon name="half" size={16} strokeWidth={2.5} />{t('status.half_day')}</>, value: String(counts.half_day), tone: 'warning' as const }] : []),
    ...(counts.leave ? [{ key: 'leave', label: <><Icon name="calendar" size={16} strokeWidth={2.5} />{t('status.leave')}</>, value: String(counts.leave), tone: 'info' as const }] : []),
    ...(counts.ojt ? [{ key: 'ojt', label: <><Icon name="briefcase" size={16} strokeWidth={2.5} />{t('status.ojt')}</>, value: String(counts.ojt) }] : []),
  ];

  return (
    <ScreenLayout
      header={<InnerHeader title={t('review.title')} backHref={routes.mark(key)} />}
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
        <Card>
          <span className={styles.batch}>
            <span className={styles.trade}>
              <Latin>{card.trade.name}</Latin>
            </span>
            <span className={styles.batchTitle}>{batchTitle(t, card.batch)}</span>
            <span className={styles.meta}>{meta}</span>
          </span>
        </Card>
        <RosterSummary counts={counts} surface="raised" variant="plain" />
        {soon && (
          <Banner tone="warning" icon="clock" live>
            {t('roster.closingSoon', { time: format.clockTime(card.address.date, soon) })}
          </Banner>
        )}
      </div>
      {exceptions.length === 0 ? (
        <p className={styles.allPresent}>{t('review.allPresent')}</p>
      ) : (
        exceptions.map((group) => (
          <section key={group.status} className={styles.group} aria-label={t(group.title, { count: group.students.length })}>
            <h2 className={cx(styles.groupTitle, group.tone)}>
              <Icon name={group.icon} size={16} strokeWidth={2.5} />
              {t(group.title, { count: group.students.length })}
            </h2>
            <ul>
              {group.students.map((s) => (
                <li key={s.id} className={styles.item}>
                  <span className={cx(styles.roll, 'tnum')}>{s.rollNo}</span>
                  <span className={styles.who}>
                    <span className={styles.name}>
                      <Latin>{s.name}</Latin>
                    </span>
                    <span className={styles.sub}>{group.status === 'absent' ? t('roster.father', { name: s.fatherName }) : markLabel(t, marks[s.id] as Mark)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={t('review.sheetTitle')}
        description={t('review.sheetBody')}
        actions={
          <>
            <Button fullWidth onClick={submit} loading={busy}>
              {t('review.sheetCta')}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setSheet(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
          </>
        }
      >
        <DetailRows variant="hero" emphasis rows={sheetRows} />
      </BottomSheet>
    </ScreenLayout>
  );
}
