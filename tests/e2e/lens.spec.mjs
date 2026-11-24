import { test, expect } from '@playwright/test';

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
    await page.fill('#lens-concern', '我一直擔心報告做不好，晚上睡不好');
    await page.locator('[data-key="topic-work"]').click();
    await page.getByRole('button', { name: '下一步' }).click();
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
    await page.locator('[data-key="topic-self"]').click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.locator('.crisis')).toBeVisible();
    await expect(page.locator('.crisis a[href="tel:1925"]')).toBeVisible();
    await expect(page.locator('.lens-help')).toHaveCount(0);
  });

  test('risk language inside an answer also stops the exercise', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '工作壓力很大，今天累死了');
    await page.locator('[data-key="topic-work"]').click();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: /自己選/ }).click();
    await page.locator('.lens-card .btn').first().click();
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
    await page.locator('[data-key="topic-work"]').click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.locator('.crisis')).toBeVisible();
    await page.locator('[data-key="crisis-continue"]').click();
    await expect(page.locator('.crisis')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /自己選/ })).toBeVisible();
  });

  test('Next turns on whether the topic or the text comes first', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.locator('[data-key="topic-work"]').click();
    const next = page.locator('[data-key="lens-concern-next"]');
    await expect(next).toBeDisabled();
    await page.fill('#lens-concern', '主管一直改需求');
    await expect(next).toBeEnabled();
  });

  test('help lines switch region and remember it', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '最近真的不想活了');
    await page.locator('[data-key="topic-self"]').click();
    await page.locator('[data-key="lens-concern-next"]').click();
    await expect(page.locator('.crisis a[href="tel:1925"]')).toBeVisible();
    await expect(page.locator('.crisis a[href="tel:988"]')).toHaveCount(0);
    await page.locator('[data-key="region-US"]').click();
    await expect(page.locator('.crisis a[href="tel:988"]')).toBeVisible();
    await expect(page.locator('.crisis a[href="tel:1925"]')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('murmur-region'))).toBe('US');
  });

  test('topic chips work with arrow keys and keep one tab stop', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.locator('[data-key="topic-work"]').click();
    await page.keyboard.press('ArrowRight');
    const checked = page.locator('[role="radiogroup"] [aria-checked="true"]');
    await expect(checked).toHaveCount(1);
    await expect(checked).not.toHaveAttribute('data-key', 'topic-work');
    await expect(checked).toBeFocused();
    expect(await page.locator('[role="radiogroup"] [role="radio"][tabindex="0"]').count()).toBe(1);
  });

  test('loss topic hides lenses unsuited to grief', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '外婆上個月過世了');
    await page.locator('[data-key="topic-loss"]').click();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: /自己選/ }).click();
    const names = await page.locator('.lens-card h3').allInnerTexts();
    expect(names).not.toContain('存在主義取向');
    expect(names).not.toContain('焦點解決取向');
    expect(names).toContain('個人中心取向');
  });

  test('help resources are always reachable', async ({ page }) => {
    await page.goto('/#lens');
    await page.getByRole('button', { name: '求助專線' }).click();
    await expect(page.locator('.resource-list a[href="tel:113"]')).toBeVisible();
  });
});
