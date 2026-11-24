// Murmur: on-device prosodic feature extraction.
// Pure functions, no DOM. Runs in a Web Worker, on the main thread, or in Node for tests.
//
// Input: mono Float32Array at a known sample rate (the app resamples to 16 kHz).
// Output: a small set of descriptors, recording-quality fields, and a downsampled
// pitch contour for drawing.
//
// Methods are deliberately simple and documented so that every number can be explained:
//   - Pre-processing: first-order high-pass at about 50 Hz to remove DC offset and rumble.
//   - Frame energy: RMS in dB, 25 ms window, 10 ms hop.
//   - Speech activity: adaptive energy threshold between the noise floor and the peak.
//   - F0: YIN (de Cheveigné & Kawahara, 2002) with parabolic interpolation.
//   - Periodicity: 10*log10((1 - a) / a) from the YIN aperiodicity a, on all speech frames.
//   - Syllable nuclei: intensity peaks in voiced speech that rise at least 2 dB above
//     the dip before them (after de Jong & Wempe, 2009).

export const FEATURE_VERSION = 2;

export const DEFAULTS = {
  frameMs: 25,
  hopMs: 10,
  f0Min: 70,
  f0Max: 500,
  yinThreshold: 0.15,
  highPassHz: 50,
  minPauseMs: 250,
  minSpeechMs: 60,
  nucleusDipDb: 2,
  nucleusMinGapMs: 80,
  minVoicedFrames: 50,
  minVoicedFraction: 0.2,
  octaveWindowFrames: 15,
  clipLevel: 0.99,
  clipFlagFraction: 0.01,
  lowSnrDb: 15,
};

export function quantile(arr, q) {
  if (!arr.length) return NaN;
  const a = Float64Array.from(arr).sort();
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

export function median(arr) {
  return quantile(arr, 0.5);
}

function mean(arr) {
  if (!arr.length) return NaN;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

function sd(arr) {
  if (arr.length < 2) return NaN;
  const m = mean(arr);
  let s = 0;
  for (const v of arr) s += (v - m) * (v - m);
  return Math.sqrt(s / (arr.length - 1));
}

function movingAverage(arr, k) {
  const out = new Float64Array(arr.length);
  const h = Math.floor(k / 2);
  for (let i = 0; i < arr.length; i++) {
    let s = 0;
    let n = 0;
    for (let j = i - h; j <= i + h; j++) {
      if (j >= 0 && j < arr.length) {
        s += arr[j];
        n++;
      }
    }
    out[i] = s / n;
  }
  return out;
}

// One-pole high-pass filter. Removes DC offset and low rumble.
export function highPass(x, sr, cutoffHz) {
  const out = new Float32Array(x.length);
  const r = Math.exp((-2 * Math.PI * cutoffHz) / sr);
  let prevX = 0;
  let prevY = 0;
  // start from the first sample's level so a DC offset does not produce a click
  if (x.length) prevX = x[0];
  for (let i = 0; i < x.length; i++) {
    const y = x[i] - prevX + r * prevY;
    out[i] = y;
    prevX = x[i];
    prevY = y;
  }
  return out;
}

function rmsDb(x, start, len) {
  let s = 0;
  const end = Math.min(x.length, start + len);
  for (let i = start; i < end; i++) s += x[i] * x[i];
  const n = Math.max(1, end - start);
  return 10 * Math.log10(s / n + 1e-12);
}

// YIN for one frame.
// Returns { f0, aperiodicity }; f0 is null when the frame is not voiced within range.
// aperiodicity is the lowest normalized difference within the search range, and is
// reported for every frame so periodicity can be summarized over all speech, not only
// over frames that passed the voicing threshold.
export function yinFrame(x, start, W, sr, f0Min, f0Max, threshold) {
  const tauMin = Math.max(2, Math.floor(sr / f0Max));
  const tauMax = Math.min(Math.floor(sr / f0Min), x.length - start - W - 1);
  if (tauMax <= tauMin + 2) return null;
  const cmnd = new Float64Array(tauMax + 2);
  const d = new Float64Array(tauMax + 2);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) {
      const diff = x[start + j] - x[start + j + tau];
      s += diff * diff;
    }
    d[tau] = s;
    running += s;
    cmnd[tau] = running > 0 ? (s * tau) / running : 1;
  }
  let aperiodicity = 1;
  for (let tau = tauMin; tau <= tauMax; tau++) aperiodicity = Math.min(aperiodicity, cmnd[tau]);
  aperiodicity = Math.max(1e-4, aperiodicity);

  // Search from the smallest lags so that a pitch above f0Max is recognised as such
  // instead of being reported at a subharmonic inside the range.
  let tauEst = -1;
  for (let tau = 2; tau <= tauMax; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEst = tau;
      break;
    }
  }
  if (tauEst < tauMin) return { f0: null, aperiodicity };
  // still falling at the upper edge: the true period is longer than f0Min allows
  if (tauEst === tauMax && cmnd[tauMax + 1] < cmnd[tauMax]) return { f0: null, aperiodicity };

  // parabolic interpolation on the raw difference function
  const a = d[tauEst - 1];
  const b = d[tauEst];
  const c = d[tauEst + 1];
  const denom = a - 2 * b + c;
  const shift = denom > 0 ? (0.5 * (a - c)) / denom : 0;
  const tauRefined = tauEst + (Math.abs(shift) < 1 ? shift : 0);
  return { f0: sr / tauRefined, aperiodicity };
}

function medianFilter(values, voiced, k) {
  const out = values.slice();
  const h = Math.floor(k / 2);
  for (let i = 0; i < values.length; i++) {
    if (!voiced[i]) continue;
    const win = [];
    for (let j = i - h; j <= i + h; j++) {
      if (j >= 0 && j < values.length && voiced[j]) win.push(values[j]);
    }
    out[i] = median(win);
  }
  return out;
}

// Turn a boolean frame mask into [startFrame, endFrame) runs.
function runs(mask, value) {
  const out = [];
  let i = 0;
  while (i < mask.length) {
    if (mask[i] === value) {
      const s = i;
      while (i < mask.length && mask[i] === value) i++;
      out.push([s, i]);
    } else i++;
  }
  return out;
}

const round = (v, d = 2) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

export function analyze(input, sampleRate, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const sr = sampleRate;
  const hop = Math.round((o.hopMs / 1000) * sr);
  const win = Math.round((o.frameMs / 1000) * sr);
  const durationS = input.length / sr;
  const nFrames = Math.max(0, Math.floor((input.length - win) / hop) + 1);

  // recording quality, measured before filtering
  let clipped = 0;
  for (let i = 0; i < input.length; i++) if (Math.abs(input[i]) >= o.clipLevel) clipped++;
  const clipFraction = input.length ? clipped / input.length : 0;

  const fail = (reason, extra = {}) => ({
    version: FEATURE_VERSION,
    ok: false,
    reason,
    durationS: round(durationS, 2),
    ...extra,
  });
  if (nFrames < 30) return fail('too_short');

  const samples = highPass(input, sr, o.highPassHz);

  // 1. frame energy
  const energy = new Float64Array(nFrames);
  for (let f = 0; f < nFrames; f++) energy[f] = rmsDb(samples, f * hop, win);
  const smoothE = movingAverage(energy, 5);

  // 2. speech activity: threshold between noise floor and peak
  const floor = quantile(smoothE, 0.05);
  const peak = quantile(smoothE, 0.99);
  const dynamicRange = peak - floor;
  if (peak < -60 || dynamicRange < 6) return fail('no_speech');
  const thr = Math.max(floor + 0.35 * dynamicRange, peak - 35);
  const speech = Array.from(smoothE, (e) => e > thr);

  // remove tiny speech blips
  const minSpeechF = Math.round(o.minSpeechMs / o.hopMs);
  for (const [s, e] of runs(speech, true)) {
    if (e - s < minSpeechF) for (let i = s; i < e; i++) speech[i] = false;
  }
  const firstSpeech = speech.indexOf(true);
  const lastSpeech = speech.lastIndexOf(true);
  if (firstSpeech < 0) return fail('no_speech');

  // `speech` stays as measured; `spoken` fills gaps shorter than a pause, and is used
  // only to decide where pauses are and where syllables are searched.
  const minPauseF = Math.round(o.minPauseMs / o.hopMs);
  const spoken = speech.slice();
  for (const [s, e] of runs(spoken, false)) {
    if (s > firstSpeech && e <= lastSpeech && e - s < minPauseF) {
      for (let i = s; i < e; i++) spoken[i] = true;
    }
  }

  // 3. pitch (YIN) on speech frames; 20 ms analysis window
  const yinW = Math.round(0.02 * sr);
  const f0 = new Float64Array(nFrames);
  const ap = new Float64Array(nFrames).fill(NaN);
  const voiced = new Array(nFrames).fill(false);
  for (let f = 0; f < nFrames; f++) {
    if (!speech[f]) continue;
    const r = yinFrame(samples, f * hop, yinW, sr, o.f0Min, o.f0Max, o.yinThreshold);
    if (!r) continue;
    ap[f] = r.aperiodicity;
    if (r.f0) {
      f0[f] = r.f0;
      voiced[f] = true;
    }
  }
  // drop isolated voiced frames (likely noise) and smooth
  for (let f = 0; f < nFrames; f++) {
    if (!voiced[f]) continue;
    const prev = f > 0 && voiced[f - 1];
    const next = f < nFrames - 1 && voiced[f + 1];
    if (!prev && !next) voiced[f] = false;
  }
  const f0s = medianFilter(f0, voiced, 5);
  // Octave errors: compare each frame with the median of its neighbourhood (about
  // 300 ms), not with the whole recording, so that real wide excursions survive.
  const keep = voiced.slice();
  const hw = o.octaveWindowFrames;
  for (let f = 0; f < nFrames; f++) {
    if (!voiced[f]) continue;
    const local = [];
    for (let j = Math.max(0, f - hw); j <= Math.min(nFrames - 1, f + hw); j++) if (voiced[j]) local.push(f0s[j]);
    if (local.length < 5) continue;
    const ratio = f0s[f] / median(local);
    if (ratio > 1.8 || ratio < 1 / 1.8) keep[f] = false;
  }
  for (let f = 0; f < nFrames; f++) voiced[f] = keep[f];

  const speechFrames = speech.reduce((n, v) => n + (v ? 1 : 0), 0);
  const f0Hz = [];
  for (let f = 0; f < nFrames; f++) if (voiced[f]) f0Hz.push(f0s[f]);
  const voicedFraction = f0Hz.length / Math.max(speechFrames, 1);

  // recording-quality fields (kept on failures too, for the error message)
  const speechE = [];
  for (let f = 0; f < nFrames; f++) if (speech[f]) speechE.push(energy[f]);
  const snrDb = median(speechE) - floor;
  const quality = {
    clipFraction: round(clipFraction, 4),
    noiseFloorDb: round(floor, 1),
    snrDb: round(snrDb, 1),
    flags: [],
  };
  if (clipFraction > o.clipFlagFraction) quality.flags.push('clipping');
  // With almost no silence, the "noise floor" is really quiet speech, so the SNR estimate
  // means little; do not call such a recording noisy.
  if (snrDb < o.lowSnrDb && speechFrames / Math.max(nFrames, 1) < 0.9) quality.flags.push('noisy');

  // speech must actually contain voicing; noise or breath alone does not count
  if (f0Hz.length < o.minVoicedFrames || voicedFraction < o.minVoicedFraction) {
    return fail('no_speech', { quality });
  }

  // 4. pauses inside the utterance span
  const pauses = [];
  for (const [s, e] of runs(spoken, false)) {
    if (s > firstSpeech && e <= lastSpeech) pauses.push(((e - s) * o.hopMs) / 1000);
  }
  const speechS = (speechFrames * o.hopMs) / 1000;
  const pauseS = pauses.reduce((a, b) => a + b, 0);
  const spanS = ((lastSpeech - firstSpeech + 1) * o.hopMs) / 1000;

  // 5. syllable nuclei: intensity peaks in voiced frames with a dip of >= 2 dB before them,
  //    at least 80 ms apart
  const intens = movingAverage(energy, 3);
  const nucleusFloor = median(speechE) - 6;
  const minGapF = Math.round(o.nucleusMinGapMs / o.hopMs);
  let nuclei = 0;
  for (const [s, e] of runs(spoken, true)) {
    let dip = Infinity;
    let lastNucleus = -Infinity;
    let first = true;
    for (let f = s + 1; f < e - 1; f++) {
      dip = Math.min(dip, intens[f]);
      const isPeak = intens[f] >= intens[f - 1] && intens[f] > intens[f + 1];
      const nearVoiced = voiced[f] || voiced[f - 1] || voiced[f + 1] || (f > 1 && voiced[f - 2]) || voiced[f + 2];
      if (!isPeak || !nearVoiced || intens[f] < nucleusFloor) continue;
      if (f - lastNucleus < minGapF) continue;
      // the first peak in a stretch of speech needs no dip before it
      if (first || intens[f] - dip >= o.nucleusDipDb) {
        nuclei++;
        lastNucleus = f;
        dip = Infinity;
        first = false;
      }
    }
  }

  // 6. periodicity over all speech frames (voiced or not)
  const apAll = [];
  for (let f = 0; f < nFrames; f++) if (speech[f] && Number.isFinite(ap[f])) apAll.push(ap[f]);
  const periodicity = apAll.map((a) => {
    const c = Math.min(0.999, Math.max(0.001, a));
    return 10 * Math.log10((1 - c) / c);
  });

  const st = f0Hz.map((h) => 12 * Math.log2(h));

  // 7. downsampled contour for the drawing: 64 points, null where unvoiced
  const contour = [];
  const span = lastSpeech - firstSpeech + 1;
  const points = 64;
  for (let i = 0; i < points; i++) {
    const a = firstSpeech + Math.floor((i * span) / points);
    const b = Math.max(firstSpeech + Math.floor(((i + 1) * span) / points), a + 1);
    const vals = [];
    let eSum = 0;
    for (let f = a; f < b; f++) {
      if (voiced[f]) vals.push(f0s[f]);
      eSum += energy[f] - floor;
    }
    contour.push({
      f0: vals.length ? Math.round(median(vals) * 10) / 10 : null,
      e: Math.round((eSum / (b - a)) * 10) / 10,
    });
  }

  return {
    version: FEATURE_VERSION,
    ok: true,
    durationS: round(durationS, 2),
    speechS: round(speechS, 2),
    spanS: round(spanS, 2),
    pauseCount: pauses.length,
    pauseRatio: round(pauseS / Math.max(spanS, 1e-6), 3),
    meanPauseS: round(pauses.length ? mean(pauses) : 0, 2),
    syllables: nuclei,
    speechRate: round(nuclei / Math.max(spanS, 1e-6), 2),
    articulationRate: round(nuclei / Math.max(spanS - pauseS, 1e-6), 2),
    voicedFraction: round(voicedFraction, 3),
    f0MedianHz: round(median(f0Hz), 1),
    f0SdSt: round(sd(st), 2),
    f0RangeSt: round(quantile(st, 0.95) - quantile(st, 0.05), 2),
    intensitySdDb: round(sd(speechE), 2),
    periodicityDb: round(median(periodicity), 1),
    quality,
    contour,
    // frame-level output for validation scripts only (not stored by the app)
    ...(o.returnFrames
      ? {
          frames: {
            hopS: o.hopMs / 1000,
            f0: Array.from(f0s, (v, f) => (voiced[f] ? Math.round(v * 100) / 100 : null)),
            firstSpeech,
            lastSpeech,
          },
        }
      : {}),
  };
}

// Feature metadata used by the UI and exports. `confidence` summarizes the evidence in
// docs/validation-results.md and docs/robustness-results.md.
export const FEATURE_INFO = [
  { key: 'f0MedianHz', unit: 'Hz', digits: 0, minSpan: 20, confidence: 'high' },
  { key: 'f0SdSt', unit: 'st', digits: 1, minSpan: 1, confidence: 'medium' },
  { key: 'f0RangeSt', unit: 'st', digits: 1, minSpan: 2, confidence: 'low' },
  { key: 'speechRate', unit: '/s', digits: 1, minSpan: 1, confidence: 'low' },
  { key: 'articulationRate', unit: '/s', digits: 1, minSpan: 1, confidence: 'low' },
  { key: 'pauseRatio', unit: '%', digits: 0, scale: 100, minSpan: 10, confidence: 'medium' },
  { key: 'meanPauseS', unit: 's', digits: 2, minSpan: 0.2, confidence: 'medium' },
  { key: 'intensitySdDb', unit: 'dB', digits: 1, minSpan: 2, confidence: 'low' },
  { key: 'periodicityDb', unit: 'dB', digits: 1, minSpan: 2, confidence: 'medium' },
];
