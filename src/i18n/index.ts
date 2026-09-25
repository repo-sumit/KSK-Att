/** i18n entry: typed keys, the catalogues and a translator factory. */
import type { Language } from '@/config/types';
import { en, type EnglishMessages } from './messages/en';
import { mr } from './messages/mr';
import { createFormatters } from './format';
import { createTranslator } from './translate';
import type { LeafPaths, MessageParams, MessageTree } from './types';

export type MessageKey = LeafPaths<EnglishMessages>;

const CATALOGUES: Record<Language, MessageTree> = { en, mr: mr as MessageTree };

export function createI18n(language: Language, locale: string, onMissing?: (key: string, lang: Language) => void) {
  const translate = createTranslator({ language, locale, messages: CATALOGUES[language], fallback: en, onMissing });
  return {
    language,
    t: (key: MessageKey, params?: MessageParams) => translate(key, params),
    format: createFormatters(locale),
  };
}

export type I18n = ReturnType<typeof createI18n>;
export { localeFor } from './format';
export { en, mr };
