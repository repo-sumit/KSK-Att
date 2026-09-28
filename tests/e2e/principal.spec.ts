import { expect, nav, preset, test } from './fixtures';

test('principal corrects today’s attendance with a reason; the audit log records it', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'principal');
  await expect(page.getByRole('link', { name: /Student attendance/ }).first()).toBeVisible();
  await nav(page, 'Attendance').click();
  await page.getByRole('link', { name: /Electrician/ }).click();
  await page.getByRole('link', { name: /Shift 1 · Unit 1/ }).click();
  await page.waitForURL(/\/attendance\/record/);
  await expect(page.getByText(/Tap a student to correct/)).toBeVisible();
  await page.getByRole('link', { name: /Rahul Kumar/ }).click();
  await page.waitForURL(/\/attendance\/correct/);
  await expect(page.locator('main').getByText('This correction will be recorded in the audit log.').first()).toBeVisible();
  await page.getByRole('radio', { name: /^Present/ }).click();
  await page.getByRole('button', { name: 'Student arrived late' }).click();
  await page.getByRole('button', { name: 'Save correction' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByRole('heading', { name: 'Attendance corrected' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForURL(/\/attendance\/record/);
  await expect(page.getByText('Corrected by principal')).toBeVisible();

  await page.getByRole('radio', { name: 'Yesterday' }).click();
  // Read-only either way: yesterday's record (or, on a Monday, Sunday's empty day) can't be corrected.
  await expect(page.getByText(/Attendance from previous days can’t be corrected\.|Nothing was submitted for Electrician · Shift 1 · Unit 1/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Rahul Kumar/ })).toHaveCount(0);

  await page.goto('/reports/view?r=correction_log&range=month');
  await expect(page.getByText(/Rahul Kumar · Absent → Present/)).toBeVisible();
  await expect(page.getByText(/Kiran Wagh/)).toBeVisible();
});

test('principal marks staff who have not self-verified; self-verified rows are locked', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'principal');
  await page.getByRole('link', { name: 'Mark staff attendance' }).click();
  await page.waitForURL(/\/attendance\/staff/);
  const sunita = page.locator('li', { hasText: 'Sunita Jadhav' });
  await expect(sunita.getByText(/Self verified/)).toBeVisible();
  // Locked: a saved mark is a status value, not a control.
  await expect(sunita.getByRole('button')).toHaveCount(0);
  await expect(sunita.getByRole('combobox')).toHaveCount(0);
  const sanjay = page.locator('li', { hasText: 'Sanjay More' });
  await sanjay.getByRole('combobox', { name: 'Attendance for Sanjay More' }).selectOption('present');
  await page.getByRole('button', { name: 'Save 1 change' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save 1 change' }).click();
  await expect(page.getByText('Staff attendance saved')).toBeVisible();
  await expect(sanjay.getByText('Marked by principal')).toBeVisible();
});
