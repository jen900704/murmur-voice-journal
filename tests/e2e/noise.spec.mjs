import { test, expect } from '@playwright/test';
import { fakeMic, record, storedEntries } from './helpers.mjs';

test.use({ locale: 'en-US', launchOptions: fakeMic('noise.wav') });

test('noise alone is rejected and nothing is saved', async ({ page }) => {
  await page.goto('/');
  await record(page, 7);
  await expect(page.locator('.error')).toContainText('No speech was detected');
  expect(await storedEntries(page)).toHaveLength(0);
});
