import { demo, expect, preset, test } from './fixtures';

test('demo autofill follows the chosen persona; every login step is still shown', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  await demo(page, "quickLogin('principal')");
  await page.waitForURL(/\/login$/);
  // Never filled without intent.
  await expect(page.getByLabel('Institute code')).toHaveValue('');
  const assist = page.getByRole('button', { name: /Use demo login/ });
  await expect(assist).toContainText('Dr. Anil Deshmukh · Principal');
  await assist.click();
  await expect(page.getByLabel('Institute code')).toHaveValue('27410');
  await expect(page.getByLabel('Institute code')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Is this your institute?')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, continue' }).click();
  await page.getByRole('button', { name: /Use demo login/ }).click();
  await expect(page.getByLabel('Trainer ID')).toHaveValue('PR-2741');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Is this you?')).toBeVisible();
  await expect(page.locator('main').getByText('Dr. Anil Deshmukh')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, continue' }).click();
  await page.waitForURL(/\/home$/);
  await expect(page.getByText('Good morning, Principal')).toBeVisible();
});

test('quick login from the demo panel, and "Skip login screens" under Advanced', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  await page.getByRole('button', { name: 'Open demo controls' }).click();
  let panel = page.getByRole('dialog', { name: 'Demo controls' });
  await panel.getByRole('button', { name: /Timetable instructor/ }).click();
  await page.waitForURL(/\/login$/);
  await expect(page.getByRole('button', { name: /Use demo login/ })).toContainText('Vikas Shinde');

  await page.getByRole('button', { name: 'Open demo controls' }).click();
  panel = page.getByRole('dialog', { name: 'Demo controls' });
  await panel.getByText('Advanced').click();
  await panel.getByRole('radiogroup', { name: 'Skip login screens' }).getByRole('radio', { name: 'On' }).click();
  await panel.getByRole('button', { name: /Batch-mapped instructor/ }).click();
  await page.waitForURL(/\/home$/);
  await expect(page.getByText(/Good morning, Sunita/)).toBeVisible();
});
