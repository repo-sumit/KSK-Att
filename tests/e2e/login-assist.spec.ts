import { demo, expect, preset, test } from './fixtures';

const ACCOUNTS = [
  'Open instructor Rajesh Patil',
  'Batch-mapped instructor Sunita Jadhav',
  'Timetable instructor Vikas Shinde',
  'Employability Skills instructor Meera Kulkarni',
  'Principal Dr. Anil Deshmukh',
];

test('"Use demo account": nothing is filled until the user picks one; every login step is still shown', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  await demo(page, "quickLogin('principal')");
  await page.waitForURL(/\/login$/);
  const code = page.getByLabel('Institute code');
  // Never filled without intent, even with a persona picked in the demo panel.
  await expect(code).toHaveValue('');
  const toggle = page.getByRole('button', { name: 'Use demo account' });
  const accounts = page.getByRole('list', { name: 'Use demo account' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(accounts).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  // Exactly five accounts, title + name only (no codes or IDs on screen).
  await expect(accounts.getByRole('button')).toHaveText(ACCOUNTS);
  const principal = accounts.getByRole('button', { name: /^Principal/ });
  // The panel's pick is highlighted, still not filled.
  await expect(principal).toHaveAttribute('aria-current', 'true');
  await expect(code).toHaveValue('');
  await principal.click();
  await expect(code).toHaveValue('27410');
  await expect(code).toBeFocused();
  await expect(accounts).toBeHidden();
  await expect(page.getByText('Demo account: Dr. Anil Deshmukh · Principal')).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(page.getByText('Is this your institute?')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, continue' }).click();
  // Picked at step 1, so its Trainer ID is already here; the user still continues.
  const trainerId = page.getByLabel('Trainer ID');
  await expect(trainerId).toHaveValue('PR-2741');
  await expect(page.getByText('Demo account: Dr. Anil Deshmukh · Principal')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change' })).toHaveAttribute('aria-expanded', 'false');
  await trainerId.press('Enter');
  await expect(page.getByText('Is this you?')).toBeVisible();
  await expect(page.locator('main').getByText('Dr. Anil Deshmukh')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, continue' }).click();
  await page.waitForURL(/\/home$/);
  await expect(page.getByText('Good morning, Principal')).toBeVisible();
});

test('"Change" on the Trainer ID step: another account fills its own Trainer ID and lands on its Home', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'first_time', /\/login$/);
  await page.getByRole('button', { name: 'Use demo account' }).click();
  await page.getByRole('list', { name: 'Use demo account' }).getByRole('button', { name: /^Principal/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Yes, continue' }).click();
  const trainerId = page.getByLabel('Trainer ID');
  await expect(trainerId).toHaveValue('PR-2741');

  const change = page.getByRole('button', { name: 'Change' });
  await change.click();
  await expect(change).toHaveAttribute('aria-expanded', 'true');
  const accounts = page.getByRole('list', { name: 'Use demo account' });
  await expect(accounts.getByRole('button')).toHaveText(ACCOUNTS);
  await accounts.getByRole('button', { name: /^Timetable instructor/ }).click();
  await expect(trainerId).toHaveValue('TR-10377');
  await expect(trainerId).toBeFocused();
  await expect(page.getByText('Demo account: Vikas Shinde · Timetable instructor')).toBeVisible();

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Is this you?')).toBeVisible();
  await expect(page.locator('main').getByText('Vikas Shinde')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, continue' }).click();
  await page.waitForURL(/\/home$/);
  await expect(page.getByRole('heading', { name: 'Today’s timetable' })).toBeVisible();
});

test('typing over a picked value forgets the pick', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'first_time', /\/login$/);
  await page.getByRole('button', { name: 'Use demo account' }).click();
  await page.getByRole('list', { name: 'Use demo account' }).getByRole('button', { name: /^Open instructor/ }).click();
  await expect(page.getByText('Demo account: Rajesh Patil · Open instructor')).toBeVisible();
  await page.getByLabel('Institute code').fill('27411');
  await expect(page.getByText(/Demo account:/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use demo account' })).toHaveAttribute('aria-expanded', 'false');
});

test('quick login from the demo panel, and "Skip login screens" under Advanced', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  await page.getByRole('button', { name: 'Open demo controls' }).click();
  let panel = page.getByRole('dialog', { name: 'Demo controls' });
  await panel.getByRole('button', { name: /Timetable instructor/ }).click();
  await page.waitForURL(/\/login$/);
  // The login screens highlight that person under "Use demo account"; nothing is filled yet.
  await page.getByRole('button', { name: 'Use demo account' }).click();
  await expect(page.getByRole('list', { name: 'Use demo account' }).getByRole('button', { name: /^Timetable instructor/ })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByLabel('Institute code')).toHaveValue('');

  await page.getByRole('button', { name: 'Open demo controls' }).click();
  panel = page.getByRole('dialog', { name: 'Demo controls' });
  await panel.getByText('Advanced').click();
  await panel.getByRole('radiogroup', { name: 'Skip login screens' }).getByRole('radio', { name: 'On' }).click();
  await panel.getByRole('button', { name: /Batch-mapped instructor/ }).click();
  await page.waitForURL(/\/home$/);
  await expect(page.getByText(/Good morning, Sunita/)).toBeVisible();
});
