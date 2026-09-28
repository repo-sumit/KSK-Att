import { demo, expect, expectNoOverflow, preset, test } from './fixtures';
import type { Page } from '@playwright/test';

/** Opens today's roster for Electrician · Shift 1 · Unit 2 (the open instructor's batch with OJT students). */
async function openRoster(page: Page) {
  const today = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()));
  await page.goto(`/attendance/open?s=ele-s1u2.${today}.daily`);
  await page.waitForURL(/\/attendance\/mark/, { timeout: 20_000 });
}

const status = (page: Page) => page.getByRole('combobox', { name: /^Attendance for / });

test('one status control per student: its options follow configuration', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  // Maharashtra: Present + Absent only.
  await openRoster(page);
  await expect(status(page).first().locator('option')).toHaveText(['Present', 'Absent']);
  // No button group anywhere on the roster any more.
  await expect(page.locator('main').getByRole('button', { name: 'Absent', exact: true })).toHaveCount(0);

  // Every status on, with halves: the same single control, four choices (OJT is never chosen by hand).
  await demo(page, "setConfig({ marking: { statusSet: ['present', 'absent', 'half_day', 'leave', 'ojt'], halfDayHalves: true } })");
  await openRoster(page);
  const first = status(page).first();
  await expect(first.locator('option')).toHaveText(['Present', 'Absent', 'Half day', 'Leave']);
  // Half day asks which half, underneath the row.
  await first.selectOption('half_day');
  const row = page.locator('main li').filter({ has: first });
  await expect(row.getByRole('radiogroup', { name: 'Present for' })).toBeVisible();
  await row.getByRole('radio', { name: 'First half' }).click();
  // Leave asks the type.
  await first.selectOption('leave');
  await expect(row.getByRole('radiogroup', { name: 'Leave type' })).toBeVisible();
  for (const width of [320, 360, 412]) {
    await page.setViewportSize({ width, height: 800 });
    await expectNoOverflow(page);
  }
});

test('OJT from the ERP is a locked value, not a control', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  await demo(page, "setConfig({ marking: { statusSet: ['present', 'absent', 'ojt'] } })");
  await openRoster(page);
  // Rolls 6 and 13 are on OJT (declared in the ERP).
  const ojt = page.locator('main li').filter({ hasText: 'On-the-job training · declared in the ERP' });
  await expect(ojt).toHaveCount(2);
  await expect(ojt.first()).toContainText('OJT');
  await expect(ojt.first().getByRole('combobox')).toHaveCount(0);
  await expect(ojt.first()).toContainText('set by the ERP, can’t be changed here');
  // Everyone else keeps a control.
  await expect(status(page)).toHaveCount((await page.locator('main li[data-student]').count()) - 2);
});

test('a blank start: "Choose" until marked, and Review goes to the first unmarked control', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  await demo(page, "setConfig({ marking: { defaultStatus: 'blank' } })");
  await openRoster(page);
  await expect(page.getByText('Choose a status for every student.')).toBeVisible();
  const first = status(page).first();
  await expect(first).toHaveValue('');
  await expect(first.locator('option:checked')).toHaveText('Choose');
  // Inactive (aria-disabled) until everyone is marked: pressing it still explains and moves to the gap.
  await page.getByRole('button', { name: 'Review & Submit' }).click({ force: true });
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute('aria-invalid', 'true');
  await first.selectOption('present');
  await expect(first).not.toHaveAttribute('aria-invalid', 'true');
  // The placeholder is gone once a status is chosen.
  await expect(first.locator('option')).toHaveText(['Present', 'Absent']);
});
