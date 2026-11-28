import { test, expect } from '@playwright/test';

for (const [locale, scheme] of [
  ['en-US', 'light'],
  ['zh-TW', 'dark'],
]) {
  test.describe(`${locale} ${scheme}`, () => {
    test.use({ locale, colorScheme: scheme });

    test('demo data fills the journal and trends, and can be cleared', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto('/#journal');
      await page.locator('[data-key="journal-demo"]').click();
      // the charts are a segment of the Journal now
      await expect(page).toHaveURL(/#journal$/);
      await expect(page.locator('[data-key="jmode-trends"]')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('.demo-banner')).toBeVisible();
      await expect(page.locator('.chart')).toHaveAttribute('aria-label', /.+/);
      await expect(page.locator('.links-table tbody tr')).toHaveCount(9);
      // switch metric with the keyboard
      await page.locator('.chip.on').focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.chip.on')).toBeFocused();
      await page.locator('[data-key="jmode-voice"]').click();
      await expect(page.locator('.tile')).toHaveCount(40);
      await page.locator('.demo-banner .link').click();
      await expect(page.locator('.tile')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });
}

test('language switch persists across reloads', async ({ page }) => {
  await page.goto('/#about');
  await page.getByRole('button', { name: '中文' }).click();
  await expect(page.locator('h1')).toContainText('低語日記');
  await page.reload();
  await expect(page.locator('h1')).toContainText('低語日記');
});

test('bedtime reminder downloads a valid daily calendar event', async ({ page }) => {
  await page.goto('/#about');
  await page.fill('#reminder-time', '21:45');
  const dl = page.waitForEvent('download');
  await page.locator('[data-key="reminder-ics"]').click();
  const { readFileSync } = await import('node:fs');
  const ics = readFileSync(await (await dl).path(), 'utf8');
  expect(ics).toContain('RRULE:FREQ=DAILY');
  expect(ics).toMatch(/DTSTART:\d{8}T214500/);
  expect(ics).toContain('BEGIN:VALARM');
});

test('first visit shows three ways in; dismissing it is remembered', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.welcome')).toBeVisible();
  await page.locator('[data-key="welcome-lens"]').click();
  await expect(page).toHaveURL(/#lens/);
  await page.goto('/#today');
  await page.reload();
  await expect(page.locator('.prompt-text')).toBeVisible();
  await expect(page.locator('.welcome')).toHaveCount(0);
});

test('breathing pacer starts, shows the phase, and stops when closed', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-key="welcome-close"]').click();
  await page.locator('[data-key="breathe-link"]').click();
  await page.locator('[data-key="breathe-start"]').click();
  await expect(page.locator('.breathe-phase')).toHaveText(/Breathe in|吸氣/);
  await expect(page.locator('.breathe-phase')).toHaveText(/Breathe out|吐氣/, { timeout: 6000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('#sheet')).toBeHidden();
});

test('after ten real entries the journal offers a backup, then waits a month', async ({ page }) => {
  await page.goto('/');
  await page.locator('.prompt-text').waitFor();
  await page.evaluate(async () => {
    const data = await fetch('./demo/demo-data.json').then((r) => r.json());
    await new Promise((res) => {
      const q = indexedDB.open('murmur', 3);
      q.onsuccess = () => {
        const t = q.result.transaction('entries', 'readwrite');
        data.entries.slice(0, 12).forEach((e, i) => t.objectStore('entries').put({ ...e, id: 'r' + i, demo: false, hasAudio: false, createdAt: Date.now() - i * 86400000 }));
        t.oncomplete = res;
      };
    });
  });
  await page.goto('/#journal');
  await page.reload();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-key="backup-now"]').click()]);
  expect(download.suggestedFilename()).toMatch(/^murmur-backup-/);
  await expect(page.locator('[data-key="backup-now"]')).toHaveCount(0);
});

test.describe('on iPhone Safari', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  test('once past the welcome, Today says once how to move to the Home Screen', async ({ page }) => {
    await page.goto('/');
    await page.locator('.prompt-text').waitFor();
    await page.evaluate(async () => {
      const data = await fetch('./demo/demo-data.json').then((r) => r.json());
      await new Promise((res) => {
        const q = indexedDB.open('murmur', 3);
        q.onsuccess = () => {
          const t = q.result.transaction('entries', 'readwrite');
          data.entries.slice(0, 2).forEach((e, i) => t.objectStore('entries').put({ ...e, id: 'i' + i, demo: false, hasAudio: false, createdAt: Date.now() - i * 86400000 }));
          t.oncomplete = res;
        };
      });
    });
    await page.reload();
    await page.locator('[data-key="ios-install-ok"]').click();
    await expect(page.locator('[data-key="ios-install-ok"]')).toHaveCount(0);
    await page.waitForTimeout(300); // let the setting reach the database
    await page.reload();
    await page.locator('.prompt-text').waitFor();
    await expect(page.locator('[data-key="ios-install-ok"]')).toHaveCount(0);
  });
});

test('a damaged backup imports what it can and every screen still opens', async ({ page }) => {
  await page.goto('/');
  await page.locator('.prompt-text').waitFor();
  const demo = await page.evaluate(() => fetch('./demo/demo-data.json').then((r) => r.json()));
  const good = { ...demo.entries[0], id: 'good', createdAt: Date.now() - 3600000, demo: false };
  const backup = {
    app: 'murmur',
    version: 1,
    entries: [good, { ...good, id: 'future', createdAt: 9e15 }, { id: 'nofeat', createdAt: Date.now() }, null, 'x'],
    nights: [{ id: 'n1', kindness: 'no date' }, { id: 'n2', createdAt: Date.now(), kindness: '<img src=x onerror=alert(1)>', seed: 's' }],
    lensSessions: [{ id: 's1', createdAt: Date.now(), lensId: 'gestalt', answers: null }],
  };
  page.on('dialog', (d) => d.dismiss());
  await page.goto('/#about');
  await page.locator('input[type="file"]').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator('.toast')).toContainText(/1/);
  for (const tab of ['today', 'lens', 'words', 'journal', 'trends', 'about']) {
    await page.goto('/#' + tab);
    await expect(page.locator('#main section')).toBeVisible();
  }
  await page.goto('/#journal');
  await page.locator('[data-key="jmode-nights"]').click();
  await expect(page.locator('#main img')).toHaveCount(0);
  await page.goto('/#lens');
  await page.locator('.lens-link', { hasText: /saved|存下/i }).click();
  await expect(page.locator('.lens-summary')).toHaveCount(1);
});

test('a silent check-in saves mood without a recording and shows in the journal, not in trends', async ({ page }) => {
  await page.goto('/');
  await page.locator('.prompt-text').waitFor();
  const w = page.locator('[data-key="welcome-close"]');
  if (await w.count()) await w.click();
  const promptBefore = await page.locator('.prompt-text').textContent();
  // saving with nothing filled in keeps nothing
  await page.locator('[data-key="silent-checkin"]').click();
  await expect(page.locator('[data-key="silent-title"]')).toBeFocused();
  await page.locator('[data-key="save"]').click();
  await expect(page.locator('.prompt-text')).toBeVisible();
  await page.locator('[data-key="silent-checkin"]').click();
  await page.locator('[data-key="mood-2"]').click();
  await page.fill('#note', 'roommate asleep');
  await page.locator('[data-key="save"]').click();
  // a silent check-in does not use up the day's prompt
  await expect(page.locator('.prompt-text')).toHaveText(promptBefore);
  await page.goto('/#journal');
  await expect(page.locator('.silent-list li')).toHaveCount(1);
  await expect(page.locator('.silent-list')).toContainText('roommate asleep');
  await page.goto('/#trends');
  await expect(page.locator('.chart')).toHaveCount(0);
  // the low-mood card picks it up
  await page.goto('/#today');
  await expect(page.locator('.low-card')).toBeVisible();
});

test('the language mirror opens from its tab, analyzes pasted text and keeps the notice on top', async ({ page }) => {
  await page.goto('/#journal');
  await page.locator('#tabs a[href="#words"]').click();
  await page.locator('[data-key="ll-text"]').fill('I miss my family and I keep thinking that I should have called. But maybe I just need rest, because I am tired. '.repeat(6));
  await page.locator('[data-key="ll-analyze"]').click();
  await expect(page.locator('[data-key="ll-notice"]')).toBeVisible();
  await expect(page.locator('[data-key="ll-report-html"]')).toBeVisible();
});

test.describe('tabs: the two headline features, and Trends inside the Journal', () => {
  test.use({ locale: 'zh-TW' });
  test('the tab bar is Today, 換角度, 語言鏡, Journal, About, each with an icon from the one family', async ({ page }) => {
    await page.goto('/#today');
    await expect(page.locator('#tabs a')).toHaveText(['今天', '換角度', '語言鏡', '紀錄', '關於']);
    expect(await page.locator('#tabs a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['#today', '#lens', '#words', '#journal', '#about']);
    await expect(page.locator('#tabs a svg.ic')).toHaveCount(5);
    await page.locator('#tabs a[href="#words"]').click();
    await expect(page.locator('#tabs a[href="#words"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.view.language [data-key="ll-famous-tag"]')).toBeVisible();
    await expect(page).toHaveURL(/#words$/);
    // the mirror is no longer a segment of the Journal
    await page.locator('#tabs a[href="#journal"]').click();
    await expect(page.locator('.journal-modes [role="tab"]')).toHaveText(['聲音', '趨勢', '夜晚', '小罐子']);
    await expect(page.locator('[data-key="jmode-words"]')).toHaveCount(0);
  });

  test('#trends still works: it lands on the Journal with the Trends segment open', async ({ page }) => {
    await page.goto('/#trends');
    await expect(page).toHaveURL(/#journal$/);
    await expect(page.locator('#tabs a[href="#journal"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-key="jmode-trends"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.view.journal.trends .empty')).toBeVisible();
    // and from inside the app, as an old link would
    await page.locator('#tabs a[href="#about"]').click();
    await page.evaluate(() => (location.hash = '#trends'));
    await expect(page.locator('.view.journal.trends')).toBeVisible();
    await expect(page).toHaveURL(/#journal$/);
    // the other segments are one tap away, and Back does not loop through #trends
    await page.locator('[data-key="jmode-voice"]').click();
    await expect(page.locator('.view.journal.trends')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('.view.about')).toBeVisible();
  });

  test('Today: 換角度 first, 語言鏡 second with a lit famous line, then the voice journal, then the small tools', async ({ page }) => {
    // the teaser shows one line a day; fix the day
    await page.clock.install({ time: new Date('2026-11-28T10:00:00+08:00') });
    await page.goto('/#today');
    const close = page.locator('[data-key="welcome-close"]');
    if (await close.count()) await close.click();
    const order = await page.locator('.view.today > *').evaluateAll((els) => els.map((e) => e.className.split(' ')[0]));
    const at = (c) => order.indexOf(c);
    expect(at('lens-hero')).toBeGreaterThanOrEqual(0);
    expect(at('lens-hero')).toBeLessThan(at('mirror-hero'));
    expect(at('mirror-hero')).toBeLessThan(at('voice-card'));
    expect(at('voice-card')).toBeLessThan(at('tool-row'));
    // the teaser is lit by the mirror's own code: marks around counted words, plain text nodes otherwise
    const line = page.locator('[data-key="mirror-line"]');
    await expect(line.locator('mark.ll-m').first()).toBeVisible();
    await expect(line).toHaveText('我不知道他們給了我多少日子；但我的手確乎是漸漸空虛了。');
    await expect(line.locator('mark.ll-m-self')).toHaveCount(3);
    await expect(page.locator('[data-key="mirror-by"]')).toHaveText('朱自清〈匆匆〉');
    expect(await line.evaluate((n) => [...n.querySelectorAll('*')].every((x) => x.tagName === 'MARK'))).toBe(true);
    // one button opens the playground
    const door = page.locator('[data-key="words-door"]');
    await expect(door).toHaveText('打開語言鏡');
    expect((await door.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await door.click();
    await expect(page).toHaveURL(/#words$/);
    await expect(page.locator('[data-key="ll-famous-tag"]')).toBeVisible();
    // the same place from a link
    await page.goto('/#about');
    await page.goto('/#words');
    await expect(page.locator('[data-key="ll-text"]')).toBeVisible();
    await page.locator('[data-key="ll-text"]').pressSequentially('我應該');
    await expect(page.locator('[data-key="ll-lit"] mark.ll-m-should')).toHaveText('應該');
  });
});

test('calm and writing open from Today', async ({ page }) => {
  await page.goto('/');
  await page.locator('.prompt-text').waitFor();
  const w = page.locator('[data-key="welcome-close"]');
  if (await w.count()) await w.click();
  await page.locator('[data-key="calm-link"]').click();
  await expect(page.locator('#sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('[data-key="writing-link"]').click();
  await expect(page.locator('#sheet [role="tablist"]')).toBeVisible();
});
