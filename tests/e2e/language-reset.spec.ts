import { expect, expectNoOverflow, nav, openProfileMenu, preset, test } from './fixtures';

test('Marathi: the whole interface switches, digits stay Latin, nothing overflows at 320px', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'batch');
  const menu = await openProfileMenu(page);
  await menu.getByRole('radio', { name: 'मराठी' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'mr');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  // Instructors have Home · Reports only (D-052).
  await expect(nav(page, 'हजेरी')).toHaveCount(0);
  await nav(page, 'अहवाल').click();
  await page.waitForURL(/\/reports$/);
  await expect(page.getByRole('heading', { name: 'कमी हजेरीचे विद्यार्थी' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'माझ्या बॅच' })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 640 });
  await expectNoOverflow(page);
  await page.setViewportSize({ width: 393, height: 851 });
  await nav(page, 'मुख्यपृष्ठ').click();
  await expect(page.getByText('तुमच्या बॅच')).toBeVisible();
  await expect(page.getByText(/सुप्रभात/)).toBeVisible();
  await expect(page.getByText('शिफ्ट 1 · युनिट 2')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 640 });
  await expectNoOverflow(page);
  await page.getByRole('link', { name: /शिफ्ट 1 · युनिट 2/ }).click();
  await page.waitForURL(/\/attendance\/mark/, { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'अनुपस्थित', exact: true }).first()).toBeVisible();
  await expectNoOverflow(page);
});

test('Reset Demo restores the seeded story', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'batch');
  await page.getByRole('link', { name: /Shift 1 · Unit 2/ }).click();
  await page.waitForURL(/\/attendance\/mark/, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Review & Submit' }).click();
  await page.getByRole('button', { name: 'Submit attendance' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit', exact: true }).click();
  await page.waitForURL(/submitted/);
  await page.getByRole('button', { name: 'Open demo controls' }).click();
  const panel = page.getByRole('dialog', { name: 'Demo controls' });
  await panel.getByRole('button', { name: 'Reset demo' }).click();
  await panel.getByRole('button', { name: 'Reset everything' }).click();
  await page.waitForURL(/\/login$/);
  await page.goto('/?preset=batch');
  await page.waitForURL(/\/home$/);
  await expect(page.locator('main').getByRole('link', { name: /Shift 1 · Unit 2/ })).toContainText('Mark attendance');
});
