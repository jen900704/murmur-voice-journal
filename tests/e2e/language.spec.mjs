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

  test('what stood out: three plain sentences from passing rows only, each opening its evidence', async ({ page }) => {
    await page.goto(HARNESS);
    await page.fill('#ll-text', ZH_TEXT);
    await page.locator('[data-key="ll-analyze"]').click();
    const obs = page.locator('[data-key="ll-obs"]');
    await expect(obs.getByRole('heading', { name: '比較明顯的地方' })).toBeVisible();
    // right under the notice
    expect(await page.evaluate(() => document.querySelector('[data-key="ll-notice"]').nextElementSibling.dataset.key)).toBe('ll-obs');
    // no kept texts, so these are the categories with the most hits, and the page says so
    await expect(obs).toHaveAttribute('data-mode', 'counts');
    await expect(obs).toContainText('只是出現次數最多的');
    const items = obs.locator('.ll-obs-item');
    await expect(items).toHaveCount(3);
    await expect(items.first()).toContainText(/^你常寫到自己（每 100 字約 [\d.]+ 個「我」的詞）。/);
    // never built from a row that says "not enough text", and never from a count too small for a rate
    const ids = await items.evaluateAll((els) => els.map((e) => e.dataset.key.slice(4)));
    for (const g of ['thinking', 'feelings', 'social', 'power', 'loss', 'drives', 'moral', 'style', 'topics']) await page.locator(`[data-key="ll-group-${g}"] > summary`).click();
    for (const m of await page.locator('.ll-more > summary').all()) await m.click();
    for (const id of ids) {
      const row = page.locator(`[data-key="score-${id}"]`);
      await expect(row).toContainText('每 100 個中文字');
      await expect(row).not.toContainText('文字還不夠');
    }
    const text = await obs.textContent();
    expect(text).not.toMatch(/健康|擔憂|令人|建議|應該|憂鬱|焦慮|症|診斷|良好|不好/);
    // each observation opens its own evidence
    await items.first().click();
    await expect(page.locator('#sheet').getByRole('heading', { name: '「我」的詞' })).toBeVisible();
    await expect(page.locator('#sheet [data-key="ll-valid"]')).toHaveText('中文還沒驗證');
  });

  test('a text too short for any rate has no observations, only a line saying so', async ({ page }) => {
    await page.goto(HARNESS);
    await page.fill('#ll-text', '今天天氣很好，出門走走。');
    await page.locator('[data-key="ll-analyze"]').click();
    await expect(page.locator('[data-key="ll-obs"]')).toHaveAttribute('data-mode', 'none');
    await expect(page.locator('[data-key="ll-obs"] .ll-obs-item')).toHaveCount(0);
    await expect(page.locator('[data-key="ll-obs"]')).toContainText('文字還不夠');
    // even the first group is one quiet line now, and it still opens
    const core = page.locator('[data-key="ll-group-core"]');
    await expect(core).not.toHaveAttribute('open', '');
    await expect(core.locator('summary')).toContainText('這一組需要更多文字（約 50 個單位，目前');
    await core.locator('summary').click();
    await expect(page.locator('[data-key="score-i"]')).toContainText('文字還不夠');
  });

  test('groups: all-short groups are one quiet line that opens; mixed groups put passing rows first behind one toggle', async ({ page }) => {
    await page.goto(HARNESS);
    await page.fill('#ll-text', ZH_TEXT);
    await page.locator('[data-key="ll-analyze"]').click();
    // every row of this group is below its minimum: one line, closed, and it still opens and closes
    const moral = page.locator('[data-key="ll-group-moral"]');
    await expect(moral).toHaveClass(/ll-group-short/);
    await expect(moral.locator('> summary')).toContainText(/這一組需要更多文字（約 \d+ 個單位，目前 344）/);
    await expect(moral.locator('.ll-more')).toHaveCount(0);
    await expect(page.locator('[data-key="score-care"]')).toBeHidden();
    await moral.locator('> summary').click();
    await expect(page.locator('[data-key="score-care"]')).toContainText('文字還不夠');
    await moral.locator('> summary').click();
    await expect(page.locator('[data-key="score-care"]')).toBeHidden();
    // a group with some passing rows: those first, then one toggle for the rest
    const social = page.locator('[data-key="ll-group-social"]');
    await expect(social).not.toHaveClass(/ll-group-short/);
    await social.locator('> summary').click();
    await expect(social.locator('> .ll-rows [data-key="score-friend"]')).toContainText('每 100 個中文字');
    expect(await social.locator('> .ll-rows').textContent()).not.toContain('文字還不夠');
    const more = page.locator('[data-key="ll-more-social"]');
    await expect(more).toHaveCount(1);
    const n = await more.locator('.ll-row').count();
    expect(n).toBeGreaterThan(0);
    await expect(more.locator('summary')).toHaveText(`還有 ${n} 項文字不夠`);
    await expect(more.locator('.ll-row').first()).toBeHidden();
    await more.locator('summary').click();
    for (const r of await more.locator('.ll-row').all()) await expect(r).toContainText('文字還不夠');
    // both stay open across a redraw
    await page.locator('[data-key="score-i"]').click();
    await page.locator('#sheet .back').click();
    await expect(more.locator('.ll-row').first()).toBeVisible();
    // the first group, all passing, has no toggle
    await expect(page.locator('[data-key="ll-group-core"] .ll-more')).toHaveCount(0);
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
    // with kept texts, what stood out is chosen by distance from them and says both numbers
    await expect(page.locator('[data-key="ll-obs"]')).toHaveAttribute('data-mode', 'baseline');
    await expect(page.locator('[data-key="ll-obs"]')).toContainText('和你自己之前留下的文字差得最多');
    await expect(page.locator('[data-key="obs-other"]')).toContainText(/^和你之前留下的文字比，這次指別人的詞比較多（每 100 字約 [\d.]+ 個，之前約 0\.00 個）。/);
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
    await expect(page.locator('[data-key="ll-obs"] .ll-obs-item').first()).toHaveText(/^You write about yourself often \(about [\d.]+ I-words per 100 words\)\./);
    expect(await page.locator('[data-key="ll-obs"]').textContent()).not.toMatch(/good|bad|healthy|worr(y|ying) (sign|level)|should|anxi|disorder|symptom/i);
    for (const g of ['thinking', 'feelings', 'social', 'power', 'loss', 'drives', 'moral', 'style', 'topics']) await page.locator(`[data-key="ll-group-${g}"] > summary`).click();
    await expect(page.locator('[data-key="score-analytic"]')).toContainText('interval');
    await expect(page.locator('[data-key="score-status"]')).toBeVisible();
    const body = await page.locator('.view.language').textContent();
    expect(body).not.toMatch(/depress|personality score|honesty|decepti|liberal|conservative/i);
    axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 80)}`)).toEqual([]);
    await page.locator('[data-key="score-authentic"]').click();
    await expect(page.locator('#sheet')).toContainText('cannot tell whether a statement is true');
    await expect(page.locator('#sheet [data-key="ll-valid"]')).toHaveCount(0); // an index with no check of its own says nothing
    await page.locator('#sheet .back').click();
    await page.locator('[data-key="score-posemo"]').click();
    await expect(page.locator('#sheet [data-key="ll-valid"]')).toHaveText('Checked against human emotion labels (English): AUC .79. .50 is chance and 1.00 is perfect.');
    await page.locator('#sheet .back').click();
    await page.locator('[data-key="score-cause"]').click();
    await expect(page.locator('#sheet [data-key="ll-valid"]')).toHaveText('This category has not been checked against human labels yet.');
    axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 80)}`)).toEqual([]);
    // keyboard: the sheet's back control has focus, and Enter returns
    await expect(page.locator('#sheet .back')).toBeFocused();
    await context.close();
  });
});
