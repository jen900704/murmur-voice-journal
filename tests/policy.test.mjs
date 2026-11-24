// Unit tests for js/policy.js against lab/rl/POLICY_SPEC.md (section 10 lists the invariants).
// Run with: node tests/policy.test.mjs
import assert from 'node:assert/strict';
import * as P from '../js/policy.js';
import { LENSES, TOPICS, TOPIC_COMMON, lensById, lensesForTopic } from '../js/lenses.js';
import { TRACKS, THEMES, THEME_TRACK } from '../js/bedtime.js';

let passed = 0;
const pending = [];
function test(name, fn) {
  const done = () => {
    passed++;
    console.log('ok   ', name);
  };
  const fail = (e) => {
    console.log('FAIL ', name, '\n     ', e.message);
    process.exitCode = 1;
  };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') pending.push(r.then(done, fail));
    else done();
  } catch (e) {
    fail(e);
  }
}

// the same expert orders the screens build
function lensOrder(topic) {
  const all = lensesForTopic(topic);
  const common = (TOPIC_COMMON[topic] || []).map(lensById).filter((l) => l && all.includes(l));
  return [...common, ...all.filter((l) => !common.includes(l))].map((l) => l.id);
}
function trackOrder(theme) {
  const first = THEME_TRACK[theme];
  return TRACKS.map((t) => t.id).filter((id) => id !== 'drift').sort((a, b) => (b === first) - (a === first));
}
const sum = (a) => a.reduce((x, y) => x + y, 0);

// a settings store in memory, with the two calls createPolicyStore needs
function memoryDb() {
  const m = new Map();
  return {
    m,
    getSetting: async (k, fallback) => (m.has(k) ? structuredClone(m.get(k)) : fallback),
    setSetting: async (k, v) => void m.set(k, structuredClone(v)),
  };
}

test('constants match the spec (section 9)', () => {
  assert.equal(P.N0, 3);
  assert.equal(P.EPS, 0.2);
  assert.equal(P.KAPPA, 0.25);
  assert.equal(P.GAMMA, 0.98);
  assert.equal(P.MC_DRAWS, 1000);
  assert.ok(Math.abs(P.ESS_CAP - 50) < 1e-9);
  const p0 = P.priorFor(0);
  const p3 = P.priorFor(3);
  assert.ok(Math.abs(p0.a + p0.b - 3) < 1e-12 && Math.abs(p0.a / 3 - 0.6) < 1e-12);
  assert.ok(Math.abs(p3.a / (p3.a + p3.b) - 0.54) < 1e-12);
});

test('with no data the prior follows the expert order: greedy is the first item in every context', () => {
  for (const topic of TOPICS) {
    const E = lensOrder(topic);
    const post = P.posteriors(E);
    for (let i = 1; i < post.length; i++) assert.ok(post[i - 1].mean > post[i].mean, `${topic}: prior means fall with the expert order`);
    const d = P.decide({ eligible: E, seed: 7 });
    assert.equal(d.greedy, E[0], topic);
    if (TOPIC_COMMON[topic]) assert.equal(d.greedy, TOPIC_COMMON[topic][0], topic);
  }
  for (const theme of [...THEMES, null]) {
    const E = trackOrder(theme);
    assert.equal(P.decide({ eligible: E, seed: 7 }).greedy, theme ? THEME_TRACK[theme] : TRACKS[0].id);
    assert.ok(!E.includes('drift'));
  }
});

test('at t = 0 the expert first item is featured at least 1 - EPS of the time, and is the most likely', () => {
  const E = lensOrder('work');
  let first = 0;
  const n = 1500;
  for (let seed = 1; seed <= n; seed++) {
    const d = P.decide({ eligible: E, seed, draws: 200 });
    assert.ok(d.probs[0] >= 1 - P.EPS - 1e-12);
    assert.equal(Math.max(...d.probs), d.probs[0]);
    if (d.action === E[0]) first++;
  }
  assert.ok(first / n > 0.78, `expert first featured ${first / n}`);
});

test('probabilities sum to 1, cover only eligible arms, and never fall below EPS * KAPPA / K', () => {
  for (const topic of TOPICS) {
    const E = lensOrder(topic);
    const evidence = { [E[E.length - 1]]: { s: 6, f: 1 }, [E[0]]: { s: 0, f: 4 } };
    for (let seed = 1; seed <= 20; seed++) {
      const d = P.decide({ eligible: E, evidence, seed, draws: 200 });
      assert.equal(d.probs.length, E.length);
      assert.deepEqual(d.eligible, E);
      assert.ok(Math.abs(sum(d.probs) - 1) < 1e-9);
      assert.ok(Math.min(...d.probs) >= (P.EPS * P.KAPPA) / E.length - 1e-12);
      assert.ok(E.includes(d.action));
      assert.equal(d.propensity, d.probs[E.indexOf(d.action)]);
      assert.equal(d.gated, null);
    }
  }
});

test('an arm outside the eligible set can never be featured (topic exclusions, grief)', () => {
  const E = lensOrder('loss');
  assert.ok(E.length < LENSES.length && E.length >= 1);
  const excluded = LENSES.map((l) => l.id).filter((id) => !E.includes(id));
  // even with strong evidence for an excluded lens, it has no probability at all
  const evidence = Object.fromEntries(excluded.map((id) => [id, { s: 40, f: 0 }]));
  for (let seed = 1; seed <= 200; seed++) {
    const d = P.decide({ eligible: E, evidence, seed, draws: 100 });
    assert.ok(!excluded.includes(d.action));
    assert.ok(d.eligible.every((id) => !excluded.includes(id)));
  }
  assert.equal(P.decide({ eligible: [], seed: 1 }), null);
});

test('logged propensities match how often each arm is actually featured', () => {
  const E = ['a', 'b', 'c', 'd'];
  const evidence = { b: { s: 5, f: 1 }, c: { s: 2, f: 2 } };
  const n = 4000;
  const freq = Object.fromEntries(E.map((a) => [a, 0]));
  const mean = Object.fromEntries(E.map((a) => [a, 0]));
  let ipw = 0;
  for (let seed = 1; seed <= n; seed++) {
    const d = P.decide({ eligible: E, evidence, seed: P.hashSeed(`s${seed}`), draws: 200 });
    freq[d.action]++;
    E.forEach((a, i) => (mean[a] += d.probs[i] / n));
    ipw += 1 / d.propensity / E.length; // the mean of 1/p over the chosen arm is K when p is right
  }
  for (const a of E) assert.ok(Math.abs(freq[a] / n - mean[a]) < 0.025, `${a}: featured ${freq[a] / n}, logged ${mean[a]}`);
  assert.ok(Math.abs(ipw / n - 1) < 0.12, `inverse-propensity check ${ipw / n}`);
  assert.equal(P.decide({ eligible: E, evidence, seed: 3 }).greedy, 'b');
});

test('the Monte Carlo Thompson share agrees with a fine-grid integral', () => {
  const post = P.posteriors(['a', 'b', 'c'], { b: { s: 4, f: 1 } });
  const q = P.thompsonProbs(post, P.mulberry32(11), 20000);
  // P(arm i is largest) = integral of f_i(x) * prod_{j != i} F_j(x) dx on a midpoint grid
  const n = 4000;
  const f = post.map(({ a, b }) => {
    const d = Array.from({ length: n }, (_, k) => Math.exp((a - 1) * Math.log((k + 0.5) / n) + (b - 1) * Math.log(1 - (k + 0.5) / n)));
    const z = sum(d);
    return d.map((v) => v / z);
  });
  const F = f.map((d) => {
    let acc = 0;
    return d.map((v) => (acc += v) - v / 2);
  });
  const exact = post.map((_, i) => sum(f[i].map((v, k) => v * post.reduce((pr, __, j) => (j === i ? pr : pr * F[j][k]), 1))));
  exact.forEach((e, i) => assert.ok(Math.abs(e - q[i]) < 0.015, `arm ${i}: grid ${e}, Monte Carlo ${q[i]}`));
});

test('the gate: opted out, risk, low mood and loss, in that order', () => {
  assert.equal(P.gateReason({ optedIn: false, risk: true, mood: 1, surface: 'lens', context: 'loss' }), 'opt-out');
  assert.equal(P.gateReason({ optedIn: true, risk: true, mood: 1, surface: 'lens', context: 'loss' }), 'risk');
  assert.equal(P.gateReason({ optedIn: true, mood: 2, surface: 'lens', context: 'loss' }), 'low-mood');
  assert.equal(P.gateReason({ optedIn: true, mood: 1, surface: 'track', context: 'work' }), 'low-mood');
  assert.equal(P.gateReason({ optedIn: true, mood: 3, surface: 'lens', context: 'loss' }), 'loss');
  assert.equal(P.gateReason({ optedIn: true, mood: 3, surface: 'lens', context: 'work' }), null);
  assert.equal(P.gateReason({ optedIn: true, mood: null, surface: 'track', context: 'none' }), null);
  assert.equal(P.gateReason(), 'opt-out'); // off unless the person said yes
  // no mood rating at all is not a low mood (null <= 2 is true in JavaScript)
  assert.deepEqual([null, undefined, NaN, 1, 2, 3, 7].map(P.isLowMood), [false, false, false, true, true, false, false]);
  // the latest real rating, and only within 36 hours
  const now = Date.now();
  assert.equal(P.recentMood([{ mood: 6, createdAt: now - 5000 }, { mood: 2, createdAt: now - 1000 }], now), 2);
  assert.equal(P.recentMood([{ mood: 2, createdAt: now - 40 * 3600 * 1000 }], now), null);
  assert.equal(P.recentMood([{ mood: 5, createdAt: now - 2000 }, { mood: 1, createdAt: now - 1000, demo: true }], now), 5);
});

test('a gated decision features the expert first item with propensity 1 and no exploration', () => {
  const E = lensOrder('self');
  // evidence that would otherwise pull the choice elsewhere
  const evidence = { [E[3]]: { s: 30, f: 0 } };
  for (const gated of ['risk', 'low-mood', 'loss']) {
    const seen = new Set();
    for (let seed = 1; seed <= 300; seed++) {
      const d = P.decide({ eligible: E, evidence, gated, seed });
      seen.add(d.action);
      assert.equal(d.propensity, 1);
      assert.equal(d.gated, gated);
      assert.deepEqual(d.probs, E.map((_, i) => (i === 0 ? 1 : 0)));
      assert.equal(d.mcDraws, 0);
    }
    assert.deepEqual([...seen], [E[0]]);
  }
  // not gated, the same evidence does move the choice
  assert.equal(P.decide({ eligible: E, evidence, seed: 1 }).greedy, E[3]);
});

test('rewards: 4 and 5 are helpful, 1 to 3 are not, no rating is missing and changes nothing', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(P.rewardFromRating), [0, 0, 0, 1, 1]);
  for (const v of [null, undefined, 0, 6, 3.5, '5']) assert.equal(P.rewardFromRating(v), null);
  const ev = { a: { s: 2, f: 1 } };
  assert.equal(P.updateEvidence(ev, 'a', null), ev);
  assert.equal(P.updateEvidence(ev, 'a', undefined), ev);
  assert.deepEqual(P.posteriors(['a', 'b'], P.updateEvidence(ev, 'a', null)), P.posteriors(['a', 'b'], ev));
});

test('discounting: old evidence fades, the prior stays, and a context never holds more than 50', () => {
  let ev = {};
  ev = P.updateEvidence(ev, 'a', 1);
  assert.deepEqual(ev, { a: { s: 1, f: 0 } });
  ev = P.updateEvidence(ev, 'b', 0);
  assert.ok(Math.abs(ev.a.s - 0.98) < 1e-12 && ev.b.f === 1 && ev.b.s === 0);
  for (let i = 0; i < 2000; i++) {
    ev = P.updateEvidence(ev, i % 3 ? 'a' : 'b', i % 2);
    assert.ok(P.evidenceTotal(ev) <= P.ESS_CAP + 1e-9);
  }
  assert.ok(P.evidenceTotal(ev) > 49.9);
  // a rating's weight halves after about 34 later ratings
  let one = P.updateEvidence({}, 'x', 1);
  for (let i = 0; i < 34; i++) one = P.updateEvidence(one, 'y', 0);
  assert.ok(Math.abs(one.x.s - 0.5) < 0.01);
  // after a long run of "not helpful" for the expert first arm, recent "helpful" for another wins
  let drift = {};
  for (let i = 0; i < 30; i++) drift = P.updateEvidence(drift, 'first', 1);
  for (let i = 0; i < 60; i++) drift = P.updateEvidence(drift, i % 2 ? 'first' : 'second', i % 2 ? 0 : 1);
  assert.equal(P.decide({ eligible: ['first', 'second'], evidence: drift, seed: 2 }).greedy, 'second');
  // the input is never changed in place
  const frozen = Object.freeze({ a: Object.freeze({ s: 1, f: 1 }) });
  assert.notEqual(P.updateEvidence(frozen, 'a', 1), frozen);
});

test('same seed and same history give the same decision; another seed gives another draw', () => {
  const E = lensOrder('relationship');
  const evidence = { [E[2]]: { s: 3, f: 1 } };
  const a = P.decide({ eligible: E, evidence, seed: 12345 });
  const b = P.decide({ eligible: E, evidence, seed: 12345 });
  assert.deepEqual(a, b);
  const others = new Set();
  for (let seed = 1; seed <= 400; seed++) others.add(P.decide({ eligible: E, evidence, seed, draws: 100 }).action);
  assert.ok(others.size > 1);
  const r1 = P.mulberry32(9);
  const r2 = P.mulberry32(9);
  for (let i = 0; i < 5; i++) assert.equal(P.sampleBeta(r1, 1.8, 1.2), P.sampleBeta(r2, 1.8, 1.2));
});

test('the Beta sampler has the right mean and variance', () => {
  for (const [a, b] of [[1.8, 1.2], [0.4, 2.6], [12, 5]]) {
    const rng = P.mulberry32(a * 100 + b);
    const xs = Array.from({ length: 20000 }, () => P.sampleBeta(rng, a, b));
    const m = sum(xs) / xs.length;
    const v = sum(xs.map((x) => (x - m) ** 2)) / xs.length;
    assert.ok(Math.abs(m - a / (a + b)) < 0.01, `mean of Beta(${a}, ${b}): ${m}`);
    assert.ok(Math.abs(v - (a * b) / ((a + b) ** 2 * (a + b + 1))) < 0.005, `variance of Beta(${a}, ${b}): ${v}`);
    assert.ok(xs.every((x) => x >= 0 && x <= 1));
  }
});

test('decision records carry the spec fields and survive cleaning; bad ones are dropped', () => {
  const E = lensOrder('work');
  const d = P.decide({ eligible: E, seed: 99 });
  const r = P.makeRecord({ surface: 'lens', context: 'work', decision: d, now: 1790000000000 });
  for (const k of ['v', 'id', 't', 'surface', 'context', 'eligible', 'probs', 'greedy', 'action', 'propensity', 'gated', 'eps', 'kappa', 'gamma', 'n0', 'propMethod', 'mcDraws', 'used', 'rating', 'reward', 'ratedAt', 'policy']) assert.ok(k in r, k);
  assert.equal(r.reward, null);
  assert.equal(r.propMethod, 'mc');
  assert.equal(r.policy, P.POLICY_VERSION);
  assert.deepEqual(P.cleanDecision(JSON.parse(JSON.stringify(r))), r);
  // nothing the person wrote is in a record
  assert.ok(!/concern|worry|answer|note/i.test(Object.keys(r).join(' ')));
  const bad = [
    null,
    [],
    { ...r, id: '' },
    { ...r, t: 'not a date' },
    { ...r, surface: 'journal' },
    { ...r, eligible: [] },
    { ...r, eligible: ['<script>', ...E.slice(1)] },
    { ...r, action: 'not-in-the-list' },
    { ...r, propensity: 0 },
    { ...r, propensity: 1.5 },
    { ...r, probs: r.probs.slice(1) },
    { ...r, probs: r.probs.map(() => 1) },
    { ...r, gated: 'risk' }, // gated but explored
    { ...r, rating: 5, reward: 0 },
  ];
  for (const b of bad) assert.equal(P.cleanDecision(b), null, JSON.stringify(b).slice(0, 80));
  // a reward claimed as learned in a gated session is not kept as learned
  const g = P.makeRecord({ surface: 'lens', context: 'loss', decision: P.decide({ eligible: lensOrder('loss'), gated: 'loss', seed: 1 }) });
  assert.equal(P.cleanDecision({ ...g, used: g.action, rating: 5, reward: 1, ratedAt: g.t, learned: true }).learned, false);
  // state from a file: unknown keys dropped, counts capped at the effective sample size
  const st = P.cleanState({ ev: { 'lens|work': { cognitive: { s: 900, f: 900 }, '__proto__': { s: 1, f: 1 }, bad: 'x' }, 'elsewhere|x': { a: { s: 1, f: 1 } } } });
  assert.deepEqual(Object.keys(st.ev), ['lens|work']);
  assert.ok(P.evidenceTotal(st.ev['lens|work']) <= P.ESS_CAP + 1e-9);
  assert.deepEqual(P.cleanState('nonsense').ev, {});
});

test('CSV export has one row per decision with a propensity column, and no formulas', () => {
  const d = P.decide({ eligible: ['a', 'b', 'c'], seed: 4 });
  const r = P.makeRecord({ surface: 'track', context: 'work', decision: d });
  const g = P.makeRecord({ surface: 'lens', context: 'loss', decision: P.decide({ eligible: ['a', 'b'], gated: 'loss', seed: 4 }), id: '=cmd()' });
  const lines = P.decisionsCsv([r, g]).split('\n');
  assert.equal(lines.length, 3);
  const head = lines[0].split(',');
  assert.deepEqual(head, P.CSV_COLUMNS);
  for (const c of ['propensity', 'eligible', 'probs', 'action', 'gated', 'reward', 'surface', 'context', 'policy']) assert.ok(head.includes(c), c);
  const row = lines[1].split(',');
  assert.equal(Number(row[head.indexOf('propensity')]), d.propensity);
  assert.equal(row[head.indexOf('eligible')], 'a|b|c');
  assert.equal(row[head.indexOf('reward')], ''); // missing stays empty, not 0
  assert.ok(Math.abs(sum(row[head.indexOf('probs')].split('|').map(Number)) - 1) < 1e-9);
  assert.equal(lines[2].split(',')[head.indexOf('gated')], 'loss');
  assert.ok(lines[2].startsWith("1,'=cmd()"));
});

test('store: off by default, logs decisions, learns only from rated ungated sessions', async () => {
  const db = memoryDb();
  const store = P.createPolicyStore(db);
  assert.equal(await store.optIn(), undefined);
  await store.setOptIn(true);
  assert.equal(await store.optIn(), true);
  const E = lensOrder('work');
  const mk = (seed, gated = null) => P.makeRecord({ surface: 'lens', context: 'work', decision: P.decide({ eligible: E, gated, seed }), id: `r${seed}${gated || ''}` });

  // 1. rated and ungated: the lens that was used (not necessarily the featured one) is updated
  const a = mk(1);
  await store.log(a);
  await store.log(a); // the same decision is logged once
  assert.equal((await store.getLog()).length, 1);
  assert.equal(await store.rate(a.id, { rating: 5 }), false); // nothing opened yet
  await store.setUsed(a.id, E[4]);
  assert.equal(await store.rate(a.id, { rating: 5 }), true);
  assert.deepEqual(await store.evidence('lens', 'work'), { [E[4]]: { s: 1, f: 0 } });
  assert.equal(await store.rate(a.id, { rating: 1 }), false); // a session is rated once
  let rec = (await store.getLog())[0];
  assert.deepEqual([rec.used, rec.rating, rec.reward, rec.learned], [E[4], 5, 1, true]);
  assert.ok(rec.ratedAt);

  // 2. no rating: logged as missing, posterior unchanged
  const b = mk(2);
  await store.log(b);
  await store.setUsed(b.id, E[0]);
  assert.equal(await store.rate(b.id, { rating: null }), false);
  assert.equal((await store.getLog())[1].reward, null);
  assert.deepEqual(await store.evidence('lens', 'work'), { [E[4]]: { s: 1, f: 0 } });

  // 3. gated (low mood): the rating is kept in the log but never learned from
  const c = mk(3, 'low-mood');
  await store.log(c);
  await store.setUsed(c.id, E[0]);
  assert.equal(await store.rate(c.id, { rating: 2 }), false);
  rec = (await store.getLog())[2];
  assert.deepEqual([rec.reward, rec.learned, rec.propensity], [0, false, 1]);

  // 4. risk language turned up after the decision: not learned from either
  const d = mk(4);
  await store.log(d);
  await store.setUsed(d.id, E[1]);
  assert.equal(await store.rate(d.id, { rating: 4, allowLearning: false }), false);
  assert.deepEqual(await store.evidence('lens', 'work'), { [E[4]]: { s: 1, f: 0 } });
  // other contexts are untouched
  assert.deepEqual(await store.evidence('lens', 'family'), {});

  // the 36-hour risk note
  assert.equal(await store.recentRisk(), false);
  await store.noteRisk();
  assert.equal(await store.recentRisk(), true);
  assert.equal(await store.recentRisk(Date.now() + 37 * 3600 * 1000), false);

  // backup out and back in on a fresh device: cleaned, merged by id, bad records dropped
  const backup = JSON.parse(JSON.stringify(await store.exportForBackup()));
  assert.equal(backup.policyLog.length, 4);
  const db2 = memoryDb();
  const store2 = P.createPolicyStore(db2);
  assert.equal(await store2.importFromBackup({ policyLog: [...backup.policyLog, { id: 'x' }, null, backup.policyLog[0]], policyState: backup.policyState }), 4);
  assert.equal(await store2.importFromBackup(backup), 0);
  assert.deepEqual(await store2.evidence('lens', 'work'), { [E[4]]: { s: 1, f: 0 } });
  assert.equal(await store2.optIn(), undefined); // the choice to switch it on does not travel
  assert.equal(await store2.importFromBackup(null), 0);
  assert.equal(await store2.importFromBackup({ policyLog: 'x', policyState: 7 }), 0);

  // reset: what it learned and the log both go; the switch stays where it was
  await store.reset();
  assert.deepEqual(await store.getLog(), []);
  assert.deepEqual((await store.getState()).ev, {});
  assert.deepEqual(await store.evidence('lens', 'work'), {});
  assert.equal(await store.optIn(), true);
  assert.equal(P.decide({ eligible: E, evidence: await store.evidence('lens', 'work'), seed: 5 }).greedy, E[0]);
});

test('learning moves the featured lens only within its own topic, and reset undoes it', async () => {
  const db = memoryDb();
  const store = P.createPolicyStore(db);
  const E = lensOrder('work');
  for (let i = 0; i < 6; i++) {
    const r = P.makeRecord({ surface: 'lens', context: 'work', decision: P.decide({ eligible: E, evidence: await store.evidence('lens', 'work'), seed: i + 1 }), id: `w${i}` });
    await store.log(r);
    await store.setUsed(r.id, E[5]);
    await store.rate(r.id, { rating: 5 });
  }
  assert.equal(P.decide({ eligible: E, evidence: await store.evidence('lens', 'work'), seed: 1 }).greedy, E[5]);
  const F = lensOrder('family');
  assert.equal(P.decide({ eligible: F, evidence: await store.evidence('lens', 'family'), seed: 1 }).greedy, F[0]);
  await store.reset();
  assert.equal(P.decide({ eligible: E, evidence: await store.evidence('lens', 'work'), seed: 1 }).greedy, E[0]);
});

test('texts: both languages have the same keys and no em dashes', () => {
  const zh = P.POLICY_TEXT['zh-TW'];
  const en = P.POLICY_TEXT.en;
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  for (const t of [zh, en]) for (const v of Object.values(t)) assert.ok(!/[—–]|——/.test(typeof v === 'function' ? v(3) : v));
  assert.equal(P.policyText('fr'), en);
  assert.match(en.why, /Why this one/);
  assert.match(zh.why, /為什麼推薦這個/);
});

await Promise.all(pending);
console.log(`\n${passed} passed`);
