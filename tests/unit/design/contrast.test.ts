import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** WCAG 2.x contrast for the token pairs the UI actually renders text with. */
const tokens = readFileSync(path.resolve(__dirname, '../../../src/styles/tokens.css'), 'utf8');
function hex(name: string): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6}|var\\(--([a-z0-9-]+)\\))`, 'i').exec(tokens);
  if (!m) throw new Error(`token ${name} not found`);
  return m[1].startsWith('#') ? m[1] : hex(m[2]);
}
function luminance(h: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [l1, l2] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const TEXT_PAIRS: ReadonlyArray<[string, string]> = [
  ['color-text-primary', 'color-background-surface'],
  ['color-text-secondary', 'color-background-surface-raised'],
  ['color-text-secondary', 'color-background-surface'],
  ['color-text-secondary', 'color-hero-banner'],
  ['color-text-tertiary', 'color-background-surface-raised'],
  ['color-text-brand', 'color-background-surface-raised'],
  ['color-text-brand-subdued', 'color-background-surface'],
  ['color-text-brand-subdued', 'color-surface-brand-subtle'],
  ['color-text-on-brand', 'color-interactive-primary'],
  ['color-text-success', 'color-surface-success-subtle'],
  ['color-text-error', 'color-surface-error-subtle'],
  ['color-text-warning', 'color-surface-warning-subtle'],
  ['color-text-info', 'color-surface-info-subtle'],
  ['color-text-inverse', 'color-background-inverse'],
  ['color-card-selected-text', 'color-card-selected-bg'],
  // Roll numbers and empty states on the grey page and on tinted roster rows.
  ['color-text-tertiary', 'color-background-surface'],
  ['color-text-tertiary', 'color-surface-info-subtle'],
  ['color-text-tertiary', 'color-surface-error-subtle'],
  ['color-text-tertiary', 'color-surface-success-subtle'],
  ['color-text-tertiary', 'color-surface-warning-subtle'],
  // Filled destructive button (Log out).
  ['color-text-on-brand', 'color-interactive-destructive-fill'],
  // Text fields on the grey page.
  ['color-text-primary', 'color-chat-input-background'],
];

describe('text contrast meets WCAG AA (4.5:1)', () => {
  for (const [fg, bg] of TEXT_PAIRS) {
    it(`${fg} on ${bg}`, () => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5));
  }
});
