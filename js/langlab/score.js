// Scoring for the language mirror: category percentages (share of words), an analytic-style
// index from function words, VADER sentiment and Empath topics for English, seeded bootstrap
// intervals, word-level contributions, "without your top words" counterfactuals, time series
// and within-person comparison. Pure functions; runs in the browser and in Node.

import { tokenize, splitSentences, detectLanguage, makeDict, looksSimplified, maskText } from './tokenize.js';
import { EN_CATEGORIES, EN_FUNCTION_CLASSES, ANALYTIC_WEIGHTS, ANALYTIC_CONSTANT, EN_VERSION, EN_WILDCARD_EXCEPTIONS } from './lexicon-en.js';
import { ZH_CATEGORIES, ZH_COMMON, ZH_LOOSE_HEADS, ZH_VERSION } from './lexicon-zh.js';
import { createVader } from './vader.js';

export const ENGINE_VERSION = '1.1.0';

// Below these word counts a score is reported as "not enough text yet".
// Units are words in English and Chinese characters divided by 1.5 in Chinese (docs/language-analysis/DESIGN.md, section 5).
// Tier A: closed-class words. Tier B: stance, reasoning and time words. Tier C: open-class content words.
export const MIN_WORDS = { A: 50, B: 300, C: 300, index: 300, sentiment: 300, empath: 300, bin: 300, openC: 1000 };
export const MIN_HITS_FOR_RATE = 5; // under this, the count is shown and not a rate
export const CI_LEVEL = 0.9;
export const MIN_UNITS_FOR_INTERVAL = 20; // items, or else sentences; with fewer, a Wilson interval is used
export const ITEMS_AS_UNITS_FROM = 20;
export const ZH_CHARS_PER_UNIT = 1.5;
export const TIER = {
  i: 'A', we: 'A', you: 'A', negate: 'A',
  certain: 'B', tentat: 'B', cogproc: 'B', cause: 'B', insight: 'B', focuspast: 'B', focuspresent: 'B', focusfuture: 'B',
  posemo: 'C', negemo: 'C', anx: 'C', anger: 'C', sad: 'C', social: 'C', family: 'C', friend: 'C', work: 'C', body: 'C',
  other: 'A', excl: 'B',
  // the second set is all open-class: tier C
};
// Indices are plain sums and differences of category rates (each in percent of units).
// Nothing is fitted or standardized, so each can be explained word by word.
export const INDICES = {
  selfother: { parts: { i: 1, other: -1 }, constant: 0, tier: 'A' },
  status: { parts: { we: 1, you: 1, i: -1 }, constant: 0, tier: 'B' },
  tone: { parts: { posemo: 1, negemo: -1 }, constant: 0, tier: 'C' },
  authentic: { parts: { i: 1, excl: 1, negemo: -1 }, constant: 0, tier: 'C' },
  analytic: { parts: Object.fromEntries(Object.entries(ANALYTIC_WEIGHTS).map(([k, v]) => ['fc:' + k, v])), constant: ANALYTIC_CONSTANT, tier: 'B', langs: ['en'] },
};
export const FUNCTION_IDS = ['i', 'we', 'you', 'negate'];
export const EMOTION_IDS = ['posemo', 'negemo', 'anx', 'anger', 'sad'];
export const CATEGORY_IDS = Object.keys(EN_CATEGORIES);
// tier 1 (shown open): the closed-class basics. Everything else is folded until asked for.
export const GROUPS = [
  { id: 'core', tier1: true, ids: ['i', 'we', 'you', 'other', 'negate', 'selfother'] },
  { id: 'thinking', ids: ['cogproc', 'cause', 'insight', 'excl', 'certain', 'tentat', 'focuspast', 'focuspresent', 'focusfuture'] },
  { id: 'feelings', ids: ['posemo', 'negemo', 'anx', 'anger', 'sad', 'tone', 'vader'] },
  { id: 'social', ids: ['social', 'family', 'friend', 'affil', 'conflict', 'lonely', 'belong', 'grat', 'apology', 'compare'] },
  { id: 'power', ids: ['status', 'tentat', 'certain', 'request', 'polite'] },
  { id: 'loss', ids: ['loss', 'focuspast', 'sad'] },
  { id: 'drives', ids: ['achieve', 'reward', 'risk', 'belong'] },
  { id: 'moral', ids: ['care', 'fair', 'loyal', 'authority', 'sanct'] },
  { id: 'style', ids: ['authentic', 'analytic'] },
  { id: 'topics', ids: ['work', 'body'] },
];

// ---------- seeded random numbers ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// Bootstrap of ratio statistics sum(numer)/sum(denom) over resampled units.
// numers: arrays of per-unit numerators; denoms[k] is the per-unit denominator array for numers[k].
// Returns for each k the [5th, 95th] percentile of the ratio, or null with too few units.
export function bootstrapRatios(numers, denoms, { B = 500, seed = 1 } = {}) {
  const n = numers.length ? numers[0].length : 0;
  if (n < MIN_UNITS_FOR_INTERVAL) return numers.map(() => null);
  const rng = mulberry32(seed);
  const K = numers.length;
  const distinct = [...new Set(denoms)];
  const dIdx = denoms.map((d) => distinct.indexOf(d));
  const out = numers.map(() => new Float64Array(B));
  const sums = new Float64Array(K);
  const dsums = new Float64Array(distinct.length);
  for (let b = 0; b < B; b++) {
    sums.fill(0);
    dsums.fill(0);
    for (let j = 0; j < n; j++) {
      const idx = Math.floor(rng() * n);
      for (let d = 0; d < distinct.length; d++) dsums[d] += distinct[d][idx];
      for (let k = 0; k < K; k++) sums[k] += numers[k][idx];
    }
    for (let k = 0; k < K; k++) out[k][b] = dsums[dIdx[k]] > 0 ? sums[k] / dsums[dIdx[k]] : NaN;
  }
  return out.map((arr) => {
    const ok = Array.from(arr).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (ok.length < B * 0.5) return null;
    return [percentile(ok, (1 - CI_LEVEL) / 2), percentile(ok, 1 - (1 - CI_LEVEL) / 2)];
  });
}

// Wilson score interval for hits out of n, as proportions. Treats units as independent, so
// it is too narrow for real text; used only when there are too few sentences to resample.
export function wilson(hits, n, z = 1.6449) {
  if (!(n > 0)) return null;
  const p = hits / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}

// ---------- compiled word lists ----------
// exceptions: { stem: [words a wildcard "stem*" must not match; an exception may end in *] }
function compile(categories, exceptions = null) {
  const exact = new Map(); // word -> [category ids]
  const prefix = new Map(); // stem -> [category ids]
  const phrases = new Map(); // first word -> [{ words, ids }]
  const push = (map, key, id) => {
    const cur = map.get(key);
    if (!cur) map.set(key, [id]);
    else if (!cur.includes(id)) cur.push(id);
  };
  let minStem = Infinity;
  let maxStem = 0;
  for (const [id, def] of Object.entries(categories)) {
    for (const entry of def.words) {
      if (entry.includes('_')) {
        const words = entry.split('_');
        const list = phrases.get(words[0]) || [];
        const same = list.find((p) => p.words.join(' ') === words.join(' '));
        if (same) {
          if (!same.ids.includes(id)) same.ids.push(id);
        } else list.push({ words, ids: [id] });
        list.sort((a, b) => b.words.length - a.words.length);
        phrases.set(words[0], list);
      } else if (entry.endsWith('*')) {
        const stem = entry.slice(0, -1);
        push(prefix, stem, id);
        minStem = Math.min(minStem, stem.length);
        maxStem = Math.max(maxStem, stem.length);
      } else push(exact, entry, id);
    }
  }
  const except = new Map(); // stem -> { words: Set, stems: [prefixes] }
  for (const [stem, list] of Object.entries(exceptions || {})) {
    if (!prefix.has(stem)) throw new Error(`wildcard exception for "${stem}*", which no category uses`);
    const e = { words: new Set(), stems: [] };
    for (const x of list) {
      const body = x.endsWith('*') ? x.slice(0, -1) : x;
      if (!body.startsWith(stem) || body === stem) throw new Error(`"${x}" is not a word that "${stem}*" matches`);
      if (x.endsWith('*')) e.stems.push(body);
      else e.words.add(x);
    }
    except.set(stem, e);
  }
  return { exact, prefix, phrases, minStem, maxStem, except };
}

function excepted(lex, stem, t) {
  const e = lex.except.get(stem);
  return !!e && (e.words.has(t) || e.stems.some((p) => t.startsWith(p)));
}

function lookup(lex, t) {
  let ids = lex.exact.get(t) || null;
  if (lex.prefix.size && t.length >= lex.minStem) {
    for (let L = Math.min(t.length, lex.maxStem); L >= lex.minStem; L--) {
      const stem = t.slice(0, L);
      const hit = lex.prefix.get(stem);
      if (hit && !excepted(lex, stem, t)) ids = ids ? [...new Set([...ids, ...hit])] : hit;
    }
  }
  return ids;
}

let compiled = null;
function lexica() {
  if (compiled) return compiled;
  const zhLex = new Set();
  for (const def of Object.values(ZH_CATEGORIES)) for (const x of def.words) zhLex.add(x);
  const zhWords = new Set([...ZH_COMMON, ...zhLex]);
  // guards: words used only for cutting. A word that is also in a category is not a guard.
  const zhGuards = ZH_COMMON.filter((x) => !zhLex.has(x));
  const fc = {};
  for (const [k, list] of Object.entries(EN_FUNCTION_CLASSES)) fc['fc:' + k] = { words: list };
  compiled = {
    en: compile(EN_CATEGORIES, EN_WILDCARD_EXCEPTIONS),
    zh: compile(ZH_CATEGORIES),
    enFunction: compile(fc),
    zhDict: makeDict(zhWords, zhGuards, ZH_LOOSE_HEADS),
    enNegate: new Set(EN_CATEGORIES.negate.words),
    zhNegate: new Set([...ZH_CATEGORIES.negate.words].filter((x) => !['不知道', '不曉得', '不想', '不敢', '沒辦法', '無法'].includes(x))),
  };
  return compiled;
}

export function zhDict() {
  return lexica().zhDict;
}

export function lexiconInfo(extra = {}) {
  const list = [
    { id: 'murmur-en', name: 'Murmur English category lists', version: EN_VERSION, license: 'MIT', source: 'js/langlab/lexicon-en.js', note: 'Written from scratch for Murmur. Not validated against human ratings. Not LIWC.' },
    { id: 'murmur-zh', name: 'Murmur 繁體中文類別詞表', version: ZH_VERSION, license: 'MIT', source: 'js/langlab/lexicon-zh.js', note: 'Written from scratch for Murmur, for Traditional Chinese (Taiwan usage). Simplified text is converted character by character before matching (map built with OpenCC, Apache 2.0), so mainland wording the lists do not have is still missed. Not validated against human ratings. Not C-LIWC.' },
  ];
  for (const key of ['vader', 'empath']) {
    const d = extra[key];
    if (d) list.push({ id: key, name: d.name, version: d.version, license: d.license, source: d.source, note: d.note, attribution: d.attribution, copyright: d.copyright });
  }
  return list;
}

// ---------- one language ----------
function emptyCounts(ids, n) {
  const o = {};
  for (const id of ids) o[id] = new Int32Array(n);
  return o;
}

function topContributors(map, total, limit = 40) {
  const arr = [...map.entries()].map(([word, count]) => ({ word, count, share: total ? count / total : 0 }));
  arr.sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : 1));
  return arr.slice(0, limit);
}

function scoreLanguage(lang, items, data, opts) {
  const L = lexica();
  const lex = lang === 'zh' ? L.zh : L.en;
  const negSet = lang === 'zh' ? L.zhNegate : L.enNegate;
  const vader = lang === 'en' && data.vader ? (data.vaderEngine ||= createVader(data.vader)) : null;
  let empathMap = null;
  if (lang === 'en' && data.empath) {
    empathMap = data.empathMap;
    if (!empathMap) {
      empathMap = new Map();
      for (const [cat, words] of Object.entries(data.empath.categories)) {
        for (const x of words) {
          const cur = empathMap.get(x);
          if (cur) cur.push(cat);
          else empathMap.set(x, [cat]);
        }
      }
      data.empathMap = empathMap;
    }
  }
  const fcIds = lang === 'en' ? Object.keys(ANALYTIC_WEIGHTS).map((k) => 'fc:' + k) : [];

  // pass 1: tokens and sentences
  const prepared = items.map((it) => {
    const tokens = tokenize(it.text, L.zhDict);
    const sentences = splitSentences(it.text);
    return { it, tokens, sentences };
  });
  const byItem = prepared.length >= ITEMS_AS_UNITS_FROM;
  const nItems = prepared.length;
  let nSent = 0;
  for (const p of prepared) nSent += Math.max(1, p.sentences.length);
  // the denominator: words in English (numbers included), Chinese characters in Chinese
  const unitsOf = lang === 'zh' ? (tk) => (tk.kind === 'z' ? tk.end - tk.start : 0) : (tk) => (tk.kind === 'z' ? 0 : 1);
  const nUnits = byItem ? nItems : nSent;

  const W = new Int32Array(nUnits);
  const C = emptyCounts([...CATEGORY_IDS, ...fcIds], nUnits);
  const itemW = byItem ? W : new Int32Array(nItems);
  const itemC = byItem ? C : emptyCounts(CATEGORY_IDS, nItems);
  const vSum = new Float64Array(nUnits);
  const vN = new Int32Array(nUnits);
  const itemVSum = byItem ? vSum : new Float64Array(nItems);
  const itemVN = byItem ? vN : new Int32Array(nItems);
  const contrib = {};
  const negatedSkips = {};
  for (const id of [...CATEGORY_IDS, ...fcIds]) contrib[id] = new Map();
  for (const id of EMOTION_IDS) negatedSkips[id] = new Map();
  const vaderWords = new Map(); // word -> { count, sum }
  const empathCounts = new Map(); // category -> Map(word -> count)
  const empathUnit = new Map(); // category -> Map(unit -> count), sparse
  const hits = prepared.map(() => []);
  const vaderSent = { pos: 0, neu: 0, neg: 0, n: 0 };
  let hitBudget = opts.maxHits ?? 300000;

  let unitBase = 0;
  prepared.forEach((p, ii) => {
    const sents = p.sentences.length ? p.sentences : [{ start: 0, end: p.it.text.length }];
    const toks = p.tokens;
    // sentence index of each token
    let si = 0;
    const tokSent = new Int32Array(toks.length);
    for (let k = 0; k < toks.length; k++) {
      while (si < sents.length - 1 && toks[k].start >= sents[si].end) si++;
      tokSent[k] = si;
    }
    const unitOf = (k) => (byItem ? ii : unitBase + tokSent[k]);
    const addHit = (start, end, ids, extra) => {
      if (hitBudget <= 0) return;
      hitBudget--;
      hits[ii].push({ s: start, e: end, ids, ...extra });
    };
    for (let k = 0; k < toks.length; k++) {
      const tk = toks[k];
      const u = unitOf(k);
      W[u] += unitsOf(tk);
      if (!byItem) itemW[ii] += unitsOf(tk);
    }
    for (let k = 0; k < toks.length; k++) {
      const tk = toks[k];
      const u = unitOf(k);
      // phrases first: the longest phrase starting here wins and uses up its words
      let ids = null;
      let span = 1;
      const cands = lang === 'en' && tk.kind === 'w' ? lex.phrases.get(tk.t) : null;
      if (cands) {
        for (const ph of cands) {
          let ok = k + ph.words.length <= toks.length;
          for (let j = 1; ok && j < ph.words.length; j++) ok = toks[k + j].t === ph.words[j] && tokSent[k + j] === tokSent[k];
          if (ok) {
            ids = ph.ids;
            span = ph.words.length;
            break;
          }
        }
      }
      const wantsLex = (lang === 'zh' && tk.kind === 'z') || (lang === 'en' && tk.kind === 'w');
      if (!ids && wantsLex) ids = lookup(lex, tk.t);
      const surface = span > 1 ? toks.slice(k, k + span).map((x) => x.t).join(' ') : tk.t;
      if (ids) {
        // an emotion word right after a negation ("not happy", 不開心 is listed itself) is not counted
        let neg = false;
        if (ids.some((id) => EMOTION_IDS.includes(id))) {
          for (let b = 1; b <= 3 && k - b >= 0; b++) {
            if (tokSent[k - b] !== tokSent[k]) break;
            if (negSet.has(toks[k - b].t)) neg = true;
          }
        }
        const counted = [];
        for (const id of ids) {
          if (neg && EMOTION_IDS.includes(id)) {
            negatedSkips[id].set(surface, (negatedSkips[id].get(surface) || 0) + 1);
            continue;
          }
          C[id][u]++;
          if (!byItem) itemC[id][ii]++;
          contrib[id].set(surface, (contrib[id].get(surface) || 0) + 1);
          counted.push(id);
        }
        if (counted.length) addHit(tk.start, toks[k + span - 1].end, counted, { w: surface, n: span });
      }
      if (lang === 'en' && tk.kind === 'w') {
        const f = lookup(L.enFunction, tk.t);
        if (f) {
          for (const id of f) {
            C[id][u]++;
            contrib[id].set(tk.t, (contrib[id].get(tk.t) || 0) + 1);
          }
          addHit(tk.start, tk.end, f, { w: tk.t, n: 1 });
        }
        const e = empathMap && empathMap.get(tk.t);
        if (e) {
          const eids = [];
          for (const cat of e) {
            let m = empathCounts.get(cat);
            if (!m) empathCounts.set(cat, (m = new Map()));
            m.set(tk.t, (m.get(tk.t) || 0) + 1);
            let um = empathUnit.get(cat);
            if (!um) empathUnit.set(cat, (um = new Map()));
            um.set(u, (um.get(u) || 0) + 1);
            eids.push('empath:' + cat);
          }
          addHit(tk.start, tk.end, eids, { w: tk.t, n: 1 });
        }
      }
      k += span - 1;
    }
    if (vader) {
      sents.forEach((s, sIdx) => {
        const slice = p.it.masked.slice(s.start, s.end);
        if (!/[A-Za-z]/.test(slice)) return;
        const r = vader.polarity(slice);
        const u = byItem ? ii : unitBase + sIdx;
        vSum[u] += r.compound;
        vN[u]++;
        if (!byItem) {
          itemVSum[ii] += r.compound;
          itemVN[ii]++;
        }
        vaderSent.n++;
        if (r.compound >= 0.05) vaderSent.pos++;
        else if (r.compound <= -0.05) vaderSent.neg++;
        else vaderSent.neu++;
        for (const tk of r.tokens) {
          if (!tk.v) continue;
          const cur = vaderWords.get(tk.t) || { count: 0, sum: 0 };
          cur.count++;
          cur.sum += tk.v;
          vaderWords.set(tk.t, cur);
          addHit(s.start + tk.start, s.start + tk.end, ['vader'], { w: tk.t, v: Math.round(tk.v * 100) / 100, n: 1 });
        }
      });
    }
    if (!byItem) unitBase += sents.length;
  });

  let words = 0;
  for (let u = 0; u < nUnits; u++) words += W[u];

  // intervals: one set of resamples shared by every score of this language
  const B = opts.B ?? (nUnits > 4000 ? 300 : 1000);
  const seed = (opts.seed ?? 20261124) + (lang === 'zh' ? 1 : 0);
  const ids = [...CATEGORY_IDS];
  const numers = ids.map((id) => C[id]);
  const denoms = ids.map(() => W);
  const indexIds = Object.keys(INDICES).filter((k) => !INDICES[k].langs || INDICES[k].langs.includes(lang));
  for (const k of indexIds) {
    const arr = new Float64Array(nUnits);
    for (const [part, wgt] of Object.entries(INDICES[k].parts)) {
      const src = C[part];
      for (let u = 0; u < nUnits; u++) arr[u] += wgt * src[u];
    }
    numers.push(arr);
    denoms.push(W);
    ids.push(k);
  }
  if (vader) {
    numers.push(vSum);
    denoms.push(vN);
    ids.push('vader');
  }
  // Empath: the eight most frequent categories only
  let empathTop = [];
  if (empathMap) {
    empathTop = [...empathCounts.entries()]
      .map(([cat, m]) => ({ cat, m, count: [...m.values()].reduce((a, b) => a + b, 0) }))
      .filter((x) => x.count >= 3)
      .sort((a, b) => b.count - a.count || (a.cat < b.cat ? -1 : 1))
      .slice(0, 8);
    for (const e of empathTop) {
      const arr = new Int32Array(nUnits);
      for (const [u, c] of empathUnit.get(e.cat)) arr[u] = c;
      numers.push(arr);
      denoms.push(W);
      ids.push('empath:' + e.cat);
    }
  }
  const cis = bootstrapRatios(numers, denoms, { B, seed });
  const resampled = nUnits >= MIN_UNITS_FOR_INTERVAL;
  const ciMethod = resampled ? (byItem ? 'bootstrap-items' : 'bootstrap-sentences') : 'wilson';
  const gateUnits = lang === 'zh' ? words / ZH_CHARS_PER_UNIT : words;
  const ciOf = (id, scale = 1, offset = 0) => {
    const ci = cis[ids.indexOf(id)];
    return ci ? [offset + scale * ci[0], offset + scale * ci[1]] : null;
  };

  const scores = [];
  const pctScore = (id, counts, kind, minWords, skips) => {
    let count = 0;
    for (const c of counts.values()) count += c;
    const contributors = topContributors(counts, count);
    const top = contributors.slice(0, 3);
    let removedCount = 0;
    let removedTokens = 0;
    for (const t of top) {
      removedCount += t.count;
      removedTokens += t.count * (lang === 'zh' ? t.word.length : t.word.split(' ').length);
    }
    let ci = ciOf(id, 100);
    if (!ci && !resampled && words > 0) ci = wilson(Math.min(count, words), words).map((x) => 100 * x);
    return {
      id,
      kind,
      tier: TIER[id] || 'C',
      value: words ? (100 * count) / words : 0,
      ci,
      ciMethod: ci ? ciMethod : null,
      count,
      words,
      enough: gateUnits >= minWords,
      rateShown: gateUnits >= minWords && count >= MIN_HITS_FOR_RATE,
      minWords,
      contributors,
      nTypes: counts.size,
      negated: skips ? topContributors(skips, 0, 10) : [],
      counterfactual: top.length ? { words: top.map((t) => t.word), value: words - removedTokens > 0 ? (100 * (count - removedCount)) / (words - removedTokens) : 0 } : null,
    };
  };
  for (const id of CATEGORY_IDS) {
    scores.push(pctScore(id, contrib[id], 'pct', MIN_WORDS[TIER[id]], negatedSkips[id]));
  }

  const indices = indexIds.map((k) => {
    const def = INDICES[k];
    const classes = {};
    let numer = 0;
    const points = new Map();
    for (const [part, wgt] of Object.entries(def.parts)) {
      let c = 0;
      for (const [word, n] of contrib[part]) {
        c += n;
        const cur = points.get(word) || { word, count: n, weight: 0 };
        cur.weight += wgt; // a word in two parts carries both weights
        cur.count = n;
        points.set(word, cur);
      }
      classes[part.replace(/^fc:/, '')] = { count: c, pct: words ? (100 * c) / words : 0, weight: wgt };
      numer += wgt * c;
    }
    const contributors = [...points.values()]
      .filter((p) => p.weight !== 0)
      .map((p) => ({ word: p.word, count: p.count, weight: p.weight, points: words ? (100 * p.weight * p.count) / words : 0 }))
      .sort((a, b) => Math.abs(b.points) - Math.abs(a.points) || (a.word < b.word ? -1 : 1));
    const top = contributors.slice(0, 3);
    let n2 = numer;
    let w2 = words;
    for (const t of top) {
      n2 -= t.weight * t.count;
      w2 -= t.count * (lang === 'zh' ? t.word.length : t.word.split(' ').length);
    }
    const min = MIN_WORDS[def.tier];
    return {
      id: k,
      kind: 'index',
      value: words ? def.constant + (100 * numer) / words : 0,
      ci: ciOf(k, 100, def.constant),
      ciMethod: resampled ? ciMethod : null,
      tier: def.tier,
      rateShown: gateUnits >= min,
      words,
      enough: gateUnits >= min,
      minWords: min,
      classes,
      contributors: contributors.slice(0, 40),
      nTypes: contributors.length,
      counterfactual: top.length ? { words: top.map((t) => t.word), value: w2 > 0 ? def.constant + (100 * n2) / w2 : 0 } : null,
    };
  });
  const analytic = indices.find((x) => x.id === 'analytic') || null;

  let vaderScore = null;
  if (vader) {
    const total = [...vaderWords.values()].reduce((a, b) => a + Math.abs(b.sum), 0);
    const contributors = [...vaderWords.entries()]
      .map(([word, x]) => ({ word, count: x.count, sum: Math.round(x.sum * 100) / 100, share: total ? Math.abs(x.sum) / total : 0 }))
      .sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum) || (a.word < b.word ? -1 : 1));
    const top = contributors.slice(0, 3);
    let cf = null;
    if (top.length && vaderSent.n) {
      const drop = new Set(top.map((t) => t.word));
      let s = 0;
      let n = 0;
      for (const p of prepared) {
        const sents = p.sentences.length ? p.sentences : [{ start: 0, end: p.it.text.length }];
        for (const sn of sents) {
          const slice = p.it.masked.slice(sn.start, sn.end);
          if (!/[A-Za-z]/.test(slice)) continue;
          s += vader.polarityWithout(slice, drop).compound;
          n++;
        }
      }
      cf = { words: top.map((t) => t.word), value: n ? s / n : 0 };
    }
    vaderScore = {
      id: 'vader',
      kind: 'sentiment',
      value: vaderSent.n ? [...vSum].reduce((a, b) => a + b, 0) / vaderSent.n : 0,
      ci: ciOf('vader'),
      ciMethod: resampled ? ciMethod : null,
      tier: 'C',
      rateShown: words >= MIN_WORDS.sentiment,
      words,
      nSentences: vaderSent.n,
      shares: vaderSent.n ? { pos: vaderSent.pos / vaderSent.n, neu: vaderSent.neu / vaderSent.n, neg: vaderSent.neg / vaderSent.n } : { pos: 0, neu: 0, neg: 0 },
      enough: words >= MIN_WORDS.sentiment,
      minWords: MIN_WORDS.sentiment,
      contributors: contributors.slice(0, 40),
      counterfactual: cf,
    };
  }

  const empath = empathTop.map((e) => {
    const sc = pctScore('empath:' + e.cat, e.m, 'empath', MIN_WORDS.empath, null);
    sc.category = e.cat;
    return sc;
  });

  const ts = new Float64Array(nItems);
  prepared.forEach((p, ii) => (ts[ii] = Number.isFinite(p.it.timestamp) ? p.it.timestamp : NaN));

  return {
    lang,
    nItems,
    nSentences: nSent,
    words,
    unit: byItem ? 'item' : 'sentence',
    nUnits,
    B,
    seed,
    scores,
    indices,
    analytic,
    vader: vaderScore,
    empath,
    gateUnits,
    ciMethod,
    hits,
    items: prepared.map((p) => p.it),
    perItem: { ts, words: itemW, counts: itemC, vSum: itemVSum, vN: itemVN },
  };
}

// ---------- whole analysis ----------
// items: [{ text, timestamp (ms or null), source }]. data: { vader, empath } parsed lexicon files
// (either may be missing: those scores are then left out).
export function analyze(items, data = {}, opts = {}) {
  const groups = { en: [], zh: [] };
  let other = 0;
  let simplified = 0;
  for (const raw of items) {
    const text = String(raw && raw.text != null ? raw.text : '');
    if (!text.trim()) continue;
    const lang = raw.lang === 'en' || raw.lang === 'zh' ? raw.lang : detectLanguage(text);
    if (lang === 'other') {
      other++;
      continue;
    }
    if (lang === 'zh' && looksSimplified(text)) simplified++;
    const masked = maskText(text);
    groups[lang].push({ text, masked, timestamp: Number.isFinite(raw.timestamp) ? raw.timestamp : null, source: raw.source || 'text', lang });
  }
  const byLang = {};
  for (const lang of ['zh', 'en']) if (groups[lang].length) byLang[lang] = scoreLanguage(lang, groups[lang], data, opts);
  const langs = Object.keys(byLang).sort((a, b) => byLang[b].words - byLang[a].words);
  return {
    engine: ENGINE_VERSION,
    langs,
    byLang,
    skipped: { otherLanguage: other },
    simplifiedItems: simplified,
    lexica: lexiconInfo(data),
    settings: { minWords: MIN_WORDS, ciLevel: CI_LEVEL, minUnitsForBootstrap: MIN_UNITS_FOR_INTERVAL, minHitsForRate: MIN_HITS_FOR_RATE, zhCharsPerUnit: ZH_CHARS_PER_UNIT },
  };
}

export function allScores(res) {
  return [...res.scores, ...res.indices, ...(res.vader ? [res.vader] : []), ...res.empath];
}

export function findScore(res, id) {
  return allScores(res).find((s) => s.id === id) || null;
}

// ---------- time series ----------
export const BINS = ['month', 'quarter', 'year'];
function binStart(ts, bin, utc) {
  const d = new Date(ts);
  const y = utc ? d.getUTCFullYear() : d.getFullYear();
  const m = utc ? d.getUTCMonth() : d.getMonth();
  const mm = bin === 'year' ? 0 : bin === 'quarter' ? m - (m % 3) : m;
  return { y, m: mm, key: bin === 'year' ? String(y) : bin === 'quarter' ? `${y}-Q${mm / 3 + 1}` : `${y}-${String(mm + 1).padStart(2, '0')}`, order: y * 12 + mm };
}

export function sourcesOf(res) {
  const seen = new Map();
  res.items.forEach((it, i) => {
    if (Number.isFinite(res.perItem.ts[i])) seen.set(it.source, (seen.get(it.source) || 0) + 1);
  });
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
}

// One row per period: { key, items, words, value } with value null when the period has too
// little text (shown as a gap, never filled in). id: a category id or 'vader'.
// opts: { bin, source (one source at a time: platforms are not spliced), utc }
export function timeSeries(res, id, opts = {}) {
  const { ts, words, counts, vSum, vN } = res.perItem;
  const perUnit = res.lang === 'zh' ? ZH_CHARS_PER_UNIT : 1;
  const index = INDICES[id] && id !== 'analytic' ? INDICES[id] : null;
  const offset = index ? index.constant : 0;
  const build = (bin) => {
    const rows = new Map();
    for (let i = 0; i < ts.length; i++) {
      if (!Number.isFinite(ts[i])) continue;
      if (opts.source && res.items[i].source !== opts.source) continue;
      const b = binStart(ts[i], bin, opts.utc);
      const r = rows.get(b.key) || { key: b.key, order: b.order, bin, items: 0, words: 0, num: 0, den: 0 };
      r.items++;
      r.words += words[i];
      if (id === 'vader') {
        r.num += vSum[i];
        r.den += vN[i];
      } else if (index) {
        for (const [part, wgt] of Object.entries(index.parts)) r.num += wgt * counts[part][i];
        r.den += words[i];
      } else if (counts[id]) {
        r.num += counts[id][i];
        r.den += words[i];
      }
      rows.set(b.key, r);
    }
    return [...rows.values()]
      .sort((a, b) => a.order - b.order)
      .map((r) => {
        const enough = r.words / perUnit >= MIN_WORDS.bin && r.den > 0;
        return { key: r.key, bin, items: r.items, words: r.words, value: enough ? (id === 'vader' ? r.num / r.den : offset + (100 * r.num) / r.den) : null };
      });
  };
  if (opts.bin) return build(opts.bin);
  // the finest period in which at least half of the periods (and at least two) have enough text
  let last = [];
  for (const bin of BINS) {
    last = build(bin);
    const ok = last.filter((r) => r.value !== null).length;
    if (ok >= 2 && ok >= last.length / 2) return last;
  }
  return last;
}

// ---------- within-person comparison ----------
// Compares this text with the person's earlier texts (never with other people).
// 'higher' or 'lower' only when the two 90% intervals do not overlap.
export function compare(current, earlier) {
  const out = {};
  if (!current || !earlier) return out;
  for (const s of allScores(current)) {
    const p = findScore(earlier, s.id);
    if (!p || !s.enough || !p.enough) continue;
    let verdict = 'similar';
    if (s.ci && p.ci) {
      if (s.ci[0] > p.ci[1]) verdict = 'higher';
      else if (s.ci[1] < p.ci[0]) verdict = 'lower';
    } else verdict = 'unknown';
    out[s.id] = { earlier: p.value, earlierCi: p.ci, delta: s.value - p.value, verdict };
  }
  return out;
}

// Spans to highlight in one item for one score: sorted, without overlaps.
export function highlightSpans(res, itemIndex, id) {
  const parts = INDICES[id] ? Object.keys(INDICES[id].parts) : null;
  const want = (h) => (parts ? h.ids.some((x) => parts.includes(x)) : h.ids.includes(id));
  const spans = res.hits[itemIndex].filter(want).sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let last = -1;
  for (const h of spans) {
    if (h.s < last) continue;
    out.push(h);
    last = h.e;
  }
  return out;
}

// The full word list of a category, as written in the lexicon files (for the evidence report).
export function categoryWords(lang, id) {
  if (INDICES[id] && id !== 'analytic') return Object.entries(INDICES[id].parts).map(([k, v]) => `${v > 0 ? '+' : '-'} ${k}`);
  if (id === 'analytic') return Object.entries(EN_FUNCTION_CLASSES).map(([k, list]) => `${k} (${ANALYTIC_WEIGHTS[k] > 0 ? '+' : '-'}): ${list.join(' ')}`);
  const def = (lang === 'zh' ? ZH_CATEGORIES : EN_CATEGORIES)[id];
  if (!def) return [];
  // a wildcard is shown with the words it leaves out: "hug* (not huge*, hugh, hugo)"
  return def.words.map((x) => {
    const ex = lang !== 'zh' && x.endsWith('*') ? EN_WILDCARD_EXCEPTIONS[x.slice(0, -1)] : null;
    return ex ? `${x} (not ${ex.join(', ')})` : x.replace(/_/g, ' ');
  });
}
