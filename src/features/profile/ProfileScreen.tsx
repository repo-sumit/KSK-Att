'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DetailRows } from '@/components/ui/DetailRows';
import { Icon } from '@/components/ui/icons/Icon';
import { Latin } from '@/components/ui/Latin';
import { designationLabel } from '../common/labels';
import { List, ListRow } from '@/components/ui/ListRow';
import { Section } from '@/components/ui/Section';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { AppBottomNav } from '@/components/shell/AppBottomNav';
import { InnerHeader } from '@/components/shell/Headers';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import type { Language } from '@/config/types';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { useSyncStatus } from '@/hooks/useSync';
import { routes } from '@/lib/routes';
import { roleLine } from '../home/roleLine';
import styles from './Profile.module.css';

const LANGUAGE_NAMES: Readonly<Record<Language, { label: string; lang: string }>> = {
  en: { label: 'English', lang: 'en' },
  mr: { label: 'मराठी', lang: 'mr' },
};

export function ProfileScreen() {
  const { t, language, setLanguage } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const ctx = useSession();
  const { auth, face, packs } = useServices();
  const sync = useSyncStatus();
  const j = ctx.journey;
  const [logout, setLogout] = useState(false);
  const { data: enrolled } = useQuery(`face:${ctx.user.id}`, () => face.isEnrolled(ctx.user.id), ['face']);
  const { data: packRows } = useQuery(`packs:${ctx.user.id}`, () => packs.list(ctx), ['packs']);

  const primaryTrade = ctx.data.trades.find((x) => x.id === ctx.user.primaryTradeId)?.name ?? '';
  const access =
    j.selection === 'institute'
      ? t('profile.accessInstitute')
      : j.selection === 'trade_picker'
        ? t('profile.accessOpen')
        : j.selection === 'timetable'
          ? t('profile.accessTimetable', { trade: primaryTrade })
          : t('profile.accessBatches', { count: ctx.access.batchIds.size, trades: ctx.access.tradeIds.length });

  return (
    <ScreenLayout header={<InnerHeader title={t('profile.title')} back={false} />} nav={<AppBottomNav active="profile" />}>
      <Card>
        <span className={styles.identity}>
          <Avatar name={ctx.user.name} size={56} />
          <span className={styles.who}>
            <span className={styles.name}><Latin>{ctx.user.name}</Latin></span>
            <span className={styles.role}>{roleLine(t, ctx)}</span>
            <span className={styles.inst}><Latin>{ctx.institute.shortName}</Latin></span>
          </span>
        </span>
      </Card>
      <Card padded={false} className={styles.details}>
        <DetailRows
          variant="list"
          rows={[
            { key: 'tid', label: t('profile.trainerId'), value: <Latin>{ctx.user.trainerId}</Latin> },
            { key: 'designation', label: t('profile.designation'), value: designationLabel(t, ctx.user.designation) ?? <Latin>{ctx.user.designation}</Latin> },
            { key: 'employment', label: t('profile.employment'), value: t(`employment.${ctx.user.employmentType}`) },
            { key: 'access', label: j.homeVariant === 'institute' ? t('profile.access') : t('profile.canMark'), value: access },
          ]}
        />
      </Card>
      <Section id="settings" variant="label" title={t('profile.settings')}>
        <List>
          {j.language.canSwitch && (
            <ListRow
              leading={<Icon name="languages" size={20} className={styles.icon} />}
              titleStyle="label"
              title={t('profile.language')}
              trailing={
                <Segmented
                  label={t('profile.language')}
                  size="sm"
                  value={language}
                  onChange={setLanguage}
                  options={j.language.available.map((l) => ({ value: l, label: LANGUAGE_NAMES[l].label, lang: LANGUAGE_NAMES[l].lang }))}
                />
              }
              minHeight={56}
            />
          )}
          {j.verification.face && (
            <ListRow
              leading={<Icon name="scan-face" size={20} className={styles.icon} />}
              titleStyle="label"
              title={t('profile.face')}
              onClick={() => (enrolled ? toast.show(t('profile.faceRegisteredToast')) : router.push(routes.face(routes.profile)))}
              trailing={
                <span className={enrolled ? styles.ok : styles.warn}>
                  <Icon name={enrolled ? 'circle-check' : 'alert'} size={16} />
                  {enrolled ? t('profile.registered') : t('profile.notSetUp')}
                </span>
              }
              minHeight={56}
            />
          )}
          {j.offline.enabled && (
            <ListRow
              leading={<Icon name="hard-drive" size={20} className={styles.icon} />}
              titleStyle="label"
              title={t('profile.offline')}
              subtitle={t('profile.offlineSub', { count: packRows?.length ?? 0, sync: sync.pending ? t('profile.waiting', { count: sync.pending }) : t('profile.allSynced') })}
              href={routes.offline}
              trailing="chevron"
              minHeight={56}
            />
          )}
          <ListRow leading={<Icon name="help" size={20} className={styles.icon} />} titleStyle="label" title={t('profile.help')} onClick={() => toast.show(t('common.helpToast'))} trailing="chevron" minHeight={56} />
          <ListRow leading={<Icon name="logout" size={20} />} tone="danger" title={t('profile.logout')} onClick={() => setLogout(true)} minHeight={56} />
        </List>
      </Section>
      <BottomSheet
        open={logout}
        onClose={() => setLogout(false)}
        title={t('profile.logoutTitle')}
        description={t('profile.logoutBody')}
        actions={
          <>
            <Button variant="destructive" fullWidth onClick={async () => { await auth.signOut(); router.replace(routes.login); }}>
              {t('profile.logout')}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setLogout(false)}>
              {t('common.cancel')}
            </Button>
          </>
        }
      />
    </ScreenLayout>
  );
}
