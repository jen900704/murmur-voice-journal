import { test, expect } from '@playwright/test';

test.use({ locale: 'zh-TW' });

async function finishLens(page) {
  await page.goto('/#lens');
  await page.locator('[data-key="lens-start"]').click();
  await page.fill('#lens-concern', '報告一直拖著沒寫');
  await page.locator('[data-key="topic-work"]').click();
  await page.locator('.actions .btn.primary').click();
  await page.locator('.lens-option').nth(2).click();
  // pick the cognitive lens explicitly
  await page.locator('.lens-card', { hasText: '認知治療' }).locator('.btn').click();
  for (let i = 0; i < 4 && !(await page.locator('.lens-summary').count()); i++) {
    await page.fill('#lens-answer', `回答 ${i + 1}`);
    await page.locator('[data-key="lens-next"]').click();
  }
  await expect(page.locator('.lens-summary')).toBeVisible();
}

async function enableAi(page, key = 'sk-ant-test') {
  await page.goto('/#about');
  await page.locator('[data-key="ai-enabled"]').check();
  await page.fill('#ai-key', key);
  await page.locator('#ai-key').press('Tab');
  await expect(page.locator('#ai-key')).toHaveAttribute('placeholder', /已儲存/);
}

test('AI conversation is off by default', async ({ page }) => {
  await finishLens(page);
  await expect(page.locator('[data-key="ai-open"]')).toHaveCount(0);
});

test('with a key, the conversation uses the lens and sends only what it should', async ({ page }) => {
  const bodies = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    expect(req.headers()['x-api-key']).toBe('sk-ant-test');
    expect(req.headers()['anthropic-dangerous-direct-browser-access']).toBe('true');
    bodies.push(JSON.parse(req.postData()));
    await route.fulfill({ json: { content: [{ type: 'text', text: '你提到報告一直拖著。當你想到要開始寫，腦中第一個想法是什麼？' }] } });
  });
  await enableAi(page);
  await finishLens(page);
  await page.locator('[data-key="ai-open"]').click();
  await page.fill('#ai-input', '我覺得自己很爛');
  await page.locator('[data-key="ai-send"]').click();
  await expect(page.locator('.ai-msg.assistant')).toContainText('第一個想法');
  expect(bodies).toHaveLength(1);
  expect(bodies[0].system).toContain('Cognitive therapy');
  expect(bodies[0].system).toContain('報告一直拖著沒寫');
  expect(bodies[0].system).toContain('Never use:');
  expect(bodies[0].messages).toEqual([{ role: 'user', content: '我覺得自己很爛' }]);
});

test('risk language in the message never reaches the API', async ({ page }) => {
  let calls = 0;
  await page.route('https://api.anthropic.com/**', (route) => {
    calls++;
    route.fulfill({ json: { content: [{ type: 'text', text: 'x' }] } });
  });
  await enableAi(page);
  await finishLens(page);
  await page.locator('[data-key="ai-open"]').click();
  await page.fill('#ai-input', '其實我最近一直想死');
  await page.locator('[data-key="ai-send"]').click();
  await expect(page.locator('.crisis')).toBeVisible();
  expect(calls).toBe(0);
});

test('a risky reply without help lines is replaced by the help screen', async ({ page }) => {
  await page.route('https://api.anthropic.com/**', (route) => route.fulfill({ json: { content: [{ type: 'text', text: '聽起來你有自殺的念頭。' }] } }));
  await enableAi(page);
  await finishLens(page);
  await page.locator('[data-key="ai-open"]').click();
  await page.fill('#ai-input', '好累');
  await page.locator('[data-key="ai-send"]').click();
  await expect(page.locator('.crisis')).toBeVisible();
});

test('an invalid key shows a clear message and keeps the draft', async ({ page }) => {
  await page.route('https://api.anthropic.com/**', (route) => route.fulfill({ status: 401, json: { error: { message: 'invalid x-api-key' } } }));
  await enableAi(page, 'sk-ant-bad');
  await finishLens(page);
  await page.locator('[data-key="ai-open"]').click();
  await page.fill('#ai-input', '試試看');
  await page.locator('[data-key="ai-send"]').click();
  await expect(page.locator('.error')).toContainText('API 金鑰無效');
  await expect(page.locator('#ai-input')).toHaveValue('試試看');
});
