import { flowSettled } from './helpers.mjs';
import { test, expect } from '@playwright/test';

// the first visit shows a welcome card; close it so the usual Today screen is there
async function skipWelcome(page) {
  await page.locator('.prompt-text').waitFor();
  const w = page.locator('[data-key="welcome-close"]');
  if (await w.count()) await w.click();
}

test.use({ locale: 'zh-TW' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__MURMUR_SPEED = 200;
  });
});

async function startRitual(page) {
  await page.goto('/');
  // evening shows a card, daytime shows a link; either opens the ritual
  await skipWelcome(page);
  await page.locator('[data-key="night-start"], [data-key="night-link"]').first().click();
}

test('bedtime ritual: worry, kind thing, track, postcard; appears in nights and jar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await startRitual(page);
  await page.fill('#night-worry', '明天要報告，有點緊張');
  await page.locator('[data-key="night-theme-work"]').click();
  await page.locator('[data-key="night-next"]').click();
  await page.fill('#night-kind', '下班後去買了喜歡的麵包');
  await page.locator('[data-key="night-next"]').click();
  await page.locator('[data-key="track-acceptance"]').click();
  await expect(page.locator('.view.night.playing')).toBeVisible();
  await expect(page.locator('.postcard svg')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.postcard')).toContainText('下班後去買了喜歡的麵包');
  await page.locator('[data-key="night-done"]').click();
  await flowSettled(page);
  await page.goto('/#journal');
  await page.locator('[data-key="jmode-nights"]').click();
  await expect(page.locator('.night-thumb')).toHaveCount(1);
  await page.locator('.night-thumb').click();
  await expect(page.locator('#sheet')).toContainText('明天要報告');
  await page.keyboard.press('Escape');
  await page.locator('[data-key="jmode-jar"]').click();
  await expect(page.locator('.jar-list li')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('worry text is not kept when the person turns keeping off', async ({ page }) => {
  await startRitual(page);
  await page.fill('#night-worry', '不想留下來的心事');
  await page.locator('[data-key="night-keep"]').uncheck();
  await page.locator('[data-key="night-next"]').click();
  await page.locator('[data-key="night-next"]').click();
  await page.locator('[data-key="tracks-all"]').click();
  await page.locator('[data-key="track-relaxation"]').click();
  await expect(page.locator('.postcard svg')).toBeVisible({ timeout: 20_000 });
  const nights = await page.evaluate(
    () =>
      new Promise((res) => {
        const q = indexedDB.open('murmur');
        q.onsuccess = () => {
          const r = q.result.transaction('nights').objectStore('nights').getAll();
          r.onsuccess = () => res(r.result);
        };
      })
  );
  expect(nights).toHaveLength(1);
  expect(nights[0].worry).toBe('');
});

test('risk language in the worry stops the ritual and shows help', async ({ page }) => {
  await startRitual(page);
  await page.fill('#night-worry', '真的不想活了');
  await page.locator('[data-key="night-next"]').click();
  await expect(page.locator('.crisis')).toBeVisible();
  await expect(page.locator('.crisis a[href="tel:1925"]')).toBeVisible();
});

test('a false alarm in the worry can continue with the text kept', async ({ page }) => {
  await startRitual(page);
  await page.fill('#night-worry', '明天簡報，緊張到想死');
  await page.locator('[data-key="night-next"]').click();
  await expect(page.locator('.crisis')).toBeVisible();
  await page.locator('[data-key="crisis-continue"]').click();
  await expect(page.locator('.crisis')).toHaveCount(0);
  await expect(page.locator('#night-kind')).toBeVisible();
  // the worry is still there when going back
  await page.getByRole('button', { name: '上一步' }).click();
  await expect(page.locator('#night-worry')).toHaveValue('明天簡報，緊張到想死');
});

test('a shared prompt link opens that prompt by number, and ignores anything else', async ({ page }) => {
  await page.goto('/#ask=0');
  await expect(page.locator('.prompt-text')).toHaveText('今天你注意到了什麼小事？');
  await expect(page.locator('.exchange-from')).toBeVisible();
  await page.goto('/#ask=%E4%BD%A0%E5%A5%BD%');
  await page.reload();
  await expect(page.locator('.rec-btn')).toBeVisible();
  await expect(page.locator('.exchange-from')).toHaveCount(0);
});

test('a low mood check-in shows things that helped before', async ({ page }) => {
  // daytime: in the evening the note is shortened to one item of each
  await page.clock.install({ time: new Date('2026-11-24T14:00:00+08:00') });
  await page.goto('/');
  await page.evaluate(
    () =>
      new Promise((res) => {
        const q = indexedDB.open('murmur', 3);
        q.onsuccess = () => {
          const t = q.result.transaction(['entries', 'nights'], 'readwrite');
          t.objectStore('nights').put({ id: 'n1', createdAt: Date.now() - 86400000, kindness: '早點睡', seed: 's', lang: 'zh-TW' });
          t.objectStore('entries').put({ id: 'e1', createdAt: Date.now() - 3600000, mood: 2, energy: 2, featureVersion: 2, features: { ok: true, contour: [] } });
          t.oncomplete = res;
        };
      })
  );
  await page.reload();
  await expect(page.locator('.low-card')).toContainText('早點睡');
  await expect(page.locator('.low-card .plain-list').nth(1).locator('li')).toHaveCount(3);
});

test('gentle recommendations open from the lens tab and hide heavy works by default', async ({ page }) => {
  await page.goto('/#lens');
  await page.getByRole('button', { name: /溫柔的作品推薦/ }).click();
  await expect(page.locator('.rec').first()).toBeVisible();
  // six at first, the rest on request
  expect(await page.locator('.rec').count()).toBe(6);
  await page.locator('[data-key="recs-more"]').click();
  const light = await page.locator('.rec').count();
  expect(light).toBeGreaterThan(15);
  await expect(page.locator('#sheet')).not.toContainText('精神病房也會迎來清晨');
  await page.getByText('也顯示內容較沉重的作品').click();
  await page.locator('[data-key="recs-more"]').click();
  expect(await page.locator('.rec').count()).toBeGreaterThan(light);
});

test('leaving the Today tab mid-ritual keeps what was written', async ({ page }) => {
  await startRitual(page);
  await page.fill('#night-worry', '明天要報告');
  await page.locator('[data-key="night-next"]').click();
  await page.fill('#night-kind', '早點洗澡');
  await page.goto('/#lens');
  await page.goto('/#today');
  await expect(page.locator('#night-kind')).toHaveValue('早點洗澡');
});

test('just listen goes from the card straight to a track; leave returns to Today', async ({ page }) => {
  // 10 pm in the pinned time zone, so the evening card is there whenever the test runs
  await page.clock.setFixedTime(new Date('2026-11-24T22:00:00+08:00'));
  await page.goto('/');
  await skipWelcome(page);
  const listen = page.locator('[data-key="night-listen"]');
  await listen.click();
  await expect(page.locator('.view.night.playing')).toBeVisible();
  await page.locator('[data-key="night-leave"]').click();
  await expect(page.locator('.view.night')).toHaveCount(0);
});

test('help lines are one tap away during the ritual', async ({ page }) => {
  await startRitual(page);
  await page.locator('[data-key="night-help"]').click();
  await expect(page.locator('.view.night a[href="tel:1925"]')).toBeVisible();
});

test('a goodnight card carries only the chosen line, never what was written', async ({ page }) => {
  await startRitual(page);
  await page.fill('#night-worry', '和室友吵架');
  await page.locator('[data-key="night-next"]').click();
  await page.fill('#night-kind', '吃了一頓好吃的');
  await page.locator('[data-key="night-next"]').click();
  await page.locator('[data-key="night-skip-track"]').click();
  await page.locator('[data-key="night-send"]').click();
  await page.locator('[data-key="send-line-0"]').click();
  await expect(page.locator('.send-preview svg')).toBeVisible();
  // the card shows the chosen line and nothing written tonight
  await expect(page.locator('.send-preview')).toContainText('晚安。今天辛苦了。');
  await expect(page.locator('.send-preview')).not.toContainText('吃了一頓好吃的');
  await expect(page.locator('.send-preview')).not.toContainText('和室友吵架');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-key="send-share"]').click()]);
  expect(download.suggestedFilename()).toMatch(/^goodnight-.*\.png$/);
});

test("the track that fits tonight's worry comes first", async ({ page }) => {
  await startRitual(page);
  await page.locator('[data-key="night-theme-family"]').click();
  await page.locator('[data-key="night-next"]').click();
  await page.locator('[data-key="night-next"]').click();
  await expect(page.locator('.track').nth(1)).toHaveAttribute('data-key', 'track-family-systems');
  await expect(page.locator('.track.suggested')).toHaveCount(1);
  await expect(page.locator('.track')).toHaveCount(4); // choose for me, the suggestion, two more
  await page.locator('[data-key="tracks-all"]').click();
  await expect(page.locator('.track')).toHaveCount(10);
});

test('several kinds of worry can be chosen; the first leads the tracks and the night keeps them all', async ({ page }) => {
  await startRitual(page);
  const chip = (k) => page.locator(`[data-key="night-theme-${k}"]`);
  await expect(page.locator('.theme-chips [role="radio"]')).toHaveCount(0);
  await chip('unsure').click();
  await expect(chip('unsure')).toHaveAttribute('aria-pressed', 'true');
  await chip('family').click(); // a named kind switches "hard to say" off
  await expect(chip('unsure')).toHaveAttribute('aria-pressed', 'false');
  await chip('work').click();
  await chip('health').click();
  await chip('health').click(); // and off again
  await expect(chip('family')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip('work')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip('health')).toHaveAttribute('aria-pressed', 'false');
  await expect(chip('health')).toBeFocused(); // the keyboard stays on the chip just pressed
  for (const k of ['work', 'relationship', 'family', 'health', 'future', 'unsure']) {
    const box = await chip(k).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator('[data-key="night-next"]')).toHaveText('下一步');
  await page.locator('[data-key="night-next"]').click();
  await page.locator('[data-key="night-next"]').click();
  // family was chosen first, so its track is the suggestion; the track for work comes next
  await expect(page.locator('.track').nth(1)).toHaveAttribute('data-key', 'track-family-systems');
  await expect(page.locator('.track').nth(2)).toHaveAttribute('data-key', 'track-solution-focused');
  await expect(page.locator('.track.suggested')).toHaveCount(1);
  // lines pass quickly in tests, so collect every line the track shows
  await page.evaluate(() => {
    window.__lines = new Set();
    new MutationObserver(() => {
      const el = document.getElementById('night-line');
      if (el) window.__lines.add(el.textContent);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await page.locator('[data-key="track-family-systems"]').click();
  await expect(page.locator('.postcard svg')).toBeVisible({ timeout: 20_000 });
  const night = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('murmur');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('nights').objectStore('nights').getAll();
          all.onsuccess = () => resolve(all.result.at(-1));
          all.onerror = () => reject(all.error);
        };
      })
  );
  expect(await page.evaluate(() => [...window.__lines])).toContain('今晚心上有家裡的事，也有工作或學業的事。');
  expect(night.themes).toEqual(['family', 'work']);
  expect(night.theme).toBe('family');
});

test('the journal shows a quiet look back at the last seven days, and nothing when there is nothing', async ({ page }) => {
  await page.goto('/#journal');
  await expect(page.locator('.week-card')).toHaveCount(0);
  await page.evaluate(
    () =>
      new Promise((res) => {
        const q = indexedDB.open('murmur', 3);
        q.onsuccess = () => {
          const t = q.result.transaction('nights', 'readwrite');
          t.objectStore('nights').put({ id: 'w1', createdAt: Date.now() - 86400000, kindness: '散步回家', seed: 's', lang: 'zh-TW' });
          t.oncomplete = res;
        };
      })
  );
  await page.reload();
  await page.locator('.week-card summary').click();
  await expect(page.locator('.week-card')).toContainText('做了 1 次睡前儀式');
  await expect(page.locator('.week-card')).toContainText('散步回家');
});

test('in the evening the bedtime card comes first, a low check-in adds a short note, and the ritual is dark', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-24T22:30:00+08:00') });
  await page.goto('/');
  await skipWelcome(page);
  await page.locator('[data-key="silent-checkin"]').click();
  await page.locator('[data-key="mood-2"]').click();
  await page.locator('[data-key="save"]').click();
  await expect(page.locator('.low-card')).toBeVisible();
  // the bedtime card sits above the low-mood note, which has no second way into the ritual
  const order = await page.evaluate(() => {
    const night = document.querySelector('.night-card');
    const low = document.querySelector('.low-card');
    return night.compareDocumentPosition(low) & Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(order).toBeTruthy();
  await expect(page.locator('.low-card button', { hasText: '睡前儀式' })).toHaveCount(0);
  await expect(page.locator('.low-card li')).toHaveCount(1);
  await page.locator('[data-key="night-start"]').click();
  await expect(page.locator('html')).toHaveClass(/night-mode/);
  await page.locator('[data-key="night-leave"], .night-leave').first().click();
  await expect(page.locator('html')).not.toHaveClass(/night-mode/);
});

test('in the evening, the lowest check-in keeps the note with help above the bedtime card', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-24T20:30:00+08:00') });
  await page.goto('/');
  await skipWelcome(page);
  await page.locator('[data-key="silent-checkin"]').click();
  await page.locator('[data-key="mood-1"]').click();
  await page.locator('[data-key="save"]').click();
  await expect(page.locator('.low-card')).toBeVisible();
  const lowFirst = await page.evaluate(() => {
    const night = document.querySelector('.night-card');
    const low = document.querySelector('.low-card');
    return !!(low.compareDocumentPosition(night) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(lowFirst).toBe(true);
  await expect(page.locator('.low-card .low-links button').first()).toHaveText('可以找人說話的地方');
  await expect(page.locator('.low-card')).not.toContainText(/白天|便利商店/);
});
