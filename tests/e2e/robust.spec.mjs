import { test, expect, chromium } from '@playwright/test';
import { fakeMic, storedEntries } from './helpers.mjs';

// Robustness checks: things a phone user runs into without trying (double taps, the back
// button, long text, a backup file that is not quite right, storage that does not work).
// A test marked test.fail() documents a bug that is still open; remove the mark with the fix.

test.use({ locale: 'zh-TW' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__MURMUR_SPEED = 200;
  });
});

const WIDTH = 390;

async function skipWelcome(page) {
  await page.locator('.prompt-text').waitFor();
  const w = page.locator('[data-key="welcome-close"]');
  if (await w.count()) await w.click();
}

async function openToday(page) {
  await page.goto('/');
  await skipWelcome(page);
}

async function startRitual(page) {
  await openToday(page);
  await page.locator('[data-key="night-start"], [data-key="night-link"]').first().click();
  await page.locator('#night-worry').waitFor();
}

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function stored(page, store) {
  return page.evaluate(
    (name) =>
      new Promise((resolve) => {
        const q = indexedDB.open('murmur');
        q.onsuccess = () => {
          const r = q.result.transaction(name).objectStore(name).getAll();
          r.onsuccess = () => resolve(r.result);
        };
      }),
    store
  );
}

// elements that reach past the right edge of the screen (empty when nothing sticks out)
async function overflow(page, root = 'body') {
  const found = await page.evaluate(
    ([sel, width]) => {
      const out = [];
      for (const n of document.querySelector(sel).querySelectorAll('*')) {
        if (n.closest('svg') || n.closest('[hidden]')) continue;
        const r = n.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.right > width + 1) out.push(`${n.tagName.toLowerCase()}.${n.className} in ${n.parentElement.tagName.toLowerCase()}.${n.parentElement.className} right=${Math.round(r.right)}`);
      }
      // text that spills out of a block does not widen the block, but it does widen the scroll area
      const scroller = sel === 'body' ? document.documentElement : document.querySelector(sel);
      if (scroller.scrollWidth > width + 1) out.unshift(`${sel} scrolls sideways: ${scroller.scrollWidth}px`);
      for (const n of document.querySelector(sel).querySelectorAll('p, li, blockquote, h2, h3, div, label')) {
        if (n.closest('svg') || n.closest('[hidden]') || !n.clientWidth) continue;
        if (n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX === 'visible') out.push(`text spills out of ${n.tagName.toLowerCase()}.${n.className}: ${n.scrollWidth} > ${n.clientWidth}`);
      }
      return out.slice(0, 5);
    },
    [root, WIDTH]
  );
  return found.length ? found : null;
}

const features = (over = {}) => ({
  ok: true,
  durationS: 30,
  speechS: 20,
  f0MedianHz: 180,
  f0SdSt: 2.1,
  speechRate: 3.9,
  pauseRatio: 0.2,
  periodicityDb: 10,
  contour: Array.from({ length: 32 }, (_, i) => ({ f0: 170 + i, e: 0.5 })),
  quality: { clipFraction: 0, noiseFloorDb: -60, snrDb: 30, flags: [] },
  ...over,
});
const entry = (id, over = {}) => ({ id, createdAt: Date.now() - 3600_000, prompt: '今天過得如何？', lang: 'zh-TW', mood: 4, energy: 4, note: '', features: features(), featureVersion: 2, hasAudio: false, ...over });
const backup = (over = {}) => ({ app: 'murmur', version: 1, exportedAt: new Date().toISOString(), entries: [], nights: [], lensSessions: [], ...over });

async function importFile(page, data, name = 'murmur-backup.json') {
  if (!page.url().includes('#about')) await page.goto('/#about');
  await page.locator('.data-actions').waitFor();
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  // an earlier toast may still be showing; wait for this import's own message
  await page.evaluate(() => (document.querySelector('#toast').textContent = ''));
  await page.locator('.data-actions input[type="file"]').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(body) });
  await expect(page.locator('#toast')).not.toBeEmpty();
  return (await page.locator('#toast').textContent()) || '';
}

const LONG = 'https://example.com/' + 'a'.repeat(380);
const LONG_ZH = '今天真的好累好累'.repeat(15);
const MIXED = '😮‍💨👨‍👩‍👧‍👦 مرحبا بالعالم هذا نص طويل שלום עולם\n第二行\n' + 'word '.repeat(60).trim();

// ---------- backup import ----------
test.describe('backup import', () => {
  test('wrong files are refused without breaking the page', async ({ page }) => {
    const errors = collectErrors(page);
    for (const body of ['not json at all {', '[]', '[{"id":"a"}]', 'null', '42', '{"app":"other","entries":[]}', '{"app":"murmur","entries":{"0":{}}}', '{"app":"murmur","entries":[null,1,"x",[],{}]}']) {
      const toast = await importFile(page, body);
      expect(toast, body).toMatch(/不是 Murmur 的備份|已匯入 0 筆/);
    }
    expect(await storedEntries(page)).toHaveLength(0);
    expect(errors).toEqual([]);
  });

  test('the same backup imported twice does not duplicate anything', async ({ page }) => {
    const data = backup({
      entries: [entry('e1'), entry('e2', { silent: true, features: null })],
      nights: [{ id: 'n1', createdAt: Date.now() - 1000, theme: 'work', worry: 'w', kindness: 'k', track: 'acceptance', seed: 's', lang: 'zh-TW' }],
      lensSessions: [{ id: 's1', createdAt: Date.now() - 1000, lensId: 'cbt', topic: 'work', concern: 'c', answers: ['a', '3'], rating: 4 }],
    });
    expect(await importFile(page, data)).toContain('2');
    expect(await importFile(page, data)).toContain('0');
    expect(await storedEntries(page)).toHaveLength(2);
    expect(await stored(page, 'nights')).toHaveLength(1);
    expect(await stored(page, 'lensSessions')).toHaveLength(1);
  });

  test('a file with the same id twice reports the number actually stored', async ({ page }) => {
    // BUG: js/db.js:167-172 importEntries counts every record that passes the check, also a second one with the same id (put overwrites it). The toast says 2, one is stored. Fix: existing.add(e.id) after s.put(e).
    const toast = await importFile(page, backup({ entries: [entry('dup', { note: 'first' }), entry('dup', { note: 'second' })] }));
    expect(await storedEntries(page)).toHaveLength(1);
    expect(toast).toContain('1');
  });

  test('a backup from an older version (no nights, no lens sessions, old feature version) still opens', async ({ page }) => {
    const errors = collectErrors(page);
    const old = { app: 'murmur', version: 0, entries: [{ id: 'old1', createdAt: Date.now() - 86400000, mood: 3, note: 'old', features: { ok: true, f0MedianHz: 190 } }] };
    expect(await importFile(page, old)).toContain('1');
    await page.goto('/#journal');
    await page.locator('.tile').click();
    await expect(page.locator('#sheet')).toContainText('old');
    await page.keyboard.press('Escape');
    await page.goto('/#trends');
    await expect(page.locator('.view.trends')).toBeVisible();
    await page.goto('/#today');
    await expect(page.locator('.prompt-text')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a huge note and markup in fields are trimmed and shown as plain text', async ({ page }) => {
    const errors = collectErrors(page);
    const data = backup({
      entries: [entry('big', { note: LONG_ZH.repeat(200), prompt: '<img src=x onerror=alert(1)>', mood: 99, createdAt: Date.now() - 5000 })],
      nights: [{ id: 'n-big', createdAt: Date.now() - 4000, worry: LONG_ZH.repeat(50), kindness: '<b>bold</b> & "quoted"', track: 'nope', seed: 'x', lang: 'en' }],
    });
    await importFile(page, data);
    const [big] = await storedEntries(page);
    expect(big.note.length).toBeLessThanOrEqual(400);
    expect(big.mood).toBeNull();
    const [night] = await stored(page, 'nights');
    expect(night.worry.length).toBeLessThanOrEqual(1000);
    await page.goto('/#journal');
    await page.locator('.tile').click();
    await expect(page.locator('#sheet .detail-prompt')).toHaveText('<img src=x onerror=alert(1)>');
    expect(await page.locator('#sheet img').count()).toBe(0);
    expect(await overflow(page, '#sheet')).toBeNull();
    await page.keyboard.press('Escape');
    await page.locator('[data-key="jmode-nights"]').click();
    await expect(page.locator('.night-thumb svg')).toContainText('<b>bold</b>');
    await page.locator('.night-thumb').click();
    expect(await page.locator('#sheet b').count()).toBe(0);
    expect(await overflow(page, '#sheet')).toBeNull();
    expect(errors).toEqual([]);
  });

  test('after a refused file the picker is cleared, so choosing the same file again gets an answer', async ({ page }) => {
    // BUG: js/app.js importJson never clears the file input after a failure. A browser does not
    // fire "change" when the same file is picked again, so the second try shows nothing at all.
    // (Playwright always fires the event, so this checks the input was reset.)
    await importFile(page, '[]');
    expect(await page.locator('.data-actions input[type="file"]').inputValue()).toBe('');
  });

  test('a backup with only nights says something was imported', async ({ page }) => {
    // BUG: js/app.js:1223 the toast counts voice entries only; a backup of nights or lens exercises restores them and then says "已匯入 0 筆". Fix: count nights and sessions too (or name them in the toast).
    const toast = await importFile(page, backup({ nights: [{ id: 'n1', createdAt: Date.now() - 1000, kindness: 'k', seed: 's', lang: 'zh-TW' }] }));
    expect(await stored(page, 'nights')).toHaveLength(1);
    expect(toast).not.toContain('0');
  });

  test('importing with demo data loaded keeps both and marks the mix', async ({ page }) => {
    await openToday(page);
    await page.getByRole('button', { name: /示範|範例|demo/i }).first().click();
    await expect(page.locator('.view.trends')).toBeVisible();
    const demoCount = (await storedEntries(page)).length;
    expect(demoCount).toBeGreaterThan(5);
    await importFile(page, backup({ entries: [entry('real1'), entry('real2')] }));
    const all = await storedEntries(page);
    expect(all).toHaveLength(demoCount + 2);
    expect(all.filter((e) => !e.demo)).toHaveLength(2);
    await page.goto('/#journal');
    await expect(page.locator('.demo-banner')).toBeVisible();
  });

  test('importing while a ritual is open keeps what was written in the ritual', async ({ page }) => {
    await startRitual(page);
    await page.fill('#night-worry', '還沒寫完的心事');
    await page.locator('#tabs a[href="#about"]').click();
    await importFile(page, backup({ entries: [entry('e1')] }));
    await page.locator('#tabs a[href="#today"]').click();
    await expect(page.locator('#night-worry')).toHaveValue('還沒寫完的心事');
  });

  test('importing while a lens exercise is open keeps the exercise', async ({ page }) => {
    // BUG: js/app.js:1220 lensView.reload() resets the exercise in progress (worry and answers gone). Fix: reload only the saved list, e.g. skip reload when lensView.active().
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '寫到一半的煩惱');
    await page.locator('#tabs a[href="#about"]').click();
    await importFile(page, backup({ entries: [entry('e1')] }));
    await page.locator('#tabs a[href="#lens"]').click();
    await expect(page.locator('#lens-concern')).toHaveValue('寫到一半的煩惱');
  });
});

// ---------- double taps ----------
test.describe('double taps', () => {
  test('Save twice stores one check-in', async ({ page }) => {
    await openToday(page);
    await page.locator('[data-key="silent-checkin"]').click();
    await page.locator('[data-key="mood-3"]').click();
    await page.locator('[data-key="save"]').dblclick();
    await expect(page.locator('.prompt-text')).toBeVisible();
    expect(await storedEntries(page)).toHaveLength(1);
  });

  test('Next twice on the worry step does not skip the kind-thing step', async ({ page }) => {
    await startRitual(page);
    await page.fill('#night-worry', '明天的報告');
    await page.locator('[data-key="night-next"]').dblclick();
    await expect(page.locator('#night-kind')).toBeVisible();
  });

  test('Start twice opens one ritual; a track tapped twice plays once and saves one night', async ({ page }) => {
    const errors = collectErrors(page);
    await openToday(page);
    await page.locator('[data-key="night-start"], [data-key="night-link"]').first().dblclick();
    await page.locator('#night-worry').waitFor();
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="track-acceptance"]').dblclick();
    await expect(page.locator('.postcard svg')).toBeVisible({ timeout: 20_000 });
    expect(await stored(page, 'nights')).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('skip-track and Done tapped twice save one night and return to Today', async ({ page }) => {
    await startRitual(page);
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-skip-track"]').dblclick();
    await expect(page.locator('.postcard svg')).toBeVisible();
    await page.locator('[data-key="night-done"]').dblclick();
    await expect(page.locator('.prompt-text')).toBeVisible();
    expect(await stored(page, 'nights')).toHaveLength(1);
  });

  test('lens: Next twice does not skip a question, Save twice stores one exercise', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '報告做不完');
    await page.locator('[data-key="topic-work"]').click();
    await page.locator('[data-key="lens-concern-next"]').dblclick();
    await page.getByRole('button', { name: /自己選/ }).click();
    await page.locator('.lens-row').first().click();
    let steps = 0;
    for (let i = 0; i < 8; i++) {
      if (await page.locator('.lens-summary').count()) break;
      if (await page.locator('.scale-11').count()) await page.locator('[data-key="scale-4"]').click();
      else await page.fill('#lens-answer', `回答 ${i + 1}`);
      await page.locator('[data-key="lens-next"]').dblclick();
      steps++;
    }
    await expect(page.locator('.lens-summary')).toBeVisible();
    expect(steps).toBeGreaterThanOrEqual(3);
    await page.locator('[data-key="lens-save"]').dblclick();
    await expect(page.locator('[data-key="lens-start"]')).toBeVisible();
    expect(await stored(page, 'lensSessions')).toHaveLength(1);
    const [s] = await stored(page, 'lensSessions');
    expect(s.answers.every((a) => String(a).trim() !== '')).toBe(true);
  });

  test('delete tapped twice removes one entry and leaves no error', async ({ page }) => {
    const errors = collectErrors(page);
    await importFile(page, backup({ entries: [entry('a', { createdAt: Date.now() - 9000 }), entry('b', { createdAt: Date.now() - 8000 })] }));
    await page.goto('/#journal');
    page.on('dialog', (d) => d.accept());
    await page.locator('.tile').first().click();
    await page.locator('#sheet .btn.danger').dblclick().catch(() => {});
    await expect(page.locator('#sheet')).toBeHidden();
    await expect(page.locator('.tile')).toHaveCount(1);
    expect(await storedEntries(page)).toHaveLength(1);
    expect(errors).toEqual([]);
  });
});

// ---------- history and hashes ----------
test.describe('back button and hashes', () => {
  test('Back in the middle of the ritual goes one step back, not out of the ritual', async ({ page }) => {
    test.fail();
    // BUG: ritual steps are not in the history (js/night-view.js go()), so the phone's Back button leaves Today, or closes an installed app when Today was the first page; the text is only in memory. Fix: pushState per step and handle popstate, as the sheets do with #entry.
    await page.goto('/#journal');
    await page.locator('#tabs a[href="#today"]').click();
    await skipWelcome(page);
    await page.locator('[data-key="night-start"], [data-key="night-link"]').first().click();
    await page.fill('#night-worry', '心事');
    await page.locator('[data-key="night-next"]').click();
    await page.locator('#night-kind').waitFor();
    await page.goBack();
    await expect(page.locator('#night-worry')).toBeVisible();
  });

  test('leaving the ritual with Back and returning keeps the text', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/#journal');
    await page.locator('#tabs a[href="#today"]').click();
    await skipWelcome(page);
    await page.locator('[data-key="night-start"], [data-key="night-link"]').first().click();
    await page.fill('#night-worry', '心事');
    await page.locator('[data-key="night-next"]').click();
    await page.fill('#night-kind', '喝了熱茶');
    await page.goBack();
    await expect(page.locator('.view.journal')).toBeVisible();
    await page.goForward();
    await expect(page.locator('#night-kind')).toHaveValue('喝了熱茶');
    expect(errors).toEqual([]);
  });

  test('Back in the middle of a lens exercise goes one question back', async ({ page }) => {
    test.fail();
    // BUG: same as the ritual: js/lens-view.js go() keeps steps out of the history, so Back leaves the Lens tab.
    await page.goto('/#today');
    await page.locator('#tabs a[href="#lens"]').click();
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '報告做不完');
    await page.locator('[data-key="topic-work"]').click();
    await page.locator('[data-key="lens-concern-next"]').click();
    await page.getByRole('button', { name: /自己選/ }).click();
    await page.locator('.lens-row').first().click();
    await page.locator('.lens-q').waitFor();
    await page.goBack();
    await expect(page.locator('.view.lens')).toBeVisible();
  });

  test('Back closes a sheet and keeps the page under it; Escape does the same and focus returns', async ({ page }) => {
    await openToday(page);
    await page.locator('[data-key="breathe-link"]').click();
    await expect(page.locator('#sheet')).toBeVisible();
    await expect(page.locator('#sheet .back')).toBeFocused();
    await page.goBack();
    await expect(page.locator('#sheet')).toBeHidden();
    await expect(page.locator('.prompt-text')).toBeVisible();
    await expect(page.locator('[data-key="breathe-link"]')).toBeFocused();
    await page.locator('[data-key="breathe-link"]').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#sheet')).toBeHidden();
    await expect(page.locator('[data-key="breathe-link"]')).toBeFocused();
    expect(new URL(page.url()).hash).toMatch(/^(#today)?$/);
  });

  test('closing a night postcard returns focus to the postcard that opened it', async ({ page }) => {
    // BUG: js/app.js:797 openSheet remembers the opener by data-key, and js/extras.js:260 .night-thumb has none, so focus falls to <body> on close. Fix: give the thumb a data-key (`night-${n.id}`).
    await importFile(page, backup({ nights: [{ id: 'n1', createdAt: Date.now() - 1000, kindness: '散步', seed: 's', lang: 'zh-TW' }] }));
    await page.goto('/#journal');
    await page.locator('[data-key="jmode-nights"]').click();
    await page.locator('.night-thumb').click();
    await expect(page.locator('#sheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#sheet')).toBeHidden();
    await expect(page.locator('.night-thumb')).toBeFocused();
  });

  test('hand-edited and unknown hashes never leave a blank or broken screen', async ({ page }) => {
    const errors = collectErrors(page);
    await openToday(page);
    for (const hash of ['#lens', '#journal', '#nope', '#entry', '#ask=abc', '#ask=99999', '#ask=-1', '#', '#TODAY', '#about?x=1', '#main', '#trends', '#%E0%A4%A']) {
      await page.evaluate((x) => (location.hash = x), hash);
      await page.waitForTimeout(80);
      expect(await page.locator('#main > section').count(), hash).toBe(1);
      expect(await page.locator('#sheet').isHidden(), hash).toBe(true);
      expect(await page.locator('#tabs a[aria-current="page"]').count(), hash).toBe(1);
    }
    for (const hash of ['#nope', '#entry', '#ask=abc', '#main']) {
      await page.goto('/' + hash);
      await page.reload();
      await expect(page.locator('.prompt-text'), hash).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});

// ---------- long and unusual text ----------
test.describe('long text', () => {
  for (const [label, text] of [['long Chinese', LONG_ZH], ['emoji, RTL, newlines', MIXED]]) {
    test(`ritual with ${label}: no sideways overflow, text stored whole`, async ({ page }) => {
      const errors = collectErrors(page);
      await startRitual(page);
      await page.fill('#night-worry', text);
      expect(await overflow(page)).toBeNull();
      await page.locator('[data-key="night-next"]').click();
      const kind = text.replace(/\n/g, ' ').slice(0, 120);
      await page.fill('#night-kind', kind);
      await page.locator('[data-key="night-next"]').click();
      expect(await overflow(page)).toBeNull();
      await page.locator('[data-key="night-skip-track"]').click();
      await expect(page.locator('.postcard svg')).toBeVisible();
      expect(await overflow(page)).toBeNull();
      const [night] = await stored(page, 'nights');
      expect(night.worry).toBe(text.trim().slice(0, 1000));
      expect(night.kindness).toBe(kind.trim());
      await page.locator('[data-key="night-done"]').click();
      await page.goto('/#journal');
      await page.locator('[data-key="jmode-nights"]').click();
      await page.locator('.night-thumb').click();
      await expect(page.locator('#sheet .detail-note')).toHaveText(text.trim());
      expect(await overflow(page, '#sheet')).toBeNull();
      await page.keyboard.press('Escape');
      await page.locator('[data-key="jmode-jar"]').click();
      await page.locator('.jar-list li').waitFor();
      expect(await overflow(page)).toBeNull();
      expect(errors).toEqual([]);
    });

    test(`lens with ${label}: no sideways overflow in steps, summary and saved list`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto('/#lens');
      await page.locator('[data-key="lens-start"]').click();
      await page.fill('#lens-concern', text.slice(0, 400));
      await page.locator('[data-key="topic-work"]').click();
      await page.locator('[data-key="lens-concern-next"]').click();
      await page.getByRole('button', { name: /自己選/ }).click();
      await page.locator('.lens-row').first().click();
      for (let i = 0; i < 8; i++) {
        if (await page.locator('.lens-summary').count()) break;
        expect(await overflow(page), `step ${i}`).toBeNull();
        if (await page.locator('.scale-11').count()) await page.locator('[data-key="scale-4"]').click();
        else await page.fill('#lens-answer', text.slice(0, 400));
        await page.locator('[data-key="lens-next"]').click();
      }
      await expect(page.locator('.lens-summary')).toBeVisible();
      expect(await overflow(page), 'summary').toBeNull();
      await page.locator('[data-key="lens-save"]').click();
      await page.getByRole('button', { name: /我存下的練習/ }).click();
      await page.locator('.lens-summary.compact summary').click();
      expect(await overflow(page), 'saved').toBeNull();
      const [ses] = await stored(page, 'lensSessions');
      expect(ses.concern).toBe(text.slice(0, 400));
      expect(errors).toEqual([]);
    });
  }

  test('a long note on a silent check-in and a long exchange answer stay on screen', async ({ page }) => {
    await openToday(page);
    await page.locator('[data-key="exchange-open"]').click();
    await page.fill('[data-key="exchange-text"]', MIXED + LONG);
    expect(await overflow(page)).toBeNull();
    await page.locator('[data-key="exchange-cancel"]').click();
    await page.locator('[data-key="silent-checkin"]').click();
    await page.fill('#note', MIXED.replace(/\n/g, ' ').slice(0, 140));
    await page.locator('[data-key="save"]').click();
    await page.goto('/#journal');
    await page.locator('.silent-list li').waitFor();
    expect(await overflow(page)).toBeNull();
    const [e] = await storedEntries(page);
    expect(e.note).toBe(MIXED.replace(/\n/g, ' ').slice(0, 140).trim());
  });

  // BUG (all four below): css/style.css has no overflow-wrap anywhere, so one long unbroken
  // string (a pasted link, "hahahaha…") makes the whole page scroll sideways.
  // Fix: body { overflow-wrap: anywhere; }
  test('a pasted link in a lens worry wraps instead of widening the page', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', LONG);
    await page.locator('[data-key="topic-work"]').click();
    await page.locator('[data-key="lens-concern-next"]').click();
    await page.getByRole('button', { name: /自己選/ }).click();
    await page.locator('.lens-row').first().click();
    await page.locator('.lens-concern-quote').waitFor();
    expect(await overflow(page)).toBeNull();
  });

  test('a pasted link in a bedtime worry wraps in the night sheet', async ({ page }) => {
    await importFile(page, backup({ nights: [{ id: 'n1', createdAt: Date.now() - 1000, worry: LONG, kindness: 'ok', seed: 's', lang: 'zh-TW' }] }));
    await page.goto('/#journal');
    await page.locator('[data-key="jmode-nights"]').click();
    await page.locator('.night-thumb').click();
    await page.locator('#sheet .detail-note').waitFor();
    expect(await overflow(page, '#sheet')).toBeNull();
  });

  test('a long unbroken kind thing wraps in the kindness jar', async ({ page }) => {
    await importFile(page, backup({ nights: [{ id: 'n1', createdAt: Date.now() - 1000, kindness: LONG.slice(0, 120), seed: 's', lang: 'zh-TW' }] }));
    await page.goto('/#journal');
    await page.locator('[data-key="jmode-jar"]').click();
    await page.locator('.jar-list li').waitFor();
    expect(await overflow(page)).toBeNull();
  });

  test('a long unbroken note wraps in the list of silent check-ins', async ({ page }) => {
    await openToday(page);
    await page.locator('[data-key="silent-checkin"]').click();
    await page.fill('#note', LONG.slice(0, 140));
    await page.locator('[data-key="save"]').click();
    await page.goto('/#journal');
    await page.locator('.silent-list li').waitFor();
    expect(await overflow(page)).toBeNull();
  });

  test('the whole kind thing fits on the postcard (the field allows 120 characters)', async ({ page }) => {
    // BUG: js/postcard.js:48 wrap() keeps 5 lines (about 50 Chinese or 100 Latin characters) and drops the rest without a mark; the field allows 120. Fix: shrink the font for long text, or end the last line with an ellipsis.
    await startRitual(page);
    await page.locator('[data-key="night-next"]').click();
    const kind = Array.from({ length: 60 }, (_, i) => '一二三四五六七八九十'[i % 10]).join('') + '結尾';
    await page.fill('#night-kind', kind);
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-skip-track"]').click();
    await expect(page.locator('.postcard svg')).toBeVisible();
    const shown = (await page.locator('.postcard svg text').allTextContents()).join('');
    expect(shown).toContain('結尾');
  });
});

// ---------- language, clock ----------
test.describe('language and time', () => {
  test('switching language in the middle of a ritual and a lens exercise keeps the text', async ({ page }) => {
    const errors = collectErrors(page);
    await startRitual(page);
    await page.fill('#night-worry', '心事還在');
    await page.locator('#tabs a[href="#lens"]').click();
    await page.locator('[data-key="lens-start"]').click();
    await page.fill('#lens-concern', '煩惱還在');
    await page.locator('[data-key="topic-work"]').click();
    await page.locator('#tabs a[href="#about"]').click();
    await page.locator('[data-key="lang-en"]').click();
    await expect(page.locator('#brand-tag')).not.toBeEmpty();
    await page.locator('#tabs a[href="#lens"]').click();
    await expect(page.locator('#lens-concern')).toHaveValue('煩惱還在');
    await expect(page.locator('[data-key="lens-concern-next"]')).toBeEnabled();
    await page.locator('#tabs a[href="#today"]').click();
    await expect(page.locator('#night-worry')).toHaveValue('心事還在');
    await expect(page.locator('.view.night h2')).toHaveText('Set down what is on your mind');
    expect(errors).toEqual([]);
  });

  test('Today turns to its evening layout at 20:00 without a reload', async ({ page }) => {
    // BUG: nothing re-renders Today when the clock passes 20:00 (js/app.js init has no timer and the visibilitychange handler at ~1588 only stops a recording). An app left open in the afternoon still shows the daytime layout at night. Fix: on visibilitychange and once a minute, render() when isEvening() or the date changed and isIdle().
    await page.clock.install({ time: new Date('2026-11-24T19:58:00+08:00') });
    await openToday(page);
    await expect(page.locator('[data-key="night-link"]')).toBeVisible();
    await expect(page.locator('.night-card')).toHaveCount(0);
    await page.clock.fastForward('05:00');
    await expect(page.locator('.night-card')).toBeVisible();
  });

  test('"done for tonight" still shows after midnight, as it does after a reload', async ({ page }) => {
    // BUG: js/night-view.js:239 compares st.doneOn with today's date string, while markDone (line 150-160) counts the evening from 4 pm. Past midnight the open page says "start", a reload says "done". Fix: keep the time of the last night and compare it with the evening start in card().
    await page.clock.install({ time: new Date('2026-11-24T23:50:00+08:00') });
    await startRitual(page);
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-skip-track"]').click();
    await page.locator('[data-key="night-done"]').click();
    await expect(page.locator('.night-card h2')).toHaveText('今晚完成了，晚安');
    await page.clock.fastForward('20:00');
    await page.locator('[data-key="new-prompt"]').click();
    const live = await page.locator('.night-card h2').textContent();
    await page.reload();
    await page.locator('.prompt-text').waitFor();
    const reloaded = await page.locator('.night-card h2').textContent();
    expect(reloaded).toBe('今晚完成了，晚安');
    expect(live).toBe(reloaded);
  });

  test('a ritual finished at 1 am is not shown as done the next evening', async ({ page }) => {
    // BUG: same cause as above (js/night-view.js:550 stores a date string): done at 1 am still reads "done for tonight" at 9 pm that day until a reload.
    await page.clock.install({ time: new Date('2026-11-24T01:00:00+08:00') });
    await startRitual(page);
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-skip-track"]').click();
    await page.locator('[data-key="night-done"]').click();
    await expect(page.locator('.night-card h2')).toHaveText('今晚完成了，晚安');
    await page.clock.fastForward('20:00:00');
    await page.locator('[data-key="new-prompt"]').click();
    await expect(page.locator('.night-card h2')).toHaveText('睡前儀式');
  });

  test('the prompt of the day changes when the page is left open past midnight', async ({ page }) => {
    // BUG: js/app.js:1577 sets state.promptIndex once in init, so an app left open keeps yesterday's prompt. Fix: recompute with promptOfDay() when the date changes.
    await page.clock.install({ time: new Date('2026-11-24T23:58:00+08:00') });
    await openToday(page);
    const before = await page.locator('.prompt-text').textContent();
    await page.clock.fastForward('10:00');
    await page.locator('#tabs a[href="#journal"]').click();
    await page.locator('#tabs a[href="#today"]').click();
    const after = await page.locator('.prompt-text').textContent();
    await page.reload();
    await page.locator('.prompt-text').waitFor();
    expect(after).toBe(await page.locator('.prompt-text').textContent());
    expect(before).not.toBe(after);
  });
});

// ---------- storage that does not work ----------
const breakIdb = () => {
  const fail = () => {
    const req = { error: new DOMException('denied', 'SecurityError') };
    setTimeout(() => req.onerror && req.onerror({ target: req }), 0);
    return req;
  };
  Object.defineProperty(IDBFactory.prototype, 'open', { value: fail });
};
const breakLocalStorage = () => {
  Object.defineProperty(window, 'localStorage', {
    get() {
      throw new DOMException('denied', 'SecurityError');
    },
  });
};

test.describe('storage unavailable', () => {
  test('IndexedDB failing: the app opens, says saving failed, and the ritual still ends in a postcard', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(breakIdb);
    await openToday(page);
    await page.locator('[data-key="silent-checkin"]').click();
    await page.locator('[data-key="mood-4"]').click();
    await page.locator('[data-key="save"]').click();
    await expect(page.locator('#toast')).toContainText('儲存失敗');
    await expect(page.locator('[data-key="save"]')).toBeVisible(); // nothing typed is thrown away
    await page.locator('.view.today .actions .btn.ghost').click();
    await page.locator('[data-key="night-start"], [data-key="night-link"]').first().click();
    await page.fill('#night-worry', '心事');
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-skip-track"]').click();
    await expect(page.locator('.postcard svg')).toBeVisible();
    for (const tab of ['journal', 'trends', 'lens', 'about']) {
      await page.locator(`#tabs a[href="#${tab}"]`).click();
      await expect(page.locator(`.view.${tab}`)).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('IndexedDB failing: a night that could not be saved is not shown as kept', async ({ page }) => {
    // BUG: js/night-view.js:511 swallows the saveNight error. The postcard appears as if the worry and kind thing were kept; Journal > Nights stays empty. Fix: toast the save failure in the catch.
    await page.addInitScript(breakIdb);
    await startRitual(page);
    await page.fill('#night-worry', '很重要的心事');
    await page.locator('[data-key="night-next"]').click();
    await page.fill('#night-kind', '散步');
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-skip-track"]').click();
    await expect(page.locator('.postcard svg')).toBeVisible();
    // the person is told the night was not stored
    await expect(page.locator('#toast')).toContainText(/儲存失敗|沒有存/);
  });

  test('IndexedDB failing: the language switch still works', async ({ page }) => {
    // BUG: js/app.js:1372 awaits db.setSetting('lang') before render(); when storage rejects, render never runs and the tap does nothing. Fix: db.setSetting('lang', code).catch(() => {}) and render right away.
    await page.addInitScript(breakIdb);
    await page.goto('/#about');
    await page.locator('[data-key="lang-en"]').click();
    await expect(page.locator('#tabs')).toContainText('Today');
  });

  test('IndexedDB failing: toggles that store a setting do not throw', async ({ page }) => {
    // BUG: js/night-view.js:283 db.setSetting('nightKeep', …) has no catch (same pattern at
    // js/app.js keepAudio / aiEnabled), so each tap is an unhandled rejection.
    // Fix: add .catch(() => {}) as the 'welcomed' setting already does.
    const errors = collectErrors(page);
    await page.addInitScript(breakIdb);
    await startRitual(page);
    await page.locator('[data-key="night-keep"]').uncheck();
    await page.waitForTimeout(200);
    expect(errors).toEqual([]);
  });

  test('IndexedDB that never answers does not leave a blank page', async ({ page }) => {
    // BUG: js/app.js init awaits every setting before the first render and js/db.js open() has no timeout, so an open request that never answers (seen on some iOS versions) leaves an empty page. Fix: race open() against a few seconds' timeout and reject.
    await page.addInitScript(() => {
      Object.defineProperty(IDBFactory.prototype, 'open', { value: () => ({}) });
    });
    await page.goto('/');
    await expect(page.locator('#main > section')).toBeVisible({ timeout: 8000 });
  });

  test('localStorage throwing: Today, the low-mood card, help lines and delete-all still work', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(breakLocalStorage);
    await openToday(page);
    await page.locator('[data-key="silent-checkin"]').click();
    await page.locator('[data-key="mood-1"]').click();
    await page.locator('[data-key="save"]').click();
    await expect(page.locator('.low-card')).toBeVisible();
    await page.locator('.low-card .muted-link').click();
    await expect(page.locator('.low-card')).toHaveCount(0);
    await page.locator('#tabs a[href="#about"]').click();
    await expect(page.locator('#help')).toBeVisible();
    page.on('dialog', (d) => d.accept());
    await page.locator('.data-actions .btn.danger').click();
    await expect(page.locator('#toast')).toHaveClass(/show/);
    expect(await storedEntries(page)).toHaveLength(0);
    expect(errors).toEqual([]);
  });
});

// ---------- focus ----------
test.describe('focus in the new flows', () => {
  test('each ritual step moves focus to its heading', async ({ page }) => {
    await startRitual(page);
    await expect(page.locator('.view.night h2')).toBeFocused();
    await page.locator('[data-key="night-next"]').click();
    await expect(page.locator('.view.night h2')).toBeFocused();
    await page.locator('[data-key="night-next"]').click();
    await expect(page.locator('.view.night h2')).toBeFocused();
    await page.locator('[data-key="night-skip-track"]').click();
    await expect(page.locator('.view.night h2')).toBeFocused();
  });

  test('after Done on the postcard, focus lands somewhere on Today instead of being dropped', async ({ page }) => {
    // BUG: js/night-view.js "night-done" removes the focused button and nothing takes focus, so a
    // keyboard or screen-reader user starts again from the top of the document.
    // Fix: after onExit's render, focus the night card's start button (or #main).
    await startRitual(page);
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-next"]').click();
    await page.locator('[data-key="night-skip-track"]').click();
    await page.locator('[data-key="night-done"]').click();
    await expect(page.locator('.prompt-text')).toBeVisible();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body)).toBe(true);
  });

  test('each lens step moves focus to the question or the answer field', async ({ page }) => {
    await page.goto('/#lens');
    await page.locator('[data-key="lens-start"]').click();
    await expect(page.locator('#lens-concern, .view.lens h2').first()).toBeVisible();
    await page.fill('#lens-concern', '報告做不完');
    await page.locator('[data-key="topic-work"]').click();
    await page.locator('[data-key="lens-concern-next"]').click();
    await expect(page.locator('.view.lens h2')).toBeFocused();
    await page.getByRole('button', { name: /自己選/ }).click();
    await page.locator('.lens-row').first().click();
    for (let i = 0; i < 8; i++) {
      if (await page.locator('.lens-summary').count()) break;
      const inside = await page.evaluate(() => {
        const a = document.activeElement;
        return !!a && a !== document.body && !!a.closest('.view.lens');
      });
      expect(inside, `step ${i}`).toBe(true);
      if (await page.locator('.scale-11').count()) await page.locator('[data-key="scale-4"]').click();
      else await page.fill('#lens-answer', `回答 ${i + 1}`);
      await page.locator('[data-key="lens-next"]').click();
    }
    await expect(page.locator('.view.lens h2').first()).toBeFocused();
  });
});

// ---------- recording button ----------
// Its own browser, because the fake microphone is a launch option and the other tests here
// also run in WebKit.
test('record tapped twice starts one recording; stop and Save tapped twice give one entry', async ({ browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'needs the fake microphone');
  const browser = await chromium.launch(fakeMic('speech.wav'));
  try {
    const context = await browser.newContext({ baseURL, viewport: { width: WIDTH, height: 844 }, locale: 'zh-TW', timezoneId: 'Asia/Taipei', permissions: ['microphone'] });
    const page = await context.newPage();
    const errors = collectErrors(page);
    await openToday(page);
    await page.locator('.rec-btn').dblclick();
    await expect(page.locator('#timer')).toBeVisible();
    await page.waitForTimeout(6500);
    await page.locator('.rec-btn').dblclick({ force: true }).catch(() => {});
    await page.waitForSelector('.result-head, .error', { timeout: 30_000 });
    await expect(page.locator('.result-head')).toHaveCount(1);
    await page.locator('[data-key="save"]').dblclick();
    await expect(page.locator('.prompt-text')).toBeVisible();
    expect(await storedEntries(page)).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
