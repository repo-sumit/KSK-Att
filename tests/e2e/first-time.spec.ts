import { expect, preset, test } from './fixtures';

test('first-time user: login with confirmations, face registration (simulated camera), then permission primer', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'first_time', /\/login$/);
  await page.getByLabel('Institute code').fill('27499');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('No institute found for code 27499');
  await page.getByLabel('Institute code').fill('27410');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Government Industrial Training Institute, Pune')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, continue' }).click();
  await page.getByLabel('Trainer ID').fill('TR-20411');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('not registered at Government ITI Pune');
  await page.getByLabel('Trainer ID').fill('TR-10432');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Is this you?')).toBeVisible();
  await expect(page.locator('main').getByText('Rajesh Patil')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, continue' }).click();

  await page.waitForURL(/\/face/);
  await expect(page.getByText('Set up face verification')).toBeVisible();
  await expect(page.getByText('Demo simulation · no camera or photo is used')).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'Camera required' })).toBeVisible();
  await page.getByRole('button', { name: 'Allow camera' }).click();
  await expect(page.getByText(/of 3/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Face registered successfully' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(/\/home$/);

  await page.getByRole('link', { name: 'Choose trade and batch' }).click();
  await page.getByRole('link', { name: /Electrician/ }).click();
  await page.getByRole('link', { name: /Shift 1 · Unit 3/ }).click();
  await expect(page.getByRole('heading', { name: 'Location required' })).toBeVisible();
  await page.getByRole('button', { name: 'Allow location' }).click();
  await page.waitForURL(/\/attendance\/mark/, { timeout: 20_000 });
});
