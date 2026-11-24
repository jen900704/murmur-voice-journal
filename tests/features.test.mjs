// Run with: node tests/features.test.mjs
import { analyze, yinFrame } from '../js/features.js';
import assert from 'node:assert/strict';

const SR = 16000;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  };
}

function harmonicTone(f0, n, amp = 0.3) {
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    phase += (2 * Math.PI * f0) / SR;
    out[i] = amp * (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase));
  }
  return out;
}

// Build speech-like audio: groups of syllables separated by pauses.
function syntheticSpeech({ f0 = 200, syllablesPerGroup = 5, groups = 4, sylMs = 160, gapMs = 60, pauseMs = 600, noise = 0.002, seed = 1, f0Jitter = 0 }) {
  const r = rng(seed);
  const parts = [];
  const silence = (ms) => new Float32Array(Math.round((ms / 1000) * SR));
  parts.push(silence(400));
  let total = 0;
  for (let g = 0; g < groups; g++) {
    for (let s = 0; s < syllablesPerGroup; s++) {
      const n = Math.round((sylMs / 1000) * SR);
      const thisF0 = f0 * (1 + f0Jitter * Math.sin(g * 1.7 + s));
      const tone = harmonicTone(thisF0, n);
      for (let i = 0; i < n; i++) tone[i] *= Math.sin((Math.PI * i) / n); // envelope
      parts.push(tone);
      total++;
      if (s < syllablesPerGroup - 1) parts.push(silence(gapMs));
    }
    if (g < groups - 1) parts.push(silence(pauseMs));
  }
  parts.push(silence(400));
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Float32Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  for (let i = 0; i < len; i++) out[i] += noise * r();
  return { samples: out, syllables: total };
}

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

test('YIN finds 200 Hz on a clean harmonic tone', () => {
  const x = harmonicTone(200, 2000);
  const r = yinFrame(x, 0, 320, SR, 70, 500, 0.15);
  assert.ok(r, 'voiced');
  assert.ok(Math.abs(r.f0 - 200) < 2, `got ${r.f0}`);
});

for (const f of [90, 120, 180, 260, 380]) {
  test(`YIN finds ${f} Hz`, () => {
    const x = harmonicTone(f, 3000);
    const r = yinFrame(x, 100, 320, SR, 70, 500, 0.15);
    assert.ok(r && Math.abs(r.f0 - f) / f < 0.02, `got ${r && r.f0}`);
  });
}

test('silence is reported as no speech', () => {
  const x = new Float32Array(SR * 3);
  const r = analyze(x, SR);
  assert.equal(r.ok, false);
});

test('too-short input is rejected', () => {
  const r = analyze(new Float32Array(1000), SR);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'too_short');
});

test('speech-like signal: pitch, pauses, syllables', () => {
  const { samples, syllables } = syntheticSpeech({ f0: 200 });
  const r = analyze(samples, SR);
  assert.ok(r.ok);
  assert.ok(Math.abs(r.f0MedianHz - 200) < 5, `f0 ${r.f0MedianHz}`);
  assert.equal(r.pauseCount, 3, `pauses ${r.pauseCount}`);
  assert.ok(Math.abs(r.meanPauseS - 0.6) < 0.15, `mean pause ${r.meanPauseS}`);
  assert.ok(Math.abs(r.syllables - syllables) <= 2, `syllables ${r.syllables} vs ${syllables}`);
  assert.ok(r.f0SdSt < 0.5, `sd ${r.f0SdSt}`);
  assert.equal(r.contour.length, 64);
});

test('faster speech gives higher articulation rate', () => {
  const slow = analyze(syntheticSpeech({ sylMs: 220, gapMs: 80 }).samples, SR);
  const fast = analyze(syntheticSpeech({ sylMs: 120, gapMs: 40 }).samples, SR);
  assert.ok(fast.articulationRate > slow.articulationRate * 1.3, `${fast.articulationRate} vs ${slow.articulationRate}`);
});

test('more pausing gives higher pause ratio', () => {
  const a = analyze(syntheticSpeech({ pauseMs: 300 }).samples, SR);
  const b = analyze(syntheticSpeech({ pauseMs: 1200 }).samples, SR);
  assert.ok(b.pauseRatio > a.pauseRatio + 0.1, `${b.pauseRatio} vs ${a.pauseRatio}`);
});

test('more pitch movement gives larger F0 SD and range', () => {
  const flat = analyze(syntheticSpeech({ f0Jitter: 0 }).samples, SR);
  const lively = analyze(syntheticSpeech({ f0Jitter: 0.25 }).samples, SR);
  assert.ok(lively.f0SdSt > flat.f0SdSt + 1, `${lively.f0SdSt} vs ${flat.f0SdSt}`);
  assert.ok(lively.f0RangeSt > flat.f0RangeSt + 3);
});

test('low voice is tracked (100 Hz)', () => {
  const r = analyze(syntheticSpeech({ f0: 100 }).samples, SR);
  assert.ok(Math.abs(r.f0MedianHz - 100) < 4, `f0 ${r.f0MedianHz}`);
});

test('moderate background noise does not break it', () => {
  const r = analyze(syntheticSpeech({ noise: 0.02, seed: 7 }).samples, SR);
  assert.ok(r.ok);
  assert.ok(Math.abs(r.f0MedianHz - 200) < 8, `f0 ${r.f0MedianHz}`);
  assert.ok(r.pauseCount >= 2 && r.pauseCount <= 4, `pauses ${r.pauseCount}`);
});

test('30 s input runs fast enough', () => {
  const parts = [];
  for (let i = 0; i < 6; i++) parts.push(syntheticSpeech({ seed: i, f0Jitter: 0.1 }).samples);
  const len = parts.reduce((a, p) => a + p.length, 0);
  const x = new Float32Array(len);
  let o = 0;
  for (const p of parts) { x.set(p, o); o += p.length; }
  const t0 = performance.now();
  const r = analyze(x, SR);
  const ms = performance.now() - t0;
  console.log(`      ${(len / SR).toFixed(1)} s audio analyzed in ${ms.toFixed(0)} ms`);
  assert.ok(r.ok);
  assert.ok(ms < 3000);
});

// ---- regression tests from the review ----

function gatedNoise(seconds, seed = 11) {
  const r = rng(seed);
  const x = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < x.length; i++) {
    const on = Math.floor(i / (0.4 * SR)) % 2 === 0;
    x[i] = (on ? 0.3 : 0.003) * r();
  }
  return x;
}

test('noise-only audio is rejected as no speech', () => {
  const r = analyze(gatedNoise(10), SR);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_speech');
});

test('a DC offset does not hide speech', () => {
  const { samples } = syntheticSpeech({});
  for (let i = 0; i < samples.length; i++) samples[i] += 0.2;
  const r = analyze(samples, SR);
  assert.ok(r.ok, r.reason);
  assert.ok(Math.abs(r.f0MedianHz - 200) < 5, `f0 ${r.f0MedianHz}`);
});

test('a tone above the search range is not reported at a subharmonic', () => {
  const x = harmonicTone(600, 3000);
  const r = yinFrame(x, 100, 320, SR, 70, 500, 0.15);
  assert.ok(!r || r.f0 === null, `got ${r && r.f0}`);
});

test('wide but real pitch excursions survive the octave-error filter', () => {
  const a = syntheticSpeech({ f0: 100, groups: 3, seed: 2 }).samples;
  const b = syntheticSpeech({ f0: 220, groups: 3, seed: 3 }).samples;
  const x = new Float32Array(a.length + b.length);
  x.set(a, 0);
  x.set(b, a.length);
  const r = analyze(x, SR);
  assert.ok(r.ok);
  assert.ok(r.f0RangeSt > 11, `range ${r.f0RangeSt} st (true about 13.6)`);
});

test('periodicity falls as noise rises', () => {
  const vals = [0.002, 0.04, 0.09].map((noise) => analyze(syntheticSpeech({ noise, seed: 5 }).samples, SR).periodicityDb);
  assert.ok(vals[0] > vals[1] && vals[1] > vals[2], vals.join(' > '));
});

test('periodicity falls as the voice gets breathier', () => {
  const vals = [0, 0.1, 0.25].map((b) => {
    const { samples } = syntheticSpeech({ seed: 5 });
    const r = rng(42);
    // add noise only where the voice is sounding
    for (let i = 0; i < samples.length; i++) samples[i] += b * Math.abs(samples[i]) * 4 * r();
    return analyze(samples, SR).periodicityDb;
  });
  assert.ok(vals[0] > vals[1] && vals[1] > vals[2], vals.join(' > '));
});

test('clipping is flagged', () => {
  const { samples } = syntheticSpeech({});
  for (let i = 0; i < samples.length; i++) samples[i] = Math.max(-1, Math.min(1, samples[i] * 6));
  const r = analyze(samples, SR);
  assert.ok(r.quality.flags.includes('clipping'), JSON.stringify(r.quality));
});

test('clean recording has no quality flags', () => {
  const r = analyze(syntheticSpeech({}).samples, SR);
  assert.deepEqual(r.quality.flags, []);
});

test('very noisy recording is flagged noisy', () => {
  const r = analyze(syntheticSpeech({ noise: 0.12, seed: 9 }).samples, SR);
  assert.ok(!r.ok || r.quality.flags.includes('noisy'), JSON.stringify(r.quality));
});

console.log(`\n${passed} passed`);
