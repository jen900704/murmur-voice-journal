import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Clicks a button on the Trends tab and returns the downloaded file's name and text.
async function grab(page, key) {
  const dl = page.waitForEvent('download');
  await page.locator(`[data-key="${key}"]`).click();
  const file = await dl;
  return { name: file.suggestedFilename(), text: readFileSync(await file.path(), 'utf8') };
}

async function loadDemo(page) {
  await page.goto('/#journal');
  await page.locator('[data-key="journal-demo"]').click();
  await expect(page).toHaveURL(/#trends$/);
  await expect(page.locator('.links-table')).toBeVisible();
}

test('no recordings: the voice report is not offered', async ({ page }) => {
  await page.goto('/#trends');
  await expect(page.locator('.trends .empty')).toBeVisible();
  await expect(page.locator('.voice-report')).toHaveCount(0);
  await expect(page.locator('[data-key="voice-report-html"]')).toHaveCount(0);
});

test.describe('en-US', () => {
  test.use({ locale: 'en-US' });

  test('demo data: both files download, are labeled synthetic, and match the screen', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await loadDemo(page);
    await expect(page.locator('[data-key="voice-report-html"]')).toHaveText('Download my voice report');
    await expect(page.locator('[data-key="voice-report-demo"]')).toBeVisible();
    await expect(page.locator('[data-key="voice-report-notes"]')).not.toBeChecked();

    const html = await grab(page, 'voice-report-html');
    expect(html.name).toMatch(/^murmur-voice-report-demo-\d{4}-\d\d-\d\d\.html$/);
    expect(html.text).toMatch(/^<!doctype html>/);
    expect(html.text).toContain('SYNTHETIC DEMO DATA');
    expect(html.text).toContain('40 synthetic demo entries');
    expect(html.text).not.toMatch(/<script|<link|src=|https?:\/\//);
    expect(html.text).not.toContain('—');
    for (const s of ['YIN', 'intensity peaks', '250 ms', 'aperiodicity', 'Confidence: higher', 'Fisher z', 'Five measures are tested at once', 'not a diagnosis', 'tone languages', 'Psychometrika']) {
      expect(html.text).toContain(s);
    }

    const json = await grab(page, 'voice-report-json');
    expect(json.name).toMatch(/^murmur-voice-report-demo-\d{4}-\d\d-\d\d\.json$/);
    const data = JSON.parse(json.text);
    expect(data.synthetic).toBe(true);
    expect(data.privacy).toMatchObject({ audioIncluded: false, notesIncluded: false });
    expect(data.recordings.used).toBe(40);
    expect(data.features.map((f) => f.key)).toEqual(['f0MedianHz', 'f0SdSt', 'speechRate', 'pauseRatio', 'periodicityDb']);
    for (const f of data.features) {
      expect(f.usualRange.status).toBe('ok');
      expect(f.usualRange.recordings).toBe(40);
      expect(f.usualRange.low).toBeLessThan(f.usualRange.median);
      expect(f.usualRange.high).toBeGreaterThan(f.usualRange.median);
      expect(f.recent).toHaveLength(10);
    }
    expect(json.text).not.toContain('contour');
    expect(data.recordings.recent.every((r) => !('note' in r))).toBe(true);
    expect(data.references).toHaveLength(3);

    // the correlations are the ones in the table on the screen, written the same way
    expect(data.moodLinks.status).toBe('ok');
    expect(data.moodLinks.rows).toHaveLength(5);
    for (const row of data.moodLinks.rows) {
      expect(row.rho).toMatch(/^−?(\.\d\d|1\.00)$/);
      const cell = page.locator('.links-table tbody tr', { has: page.locator('th', { hasText: new RegExp(`^${row.name}$`) }) }).locator('td').first();
      await expect(cell.locator('.r')).toHaveText(row.rho);
      await expect(cell.locator('.ci')).toHaveText(`[${row.interval[0]}, ${row.interval[1]}]`);
      expect(html.text).toContain(`<td>${row.rho}</td>`);
    }
    expect(errors).toEqual([]);
  });
});

test.describe('zh-TW', () => {
  test.use({ locale: 'zh-TW', colorScheme: 'dark' });

  test('demo data: the report is in Chinese and says it is synthetic', async ({ page }) => {
    await loadDemo(page);
    await expect(page.locator('[data-key="voice-report-html"]')).toHaveText('下載我的聲音報告');
    await page.locator('[data-key="voice-report-notes"]').check();
    const html = await grab(page, 'voice-report-html');
    expect(html.text).toContain('lang="zh-Hant-TW"');
    expect(html.text).toContain('合成的示範資料');
    expect(html.text).toContain('可信度：較高');
    expect(html.text).toContain('不是診斷');
    expect(html.text).toContain('備註');
    expect(html.text).not.toContain('—');
    const data = JSON.parse((await grab(page, 'voice-report-json')).text);
    expect(data.language).toBe('zh-TW');
    expect(data.privacy.notesIncluded).toBe(true);
    expect(data.features[0].name).toBe('音高');
  });
});

test('real recordings: no synthetic label, flagged ones are left out, notes only when ticked', async ({ page }) => {
  await page.goto('/');
  await page.locator('.prompt-text').waitFor();
  await page.evaluate(async () => {
    const data = await fetch('./demo/demo-data.json').then((r) => r.json());
    const entries = data.entries.slice(0, 12).map((e, i) => ({
      ...e,
      id: `real-${i}`,
      demo: false,
      hasAudio: false,
      createdAt: Date.now() - (12 - i) * 86400000,
      note: i === 11 ? 'walked <home> in the rain' : '',
      features: i === 0 ? { ...e.features, quality: { ...e.features.quality, flags: ['noisy'] } } : e.features,
    }));
    await new Promise((res, rej) => {
      const q = indexedDB.open('murmur');
      q.onsuccess = () => {
        const tx = q.result.transaction('entries', 'readwrite');
        for (const e of entries) tx.objectStore('entries').put(e);
        tx.oncomplete = res;
        tx.onerror = rej;
      };
    });
  });
  await page.goto('/#trends');
  await page.reload();
  await expect(page.locator('.voice-report')).toBeVisible();
  await expect(page.locator('[data-key="voice-report-demo"]')).toHaveCount(0);

  const plain = await grab(page, 'voice-report-json');
  expect(plain.name).not.toContain('demo');
  const data = JSON.parse(plain.text);
  expect(data.synthetic).toBe(false);
  expect(data.recordings.used).toBe(11);
  expect(data.recordings.qualityLeftOut).toHaveLength(1);
  expect(data.recordings.qualityLeftOut[0].flags).toEqual(['noisy']);
  expect(data.features[0].usualRange.recordings).toBe(11);
  expect(data.moodLinks.status).toBe('need-more');
  expect(plain.text).not.toContain('in the rain');
  const html = await grab(page, 'voice-report-html');
  expect(html.text).not.toContain('SYNTHETIC');
  expect(html.text).not.toContain('in the rain');

  await page.locator('[data-key="voice-report-notes"]').check();
  const withNotes = await grab(page, 'voice-report-html');
  expect(withNotes.text).toContain('walked &lt;home&gt; in the rain');
});
