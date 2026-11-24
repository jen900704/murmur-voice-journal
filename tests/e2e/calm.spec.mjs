// "Calm now": breathing, then 5-4-3-2-1 grounding, then phrases. Tested through
// tests/e2e/calm-harness.html, which opens calmSheet (or breatheSheet) in a stand-in sheet.
import { test, expect } from '@playwright/test';

const HARNESS = '/tests/e2e/calm-harness.html';
// Murmur does not grade the person: none of these may appear anywhere in the flow.
const PRAISE = /做得很好|做得好|超棒|很棒|好棒|真棒|太棒|厲害|了不起|好樣的|你做到了|加油|great|well done|good job|nice work|amazing|awesome|proud|you did it|nailed|bravo|fantastic|excellent/i;
const EM_DASH = /—|─|——/;

// A stand-in for the browser's speech: records what would be spoken, and by which voice.
async function fakeSpeech(page, voices) {
  await page.addInitScript((list) => {
    window.__spoken = [];
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
        this.volume = 1;
      }
    };
    const fake = {
      getVoices: () => list,
      speak: (u) => window.__spoken.push({ text: u.text, voice: u.voice ? u.voice.name : null, volume: u.volume }),
      cancel() {},
      addEventListener() {},
      removeEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  }, voices);
}
// the silent utterance that unlocks speech on iOS does not count
const spoken = (page) => page.evaluate(() => window.__spoken.filter((u) => u.text.trim() && u.volume !== 0));

const LOCAL_ZH = { name: 'Mei-Jia', lang: 'zh-TW', localService: true };
const ONLINE_ZH = { name: 'Google 國語（臺灣）', lang: 'zh-TW', localService: false };
const LOCAL_EN = { name: 'Samantha', lang: 'en-US', localService: true };

async function open(page, query = '') {
  await page.clock.install({ time: new Date('2026-11-24T15:00:00+08:00') });
  await page.goto(HARNESS + query);
  await page.locator('body[data-ready="1"]').waitFor();
}
const key = (page, k) => page.locator(`[data-key="${k}"]`);

// From the big button to the end of the last breath.
async function breatheThrough(page) {
  await key(page, 'calm-start').click();
  await expect(page.locator('.breathe-phase')).toHaveText(/吸氣|Breathe in/);
  await page.clock.runFor(61_000); // 5 rounds of 4 + 2 + 6 seconds
  await expect(page.locator('.breathe-handoff')).toBeVisible();
}

test.describe('calm now', () => {
  test('one large button, then breathing 4-2-6 for five rounds, grounding one step per screen, then the phrases', async ({ page }) => {
    await fakeSpeech(page, [LOCAL_ZH]);
    await open(page);
    const start = key(page, 'calm-start');
    await expect(start).toHaveText('我現在很慌，帶我呼吸');
    const box = await start.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(90);
    expect(box.width).toBeGreaterThan(300);
    await expect(page.locator('.calm-phrases')).toBeVisible();
    await expect(page.locator('.breathe-circle')).toHaveCount(0);

    await start.click();
    const phase = page.locator('.breathe-phase');
    await expect(phase).toHaveText('吸氣');
    await expect(page.locator('.breathe-left')).toHaveText('第 1 回，共 5 回');
    await expect(page.locator('.breathe-circle')).toHaveClass(/\bin\b/);
    // one thing at a time: the phrases step aside, the body note and the help link stay
    await expect(page.locator('.calm-phrases')).toHaveCount(0);
    await expect(page.locator('.calm-body-note')).toBeVisible();
    await page.clock.runFor(4_400);
    await expect(phase).toHaveText('停一下');
    await page.clock.runFor(2_000);
    await expect(phase).toHaveText('慢慢吐氣');
    await page.clock.runFor(6_000);
    await expect(page.locator('.breathe-left')).toHaveText('第 2 回，共 5 回');
    await page.clock.runFor(36_000 + 11_000); // into the out-breath of round 5
    await expect(page.locator('.breathe-left')).toHaveText('第 5 回，共 5 回');
    await expect(page.locator('.breathe-handoff')).toHaveCount(0);
    await page.clock.runFor(2_000);

    // the handoff: focus moves from the vanished Stop button to Next
    await expect(page.locator('.breathe-handoff')).toContainText('5-4-3-2-1');
    await expect(key(page, 'calm-next')).toBeFocused();
    await expect(key(page, 'calm-skip')).toBeVisible();
    await expect(key(page, 'calm-stop-here')).toBeVisible();

    await key(page, 'calm-next').click();
    const steps = [
      ['5', /看得到/],
      ['4', /摸/],
      ['3', /聲音/],
      ['2', /味道/],
      ['1', /喜歡自己/],
    ];
    for (const [n, re] of steps) {
      await expect(page.locator('.ground-num')).toHaveText(n);
      await expect(page.locator('.ground-text')).toHaveText(re);
      await expect(page.locator('.ground-text')).toHaveCount(1);
      // big text
      expect(await page.locator('.ground-text').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(22);
      if (n === '2') await expect(page.locator('.ground-hint')).toHaveText('聞不到也沒關係。');
      await expect(key(page, 'calm-next')).toBeFocused();
      await page.keyboard.press('Enter');
    }
    await expect(page.locator('.breathe-phase')).toHaveText('你回來了。慌的感覺會慢慢退下去，不用急。');
    await expect(key(page, 'calm-start')).toBeFocused();
    await expect(key(page, 'calm-start')).toHaveText('再一次');
    await expect(page.locator('.calm-phrases')).toBeVisible();
    await expect(page.locator('.calm-body-note')).toHaveText(/胸痛.*心跳.*醫生/);
    // guidance was off the whole way: nothing was spoken
    expect(await spoken(page)).toEqual([]);
  });

  test('Skip goes to the phrases; Stop here ends with the plain closing line', async ({ page }) => {
    await open(page);
    await breatheThrough(page);
    await key(page, 'calm-skip').click();
    await expect(page.locator('.calm-phrases')).toBeVisible();
    await expect(key(page, 'calm-draw')).toBeFocused();
    await expect(page.locator('.ground')).toHaveCount(0);

    await breatheThrough(page);
    await key(page, 'calm-next').click();
    await key(page, 'calm-next').click();
    await expect(page.locator('.ground-num')).toHaveText('4');
    await key(page, 'calm-stop-here').click();
    await expect(page.locator('.breathe-phase')).toHaveText('好了。現在照自己的節奏呼吸就好。');
    await expect(key(page, 'calm-start')).toBeFocused();
  });

  test('Stop during breathing returns to the large button', async ({ page }) => {
    await open(page);
    await key(page, 'calm-start').click();
    await page.clock.runFor(5_000);
    await expect(key(page, 'calm-start')).toHaveText('停止');
    await key(page, 'calm-start').click();
    await expect(key(page, 'calm-start')).toHaveText('我現在很慌，帶我呼吸');
    await page.clock.runFor(70_000);
    await expect(page.locator('.breathe-handoff')).toHaveCount(0);
  });

  test('spoken guidance uses an on-device voice, and is remembered', async ({ page }) => {
    await fakeSpeech(page, [ONLINE_ZH, LOCAL_ZH]);
    await open(page);
    await expect(key(page, 'calm-voice')).not.toBeChecked();
    await key(page, 'calm-voice').check();
    await key(page, 'calm-start').click();
    await page.clock.runFor(11_000);
    let said = await spoken(page);
    expect(said.map((u) => u.text).slice(0, 3)).toEqual(['吸氣', '停一下', '慢慢吐氣']);
    await page.clock.runFor(50_000);
    await key(page, 'calm-next').click();
    said = await spoken(page);
    expect(said.at(-1).text).toMatch(/找 5 樣你看得到的東西/);
    expect(new Set(said.map((u) => u.voice))).toEqual(new Set(['Mei-Jia']));
    await page.reload();
    await expect(key(page, 'calm-voice')).toBeChecked();
  });

  test('with only online voices nothing is spoken and the words carry the flow', async ({ page }) => {
    await fakeSpeech(page, [ONLINE_ZH]);
    await open(page);
    await key(page, 'calm-voice').check();
    await breatheThrough(page);
    await key(page, 'calm-next').click();
    await expect(page.locator('.ground-num')).toHaveText('5');
    for (let i = 0; i < 5; i++) await key(page, 'calm-next').click();
    await expect(page.locator('.breathe-phase')).toHaveText(/你回來了/);
    await key(page, 'calm-phrase-0').click();
    await expect(page.locator('.calm-picked')).toHaveText('我現在很難受，這是真的。');
    expect(await spoken(page)).toEqual([]);
    await expect(page.locator('.sheet-body')).not.toContainText(/語音|voice/i);
  });

  test('without speech support at all the flow still works', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, '?lang=en');
    await key(page, 'calm-voice').check();
    await breatheThrough(page);
    await key(page, 'calm-next').click();
    await expect(page.locator('.ground-text')).toHaveText('Look around. Find 5 things you can see.');
    await key(page, 'calm-stop-here').click();
    await key(page, 'calm-draw').click();
    await expect(page.locator('.calm-picked')).not.toBeEmpty();
    expect(errors).toEqual([]);
  });

  test('phrases: tap to hear, draw one picks one, eight to ten per language', async ({ page }) => {
    await fakeSpeech(page, [LOCAL_EN]);
    await open(page, '?lang=en');
    await expect(key(page, 'calm-start')).toHaveText("I'm panicking. Breathe with me");
    const n = await page.locator('.calm-phrase').count();
    expect(n).toBeGreaterThanOrEqual(8);
    expect(n).toBeLessThanOrEqual(10);
    // a tap is a request to hear that sentence, even with guidance off
    await key(page, 'calm-phrase-3').click();
    await expect(key(page, 'calm-phrase-3')).toHaveAttribute('aria-pressed', 'true');
    await expect(key(page, 'calm-phrase-3')).toBeFocused();
    await expect(page.locator('.calm-picked')).toHaveText('Many people feel this way at times like this.');
    expect(await spoken(page)).toEqual([{ text: 'Many people feel this way at times like this.', voice: 'Samantha', volume: 1 }]);
    // drawing shows one, never the same twice in a row, and stays quiet with guidance off
    const all = await page.locator('.calm-phrase').allTextContents();
    let before = await page.locator('.calm-picked').textContent();
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      await key(page, 'calm-draw').click();
      const now = await page.locator('.calm-picked').textContent();
      expect(all).toContain(now);
      expect(now).not.toBe(before);
      seen.add(now);
      before = now;
    }
    expect(seen.size).toBeGreaterThan(1);
    await expect(page.locator('.calm-phrase[aria-pressed="true"]')).toHaveCount(1);
    await expect(key(page, 'calm-draw')).toBeFocused();
    expect(await spoken(page)).toHaveLength(1);
  });

  test('reduced motion: the circle stays still, the words and the count pace the breath', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await key(page, 'calm-start').click();
    const circle = page.locator('.breathe-circle');
    const look = () => circle.evaluate((el) => ({ transform: getComputedStyle(el).transform, duration: getComputedStyle(el).transitionDuration, shadow: getComputedStyle(el).boxShadow }));
    await expect(page.locator('.breathe-phase')).toHaveText('吸氣');
    await expect(page.locator('.breathe-count')).toHaveText('4');
    const atIn = await look();
    expect(atIn.duration).toMatch(/^0s(, 0s)*$/);
    expect(atIn.shadow).toBe('none');
    await page.clock.runFor(1_200);
    await expect(page.locator('.breathe-count')).toHaveText('3');
    await page.clock.runFor(3_300);
    await expect(page.locator('.breathe-phase')).toHaveText('停一下');
    expect(await look()).toEqual(atIn);
    await page.clock.runFor(2_000);
    await expect(page.locator('.breathe-phase')).toHaveText('慢慢吐氣');
    await expect(page.locator('.breathe-count')).toHaveText(/^[56]$/);
    expect(await look()).toEqual(atIn);
  });

  test('with motion allowed the circle grows over 4 seconds and shrinks over 6', async ({ page }) => {
    await open(page);
    await key(page, 'calm-start').click();
    const circle = page.locator('.breathe-circle');
    await expect(circle).toHaveClass(/\bin\b/);
    expect(await circle.evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^4s/);
    await page.clock.runFor(6_500);
    await expect(circle).toHaveClass(/\bout\b/);
    expect(await circle.evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^6s/);
  });

  test('focus order: back, the large button, read aloud, draw one, the phrases, help', async ({ page }) => {
    await open(page);
    await expect(page.locator('#sheet .back')).toBeFocused();
    const order = [];
    const count = await page.locator('.calm-phrase').count();
    for (let i = 0; i < 4 + count; i++) {
      await page.keyboard.press('Tab');
      order.push(await page.evaluate(() => document.activeElement.dataset.key));
    }
    expect(order).toEqual(['calm-start', 'calm-voice', 'calm-draw', ...Array.from({ length: count }, (_, i) => `calm-phrase-${i}`), 'calm-help']);

    // keyboard only, start to finish
    await key(page, 'calm-start').focus();
    await page.keyboard.press('Enter');
    await expect(key(page, 'calm-start')).toBeFocused(); // now the Stop button
    await page.clock.runFor(61_000);
    await expect(key(page, 'calm-next')).toBeFocused();
    await expect(key(page, 'calm-next')).toHaveAttribute('aria-describedby', 'handoff-done handoff-next');
    order.length = 0;
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      order.push(await page.evaluate(() => document.activeElement.dataset.key));
    }
    expect(order).toEqual(['calm-skip', 'calm-stop-here', 'calm-help']);
    await key(page, 'calm-next').focus();
    await page.keyboard.press('Enter');
    // the step text is read with the button that focus stays on
    await expect(key(page, 'calm-next')).toBeFocused();
    await expect(key(page, 'calm-next')).toHaveAttribute('aria-describedby', 'ground-text ground-hint');
    await expect(page.locator('#ground-text')).toHaveText(/5/);
  });

  test('help lines open from the link at the bottom', async ({ page }) => {
    await open(page);
    await expect(page.locator('.help-lines')).toHaveCount(0);
    await key(page, 'calm-help').click();
    await expect(key(page, 'calm-help')).toHaveAttribute('aria-expanded', 'true');
    await expect(key(page, 'calm-help')).toBeFocused();
    await expect(page.locator('.help-lines .resource-list li').first()).toBeVisible();
    // it is the last thing in the sheet, after the body note
    const last = await page.evaluate(() => document.querySelector('.sheet-body').lastElementChild.className);
    expect(last).toBe('calm-help');
    expect(await page.evaluate(() => document.querySelector('.calm-help').previousElementSibling.className)).toContain('calm-body-note');
  });

  for (const lang of ['zh-TW', 'en']) {
    test(`no praise words and no em dashes anywhere in the flow (${lang})`, async ({ page }) => {
      await open(page, `?lang=${lang}`);
      const seen = [];
      const grab = async () => seen.push(await page.locator('.sheet-body').innerText());
      await grab();
      await key(page, 'calm-start').click();
      await grab();
      await page.clock.runFor(5_000);
      await grab();
      await page.clock.runFor(2_000);
      await grab();
      await page.clock.runFor(54_000);
      await expect(page.locator('.breathe-handoff')).toBeVisible();
      await grab();
      await key(page, 'calm-next').click();
      for (let i = 0; i < 5; i++) {
        await grab();
        await key(page, 'calm-next').click();
      }
      await grab();
      await key(page, 'calm-draw').click();
      await grab();
      const all = seen.join('\n');
      expect(all).toMatch(lang === 'en' ? /You are back\. The panic will ease slowly\. No rush\./ : /你回來了。慌的感覺會慢慢退下去，不用急。/);
      expect(all).toMatch(lang === 'en' ? /needs a doctor/ : /請去看醫生/);
      expect(all).not.toMatch(PRAISE);
      expect(all).not.toMatch(EM_DASH);
      // the two languages do not mix
      if (lang === 'en') expect(all).not.toMatch(/[一-鿿]/);
    });
  }
});

test.describe('breathing sheet', () => {
  test('pattern choice: 4 in, 6 out by default, or with a 2-second hold; five rounds; grounding is offered after', async ({ page }) => {
    await open(page, '?sheet=breathe&lang=en');
    await expect(page.locator('h2')).toHaveText('Breathe for a minute');
    await expect(key(page, 'breathe-pattern-46')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.breathe-intro')).not.toContainText('hold');
    await key(page, 'breathe-start').click();
    await expect(page.locator('.breathe-phase')).toHaveText('Breathe in');
    await expect(page.locator('.breathe-left')).toHaveText('Round 1 of 5');
    await expect(page.locator('.breathe-patterns')).toHaveCount(0);
    await page.clock.runFor(4_400);
    await expect(page.locator('.breathe-phase')).toHaveText('Breathe out slowly');
    await key(page, 'breathe-start').click(); // stop

    await key(page, 'breathe-pattern-426').click();
    await expect(key(page, 'breathe-pattern-426')).toBeFocused();
    await expect(page.locator('.breathe-intro')).toContainText('hold for 2');
    await key(page, 'breathe-start').click();
    await page.clock.runFor(4_400);
    await expect(page.locator('.breathe-phase')).toHaveText('Hold');
    await page.clock.runFor(56_000);
    await expect(page.locator('.breathe-handoff')).toContainText('Done. Breathe at your own pace now.');
    await expect(key(page, 'calm-next')).toBeFocused();
    // nothing comes after grounding here, so there is no separate Skip
    await expect(key(page, 'calm-skip')).toHaveCount(0);
    await key(page, 'calm-next').click();
    await expect(page.locator('.ground-text')).toHaveText('Look around. Find 5 things you can see.');
    await key(page, 'calm-stop-here').click();
    await expect(page.locator('.breathe-phase')).toHaveText('Done. Breathe at your own pace now.');
    await expect(key(page, 'breathe-start')).toHaveText('Once more');
    await expect(key(page, 'breathe-start')).toBeFocused();
  });

  test('the default pattern finishes in 50 seconds and takes the wake lock only while breathing', async ({ page }) => {
    await page.addInitScript(() => {
      window.__locks = { taken: 0, released: 0 };
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: { request: async () => (window.__locks.taken++, { release: async () => void window.__locks.released++ }) },
      });
    });
    await open(page, '?sheet=breathe');
    await key(page, 'breathe-start').click();
    await page.clock.runFor(49_000);
    await expect(page.locator('.breathe-left')).toHaveText('第 5 回，共 5 回');
    expect(await page.evaluate(() => window.__locks)).toEqual({ taken: 1, released: 0 });
    await page.clock.runFor(1_500);
    await expect(page.locator('.breathe-handoff')).toBeVisible();
    expect(await page.evaluate(() => window.__locks)).toEqual({ taken: 1, released: 1 });
  });
});
