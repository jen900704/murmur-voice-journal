import { test, expect } from '@playwright/test';
import { openLensMore } from './helpers.mjs';
import { readFileSync } from 'node:fs';

// The featured-item policy (js/policy.js): off until the person says yes, one featured row,
// every decision logged with its propensity, and a reset. Spec: lab/rl/POLICY_SPEC.md.
test.use({ locale: 'zh-TW' });

function setting(page, key) {
  return page.evaluate(
    (k) =>
      new Promise((resolve) => {
        const q = indexedDB.open('murmur');
        q.onsuccess = () => {
          const r = q.result.transaction('settings').objectStore('settings').get(k);
          r.onsuccess = () => {
            q.result.close();
            resolve(r.result ?? null);
          };
        };
      }),
    key
  );
}

async function toPickList(page, { concern = '我一直擔心報告做不好', topic = 'work', topics = [topic], risky = false } = {}) {
  await page.goto('/#lens');
  await page.reload(); // a fresh lens home page, wherever the last exercise was left
  await page.locator('[data-key="lens-start"]').click();
  await page.fill('#lens-concern', concern);
  await page.locator('[data-key="lens-worry-next"]').click();
  if (risky) await page.locator('[data-key="crisis-continue"]').click();
  for (const t of topics) await page.locator(`[data-key="topic-${t}"]`).click();
  await page.locator('[data-key="lens-topics-next"]').click();
  await page.locator('[data-key="lens-concern-next"]').click();
  await page.locator('[data-key="lens-pick-all"]').click();
  await expect(page.getByRole('heading', { name: '選一個角度' })).toBeVisible();
}

async function answerAll(page) {
  for (let i = 0; i < 5; i++) {
    if (await page.locator('.lens-summary').count()) break;
    if (await page.locator('.scale-11').count()) await page.locator('[data-key="scale-4"]').click();
    else await page.fill('#lens-answer', `回答 ${i + 1}`);
    await page.locator('[data-key="lens-next"]').click();
  }
  await expect(page.locator('.lens-summary')).toBeVisible();
}

async function optInFromSettingsPanel(page) {
  await page.goto('/#lens');
  await page.locator('[data-key="policy-panel"] summary').click();
  await expect(page.locator('[data-key="policy-toggle"]')).not.toBeChecked(); // off by default
  await page.locator('[data-key="policy-toggle"]').check();
  await expect.poll(() => setting(page, 'policyOptIn')).toBe(true);
}

test('off by default: no featured row and nothing logged; saying yes features one row', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await toPickList(page);
  await expect(page.locator('[data-key="policy-featured"]')).toHaveCount(0);
  await expect(page.locator('[data-key="policy-optin"]')).toBeVisible();
  const rowsBefore = await page.locator('.lens-row').count();
  const orderBefore = await page.locator('.lens-row').evaluateAll((els) => els.map((e) => e.dataset.key));
  expect(orderBefore[0]).toBe('pick-cognitive'); // the usual order for a work worry
  expect(await setting(page, 'policyLog')).toBeNull();
  expect(await setting(page, 'policyOptIn')).toBeNull();

  await page.locator('[data-key="policy-optin-yes"]').click();
  await expect(page.locator('[data-key="policy-featured"] .lens-row')).toHaveCount(1);
  await expect(page.locator('[data-key="policy-optin"]')).toHaveCount(0);
  // the same lenses as before, each once: the featured one moved up, the others kept their order
  await expect(page.locator('.lens-row')).toHaveCount(rowsBefore);
  const orderAfter = await page.locator('.lens-row').evaluateAll((els) => els.map((e) => e.dataset.key));
  expect(new Set(orderAfter).size).toBe(rowsBefore);
  expect(orderAfter.slice(1)).toEqual(orderBefore.filter((k) => k !== orderAfter[0]));

  const log = await setting(page, 'policyLog');
  expect(log).toHaveLength(1);
  const r = log[0];
  expect(r.surface).toBe('lens');
  expect(r.context).toBe('work');
  expect(r.eligible).toEqual(orderBefore.map((k) => k.replace('pick-', '')));
  expect(`pick-${r.action}`).toBe(orderAfter[0]);
  expect(r.greedy).toBe('cognitive');
  expect(r.gated).toBeNull();
  expect(r.propensity).toBeGreaterThan(0);
  expect(r.propensity).toBeLessThanOrEqual(1);
  expect(r.propensity).toBeCloseTo(r.probs[r.eligible.indexOf(r.action)], 12);
  expect(r.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  expect(Math.min(...r.probs)).toBeGreaterThanOrEqual((0.2 * 0.25) / r.eligible.length - 1e-12);
  expect(r.reward).toBeNull();
  expect(JSON.stringify(r)).not.toContain('報告'); // nothing the person wrote is logged

  // why this one, in plain words
  await page.locator('[data-key="policy-why"]').click();
  await expect(page.locator('[data-key="policy-why-body"]')).toContainText('你自己在這個裝置上給過的評分');
  expect(errors).toEqual([]);
});

test('saying no keeps the list as it was and logs nothing', async ({ page }) => {
  await toPickList(page);
  await page.locator('[data-key="policy-optin-no"]').click();
  await expect(page.locator('[data-key="policy-optin"]')).toHaveCount(0);
  await expect(page.locator('[data-key="policy-featured"]')).toHaveCount(0);
  expect(await setting(page, 'policyOptIn')).toBe(false);
  expect(await setting(page, 'policyLog')).toBeNull();
  // not asked again
  await toPickList(page);
  await expect(page.locator('[data-key="policy-optin"]')).toHaveCount(0);
  await expect(page.locator('[data-key="policy-featured"]')).toHaveCount(0);
});

test('a rating updates the log and the learner; export has a propensity column; reset clears', async ({ page }) => {
  await optInFromSettingsPanel(page);
  await toPickList(page);
  await expect(page.locator('[data-key="policy-featured"] .lens-row')).toHaveCount(1);
  // open a lens that is not necessarily the featured one: the log records what was used
  await page.locator('[data-key="pick-narrative"]').click();
  await answerAll(page);
  await page.locator('[data-key="rate-5"]').click();
  await openLensMore(page);
  await page.getByRole('button', { name: '結束，不儲存' }).click();
  await expect.poll(async () => (await setting(page, 'policyLog'))?.[0]?.reward).toBe(1);
  let log = await setting(page, 'policyLog');
  expect(log).toHaveLength(1);
  expect(log[0].used).toBe('narrative');
  expect(log[0].rating).toBe(5);
  expect(log[0].learned).toBe(true);
  expect(log[0].ratedAt).toBeTruthy();
  expect((await setting(page, 'policyState')).ev['lens|work']).toEqual({ narrative: { s: 1, f: 0 } });

  // a second exercise that ends without a rating stays "missing" and changes nothing
  await toPickList(page);
  await page.locator('[data-key="policy-featured"] .lens-row').click();
  await answerAll(page);
  await openLensMore(page);
  await page.getByRole('button', { name: '結束，不儲存' }).click();
  await expect.poll(async () => (await setting(page, 'policyLog'))?.[1]?.used ?? null).not.toBeNull();
  log = await setting(page, 'policyLog');
  expect(log).toHaveLength(2);
  expect(log[1].used).toBe(log[1].action);
  expect(log[1].reward).toBeNull();
  expect((await setting(page, 'policyState')).ev['lens|work']).toEqual({ narrative: { s: 1, f: 0 } });

  // export the decision log
  await page.locator('[data-key="policy-panel"] summary').click();
  await expect(page.locator('[data-key="policy-count"]')).toContainText('2');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-key="policy-export"]').click()]);
  expect(download.suggestedFilename()).toMatch(/^murmur-decisions-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = readFileSync(await download.path(), 'utf8').replace(/^﻿/, '');
  const [head, ...rows] = csv.split('\n');
  const cols = head.split(',');
  for (const c of ['surface', 'context', 'eligible', 'action', 'propensity', 'probs', 'gated', 'policy', 'used', 'rating', 'reward']) expect(cols).toContain(c);
  expect(rows).toHaveLength(2);
  const first = rows[0].split(',');
  expect(Number(first[cols.indexOf('propensity')])).toBeCloseTo(log[0].propensity, 12);
  expect(first[cols.indexOf('reward')]).toBe('1');
  expect(rows[1].split(',')[cols.indexOf('reward')]).toBe(''); // missing, not 0

  // reset what it learned
  page.once('dialog', (d) => d.accept());
  await page.locator('[data-key="policy-reset"]').click();
  await expect(page.locator('[data-key="policy-count"]')).toContainText('0');
  expect(await setting(page, 'policyLog')).toEqual([]);
  expect((await setting(page, 'policyState')).ev).toEqual({});
  expect(await setting(page, 'policyOptIn')).toBe(true); // the switch stays where the person put it

  // switched off again: no featured row, nothing more logged
  await page.locator('[data-key="policy-toggle"]').uncheck();
  await expect.poll(() => setting(page, 'policyOptIn')).toBe(false);
  await toPickList(page);
  await expect(page.locator('[data-key="policy-featured"]')).toHaveCount(0);
  expect(await setting(page, 'policyLog')).toEqual([]);
});

test('risk language, a loss, or a low mood: the usual first lens, propensity 1, and nothing learned', async ({ page }) => {
  await optInFromSettingsPanel(page);

  // risk language in this exercise (a false alarm the person continues past)
  await toPickList(page, { concern: '報告被退回，我想死', risky: true });
  await expect(page.locator('[data-key="policy-featured"] .lens-row')).toHaveAttribute('data-key', 'pick-cognitive');
  await page.locator('[data-key="policy-why"]').click();
  await expect(page.locator('[data-key="policy-why-body"]')).toContainText('不做任何嘗試');
  await page.locator('[data-key="policy-featured"] .lens-row').click();
  await answerAll(page);
  await page.locator('[data-key="rate-5"]').click();
  await openLensMore(page);
  await page.getByRole('button', { name: '結束，不儲存' }).click();
  await expect.poll(async () => (await setting(page, 'policyLog'))?.[0]?.reward).toBe(1);
  let log = await setting(page, 'policyLog');
  expect(log[0].gated).toBe('risk');
  expect(log[0].propensity).toBe(1);
  expect(log[0].action).toBe(log[0].eligible[0]);
  expect(log[0].learned).toBe(false);
  expect((await setting(page, 'policyState'))?.ev ?? {}).toEqual({});

  // the risk note lasts 36 hours, so an ordinary worry right afterwards is gated too
  await toPickList(page);
  await expect.poll(async () => (await setting(page, 'policyLog')).length).toBe(2);
  expect((await setting(page, 'policyLog'))[1].gated).toBe('risk');

  // a loss is never a place to try things out: only the grief lenses, the first one featured
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const q = indexedDB.open('murmur');
        q.onsuccess = () => {
          const t = q.result.transaction('settings', 'readwrite');
          t.objectStore('settings').delete('policyRiskAt');
          t.oncomplete = () => {
            q.result.close();
            resolve();
          };
        };
      })
  );
  await toPickList(page, { concern: '外婆上個月走了', topic: 'loss' });
  await expect(page.locator('[data-key="policy-featured"] .lens-row')).toHaveAttribute('data-key', 'pick-person-centered');
  log = await setting(page, 'policyLog');
  expect(log[2].gated).toBe('loss');
  expect(log[2].propensity).toBe(1);
  expect(log[2].eligible.length).toBeLessThan(14);
  await expect(page.locator('.lens-row')).toHaveCount(log[2].eligible.length);

  // a low mood check-in gates the next decision
  await page.goto('/');
  await page.locator('.prompt-text').waitFor();
  const w = page.locator('[data-key="welcome-close"]');
  if (await w.count()) await w.click();
  await page.locator('[data-key="silent-checkin"]').click();
  await page.locator('[data-key="mood-2"]').click();
  await page.locator('[data-key="save"]').click();
  await expect(page.locator('.low-card')).toBeVisible();
  await toPickList(page);
  log = await setting(page, 'policyLog');
  const last = log[log.length - 1];
  expect(last.surface).toBe('lens');
  expect(last.gated).toBe('low-mood');
  expect(last.action).toBe('cognitive');
  expect(last.propensity).toBe(1);
});

test('bedtime: a suggested track is logged, and the optional question after it is the reward', async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__MURMUR_SPEED = 200;
  });
  // off: the ritual is as before, with no question after the track
  await page.goto('/');
  await page.locator('.prompt-text').waitFor();
  const w = page.locator('[data-key="welcome-close"]');
  if (await w.count()) await w.click();
  await page.locator('[data-key="night-start"], [data-key="night-link"]').first().click();
  await page.locator('[data-key="night-theme-work"]').click();
  await page.locator('[data-key="night-next"]').click();
  await page.locator('[data-key="night-next"]').click();
  await expect(page.locator('.track.suggested')).toHaveAttribute('data-key', 'track-solution-focused');
  await page.locator('.track.suggested').click();
  await expect(page.locator('.postcard svg')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-key="track-helped-yes"]')).toHaveCount(0);
  expect(await setting(page, 'policyLog')).toBeNull();

  // on: one decision per night, the track that was played is recorded, the answer is the reward
  await optInFromSettingsPanel(page);
  await page.goto('/');
  await page.locator('[data-key="night-start"], [data-key="night-link"]').first().click();
  await page.locator('[data-key="night-theme-work"]').click();
  await page.locator('[data-key="night-next"]').click();
  await page.locator('[data-key="night-next"]').click();
  await expect(page.locator('.track.suggested')).toHaveCount(1);
  let log = await setting(page, 'policyLog');
  expect(log).toHaveLength(1);
  expect(log[0].surface).toBe('track');
  expect(log[0].context).toBe('work');
  expect(log[0].eligible[0]).toBe('solution-focused');
  expect(log[0].eligible).not.toContain('drift');
  expect(log[0].eligible).toHaveLength(8);
  await expect(page.locator('.track.suggested')).toHaveAttribute('data-key', `track-${log[0].action}`);
  await page.locator('.track.suggested').click();
  await expect(page.locator('.postcard svg')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#track-helped-q')).toHaveText('這段有幫助嗎？');
  await page.locator('[data-key="track-helped-no"]').click();
  await expect(page.locator('[data-key="track-helped-thanks"]')).toBeVisible();
  await expect.poll(async () => (await setting(page, 'policyLog'))[0].reward).toBe(0);
  log = await setting(page, 'policyLog');
  expect(log).toHaveLength(1);
  expect(log[0].used).toBe(log[0].action);
  expect(log[0].rating).toBeNull();
  expect(log[0].learned).toBe(true);
  expect((await setting(page, 'policyState')).ev['track|work'][log[0].action]).toEqual({ s: 0, f: 1 });
});

test('low-mood note: the first small action is the usual one, and the answer is logged but never learned from', async ({ page }) => {
  await optInFromSettingsPanel(page);
  await page.goto('/');
  await page.locator('.prompt-text').waitFor();
  const w = page.locator('[data-key="welcome-close"]');
  if (await w.count()) await w.click();
  await page.locator('[data-key="silent-checkin"]').click();
  await page.locator('[data-key="mood-2"]').click();
  await page.locator('[data-key="save"]').click();
  await expect(page.locator('.low-card')).toBeVisible();
  await expect(page.locator('[data-key="small-helped-yes"]')).toHaveText('試過了，有幫助');
  await expect.poll(async () => (await setting(page, 'policyLog'))?.length ?? 0).toBe(1);
  await page.locator('[data-key="small-helped-yes"]').click();
  await expect(page.locator('.low-card [role="status"]')).toContainText('記下了');
  await expect.poll(async () => (await setting(page, 'policyLog'))[0].reward).toBe(1);
  const r = (await setting(page, 'policyLog'))[0];
  expect(r.surface).toBe('small');
  expect(r.gated).toBe('low-mood');
  expect(r.propensity).toBe(1);
  expect(r.action).toBe(r.eligible[0]);
  expect(r.learned).toBe(false);
  expect((await setting(page, 'policyState'))?.ev ?? {}).toEqual({});
  // the help link is still there and is not part of the policy
  await expect(page.locator('.low-card .low-links button', { hasText: '可以找人說話的地方' })).toBeVisible();
  expect(r.eligible.every((id) => /^small-\d+$/.test(id))).toBe(true);
});

test('"delete all data" also removes the switch, what was learned, and the decision log', async ({ page }) => {
  await optInFromSettingsPanel(page);
  await toPickList(page);
  await expect.poll(async () => (await setting(page, 'policyLog'))?.length ?? 0).toBe(1);
  await page.evaluate(async () => {
    const db = await import('./js/db.js');
    await db.clearAll();
  });
  for (const k of ['policyOptIn', 'policyLog', 'policyState', 'policyRiskAt']) expect(await setting(page, k)).toBeNull();
});

test('several topics: one small context, and a loss among them is gated with only the grief lenses', async ({ page }) => {
  await optInFromSettingsPanel(page);
  // the context is the first topic chosen, so combinations do not add contexts
  await toPickList(page, { concern: '主管和爸媽都在催我', topics: ['family', 'work'] });
  await expect(page.locator('[data-key="policy-featured"] .lens-row')).toHaveCount(1);
  let log = await setting(page, 'policyLog');
  expect(log).toHaveLength(1);
  expect(log[0].context).toBe('family');
  expect(log[0].eligible).toHaveLength(14);
  expect(log[0].eligible.slice(0, 6)).toEqual(['family-systems', 'adlerian', 'feminist', 'narrative', 'person-centered', 'cognitive']);

  // loss chosen second: still the loss context, gated, and no lens unsuited to grief is eligible
  await toPickList(page, { concern: '外婆上個月走了，工作也顧不好', topics: ['work', 'loss'] });
  log = await setting(page, 'policyLog');
  expect(log).toHaveLength(2);
  expect(log[1].context).toBe('loss');
  expect(log[1].gated).toBe('loss');
  expect(log[1].propensity).toBe(1);
  expect([...log[1].eligible].sort()).toEqual(['acceptance', 'family-systems', 'feminist', 'person-centered', 'psychoanalytic']);
  await expect(page.locator('.lens-row')).toHaveCount(5);
  await expect(page.locator('[data-key="policy-featured"] .lens-row')).toHaveAttribute('data-key', `pick-${log[1].eligible[0]}`);
});
