// Small statistics helpers for personal baselines and self-report links.
import { median } from './features.js';

// Median absolute deviation, scaled to be comparable with SD under normality.
export function mad(arr) {
  if (arr.length < 2) return NaN;
  const m = median(arr);
  return 1.4826 * median(arr.map((v) => Math.abs(v - m)));
}

// How many scaled MADs from the median count as unusual, given n earlier values.
// With few values the median and MAD are themselves uncertain, so the cut-off widens.
// Calibrated by simulation on normal data so that about 5% of new values are flagged
// when nothing has changed (n = 10: 3.02, 20: 2.42, 30: 2.26, 100: 2.04).
export function baselineK(n) {
  return 1.96 + 9.5 / (n - 1);
}

// Compare a value to the person's own earlier history. Needs at least `minN` entries.
// Returns { n, median, spread, z, k, band } where band is 'higher' | 'lower' | 'usual'.
export function personalBaseline(history, value, minN = 10, kOverride) {
  const vals = history.filter((v) => Number.isFinite(v));
  if (vals.length < minN || !Number.isFinite(value)) return null;
  const m = median(vals);
  let spread = mad(vals);
  if (!(spread > 0)) {
    // fall back to SD when more than half the values are identical
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    spread = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1));
  }
  if (!(spread > 0)) return { n: vals.length, median: m, spread: 0, z: 0, band: 'usual' };
  const k = kOverride ?? baselineK(vals.length);
  const z = (value - m) / spread;
  const band = z > k ? 'higher' : z < -k ? 'lower' : 'usual';
  return { n: vals.length, median: m, spread, z, k, band };
}

function ranks(arr) {
  const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(arr.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

function pearson(x, y) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return NaN;
  return sxy / Math.sqrt(sxx * syy);
}

// Spearman rank correlation with an approximate 95% interval (Fisher z,
// with the Bonett & Wright 2000 variance adjustment for Spearman).
export function spearman(x, y) {
  const pairs = [];
  for (let i = 0; i < x.length; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) pairs.push([x[i], y[i]]);
  }
  const n = pairs.length;
  if (n < 4) return { n, r: NaN, lo: NaN, hi: NaN };
  const r = pearson(ranks(pairs.map((p) => p[0])), ranks(pairs.map((p) => p[1])));
  if (!Number.isFinite(r)) return { n, r: NaN, lo: NaN, hi: NaN };
  const rc = Math.max(-0.9999, Math.min(0.9999, r));
  const z = Math.atanh(rc);
  const se = Math.sqrt((1 + (rc * rc) / 2) / (n - 3));
  return { n, r, lo: Math.tanh(z - 1.96 * se), hi: Math.tanh(z + 1.96 * se) };
}

// Number of distinct finite values.
export function distinctCount(arr) {
  return new Set(arr.filter(Number.isFinite).map((v) => v.toFixed(4))).size;
}

// Format a correlation without a leading zero: .42, -.17
export function fmtR(r) {
  if (!Number.isFinite(r)) return '–';
  const s = Math.abs(r).toFixed(2).replace(/^0/, '');
  return (r < 0 && s !== '.00' ? '−' : '') + s;
}
