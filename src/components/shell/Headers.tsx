'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Latin } from '@/components/ui/Latin';
import { initials } from '@/components/ui/Avatar';
import { useT } from '@/hooks/i18n';
import { routes } from '@/lib/routes';
import styles from './Headers.module.css';

/** Navigates back when there is history, otherwise to a sensible parent (deep links). */
export function useBack(fallback: string) {
  const router = useRouter();
  return () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.replace(fallback);
  };
}

interface InnerHeaderProps {
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  /** false: tab root, no back affordance. */
  readonly back?: 'back' | 'close' | false;
  readonly backHref?: string;
  readonly onBack?: () => void;
  readonly trailing?: ReactNode;
}

/** The route announcer reads document.title on navigation: keep it in the user's language. */
function useDocumentTitle(title: ReactNode) {
  const t = useT();
  useEffect(() => {
    if (typeof title === 'string' && title) document.title = `${title} · ${t('app.name')}`;
  }, [title, t]);
}

export function InnerHeader({ title, subtitle, back = 'back', backHref = routes.home, onBack, trailing }: InnerHeaderProps) {
  const t = useT();
  const goBack = useBack(backHref);
  useDocumentTitle(title);
  return (
    <header className={styles.header} data-has-back={back ? 'true' : 'false'}>
      {back && <IconButton icon={back === 'close' ? 'x' : 'arrow-left'} label={back === 'close' ? t('a11y.close') : t('a11y.back')} onClick={onBack ?? goBack} />}
      <div className={styles.titles}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {trailing}
    </header>
  );
}

export function HomeHeader({ instituteName, userName }: { readonly instituteName: string; readonly userName: string }) {
  const t = useT();
  useEffect(() => {
    document.title = t('app.name');
  }, [t]);
  return (
    <header className={styles.header} data-home="true">
      <Image src="/branding/ksk-emblem.png" alt="" width={36} height={36} className={styles.emblem} loading="eager" />
      <div className={styles.titles}>
        <h1 className={styles.title}>{t('app.name')}</h1>
        <p className={styles.caption}>
          <Latin>{instituteName}</Latin>
        </p>
      </div>
      <IconButton label={t('a11y.profile')} variant="brandSubtle" href={routes.profile}>
        <span lang="en">{initials(userName)}</span>
      </IconButton>
    </header>
  );
}

/** Login-style screens: just a back arrow row. */
export function InlineBackBar({ onBack }: { readonly onBack: () => void }) {
  const t = useT();
  return (
    <div className={styles.inlineBack}>
      <IconButton icon="arrow-left" label={t('a11y.back')} onClick={onBack} />
    </div>
  );
}
