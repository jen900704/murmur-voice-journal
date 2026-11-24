import { test, expect } from '@playwright/test';
import { fakeMic, record, storedEntries } from './helpers.mjs';

test.use({ locale: 'en-US', launchOptions: fakeMic('speech.wav') });

test('records, analyzes, and saves an entry with a check-in', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await record(page);
  await expect(page.locator('.result-head')).toBeVisible();
  await expect(page.locator('.rows .row')).toHaveCount(5);
  await expect(page.locator('main')).not.toContainText('null');

  // keyboard on the mood scale
  await page.focus('[data-key="mood-4"]');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-key="mood-5"]')).toBeFocused();
  await expect(page.locator('[data-key="mood-5"]')).toHaveAttribute('aria-checked', 'true');

  await page.fill('#note', '=SUM(1)');
  await page.click('[data-key="save"]');
  await expect(page.locator('.rec-btn')).toBeVisible();

  const entries = await storedEntries(page);
  expect(entries).toHaveLength(1);
  const e = entries[0];
  expect(e.features.ok).toBe(true);
  expect(e.mood).toBe(5);
  expect(e.featureVersion).toBe(2);
  expect(e.features.f0MedianHz).toBeGreaterThan(70);
  expect(e.capture.mimeType).toContain('audio/');
  expect(errors).toEqual([]);
});

test('entry detail opens as a dialog, plays audio, and closes with Escape', async ({ page }) => {
  await page.goto('/');
  await record(page);
  await page.click('[data-key="save"]');
  await page.goto('/#journal');
  await page.locator('.tile').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#sheet [role="dialog"]')).toBeVisible();
  await expect(page.locator('#main')).toHaveAttribute('inert', '');
  await expect(page.locator('#sheet audio')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page.locator('.tile').first()).toBeFocused();
});

test('CSV export escapes formula-like notes', async ({ page }) => {
  await page.goto('/');
  await record(page);
  await page.fill('#note', '=HYPERLINK("x")');
  await page.click('[data-key="save"]');
  await page.goto('/#about');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const file = await (await download).path();
  const { readFileSync } = await import('node:fs');
  const row = readFileSync(file, 'utf8').replace(/^﻿/, '').split('\n')[1];
  expect(row).toContain(`"'=HYPERLINK(""x"")"`);
});
