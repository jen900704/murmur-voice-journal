import { test, expect } from '@playwright/test';

// Writing mode and the energy-matched low-mood card, through tests/e2e/writing-harness.html:
// the real modules with storage held in memory, so nothing here depends on the app shell.
const HARNESS = '/tests/e2e/writing-harness.html';
const key = (page, k) => page.locator(`[data-key="${k}"]`);

test.use({ locale: 'zh-TW' });

async function open(page, { lang, time = '2026-11-24T14:00:00+08:00' } = {}) {
  await page.clock.install({ time: new Date(time) });
  await page.goto(HARNESS + (lang ? `?lang=${lang}` : ''));
  await page.locator('html[data-ready]').waitFor();
  await page.locator('#open').click();
}

async function writeDeep(page, text, prompt = 'd-alone') {
  await key(page, 'writing-tab-deep').click();
  await key(page, `writing-prompt-${prompt}`).click();
  await key(page, 'writing-text').fill(text);
}

test('tabs: three weights with 4 to 6 prompts each, the deep note only on the deep tab', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await open(page);
  await expect(page.locator('.writing-tabs [role="tab"]')).toHaveText(['輕', '中', '重']);
  await expect(key(page, 'writing-tab-light')).toHaveAttribute('aria-selected', 'true');
  for (const w of ['light', 'middle', 'deep']) {
    await key(page, `writing-tab-${w}`).click();
    await expect(key(page, `writing-tab-${w}`)).toHaveAttribute('aria-selected', 'true');
    const n = await page.locator('.writing-prompt').count();
    expect(n).toBeGreaterThanOrEqual(4);
    expect(n).toBeLessThanOrEqual(6);
    await expect(key(page, 'writing-deep-note')).toHaveCount(w === 'deep' ? 1 : 0);
    // no text box until a prompt is chosen
    await expect(key(page, 'writing-text')).toHaveCount(0);
  }
  await expect(key(page, 'writing-deep-note')).toContainText('15 分鐘');
  await expect(key(page, 'writing-deep-note')).toContainText('停下來');
  await expect(key(page, 'writing-deep-note')).toContainText('接下來幾天');
  // help lines are one tap away from the note
  await page.locator('.writing-help summary').click();
  await expect(page.locator('.writing-help .resource-list')).toContainText('1925');
  // afternoon: no late-hour line
  await expect(key(page, 'writing-late')).toHaveCount(0);
  await expect(page.locator('#sheet')).not.toContainText(/—|連續 \d+ 天|streak/i);
  // the stylesheet is loaded by the module itself
  await expect(page.locator('.writing-prompt').first()).toHaveCSS('text-align', 'left');
  expect(errors).toEqual([]);
});

test('late at night the deep note says so; English has the same parts', async ({ page }) => {
  await open(page, { lang: 'en', time: '2026-11-24T23:10:00+08:00' });
  await expect(page.locator('.writing-tabs [role="tab"]')).toHaveText(['Light', 'Middle', 'Deep']);
  await key(page, 'writing-tab-deep').click();
  await expect(key(page, 'writing-late')).toBeVisible();
  await expect(key(page, 'writing-deep-note')).toContainText('15 minutes');
  await key(page, 'writing-prompt-d-deserve').click();
  await expect(key(page, 'writing-chosen')).toContainText('I must work hard to deserve care');
  await expect(key(page, 'writing-save')).toHaveText('Save');
});

test('the draft is kept in memory across prompts, tabs and closing the sheet', async ({ page }) => {
  await open(page);
  await key(page, 'writing-prompt-l-defuse').click();
  await expect(key(page, 'writing-chosen')).toContainText('我注意到我有一個想法：');
  await key(page, 'writing-text').fill('我注意到我有一個想法：我做得不夠。');
  await expect(key(page, 'writing-count')).toContainText('17 /');
  await key(page, 'writing-prompt-l-body').click();
  await expect(key(page, 'writing-text')).toHaveValue('');
  await key(page, 'writing-tab-middle').click();
  await page.locator('.back').click();
  await expect(page.locator('#sheet')).toBeHidden();
  await page.locator('#open').click();
  await key(page, 'writing-tab-light').click();
  await key(page, 'writing-prompt-l-defuse').click();
  await expect(key(page, 'writing-text')).toHaveValue('我注意到我有一個想法：我做得不夠。');
  // nothing was stored along the way
  expect(await page.evaluate(() => window.__stored.length)).toBe(0);
});

test('the 15-minute timer is optional, silent, and shows one quiet line when time is up', async ({ page }) => {
  await open(page);
  await writeDeep(page, '開始寫');
  const line = key(page, 'writing-timer-line');
  await expect(line).toBeHidden();
  await key(page, 'writing-timer').click();
  await expect(line).toContainText('計時中');
  await expect(key(page, 'writing-timer')).toHaveText('停止計時');
  await page.clock.fastForward('14:50');
  await expect(line).toContainText('計時中');
  // typing does not disturb it, and it does not disturb typing
  await key(page, 'writing-text').pressSequentially('abc');
  await page.clock.fastForward('00:15');
  await expect(line).toHaveText('15 分鐘到了。可以停在這裡，也可以把這一句寫完。');
  await expect(key(page, 'writing-text')).toHaveValue('開始寫abc');
  await expect(key(page, 'writing-text')).toBeFocused();
  expect(await page.locator('audio, video').count()).toBe(0);
  // stopping early clears it
  await key(page, 'writing-timer').click();
  await expect(line).toContainText('計時中');
  await key(page, 'writing-timer').click();
  await expect(line).toBeHidden();
  await page.clock.fastForward('16:00');
  await expect(line).toBeHidden();
});

test('saving a light prompt calls onSaved with a silent check-in entry and has no closing', async ({ page }) => {
  await open(page);
  await key(page, 'writing-save').waitFor({ state: 'detached' });
  await key(page, 'writing-prompt-l-enough').click();
  // an empty text is not saved
  await key(page, 'writing-save').click();
  expect(await page.evaluate(() => window.__saved.length)).toBe(0);
  await key(page, 'writing-text').fill('  把信回完了。  ');
  await key(page, 'writing-save').click();
  await expect(key(page, 'writing-done-line')).toHaveText('這篇存在日記裡了。');
  await expect(page.locator('#sheet')).not.toContainText('收尾');
  const saved = await page.evaluate(() => window.__saved);
  expect(saved).toHaveLength(1);
  const e = saved[0];
  expect(e).toMatchObject({
    silent: true,
    features: null,
    mood: null,
    energy: null,
    hasAudio: false,
    featureVersion: 0,
    lang: 'zh-TW',
    note: '把信回完了。',
    prompt: '今天哪一件事，可以算是「這樣就夠了」？',
    writing: { weight: 'light', promptId: 'l-enough' },
  });
  expect(typeof e.id).toBe('string');
  expect(e.createdAt).toBe(await page.evaluate(() => window.__stored[0].createdAt));
  expect(await page.evaluate(() => window.__stored.length)).toBe(1);
  // the draft is gone once it is saved
  await key(page, 'writing-again').click();
  await key(page, 'writing-prompt-l-enough').click();
  await expect(key(page, 'writing-text')).toHaveValue('');
});

test('after deep writing the closing appears, and its lines can be kept with the entry', async ({ page }) => {
  await open(page);
  await writeDeep(page, '那一年我一個人處理了所有的事。');
  await key(page, 'writing-save').click();
  await expect(page.locator('#sheet h2')).toHaveText('收尾');
  await expect(page.locator('.writing-fields input')).toHaveCount(3);
  expect(await page.evaluate(() => window.__saved.length)).toBe(1);
  await key(page, 'writing-cared-1').fill('室友留了一碗湯');
  await key(page, 'writing-cared-3').fill('自己早點下班');
  await key(page, 'writing-self-line').fill('今天寫到這裡就可以了');
  await key(page, 'writing-closing-keep').click();
  await expect(key(page, 'writing-done-line')).toHaveText('這篇存在日記裡了。');
  await expect(page.locator('#sheet')).toContainText('做點平靜的事');
  const { saved, updated, stored } = await page.evaluate(() => ({ saved: window.__saved, updated: window.__updated, stored: window.__stored }));
  // onSaved once; the closing lines update the same entry
  expect(saved).toHaveLength(1);
  expect(stored).toHaveLength(1);
  expect(updated).toHaveLength(1);
  expect(updated[0].id).toBe(saved[0].id);
  expect(saved[0].note).toBe('那一年我一個人處理了所有的事。');
  expect(stored[0].note).toBe('那一年我一個人處理了所有的事。\n\n收尾：\n今天被照顧到的小地方：\n- 室友留了一碗湯\n- 自己早點下班\n給自己的一句話：今天寫到這裡就可以了');
  expect(stored[0]).toMatchObject({ silent: true, features: null, writing: { weight: 'deep', promptId: 'd-alone' } });
});

test('deep writing that is not saved still gets the closing, and nothing is stored', async ({ page }) => {
  await open(page);
  await writeDeep(page, '不想留下來的一段。');
  await key(page, 'writing-discard').click();
  await expect(page.locator('#sheet h2')).toHaveText('收尾');
  await expect(key(page, 'writing-closing-keep')).toHaveCount(0);
  await key(page, 'writing-self-line').fill('辛苦了');
  await key(page, 'writing-closing-done').click();
  await expect(key(page, 'writing-done-line')).toHaveText('這篇沒有存。');
  expect(await page.evaluate(() => window.__stored.length + window.__saved.length)).toBe(0);
});

test('risk wording: help lines come first, the draft stays, and a second choice saves', async ({ page }) => {
  await open(page);
  await writeDeep(page, '那陣子我常常覺得不想活了。', 'd-secret');
  await key(page, 'writing-save').click();
  await expect(page.locator('#sheet h2')).toHaveText('想先讓你知道這些');
  await expect(page.locator('#sheet .resource-list')).toContainText('1925');
  await expect(page.locator('#sheet a[href="tel:1925"]')).toBeVisible();
  expect(await page.evaluate(() => window.__stored.length)).toBe(0);
  // going back keeps the text
  await key(page, 'writing-help-back').click();
  await expect(key(page, 'writing-text')).toHaveValue('那陣子我常常覺得不想活了。');
  // the same text saves on the next tap; the entry is the person's own and is kept as written
  await key(page, 'writing-save').click();
  await expect(page.locator('#sheet h2')).toHaveText('收尾');
  const saved = await page.evaluate(() => window.__saved);
  expect(saved).toHaveLength(1);
  expect(saved[0].note).toBe('那陣子我常常覺得不想活了。');
});

test('risk wording: saving straight from the help lines also works', async ({ page }) => {
  await open(page);
  await key(page, 'writing-prompt-l-kind').click();
  await key(page, 'writing-text').fill('想消失');
  await key(page, 'writing-save').click();
  await expect(page.locator('#sheet .resource-list')).toBeVisible();
  await key(page, 'writing-help-save').click();
  await expect(key(page, 'writing-done-line')).toBeVisible();
  expect(await page.evaluate(() => window.__saved.length)).toBe(1);
});

test('a failed save keeps the draft and says so', async ({ page }) => {
  await open(page);
  await key(page, 'writing-prompt-l-body').click();
  await key(page, 'writing-text').fill('肩膀很緊');
  await page.evaluate(() => (window.__failSave = true));
  await key(page, 'writing-save').click();
  await expect(page.locator('#toast')).toHaveText('沒有存成功，草稿還在這裡。');
  await expect(key(page, 'writing-text')).toHaveValue('肩膀很緊');
  expect(await page.evaluate(() => window.__saved.length)).toBe(0);
});

test('day count: the same deep prompt saved on an earlier day shows 第 2 天, with no streak wording', async ({ page }) => {
  const prompt = '寫一段你一個人撐過來、最辛苦的日子。那時候發生了什麼，你當時怎麼想、有什麼感覺，現在回頭看又是什麼。';
  await page.addInitScript((p) => {
    // yesterday evening, Taipei time; restored from a backup, so only the prompt text identifies it
    window.__seed = [{ id: 'old-1', createdAt: new Date('2026-11-23T21:00:00+08:00').getTime(), silent: true, features: null, prompt: p, note: '第一天', lang: 'zh-TW', mood: null, energy: null }];
  }, prompt);
  await open(page);
  await key(page, 'writing-tab-deep').click();
  await key(page, 'writing-prompt-d-alone').click();
  await expect(key(page, 'writing-chosen')).toHaveText(prompt);
  await expect(key(page, 'writing-day')).toHaveText('第 2 天');
  await expect(page.locator('.writing-area')).not.toContainText(/連續|不要中斷|streak|提醒/);
  // another deep prompt has no count
  await key(page, 'writing-prompt-d-unsaid').click();
  await expect(key(page, 'writing-day')).toHaveCount(0);
  // saving today does not turn today into day 3
  await key(page, 'writing-prompt-d-alone').click();
  await key(page, 'writing-text').fill('第二天');
  await key(page, 'writing-save').click();
  await key(page, 'writing-closing-done').click();
  await key(page, 'writing-again').click();
  await key(page, 'writing-tab-deep').click();
  await key(page, 'writing-prompt-d-alone').click();
  await expect(key(page, 'writing-day')).toHaveText('第 2 天');
});

test('copy puts the text on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  await key(page, 'writing-prompt-l-value').click();
  await key(page, 'writing-text').fill('陪朋友走了一段路');
  await key(page, 'writing-copy').click();
  await expect(page.locator('#toast')).toHaveText('已複製');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('陪朋友走了一段路');
});

// ---------- the low-mood card ----------
const SMALL = {
  tired: ['喝一杯溫的東西', '躺著聽一首以前喜歡的歌', '換一套舒服的衣服', '蓋上毯子，或抱著一個軟的東西', '洗把臉', '看看窗外兩分鐘', '喝點水，或吃一點東西', '早一點躺下，不用馬上睡著'],
  up: ['伸展十分鐘', '煮一樣簡單的東西', '傳訊息或打電話給一個想到的人', '洗一批衣服，或換一張床單', '整理一個抽屜', '做一件放了很久的小事，做五分鐘就停', '白天的話，出門走十五分鐘', '白天的話，去一個喜歡的地方坐一下，例如公園或書店'],
};

async function lowCard(page, low, { time = '2026-11-24T14:00:00+08:00', evening = false, noWriting = false } = {}) {
  await page.clock.install({ time: new Date(time) });
  await page.addInitScript(
    ([l, ev, nw]) => {
      window.__low = l;
      window.__evening = ev;
      window.__noWriting = nw;
    },
    [low, evening, noWriting]
  );
  await page.goto(HARNESS);
  await page.locator('.low-card').waitFor();
  return (await page.locator('.low-card .plain-list li').allTextContents()).map((t) => t.trim());
}

test('low-mood card: a tired rating gets low-effort actions', async ({ page }) => {
  const items = await lowCard(page, { mood: 2, energy: 1 });
  await expect(page.locator('.low-card')).toHaveAttribute('data-energy', 'tired');
  expect(items).toHaveLength(3);
  for (const t of items) expect(SMALL.tired).toContain(t);
  await expect(page.locator('.low-card')).toContainText('不太花力氣');
});

test('low-mood card: some energy gets more active actions, and no rating gets the middle list', async ({ page }) => {
  const items = await lowCard(page, { mood: 2, energy: 7 });
  await expect(page.locator('.low-card')).toHaveAttribute('data-energy', 'up');
  expect(items).toHaveLength(3);
  for (const t of items) expect(SMALL.up).toContain(t);
});

test('low-mood card: energy 3 to 5 and a missing rating use the middle list', async ({ page }) => {
  const items = await lowCard(page, { mood: 1, energy: null });
  await expect(page.locator('.low-card')).toHaveAttribute('data-energy', 'mid');
  for (const t of items) expect([...SMALL.tired, ...SMALL.up]).not.toContain(t);
});

test('low-mood card: late in the evening, one item and nothing that means going out', async ({ page }) => {
  const items = await lowCard(page, { mood: 2, energy: 6 }, { time: '2026-11-24T21:30:00+08:00', evening: true });
  expect(items).toHaveLength(1);
  expect(SMALL.up).toContain(items[0]);
  expect(items[0]).not.toMatch(/白天|便利商店/);
});

test('low-mood card: 寫一寫 opens writing mode through the injected callback', async ({ page }) => {
  await lowCard(page, { mood: 2, energy: 3 });
  await expect(key(page, 'low-write')).toHaveText('寫一寫');
  await key(page, 'low-write').click();
  await expect(page.locator('#sheet h2')).toHaveText('寫一寫');
  await expect(key(page, 'writing-tab-light')).toHaveAttribute('aria-selected', 'true');
});

test('low-mood card: without the callback there is no writing link', async ({ page }) => {
  await lowCard(page, { mood: 2, energy: 3 }, { noWriting: true });
  await expect(key(page, 'low-write')).toHaveCount(0);
});
