/**
 * Translator: looks up the selected language, falls back to English, and fills
 * {placeholders}. Plural leaves ({one, other}) are chosen with Intl.PluralRules
 * from the `count` parameter. Numbers are formatted with the locale's digits.
 */
import type { Language } from '@/config/types';
import type { MessageLeaf, MessageParams, MessageTree, PluralForms } from './types';

const isPlural = (leaf: unknown): leaf is PluralForms =>
  typeof leaf === 'object' && leaf !== null && 'one' in leaf && 'other' in leaf;

function lookup(tree: MessageTree | undefined, path: string): MessageLeaf | undefined {
  let node: MessageTree | MessageLeaf | undefined = tree;
  for (const part of path.split('.')) {
    if (!node || typeof node === 'string' || isPlural(node)) return undefined;
    node = (node as MessageTree)[part];
  }
  return typeof node === 'string' || isPlural(node) ? node : undefined;
}

export interface TranslatorOptions {
  readonly language: Language;
  readonly locale: string;
  readonly messages: MessageTree;
  readonly fallback: MessageTree;
  readonly onMissing?: (key: string, language: Language) => void;
}

export function createTranslator(opts: TranslatorOptions) {
  const plural = new Intl.PluralRules(opts.locale);
  const number = new Intl.NumberFormat(opts.locale);
  return function t(key: string, params?: MessageParams): string {
    let leaf = lookup(opts.messages, key);
    if (leaf === undefined) {
      if (opts.language !== 'en') opts.onMissing?.(key, opts.language);
      leaf = lookup(opts.fallback, key);
    }
    if (leaf === undefined) return key;
    let template: string;
    if (isPlural(leaf)) {
      const count = Number(params?.count ?? 0);
      template = plural.select(count) === 'one' ? leaf.one : leaf.other;
    } else {
      template = leaf;
    }
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = params?.[name];
      if (value === undefined) return match;
      return typeof value === 'number' ? number.format(value) : value;
    });
  };
}

export type Translate = ReturnType<typeof createTranslator>;
