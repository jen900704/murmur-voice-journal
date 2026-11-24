import assert from 'node:assert/strict';
import { buildDonation, describeDonation, maskIdentifiers } from '../js/donation.js';
let passed = 0;
const test = (n, f) => { try { f(); passed++; } catch (e) { console.error('FAIL', n); throw e; } };
const t0 = Date.UTC(2026, 9, 1, 22, 13);
const data = {
  entries: [
    { id: 'a', createdAt: t0, mood: 3, energy: 4, note: '寫信給 jen@example.com', features: { f0MedianHz: 210.1234, contour: [{ f0: 1 }], secret: 5 } },
    { id: 'b', createdAt: t0 + 3 * 86400000 + 5000, silent: true, mood: 5, note: 'ok' },
    { id: 'demo', createdAt: t0 - 99 * 86400000, demo: true, features: { f0MedianHz: 1 } },
  ],
  sessions: [{ id: 's', createdAt: t0 + 86400000, lensId: 'cognitive', topics: ['work'], concern: '主管 0912-345-678', answers: ['我', ''], rating: 4, before: 7, after: 5, distance: { kind: 'friend', text: 'x' } }],
  nights: [{ id: 'n', createdAt: t0 + 2 * 86400000, themes: ['work'], track: 'pc', kindness: '散步' }],
};
test('numbers only by default: no ids, no dates, no text', () => {
  const p = buildDonation(data);
  const s = JSON.stringify(p);
  for (const bad of ['jen@', '主管', '散步', '"id"', String(t0), 'contour', 'secret']) assert.ok(!s.includes(bad), bad);
  assert.equal(p.days, 4);
  assert.deepEqual(p.voice.map((v) => v.day), [0, 3]);
  assert.equal(p.voice[0].features.f0MedianHz, 210.123);
  assert.equal(p.angles[0].answered, 1);
  assert.equal(p.angles[0].distance, 'friend');
});
test('demo records are never included', () => {
  assert.equal(buildDonation(data).voice.length, 2);
});
test('text only when asked, with identifiers masked', () => {
  const p = buildDonation(data, { includeText: true });
  assert.equal(p.voice[0].note, '寫信給 [email]');
  assert.equal(p.angles[0].worry, '主管 [number]');
  assert.equal(describeDonation(p).textFields, 4);
  assert.equal(maskIdentifiers('see https://x.y/z or @jen_yeh'), 'see [link] or [handle]');
});
console.log(`donation: ${passed} passed`);
const { lookBack } = await import('../js/lookback.js');
test('look back counts everything and averages only with enough sessions', () => {
  const d = 86400000;
  const s = [
    { createdAt: 1 * d, lensId: 'cognitive', topics: ['work'], before: 7, after: 5, rating: 4 },
    { createdAt: 2 * d, lensId: 'cognitive', topics: ['work', 'self'], before: 6, after: 6, rating: 3 },
    { createdAt: 3 * d, lensId: 'cognitive', topics: ['work'], before: 5, after: 6, rating: 5 },
    { createdAt: 4 * d, lensId: 'narrative', topics: ['self'], before: 8, after: 4 },
  ];
  const r = lookBack(s, { now: 10 * d });
  assert.equal(r.sessions, 4);
  assert.equal(r.lenses[0].lensId, 'cognitive');
  assert.equal(r.lenses[0].meanShift, -0.3);
  assert.deepEqual([r.lenses[0].lighter, r.lenses[0].same, r.lenses[0].heavier], [1, 1, 1]);
  assert.equal(r.lenses[1].meanShift, null); // one session is not enough for an average
  assert.deepEqual(r.topics[0], { topic: 'work', n: 3 });
});
console.log(`donation + lookback: ${passed} passed`);
