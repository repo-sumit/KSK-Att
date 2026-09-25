'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Language } from '@/config/types';
import { createI18n, localeFor, type I18n } from '@/i18n';
import { useContainer } from './services';

interface I18nContextValue extends I18n {
  setLanguage(language: Language): void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Current language (persisted through the preferences repository, PRD §21.3)
 * applied to <html lang>, so the Marathi type twins switch on automatically.
 */
export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const { repositories, services, bus } = useContainer();
  const base = services.configuration.base();
  const [language, setLanguageState] = useState<Language>(() => (typeof document !== 'undefined' && document.documentElement.lang === 'mr' ? 'mr' : base.i18n.defaultLanguage));

  useEffect(() => {
    const load = () =>
      void repositories.preferences.getLanguage().then((saved) => {
        const available = services.configuration.base().i18n.languages;
        setLanguageState(saved && available.includes(saved) ? saved : services.configuration.base().i18n.defaultLanguage);
      });
    load();
    return bus.subscribe(['preferences', 'demo'], load);
  }, [repositories, services, bus]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(
    (next: Language) => {
      setLanguageState(next);
      void repositories.preferences.setLanguage(next);
    },
    [repositories],
  );

  const numerals = base.i18n.numerals;
  const value = useMemo<I18nContextValue>(() => {
    const i18n = createI18n(language, localeFor(language, numerals), (key, lang) => {
      if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] missing ${lang} string: ${key}`);
    });
    return { ...i18n, setLanguage };
  }, [language, numerals, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n outside I18nProvider');
  return value;
}

export const useT = () => useI18n().t;
