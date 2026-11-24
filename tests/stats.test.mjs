import assert from 'node:assert/strict';
import { spearman, personalBaseline, fmtR, mad } from '../js/stats.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('ok   ', name);
  } catch (e) {
    console.log('FAIL ', name, '\n     ', e.message);
    process.exitCode = 1;
  }
}

test('spearman is 1 for monotone data', () => {
  const r = spearman([1, 2, 3, 4, 5, 6], [10, 20, 25, 70, 80, 200]);
  assert.ok(Math.abs(r.r - 1) < 1e-9);
});

test('spearman is -1 for reversed data', () => {
  const r = spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]);
  assert.ok(Math.abs(r.r + 1) < 1e-9);
});

test('spearman handles ties (matches scipy)', () => {
  // scipy.stats.spearmanr([1,2,2,3,4,5],[2,1,3,3,5,4]).statistic = 0.80882...
  const r = spearman([1, 2, 2, 3, 4, 5], [2, 1, 3, 3, 5, 4]);
  assert.ok(Math.abs(r.r - 0.80882353) < 1e-4, `got ${r.r}`);
});

test('spearman skips missing values', () => {
  const r = spearman([1, 2, NaN, 4, 5, 6], [1, 2, 3, null, 5, 6]);
  assert.equal(r.n, 4);
});

test('interval contains r and is within [-1, 1]', () => {
  const r = spearman([1, 3, 2, 5, 4, 7, 6, 9, 8, 10], [2, 1, 4, 3, 6, 5, 8, 7, 10, 9]);
  assert.ok(r.lo < r.r && r.r < r.hi && r.lo >= -1 && r.hi <= 1);
});

test('baseline needs enough history', () => {
  assert.equal(personalBaseline([1, 2, 3], 4), null);
});

test('baseline bands use 2 scaled MADs and need 10 entries', () => {
  const h = [100, 102, 98, 101, 99, 100, 103, 97, 100, 101, 99, 100];
  assert.equal(personalBaseline(h.slice(0, 9), 100), null);
  assert.equal(personalBaseline(h, 100).band, 'usual');
  assert.equal(personalBaseline(h, 102.5).band, 'usual');
  assert.equal(personalBaseline(h, 110).band, 'higher');
  assert.equal(personalBaseline(h, 90).band, 'lower');
});

test('about 5% of draws from the same distribution are flagged', () => {
  let seed = 1;
  const randn = () => {
    let u = 0;
    for (let i = 0; i < 12; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      u += seed / 4294967296;
    }
    return u - 6;
  };
  const hist = Array.from({ length: 200 }, randn);
  let flagged = 0;
  for (let i = 0; i < 2000; i++) if (personalBaseline(hist, randn()).band !== 'usual') flagged++;
  assert.ok(flagged / 2000 > 0.02 && flagged / 2000 < 0.09, `flagged ${flagged / 2000}`);
});

test('MAD of normal-ish data is near SD', () => {
  assert.ok(Math.abs(mad([1, 2, 3, 4, 5, 6, 7, 8, 9]) - 2.9652) < 1e-3);
});

test('correlations print without a leading zero', () => {
  assert.equal(fmtR(0.4249), '.42');
  assert.equal(fmtR(-0.17), '−.17');
  assert.equal(fmtR(1), '1.00');
  assert.equal(fmtR(-0.001), '.00');
});

console.log(`\n${passed} passed`);
