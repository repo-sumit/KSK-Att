import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** SwiftChat DS governance: components use tokens, never raw colours, radii or type sizes. */
const ROOT = path.resolve(__dirname, '../../../src');

function cssModules(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return cssModules(file);
    return name.endsWith('.module.css') ? [file] : [];
  });
}

const files = cssModules(ROOT);

/** Splits a CSS value on top-level whitespace (keeps calc(a + b) together). */
function parts(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (current) out.push(current);
      current = '';
    } else current += ch;
  }
  if (current) out.push(current);
  return out;
}
const SPACING = new Set(['0', '0px', 'auto', '100%', '50%']);

describe('CSS Modules use SwiftChat tokens', () => {
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    it(`${rel}: no raw colours`, () => {
      expect(css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? []).toEqual([]);
    });
    it(`${rel}: radius only from --radius-* (or 50% for ovals)`, () => {
      const bad = [...css.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim()).filter((v) => !/^(var\(--radius-[a-z0-9]+\)\s*)+$/.test(v) && v !== '50%');
      expect(bad).toEqual([]);
    });
    it(`${rel}: type only from --type-* styles`, () => {
      expect(css.match(/font-size:\s*\d|line-height:\s*\d/g) ?? []).toEqual([]);
    });
    it(`${rel}: spacing from --space-* tokens`, () => {
      const bad = [...css.matchAll(/(?:^|[\s;{])(?:padding|margin|gap)(?:-[a-z]+)?:\s*([^;]+);/g)]
        .flatMap((m) => parts(m[1].trim()))
        .filter((v) => !v.startsWith('var(--space-') && !v.startsWith('calc(') && !v.startsWith('env(') && !SPACING.has(v) && !v.endsWith(')'));
      expect(bad).toEqual([]);
    });
  }
});

/** Every var(--x) used without a fallback must be defined somewhere (an undefined token silently renders as nothing). */
describe('custom properties are defined', () => {
  const allCss = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const file = path.join(dir, name);
      if (statSync(file).isDirectory()) return allCss(file);
      return name.endsWith('.css') ? [file] : [];
    });
  const sources = allCss(ROOT).map((file) => ({ file, css: readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));
  const defined = new Set(sources.flatMap(({ css }) => [...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1])));
  // Injected at runtime by next/font on <html>.
  for (const runtime of ['--font-montserrat', '--font-mukta']) defined.add(runtime);

  it('no CSS file uses an undefined token', () => {
    const missing = sources.flatMap(({ file, css }) =>
      [...css.matchAll(/var\((--[a-z0-9-]+)\s*\)/gi)].map((m) => m[1]).filter((name) => !defined.has(name)).map((name) => `${path.relative(ROOT, file)}: ${name}`),
    );
    expect([...new Set(missing)]).toEqual([]);
  });
});
