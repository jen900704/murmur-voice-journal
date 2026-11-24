import { test, expect } from '@playwright/test';

for (const [locale, scheme] of [
  ['en-US', 'light'],
  ['zh-TW', 'dark'],
]) {
  test.describe(`${locale} ${scheme}`, () => {
    test.use({ locale, colorScheme: scheme });

    test('demo data fills the journal and trends, and can be cleared', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto('/#journal');
      await page.locator('.journal .btn').click();
      await expect(page).toHaveURL(/#trends$/);
      await expect(page.locator('.demo-banner')).toBeVisible();
      await expect(page.locator('.chart')).toHaveAttribute('aria-label', /.+/);
      await expect(page.locator('.links-table tbody tr')).toHaveCount(9);
      // switch metric with the keyboard
      await page.locator('.chip.on').focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.chip.on')).toBeFocused();
      await page.goto('/#journal');
      await expect(page.locator('.tile')).toHaveCount(40);
      await page.locator('.demo-banner .link').click();
      await expect(page.locator('.tile')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });
}

test('language switch persists across reloads', async ({ page }) => {
  await page.goto('/#about');
  await page.getByRole('button', { name: '中文' }).click();
  await expect(page.locator('h1')).toContainText('低語日記');
  await page.reload();
  await expect(page.locator('h1')).toContainText('低語日記');
});

test('bedtime reminder downloads a valid daily calendar event', async ({ page }) => {
  await page.goto('/#about');
  await page.fill('#reminder-time', '21:45');
  const dl = page.waitForEvent('download');
  await page.locator('[data-key="reminder-ics"]').click();
  const { readFileSync } = await import('node:fs');
  const ics = readFileSync(await (await dl).path(), 'utf8');
  expect(ics).toContain('RRULE:FREQ=DAILY');
  expect(ics).toMatch(/DTSTART:\d{8}T214500/);
  expect(ics).toContain('BEGIN:VALARM');
});

test('first visit shows three ways in; dismissing it is remembered', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.welcome')).toBeVisible();
  await page.locator('[data-key="welcome-lens"]').click();
  await expect(page).toHaveURL(/#lens/);
  await page.goto('/#today');
  await page.reload();
  await expect(page.locator('.prompt-text')).toBeVisible();
  await expect(page.locator('.welcome')).toHaveCount(0);
});

test('breathing pacer starts, shows the phase, and stops when closed', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-key="welcome-close"]').click();
  await page.locator('[data-key="breathe-link"]').click();
  await page.locator('[data-key="breathe-start"]').click();
  await expect(page.locator('.breathe-phase')).toHaveText(/Breathe in|吸氣/);
  await expect(page.locator('.breathe-phase')).toHaveText(/Breathe out|吐氣/, { timeout: 6000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('#sheet')).toBeHidden();
});
