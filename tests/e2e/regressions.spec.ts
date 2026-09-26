import { demo, expect, preset, test } from './fixtures';

/** Every direct child of the scroller shows all of its content (none is squeezed and clipped). */
async function expectNothingClipped(page: import('@playwright/test').Page) {
  const clipped = await page.locator('main').evaluate((main) =>
    [...main.children].filter((c) => c.scrollHeight > c.clientHeight + 1 && getComputedStyle(c).overflowY !== 'visible').map((c) => c.className),
  );
  expect(clipped).toEqual([]);
}

test('long lists scroll to their last row: review absentees and report tables (main never clips its children)', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'batch');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator('main').getByRole('link', { name: /Shift 1 · Unit 2/ }).click();
  await page.waitForURL(/\/attendance\/mark/, { timeout: 20_000 });
  const absent = page.getByRole('button', { name: 'Absent', exact: true });
  for (let i = 0; i < 8; i++) await absent.nth(i).click();
  await page.getByRole('button', { name: 'Review & Submit' }).click();
  await page.waitForURL(/\/attendance\/review/);
  await expect(page.getByText(/Absent students \(8\)|8 absent/i).first()).toBeVisible();
  await expectNothingClipped(page);

  for (const size of [{ width: 360, height: 800 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size);
    await page.goto('/?preset=principal');
    await page.waitForURL(/\/home$/);
    await page.goto('/reports/view?r=trade_batch&range=month');
    await page.waitForLoadState('networkidle');
    await expectNothingClipped(page);
    // The report's last row (17 batches) can be scrolled into view.
    const rows = page.locator('main [class*="__rows"] > *');
    expect(await rows.count()).toBeGreaterThanOrEqual(17);
    const last = rows.last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
  }
});

test('the demo panel never scrolls sideways, with Advanced open, on narrow phones', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  for (const width of [320, 360, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.getByRole('button', { name: 'Open demo controls' }).click();
    const panel = page.getByRole('dialog', { name: 'Demo controls' });
    await panel.getByText('Advanced').click();
    await expect(panel.getByRole('radiogroup', { name: 'Location source' })).toBeVisible();
    const overflow = await panel.evaluate((d) => d.scrollWidth - d.clientWidth);
    expect(overflow, `panel at ${width}`).toBeLessThanOrEqual(0);
    const clipped = await panel.evaluate((d) => [...d.querySelectorAll('[role=radiogroup]')].filter((g) => g.scrollWidth > g.clientWidth + 1).map((g) => g.getAttribute('aria-label')));
    expect(clipped, `groups at ${width}`).toEqual([]);
    await page.getByRole('button', { name: 'Close demo controls' }).click();
  }
});

test('on a 320×568 phone the demo login helper is fully above the Continue bar', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.setViewportSize({ width: 320, height: 568 });
  await preset(page, 'first_time', /\/login$/);
  const assist = (await page.getByRole('button', { name: /Use demo login/ }).boundingBox())!;
  const cta = (await page.getByRole('button', { name: 'Continue' }).boundingBox())!;
  expect(assist.y + assist.height).toBeLessThanOrEqual(cta.y - 8);
});

test('every problem inside verification keeps the app header (avatar and close)', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'batch');
  await demo(page, "setSimulation({ location: 'permission_denied' })");
  await page.locator('main').getByRole('link', { name: /Shift 1 · Unit 2/ }).click();
  await expect(page.getByRole('heading', { name: 'Location access is off' })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('header').getByRole('button', { name: 'Profile' })).toBeVisible();
  await expect(page.locator('header').getByRole('button', { name: 'Close' })).toBeVisible();
});
