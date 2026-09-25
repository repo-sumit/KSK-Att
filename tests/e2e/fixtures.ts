import { test as base, expect, type Page } from '@playwright/test';

/**
 * Every E2E test: demo simulations at 5% speed (fast but still observable),
 * and the test fails on any console error, page error or React warning.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      // Errors always fail; warnings fail when they come from React/Next (not the browser's own preload notices).
      if (m.type() === 'error' || (m.type() === 'warning' && /^Warning:|hydrat|\[i18n\]/i.test(m.text()))) errors.push(`${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.addInitScript(() => {
      const key = 'ksk-demo:v1:state';
      if (!localStorage.getItem(key)) {
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 1,
            presetId: 'open',
            config: {},
            simulation: { location: 'inside', outsideDistanceM: 1240, face: 'match', enrolmentIssue: 'none', permissions: { location: 'granted', camera: 'granted' }, online: true, nextSyncFails: false, speed: 0.05 },
            clock: { mode: 'fixed', time: '10:15' },
          }),
        );
      }
    });
    await provide(errors);
    expect(errors, 'console must stay clean').toEqual([]);
  },
});

export { expect };

/** Applies a demo preset and waits for its start screen. */
export async function preset(page: Page, id: string, landing: RegExp = /\/home$/) {
  await page.goto(`/?preset=${id}`);
  await page.waitForURL(landing);
}

export async function demo(page: Page, script: string) {
  await page.evaluate(`window.__kskDemo.${script}`);
}

/** Bottom navigation link (the nav's own label is translated, so match the link inside any nav). */
export const nav = (page: Page, name: string) => page.locator('nav').getByRole('link', { name, exact: true });

/** No horizontal scrolling at the current viewport. */
export async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** No control group (status pills, segmented options) is wider than its row. */
export async function expectGroupsFit(page: Page) {
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('[role=group], [role=radiogroup]')].filter((g) => g.scrollWidth > g.clientWidth + 1).map((g) => g.getAttribute('aria-label')),
  );
  expect(clipped).toEqual([]);
}
