import { expect, openProfileMenu, preset, test } from './fixtures';

const WIDE = [
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

test('wider screens use the viewport: full-width chrome, a readable column, navigation in the header, no Profile tab', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  for (const size of WIDE) {
    await page.setViewportSize(size);
    const header = (await page.locator('header').boundingBox())!;
    expect(header.width, `header at ${size.width}`).toBeGreaterThanOrEqual(size.width - 1);
    const today = (await page.locator('main section').first().boundingBox())!;
    // Not stuck at phone width, not stretched edge to edge either.
    expect(today.width, `content at ${size.width}`).toBeGreaterThan(420);
    expect(today.width, `content at ${size.width}`).toBeLessThanOrEqual(1008);
    // One primary navigation, in the header; Profile is never a destination.
    const navs = page.getByRole('navigation', { name: 'Main' });
    await expect(navs).toHaveCount(1);
    await expect(navs.getByRole('link')).toHaveText(['Home', 'Attendance', 'Reports']);
    expect((await navs.boundingBox())!.y).toBeLessThan(header.y + header.height);
    await expect(page.getByRole('link', { name: 'Profile' })).toHaveCount(0);
    // Avatar at the top right of the header.
    const avatar = (await page.locator('header').getByRole('button', { name: 'Profile' }).boundingBox())!;
    expect(avatar.x).toBeGreaterThan(size.width / 2);
    expect(avatar.y).toBeLessThan(header.y + header.height);
  }
});

test('demo controls float collapsed on every size and overlay the app without reflowing it', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  for (const size of [{ width: 360, height: 800 }, ...WIDE]) {
    await page.setViewportSize(size);
    // Collapsed: only the trigger; no panel content anywhere in the page.
    await expect(page.getByRole('button', { name: 'Open demo controls' })).toBeVisible();
    await expect(page.getByText('Quick presets')).toHaveCount(0);
    await expect(page.getByRole('complementary')).toHaveCount(0);
    const before = (await page.locator('main').boundingBox())!;
    await page.getByRole('button', { name: 'Open demo controls' }).click();
    const panel = page.getByRole('dialog', { name: 'Demo controls' });
    await expect(panel.getByText('Quick presets')).toBeVisible();
    const box = (await panel.boundingBox())!;
    if (size.width >= 600) {
      expect(box.width).toBeLessThanOrEqual(420);
      expect(box.x + box.width).toBeGreaterThan(size.width - 40);
    } else {
      expect(box.height).toBeGreaterThan(size.height * 0.5);
    }
    expect(await page.locator('main').boundingBox()).toEqual(before);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open demo controls' })).toBeFocused();
  }
  // Tablets and desktops: the app stays usable while the panel is open.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Open demo controls' }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Reports' }).click();
  await page.waitForURL(/\/reports$/);
});

test('profile menu: a bottom sheet on phones, anchored under the avatar on desktops; Escape closes it', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'open');
  await page.setViewportSize({ width: 1280, height: 720 });
  const avatar = page.locator('header').getByRole('button', { name: 'Profile' });
  const a = (await avatar.boundingBox())!;
  const menu = await openProfileMenu(page);
  const m = (await menu.boundingBox())!;
  expect(m.y).toBeGreaterThanOrEqual(a.y + a.height);
  expect(Math.abs(m.x + m.width - (a.x + a.width))).toBeLessThanOrEqual(2);
  await expect(menu.getByText('Rajesh Patil')).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Logout' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(avatar).toBeFocused();

  await page.setViewportSize({ width: 360, height: 800 });
  const sheet = await openProfileMenu(page);
  const s = (await sheet.boundingBox())!;
  expect(s.y + s.height).toBeGreaterThanOrEqual(799);
  expect(s.width).toBeGreaterThanOrEqual(359);
  // The menu is the way into Offline data.
  await sheet.getByRole('button', { name: /Offline data/ }).click();
  await page.waitForURL(/\/profile\/offline$/);
});

test('attendance stays a row list in a readable column on a monitor, with a centred primary action', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'batch');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('main').getByRole('link', { name: /Shift 1 · Unit 2/ }).click();
  await page.waitForURL(/\/attendance\/mark/, { timeout: 20_000 });
  // 800px reading column (rows add their own 16px padding either side).
  const list = (await page.getByRole('list', { name: /Electrician/ }).boundingBox())!;
  expect(list.width).toBeLessThanOrEqual(832);
  expect(list.x).toBeGreaterThan(400);
  const cta = (await page.getByRole('button', { name: 'Review & Submit' }).boundingBox())!;
  expect(cta.width).toBeLessThanOrEqual(281);
  expect(Math.abs(cta.x + cta.width / 2 - 960)).toBeLessThanOrEqual(2);
  await expect(page.getByRole('table')).toHaveCount(0);
});
