import { test, expect } from '@playwright/test';

test.use({ locale: 'zh-TW', serviceWorkers: 'allow' });

test('after one visit the app works offline, with every screen from one cached release', async ({ page, context, browserName }) => {
  // Playwright's Linux WebKit cannot reload a page while context.setOffline is on ("internal error"),
  // which is a limit of the test browser, not of Safari's service workers
  test.skip(browserName === 'webkit', 'offline reload is not supported by Playwright WebKit on Linux');
  await page.goto('/?sw#today');
  await page.locator('.prompt-text').waitFor();
  // wait until the worker has installed every file, is active, and controls the page
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (reg.active.state !== 'activated') await new Promise((res) => reg.active.addEventListener('statechange', () => reg.active.state === 'activated' && res()));
    if (!navigator.serviceWorker.controller) await new Promise((res) => navigator.serviceWorker.addEventListener('controllerchange', res, { once: true }));
  });
  const names = await page.evaluate(async () => caches.keys());
  expect(names).toHaveLength(1);
  expect(names[0]).toMatch(/^murmur-[0-9a-f]{10}$/);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.prompt-text')).toBeVisible();
  await page.goto('/?sw#lens');
  await page.locator('[data-key="lens-start"]').click();
  await expect(page.locator('#lens-concern')).toBeVisible();
  await page.goto('/?sw#today');
  const w = page.locator('[data-key="welcome-close"]');
  if (await w.count()) await w.click();
  await page.locator('[data-key="breathe-link"]').click();
  await expect(page.locator('[data-key="breathe-start"]')).toBeVisible();
  await context.setOffline(false);
});
