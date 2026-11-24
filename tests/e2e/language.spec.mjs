import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';

// The language mirror, tested through a harness page that mounts js/language-view.js with
// stand-ins for the app's helpers (tests/e2e/language-harness.html).
const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (p) => path.join(here, '..', 'fixtures', 'exports', p);
const HARNESS = '/tests/e2e/language-harness.html';

const ZH_TEXT = Array.from({ length: 12 }, (_, i) => `我今天和朋友一起去吃飯，我覺得很開心。可是我最近工作壓力很大，我沒有睡好，也許明天我們再聊。第${i + 1}天。`).join('\n');
const EN_TEXT = Array.from({ length: 30 }, (_, i) => `I think the walk helped me today, and I am grateful because my friend came along. Maybe we will go again tomorrow, but I worry about the deadline. Day ${i + 1}.`).join(' ');

function watch(page) {
  const outside = [];
  const errors = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost')) outside.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return { outside, errors };
}

test.describe('language mirror', () => {
  test.use({ locale: 'zh-TW' });

  test('paste Chinese text: notice, scores, evidence with highlights, counterfactual; nothing leaves the device', async ({ page }) => {
    const w = watch(page);
    await page.goto(HARNESS);
    await expect(page.getByRole('heading', { name: '語言鏡' })).toBeVisible();
    await page.fill('#ll-text', ZH_TEXT);
    await page.locator('[data-key="ll-analyze"]').click();
    await expect(page.getByRole('heading', { name: '你的用詞' })).toBeVisible();
    await expect(page.locator('[data-key="ll-notice"]')).toHaveText('這是自我探索用的語言分析，不是專業評估或診斷，也不能判斷一個人的人格、心理狀態或是否說謊。');
    // tier 1 is open, the other sections are folded until asked for
    await expect(page.locator('[data-key="ll-group-core"]')).toHaveAttribute('open', '');
    await expect(page.locator('[data-key="ll-group-moral"]')).not.toHaveAttribute('open', '');
    const row = page.locator('[data-key="score-i"]');
    await expect(row).toContainText('每 100 個中文字');
    await expect(row).toContainText('90% 區間');
    // open the evidence for "I-words"
    await row.click();
    const sheet = page.locator('#sheet');
    await expect(sheet.getByRole('heading', { name: '「我」的詞' })).toBeVisible();
    await expect(sheet.locator('[data-key="ll-words"] tbody tr').first()).toContainText('我');
    await expect(sheet.locator('[data-key="ll-cf"]')).toContainText('拿掉');
    await expect(sheet.locator('[data-key="ll-cannot"]')).toContainText('不代表任何個人特質或狀態');
    const marks = sheet.locator('mark.ll-hit');
    expect(await marks.count()).toBeGreaterThan(10);
    expect(await marks.allTextContents()).toEqual(Array(await marks.count()).fill('我'));
    // 我 inside 我們 is not highlighted
    expect(await sheet.locator('.ll-excerpt').first().textContent()).toContain('我們');
    await sheet.locator('.back').click();
    // a folded section opens on request; a short-text category says so and is not shown as a number
    await page.locator('[data-key="ll-group-moral"] > summary').click();
    await expect(page.locator('[data-key="score-care"]')).toContainText('文字還不夠');
    expect(w.outside).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('user text is never read as markup', async ({ page }) => {
    const w = watch(page);
    await page.goto(HARNESS + '?sheet=0');
    await page.fill('#ll-text', `我<img src=x onerror="window.__hit=1"> 覺得 <b>我</b> <script>window.__hit=1</script> ${ZH_TEXT}`);
    await page.locator('[data-key="ll-analyze"]').click();
    await page.locator('[data-key="score-i"]').click();
    await expect(page.locator('.ll-excerpt').first()).toContainText('<img src=x');
    expect(await page.locator('.ll-excerpt img, .ll-excerpt b, .ll-excerpt script').count()).toBe(0);
    expect(await page.evaluate(() => window.__hit)).toBeUndefined();
    // without a sheet helper the detail opens in place and can go back
    await page.locator('[data-key="ll-back"]').click();
    await expect(page.locator('[data-key="score-i"]')).toBeVisible();
    expect(w.errors).toEqual([]);
  });

  test('risk language shows help lines above the results and beside the loss section; the analysis still runs', async ({ page }) => {
    await page.goto(HARNESS);
    await page.fill('#ll-text', ZH_TEXT + '\n那陣子我真的不想活了。阿嬤過世之後我很想念她。');
    await page.locator('[data-key="ll-analyze"]').click();
    const help = page.locator('[data-key="ll-help"]');
    await expect(help).toBeVisible();
    await expect(help.locator('a[href="tel:1925"]')).toBeVisible();
    // help comes before the first score
    const order = await page.evaluate(() => {
      const a = document.querySelector('[data-key="ll-help"]');
      const b = document.querySelector('[data-key="score-i"]');
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    });
    expect(order).toBeTruthy();
    await page.locator('[data-key="ll-group-loss"] > summary').click();
    await expect(page.locator('[data-key="ll-group-loss"] .ll-help a[href="tel:1925"]')).toBeVisible();
    await expect(page.locator('[data-key="score-i"]')).toBeVisible();
  });

  test('no help panel without risk language; nothing is stored unless kept; keep, compare, delete', async ({ page }) => {
    await page.goto(HARNESS);
    await page.fill('#ll-text', ZH_TEXT);
    await page.locator('[data-key="ll-analyze"]').click();
    await expect(page.locator('[data-key="score-i"]')).toBeVisible();
    await expect(page.locator('[data-key="ll-help"]')).toHaveCount(0);
    const stored = () =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            const q = indexedDB.open('murmur-langlab');
            q.onupgradeneeded = () => q.result.createObjectStore('texts', { keyPath: 'id' });
            q.onsuccess = () => {
              const r = q.result.transaction('texts').objectStore('texts').getAll();
              r.onsuccess = () => {
                q.result.close();
                resolve(r.result.length);
              };
            };
          })
      );
    expect(await stored()).toBe(0);
    await page.locator('[data-key="ll-keep"]').click();
    await expect(page.locator('#toast')).toHaveText('已留在這個裝置上。');
    expect(await stored()).toBe(1);
    // a second text is compared with the kept one, never with other people
    await page.locator('[data-key="ll-restart"]').click();
    await expect(page.locator('.ll-kept li')).toHaveCount(1);
    await page.fill('#ll-text', ZH_TEXT.replaceAll('我', '他'));
    await page.locator('[data-key="ll-analyze"]').click();
    await expect(page.locator('[data-key="score-other"]')).toContainText('你之前留下的文字');
    await page.locator('[data-key="ll-restart"]').click();
    await page.locator('.ll-kept button').click();
    await expect(page.locator('.ll-kept')).toHaveCount(0);
    expect(await stored()).toBe(0);
  });

  test('import an X archive: files listed, time series with a table, report downloads', async ({ page }) => {
    const w = watch(page);
    await page.goto(HARNESS);
    await page.setInputFiles('#ll-file', [fx('x-long/data/tweets.js'), fx('instagram/posts_1.json')]);
    await expect(page.locator('.ll-files li')).toHaveCount(2);
    await expect(page.locator('.ll-files')).toContainText('X 貼文，168 則');
    await expect(page.locator('.ll-files')).toContainText('Instagram 貼文，2 則');
    await page.locator('[data-key="ll-analyze"]').click();
    await expect(page.getByRole('heading', { name: '你的用詞' })).toBeVisible();
    // English has more text, so it is shown first; both languages are offered
    await expect(page.locator('[data-key="ll-lang-en"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-key="score-i"]')).toContainText('每 100 個單字');
    await expect(page.locator('.ll-chart')).toBeVisible();
    expect(await page.locator('.ll-point').count()).toBe(3);
    await page.locator('.ll-series details > summary').click();
    await expect(page.locator('.ll-series tbody tr')).toHaveCount(3);
    await page.selectOption('#ll-series-cat', 'i');
    await expect(page.locator('.ll-series tbody tr').first()).toContainText('2023-01');
    // English-only scores open like the others
    await page.locator('[data-key="ll-group-feelings"] > summary').click();
    await page.locator('[data-key="score-vader"]').click();
    await expect(page.locator('#sheet [data-key="ll-cannot"]')).toContainText('不是你的心情');
    expect(await page.locator('#sheet mark.ll-hit').count()).toBeGreaterThan(5);
    await page.locator('#sheet .back').click();
    // the report: HTML that needs no script, and JSON
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-key="ll-report-html"]').click()]);
    expect(dl.suggestedFilename()).toMatch(/^murmur-language-report-\d{4}-\d{2}-\d{2}\.html$/);
    const html = readFileSync(await dl.path(), 'utf8');
    expect(html).toContain('這是自我探索用的語言分析，不是專業評估或診斷');
    expect(html).toContain('VADER');
    expect(html).toContain('MIT');
    expect(html).toContain('tweets.js');
    expect(html).not.toMatch(/<script|<link/i);
    expect(html).not.toContain('the project will work out'); // no source text in the report
    const [dj] = await Promise.all([page.waitForEvent('download'), page.locator('[data-key="ll-report-json"]').click()]);
    const json = JSON.parse(readFileSync(await dj.path(), 'utf8'));
    expect(json.languages.en.scores.find((s) => s.id === 'i').interval).toHaveLength(2);
    expect(json.languages.zh.items).toBe(2);
    expect(json.input.textSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(w.outside).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('import a zip export and a Meta file with broken encoding; unreadable files are named', async ({ page }) => {
    await page.goto(HARNESS);
    await page.setInputFiles('#ll-file', [fx('export.zip'), fx('facebook/comments.json'), fx('broken.json')]);
    await expect(page.locator('.ll-files li')).toHaveCount(3);
    await expect(page.locator('.ll-files')).not.toContainText('message_1.json');
    await expect(page.locator('.ll-status')).toContainText('broken.json：讀不出來');
    await page.locator('[data-key="ll-analyze"]').click();
    await page.locator('[data-key="ll-lang-zh"]').click();
    await page.locator('[data-key="ll-group-social"] > summary').click();
    await page.locator('[data-key="score-friend"]').click();
    // repaired text is shown, and the hashtag and mention are displayed but not counted
    await expect(page.locator('#sheet .ll-excerpt').first()).toContainText('今天和朋友一起吃飯，很開心 #美食 @friend');
    await expect(page.locator('#sheet mark.ll-hit')).toHaveText(['朋友']);
  });

  test('English interface with dark colors: labels, analysis, accessibility', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US', colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto(HARNESS + '?lang=en');
    await expect(page.getByLabel('Paste text')).toBeVisible();
    await expect(page.getByLabel('Or choose files')).toBeVisible();
    let axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await page.locator('[data-key="ll-analyze"]').click();
    await expect(page.locator('.ll-status')).toContainText('Paste some text or choose a file first.');
    await page.fill('#ll-text', EN_TEXT);
    await page.locator('[data-key="ll-analyze"]').click();
    await expect(page.locator('[data-key="ll-notice"]')).toHaveText('This is language analysis for self-reflection, not a professional assessment or diagnosis, and it cannot judge personality, mental state, or whether someone is lying.');
    await expect(page.locator('[data-key="score-i"]')).toContainText('per 100 words, 90% interval');
    for (const g of ['thinking', 'feelings', 'social', 'power', 'loss', 'drives', 'moral', 'style', 'topics']) await page.locator(`[data-key="ll-group-${g}"] > summary`).click();
    await expect(page.locator('[data-key="score-analytic"]')).toContainText('interval');
    await expect(page.locator('[data-key="score-status"]')).toBeVisible();
    const body = await page.locator('.view.language').textContent();
    expect(body).not.toMatch(/depress|personality score|honesty|decepti|liberal|conservative/i);
    axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 80)}`)).toEqual([]);
    await page.locator('[data-key="score-authentic"]').click();
    await expect(page.locator('#sheet')).toContainText('cannot tell whether a statement is true');
    axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 80)}`)).toEqual([]);
    // keyboard: the sheet's back control has focus, and Enter returns
    await expect(page.locator('#sheet .back')).toBeFocused();
    await context.close();
  });
});
