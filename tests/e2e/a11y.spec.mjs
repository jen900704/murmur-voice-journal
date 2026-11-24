import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// the first visit shows a welcome card; close it so the usual Today screen is there
async function skipWelcome(page) {
  await page.locator('.prompt-text').waitFor();
  const w = page.locator('[data-key="welcome-close"]');
  if (await w.count()) await w.click();
}

const key = (page, k) => page.locator(`[data-key="${k}"]`);
// enough text, in the language of the pass, for the language mirror to show numbers
const ZH_TEXT = Array.from({ length: 12 }, (_, i) => `我今天和朋友一起去吃飯，我覺得很開心。可是我最近工作壓力很大，我沒有睡好，也許明天我們再聊。第${i + 1}天。`).join('\n');
const EN_TEXT = Array.from({ length: 30 }, (_, i) => `I think the walk helped me today, and I am grateful because my friend came along. Maybe we will go again tomorrow, but I worry about the deadline. Day ${i + 1}.`).join(' ');

async function openCalm(page) {
  await page.clock.install({ time: new Date('2026-11-24T15:00:00+08:00') });
  await page.goto('/');
  await skipWelcome(page);
  await key(page, 'calm-link').click();
  await key(page, 'calm-start').waitFor();
}
async function openWriting(page) {
  await page.goto('/');
  await skipWelcome(page);
  await key(page, 'writing-link').click();
  await key(page, 'writing-tab-deep').waitFor();
}
async function openMirror(page) {
  await page.goto('/#journal');
  await key(page, 'jmode-words').click();
  await key(page, 'll-text').waitFor();
}
async function mirrorResults(page) {
  await openMirror(page);
  const en = await page.evaluate(() => navigator.language.startsWith('en'));
  await key(page, 'll-text').fill(en ? EN_TEXT : ZH_TEXT);
  await key(page, 'll-analyze').click();
  await key(page, 'll-notice').waitFor();
}
async function silentCheckin(page, note) {
  await key(page, 'silent-checkin').click();
  await page.fill('#note', note);
  await key(page, 'save').click();
  await key(page, 'silent-checkin').waitFor();
}

// Accessibility audit (WCAG 2.1 A and AA) of each main screen, light and dark, zh-TW and en.
const screens = [
  ['today', async (page) => {
    await page.goto('/');
    await skipWelcome(page);
  }],
  ['journal (demo)', async (page) => {
    await page.goto('/#journal');
    await page.locator('.journal .btn').click();
    await page.goto('/#journal');
  }],
  ['trends (demo)', async (page) => {
    await page.goto('/#journal');
    await page.locator('.journal .btn').click();
    await page.waitForURL(/#trends/);
  }],
  ['lens home', async (page) => page.goto('/#lens')],
  ['lens step', async (page) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', 'work stress');
    await page.locator('[data-key="topic-work"]').click();
    await page.locator('.actions .btn.primary').click();
    await page.locator('.lens-option').nth(2).click();
    await page.locator('.lens-row').first().click();
  }],
  ['ritual worry', async (page) => {
    await page.goto('/');
    await skipWelcome(page);
    await skipWelcome(page);
  await page.locator('[data-key="night-start"], [data-key="night-link"]').first().click();
  }],
  ['about', async (page) => page.goto('/#about')],
  ['ritual playback', async (page) => {
    await page.goto('/');
    await skipWelcome(page);
    await skipWelcome(page);
  await page.locator('[data-key="night-start"], [data-key="night-link"]').first().click();
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="track-person-centered"]').click();
    await page.locator('.night-play').waitFor();
  }],
  ['postcard', async (page) => {
    await page.addInitScript(() => (globalThis.__MURMUR_SPEED = 500));
    await page.goto('/');
    await skipWelcome(page);
    await skipWelcome(page);
  await page.locator('[data-key="night-start"], [data-key="night-link"]').first().click();
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-skip-track"]').click();
    await page.locator('.postcard svg').waitFor();
  }],
  ['gentle sheet', async (page) => {
    await page.goto('/#lens');
    await page.locator('.lens-link').last().click();
    await page.locator('.rec').first().waitFor();
  }],
  ['breathing pacer', async (page) => {
    await page.goto('/');
    await page.locator('[data-key="breathe-link"]').click();
    await page.locator('[data-key="breathe-start"]').click();
    await page.locator('.breathe-phase').filter({ hasText: /./ }).waitFor();
  }],
  ['AI conversation', async (page) => {
    await page.route('https://api.anthropic.com/**', (route) => route.fulfill({ json: { content: [{ type: 'text', text: 'It sounds like this has been weighing on you. What part feels heaviest?' }], stop_reason: 'end_turn' } }));
    await page.goto('/#about');
    await page.locator('[data-key="ai-enabled"]').check();
    await page.fill('#ai-key', 'sk-ant-test');
    await page.locator('#ai-key').press('Tab');
    await page.waitForTimeout(300);
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', 'work stress');
    await page.locator('[data-key="topic-work"]').click();
    await page.locator('[data-key="lens-concern-next"]').click();
    await page.locator('.lens-option').nth(2).click();
    await page.locator('.lens-row').first().click();
    for (let i = 0; i < 5 && !(await page.locator('.lens-summary').count()); i++) {
      if (await page.locator('.scale-11').count()) await page.locator('[data-key="scale-3"]').click();
      else await page.fill('#lens-answer', 'something');
      await page.locator('[data-key="lens-next"]').click();
    }
    await page.locator('[data-key="ai-open"]').click();
    await page.fill('#ai-input', 'I keep putting it off');
    await page.locator('[data-key="ai-send"]').click();
    await page.locator('.ai-msg.assistant').waitFor();
  }],
  ['crisis pause', async (page) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '最近真的不想活了');
    await page.locator('[data-key="topic-self"]').click();
    await page.locator('[data-key="lens-concern-next"]').click();
    await page.locator('.crisis').waitFor();
  }],
  ['compare three', async (page) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', 'work stress');
    await page.locator('[data-key="topic-work"]').click();
    await page.locator('[data-key="lens-concern-next"]').click();
    await page.locator('.lens-option').nth(1).click();
    await page.locator('.lens-card').first().waitFor();
  }],
  ['card deck', async (page) => {
    await page.goto('/#lens');
    await page.locator('.lens-link').first().click();
    await page.locator('.deck-card').first().waitFor();
  }],
  ['evening card', async (page) => {
    // 10 pm in the pinned time zone, so the evening card shows whenever the test runs
    await page.clock.setFixedTime(new Date('2026-11-24T22:00:00+08:00'));
    await page.goto('/');
    await skipWelcome(page);
    await page.locator('.night-card.evening').waitFor();
  }],
  ['welcome', async (page) => {
    await page.goto('/');
    await page.locator('.welcome').waitFor();
  }],
  ['silent check-in', async (page) => {
    await page.goto('/');
    await skipWelcome(page);
    await page.locator('[data-key="silent-checkin"]').click();
    await page.locator('[data-key="mood-3"]').click();
  }],
  ['lens pick list', async (page) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', 'family pressure');
    await page.locator('[data-key="topic-family"]').click();
    await page.locator('[data-key="lens-concern-next"]').click();
    await page.locator('.lens-option').nth(2).click();
    await page.locator('.lens-row').first().waitFor();
  }],
  ['lens summary', async (page) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', 'family pressure');
    await page.locator('[data-key="topic-family"]').click();
    await page.locator('[data-key="lens-concern-next"]').click();
    await page.locator('.lens-option').nth(2).click();
    await page.locator('[data-key="pick-family-systems"]').click();
    for (let i = 0; i < 3; i++) {
      await page.fill('#lens-answer', 'a few words');
      await page.locator('[data-key="lens-next"]').click();
    }
    await page.locator('.lens-summary').waitFor();
    await page.locator('[data-key="rate-4"]').click();
  }],
  ['calm sheet', openCalm],
  ['calm breathing', async (page) => {
    await openCalm(page);
    await key(page, 'calm-start').click();
    await page.locator('.breathe-phase').filter({ hasText: /./ }).waitFor();
    await page.clock.runFor(5_000); // into the pause of the first round
  }],
  ['calm grounding', async (page) => {
    await openCalm(page);
    await key(page, 'calm-start').click();
    await page.locator('.breathe-phase').filter({ hasText: /./ }).waitFor();
    await page.clock.runFor(61_000); // 5 rounds of 4 + 2 + 6 seconds
    await page.locator('.breathe-handoff').waitFor();
    await key(page, 'calm-next').click();
    await page.locator('.ground').waitFor();
  }],
  ['writing sheet', openWriting],
  ['writing deep prompt', async (page) => {
    await openWriting(page);
    await key(page, 'writing-tab-deep').click();
    await key(page, 'writing-deep-note').waitFor();
    await page.locator('.writing-prompt').first().click();
    await key(page, 'writing-text').waitFor();
    await key(page, 'writing-text').fill('a few words');
  }],
  ['writing deep note', async (page) => {
    await openWriting(page);
    await key(page, 'writing-tab-deep').click();
    await key(page, 'writing-deep-note').waitFor();
    await page.locator('.writing-help summary').click();
  }],
  ['language mirror empty', openMirror],
  ['language mirror results', async (page) => {
    await mirrorResults(page);
    await key(page, 'll-group-moral').locator('> summary').click();
    await key(page, 'll-group-moral').locator('.ll-row').first().waitFor();
  }],
  ['language mirror evidence', async (page) => {
    await mirrorResults(page);
    await key(page, 'score-i').click();
    await key(page, 'll-cannot').waitFor();
  }],
  ['policy opt-in card', async (page) => {
    await page.goto('/#lens');
    await key(page, 'lens-start').click();
    await page.fill('#lens-concern', 'work stress');
    await key(page, 'topic-work').click();
    await key(page, 'lens-concern-next').click();
    await page.locator('.lens-option').nth(2).click();
    await page.locator('.lens-row').first().waitFor();
    // the card is offered only until the person answers it; audit it when it is there
    const card = key(page, 'policy-optin');
    await card.waitFor({ timeout: 3000 }).catch(() => {});
    if (await card.count()) await card.scrollIntoViewIfNeeded();
  }],
  ['journal search results', async (page) => {
    await page.goto('/');
    await skipWelcome(page);
    await silentCheckin(page, '今天上班好累，主管又改需求 work');
    await silentCheckin(page, 'Slept badly, worried about work and the exam');
    await page.goto('/#journal');
    await page.locator('#journal-search-input').fill('work');
    await expect(page.locator('.search-hit').first()).toBeVisible();
  }],
];

for (const [locale, scheme] of [
  ['zh-TW', 'light'],
  ['en-US', 'dark'],
]) {
  test.describe(`${locale} ${scheme}`, () => {
    test.use({ locale, colorScheme: scheme });
    for (const [name, open] of screens) {
      test(`no WCAG A/AA violations: ${name}`, async ({ page }) => {
        await open(page);
        await page.waitForTimeout(300);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
        expect(summary, summary.join('\n')).toEqual([]);
      });
    }
  });
}
