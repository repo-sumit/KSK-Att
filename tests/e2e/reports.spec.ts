import type { Page } from '@playwright/test';
import { expect, nav, preset, test } from './fixtures';

const pcts = async (page: Page, rows: ReturnType<Page['locator']>) =>
  (await rows.allInnerTexts()).map((text) => Number(/(\d+)%/.exec(text)?.[1] ?? NaN)).filter((n) => !Number.isNaN(n));

test('reports: my attendance, my batches as a sortable leaderboard, at-risk students', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'batch');
  await nav(page, 'Reports').click();
  await page.waitForURL(/\/reports$/);
  // No more generic report list.
  for (const gone of ['Daily register', 'Student attendance %']) await expect(page.getByText(gone)).toHaveCount(0);

  const me = page.getByRole('region', { name: 'My attendance' });
  await expect(me.getByText(/^Present: \d+ days?$/)).toBeVisible();
  await expect(me.getByText(/^Absent: \d+ days?$/)).toBeVisible();
  await expect(me.getByText('Last 3 months')).toBeVisible();

  const batches = page.getByRole('region', { name: 'My batches' });
  const row = batches.getByRole('button', { name: /Electrician · Shift 1 · Unit 2/ });
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  const students = batches.locator('ol > li');
  await expect(students).toHaveCount(31);
  await expect(students.first()).toContainText('1');
  const high = await pcts(page, students);
  expect(high).toEqual([...high].sort((a, b) => b - a));
  await batches.getByRole('radio', { name: 'Lowest first' }).click();
  const low = await pcts(page, students);
  expect(low).toEqual([...low].sort((a, b) => a - b));
  // Anyone below 75% carries the at-risk flag.
  for (const text of await students.allInnerTexts()) {
    const pct = Number(/(\d+)%/.exec(text)?.[1]);
    expect(text.includes('At risk'), text).toBe(pct < 75);
  }
  await row.click();
  await expect(students).toHaveCount(0);

  const risk = page.getByRole('region', { name: 'At-risk students' });
  await expect(risk.getByText('Students below 75% attendance in the last 30 days')).toBeVisible();
  const groups = risk.getByRole('button', { expanded: false });
  if ((await groups.count()) > 0) {
    await groups.first().click();
    for (const pct of await pcts(page, risk.locator('ul > li'))) expect(pct).toBeLessThan(75);
  }
  // Already grouped by batch: there is no batch filter (D-063).
  await expect(risk.getByRole('combobox')).toHaveCount(0);

  // Offline data is part of Reports.
  await page.locator('main').getByRole('link', { name: /on this phone/ }).click();
  await page.waitForURL(/\/reports\/offline$/);
});

test('offline data: refresh one batch, then everything', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  await page.goto('/reports/offline');
  const stale = page.locator('main li').filter({ hasText: 'Fitter · Shift 1 · Unit 2' });
  await expect(stale).toContainText('Refresh needed');
  await stale.getByRole('button', { name: 'Refresh data for Fitter · Shift 1 · Unit 2' }).click();
  await expect(stale).toContainText('Updated just now');
  await expect(stale).toContainText('Ready offline');
  const fresh = page.locator('main li').filter({ hasText: 'COPA · Shift 1 · Unit 1' });
  await expect(fresh).toContainText('Updated today · 7:45 AM');
  await page.getByRole('button', { name: 'Refresh all data' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Downloaded data refreshed' })).toBeVisible();
  await expect(fresh).toContainText('Updated just now');
  await page.getByRole('link', { name: 'Download more batches' }).click();
  await page.waitForURL(/\/reports\/offline\/download$/);
});

test('principal reports: the institute, every batch by trade, at-risk across the institute, the detail reports', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'principal');
  await nav(page, 'Reports').click();
  await page.waitForURL(/\/reports$/);
  await expect(page.getByRole('region', { name: 'Institute attendance' })).toContainText('417 students · 17 batches');
  const batches = page.getByRole('region', { name: 'Batch attendance' });
  await expect(batches.getByRole('button')).toHaveCount(17);
  await expect(batches.getByRole('heading', { name: 'Welder' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Offline data' })).toHaveCount(0);
  await page.getByRole('link', { name: /Correction log/ }).click();
  await page.waitForURL(/\/reports\/view\?r=correction_log/);
  await expect(page.getByText(/Kiran Wagh/)).toBeVisible();
});
