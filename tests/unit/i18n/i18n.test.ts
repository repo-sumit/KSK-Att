import { describe, expect, it } from 'vitest';
import { createI18n, en, mr } from '@/i18n';
import { createFormatters, localeFor } from '@/i18n/format';
import type { MessageTree } from '@/i18n/types';

function leaves(tree: MessageTree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[path] = v;
    else if ('one' in v && 'other' in v && typeof v.one === 'string') {
      out[`${path}.one`] = v.one as string;
      out[`${path}.other`] = v.other as string;
    } else Object.assign(out, leaves(v as MessageTree, path));
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('message catalogues', () => {
  const enLeaves = leaves(en);
  const mrLeaves = leaves(mr as MessageTree);

  it('Marathi translates every English string', () => {
    const missing = Object.keys(enLeaves).filter((k) => !(k in mrLeaves));
    expect(missing).toEqual([]);
  });
  it('uses the same placeholders in both languages', () => {
    const mismatched = Object.keys(mrLeaves).filter((k) => placeholders(mrLeaves[k]).join() !== placeholders(enLeaves[k] ?? '').join());
    expect(mismatched).toEqual([]);
  });
  it('has no empty strings', () => {
    expect(Object.entries({ ...enLeaves, ...mrLeaves }).filter(([, v]) => !v.trim())).toEqual([]);
  });
});

describe('translator', () => {
  it('interpolates and pluralises', () => {
    const { t } = createI18n('en', 'en-IN');
    expect(t('roster.blockUnmarked', { count: 1 })).toBe('1 student not marked yet');
    expect(t('roster.blockUnmarked', { count: 3 })).toBe('3 students not marked yet');
    expect(t('login.codeNotFound', { code: '27499' })).toContain('27499');
  });
  it('falls back to English for a missing Marathi key, never blank', () => {
    const { t } = createI18n('mr', 'mr-IN-u-nu-latn');
    expect(t('status.present')).toBe('उपस्थित');
    expect(t('home.yourBatches')).toBe('तुमच्या बॅच');
  });
});

describe('formatting', () => {
  it('Marathi uses Latin digits when configured (product decision)', () => {
    const f = createFormatters(localeFor('mr', 'latin'));
    expect(f.number(28)).toBe('28');
    expect(f.longDate('2026-09-25')).toMatch(/25/);
    expect(f.longDate('2026-09-25')).toMatch(/शुक्रवार/);
  });
  it('locale digits remain available as a configuration', () => {
    expect(createFormatters(localeFor('mr', 'locale')).number(28)).toBe('२८');
  });
  it('formats times like the prototype, never wrapping AM/PM away from the time', () => {
    const f = createFormatters('en-IN');
    const nb = (s: string) => s.replace(/ /g, '\u00a0');
    expect(f.clockTime('2026-09-25', '10:42')).toBe(nb('10:42 AM'));
    expect(f.clockTime('2026-09-25', '14:00')).toBe(nb('2:00 PM'));
    expect(f.clockRange('2026-09-25', '07:00', '08:00')).toBe(`7:00 – ${nb('8:00 AM')}`);
    expect(f.clockRange('2026-09-25', '11:00', '14:00')).toBe(`${nb('11:00 AM')} – ${nb('2:00 PM')}`);
    expect(createFormatters('mr-IN-u-nu-latn').clockTime('2026-09-25', '08:51')).toBe(nb('8:51 AM'));
  });
  it('prints short months as the prototype does ("Sep", not "Sept")', () => {
    const f = createFormatters('en-IN');
    expect(f.dayMonth('2026-09-17')).toBe('17 Sep');
    expect(f.dayMonthYear('2026-09-25')).toBe('25 Sep 2026');
  });
  it('formats distance per PRD §8.2', () => {
    const f = createFormatters('en-IN');
    expect(f.distance(640)).toBe('640\u00a0m');
    expect(f.distance(999.6)).toBe('1.00\u00a0km');
    expect(f.distance(24_360)).toBe('24.36\u00a0km');
  });
});
