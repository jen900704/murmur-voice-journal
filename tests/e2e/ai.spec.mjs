import { test, expect } from '@playwright/test';

test.use({ locale: 'zh-TW' });

const JOURNAL_NOTE = '只有日記裡才有的句子：昨晚和室友大吵一架';

async function finishLens(page) {
  await page.goto('/#lens');
  await page.locator('[data-key="lens-start"]').click();
  await page.fill('#lens-concern', '報告一直拖著沒寫');
  await page.locator('[data-key="topic-work"]').click();
  // with AI on, the lens exercise can also use the model; these tests are about the chat, so use the fixed version
  await page.locator('[data-key="lens-llm-off"]').waitFor({ state: 'visible', timeout: 3000 }).then(() => page.locator('[data-key="lens-llm-off"]').check()).catch(() => {});
  await page.locator('.actions .btn.primary').click();
  await page.locator('.lens-option').nth(2).click();
  // pick the cognitive lens explicitly
  await page.locator('.lens-row', { hasText: '認知取向' }).click();
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
  await expect(page.locator('[data-key="ai-note"]')).toHaveCount(0);
});

test('with a key, the conversation uses the lens and sends only what it should', async ({ page }) => {
  const bodies = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    expect(req.headers()['x-api-key']).toBe('sk-ant-test');
    expect(req.headers()['anthropic-dangerous-direct-browser-access']).toBe('true');
    bodies.push(JSON.parse(req.postData()));
    await route.fulfill({ json: { content: [{ type: 'text', text: '你提到報告一直拖著。當你想到要開始寫，腦中第一個想法是什麼？[cognitive.concepts]' }] } });
  });
  await enableAi(page);
  // something in the journal, which must never reach the model
  await page.goto('/#today');
  const w = page.locator('[data-key="welcome-close"]');
  if (await w.count()) await w.click();
  await page.locator('[data-key="silent-checkin"]').click();
  await page.fill('#note', JOURNAL_NOTE);
  await page.locator('[data-key="save"]').click();
  await page.goto('/#journal');
  await expect(page.locator('.silent-list')).toContainText(JOURNAL_NOTE);
  await finishLens(page);
  // the page itself does not respond to the answers; one quiet line says where that happens
  await expect(page.locator('[data-key="ai-note"]')).toContainText('AI 對話');
  await expect(page.locator('.lens-summary blockquote.lens-answer').first()).toHaveText('回答 1');
  await page.locator('[data-key="ai-open"]').click();
  await page.fill('#ai-input', '我覺得自己很爛');
  await page.locator('[data-key="ai-send"]').click();
  await expect(page.locator('.ai-msg.assistant')).toContainText('第一個想法');
  // passage ids are not shown; the line under the reply names what it was based on
  await expect(page.locator('.ai-msg.assistant')).not.toContainText('cognitive.');
  await expect(page.locator('.ai-msg.assistant .ai-based')).toHaveText('根據：認知取向｜自動化思考、認知扭曲、證據檢驗');
  expect(bodies).toHaveLength(1);
  expect(bodies[0].system).toContain('Cognitive');
  expect(bodies[0].system).toContain('Never use:');
  expect(bodies[0].system).not.toContain('報告一直拖著沒寫');
  expect(bodies[0].messages).toHaveLength(1);
  expect(bodies[0].messages[0].content).toContain('<person_notes>');
  expect(bodies[0].messages[0].content).toContain('報告一直拖著沒寫');
  expect(bodies[0].messages[0].content.endsWith('我覺得自己很爛')).toBe(true);
  // the retrieved block: fenced, three passages of this lens with ids, all of it app text
  const block = bodies[0].system.match(/<murmur_reference>\n([\s\S]*?)\n<\/murmur_reference>$/);
  expect(block).not.toBeNull();
  const lines = block[1].split('\n');
  expect(lines).toHaveLength(3);
  const content = await page.evaluate(async () => (await import('./js/rag.js')).buildChunks('TW').map((c) => `[${c.id}] ${c.text.zh}`));
  for (const line of lines) {
    expect(line).toMatch(/^\[cognitive\.(idea|concepts|misses|why\d)\] /);
    expect(content).toContain(line);
  }
  expect(bodies[0].system).toContain('stay within these passages');
  expect(bodies[0].system).not.toContain('我覺得自己很爛');
  // nothing from the journal anywhere in the request
  expect(JSON.stringify(bodies[0])).not.toContain(JOURNAL_NOTE);
  expect(JSON.stringify(bodies[0])).not.toContain('室友');
  expect(Object.keys(bodies[0].messages[0]).sort()).toEqual(['content', 'role']);

  // a second turn sends the earlier reply back as the model wrote it, and again no journal text
  await page.fill('#ai-input', '室友的事我不想談');
  await page.locator('[data-key="ai-send"]').click();
  await expect(page.locator('.ai-msg.assistant')).toHaveCount(2);
  expect(bodies).toHaveLength(2);
  expect(bodies[1].messages.map((m) => Object.keys(m).sort().join())).toEqual(['content,role', 'content,role', 'content,role']);
  expect(bodies[1].messages[1].content).toContain('[cognitive.concepts]');
  expect(bodies[1].system).toMatch(/<murmur_reference>\n[\s\S]*\n<\/murmur_reference>$/);
  expect(bodies[1].system).not.toContain('室友');
  expect(JSON.stringify(bodies[1])).not.toContain(JOURNAL_NOTE);
});

test('risk language pauses with help before anything is sent', async ({ page }) => {
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
  await expect(page.locator('.crisis a[href="tel:1925"]')).toBeVisible();
  expect(calls).toBe(0);
});

test('a reply that gives help lines ends the chat and shows tappable numbers; 1988 does not count', async ({ page }) => {
  let n = 0;
  await page.route('https://api.anthropic.com/**', (route) => {
    n++;
    const text = n === 1 ? '你說你 1988 年就開始這樣了。那時候發生了什麼？' : '這比這個練習能承接的更沉重。請現在打 1925 或 988 找人聊聊。';
    route.fulfill({ json: { content: [{ type: 'text', text }], stop_reason: 'end_turn' } });
  });
  await enableAi(page);
  await finishLens(page);
  await page.locator('[data-key="ai-open"]').click();
  await page.fill('#ai-input', '一直都很累');
  await page.locator('[data-key="ai-send"]').click();
  await expect(page.locator('.ai-msg.assistant')).toHaveCount(1);
  await expect(page.locator('#sr-live')).toContainText('1988');
  await expect(page.locator('#ai-input')).toBeVisible();
  await page.fill('#ai-input', '說不清楚');
  await page.locator('[data-key="ai-send"]').click();
  await expect(page.locator('.resource-list a[href="tel:1925"]')).toBeVisible();
  await expect(page.locator('#ai-input')).toHaveCount(0);
});

test('an empty or refused reply ends the exercise with help instead of breaking', async ({ page }) => {
  await page.route('https://api.anthropic.com/**', (route) => route.fulfill({ json: { content: [], stop_reason: 'refusal' } }));
  await enableAi(page);
  await finishLens(page);
  await page.locator('[data-key="ai-open"]').click();
  await page.fill('#ai-input', '嗯');
  await page.locator('[data-key="ai-send"]').click();
  await expect(page.locator('.resource-list a[href="tel:1925"]')).toBeVisible();
  await expect(page.locator('.ai-msg')).toHaveCount(0);
});

test('delete all data also removes the API key', async ({ page }) => {
  await enableAi(page);
  page.once('dialog', (d) => d.accept());
  await page.locator('.data-actions .btn.danger').click();
  const key = await page.evaluate(() => new Promise((r) => { const q = indexedDB.open('murmur'); q.onsuccess = () => { const g = q.result.transaction('settings').objectStore('settings').get('aiKey'); g.onsuccess = () => r(g.result); }; }));
  expect(key).toBeUndefined();
});

test('a risky reply without help lines is held back; the person can return with their text', async ({ page }) => {
  await page.route('https://api.anthropic.com/**', (route) => route.fulfill({ json: { content: [{ type: 'text', text: '聽起來你有自殺的念頭。' }] } }));
  await enableAi(page);
  await finishLens(page);
  await page.locator('[data-key="ai-open"]').click();
  await page.fill('#ai-input', '好累');
  await page.locator('[data-key="ai-send"]').click();
  await expect(page.locator('.crisis')).toBeVisible();
  await page.locator('[data-key="ai-crisis-continue"]').click();
  await expect(page.locator('#ai-input')).toHaveValue('好累');
  await expect(page.locator('.ai-msg')).toHaveCount(0);
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
