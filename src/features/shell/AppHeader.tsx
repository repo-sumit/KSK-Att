'use client';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Latin } from '@/components/ui/Latin';
import { HeaderNav } from '@/components/shell/AppNav';
import { useBack, useDocumentTitle } from '@/components/shell/Headers';
import { useScreenArea } from '@/components/shell/ScreenLayout';
import { useT } from '@/hooks/i18n';
import { useSession } from '@/hooks/session';
import { routes } from '@/lib/routes';
import { ProfileMenu } from '../profile/ProfileMenu';
import styles from './AppHeader.module.css';

interface AppHeaderProps {
  /** The screen's name. Task screens show it beside back/close; tab roots announce it (and use it for the tab title). */
  readonly title?: ReactNode;
  readonly subtitle?: ReactNode;
  /** false (default) marks a tab root: phones show the brand; with back/close, phones show the screen title instead. */
  readonly back?: 'back' | 'close' | false;
  readonly backHref?: string;
  readonly onBack?: () => void;
  readonly trailing?: ReactNode;
}

/**
 * The one header of every signed-in screen (D-046): KSK brand and institute on
 * the left, the profile avatar at the top right, the primary destinations in
 * between on tablets and desktops. Phones keep the prototype's single 60px bar:
 * the brand on tab roots, back + screen title on task screens.
 */
export function AppHeader({ title, subtitle, back = false, backHref = routes.home, onBack, trailing }: AppHeaderProps) {
  const t = useT();
  const ctx = useSession();
  const area = useScreenArea();
  const goBack = useBack(backHref);
  useDocumentTitle(title ?? t('app.name'));
  const task = Boolean(back);
  const AppName = title ? 'p' : 'h1';

  return (
    <header className={styles.header} data-mode={task ? 'task' : 'root'}>
      <div className={styles.bar}>
        <div className={styles.brand}>
          <Image src="/branding/ksk-emblem.png" alt="" width={36} height={36} className={styles.emblem} loading="eager" />
          <span className={styles.brandText}>
            <AppName className={styles.appName}>{t('app.name')}</AppName>
            <span className={styles.institute}>
              <Latin>{ctx.institute.shortName}</Latin>
            </span>
          </span>
        </div>
        <HeaderNav active={area} />
        <div className={styles.profile}>
          <ProfileMenu />
        </div>
      </div>
      {title && (
        // Tab roots: the destination is already marked in the navigation, so its name is for screen readers only.
        <div className={task ? styles.context : 'visually-hidden'}>
          {back && <IconButton icon={back === 'close' ? 'x' : 'arrow-left'} label={back === 'close' ? t('a11y.close') : t('a11y.back')} onClick={onBack ?? goBack} />}
          <div className={styles.titles}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {trailing}
        </div>
      )}
    </header>
  );
}
