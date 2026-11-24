import { test, expect } from '@playwright/test';

test.use({ locale: 'zh-TW' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__MURMUR_SPEED = 200;
  });
});

async function startRitual(page) {
  await page.goto('/');
  // evening shows a card, daytime shows a link; either opens the ritual
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
});

test('a shared prompt link opens that prompt by number, and ignores anything else', async ({ page }) => {
  await page.goto('/#ask=0');
  await expect(page.locator('.prompt-text')).toHaveText('今天有什麼小事讓你注意到了？');
  await expect(page.locator('.exchange-from')).toBeVisible();
  await page.goto('/#ask=%E4%BD%A0%E5%A5%BD%');
  await page.reload();
  await expect(page.locator('.rec-btn')).toBeVisible();
  await expect(page.locator('.exchange-from')).toHaveCount(0);
});

test('a low mood check-in shows things that helped before', async ({ page }) => {
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
});

test('gentle recommendations open from the lens tab and hide heavy works by default', async ({ page }) => {
  await page.goto('/#lens');
  await page.getByRole('button', { name: /溫和的作品推薦/ }).click();
  await expect(page.locator('.rec').first()).toBeVisible();
  const light = await page.locator('.rec').count();
  expect(light).toBeGreaterThan(15);
  await expect(page.locator('#sheet')).not.toContainText('精神病房也會迎來清晨');
  await page.getByText('也顯示內容較沉重的作品').click();
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
