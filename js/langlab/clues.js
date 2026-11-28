// Clues in your words (字裡的線索): seven small families of words, each with its own mark, for
// the live playground of the language mirror, the word fingerprint and the 換角度 summary.
// Six families read the same hand-authored categories as the full analysis (js/langlab/score.js);
// "should" has its own short list here, because the full analysis has no such category.
// This only counts words. It says nothing about a person.
import { analyze } from './score.js';

export const FAMILIES = ['self', 'others', 'feel', 'absolute', 'should', 'maybe', 'time'];

// which categories of the full analysis feed each family (first match wins, in PRIORITY order)
const FROM = {
  absolute: ['certain'],
  self: ['i'],
  others: ['we', 'you', 'other'],
  feel: ['posemo', 'negemo', 'anx', 'anger', 'sad'],
  maybe: ['tentat'],
  time: ['focuspast', 'focusfuture'],
};
const PRIORITY = ['absolute', 'self', 'others', 'feel', 'maybe', 'time'];

// the categories behind a family, for "see the words" in the results
export const FAMILY_SCORES = { self: ['i'], others: ['we', 'you', 'other'], feel: ['posemo', 'negemo'], absolute: ['certain'], should: [], maybe: ['tentat'], time: ['focuspast', 'focusfuture'] };

// longest first, so 不應該 wins over 應該
export const SHOULD_ZH = ['一定要', '不得不', '不應該', '不可以', '不能不', '應該', '必須', '非得', '應當', '總得', '不該', '理應', '務必'];
export const SHOULD_EN = ['supposed to', 'have to', 'has to', 'had to', 'need to', 'needs to', 'ought to', "shouldn't", "mustn't", 'should', 'must', 'ought', 'gotta'];

export const FAMILY_TEXT = {
  zh: {
    self: { name: '自己', note: '「我」「自己」這類字。' },
    others: { name: '別人', note: '「我們」「你」「他」「大家」這類字。' },
    feel: { name: '感受', note: '說心情的字，像「開心」「難過」「擔心」。' },
    absolute: { name: '絕對', note: '「總是」「永遠」「一定」這類沒有例外的字。' },
    should: { name: '應該', note: '「應該」「必須」「一定要」這類字。' },
    maybe: { name: '也許', note: '「也許」「可能」「好像」這類留餘地的字。' },
    time: { name: '時間', note: '說過去或以後的字，像「以前」「明天」。' },
  },
  en: {
    self: { name: 'Me', note: 'Words like "I", "me" and "my".' },
    others: { name: 'Others', note: 'Words like "we", "you", "they" and "everyone".' },
    feel: { name: 'Feelings', note: 'Words that name a feeling, like "glad", "sad" or "worried".' },
    absolute: { name: 'Absolutes', note: 'Words with no exceptions, like "always" and "never".' },
    should: { name: 'Shoulds', note: 'Words like "should", "must" and "have to".' },
    maybe: { name: 'Maybes', note: 'Words that leave room, like "maybe" and "perhaps".' },
    time: { name: 'Time', note: 'Words about the past or the future, like "before" and "tomorrow".' },
  },
};

// One plain line per approach: which family that approach tends to listen for. Approaches with
// no clear match get no line.
export const LENS_FAMILY = {
  rebt: 'should',
  cognitive: 'absolute',
  'person-centered': 'feel',
  gestalt: 'self',
  adlerian: 'others',
  'family-systems': 'others',
  'solution-focused': 'time',
  psychoanalytic: 'time',
  narrative: 'time',
};
export const LENS_LINE = {
  zh: {
    should: '這個取向會特別聽「應該」「必須」這類字。',
    absolute: '這個取向會特別聽「總是」「永遠」這類字。',
    feel: '這個取向會特別聽說感受的字。',
    self: '這個取向會留意「我」怎麼說自己。',
    others: '這個取向會留意身邊的人怎麼出現在話裡。',
    time: '這個取向會留意過去和以後怎麼出現在話裡。',
  },
  en: {
    should: 'This approach listens for words like "should" and "must".',
    absolute: 'This approach listens for words like "always" and "never".',
    feel: 'This approach listens for feeling words.',
    self: 'This approach notices how "I" speaks about itself.',
    others: 'This approach notices how other people show up in what you say.',
    time: 'This approach notices how the past and the future show up in what you say.',
  },
};

const isWordChar = (c) => !!c && /[A-Za-z0-9'’]/.test(c);

function shouldSpans(text) {
  const out = [];
  const lower = text.toLowerCase().replace(/’/g, "'");
  const taken = (s, e) => out.some((x) => s < x.e && e > x.s);
  for (const w of SHOULD_ZH) {
    for (let i = lower.indexOf(w); i >= 0; i = lower.indexOf(w, i + w.length)) if (!taken(i, i + w.length)) out.push({ s: i, e: i + w.length, fam: 'should', w });
  }
  for (const w of SHOULD_EN) {
    for (let i = lower.indexOf(w); i >= 0; i = lower.indexOf(w, i + w.length)) {
      if (isWordChar(lower[i - 1]) || isWordChar(lower[i + w.length]) || taken(i, i + w.length)) continue;
      out.push({ s: i, e: i + w.length, fam: 'should', w });
    }
  }
  return out;
}

const blank = () => ({ counts: Object.fromEntries(FAMILIES.map((f) => [f, 0])), words: Object.fromEntries(FAMILIES.map((f) => [f, new Map()])) });

// One text and the hits the full analysis found in it -> spans, sorted and without overlaps.
export function cluesFromHits(text, hits) {
  const spans = shouldSpans(text);
  let last = null;
  for (const hit of hits || []) {
    const fam = PRIORITY.find((f) => FROM[f].some((id) => hit.ids.includes(id)));
    if (!fam) continue;
    if (last && hit.s < last.e) continue;
    if (spans.some((x) => x.fam === 'should' && hit.s < x.e && hit.e > x.s)) continue;
    last = { s: hit.s, e: hit.e, fam, w: hit.w || text.slice(hit.s, hit.e) };
    spans.push(last);
  }
  return spans.sort((p, q) => p.s - q.s);
}

function tally(out, spans) {
  for (const sp of spans) {
    out.counts[sp.fam]++;
    out.words[sp.fam].set(sp.w, (out.words[sp.fam].get(sp.w) || 0) + 1);
  }
  return spans.length;
}

// text -> { spans: [{ s, e, fam, w }], counts: { fam: n }, words: { fam: Map(word -> n) }, units, lang, total }
// For the live playground: a small bootstrap, since no interval is shown here.
export function findClues(text, { max = 4000 } = {}) {
  const src = String(text || '').slice(0, max);
  const out = { ...blank(), spans: [], units: 0, lang: null, total: 0 };
  if (!src.trim()) return out;
  const a = analyze([{ text: src }], {}, { B: 20 });
  const lang = a.langs[0] || null;
  const res = lang ? a.byLang[lang] : null;
  out.spans = cluesFromHits(src, res ? res.hits[0] : []);
  out.units = res ? Math.floor(res.gateUnits) : 0;
  out.lang = lang;
  out.total = tally(out, out.spans);
  return out;
}

// The same families over a finished analysis (every item, every language): counts and words.
export function tallyAnalysis(a) {
  const out = { ...blank(), total: 0 };
  for (const lang of a.langs) {
    const res = a.byLang[lang];
    for (let i = 0; i < res.items.length; i++) out.total += tally(out, cluesFromHits(res.items[i].text, res.hits[i]));
  }
  return out;
}

export const topWords = (map, n = 3) => [...map.entries()].sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? -1 : 1)).slice(0, n);
export const topFamily = (counts) => FAMILIES.reduce((best, f) => (counts[f] > (best ? counts[best] : 0) ? f : best), null);
