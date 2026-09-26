'use client';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { useT } from '@/hooks/i18n';
import styles from './Headers.module.css';

/** Navigates back when there is history, otherwise to a sensible parent (deep links). */
export function useBack(fallback: string) {
  const router = useRouter();
  return () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.replace(fallback);
  };
}

/** The route announcer reads document.title on navigation: keep it in the user's language. */
export function useDocumentTitle(title: ReactNode) {
  const t = useT();
  useEffect(() => {
    if (typeof title !== 'string' || !title) return;
    const app = t('app.name');
    document.title = title === app ? app : `${title} · ${app}`;
  }, [title, t]);
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
