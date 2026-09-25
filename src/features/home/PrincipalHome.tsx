'use client';
import { Button } from '@/components/ui/Button';
import { PressableCard } from '@/components/ui/Card';
import { Icon } from '@/components/ui/icons/Icon';
import { IconTile } from '@/components/ui/IconWell';
import { Latin } from '@/components/ui/Latin';
import { List, ListRow } from '@/components/ui/ListRow';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { AppBottomNav } from '@/components/shell/AppBottomNav';
import { HomeHeader } from '@/components/shell/Headers';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { useI18n } from '@/hooks/i18n';
import { useSession } from '@/hooks/session';
import { routes } from '@/lib/routes';
import { toLocalDate } from '@/lib/time';
import { Greeting } from './parts';
import { usePrincipalOverview } from './usePrincipalOverview';
import styles from './PrincipalHome.module.css';

interface StatusCardProps {
  readonly title: string;
  readonly tint: 'blue' | 'green';
  readonly icon: 'clipboard-check' | 'user-check';
  readonly done: number;
  readonly total: number;
  /** "batches submitted" / "staff marked", shown after "4 of 17". */
  readonly unit: string;
  readonly note?: string;
  readonly href: string;
}

function StatusCard({ title, tint, icon, done, unit, total, note, href }: StatusCardProps) {
  const { t } = useI18n();
  const count = t('principal.countOf', { done, total });
  return (
    <PressableCard href={href}>
      <span className={styles.top}>
        <IconTile icon={icon} tint={tint} size={40} />
        <span className={styles.title}>{title}</span>
        <Icon name="chevron-right" size={20} className={styles.chevron} />
      </span>
      <span className={styles.count}>
        <span className={`${styles.big} tnum`}>{count}</span>
        <span className={styles.unit}>{unit}</span>
      </span>
      <ProgressBar value={total ? done / total : 0} label={`${count} ${unit}`} />
      {note && <span className={styles.note}>{note}</span>}
    </PressableCard>
  );
}

/** Institute overview: how much is submitted, what needs attention, and the two things a principal does. */
export function PrincipalHome() {
  const { t, format } = useI18n();
  const ctx = useSession();
  const today = toLocalDate(ctx.clock.now());
  const { data } = usePrincipalOverview();

  const sessions = data?.sessions ?? [];
  const done = sessions.filter((c) => c.status === 'submitted').length;
  const future = sessions.filter((c) => c.status === 'future');
  const nextOpen = future.map((c) => c.scheduled.window?.start).filter(Boolean).sort()[0];
  const laterShifts = new Set(future.map((c) => c.batch.shift));
  const laterNote = !future.length || !nextOpen
    ? undefined
    : laterShifts.size === 1
      ? t('principal.shiftNote', { count: future.length, shift: future[0].batch.shift, time: format.clockTime(today, nextOpen) })
      : t('principal.laterNote', { count: future.length, time: format.clockTime(today, nextOpen) });
  const missing = sessions.filter((c) => c.status === 'open' || c.status === 'closed');
  const staff = data?.staff ?? [];
  const staffMarked = staff.filter((r) => r.record).length;
  const staffMissing = staff.filter((r) => !r.record);

  return (
    <ScreenLayout header={<HomeHeader instituteName={ctx.institute.shortName} userName={ctx.user.name} />} nav={<AppBottomNav active="home" />}>
      <Greeting name={t('principal.salutation')} subtitle={t('principal.greetingSub', { date: format.longDate(today), institute: ctx.institute.shortName })} />
      <Section id="today" title={t('home.todays')}>
        {!data ? (
          <Skeleton count={2} height={140} label={t('common.loading')} />
        ) : (
          <div className={styles.cards}>
            <StatusCard
              title={t('principal.studentCard')}
              tint="blue"
              icon="clipboard-check"
              done={done}
              total={sessions.length}
              unit={t('principal.sessionsSubmitted', { count: sessions.length })}
              note={laterNote}
              href={routes.attendance}
            />
            {ctx.journey.staff.principalStaffView && (
              <StatusCard
                title={t('principal.staffCard')}
                tint="green"
                icon="user-check"
                done={staffMarked}
                total={staff.length}
                unit={t('principal.staffMarked')}
                href={routes.staff}
              />
            )}
          </div>
        )}
      </Section>
      {data && (missing.length > 0 || staffMissing.length > 0) && (
        <Section id="attention" title={t('principal.needsAttention')}>
          <List>
            {missing.length > 0 && (
              <ListRow
                href={routes.attendance}
                leading={<Icon name="alert" size={20} className={styles.warn} />}
                title={t('principal.notSubmitted', { count: missing.length })}
                subtitle={
                  <Latin>
                    {missing.slice(0, 2).map((c, i) => (
                      <span key={c.key}>
                        {i > 0 && ', '}
                        <span className={styles.nowrap}>{t('session.batchInList', { trade: c.trade.name, shift: c.batch.shift, unit: c.batch.unit })}</span>
                      </span>
                    ))}
                    {missing.length > 2 ? '…' : ''}
                  </Latin>
                }
                trailing="chevron"
                minHeight={56}
              />
            )}
            {staffMissing.length > 0 && (
              <ListRow
                href={routes.staff}
                leading={<Icon name="alert" size={20} className={styles.warn} />}
                title={t('principal.staffNotMarked', { count: staffMissing.length })}
                subtitle={<Latin>{staffMissing.map((r) => r.member.name).join(', ')}</Latin>}
                trailing="chevron"
                minHeight={56}
              />
            )}
          </List>
        </Section>
      )}
      <div className={styles.actions}>
        <Button fullWidth href={routes.attendance}>
          {t('principal.viewStudents')}
        </Button>
        {ctx.journey.staff.principalCanMark && (
          <Button variant="secondary" fullWidth href={routes.staff}>
            {t('principal.markStaff')}
          </Button>
        )}
      </div>
    </ScreenLayout>
  );
}
