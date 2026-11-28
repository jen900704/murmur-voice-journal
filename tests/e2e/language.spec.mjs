import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';

// Folded inside a closed <details>. Playwright's WebKit reports such content as visible, so the
// tests check the closed ancestor directly instead of toBeHidden().
const folded = (loc) =>
  loc.evaluate((el) => {
    for (let d = el.parentElement; d; d = d.parentElement) {
      if (d.tagName === 'DETAILS' && !d.open && !(el.tagName === 'SUMMARY' && el.parentElement === d)) return true;
    }
    return false;
  });

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
    // a blob: address is made on this device (the fingerprint picture), not a request to anywhere
    if (!r.url().startsWith('http://localhost') && !r.url().startsWith('blob:http://localhost')) outside.push(r.url());
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
    await page.locator('[data-key="ll-locked"] > summary').click();
    await page.locator('[data-key="ll-group-moral"] > summary').click();
    await expect(page.locator('[data-key="score-care"]')).toContainText('文字還不夠');
    expect(w.outside).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('playground: words light up as you type, each key explains its mark, samples fill the field', async ({ page }) => {
    const w = watch(page);
    await page.goto(HARNESS);
    // the first screen is the playground: a famous line is typed in and lit before anything is typed
    const lit = page.locator('[data-key="ll-lit"]');
    await expect(lit).toHaveClass(/is-sample/);
    await expect(lit.locator('[data-key="ll-famous-tag"]')).toHaveText('名句示範，不是你的資料');
    await expect(lit).toHaveAttribute('data-typing', 'false');
    await expect(lit.locator('.ll-lit-text')).toHaveText('我欲乘風歸去，又恐瓊樓玉宇，高處不勝寒。');
    await expect(lit.locator('[data-key="ll-famous-by"]')).toHaveText('蘇軾〈水調歌頭〉');
    await expect(lit.locator('mark.ll-m-self')).toHaveText('我');
    await expect(lit.locator('[data-key="ll-famous-note"]')).toHaveText('這句亮最多的是「自己」，1 個。');
    // the long list of formats and the method are one tap away, not on the first screen
    expect(await folded(page.locator('#ll-file-hint'))).toBe(true);
    await expect(page.locator('[data-key="ll-honest"]')).toContainText('這是在數詞，不是測驗。字不會離開這個裝置。');
    // typing lights the words with no button
    await page.locator('#ll-text').pressSequentially('我總是覺得我應該做得更好，也許明天我們再試。');
    await expect(lit).not.toHaveClass(/is-sample/);
    await expect(lit.locator('mark.ll-m-absolute')).toHaveText('總是');
    await expect(lit.locator('mark.ll-m-should')).toHaveText('應該');
    await expect(lit.locator('mark.ll-m-maybe')).toHaveText('也許');
    await expect(lit.locator('mark.ll-m-time')).toHaveText('明天');
    await expect(lit.locator('mark.ll-m-others')).toHaveText('我們');
    await expect(lit.locator('mark.ll-m-self')).toHaveText(['我', '我']);
    // the lit copy holds exactly what was typed
    await expect(lit.locator('.ll-lit-text')).toHaveText('我總是覺得我應該做得更好，也許明天我們再試。');
    await expect(page.locator('[data-key="ll-key-self"] .ll-key-n')).toHaveText('2');
    await expect(page.locator('[data-key="ll-key-feel"] .ll-key-n')).toHaveText('0');
    // each key opens one short line, and closes again
    const key = page.locator('[data-key="ll-key-should"]');
    await key.click();
    await expect(key).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-key="ll-key-note"]')).toHaveText('「應該」「必須」「一定要」這類字。');
    await key.click();
    await expect(page.locator('[data-key="ll-key-note"]')).toBeHidden();
    // the field kept the focus and the text while the page lit up
    await expect(page.locator('#ll-text')).toHaveValue('我總是覺得我應該做得更好，也許明天我們再試。');
    // a made-up sample fills the field
    await page.locator('[data-key="ll-sample-1"]').click();
    await expect(page.locator('#ll-text')).toHaveValue(/^我們昨天吵架了/);
    await expect(lit.locator('mark.ll-m-absolute')).toHaveText('永遠');
    // guessing is offered only once there is enough text for the first numbers
    await expect(page.locator('[data-key="ll-guess"]')).toBeHidden();
    // touch targets
    for (const k of ['ll-key-self', 'll-sample-0', 'll-how']) expect((await page.locator(`[data-key="${k}"]`).boundingBox()).height).toBeGreaterThanOrEqual(44);
    // the method opens in a sheet
    await page.locator('[data-key="ll-how"]').click();
    await expect(page.locator('#sheet').getByRole('heading', { name: '這是怎麼算的' })).toBeVisible();
    await expect(page.locator('#sheet')).toContainText('AUC .68 到 .94');
    expect(w.outside).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('famous lines: public-domain samples with their source, typed in and lit; still with reduced motion; never saved', async ({ page, browser }) => {
    await page.goto(HARNESS);
    const lit = page.locator('[data-key="ll-lit"]');
    const seen = [];
    for (let i = 0; i < 8; i++) {
      await expect(lit).toHaveAttribute('data-typing', 'false');
      await expect(lit.locator('.ll-famous-at')).toHaveText(`${i + 1} / 8`);
      seen.push([await lit.locator('.ll-lit-text').textContent(), await lit.locator('[data-key="ll-famous-by"]').textContent()]);
      if (i === 3) await expect(lit.locator('[data-key="ll-famous-note"]')).toContainText('這句一個字都沒亮');
      if (i === 4) {
        // an English line: three time words, and the keys count along
        await expect(lit.locator('mark.ll-m-time')).toHaveText(['Tomorrow', 'tomorrow', 'tomorrow']);
        await expect(page.locator('[data-key="ll-key-time"] .ll-key-n')).toHaveText('3');
      }
      const next = lit.locator('[data-key="ll-famous-next"]');
      expect((await next.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await next.click();
      // while a line is being typed the note waits
      if (i === 0) await expect(lit).toHaveAttribute('data-typing', 'true');
    }
    // Chinese first in a Chinese interface, every line with its author and source
    expect(seen.map((x) => x[1])).toEqual(['蘇軾〈水調歌頭〉', '《論語．述而》', '李清照〈聲聲慢〉', '李白〈靜夜思〉', 'William Shakespeare, Macbeth', 'William Shakespeare, Romeo and Juliet', 'Jane Austen, Pride and Prejudice', 'Abraham Lincoln, Gettysburg Address']);
    await expect(lit).toContainText('示範的句子不會存下來。');
    // a sample is never analysed or kept: with the field empty, the full results ask for text
    await page.locator('[data-key="ll-analyze"]').click();
    await expect(page.locator('.ll-status')).toContainText('請先貼上文字或選擇檔案。');
    // typing replaces the sample at once
    await page.locator('#ll-text').pressSequentially('我');
    await expect(lit.locator('[data-key="ll-famous-tag"]')).toHaveCount(0);
    await expect(lit.locator('.ll-lit-text')).toHaveText('我');
    // reduced motion: the finished colouring, with no typing
    const ctx = await browser.newContext({ locale: 'en-US', reducedMotion: 'reduce' });
    const still = await ctx.newPage();
    await still.goto(HARNESS + '?lang=en');
    const lit2 = still.locator('[data-key="ll-lit"]');
    await expect(lit2.locator('.ll-lit-text')).toHaveText('Tomorrow, and tomorrow, and tomorrow, creeps in this petty pace from day to day.');
    await lit2.locator('[data-key="ll-famous-next"]').click();
    expect(await lit2.getAttribute('data-typing')).toBe('false');
    await expect(lit2.locator('.ll-lit-text')).toHaveText('Parting is such sweet sorrow, that I shall say good night till it be morrow.');
    await expect(lit2.locator('[data-key="ll-famous-note"]')).toHaveText('Lit up most in this line: Feelings, 3.');
    await ctx.close();
  });

  test('playground: text that matches the risk check is not lit; help lines show and the words stay', async ({ page }) => {
    await page.goto(HARNESS);
    await page.fill('#ll-text', '我總是覺得我不想活了');
    await expect(page.locator('[data-key="ll-live-help"]')).toBeVisible();
    await expect(page.locator('[data-key="ll-lit"] mark')).toHaveCount(0);
    await expect(page.locator('[data-key="ll-key-self"] .ll-key-n')).toHaveText('0');
    await expect(page.locator('#ll-text')).toHaveValue('我總是覺得我不想活了');
    // and no fingerprint is drawn from it
    await page.locator('[data-key="ll-analyze"]').click();
    await expect(page.locator('[data-key="ll-help"]')).toBeVisible();
    await expect(page.locator('[data-key="ll-fp"]')).toHaveCount(0);
  });

  test('fingerprint: guess first, a still poster from counts, the words behind each count, PNG export', async ({ page }) => {
    const w = watch(page);
    await page.goto(HARNESS);
    await page.fill('#ll-text', ZH_TEXT);
    await expect(page.locator('[data-key="ll-guess"]')).toBeVisible();
    await page.locator('[data-key="ll-guess-feel"]').click();
    await expect(page.locator('[data-key="ll-guess-feel"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-key="ll-analyze"]').click();
    const fp = page.locator('[data-key="ll-fp"]');
    await expect(fp.getByRole('heading', { name: '用字指紋' })).toBeVisible();
    await expect(page.locator('[data-key="ll-fp-guess"]')).toHaveText('你猜「感受」，數起來最多的是「自己」。');
    // the poster is one image with a text equivalent, and holds no sentence of the person's text
    const art = page.locator('[data-key="ll-fp-art"]');
    await expect(art).toHaveAttribute('aria-label', /^用字指紋：自己，48 個；/);
    expect(await art.locator('svg').evaluate((el) => el.querySelectorAll('animate, style, script, image, foreignObject').length)).toBe(0);
    expect(await art.textContent()).not.toContain('吃飯');
    // every count opens the exact words behind it, and from there the full numbers
    await page.locator('[data-key="ll-fp-self"]').click();
    const sheet = page.locator('#sheet');
    await expect(sheet.getByRole('heading', { name: '「自己」數到的字' })).toBeVisible();
    await expect(sheet.locator('[data-key="ll-fp-words"] tbody tr')).toHaveText(['我48']);
    await sheet.locator('[data-key="ll-fp-full-i"]').click();
    await expect(sheet.getByRole('heading', { name: '「我」的詞' })).toBeVisible();
    await sheet.locator('.back').click();
    // a PNG three times the drawn size
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-key="ll-fp-save"]').click()]);
    expect(dl.suggestedFilename()).toMatch(/^murmur-word-fingerprint-\d{4}-\d\d-\d\d\.png$/);
    const png = readFileSync(await dl.path());
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(1350);
    expect(w.outside).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('fingerprint: too few lit words draws no poster and says so', async ({ page }) => {
    await page.goto(HARNESS);
    await page.fill('#ll-text', '今天天氣很好，出門走走。');
    await page.locator('[data-key="ll-analyze"]').click();
    await expect(page.locator('[data-key="ll-fp"]')).toContainText('亮起來的字還不夠畫指紋。');
    await expect(page.locator('[data-key="ll-fp-art"]')).toHaveCount(0);
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
    await page.locator('[data-key="ll-locked"] > summary').click();
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
    // every group waits behind the one line, which says how many and the nearest amount; the first group still opens from there
    const locked = page.locator('[data-key="ll-locked"]');
    await expect(locked).not.toHaveAttribute('open', '');
    const all = await page.locator('.ll-group').count();
    expect(all).toBeGreaterThan(1);
    await expect(locked.locator('> .ll-group')).toHaveCount(all);
    await expect(locked.locator('> summary')).toHaveText(new RegExp(`^這 ${all} 組都需要更多文字（約 50 個單位，目前 \\d+）$`));
    const core = page.locator('[data-key="ll-group-core"]');
    await expect(core).not.toHaveAttribute('open', '');
    expect(await folded(core.locator('> summary'))).toBe(true);
    await locked.locator('> summary').click();
    await expect(core.locator('> summary')).toHaveText('代名詞與否定');
    // a group that needs a different amount from the line above says its own
    await expect(page.locator('[data-key="ll-group-moral"] > summary')).toContainText('約 1000 個單位');
    await core.locator('> summary').click();
    await expect(page.locator('[data-key="score-i"]')).toContainText('文字還不夠');
  });

  test('groups: all-short groups share one line and one disclosure, and each still opens; mixed groups put passing rows first behind one toggle', async ({ page }) => {
    await page.goto(HARNESS);
    await page.fill('#ll-text', ZH_TEXT);
    await page.locator('[data-key="ll-analyze"]').click();
    // groups where every row is below its minimum: one line for all of them, with the count and both amounts
    const locked = page.locator('[data-key="ll-locked"]');
    await expect(locked).toHaveCount(1);
    await expect(locked).not.toHaveAttribute('open', '');
    const nLocked = await page.locator('.ll-group-short').count();
    expect(nLocked).toBeGreaterThan(0);
    await expect(locked.locator('> .ll-group-short')).toHaveCount(nLocked);
    await expect(locked.locator('> summary')).toHaveText(new RegExp(`^還有 ${nLocked} 組需要更多文字（約 \\d+ 個單位，目前 344）$`));
    // the old per-group sentence is gone, and no locked group sits outside the disclosure
    expect(await page.locator('.view.language').textContent()).not.toContain('這一組需要更多文字');
    await expect(page.locator('.ll-group:not(.ll-group-short)')).toHaveCount((await page.locator('.ll-group').count()) - nLocked);
    await expect(locked.locator('.ll-group:not(.ll-group-short)')).toHaveCount(0);
    // one of them: listed by name only once the line is opened, and it still opens and closes
    const moral = page.locator('[data-key="ll-group-moral"]');
    await expect(moral).toHaveClass(/ll-group-short/);
    expect(await folded(moral.locator('> summary'))).toBe(true);
    await locked.locator('> summary').click();
    await expect(moral.locator('> summary')).toBeVisible();
    await expect(moral.locator('.ll-more')).toHaveCount(0);
    expect(await folded(page.locator('[data-key="score-care"]'))).toBe(true);
    await moral.locator('> summary').click();
    await expect(page.locator('[data-key="score-care"]')).toContainText('文字還不夠');
    await moral.locator('> summary').click();
    expect(await folded(page.locator('[data-key="score-care"]'))).toBe(true);
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
    expect(await folded(more.locator('.ll-row').first())).toBe(true);
    await more.locator('summary').click();
    for (const r of await more.locator('.ll-row').all()) await expect(r).toContainText('文字還不夠');
    // these stay open across a redraw
    await moral.locator('> summary').click();
    await page.locator('[data-key="score-i"]').click();
    await page.locator('#sheet .back').click();
    await expect(more.locator('.ll-row').first()).toBeVisible();
    await expect(locked).toHaveAttribute('open', '');
    await expect(page.locator('[data-key="score-care"]')).toBeVisible();
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
    if (await page.locator('[data-key="ll-locked"] [data-key="ll-group-loss"]').count()) await page.locator('[data-key="ll-locked"] > summary').click();
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
    // the browser's own English file control is not shown; a button and a line in the page's language are
    // the file picker and its list of formats wait behind one line
    const pick = page.locator('#ll-file');
    await expect(page.locator('[data-key="ll-import"]')).not.toHaveAttribute('open', '');
    await page.locator('[data-key="ll-import"] > summary').click();
    await expect(page.getByLabel('或選擇檔案')).toHaveAttribute('type', 'file');
    expect(await pick.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    await expect(page.locator('.ll-file-btn')).toHaveText('選擇檔案');
    await expect(page.locator('#ll-file-names')).toHaveText('尚未選擇檔案');
    // the real input still covers the button, so a tap on the button reaches it, and so does the keyboard
    expect(await page.evaluate(() => {
      const r = document.querySelector('.ll-file-btn').getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).id;
    })).toBe('ll-file');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), pick.click()]);
    expect(chooser.isMultiple()).toBe(true);
    await pick.focus();
    await expect(pick).toBeFocused();
    const [byKey] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
    await byKey.setFiles([fx('x-long/data/tweets.js'), fx('instagram/posts_1.json')]);
    await expect(page.locator('#ll-file-names')).toHaveText('tweets.js、posts_1.json');
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
    await expect(page.locator('#ll-file-names')).toHaveText('export.zip、comments.json、broken.json');
    await page.locator('[data-key="ll-analyze"]').click();
    await page.locator('[data-key="ll-lang-zh"]').click();
    // two short posts: this group has too little text, so it is listed behind the one line
    await page.locator('[data-key="ll-locked"] > summary').click();
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
    await expect(page.getByLabel('Write a sentence, or paste a long piece')).toBeVisible();
    await page.locator('[data-key="ll-import"] > summary').click();
    await expect(page.getByLabel('Or choose files')).toBeVisible();
    await expect(page.getByLabel('Or choose files', { exact: true })).toHaveAttribute('data-key', 'll-file');
    await expect(page.locator('.ll-file-btn')).toHaveText('Choose files');
    await expect(page.locator('#ll-file-names')).toHaveText('No file chosen');
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
    await expect(page.locator('[data-key="ll-locked"] > summary')).toHaveText(/^\d+ more groups? needs? more text \(about \d+ units, you have \d+\)$/);
    await page.locator('[data-key="ll-locked"] > summary').click();
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
