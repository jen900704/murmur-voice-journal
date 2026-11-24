import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// the first visit shows a welcome card; close it so the usual Today screen is there
async function skipWelcome(page) {
  await page.locator('.prompt-text').waitFor();
  const w = page.locator('[data-key="welcome-close"]');
  if (await w.count()) await w.click();
}

// Accessibility audit (WCAG 2.1 A and AA) of each main screen, light and dark, zh-TW and en.
const screens = [
  ['today', async (page) => page.goto('/')],
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
    await page.locator('.lens-card .btn').first().click();
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
