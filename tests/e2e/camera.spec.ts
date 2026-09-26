import { demo, expect, preset, test } from './fixtures';

/*
 * The real camera path, on Chromium's fake camera (a moving test pattern with
 * no face). Registration runs "Guided only" (detection can't find a face in the
 * pattern); the daily check proves on-device detection starts and looks for a face.
 */
test.use({ permissions: ['camera'] });

test('registration takes three photos from the live camera and stores none of them', async ({ page, consoleErrors }) => {
  void consoleErrors;
  test.setTimeout(90_000);
  await preset(page, 'first_time', /\/login$/);
  // Realistic pacing, so each photo can be seen arriving.
  await demo(page, "setSimulation({ camera: 'device', liveness: 'guided', speed: 0.3 })");
  await demo(page, "signInAs('open', false)");
  await page.goto('/face?next=/home');
  await expect(page.getByText(/Prototype: the camera takes 3 photos/)).toBeVisible();
  // Nothing is sent anywhere: record every request that isn't a same-origin GET for app files.
  const origin = new URL(page.url()).origin;
  const sent: string[] = [];
  page.on('request', (r) => {
    // blob: / data: are in-memory (the thumbnails); anything else must be a same-origin GET for app files.
    if (/^(blob|data):/.test(r.url())) return;
    if (r.method() !== 'GET' || !r.url().startsWith(origin)) sent.push(`${r.method()} ${r.url()}`);
  });
  // Record every photo thumbnail as it appears (the last one only shows briefly before the result).
  await page.evaluate(() => {
    const seen: number[] = [];
    (window as unknown as { __photos: number[] }).__photos = seen;
    new MutationObserver(() => seen.push(document.querySelectorAll('[data-captured] img[src^="blob:"]').length)).observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  await page.getByRole('button', { name: 'Start' }).click();
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.srcObject instanceof MediaStream && v.videoWidth > 0), { timeout: 15_000 }).toBe(true);
  await expect(page.getByText(/Photo in \d…/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Face registered successfully' })).toBeVisible({ timeout: 45_000 });
  // Three photos, each a real frame from the live video (blob URLs of captured JPEGs).
  expect(Math.max(...(await page.evaluate(() => (window as unknown as { __photos: number[] }).__photos)))).toBe(3);
  // The camera is off once the screen has gone.
  await expect(page.locator('video')).toHaveCount(0);
  // Only the fact of registration is kept: no image data anywhere on the device.
  const imageLike = await page.evaluate(() =>
    [...Object.entries(localStorage), ...Object.entries(sessionStorage)].filter(([, v]) => /data:image|base64|blob:/.test(v)).map(([k]) => k),
  );
  expect(imageLike).toEqual([]);
  expect(await page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).length : 0))).toBe(0);
  expect(sent).toEqual([]);
  const face = await page.evaluate(() => JSON.parse(localStorage.getItem('ksk:v1:face') ?? '{}')['st-rajesh']);
  expect(face).toMatchObject({ staffId: 'st-rajesh', sampleCount: 3, simulated: true });
  expect(Object.keys(face).sort()).toEqual(['enrolledAt', 'sampleCount', 'simulated', 'staffId']);
});

test('the daily check runs on-device face detection on the live camera', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'batch');
  await demo(page, "setSimulation({ camera: 'device', liveness: 'auto' })");
  await page.locator('main').getByRole('link', { name: /Shift 1 · Unit 2/ }).click();
  await page.waitForURL(/\/attendance\/open/);
  await expect(page.getByText('Look at the camera')).toBeVisible({ timeout: 20_000 });
  // The detector loaded (from this app's own files) and runs on the test pattern: no face yet.
  await expect(page.locator('main').getByText('Face not visible').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Photo in \d…/)).toHaveCount(0);
  await expect(page.getByText('Prototype · photos are not saved · face matching is simulated')).toBeVisible();
});

test('camera blocked: the screen says what happened and recovers after access is allowed', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await preset(page, 'batch');
  await demo(page, "setSimulation({ face: 'camera_denied' })");
  await page.locator('main').getByRole('link', { name: /Shift 1 · Unit 2/ }).click();
  const blocked = page.getByRole('heading', { name: 'Camera access is blocked' });
  await expect(blocked).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Allow the camera for SwiftChat in your phone settings/)).toBeVisible();
  // Still blocked: trying again opens the camera, fails the same way and says so again.
  const first = await blocked.elementHandle();
  await page.getByRole('button', { name: 'Try again' }).click();
  await first!.waitForElementState('hidden');
  await expect(blocked).toBeVisible();
  // The person allows access in settings, then tries again.
  await demo(page, "setSimulation({ face: 'match', permissions: { location: 'granted', camera: 'granted' } })");
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.waitForURL(/\/attendance\/mark/, { timeout: 20_000 });
});
