// Regenerates the README screenshots in docs/ from the running app.
// Run with a local server on port 8799 (python3 -m http.server 8799) and:
//   CHROME_PATH=/usr/bin/google-chrome node tools/screenshots.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8799/';
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'America/New_York' });
await ctx.addInitScript(() => {
  globalThis.__MURMUR_SPEED = 0.05; // hold the first line on screen
});
const page = await ctx.newPage();
const out = (n) => new URL(`../docs/${n}.png`, import.meta.url).pathname;

async function fresh(hash = '') {
  await page.goto(BASE + hash);
  await page.locator('.prompt-text, .view').first().waitFor();
  const w = page.locator('[data-key="welcome-close"]');
  if (await w.count()) await w.click();
}

// lens summary (narrative therapy)
await fresh('#lens');
await page.goto(BASE + '#lens');
await page.locator('[data-key="lens-start"]').click();
await page.fill('#lens-concern', 'I keep putting off my thesis chapter');
await page.locator('[data-key="topic-work"]').click();
await page.locator('[data-key="lens-concern-next"]').click();
await page.getByRole('button', { name: /Choose myself/ }).click();
await page.locator('.lens-card', { hasText: 'Narrative therapy' }).locator('.btn').click();
for (const a of ['The Deadline Monster', 'It tells me I will fail anyway, so I scroll my phone instead', 'Last Tuesday I wrote one paragraph even though it was loud']) {
  await page.fill('#lens-answer', a);
  await page.locator('[data-key="lens-next"]').click();
}
await page.locator('.lens-summary, .summary, .lens-card').first().scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: out('lens') });

// bedtime playing
await fresh();
await page.locator('[data-key="night-start"], [data-key="night-link"]').first().click();
await page.fill('#night-worry', 'Presentation tomorrow');
await page.locator('[data-key="night-theme-work"]').click();
await page.locator('[data-key="night-next"]').click();
await page.fill('#night-kind', 'Bought the bread I like after work');
await page.locator('[data-key="night-next"]').click();
await page.locator('[data-key="track-person-centered"]').click();
await page.locator('.view.night.playing').waitFor();
await page.waitForTimeout(2500);
await page.screenshot({ path: out('bedtime') });

// postcard
await page.evaluate(() => (globalThis.__MURMUR_SPEED = 400));
await page.locator('.postcard svg').waitFor({ timeout: 60000 });
await page.screenshot({ path: out('postcard') });

// trends and journal from the demo data
await fresh();
await page.goto(BASE + '#about');
await page.getByRole('button', { name: /demo/i }).first().click();
await page.waitForURL(/#trends/);
await page.waitForTimeout(500);
await page.screenshot({ path: out('trends') });
await page.goto(BASE + '#journal');
await page.waitForTimeout(500);
await page.screenshot({ path: out('journal') });

await browser.close();
console.log('screenshots written to docs/');
