import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

// Launch options that feed a WAV file into Chrome's fake microphone.
export function fakeMic(file) {
  return {
    executablePath: process.env.CHROME_PATH || undefined,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${path.join(here, '..', 'fixtures', file)}`,
    ],
  };
}

// Records for `seconds` and stops, then waits for the result or an error.
export async function record(page, seconds = 8) {
  await page.click('.rec-btn');
  await page.waitForTimeout(seconds * 1000);
  await page.click('.rec-btn');
  await page.waitForSelector('.result-head, .error', { timeout: 30_000 });
}

export async function storedEntries(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const q = indexedDB.open('murmur');
        q.onsuccess = () => {
          const r = q.result.transaction('entries').objectStore('entries').getAll();
          r.onsuccess = () => resolve(r.result);
        };
      })
  );
}

// The lens worry is three short screens: the words, the kinds of worry, and how heavy it
// feels (optional). enterConcern goes through all three and lands on choosing an angle.
export async function enterConcern(page, text, topics = ['work'], { before = null } = {}) {
  await page.fill('#lens-concern', text);
  await page.locator('[data-key="lens-worry-next"]').click();
  for (const t of topics) await page.locator(`[data-key="topic-${t}"]`).click();
  await page.locator('[data-key="lens-topics-next"]').click();
  if (before !== null) await page.locator('[data-key="heavy-before-input"]').fill(String(before));
  await page.locator('[data-key="lens-concern-next"]').click();
}

// The summary's secondary actions (another angle, save image, AI chat, finish without saving) are in a sheet.
export async function openLensMore(page) {
  await page.locator('[data-key="lens-more-open"]').click();
  await page.locator('[data-key="lens-sheet"][open]').waitFor();
}

// When a flow (lens exercise, bedtime ritual) ends, it removes its own history entry with
// history.back(), which lands a moment later. Navigating before that lands would be undone by it.
export async function flowSettled(page) {
  await page.waitForFunction(() => !(history.state && typeof history.state === 'object' && history.state.murmurFlow));
}
