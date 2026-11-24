import { test, expect } from '@playwright/test';
import { enterConcern, openLensMore } from './helpers.mjs';

test.describe('theory lens', () => {
  test.use({ locale: 'zh-TW' });

  test('full exercise: compare, answer, summary, rate, save, delete; no outside requests', async ({ page }) => {
    const outside = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://localhost')) outside.push(r.url());
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await enterConcern(page, '我一直擔心報告做不好，晚上睡不好', ['work']);
    await page.getByRole('button', { name: /比較三個角度/ }).click();
    await expect(page.locator('.lens-card')).toHaveCount(3);
    await page.locator('.lens-card .btn').first().click();
    // answer every step
    for (let i = 0; i < 4; i++) {
      if (await page.locator('.lens-summary').count()) break;
      if (await page.locator('.scale-11').count()) await page.locator('[data-key="scale-4"]').click();
      else await page.fill('#lens-answer', `回答 ${i + 1}`);
      await page.locator('[data-key="lens-next"]').click();
    }
    await expect(page.locator('.lens-summary')).toBeVisible();
    await expect(page.locator('.lens-summary')).not.toContainText('{');
    await page.locator('[data-key="rate-4"]').click();
    await page.getByRole('button', { name: '儲存到這個裝置' }).click();
    await page.getByRole('button', { name: /我存下的練習/ }).click();
    await expect(page.locator('.lens-summary.compact')).toHaveCount(1);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '刪除' }).click();
    await expect(page.locator('.lens-summary.compact')).toHaveCount(0);
    await page.getByRole('button', { name: '上一步' }).click();
    await page.getByRole('button', { name: /哪個角度適合我/ }).click();
    await expect(page.locator('.fit-list li')).toHaveCount(1);
    expect(outside).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('risk language stops the exercise and shows help; nothing saved', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '最近真的不想活了');
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.locator('.crisis')).toBeVisible();
    await expect(page.locator('.crisis a[href="tel:1925"]')).toBeVisible();
    await expect(page.locator('.lens-help')).toHaveCount(0);
  });

  test('risk language inside an answer also stops the exercise', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await enterConcern(page, '工作壓力很大，今天累死了', ['work']);
    await page.locator('[data-key="lens-pick-all"]').click();
    await page.locator('.lens-row').first().click();
    if (await page.locator('.scale-11').count()) {
      await page.locator('[data-key="scale-2"]').click();
      await page.locator('[data-key="lens-next"]').click();
    }
    await page.fill('#lens-answer', '有時候覺得我想傷害自己');
    await page.locator('[data-key="lens-next"]').click();
    await expect(page.locator('.crisis')).toBeVisible();
  });

  test('a false alarm can continue with the text kept', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '報告被退回，我想死');
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.locator('.crisis')).toBeVisible();
    await page.locator('[data-key="crisis-continue"]').click();
    await expect(page.locator('.crisis')).toHaveCount(0);
    // continuing goes on to the next screen of the worry, with the words kept
    await expect(page.locator('[data-key="topic-work"]')).toBeVisible();
    await page.getByRole('button', { name: '上一步' }).click();
    await expect(page.locator('#lens-concern')).toHaveValue('報告被退回，我想死');
  });

  test('opening help mid-exercise and tapping the tab keeps the exercise', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await enterConcern(page, '主管一直改需求', ['work']);
    await page.locator('[data-key="lens-pick-all"]').click();
    await page.locator('.lens-row').first().click();
    await page.getByRole('button', { name: '求助專線' }).click();
    await page.locator('#tabs a[href="#lens"]').click();
    await page.getByRole('button', { name: '上一步' }).click();
    await expect(page.locator('.lens-concern-quote')).toContainText('主管一直改需求');
  });

  test('"Start with this lens" from the card deck opens that lens', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('.lens-link').first().click();
    await page.locator('.deck-card, .lens-deck button, [data-key^="deck-"]').first().click();
    await page.getByRole('button', { name: '用這個角度開始' }).click();
    await expect(page.locator('#lens-concern')).toBeVisible();
  });

  test('each screen of the worry waits for its answer; heaviness can be skipped', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    const worryNext = page.locator('[data-key="lens-worry-next"]');
    await expect(worryNext).toBeDisabled();
    await page.fill('#lens-concern', '主管一直改需求');
    await expect(worryNext).toBeEnabled();
    await worryNext.click();
    await expect(page.locator('.lens-progress')).toHaveAttribute('aria-valuenow', '2');
    const topicsNext = page.locator('[data-key="lens-topics-next"]');
    await expect(topicsNext).toBeDisabled();
    await page.locator('[data-key="topic-work"]').click();
    await expect(topicsNext).toBeEnabled();
    await topicsNext.click();
    // heaviness: a slider, nothing chosen until it is moved; Skip goes on without a number
    const slider = page.locator('[data-key="heavy-before-input"]');
    await expect(slider).toHaveAttribute('type', 'range');
    await expect(slider).toHaveAttribute('aria-valuetext', '拖動來選');
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuetext', '6 / 10');
    await page.locator('[data-key="lens-heavy-skip"]').click();
    await expect(page.getByRole('heading', { name: '試試這幾個角度' })).toBeVisible();
    await page.getByRole('button', { name: '上一步' }).click();
    await expect(slider).toHaveAttribute('aria-valuetext', '拖動來選');
  });

  test('help lines switch region and remember it', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '最近真的不想活了');
    await page.locator('[data-key="lens-worry-next"]').click();
    await expect(page.locator('.crisis a[href="tel:1925"]')).toBeVisible();
    await expect(page.locator('.crisis a[href="tel:988"]')).toHaveCount(0);
    await page.locator('[data-key="region-US"]').click();
    await expect(page.locator('.crisis a[href="tel:988"]')).toBeVisible();
    await expect(page.locator('.crisis a[href="tel:1925"]')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('murmur-region'))).toBe('US');
  });

  test('several topics can be chosen; each chip is a toggle and "other" stands alone', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '主管一直改需求，回家又和爸媽吵');
    await page.locator('[data-key="lens-worry-next"]').click();
    const chip = (t) => page.locator(`[data-key="topic-${t}"]`);
    const next = page.locator('[data-key="lens-topics-next"]');
    await chip('work').click();
    await chip('family').click();
    await expect(chip('work')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip('family')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.topic-chips [aria-pressed="true"]')).toHaveCount(2);
    // the keyboard toggles the focused chip
    await chip('self').focus();
    await page.keyboard.press('Space');
    await expect(chip('self')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip('self')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(chip('self')).toHaveAttribute('aria-pressed', 'false');
    // "other" clears the rest, and choosing a topic clears "other"
    await chip('other').click();
    await expect(page.locator('.topic-chips [aria-pressed="true"]')).toHaveCount(1);
    await chip('work').click();
    await expect(chip('other')).toHaveAttribute('aria-pressed', 'false');
    // none chosen: Next waits
    await chip('work').click();
    await expect(page.locator('.topic-chips [aria-pressed="true"]')).toHaveCount(0);
    await expect(next).toBeDisabled();
    await chip('family').click();
    await expect(next).toBeEnabled();
  });

  test('two topics: usual approaches of both come first, in the order chosen, and both are saved', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await enterConcern(page, '爸媽一直催我回家工作', ['family', 'work']);
    await page.locator('[data-key="lens-pick-all"]').click();
    const names = await page.locator('.lens-row-name').allInnerTexts();
    expect(names).toHaveLength(14);
    expect(new Set(names).size).toBe(14);
    expect(names.slice(0, 6)).toEqual(['家族系統取向', '阿德勒學派', '女性主義取向', '敘事取向', '個人中心取向', '認知取向']);
    await page.locator('[data-key="pick-family-systems"]').click();
    for (let i = 0; i < 3; i++) {
      await page.fill('#lens-answer', `回答 ${i + 1}`);
      await page.locator('[data-key="lens-next"]').click();
    }
    await page.locator('[data-key="lens-save"]').click();
    await expect(page.locator('[data-key="lens-start"]')).toBeVisible();
    const sessions = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const q = indexedDB.open('murmur');
          q.onsuccess = () => {
            const r = q.result.transaction('lensSessions').objectStore('lensSessions').getAll();
            r.onsuccess = () => resolve(r.result);
          };
        })
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0].topics).toEqual(['family', 'work']);
  });

  test('a loss chosen with another topic still hides lenses unsuited to grief, everywhere', async ({ page }) => {
    const allowed = ['精神分析取向', '個人中心取向', '正念與接納取向', '女性主義取向', '家族系統取向'];
    for (const order of [['work', 'loss'], ['loss', 'self']]) {
      await page.goto('/#lens');
      await page.reload();
      await page.locator('[data-key="lens-start"]').click();
      await enterConcern(page, '外婆上個月過世了，工作也顧不好', order);
      await expect(page.locator('.view.lens')).toContainText('有些學派不適合用來看這類煩惱');
      // pick list
      await page.locator('[data-key="lens-pick-all"]').click();
      const names = await page.locator('.lens-row-name').allInnerTexts();
      expect([...names].sort()).toEqual([...allowed].sort());
      await page.getByRole('button', { name: '上一步' }).click();
      // compare
      await page.getByRole('button', { name: /比較三個角度/ }).click();
      for (const n of await page.locator('.lens-card h3').allInnerTexts()) expect(allowed).toContain(n);
      await page.getByRole('button', { name: '上一步' }).click();
      // draw, several times
      await page.getByRole('button', { name: /抽一張卡/ }).click();
      for (let i = 0; i < 8; i++) {
        expect(allowed).toContain(await page.locator('.lens-card h3').innerText());
        await page.locator('[data-key="lens-redraw"]').click();
      }
    }
    // from the lens cards: a lens unsuited to grief is not started for a worry that includes a loss
    await page.goto('/#lens');
    await page.reload();
    await page.getByRole('button', { name: /理論卡/ }).click();
    await page.locator('.deck-card', { hasText: '焦點解決取向' }).click();
    await page.getByRole('button', { name: '用這個角度開始' }).click();
    await enterConcern(page, '外婆上個月過世了，工作也顧不好', ['work', 'loss']);
    await expect(page.getByRole('heading', { name: '試試這幾個角度' })).toBeVisible();
  });

  test('loss topic hides lenses unsuited to grief', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await enterConcern(page, '外婆上個月過世了', ['loss']);
    await page.locator('[data-key="lens-pick-all"]').click();
    const names = await page.locator('.lens-row-name').allInnerTexts();
    expect(names).not.toContain('存在主義取向');
    expect(names).not.toContain('焦點解決取向');
    expect(names).toContain('個人中心取向');
  });

  test('the pick list puts lenses often used for the topic first, in compact rows', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await enterConcern(page, '爸媽一直催我回家工作', ['family']);
    await page.locator('[data-key="lens-pick-all"]').click();
    await expect(page.locator('.lens-row').first()).toContainText('家族系統取向');
    await expect(page.locator('.lens-row')).toHaveCount(14);
    await page.locator('[data-key="pick-family-systems"]').click();
    await expect(page.locator('.lens-name')).toHaveText('家族系統取向');
  });

  test('help resources are always reachable', async ({ page }) => {
    await page.goto('/#lens');
    await page.getByRole('button', { name: '求助專線' }).click();
    await expect(page.locator('.resource-list a[href="tel:113"]')).toBeVisible();
  });
  test('answering "不知道" everywhere is never quoted back, and saving is in reach', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await enterConcern(page, '爸媽一直催我回家工作', ['family']);
    await page.locator('[data-key="lens-pick-all"]').click();
    await page.locator('[data-key="pick-family-systems"]').click();
    for (let i = 0; i < 3; i++) {
      await page.fill('#lens-answer', '不知道');
      await page.locator('[data-key="lens-next"]').click();
    }
    await expect(page.locator('.lens-summary')).toBeVisible();
    await expect(page.locator('.lens-summary')).not.toContainText('不知道');
    await expect(page.locator('.lens-summary')).toContainText('先留白');
    // one line for the whole list, not the same note under each question
    await expect(page.locator('.lens-summary .lens-answer-open')).toHaveCount(1);
    await expect(page.locator('.lens-summary blockquote')).toHaveCount(0);
    // the page now also carries the approach's perspective, so Save sits a short scroll down:
    // within one and a half screens, and nothing but the rating between the summary and it
    const top = await page.locator('[data-key="lens-save"]').evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    expect(top).toBeLessThan(844 * 1.5);
  });
  test('the summary shows each answer as written, in its own block, and never inside a sentence', async ({ page }) => {
    const answers = ['Maybe not. 可能不會', '第一行\n第二行', 'I have no idea what to put here, honestly'];
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await enterConcern(page, '爸媽一直催我回家工作', ['family']);
    await page.locator('[data-key="lens-pick-all"]').click();
    await page.locator('[data-key="pick-existential"]').click();
    for (const a of answers) {
      await page.fill('#lens-answer', a);
      await page.locator('[data-key="lens-next"]').click();
    }
    const sum = page.locator('.lens-summary');
    await expect(sum).toBeVisible();
    for (const hd of ['你寫下的', '這個角度會怎麼看', '可以試試']) await expect(sum.getByRole('heading', { name: hd })).toBeVisible();
    // every answer is a quotation block holding exactly what was typed; past the first, one tap away
    await expect(sum.locator('blockquote.lens-answer').nth(1)).toBeHidden();
    await page.locator('[data-key="lens-see-all"]').click();
    await expect(page.locator('[data-key="lens-see-all"]')).toHaveAttribute('aria-expanded', 'true');
    await expect(sum.locator('blockquote.lens-answer').nth(2)).toBeVisible();
    expect(await sum.locator('blockquote.lens-answer').evaluateAll((els) => els.map((e) => e.textContent))).toEqual(answers);
    await expect(sum.locator('.lens-answer-q')).toHaveText(['這個煩惱透露你在乎什麼', '沒辦法選的，和還能選的', '朝在乎的方向走的一小步']);
    // outside those blocks, no element of the page contains any of the person's words
    const leaked = await page.evaluate((list) => {
      const out = [];
      for (const el of document.querySelectorAll('.view.lens *')) {
        // quotations: the answer blocks, and the keepsake card, which shows one answer as its own line
        if (el.closest('blockquote') || el.closest('[data-key="lens-card-art"]')) continue;
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
        for (const a of list) for (const part of a.split('\n')) if (own.includes(part)) out.push(own);
      }
      return out;
    }, answers);
    expect(leaked).toEqual([]);
    await expect(sum).not.toContainText('你寫到');
    await expect(sum).not.toContainText('{');
    // the perspective and the thing to try are the same text whatever was answered
    const fixed = [await page.locator('[data-key="lens-perspective"]').innerText(), await page.locator('[data-key="lens-try"]').innerText()];
    expect(fixed[0]).toContain('存在主義取向');
    // what the approach may miss is in the More sheet, which closes with Escape
    await openLensMore(page);
    await expect(page.getByRole('dialog').getByRole('heading', { name: '這個角度可能忽略的' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-key="lens-sheet"]')).toHaveCount(0);
    await expect(page.locator('[data-key="lens-more-open"]')).toBeFocused();
    await page.locator('[data-key="lens-save"]').click();
    await page.getByRole('button', { name: /我存下的練習/ }).click();
    const saved = page.locator('.lens-summary.compact');
    expect(await saved.locator('blockquote.lens-answer').evaluateAll((els) => els.map((e) => e.textContent))).toEqual(answers);
    await saved.locator('summary').click();
    await expect(saved).toContainText(fixed[0]);
    await expect(saved).toContainText(fixed[1]);
  });

  test('a scale answer reads as a number out of 10 and a skipped answer as left open', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await enterConcern(page, '報告一直拖著沒寫', ['work']);
    await page.locator('[data-key="lens-pick-all"]').click();
    await page.locator('[data-key="pick-solution-focused"]').click();
    await page.locator('[data-key="scale-6"]').click();
    await page.locator('[data-key="lens-next"]').click();
    await page.fill('#lens-answer', 'not sure');
    await page.locator('[data-key="lens-next"]').click();
    await page.fill('#lens-answer', '週末去爬山的時候');
    await page.locator('[data-key="lens-next"]').click();
    const sum = page.locator('.lens-summary');
    await expect(sum.locator('blockquote.lens-answer')).toHaveText(['6 / 10', '週末去爬山的時候']);
    await expect(sum.locator('.lens-answer-open')).toHaveText(['（先留白）']);
    await expect(sum).not.toContainText('not sure');
  });

  test('an exercise saved before topics could be combined still shows, with its answers', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').waitFor();
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const q = indexedDB.open('murmur');
          q.onsuccess = () => {
            const t = q.result.transaction('lensSessions', 'readwrite');
            t.objectStore('lensSessions').put({ id: 'old-1', createdAt: Date.now() - 86400000, lensId: 'narrative', topic: 'self', concern: '舊的煩惱', answers: ['小黑', '叫我不要出門'], rating: 4 });
            t.oncomplete = () => {
              q.result.close();
              resolve();
            };
          };
        })
    );
    await page.reload();
    await page.getByRole('button', { name: /我存下的練習/ }).click();
    const saved = page.locator('.lens-summary.compact');
    await expect(saved).toHaveCount(1);
    await expect(saved.locator('blockquote.lens-answer')).toHaveText(['小黑', '叫我不要出門']);
    await expect(saved.locator('.lens-answer-open')).toHaveCount(1);
    await expect(saved).not.toContainText('{');
    expect(errors).toEqual([]);
  });
});
