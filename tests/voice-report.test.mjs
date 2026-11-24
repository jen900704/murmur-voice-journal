import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STRINGS } from '../js/i18n.js';
import { FEATURE_VERSION } from '../js/features.js';
import { buildVoiceReportData, buildVoiceReportHtml, selectEntries, usualRange, moodLinks, voiceReportFileNames, REPORT_FEATURES, VOICE_REFERENCES } from '../js/voice-report.js';

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

const DAY = 86400000;
const T0 = new Date(2026, 0, 1, 9, 30).getTime();
function entry(i, f, extra = {}) {
  return {
    id: `e${i}`,
    createdAt: T0 + i * DAY,
    featureVersion: FEATURE_VERSION,
    note: '',
    features: { ok: true, f0MedianHz: 200, f0SdSt: 2, speechRate: 3, pauseRatio: 0.2, periodicityDb: 12, quality: { flags: [] }, ...f },
    ...extra,
  };
}
const en = (entries, o = {}) => buildVoiceReportData(entries, { uiLang: 'en', strings: STRINGS.en, generatedAt: '2026-01-31T00:00:00.000Z', ...o });
const zh = (entries, o = {}) => buildVoiceReportData(entries, { uiLang: 'zh-TW', strings: { ...STRINGS.en, ...STRINGS['zh-TW'] }, generatedAt: '2026-01-31T00:00:00.000Z', ...o });

// Ten recordings. Pitch: 200, 202, ..., 216, then 260.
//   median = (208 + 210) / 2 = 209
//   absolute deviations, sorted: 1 1 3 3 5 5 7 7 9 51 -> median 5 -> scaled MAD = 5 * 1.4826 = 7.413
//   k(10) = 1.96 + 9.5 / 9 = 3.01556
//   band = 209 -/+ 3.01556 * 7.413 = 186.646 to 231.354, so 260 is above and 216 is within
const PITCH = [200, 202, 204, 206, 208, 210, 212, 214, 216, 260];
const ten = PITCH.map((v, i) => entry(i, { f0MedianHz: v, pauseRatio: 0.2 + i * 0.01 }, { note: `secret note ${i}` }));

test('usual range matches the hand computation', () => {
  const r = usualRange(PITCH);
  assert.equal(r.n, 10);
  assert.equal(r.median, 209);
  assert.ok(Math.abs(r.spread - 7.413) < 1e-9);
  assert.ok(Math.abs(r.k - 3.01556) < 1e-5);
  assert.ok(Math.abs(r.low - 186.646) < 1e-3);
  assert.ok(Math.abs(r.high - 231.354) < 1e-3);
  const f = en(ten).features.find((x) => x.key === 'f0MedianHz');
  assert.deepEqual(
    { n: f.usualRange.recordings, median: f.usualRange.median, low: f.usualRange.low, high: f.usualRange.high, k: f.usualRange.k, method: f.usualRange.spreadMethod },
    { n: 10, median: 209, low: 186.6, high: 231.4, k: 3.02, method: 'scaled-mad' }
  );
  assert.equal(f.recent.length, 10);
  assert.equal(f.recent[9].band, 'higher');
  assert.equal(f.recent[8].band, 'usual');
  assert.equal(f.outsideCount, 1);
});

test('pause time is reported in percent, and a constant measure has no band', () => {
  const d = en(ten);
  // 20, 21, ..., 29 percent: median 24.5, deviations .5 .5 1.5 1.5 2.5 2.5 3.5 3.5 4.5 4.5 -> 2.5 -> 3.7065
  const p = d.features.find((x) => x.key === 'pauseRatio');
  assert.equal(p.usualRange.median, 24.5);
  assert.equal(p.usualRange.spread, 3.71);
  assert.equal(p.recent[0].text, '20%');
  const flat = d.features.find((x) => x.key === 'speechRate');
  assert.equal(flat.usualRange.status, 'flat');
  assert.ok(flat.recent.every((r) => r.band === 'none'));
});

test('fewer than ten recordings: the count is stated and nothing is called unusual', () => {
  const d = en(ten.slice(0, 4));
  const f = d.features[0];
  assert.equal(f.usualRange.status, 'need-more');
  assert.equal(f.usualRange.recordings, 4);
  assert.equal(f.usualRange.low, null);
  assert.ok(f.recent.every((r) => r.band === 'none'));
  assert.match(buildVoiceReportHtml(d), /4 of 10/);
});

test('five measures, each with what, how, and the labels the app shows', () => {
  const d = en(ten);
  assert.deepEqual(d.features.map((f) => f.key), REPORT_FEATURES);
  assert.equal(d.features.length, 5);
  for (const f of d.features) {
    assert.equal(f.name, STRINGS.en.feat[f.key][0]);
    assert.equal(f.what, STRINGS.en.feat[f.key][1]);
    assert.equal(f.validation, STRINGS.en.confidenceWhy[f.key]);
    assert.ok(Object.values(STRINGS.en.confidence).includes(f.confidenceLabel));
    assert.ok(f.how.length > 40);
  }
  const how = Object.fromEntries(d.features.map((f) => [f.key, f.how]));
  assert.match(how.f0MedianHz, /YIN/);
  assert.match(how.speechRate, /intensity peaks/);
  assert.match(how.pauseRatio, /250 ms/);
  assert.match(how.periodicityDb, /aperiodicity/);
  const z = zh(ten);
  assert.equal(z.features[0].name, '音高');
  assert.equal(z.features[0].confidenceLabel, '可信度：較高');
  assert.match(z.features[0].how, /YIN/);
});

// Twenty rated recordings, i = 1..20. Pitch movement rises with i; mood = ceil(i / 4), so five
// levels with four ties each. Mood ranks are 4g + 2.5 (g = 0..4), pitch ranks are i.
//   Sxx = (20^3 - 20) / 12 = 665; Syy = 4 * 16 * 10 = 640; Sxy = 640
//   rho = 640 / sqrt(665 * 640) = sqrt(640 / 665) = .98102
//   z = atanh(.98102) = 2.3240; se = sqrt((1 + rho^2 / 2) / 17) = .29518
//   interval = tanh(2.3240 -/+ 1.96 * .29518) = .9409 to .9940
const twenty = Array.from({ length: 20 }, (_, k) => {
  const i = k + 1;
  return entry(i, { f0SdSt: 1 + i * 0.1, pauseRatio: 0.5 - i * 0.01, f0MedianHz: 180 + ((i * 7) % 20) }, { mood: Math.ceil(i / 4), energy: 4 });
});

test('mood links match the hand computation and have no leading zero', () => {
  const d = en(twenty);
  const L = d.moodLinks;
  assert.equal(L.status, 'ok');
  assert.equal(L.recordings, 20);
  assert.equal(L.measuresTested, 5);
  assert.equal(L.intervalMethod, 'fisher-z-bonett-wright');
  const up = L.rows.find((r) => r.key === 'f0SdSt');
  assert.deepEqual({ rho: up.rho, n: up.n, interval: up.interval, zero: up.includesZero }, { rho: '.98', n: 20, interval: ['.94', '.99'], zero: false });
  const down = L.rows.find((r) => r.key === 'pauseRatio');
  assert.deepEqual({ rho: down.rho, interval: down.interval }, { rho: '−.98', interval: ['−.99', '−.94'] });
  // a constant measure is not correlated
  const flat = L.rows.find((r) => r.key === 'speechRate');
  assert.equal(flat.rho, null);
  assert.equal(flat.reason, 'Too little variation to compute');
  for (const r of L.rows) {
    if (r.rho === null) continue;
    for (const s of [r.rho, ...r.interval]) assert.match(s, /^−?(\.\d\d|1\.00)$/, `leading zero in ${s}`);
  }
  const html = buildVoiceReportHtml(d);
  assert.ok(html.includes('<td>.98</td>'));
  assert.ok(html.includes('[.94, .99]'));
  assert.ok(html.includes('<td>−.98</td>'));
  const linksPart = html.slice(html.indexOf('Links with mood'), html.indexOf('<h2>Limits'));
  assert.doesNotMatch(linksPart, /<td>[^<]*\b0\.\d/);
  assert.ok(html.includes('Fisher z'));
  assert.ok(html.includes('Five measures are tested at once'));
  assert.ok(html.includes(STRINGS.en.chanceNote));
  assert.equal(L.chanceNote, STRINGS.en.chanceNote);
  assert.ok(buildVoiceReportHtml(zh(twenty)).includes(STRINGS['zh-TW'].chanceNote));
});

test('links wait for twenty rated recordings, and identical moods give no correlation', () => {
  assert.equal(moodLinks(selectEntries(twenty.slice(0, 19)).used).status, 'need-more');
  const d = en(ten);
  assert.equal(d.moodLinks.status, 'need-more');
  assert.equal(d.moodLinks.recordings, 0);
  assert.match(buildVoiceReportHtml(d), /once 20 usable recordings/);
  const same = moodLinks(twenty.map((e) => ({ ...e, mood: 4 })));
  assert.ok(same.rows.every((r) => r.rho === null));
  assert.equal(same.rows.find((r) => r.key === 'f0SdSt').reason, 'ratingsTooSimilar');
});

test('notes are left out unless asked for, and are escaped when included', () => {
  const withNote = ten.map((e, i) => (i === 9 ? { ...e, note: 'my <b>private</b> note' } : e));
  for (const d of [en(withNote), en(withNote, { includeNotes: 'yes' }), zh(withNote)]) {
    assert.equal(d.privacy.notesIncluded, false);
    const both = JSON.stringify(d) + buildVoiceReportHtml(d);
    assert.ok(!both.includes('secret note'));
    assert.ok(!both.includes('private'));
    assert.ok(d.recordings.recent.every((r) => !('note' in r)));
  }
  const d = en(withNote, { includeNotes: true });
  assert.equal(d.privacy.notesIncluded, true);
  assert.equal(d.recordings.recent[9].note, 'my <b>private</b> note');
  const html = buildVoiceReportHtml(d);
  assert.ok(html.includes('my &lt;b&gt;private&lt;/b&gt; note'));
  assert.ok(!html.includes('<b>private'));
});

test('no audio, contour, or script in either file', () => {
  const rich = ten.map((e) => ({ ...e, hasAudio: true, audio: 'AUDIOBYTES', features: { ...e.features, contour: [{ f0: 123.456, e: 1 }] } }));
  const d = en(rich, { includeNotes: true });
  const json = JSON.stringify(d);
  const html = buildVoiceReportHtml(d);
  assert.equal(d.privacy.audioIncluded, false);
  for (const s of [json, html]) {
    assert.ok(!s.includes('AUDIOBYTES'));
    assert.ok(!s.includes('contour'));
    assert.ok(!s.includes('123.456'));
  }
  assert.doesNotMatch(html, /<script|<link|<img|src=|https?:\/\//);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<style>/);
});

test('demo data alone gives a report labeled synthetic; real recordings push demo out', () => {
  const demo = ten.map((e) => ({ ...e, id: 'demo-' + e.id, demo: true }));
  const d = en(demo);
  assert.equal(d.synthetic, true);
  assert.equal(d.recordings.kind, 'synthetic-demo');
  assert.match(d.syntheticNotice, /SYNTHETIC DEMO DATA/);
  const html = buildVoiceReportHtml(d);
  assert.ok(html.indexOf('SYNTHETIC DEMO DATA') < html.indexOf('<h2>'));
  assert.match(html, /10 synthetic demo entries/);
  assert.match(buildVoiceReportHtml(zh(demo)), /合成的示範資料/);
  assert.equal(voiceReportFileNames('2026-01-31', true).html, 'murmur-voice-report-demo-2026-01-31.html');
  assert.equal(voiceReportFileNames('2026-01-31', false).json, 'murmur-voice-report-2026-01-31.json');

  const mixed = en([...demo, entry(50, { f0MedianHz: 150 })]);
  assert.equal(mixed.synthetic, false);
  assert.equal(mixed.syntheticNotice, null);
  assert.equal(mixed.recordings.used, 1);
  assert.equal(mixed.recordings.demoLeftOut, 10);
  assert.equal(mixed.features[0].usualRange.recordings, 1);
  assert.ok(!buildVoiceReportHtml(mixed).includes('SYNTHETIC'));
});

test('quality-flagged and older-version recordings are left out and listed', () => {
  const loud = entry(20, { f0MedianHz: 999, quality: { flags: ['clipping', 'noisy'] } });
  const old = { ...entry(21, { f0MedianHz: 999 }), featureVersion: FEATURE_VERSION - 1 };
  const silent = { id: 's', createdAt: T0 + 30 * DAY, mood: 3, featureVersion: 0 };
  const d = en([...ten, loud, old, silent]);
  assert.equal(d.recordings.used, 10);
  assert.equal(d.features[0].usualRange.recordings, 10);
  assert.equal(d.features[0].usualRange.median, 209);
  assert.deepEqual(d.recordings.qualityLeftOut.map((q) => q.flags), [['clipping', 'noisy']]);
  assert.equal(d.recordings.qualityLeftOut[0].text, `${STRINGS.en.quality_clipping} ${STRINGS.en.quality_noisy}`);
  assert.equal(d.recordings.olderVersionLeftOut, 1);
  const html = buildVoiceReportHtml(d);
  assert.ok(html.includes(STRINGS.en.quality_clipping));
  assert.ok(!html.includes('999'));
  assert.ok(buildVoiceReportHtml(en(ten)).includes('No recording was left out for quality.'));
});

test('limits and references are present, in both languages, without em dashes', () => {
  for (const d of [en(twenty), zh(twenty)]) {
    const html = buildVoiceReportHtml(d);
    assert.deepEqual(d.references, VOICE_REFERENCES);
    for (const ref of VOICE_REFERENCES) assert.ok(html.includes(ref.replace(/&/g, '&amp;')));
    assert.ok(!html.includes('—'));
    assert.ok(!JSON.stringify(d).includes('—'));
    assert.doesNotMatch(html, /undefined|NaN|\[object/);
  }
  const text = readFileSync(new URL('../README.md', import.meta.url), 'utf8').replace(/\*/g, '');
  for (const ref of VOICE_REFERENCES) assert.ok(text.includes(ref), ref);
  const limits = en(ten).limits.join(' ');
  for (const w of [/not a diagnosis/, /Phone microphones/, /tone languages/, /cold/]) assert.match(limits, w);
  const zhLimits = zh(ten).limits.join(' ');
  for (const w of [/不是診斷/, /手機麥克風/, /聲調/, /感冒/]) assert.match(zhLimits, w);
});

console.log(`\n${passed} passed`);
