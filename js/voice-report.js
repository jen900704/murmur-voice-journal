// The voice evidence report: one self-contained HTML page (inline styles, no scripts) and one
// JSON file with the same content. Both are made on the device from the entries already stored
// there. They hold, for each of the five measures on the result screen: what it is, how it is
// computed, how far it can be trusted, the person's usual range, the last recordings, and the
// links with mood. They never hold audio, and hold notes only when the person asks for them.
//
// Everything here is a pure function of its arguments, so it runs in Node for the unit tests.

import { FEATURE_INFO, FEATURE_VERSION, median } from './features.js';
import { mad, baselineK, spearman, distinctCount, fmtR } from './stats.js';

// The five measures on the result screen, in the same order.
export const REPORT_FEATURES = ['f0MedianHz', 'f0SdSt', 'speechRate', 'pauseRatio', 'periodicityDb'];

// The same thresholds as the app's own screens.
export const BASELINE_MIN = 10;
export const LINKS_MIN = 20;
export const MIN_DISTINCT = 5;
export const MIN_DISTINCT_RATINGS = 3;
export const RECENT_N = 10;

// Exactly as in README.md.
export const VOICE_REFERENCES = [
  'de Cheveigné, A., & Kawahara, H. (2002). YIN, a fundamental frequency estimator for speech and music. The Journal of the Acoustical Society of America, 111(4), 1917–1930.',
  'de Jong, N. H., & Wempe, T. (2009). Praat script to detect syllable nuclei and measure speech rate automatically. Behavior Research Methods, 41(2), 385–390.',
  'Bonett, D. G., & Wright, T. A. (2000). Sample size requirements for estimating Pearson, Kendall and Spearman correlations. Psychometrika, 65(1), 23–28.',
];

const T = {
  en: {
    title: 'Murmur: my voice evidence report',
    made: 'Made on this device by Murmur',
    generated: 'Generated',
    version: 'Feature version',
    synthetic: 'SYNTHETIC DEMO DATA. This report was made from the app\'s built-in demo entries, not from a real person\'s voice. The links between voice and mood in it were built in on purpose.',
    statement: 'This report describes measurements of recordings compared with the same person\'s other recordings. It is not a diagnosis, a screening result, or a comparison with other people.',
    privacyNoNotes: 'No audio is in this report. Notes are not included.',
    privacyNotes: 'No audio is in this report. Notes are included because the box was ticked.',
    used: 'What was used',
    usedReal: (n) => `${n} recording${n === 1 ? '' : 's'} of your own.`,
    usedDemo: (n) => `${n} synthetic demo entr${n === 1 ? 'y' : 'ies'}. There are no recordings of your own yet.`,
    period: (a, b) => `From ${a} to ${b}.`,
    demoIgnored: (n) => `${n} demo entr${n === 1 ? 'y was' : 'ies were'} left out, because demo data is never mixed with your own.`,
    olderIgnored: (n) => `${n} recording${n === 1 ? ' was' : 's were'} left out because ${n === 1 ? 'it was' : 'they were'} measured with an older version of the feature code.`,
    method: 'How the numbers are made',
    methodText: (min, n) => [
      'Each recording is resampled to 16 kHz mono, high-pass filtered at about 50 Hz, and analyzed in 25 ms frames with a 10 ms hop. Features come from the browser\'s compressed recording, not from raw audio.',
      `Usual range: the median of the recordings listed under "What was used", plus and minus k scaled MADs (median absolute deviation × 1.4826). k depends on how many recordings there are: k(n) = 1.96 + 9.5 / (n − 1). A range is given once there are ${min} usable recordings. If more than half the values are identical the MAD is zero, and the standard deviation is used instead; the report says so where that happens.`,
      `The last ${n} recordings are compared with the range in this report, which is made from all usable recordings including those ${n}. The app's daily result compares a recording only with earlier ones, so a day can read differently there.`,
      'Recordings with more than 1% clipped samples, or a signal-to-noise ratio below 15 dB when at least 10% of the recording is silence, are flagged. They stay in the journal and are left out of every number here.',
    ],
    features: 'The five measures',
    what: 'What it is',
    how: 'How it is computed',
    validation: 'How far to trust it',
    range: 'Your usual range',
    rangeLine: (n, med, lo, hi) => `Median ${med}; usual range ${lo} to ${hi}; from ${n} recordings.`,
    rangeDetail: (spread, k, sd) => `${sd ? 'Standard deviation (MAD was zero)' : 'Scaled MAD'} ${spread}; k = ${k}.`,
    rangeNeed: (n, min) => `Not enough recordings for a usual range yet: ${n} of ${min}.`,
    rangeMedianOnly: (med) => `Median so far: ${med}.`,
    rangeFlat: (n, med) => `All ${n} values are the same (${med}), so there is no range to compare with.`,
    recent: (n) => `Last ${n} recording${n === 1 ? '' : 's'}`,
    cols: ['Date', 'Value', 'Compared with the usual range'],
    band: { usual: 'within', higher: 'above', lower: 'below', none: 'no range yet', missing: 'no value' },
    outside: (k, n) => `${k} of the last ${n} fell outside the usual range.`,
    flags: 'Recordings left out for quality',
    flagsNone: 'No recording was left out for quality.',
    flagCols: ['Date', 'Reason'],
    links: 'Links with mood',
    linksNeed: (min, n) => `Links are computed once ${min} usable recordings have mood and energy check-ins. There are ${n}.`,
    linksMethod: 'Spearman rank correlation (rho) between each measure and the mood rating (1 to 7), using only the recordings above that have both a mood and an energy check-in. The 95% interval is from the Fisher z transform with the Bonett and Wright (2000) variance for Spearman\'s rho. It is not a bootstrap interval.',
    linkCols: ['Measure', 'rho', 'n', '95% interval (Fisher z)', 'Interval includes zero'],
    yes: 'yes',
    no: 'no',
    tooLittleVariation: 'Too little variation to compute',
    ratingsTooSimilar: 'Mood ratings too similar to compute',
    multiple: 'Five measures are tested at once, so one of them can look sizable by chance even when voice and mood are unrelated. The intervals are not adjusted for this. Days are also not independent of each other (a week-long cold affects many entries), so the real uncertainty is larger than the intervals.',
    multipleBand: 'With five measures, an ordinary day shows at least one value outside the usual range fairly often.',
    leads: 'A correlation here describes one person\'s recordings. It does not show that mood changes the voice or the other way round.',
    recordings: 'Check-ins for the last recordings',
    recCols: ['Date', 'Mood', 'Energy'],
    note: 'Note',
    limits: 'Limits',
    limitsList: [
      'This is not a diagnosis and cannot detect any illness or mood state. Nothing in the app\'s validation shows that any of these measures relates to mood.',
      'Phone microphones, distance from the mouth, the room, and background noise all change these numbers. Recording in a similar place and position each time helps.',
      'Lexical tones in Mandarin and other tone languages raise pitch movement by themselves. The usual range is only meaningful if the recordings are in the same language.',
      'A cold, hoarseness, tiredness, or having just woken up shifts pitch and voice regularity for reasons that have nothing to do with mood.',
      'Speaking rate is estimated from loudness peaks, not from a transcript, and its error differs a lot between people.',
      'Browsers differ in how much audio processing they let an app turn off, so recordings from different devices or browsers may not be comparable.',
      'The usual range and the correlations come from one person\'s recordings. They say nothing about other people and are not compared with population norms.',
    ],
    refs: 'References',
    na: 'not available',
  },
  'zh-TW': {
    title: 'Murmur 低語日記：我的聲音報告',
    made: '由 Murmur 在這個裝置上產生',
    generated: '產生時間',
    version: '特徵版本',
    synthetic: '合成的示範資料。這份報告是用 app 內建的示範資料做的，不是任何真人的聲音。裡面的聲音和心情關聯是刻意做出來的。',
    statement: '這份報告描述的是錄音的測量結果，而且只和同一個人自己的其他錄音比較。它不是診斷，不是篩檢結果，也不和其他人比較。',
    privacyNoNotes: '這份報告裡沒有錄音，也沒有放入你寫的備註。',
    privacyNotes: '這份報告裡沒有錄音。因為你勾選了，所以有放入你寫的備註。',
    used: '用了哪些資料',
    usedReal: (n) => `你自己的 ${n} 筆錄音。`,
    usedDemo: (n) => `${n} 筆合成的示範資料。目前還沒有你自己的錄音。`,
    period: (a, b) => `從 ${a} 到 ${b}。`,
    demoIgnored: (n) => `有 ${n} 筆示範資料沒有算進來，因為示範資料不會和你自己的紀錄混在一起。`,
    olderIgnored: (n) => `有 ${n} 筆錄音沒有算進來，因為它們是用舊版的特徵程式測量的。`,
    method: '數字是怎麼來的',
    methodText: (min, n) => [
      '每段錄音先轉成 16 kHz 單聲道，用大約 50 Hz 的高通濾波去掉低頻雜訊，再以 25 毫秒的音框、每 10 毫秒移動一次來分析。特徵是從瀏覽器壓縮過的錄音算出來的，不是原始音訊。',
      `平常範圍：以「用了哪些資料」列出的錄音取中位數，上下各加減 k 倍的校正後 MAD（絕對中位差 × 1.4826）。k 會隨錄音筆數改變：k(n) = 1.96 + 9.5 / (n − 1)。可用的錄音滿 ${min} 筆才會有平常範圍。如果超過一半的數值都一樣，MAD 會是 0，這時改用標準差，報告裡會註明。`,
      `最近 ${n} 筆錄音是和這份報告裡的平常範圍比較，這個範圍是用所有可用的錄音算的，也包含這 ${n} 筆。app 每天的結果只和更早的錄音比較，所以同一天在那裡看到的可能不一樣。`,
      '被截掉的取樣點超過 1%，或是錄音裡至少有 10% 是安靜的而訊噪比低於 15 dB，這樣的錄音會被標記。它們留在紀錄裡，但不會算進這份報告的任何數字。',
    ],
    features: '五個指標',
    what: '這是什麼',
    how: '怎麼算的',
    validation: '可以相信到什麼程度',
    range: '你的平常範圍',
    rangeLine: (n, med, lo, hi) => `中位數 ${med}；平常範圍 ${lo} 到 ${hi}；用了 ${n} 筆錄音。`,
    rangeDetail: (spread, k, sd) => `${sd ? '標準差（MAD 為 0）' : '校正後 MAD'} ${spread}；k = ${k}。`,
    rangeNeed: (n, min) => `錄音還不夠算出平常範圍：目前 ${n} 筆，需要 ${min} 筆。`,
    rangeMedianOnly: (med) => `目前的中位數：${med}。`,
    rangeFlat: (n, med) => `${n} 筆的數值都一樣（${med}），所以沒有範圍可以比較。`,
    recent: (n) => `最近 ${n} 筆錄音`,
    cols: ['日期', '數值', '和平常範圍比'],
    band: { usual: '範圍內', higher: '高於', lower: '低於', none: '還沒有範圍', missing: '沒有數值' },
    outside: (k, n) => `最近 ${n} 筆裡有 ${k} 筆落在平常範圍外。`,
    flags: '因為錄音品質沒有算進來的錄音',
    flagsNone: '沒有錄音因為品質被排除。',
    flagCols: ['日期', '原因'],
    links: '和心情的關聯',
    linksNeed: (min, n) => `可用的錄音裡，有記心情和精神的滿 ${min} 筆後才會計算關聯。目前 ${n} 筆。`,
    linksMethod: '每個指標和心情分數（1 到 7）的 Spearman 等級相關（rho），只用上面列出的錄音裡同時有記心情和精神的那些。95% 區間用 Fisher z 轉換計算，變異數採 Bonett 與 Wright（2000）針對 Spearman rho 的公式。這不是 bootstrap 區間。',
    linkCols: ['指標', 'rho', 'n', '95% 區間（Fisher z）', '區間是否包含 0'],
    yes: '是',
    no: '否',
    tooLittleVariation: '變化太小，無法計算',
    ratingsTooSimilar: '心情分數太接近，無法計算',
    multiple: '這裡同時看了五個指標，就算聲音和心情完全無關，也可能有一個碰巧看起來不小。區間沒有針對這一點做校正。每天的紀錄彼此也不獨立（例如一整週都感冒），所以真實的不確定性比區間更大。',
    multipleBand: '因為有五個指標，平常的一天裡至少有一個落在平常範圍外，其實滿常見的。',
    leads: '這裡的相關只描述一個人自己的錄音，不能說明是心情改變了聲音，還是反過來。',
    recordings: '最近幾筆錄音的心情紀錄',
    recCols: ['日期', '心情', '精神'],
    note: '備註',
    limits: '限制',
    limitsList: [
      '這不是診斷，也無法偵測任何疾病或情緒狀態。app 的驗證結果沒有顯示任何一個指標和心情有關。',
      '手機麥克風、嘴巴和手機的距離、空間和背景噪音都會改變這些數字。每次在差不多的地方、用差不多的姿勢錄，比較才有意義。',
      '中文和其他聲調語言的聲調本身就會讓音高起伏變大。每次用同一種語言錄，平常範圍才有意義。',
      '感冒、沙啞、疲倦或剛睡醒都會改變音高和聲音規律度，這些和心情無關。',
      '語速是用音量的起伏估計的，不是從逐字稿算的，不同人的誤差差很多。',
      '不同瀏覽器能關掉的音訊處理不一樣，所以不同裝置或瀏覽器的錄音不一定能互相比較。',
      '平常範圍和相關都只來自一個人自己的錄音，不能用來說明其他人，也不和常模比較。',
    ],
    refs: '參考文獻',
    na: '無',
  },
};

// How each of the five measures is computed, following README.md "What it measures".
const HOW = {
  en: {
    f0MedianHz:
      'Median fundamental frequency (F0) over voiced frames. F0 comes from YIN (de Cheveigné & Kawahara, 2002) with a 0.15 threshold and a 70 to 500 Hz range, with parabolic interpolation; frames whose best period lies outside the range count as unvoiced. Then 5-frame median smoothing, and removal of frames more than 1.8 times away from the median of their own 300 ms neighbourhood (octave errors).',
    f0SdSt: 'Standard deviation of the same YIN F0 values over voiced frames, expressed in semitones.',
    speechRate:
      'Syllable nuclei divided by the time from the first to the last speech frame. Nuclei are intensity peaks at or near voiced frames that rise at least 2 dB above the preceding dip and are at least 80 ms apart, following de Jong & Wempe (2009). No transcript is used.',
    pauseRatio: 'Silent time between the first and the last speech frame, as a share of that span. Pause rule: a silence counts as a pause only if it lasts 250 ms or longer.',
    periodicityDb:
      'Periodicity: 10·log10((1 − a) / a), where a is the lowest YIN aperiodicity within the pitch range, computed on every speech frame (voiced or not) and summarized by the median. It is related to, but not the same as, Praat\'s harmonics-to-noise ratio.',
  },
  'zh-TW': {
    f0MedianHz:
      '有聲音框的基頻（F0）中位數。F0 用 YIN 演算法估計（de Cheveigné 與 Kawahara，2002），門檻 0.15，範圍 70 到 500 Hz，並做拋物線內插；最佳週期落在範圍外的音框視為無聲。之後做 5 個音框的中位數平滑，並移除和前後 300 毫秒的中位數相差超過 1.8 倍的音框（八度錯誤）。',
    f0SdSt: '同一組 YIN 基頻在有聲音框上的標準差，以半音表示。',
    speechRate: '音節核的數目，除以第一個到最後一個語音音框之間的時間。音節核是有聲音框附近的音量高峰，要比前一個低點高出至少 2 dB，而且彼此相隔至少 80 毫秒，做法依照 de Jong 與 Wempe（2009）。沒有用到逐字稿。',
    pauseRatio: '第一個到最後一個語音音框之間，安靜的時間占多少比例。停頓規則：安靜持續 250 毫秒以上才算停頓。',
    periodicityDb: '週期性：10·log10((1 − a) / a)，a 是音高範圍內最低的 YIN 非週期性，每個語音音框（不論有聲無聲）都算，再取中位數。它和 Praat 的諧噪比有關，但不是同一個東西。',
  },
};

const uiOf = (lang) => (lang === 'en' ? 'en' : 'zh-TW');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const round = (v, d) => (Number.isFinite(v) ? Number(v.toFixed(d)) : null);
const pad = (n) => String(n).padStart(2, '0');

// Local date and time, the same in both languages: 2026-11-24 21:05
export function fmtWhen(ts) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// A correlation without a leading zero (.42, −.17), as everywhere else in the app.
export const fmtRho = fmtR;

const flagsOf = (e) => (e.features && e.features.quality && e.features.quality.flags) || [];
const usable = (e) => !!(e && e.features && e.features.ok && e.featureVersion === FEATURE_VERSION);

// Which entries the report is made from, by the same rules as the app's Trends view: real
// recordings only once one exists (demo entries otherwise), current feature version, and no
// quality flags. Flagged recordings of the same kind are returned apart.
export function selectEntries(entries) {
  const list = (entries || []).filter((e) => e && e.features).sort((a, b) => a.createdAt - b.createdAt);
  const hasReal = list.some((e) => !e.demo && usable(e));
  const useDemo = !hasReal;
  const mine = list.filter((e) => !!e.demo === useDemo);
  return {
    synthetic: useDemo,
    used: mine.filter((e) => usable(e) && !flagsOf(e).length),
    flagged: mine.filter((e) => usable(e) && flagsOf(e).length),
    olderVersion: mine.filter((e) => e.features.ok && e.featureVersion !== FEATURE_VERSION).length,
    demoIgnored: hasReal ? list.filter((e) => e.demo).length : 0,
  };
}

// Median, spread and band for one measure, in the unit stored in the entries.
// Same arithmetic as the shaded band on the trend chart.
export function usualRange(values, minN = BASELINE_MIN) {
  const vals = values.filter(Number.isFinite);
  const n = vals.length;
  if (!n) return { n, median: NaN, spread: NaN, k: NaN, low: NaN, high: NaN, spreadMethod: null, status: 'need-more' };
  const med = median(vals);
  let spread = mad(vals);
  let spreadMethod = 'scaled-mad';
  if (!(spread > 0) && n > 1) {
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    spread = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
    spreadMethod = 'sd';
  }
  if (n < minN) return { n, median: med, spread: NaN, k: NaN, low: NaN, high: NaN, spreadMethod: null, status: 'need-more' };
  if (!(spread > 0)) return { n, median: med, spread: 0, k: NaN, low: NaN, high: NaN, spreadMethod, status: 'flat' };
  const k = baselineK(n);
  return { n, median: med, spread, k, low: med - k * spread, high: med + k * spread, spreadMethod, status: 'ok' };
}

export function bandOf(value, range) {
  if (!Number.isFinite(value)) return 'missing';
  if (!range || range.status !== 'ok') return 'none';
  return value > range.high ? 'higher' : value < range.low ? 'lower' : 'usual';
}

// Spearman links between the five measures and mood, by the same rules as the Trends table.
export function moodLinks(used, keys = REPORT_FEATURES) {
  const rated = used.filter((e) => Number.isFinite(e.mood) && Number.isFinite(e.energy));
  if (rated.length < LINKS_MIN) return { status: 'need-more', n: rated.length, minN: LINKS_MIN, rows: [] };
  const moods = rated.map((e) => e.mood);
  const moodOk = distinctCount(moods) >= MIN_DISTINCT_RATINGS;
  const rows = keys.map((key) => {
    const xs = rated.map((e) => e.features[key]);
    const featOk = distinctCount(xs) >= MIN_DISTINCT;
    const r = featOk && moodOk ? spearman(xs, moods) : { n: xs.filter(Number.isFinite).length, r: NaN, lo: NaN, hi: NaN };
    if (!Number.isFinite(r.r)) return { key, n: r.n, rho: null, interval: null, includesZero: null, reason: !featOk || moodOk ? 'tooLittleVariation' : 'ratingsTooSimilar' };
    return { key, n: r.n, rho: fmtRho(r.r), interval: [fmtRho(r.lo), fmtRho(r.hi)], includesZero: r.lo <= 0 && r.hi >= 0, reason: null };
  });
  return { status: 'ok', n: rated.length, minN: LINKS_MIN, rows };
}

// entries: every stored entry. opts: { uiLang: 'en' | 'zh-TW', strings: the app's own copy for
// that language (feat, confidence, confidenceWhy, units, chanceNote, quality_*), includeNotes,
// generatedAt, recentN }. Notes are left out unless includeNotes is exactly true.
export function buildVoiceReportData(entries, opts = {}) {
  const ui = uiOf(opts.uiLang);
  const t = T[ui];
  const S = opts.strings || {};
  const includeNotes = opts.includeNotes === true;
  const recentN = opts.recentN || RECENT_N;
  const sel = selectEntries(entries);
  const used = sel.used;
  const last = used.slice(-recentN);
  const unitOf = (info) => (S.units || {})[info.unit] ?? info.unit;
  const show = (info, v, extra = 0) => (Number.isFinite(v) ? `${(v * (info.scale || 1)).toFixed(info.digits + extra)} ${unitOf(info)}`.replace(' %', '%') : t.na);

  const features = REPORT_FEATURES.map((key) => {
    const info = FEATURE_INFO.find((f) => f.key === key);
    const scale = info.scale || 1;
    const range = usualRange(used.map((e) => e.features[key]));
    const recent = last.map((e) => {
      const v = e.features[key];
      return { when: fmtWhen(e.createdAt), value: round(v * scale, info.digits + 1), text: show(info, v), band: bandOf(v, range) };
    });
    return {
      key,
      name: (S.feat && S.feat[key] && S.feat[key][0]) || key,
      unit: unitOf(info),
      what: (S.feat && S.feat[key] && S.feat[key][1]) || '',
      how: HOW[ui][key],
      confidence: info.confidence,
      confidenceLabel: (S.confidence && S.confidence[info.confidence]) || info.confidence,
      validation: (S.confidenceWhy && S.confidenceWhy[key]) || '',
      usualRange: {
        status: range.status,
        recordings: range.n,
        minRecordings: BASELINE_MIN,
        median: round(range.median * scale, info.digits + 1),
        spread: round(range.spread * scale, info.digits + 2),
        spreadMethod: range.spreadMethod,
        k: round(range.k, 2),
        low: round(range.low * scale, info.digits + 1),
        high: round(range.high * scale, info.digits + 1),
        text: {
          median: show(info, range.median, 1),
          spread: show(info, range.spread, 2),
          low: show(info, range.low, 1),
          high: show(info, range.high, 1),
        },
      },
      recent,
      outsideCount: recent.filter((r) => r.band === 'higher' || r.band === 'lower').length,
    };
  });

  const links = moodLinks(used);
  const nameOf = Object.fromEntries(features.map((f) => [f.key, f.name]));

  return {
    app: 'murmur',
    report: 'voice-evidence',
    version: 1,
    title: t.title,
    language: ui,
    generatedAt: opts.generatedAt || new Date().toISOString(),
    featureVersion: FEATURE_VERSION,
    synthetic: sel.synthetic,
    syntheticNotice: sel.synthetic ? t.synthetic : null,
    statement: t.statement,
    privacy: { audioIncluded: false, notesIncluded: includeNotes, text: includeNotes ? t.privacyNotes : t.privacyNoNotes },
    recordings: {
      kind: sel.synthetic ? 'synthetic-demo' : 'own',
      used: used.length,
      first: used.length ? fmtWhen(used[0].createdAt) : null,
      last: used.length ? fmtWhen(used[used.length - 1].createdAt) : null,
      demoLeftOut: sel.demoIgnored,
      olderVersionLeftOut: sel.olderVersion,
      qualityLeftOut: sel.flagged.map((e) => ({
        when: fmtWhen(e.createdAt),
        flags: flagsOf(e).slice(),
        text: flagsOf(e).map((f) => S['quality_' + f] || f).join(' '),
      })),
      recent: last.map((e) => {
        const row = { when: fmtWhen(e.createdAt), mood: Number.isFinite(e.mood) ? e.mood : null, energy: Number.isFinite(e.energy) ? e.energy : null };
        if (includeNotes) row.note = typeof e.note === 'string' ? e.note : '';
        return row;
      }),
    },
    method: t.methodText(BASELINE_MIN, recentN),
    features,
    moodLinks: {
      status: links.status,
      recordings: links.n,
      minRecordings: links.minN,
      measuresTested: REPORT_FEATURES.length,
      coefficient: 'Spearman rho',
      intervalLevelPercent: 95,
      intervalMethod: 'fisher-z-bonett-wright',
      method: t.linksMethod,
      rows: links.rows.map((r) => ({ ...r, name: nameOf[r.key], reason: r.reason ? t[r.reason] : null })),
      chanceNote: S.chanceNote || '',
      multipleComparisons: t.multiple,
      caveat: t.leads,
    },
    limits: t.limitsList,
    references: VOICE_REFERENCES,
  };
}

export function buildVoiceReportHtml(data) {
  const ui = uiOf(data.language);
  const t = T[ui];
  const out = [];
  const p = (s, cls) => out.push(`<p${cls ? ` class="${cls}"` : ''}>${esc(s)}</p>`);
  const h2 = (s) => out.push(`<h2>${esc(s)}</h2>`);
  const ul = (list) => out.push(`<ul>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`);
  const table = (cols, rows) =>
    out.push(`<table><thead><tr>${cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
  const R = data.recordings;

  out.push(`<!doctype html><html lang="${ui === 'en' ? 'en' : 'zh-Hant-TW'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(data.title)}</title><style>
body{font:16px/1.6 system-ui,-apple-system,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;color:#24213b;background:#fff;max-width:60rem;margin:0 auto;padding:1.5rem}
h1{font-size:1.5rem;margin:0 0 .25rem}h2{font-size:1.2rem;margin:2rem 0 .5rem;border-bottom:1px solid #dcd9e8;padding-bottom:.25rem}h3{font-size:1.1rem;margin:1.75rem 0 .25rem}h4{font-size:.95rem;margin:.9rem 0 .15rem}
table{border-collapse:collapse;width:100%;font-size:.9rem;margin:.4rem 0}th,td{border:1px solid #dcd9e8;padding:.3rem .5rem;text-align:left;vertical-align:top}th{background:#f1f0f6}
.muted{color:#55516e}.box{border:1px solid #dcd9e8;border-radius:8px;padding:.5rem .9rem;margin:.6rem 0;background:#f8f7fc}
.synthetic{border:2px solid #8a5a00;background:#fff6dd;color:#4a3000;font-weight:600}.conf{font-weight:600}.note{white-space:pre-wrap;word-break:break-word}
p{margin:.35rem 0}@media print{body{padding:0}h2,h3,h4{break-after:avoid}tr{break-inside:avoid}}
</style></head><body>`);
  out.push(`<h1>${esc(data.title)}</h1><p class="muted">${esc(t.made)} · ${esc(t.generated)}: ${esc(data.generatedAt)} · ${esc(t.version)}: ${esc(data.featureVersion)}</p>`);
  if (data.synthetic) out.push(`<div class="box synthetic" role="note"><p>${esc(data.syntheticNotice)}</p></div>`);
  out.push(`<div class="box"><p><strong>${esc(data.statement)}</strong></p><p>${esc(data.privacy.text)}</p></div>`);

  h2(t.used);
  const usedLines = [(data.synthetic ? t.usedDemo : t.usedReal)(R.used)];
  if (R.used) usedLines.push(t.period(R.first, R.last));
  if (R.demoLeftOut) usedLines.push(t.demoIgnored(R.demoLeftOut));
  if (R.olderVersionLeftOut) usedLines.push(t.olderIgnored(R.olderVersionLeftOut));
  ul(usedLines);

  h2(t.flags);
  if (R.qualityLeftOut.length) table(t.flagCols, R.qualityLeftOut.map((q) => [q.when, q.text]));
  else p(t.flagsNone);

  h2(t.method);
  ul(data.method);

  h2(t.features);
  for (const f of data.features) {
    const u = f.usualRange;
    out.push(`<h3>${esc(f.name)}</h3>`);
    out.push(`<h4>${esc(t.what)}</h4><p>${esc(f.what)}</p>`);
    out.push(`<h4>${esc(t.how)}</h4><p>${esc(f.how)}</p>`);
    out.push(`<h4>${esc(t.validation)}</h4><p><span class="conf">${esc(f.confidenceLabel)}</span>${ui === 'en' ? '. ' : '。'}${esc(f.validation)}</p>`);
    out.push(`<h4>${esc(t.range)}</h4>`);
    if (u.status === 'ok') {
      p(t.rangeLine(u.recordings, u.text.median, u.text.low, u.text.high));
      p(t.rangeDetail(u.text.spread, u.k.toFixed(2), u.spreadMethod === 'sd'), 'muted');
    } else if (u.status === 'flat') {
      p(t.rangeFlat(u.recordings, u.text.median));
    } else {
      p(t.rangeNeed(u.recordings, u.minRecordings));
      if (u.recordings) p(t.rangeMedianOnly(u.text.median), 'muted');
    }
    if (f.recent.length) {
      out.push(`<h4>${esc(t.recent(f.recent.length))}</h4>`);
      table(t.cols, f.recent.map((r) => [r.when, r.text, t.band[r.band]]));
      if (u.status === 'ok') p(t.outside(f.outsideCount, f.recent.length), 'muted');
    }
  }
  p(data.moodLinks.chanceNote);
  p(t.multipleBand, 'muted');

  h2(t.links);
  const L = data.moodLinks;
  if (L.status !== 'ok') {
    p(t.linksNeed(L.minRecordings, L.recordings));
  } else {
    p(L.method);
    table(t.linkCols, L.rows.map((r) => (r.rho === null ? [r.name, '–', String(r.n), r.reason, ''] : [r.name, r.rho, String(r.n), `[${r.interval[0]}, ${r.interval[1]}]`, r.includesZero ? t.yes : t.no])));
  }
  p(L.chanceNote);
  p(L.multipleComparisons);
  p(L.caveat);

  if (R.recent.length) {
    h2(t.recordings);
    const withNotes = data.privacy.notesIncluded;
    out.push(
      `<table><thead><tr>${[...t.recCols, ...(withNotes ? [t.note] : [])].map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${R.recent
        .map((r) => `<tr><td>${esc(r.when)}</td><td>${esc(r.mood ?? '–')}</td><td>${esc(r.energy ?? '–')}</td>${withNotes ? `<td class="note">${esc(r.note || '')}</td>` : ''}</tr>`)
        .join('')}</tbody></table>`
    );
  }

  h2(t.limits);
  ul(data.limits);
  h2(t.refs);
  ul(data.references);
  out.push('</body></html>');
  return out.join('\n');
}

// File names for the two downloads.
export function voiceReportFileNames(localDate, synthetic) {
  const base = `murmur-voice-report${synthetic ? '-demo' : ''}-${localDate}`;
  return { html: `${base}.html`, json: `${base}.json` };
}
