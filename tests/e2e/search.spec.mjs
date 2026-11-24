import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ locale: 'zh-TW' });

const NOTE_ZH = '今天上班好累，主管又改需求';
const NOTE_EN = 'Slept badly, worried about the exam <b>bold</b> ' + 'a'.repeat(70);
const CONCERN = '爸媽一直催我回家工作';

async function silentCheckin(page, note) {
  await page.locator('[data-key="silent-checkin"]').click();
  await page.fill('#note', note);
  await page.locator('[data-key="save"]').click();
  await expect(page.locator('[data-key="silent-checkin"]')).toBeVisible();
}

// two silent check-ins and one saved lens exercise
async function seed(page) {
  await page.goto('/');
  await page.locator('.prompt-text').waitFor();
  const w = page.locator('[data-key="welcome-close"]');
  if (await w.count()) await w.click();
  await silentCheckin(page, NOTE_ZH);
  await silentCheckin(page, NOTE_EN);
  await page.goto('/#lens');
  await page.locator('[data-key="lens-start"]').click();
  await page.fill('#lens-concern', CONCERN);
  await page.locator('[data-key="topic-family"]').click();
  await page.locator('[data-key="lens-concern-next"]').click();
  await page.getByRole('button', { name: /自己選/ }).click();
  await page.locator('[data-key="pick-family-systems"]').click();
  const answers = ['哥哥也被催過', '我夾在爸爸和媽媽中間', '我想先留在這裡兩年', '再想想'];
  for (let i = 0; i < 4 && !(await page.locator('.lens-summary').count()); i++) {
    await page.fill('#lens-answer', answers[i]);
    await page.locator('[data-key="lens-next"]').click();
  }
  await page.locator('[data-key="lens-save"]').click();
  await expect(page.locator('#toast')).toContainText('已儲存');
  await page.goto('/#journal');
  await expect(page.locator('.silent-list li')).toHaveCount(2);
}

const search = (page) => page.getByRole('search').getByLabel('搜尋你寫過的內容');
const hits = (page) => page.locator('.search-hit');
const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('search finds check-ins and lens exercises in Chinese and English, and opens them', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await seed(page);

  // Chinese: 工作 is in the lens concern; the check-in says 上班, found as a synonym
  await search(page).fill('工作');
  await expect(page.locator('.search-count')).toHaveText('2 筆結果');
  await expect(page.locator('.search-count')).toHaveAttribute('role', 'status');
  await expect(hits(page)).toHaveCount(2);
  await expect(hits(page).nth(0)).toContainText('換角度練習');
  await expect(hits(page).nth(0).locator('mark')).toHaveText(['工作']);
  await expect(hits(page).nth(1)).toContainText('只記心情');
  await expect(hits(page).nth(1).locator('mark')).toHaveText(['上班']);
  // while searching, the results are the page
  await expect(page.locator('.silent-list')).toBeHidden();
  expect(await sideways(page)).toBeLessThanOrEqual(0);

  // English, with stemming (sleep finds Slept) and a word still being typed (exa finds exam)
  await search(page).fill('sleep');
  await expect(hits(page)).toHaveCount(1);
  await expect(hits(page).locator('mark')).toHaveText(['Slept']);
  await search(page).fill('exa');
  await expect(hits(page).locator('mark')).toHaveText(['exam']);
  // what the person wrote is shown as text, never parsed
  await expect(hits(page).locator('.search-snippet')).toContainText('<b>bold</b>');
  await expect(hits(page).locator('.search-snippet b')).toHaveCount(0);
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => [...document.querySelectorAll('.search-hit')].every((n) => n.getBoundingClientRect().right <= 390))).toBe(true);

  // open the check-in, close it, and land back on the same result
  await hits(page).first().click();
  await expect(page.locator('#sheet [role="dialog"]')).toContainText('Slept badly');
  await expect(page.locator('#sheet h2')).toHaveText('只記心情');
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  await page.locator('#sheet .back').click();
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(hits(page).first()).toBeFocused();
  await expect(search(page)).toHaveValue('exa');

  // open the lens exercise: the worry and the answers
  await search(page).fill('爸媽');
  await expect(hits(page).locator('mark')).toHaveText(['爸媽']);
  await expect(hits(page).first()).toContainText('換角度練習 · 家族系統取向');
  await hits(page).first().click();
  await expect(page.locator('#sheet h2')).toHaveText('家族系統取向');
  await expect(page.locator('#sheet .detail-note')).toHaveText(CONCERN);
  await expect(page.locator('#sheet ol')).toContainText('哥哥也被催過');
  await page.locator('#sheet .back').click();
  await expect(page.locator('#sheet')).toBeHidden();

  // nothing found: a plain line
  await search(page).fill('zzzz');
  await expect(page.locator('.search-count')).toHaveText('找不到符合的內容。');
  await expect(hits(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('keyboard: arrows move through results, Escape clears and brings the journal back', async ({ page }) => {
  await seed(page);
  await search(page).fill('工作');
  await expect(hits(page)).toHaveCount(2);
  await search(page).press('ArrowDown');
  await expect(hits(page).nth(0)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(hits(page).nth(1)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(search(page)).toBeFocused();
  await search(page).press('Enter');
  await expect(hits(page).nth(0)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#sheet [role="dialog"]')).toBeVisible();
  await page.locator('#sheet .back').click();
  await expect(hits(page).nth(0)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(search(page)).toBeFocused();
  await expect(search(page)).toHaveValue('');
  await expect(page.locator('.silent-list')).toBeVisible();
  await expect(page.locator('.search-count')).toHaveText('');
});

test('a deleted check-in leaves the results, and nothing about the search is stored', async ({ page }) => {
  await seed(page);
  await search(page).fill('主管');
  await expect(hits(page)).toHaveCount(1);
  await page.locator('[data-key="journal-search-clear"]').click();
  await expect(search(page)).toBeFocused();
  page.once('dialog', (d) => d.accept());
  await page.locator('.silent-list li', { hasText: '主管' }).locator('button').click();
  await expect(page.locator('.silent-list li')).toHaveCount(1);
  await search(page).fill('主管');
  await expect(page.locator('.search-count')).toHaveText('找不到符合的內容。');
  // a reload rebuilds the index from what is stored
  await page.reload();
  await search(page).fill('exam');
  await expect(hits(page)).toHaveCount(1);
  const stored = await page.evaluate(async () => {
    const stores = await new Promise((resolve) => {
      const q = indexedDB.open('murmur');
      q.onsuccess = () => resolve([...q.result.objectStoreNames]);
    });
    const dbs = indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : ['murmur'];
    return { stores, dbs, local: JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }), url: location.href };
  });
  expect(stored.stores.sort()).toEqual(['audio', 'entries', 'lensSessions', 'nights', 'settings']);
  expect(stored.dbs).toEqual(['murmur']);
  expect(stored.local).not.toContain('exam');
  expect(stored.url).not.toContain('exam');
});

test.describe('English', () => {
  test.use({ locale: 'en-US' });
  test('the field is labelled and counts results in English', async ({ page }) => {
    await page.goto('/');
    await page.locator('.prompt-text').waitFor();
    const w = page.locator('[data-key="welcome-close"]');
    if (await w.count()) await w.click();
    await silentCheckin(page, 'Long walk with my mother by the river');
    await page.goto('/#journal');
    const field = page.getByRole('search').getByLabel('Search what you wrote');
    await field.fill('mom');
    await expect(page.locator('.search-count')).toHaveText('1 result');
    await expect(hits(page).locator('mark')).toHaveText(['mother']);
    await expect(hits(page)).toContainText('Silent check-in');
    await field.fill('nothing like this');
    await expect(page.locator('.search-count')).toHaveText('Nothing matches.');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
  });
});

for (const scheme of ['light', 'dark']) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme });
    test('no WCAG A/AA violations with results showing, or in an opened result', async ({ page }) => {
      await seed(page);
      await search(page).fill('工作');
      await expect(hits(page)).toHaveCount(2);
      const audit = async () => {
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
      };
      expect(await audit()).toEqual([]);
      await hits(page).first().click();
      await expect(page.locator('#sheet [role="dialog"]')).toBeVisible();
      expect(await audit()).toEqual([]);
    });
  });
}
