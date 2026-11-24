import { test, expect } from '@playwright/test';
import { enterConcern, openLensMore } from './helpers.mjs';

// The lens upgrades: keepsake card, before/after heaviness, explained suggestions,
// earlier exercises about the same worry, and the step-back question.

async function sessions(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const q = indexedDB.open('murmur');
        q.onsuccess = () => {
          const r = q.result.transaction('lensSessions').objectStore('lensSessions').getAll();
          r.onsuccess = () => resolve(r.result);
        };
      })
  );
}

async function startConcern(page, text, topic = 'work', before = null) {
  await page.goto('/#lens');
  await page.locator('[data-key="lens-start"]').click();
  await enterConcern(page, text, [topic], { before });
}

async function pickAndAnswer(page, lensId, answers) {
  await page.locator('[data-key="lens-pick-all"]').click();
  await page.locator(`[data-key="pick-${lensId}"]`).click();
  await answerAll(page, answers);
}

async function answerAll(page, answers) {
  for (let i = 0; i < 6; i++) {
    if (await page.locator('.lens-summary').count()) break;
    if (await page.locator('.scale-11').count()) await page.locator('[data-key="scale-4"]').click();
    else await page.fill('#lens-answer', answers[i] ?? `回答 ${i + 1}`);
    await page.locator('[data-key="lens-next"]').click();
  }
  await expect(page.locator('.lens-summary')).toBeVisible();
}

test.describe('lens rounds', () => {
  test.use({ locale: 'zh-TW' });

  test('keepsake card: drawn inline, notes folded, saves as an image', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startConcern(page, '考試前一直喝茶，貓在旁邊睡覺', 'work');
    await pickAndAnswer(page, 'acceptance', ['腦袋停不下來', '先放著', '不知道']);
    const art = page.locator('[data-key="lens-card-art"]');
    await art.scrollIntoViewIfNeeded();
    await expect(art).toBeVisible();
    await expect(art).toHaveAttribute('role', 'img');
    await expect(art).toHaveAttribute('aria-label', /正念與接納取向/);
    await expect(art.locator('svg')).toHaveCount(1);
    // the line is the last real answer ("不知道" is skipped)
    await expect(art.locator('svg')).toContainText('先放著');
    // the card comes first on the summary; its notes and "save as image" are in the More sheet
    await openLensMore(page);
    const notes = page.locator('[data-key="lens-card-notes"]');
    await expect(notes).not.toHaveAttribute('open', /.*/);
    await notes.locator('summary').click();
    await expect(notes.locator('li').first()).toBeVisible();
    await page.evaluate(() => {
      navigator.canShare = () => false;
    });
    const download = page.waitForEvent('download');
    await page.locator('[data-key="lens-card-save"]').click();
    expect((await download).suggestedFilename()).toMatch(/^murmur-lens-\d{4}-\d\d-\d\d\.png$/);
    // the saved view shows the same card, still
    await page.keyboard.press('Escape');
    await page.locator('[data-key="lens-save"]').click();
    await page.getByRole('button', { name: /我存下的練習/ }).click();
    await page.locator('.lens-summary.compact details summary').click();
    await expect(page.locator('.lens-summary.compact [data-key="lens-card-art"] svg')).toHaveCount(1);
    await expect(page.locator('.lens-summary.compact [data-key="lens-card-save"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('heaviness before and after: plain numbers, neutral words, saved on the session', async ({ page }) => {
    await startConcern(page, '報告做不完', 'work', 7);
    await expect(page.locator('h2')).toContainText('試試這幾個角度');
    await pickAndAnswer(page, 'behavioral', []);
    await expect(page.locator('[data-key="heavy-result"]')).toHaveCount(0);
    const slider = page.locator('[data-key="heavy-after-input"]');
    await expect(slider).toHaveAttribute('aria-valuetext', '拖動來選');
    await slider.fill('5');
    await expect(page.locator('[data-key="heavy-after-input"]')).toHaveAttribute('aria-valuetext', '5 / 10');
    await expect(page.locator('[data-key="heavy-result"]')).toContainText('7 → 5');
    await expect(page.locator('[data-key="heavy-result"]')).not.toContainText(/進步|改善|好多了/);
    await page.locator('[data-key="heavy-after-input"]').fill('9');
    await expect(page.locator('[data-key="heavy-result"]')).toContainText('有時候看清楚反而更重，這也很常見');
    await page.locator('[data-key="heavy-after-input"]').fill('7');
    await expect(page.locator('[data-key="heavy-result"]')).toContainText('7 → 7');
    await page.locator('[data-key="heavy-after-input"]').fill('4');
    await expect(page.locator('[data-key="heavy-result"]')).toContainText('7 → 4');
    const box = await page.locator('[data-key="heavy-after-input"]').boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await page.locator('[data-key="lens-save"]').click();
    const s = await sessions(page);
    expect(s[0].before).toBe(7);
    expect(s[0].after).toBe(4);
  });

  test('no before rating: no after question, nothing saved for it', async ({ page }) => {
    await startConcern(page, '報告做不完', 'work');
    await pickAndAnswer(page, 'behavioral', []);
    await expect(page.locator('[data-key="heavy-after"]')).toHaveCount(0);
    await page.locator('[data-key="lens-save"]').click();
    const s = await sessions(page);
    expect(s[0].before).toBeUndefined();
  });

  test('suggestions show the words they came from, and start the lens', async ({ page }) => {
    await startConcern(page, '我應該要更努力，報告一定要完美', 'work');
    const block = page.locator('[data-key="lens-suggest"]');
    await expect(block).toBeVisible();
    await expect(block.locator('mark').first()).toHaveText(/應該|一定要/);
    await expect(block).toContainText('因為你寫了');
    // at most three cards, then the usual three ways to choose below them
    await expect(block.locator('.lens-pick-card')).toHaveCount(3);
    await expect(page.locator('.lens-option')).toHaveCount(3);
    await block.locator('[data-key="suggest-rebt"]').click();
    await expect(page.locator('.lens-name')).toContainText('理情');
  });

  test('no matching words: cards for the usual approaches, with no words quoted', async ({ page }) => {
    await startConcern(page, '今天下雨', 'other');
    await expect(page.locator('.lens-option')).toHaveCount(3);
    const block = page.locator('[data-key="lens-suggest"]');
    await expect(block.locator('.lens-pick-card')).toHaveCount(3);
    await expect(block.locator('mark')).toHaveCount(0);
    await expect(block).not.toContainText('因為你寫了');
  });

  test('user text in suggestions is never parsed as HTML', async ({ page }) => {
    await startConcern(page, '<img src=x onerror="window.__x=1">我應該', 'work');
    await expect(page.locator('[data-key="lens-suggest"]')).toBeVisible();
    await expect(page.locator('[data-key="lens-suggest"] img')).toHaveCount(0);
    expect(await page.evaluate(() => window.__x)).toBeUndefined();
  });

  test('same worry, another angle: earlier exercise, what this lens added, and back again', async ({ page }) => {
    await startConcern(page, '跟室友吵架，一直想著那句話', 'relationship', 6);
    await pickAndAnswer(page, 'gestalt', ['胸口很悶', '想對她說對不起', '說出來']);
    await page.locator('[data-key="lens-save"]').click();
    await startConcern(page, '跟室友吵架，那句話一直在腦袋裡', 'relationship', 6);
    await pickAndAnswer(page, 'acceptance', ['睡前一直重播', '把它當成天氣', '呼吸三次']);
    const rel = page.locator('[data-key="lens-related"]');
    await expect(rel).toContainText('完形');
    const added = page.locator('[data-key="lens-added"]');
    await expect(added).toBeVisible();
    await added.locator('summary').click();
    await expect(added.locator('blockquote').first()).toBeVisible();
    await rel.locator('[data-key="lens-related-open"]').first().click();
    await expect(page.locator('.lens-summary.compact')).toHaveCount(1);
    await page.locator('[data-key="lens-back-summary"]').click();
    await expect(page.locator('[data-key="lens-related"]')).toBeVisible();
    // keeps the worry, topics and the before number, and goes to choosing a lens
    await openLensMore(page);
    await page.locator('[data-key="lens-another"]').click();
    await expect(page.locator('h2')).toContainText('試試這幾個角度');
    await page.getByRole('button', { name: '上一步' }).click();
    await expect(page.locator('[data-key="heavy-before-input"]')).toHaveValue('6');
    await expect(page.locator('[data-key="heavy-before-input"]')).toHaveAttribute('aria-valuetext', '6 / 10');
    await page.getByRole('button', { name: '上一步' }).click();
    await expect(page.locator('[data-key="topic-relationship"]')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '上一步' }).click();
    await expect(page.locator('#lens-concern')).toHaveValue('跟室友吵架，那句話一直在腦袋裡');
  });

  test('step-back question: optional, goes through the risk check, saved and shown', async ({ page }) => {
    await startConcern(page, '報告做不完', 'work');
    await pickAndAnswer(page, 'behavioral', []);
    await expect(page.locator('[data-key="lens-distance-block"]')).toHaveCount(0);
    await page.locator('[data-key="lens-distance-open"]').click();
    await page.locator('[data-key="distance-friend"]').click();
    await page.fill('#lens-distance', '我覺得活不下去');
    await page.locator('[data-key="lens-distance-add"]').click();
    await expect(page.locator('.crisis')).toBeVisible();
    await page.locator('[data-key="crisis-continue"]').click();
    await expect(page.locator('[data-key="lens-distance-answer"]')).toHaveText('我覺得活不下去');
    await page.locator('[data-key="lens-distance-edit"]').click();
    await page.fill('#lens-distance', '先睡一覺，明天再說');
    await page.locator('[data-key="lens-distance-add"]').click();
    await expect(page.locator('[data-key="lens-distance-answer"]')).toHaveText('先睡一覺，明天再說');
    await expect(page.locator('.lens-summary h3', { hasText: '如果是好朋友遇到' })).toBeVisible();
    await page.locator('[data-key="lens-save"]').click();
    const s = await sessions(page);
    expect(s[0].distance).toEqual({ kind: 'friend', text: '先睡一覺，明天再說' });
  });

  test('step-back question is folded for a loss', async ({ page }) => {
    await startConcern(page, '奶奶走了', 'loss');
    await pickAndAnswer(page, 'person-centered', []);
    await expect(page.locator('[data-key="lens-distance-block"]')).toHaveCount(0);
    await page.locator('[data-key="lens-distance-open"]').click();
    await expect(page.locator('[data-key="lens-distance-block"]')).toBeVisible();
  });

  test('phone width, dark mode: summary with card fits, screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await startConcern(page, '考試前一直喝茶，覺得自己應該更努力', 'work', 7);
    await pickAndAnswer(page, 'acceptance', ['腦袋停不下來', '先放著', '晚上散步']);
    await page.locator('[data-key="heavy-after-input"]').fill('5');
    await page.locator('[data-key="lens-card-art"]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-key="lens-card-art"] svg')).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.locator('[data-key="lens-card-art"]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: '/tmp/rounds-summary.png' });
  });
});

test.describe('lens with a language model', () => {
  test.use({ locale: 'zh-TW' });

  async function enableAi(page) {
    await page.goto('/#about');
    await page.locator('[data-key="ai-enabled"]').check();
    await page.fill('#ai-key', 'sk-ant-test');
    await page.locator('#ai-key').press('Tab');
    await expect(page.locator('#ai-key')).toHaveAttribute('placeholder', /已儲存/);
  }

  function mock(page, calls) {
    return page.route('https://api.anthropic.com/**', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      calls.push(body);
      const sys = String(body.system || '');
      let out;
      if (sys.includes('Reword each')) {
        out = { questions: ['想到「報告一直拖著」的時候，你腦中第一個冒出來的想法是什麼？', '這個想法有哪些證據支持？', '如果換一個看法，會是什麼？'] };
      } else {
        out = {
          perspective: '從認知取向來看，「報告一直拖著」背後可能有一個很快冒出來的想法，值得先把它寫下來看看。',
          tryThis: '這週挑一次要開始寫報告前，把腦中的第一個想法寫在紙上。',
          cardLine: '報告一直拖著',
          card: { objects: [], weather: 'rain', weatherWord: '拖著', companion: 'cat' },
        };
      }
      await route.fulfill({ json: { content: [{ type: 'text', text: JSON.stringify(out) }], stop_reason: 'end_turn' } });
    });
  }

  test('adapted questions and a summary written for what was written, labelled as AI', async ({ page }) => {
    const calls = [];
    await mock(page, calls);
    await enableAi(page);
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '報告一直拖著沒寫');
    await expect(page.locator('[data-key="lens-llm-note"]')).toContainText('Anthropic');
    await enterConcern(page, '報告一直拖著沒寫', ['work']);
    expect(calls).toHaveLength(0);
    await page.locator('[data-key="lens-pick-all"]').click();
    await page.locator('[data-key="pick-cognitive"]').click();
    await expect(page.locator('#lens-q')).toContainText('想到「報告一直拖著」的時候');
    await expect(page.locator('[data-key="lens-adapted"]')).toContainText('依你寫的內容調整過的問題');
    await page.locator('[data-key="lens-show-original"]').click();
    await expect(page.locator('[data-key="lens-original"]')).toBeVisible();
    await answerAll(page, ['一定又會寫不好', '上次其實有交', '先寫一段']);
    await expect(page.locator('[data-key="lens-perspective"]')).toContainText('從認知取向來看');
    await expect(page.locator('[data-key="lens-try"]')).toContainText('把腦中的第一個想法寫在紙上');
    await expect(page.locator('[data-key="lens-llm-label"]').first()).toContainText('AI 產生，可能不準');
    await page.locator('[data-key="lens-card-art"]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-key="lens-card-art"] svg')).toContainText('報告一直拖著');
    expect(calls.length).toBe(2);
  });

  test('a risky worry makes no model calls at all', async ({ page }) => {
    const calls = [];
    await mock(page, calls);
    await enableAi(page);
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '報告寫不完，不想活了');
    await page.locator('[data-key="lens-worry-next"]').click();
    await expect(page.locator('.crisis')).toBeVisible();
    await page.locator('[data-key="crisis-continue"]').click();
    await page.locator('[data-key="topic-work"]').click();
    await page.locator('[data-key="lens-topics-next"]').click();
    await page.locator('[data-key="lens-concern-next"]').click();
    await page.locator('[data-key="lens-pick-all"]').click();
    await page.locator('[data-key="pick-cognitive"]').click();
    await answerAll(page, ['a', 'b', 'c']);
    await expect(page.locator('[data-key="lens-llm-label"]')).toHaveCount(0);
    expect(calls).toHaveLength(0);
  });

  test('"use the fixed version" makes no model calls', async ({ page }) => {
    const calls = [];
    await mock(page, calls);
    await enableAi(page);
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '報告一直拖著沒寫');
    await page.locator('[data-key="lens-llm-off"]').check();
    await enterConcern(page, '報告一直拖著沒寫', ['work']);
    await page.locator('[data-key="lens-pick-all"]').click();
    await page.locator('[data-key="pick-cognitive"]').click();
    await answerAll(page, ['a', 'b', 'c']);
    await expect(page.locator('[data-key="lens-adapted"]')).toHaveCount(0);
    expect(calls).toHaveLength(0);
  });
});

test('saved exercises show a plain look back: counts per approach, averages only from three', async ({ page }) => {
  await page.goto('/#lens');
  await page.locator('[data-key="lens-start"]').waitFor();
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const q = indexedDB.open('murmur');
        q.onsuccess = () => {
          const t = q.result.transaction('lensSessions', 'readwrite');
          const st = t.objectStore('lensSessions');
          const day = 86400000;
          [[7, 5], [6, 6], [5, 6]].forEach(([b, a], i) => st.put({ id: `c${i}`, createdAt: Date.now() - (5 - i) * day, lensId: 'cognitive', topics: ['work'], concern: '報告', answers: ['a'], rating: 4, before: b, after: a }));
          st.put({ id: 'n1', createdAt: Date.now() - day, lensId: 'narrative', topics: ['self'], concern: '我', answers: ['b'], rating: 3, before: 8, after: 4 });
          t.oncomplete = () => {
            q.result.close();
            resolve();
          };
        };
      })
  );
  await page.reload();
  await page.getByRole('button', { name: /My saved exercises/ }).click();
  const map = page.locator('[data-key="lens-angle-map"]');
  await expect(map.locator('summary')).toHaveText('Looking back: 4 exercises, 2 approaches');
  await map.locator('summary').click();
  const rows = map.locator('li');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('lighter 1, same 1, heavier 1');
  await expect(rows.nth(0)).toContainText('average -0.3');
  await expect(rows.nth(1)).not.toContainText('average');
});

test('a plan for the small thing to try is saved, and the next visit asks once how it went', async ({ page }) => {
  await page.goto('/#lens');
  await page.locator('[data-key="lens-start"]').waitFor();
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const q = indexedDB.open('murmur');
        q.onsuccess = () => {
          const t = q.result.transaction('lensSessions', 'readwrite');
          t.objectStore('lensSessions').put({ id: 'p1', createdAt: Date.now() - 86400000, lensId: 'cognitive', topics: ['work'], concern: '報告', answers: ['a'], rating: 4, plan: { text: 'before the next meeting' } });
          t.oncomplete = () => {
            q.result.close();
            resolve();
          };
        };
      })
  );
  await page.reload();
  const check = page.locator('[data-key="lens-plan-check"]');
  await expect(check).toContainText('before the next meeting');
  await page.locator('[data-key="plan-tried"]').click();
  await expect(check).toHaveCount(0);
  await page.reload();
  await page.locator('[data-key="lens-start"]').waitFor();
  await expect(page.locator('[data-key="lens-plan-check"]')).toHaveCount(0);
});
