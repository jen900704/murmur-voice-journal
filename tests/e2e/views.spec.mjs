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

test('after ten real entries the journal offers a backup, then waits a month', async ({ page }) => {
  await page.goto('/');
  await page.locator('.prompt-text').waitFor();
  await page.evaluate(async () => {
    const data = await fetch('./demo/demo-data.json').then((r) => r.json());
    await new Promise((res) => {
      const q = indexedDB.open('murmur', 3);
      q.onsuccess = () => {
        const t = q.result.transaction('entries', 'readwrite');
        data.entries.slice(0, 12).forEach((e, i) => t.objectStore('entries').put({ ...e, id: 'r' + i, demo: false, hasAudio: false, createdAt: Date.now() - i * 86400000 }));
        t.oncomplete = res;
      };
    });
  });
  await page.goto('/#journal');
  await page.reload();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-key="backup-now"]').click()]);
  expect(download.suggestedFilename()).toMatch(/^murmur-backup-/);
  await expect(page.locator('[data-key="backup-now"]')).toHaveCount(0);
});

test.describe('on iPhone Safari', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  test('once past the welcome, Today says once how to move to the Home Screen', async ({ page }) => {
    await page.goto('/');
    await page.locator('.prompt-text').waitFor();
    await page.evaluate(async () => {
      const data = await fetch('./demo/demo-data.json').then((r) => r.json());
      await new Promise((res) => {
        const q = indexedDB.open('murmur', 3);
        q.onsuccess = () => {
          const t = q.result.transaction('entries', 'readwrite');
          data.entries.slice(0, 2).forEach((e, i) => t.objectStore('entries').put({ ...e, id: 'i' + i, demo: false, hasAudio: false, createdAt: Date.now() - i * 86400000 }));
          t.oncomplete = res;
        };
      });
    });
    await page.reload();
    await page.locator('[data-key="ios-install-ok"]').click();
    await expect(page.locator('[data-key="ios-install-ok"]')).toHaveCount(0);
    await page.waitForTimeout(300); // let the setting reach the database
    await page.reload();
    await page.locator('.prompt-text').waitFor();
    await expect(page.locator('[data-key="ios-install-ok"]')).toHaveCount(0);
  });
});

test('a damaged backup imports what it can and every screen still opens', async ({ page }) => {
  await page.goto('/');
  await page.locator('.prompt-text').waitFor();
  const demo = await page.evaluate(() => fetch('./demo/demo-data.json').then((r) => r.json()));
  const good = { ...demo.entries[0], id: 'good', createdAt: Date.now() - 3600000, demo: false };
  const backup = {
    app: 'murmur',
    version: 1,
    entries: [good, { ...good, id: 'future', createdAt: 9e15 }, { id: 'nofeat', createdAt: Date.now() }, null, 'x'],
    nights: [{ id: 'n1', kindness: 'no date' }, { id: 'n2', createdAt: Date.now(), kindness: '<img src=x onerror=alert(1)>', seed: 's' }],
    lensSessions: [{ id: 's1', createdAt: Date.now(), lensId: 'gestalt', answers: null }],
  };
  page.on('dialog', (d) => d.dismiss());
  await page.goto('/#about');
  await page.locator('input[type="file"]').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator('.toast')).toContainText(/1/);
  for (const tab of ['today', 'journal', 'trends', 'lens', 'about']) {
    await page.goto('/#' + tab);
    await expect(page.locator('#main section')).toBeVisible();
  }
  await page.goto('/#journal');
  await page.locator('[data-key="jmode-nights"]').click();
  await expect(page.locator('#main img')).toHaveCount(0);
  await page.goto('/#lens');
  await page.locator('.lens-link', { hasText: /saved|存下/i }).click();
  await expect(page.locator('.lens-summary')).toHaveCount(1);
});
