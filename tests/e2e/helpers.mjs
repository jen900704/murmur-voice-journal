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
