import AxeBuilder from '@axe-core/playwright';
import { demo, expect, expectGroupsFit, expectNoOverflow, preset, test } from './fixtures';

const WIDTHS = [320, 360, 375, 390, 412, 768];

test('no horizontal overflow on key screens at every phone width', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'principal');
  for (const path of ['/home', '/attendance', '/attendance/staff', '/reports', '/reports/view?r=institute_summary&range=month', '/profile']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await expectNoOverflow(page);
    }
  }
});

test('roster status buttons fit the row with five statuses, 320px to 412px', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  await demo(page, "setConfig({ marking: { statusSet: ['present', 'absent', 'half_day', 'leave', 'ojt'], halfDayHalves: true } })");
  const today = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()));
  await page.goto(`/attendance/open?s=fit-s1u2.${today}.daily`);
  await page.waitForURL(/\/attendance\/mark/, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Leave', exact: true }).nth(1).click();
  for (const width of WIDTHS.filter((w) => w <= 412)) {
    await page.setViewportSize({ width, height: 800 });
    await expectNoOverflow(page);
    await expectGroupsFit(page);
  }
});

test('key screens pass automated accessibility checks', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  for (const path of ['/home', '/attendance', '/profile', '/profile/offline']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  }
});

test('principal and report screens (grey surfaces) pass automated accessibility checks', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'principal');
  const today = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()));
  for (const path of ['/home', '/attendance/staff', '/reports', '/reports/view?r=institute_summary&range=month', `/attendance/correct?s=ele-s1u1.${today}.daily&student=ele-s1u1-r21`]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});
