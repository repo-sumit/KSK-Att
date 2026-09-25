'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { DetailRows } from '@/components/ui/DetailRows';
import { Icon } from '@/components/ui/icons/Icon';
import { Latin } from '@/components/ui/Latin';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTiles } from '@/components/ui/StatTiles';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import { AppBottomNav } from '@/components/shell/AppBottomNav';
import { InnerHeader } from '@/components/shell/Headers';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import type { StatusCode } from '@/domain/status';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { cx } from '@/lib/cx';
import { routes } from '@/lib/routes';
import type { StaffDayRow } from '@/services/staff-attendance';
import { ViewSwitch } from '../attendance/AttendanceTabScreen';
import styles from './Staff.module.css';

/** PRD §18.3: every instructor plus the principal; self-marked rows are locked, the principal fills gaps. */
export function StaffScreen() {
  const { t, format } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const ctx = useSession();
  const { staffAttendance } = useServices();
  const { data: rows } = useQuery(`staff-day:${ctx.institute.id}`, () => staffAttendance.day(ctx), ['staff']);
  const [draft, setDraft] = useState<Record<string, StatusCode>>({});
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  /** A pending view switch waiting for "Discard unsaved changes?". */
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  const allowed = ctx.journey.staff.principalStaffView;

  useEffect(() => {
    if (!allowed) router.replace(routes.attendance);
  }, [allowed, router]);
  if (!allowed) return null;

  const roleOf = (r: StaffDayRow) => {
    const trade = ctx.data.trades.find((x) => x.id === r.member.primaryTradeId)?.name ?? ctx.data.subjects.find((s) => s.id === r.member.subjectId)?.name;
    const role = t(`role.${r.member.role}`);
    return trade ? t('role.withTrade', { role, trade }) : role;
  };
  const list = [...(rows ?? [])].sort((a, b) => Number(Boolean(a.record)) - Number(Boolean(b.record)));
  const present = list.filter((r) => r.record?.status === 'present').length;
  const unmarked = list.filter((r) => !r.record).length;
  const changes = Object.keys(draft).length;
  const canMark = ctx.journey.staff.principalCanMark;
  const statuses = ctx.journey.staff.statusSet;

  const save = async () => {
    setBusy(true);
    const result = await staffAttendance.markByPrincipal(ctx, Object.entries(draft).map(([staffId, status]) => ({ staffId, status })));
    setBusy(false);
    setSheet(false);
    // A failed save keeps every choice so the principal can simply try again.
    if (!result.ok) return toast.show(t('staff.saveFailed'));
    setDraft({});
    const { saved, skipped } = result.value;
    toast.show(skipped.length ? t('staff.savedPartial', { saved, skipped: skipped.length }) : t('staff.saved'));
  };
  const nameOf = (staffId: string) => ctx.data.staff.find((s) => s.id === staffId)?.name ?? staffId;
  const draftNames = (status: StatusCode) =>
    Object.entries(draft)
      .filter(([, s]) => s === status)
      .map(([id]) => nameOf(id));

  return (
    <ScreenLayout
      surface="raised"
      padding="none"
      header={<InnerHeader title={t('nav.attendance')} back={false} />}
      top={
        <div className={styles.top}>
          <ViewSwitch value="staff" onSwitch={(go) => (changes > 0 ? setLeaving(() => go) : go())} />
          <StatTiles
            size="md"
            surface="plain"
            tiles={[
              { key: 'staff', label: t('staff.tileStaff'), value: String(list.length), tone: 'neutral' },
              { key: 'present', label: t('status.present'), value: String(present), tone: 'success', icon: 'check' },
              { key: 'unmarked', label: t('status.not_marked'), value: String(unmarked), tone: 'warning', icon: 'circle' },
            ]}
          />
        </div>
      }
      footer={
        changes > 0 ? (
          <Button fullWidth onClick={() => setSheet(true)}>
            {t('staff.save', { count: changes })}
          </Button>
        ) : undefined
      }
      nav={changes > 0 ? undefined : <AppBottomNav active="attendance" />}
    >
      {!rows ? (
        <Skeleton label={t('common.loading')} />
      ) : (
        <ul>
          {list.map((row) => {
            const rec = row.record;
            const choice = draft[row.member.id];
            const shown = rec?.status ?? choice;
            return (
              <li key={row.member.id} className={styles.row}>
                <div className={styles.main}>
                  <Avatar name={row.member.name} size={40} />
                  <span className={styles.who}>
                    <span className={styles.name}>
                      <Latin>{row.member.id === ctx.user.id ? t('staff.you', { name: row.member.name }) : row.member.name}</Latin>
                    </span>
                    <span className={styles.role}><Latin>{roleOf(row)}</Latin></span>
                  </span>
                  <span className={styles.status}>
                    <span className={cx(styles.statusLine, shown === 'present' ? styles.ok : shown === 'absent' ? styles.bad : styles.warn)}>
                      <Icon name={shown === 'present' ? 'check' : shown === 'absent' ? 'x' : 'circle'} size={14} strokeWidth={2.5} />
                      {shown ? t(`status.${shown}`) : t('status.not_marked')}
                    </span>
                    {rec ? (
                      <span className={styles.how}>{rec.source === 'self' ? t('staff.selfVerified', { time: format.time(rec.deviceTimestamp) }) : t('staff.byPrincipal')}</span>
                    ) : (
                      choice && <span className={styles.how}>{t('staff.notSaved')}</span>
                    )}
                  </span>
                </div>
                {!rec && canMark && (
                  <div className={styles.pills} role="group" aria-label={row.member.name}>
                    {statuses.map((s) => (
                      <StatusPill key={s} status={s} label={t(`status.${s}`)} pressed={choice === s} stretch onPress={() => setDraft((d) => ({ ...d, [row.member.id]: s }))} />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={t('staff.sheetTitle')}
        description={t('staff.sheetBody')}
        actions={
          <>
            <Button fullWidth loading={busy} onClick={() => void save()}>{t('staff.save', { count: changes })}</Button>
            <Button variant="secondary" fullWidth disabled={busy} onClick={() => setSheet(false)}>{t('common.cancel')}</Button>
          </>
        }
      >
        <DetailRows
          variant="hero"
          emphasis
          rows={statuses.map((s) => ({ key: s, label: t(`status.${s}`), value: String(Object.values(draft).filter((v) => v === s).length), tone: s === 'present' ? 'success' : s === 'absent' ? 'error' : undefined }))}
        />
        {/* Name the people being marked Absent: the save can't be undone today. */}
        {draftNames('absent').length > 0 && (
          <p className={styles.names}>
            {t('staff.absentNames')} <Latin>{draftNames('absent').join(', ')}</Latin>
          </p>
        )}
      </BottomSheet>
      <BottomSheet
        open={Boolean(leaving)}
        onClose={() => setLeaving(null)}
        title={t('staff.discardTitle', { count: changes })}
        description={t('staff.discardBody')}
        actions={
          <>
            <Button fullWidth onClick={() => setLeaving(null)}>{t('staff.keepEditing')}</Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                const go = leaving;
                setLeaving(null);
                setDraft({});
                go?.();
              }}
            >
              {t('staff.discard')}
            </Button>
          </>
        }
      />
    </ScreenLayout>
  );
}
