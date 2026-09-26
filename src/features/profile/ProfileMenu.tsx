'use client';
import { useRouter } from 'next/navigation';
import { useContext, useEffect, useId, useRef, useState } from 'react';
import { Avatar, initials } from '@/components/ui/Avatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/icons/Icon';
import { Latin } from '@/components/ui/Latin';
import { List, ListRow } from '@/components/ui/ListRow';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { NavigationGuardContext } from '@/components/shell/AppNav';
import type { Language } from '@/config/types';
import { useI18n } from '@/hooks/i18n';
import { useServices } from '@/hooks/services';
import { useSession } from '@/hooks/session';
import { useQuery } from '@/hooks/useQuery';
import { useSyncStatus } from '@/hooks/useSync';
import { routes } from '@/lib/routes';
import { roleLine } from '../home/roleLine';
import styles from './ProfileMenu.module.css';

const LANGUAGE_NAMES: Readonly<Record<Language, { label: string; lang: string }>> = {
  en: { label: 'English', lang: 'en' },
  mr: { label: 'मराठी', lang: 'mr' },
};

/**
 * The single profile entry point (D-046): the avatar at the top right of every
 * signed-in screen. Phones: a bottom sheet. Tablets and desktops: a menu
 * anchored under the avatar. Native <dialog>: focus stays inside, Esc closes,
 * focus returns to the avatar.
 */
export function ProfileMenu() {
  const { t } = useI18n();
  const ctx = useSession();
  const { auth } = useServices();
  const router = useRouter();
  // Unsaved work on the screen (the principal's staff marks) is asked about before leaving from here too.
  const guard = useContext(NavigationGuardContext);
  const guarded = (go: () => void) => (guard ? guard(go) : go());
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [logout, setLogout] = useState(false);

  const show = () => {
    const d = dialog.current;
    const r = trigger.current?.getBoundingClientRect();
    if (!d || !r) return;
    // Anchor for the tablet/desktop menu; the phone sheet ignores it.
    d.style.setProperty('--menu-top', `${Math.round(r.bottom + 8)}px`);
    d.style.setProperty('--menu-right', `${Math.round(window.innerWidth - r.right)}px`);
    setOpen(true);
    d.showModal();
  };
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={t('a11y.profile')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={show}
      >
        <span lang="en">{initials(ctx.user.name)}</span>
      </button>
      <dialog
        ref={dialog}
        className={styles.menu}
        aria-label={t('a11y.profile')}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && close()}
      >
        {open && <MenuContent onClose={close} guarded={guarded} onLogout={() => { close(); guarded(() => setLogout(true)); }} />}
      </dialog>
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
    </>
  );
}

interface MenuContentProps {
  readonly onClose: () => void;
  readonly onLogout: () => void;
  /** Runs a navigation through the screen's unsaved-work guard, if it has one. */
  readonly guarded: (go: () => void) => void;
}

/** Mounted only while the menu is open, so its queries don't run on every screen. */
function MenuContent({ onClose, onLogout, guarded }: MenuContentProps) {
  const { t, language, setLanguage } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const ctx = useSession();
  const { faceMatch, packs } = useServices();
  const sync = useSyncStatus();
  const j = ctx.journey;
  const nameId = useId();
  const nameRef = useRef<HTMLHeadingElement>(null);
  // Start on the person's name (showModal() ran before this content existed, so focus it here).
  useEffect(() => nameRef.current?.focus(), []);
  const { data: enrolled } = useQuery(`face:${ctx.user.id}`, () => faceMatch.isEnrolled(ctx.user.id), ['face']);
  const { data: packRows } = useQuery(`packs:${ctx.user.id}`, () => (j.offline.enabled ? packs.list(ctx) : Promise.resolve([])), ['packs']);
  const after = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <div className={styles.panel}>
      <span className={styles.grabber} aria-hidden="true" />
      <div className={styles.identity}>
        <Avatar name={ctx.user.name} size={48} />
        <div className={styles.who}>
          <h2 id={nameId} ref={nameRef} className={styles.name} tabIndex={-1}>
            <Latin>{ctx.user.name}</Latin>
          </h2>
          <p className={styles.role}>{roleLine(t, ctx)}</p>
          <p className={styles.meta}>
            <Latin>{ctx.institute.shortName}</Latin> · <span className={styles.nowrap}>{t('profile.trainerIdValue', { id: ctx.user.trainerId })}</span>
          </p>
        </div>
      </div>
      <List className={styles.list} label={t('profile.settings')}>
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
            onClick={after(() => (enrolled ? toast.show(t('profile.faceRegisteredToast')) : guarded(() => router.push(routes.face(window.location.pathname + window.location.search)))))}
            trailing={
              enrolled === undefined ? null : (
                <span className={enrolled ? styles.ok : styles.warn}>
                  <Icon name={enrolled ? 'circle-check' : 'alert'} size={16} />
                  {enrolled ? t('profile.registered') : t('profile.notSetUp')}
                </span>
              )
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
            onClick={after(() => guarded(() => router.push(routes.offline)))}
            trailing="chevron"
            minHeight={56}
          />
        )}
        <ListRow
          leading={<Icon name="help" size={20} className={styles.icon} />}
          titleStyle="label"
          title={t('profile.help')}
          onClick={after(() => toast.show(t(j.homeVariant === 'institute' ? 'common.helpToastPrincipal' : 'common.helpToast')))}
          trailing="chevron"
          minHeight={56}
        />
        <ListRow leading={<Icon name="logout" size={20} />} tone="danger" title={t('profile.logout')} onClick={onLogout} minHeight={56} />
      </List>
    </div>
  );
}
