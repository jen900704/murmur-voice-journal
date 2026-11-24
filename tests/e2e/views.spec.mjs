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
