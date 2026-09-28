import { expect, demo, preset, test } from './fixtures';

test('offline: mark against a downloaded roster, lock locally, then sync when back online', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'offline');
  await expect(page.getByText('You’re offline. Attendance will sync automatically.')).toBeVisible();
  await page.getByRole('region', { name: 'Today’s attendance' }).getByRole('link', { name: /Mechanic Diesel/ }).click();
  await page.getByRole('link', { name: /Shift 1 · Unit 1/ }).click();
  await expect(page.getByRole('heading', { name: 'This batch isn’t downloaded' })).toBeVisible();
  await page.getByRole('button', { name: 'Go back' }).click();
  await page.goBack();
  await page.getByRole('region', { name: 'Today’s attendance' }).getByRole('link', { name: /Electrician/ }).click();
  await page.getByRole('link', { name: /Shift 1 · Unit 2/ }).click();
  await page.waitForURL(/\/attendance\/mark/, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Review & Submit' }).click();
  await page.getByRole('button', { name: 'Submit attendance' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved on this phone' })).toBeVisible();

  await page.getByRole('link', { name: 'Done' }).click();
  await expect(page.getByText('1 attendance record waiting to sync')).toBeVisible();
  await demo(page, "setNetwork('online')");
  await expect(page.getByText('All attendance synced')).toBeVisible();
  await expect(page.getByText('1 attendance record waiting to sync')).toHaveCount(0);
});
