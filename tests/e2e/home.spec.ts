import { demo, expect, nav, preset, test } from './fixtures';

test('Home is today’s work: notices, classes, my attendance; no Attendance tab and no “View reports”', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveText(['Home', 'Reports']);
  await expect(page.getByRole('link', { name: 'View reports' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Today’s attendance' }).getByRole('link', { name: /Electrician/ })).toBeVisible();
  // An old link to the Attendance tab lands on Home.
  await page.goto('/attendance');
  await page.waitForURL(/\/home$/);

  // The compact notice: the most important one, and how many more.
  const notices = page.getByRole('region', { name: 'Announcements' });
  const banner = notices.getByRole('button');
  await expect(banner).toContainText('Holiday');
  await expect(banner).toContainText('Special holiday: institute closed');
  await expect(banner).toContainText('4 more announcements');
  await banner.click();
  const sheet = page.getByRole('dialog', { name: 'Announcements' });
  await expect(sheet.getByRole('listitem')).toHaveCount(5);
  await expect(sheet.getByRole('listitem').filter({ hasText: 'Batch on OJT' })).toContainText('For Electrician · Shift 1 · Unit 1');
  await expect(sheet.getByRole('listitem').filter({ hasText: 'Instructor meeting' })).toContainText('For you');
  // Other trades' notices are not shown to this instructor.
  await expect(sheet.getByText('Welding workshop closed for maintenance')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
  await expect(banner).toBeFocused();
});

test('refresh one downloaded batch from its card: “Updated just now”, the other card untouched', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'batch');
  const refresh = page.getByRole('button', { name: 'Refresh data for Electrician · Shift 1 · Unit 2' });
  const other = page.getByRole('button', { name: 'Refresh data for Electrician · Shift 2 · Unit 2' });
  await expect(refresh).toBeVisible();
  const strip = refresh.locator('..');
  const otherStrip = other.locator('..');
  await expect(strip).toContainText('Updated 7:45 AM');
  await refresh.click();
  await expect(strip).toContainText('Updated just now');
  await expect(otherStrip).toContainText('Updated 7:45 AM');
  // The card itself still opens the roster.
  await expect(page.locator('main').getByRole('link', { name: /Shift 1 · Unit 2/ })).toContainText('Mark attendance');

  // Offline: nothing to refresh from, and the app says so.
  await demo(page, "setNetwork('offline')");
  await other.click();
  await expect(page.getByRole('status').filter({ hasText: 'Connect to the internet to refresh' })).toBeVisible();
  await expect(otherStrip).toContainText('Updated 7:45 AM');
});

test('the principal keeps the Attendance tab and sees every notice for the institute', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'principal');
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveText(['Home', 'Attendance', 'Reports']);
  await expect(page.getByRole('region', { name: 'Announcements' }).getByRole('button')).toContainText('5 more announcements');
  await nav(page, 'Attendance').click();
  await page.waitForURL(/\/attendance$/);
  await expect(page.getByRole('radiogroup', { name: 'Attendance view' })).toBeVisible();
});
