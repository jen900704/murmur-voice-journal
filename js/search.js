// Full-text search over what the person wrote, on the device. No dependencies, no network.
// The index lives in memory only: it is built from IndexedDB when the Journal is opened and
// is gone when the page closes. Nothing here writes to storage, and the query is never saved.
//
// Ranking is BM25 over weighted fields, with a boost when the whole query appears as written
// and a small nudge toward newer items. See docs/search-and-rag.md for the formula.
import { lensById, isNonAnswer } from './lenses.js';

// k1 is the usual value. b is kept low because journal items are short: a one-line check-in
// should not outrank a longer exercise on length alone. On the labeled queries in
// tests/search-eval.mjs the result barely moves across the whole k1 and b grid.
export const K1 = 1.2;
export const B = 0.4;
export const PHRASE_BOOST = 0.5;
export const RECENCY_WEIGHT = 0.03;
export const HALF_LIFE_DAYS = 60;
const SYNONYM_WEIGHT = 0.6;
const PREFIX_WEIGHT = 0.5;
const UNIGRAM_IN_RUN_WEIGHT = 0.25;
const WEAK_WEIGHT = 0.1;
const MAX_QUERY_CHARS = 200;
const MAX_QUERY_TOKENS = 64;

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Bopomofo}\p{Script=Hangul}]/u;
const LATIN = /\p{Script=Latin}/u;
const LETTER = /\p{L}/u;
const DIGIT = /\p{Nd}/u;
const MARKS = /\p{M}/gu;
// a character with what attaches to it: combining marks, and the half-width kana voicing marks
const CLUSTER = /[^][\p{M}\uff9e\uff9f]*/gu;

// ---------- normalization ----------
// Each character of the original text becomes zero or more normalized characters that remember
// where they came from, so matches can be highlighted in the text exactly as it was written.
// NFKC folds full-width letters and digits and compatibility forms; Latin letters also lose
// their case and accents.
function normChars(text) {
  const out = [];
  const s = String(text ?? '');
  for (const m of s.matchAll(CLUSTER)) {
    let n = m[0].normalize('NFKC').toLowerCase();
    if (LATIN.test(n)) n = n.normalize('NFD').replace(MARKS, '');
    const start = m.index;
    const end = start + m[0].length;
    for (const c of n) out.push({ c, start, end });
  }
  return out;
}

const kindOf = (c) => (CJK.test(c) ? 'cjk' : DIGIT.test(c) ? 'num' : LETTER.test(c) ? 'word' : c === "'" || c === '’' ? 'apos' : 'sep');

// The text as it is compared for phrase matches: normalized, punctuation as single spaces.
export function normalizeText(text) {
  let out = '';
  for (const { c } of normChars(text)) {
    const k = kindOf(c);
    if (k === 'apos') continue;
    if (k === 'sep') {
      if (out && !out.endsWith(' ')) out += ' ';
    } else out += c;
  }
  return out.trim();
}

// ---------- light English stemming ----------
// Plurals, -ing, -ed and a final e. Enough for "worries" to find "worried"; not a full stemmer.
const IRREGULAR = { slept: 'sleep', felt: 'feel', went: 'go', gone: 'go', said: 'say', told: 'tell', thought: 'think', children: 'child', made: 'make', cried: 'cry', ate: 'eat', ran: 'run', kept: 'keep', mum: 'mom', mommy: 'mom', mama: 'mom', daddy: 'dad' };
const NO_STEM = new Set(['morning', 'evening', 'nothing', 'something', 'anything', 'everything', 'during', 'thing', 'this', 'always', 'perhaps', 'need', 'feed', 'indeed', 'series', 'news']);
const undouble = (s) => (/([bdfgmnprt])\1$/.test(s) ? s.slice(0, -1) : s);

export function stem(word) {
  const w = String(word);
  if (IRREGULAR[w]) return stem(IRREGULAR[w]);
  if (w.length < 4 || NO_STEM.has(w) || !/^[a-z]+$/.test(w)) return w;
  let s = w;
  if (s.length > 4 && (s.endsWith('ies') || s.endsWith('ied'))) s = s.slice(0, -3) + 'y';
  else if (/(ss|ch|sh|x|z)es$/.test(s)) s = s.slice(0, -2);
  else if (s.endsWith('s') && !/(ss|us|is)$/.test(s)) s = s.slice(0, -1);
  if (s.length > 5 && s.endsWith('ing')) s = undouble(s.slice(0, -3));
  else if (s.length > 4 && s.endsWith('ed') && !s.endsWith('eed')) s = undouble(s.slice(0, -2));
  if (s.length > 3 && s.endsWith('e') && !s.endsWith('ee')) s = s.slice(0, -1);
  return s.length >= 2 ? s : w;
}

// ---------- tokenizer ----------
// Latin words (stemmed), digit runs, and for Chinese, Japanese and Korean text every character
// plus every pair of neighbouring characters. Pairs carry most of the meaning in Chinese; single
// characters let a one-character query such as 累 work.
// Each token: { term, kind: 'word' | 'num' | 'uni' | 'bi', start, end } with offsets into the
// original text. Word tokens also carry `raw` (before stemming); uni tokens carry `run`.
export function tokenize(text) {
  const chars = normChars(text);
  const tokens = [];
  let i = 0;
  while (i < chars.length) {
    const k = kindOf(chars[i].c);
    if (k === 'cjk') {
      let j = i;
      while (j < chars.length && kindOf(chars[j].c) === 'cjk') j++;
      const run = chars.slice(i, j).map((x) => x.c).join('');
      for (let p = i; p < j; p++) {
        tokens.push({ term: chars[p].c, kind: 'uni', start: chars[p].start, end: chars[p].end, run });
        if (p + 1 < j) tokens.push({ term: chars[p].c + chars[p + 1].c, kind: 'bi', start: chars[p].start, end: chars[p + 1].end });
      }
      i = j;
    } else if (k === 'word' || k === 'num') {
      let j = i;
      let raw = '';
      let last = i;
      while (j < chars.length) {
        const kj = kindOf(chars[j].c);
        if (kj === k) {
          raw += chars[j].c;
          last = j;
          j++;
        } else if (k === 'word' && kj === 'apos' && j + 1 < chars.length && kindOf(chars[j + 1].c) === 'word') j++; // don't -> dont
        else break;
      }
      // an apostrophe inside a word is dropped, so mom's becomes moms and stems to mom
      tokens.push(k === 'word' ? { term: stem(raw), raw, kind: 'word', start: chars[i].start, end: chars[last].end } : { term: raw, kind: 'num', start: chars[i].start, end: chars[last].end });
      i = j;
    } else i++;
  }
  return tokens;
}

export const terms = (text) => tokenize(text).map((t) => t.term);

// ---------- query ----------
// Words that say little on their own. They are still indexed (so a phrase can match), but in a
// query they count for almost nothing unless the query has nothing else.
const STOP_EN = new Set('a an the and or of to in on at is am are was were be been i my me we our you your it its this that these those for with so but as if by from about do did does have has had just very too'.split(' '));
const STOP_ZH = new Set([...'的了是我在有和就都也很你妳他她它們這那個著過嗎呢吧啊喔呀之與及']);
const INTENSIFIER = new Set([...'好太真超蠻滿挺']);

// Groups of words treated as near enough to find one another, at a lower weight than the word
// actually typed. Chinese and English sit in the same group because people here write in both.
export const SYNONYMS = [
  ['工作', '上班', 'work', 'job'],
  ['爸媽', '父母', '家長', 'parents'],
  ['媽媽', '母親', '老媽', 'mom', 'mother'],
  ['爸爸', '父親', '老爸', 'dad', 'father'],
  ['累', '疲倦', '疲憊', '疲勞', 'tired', 'exhausted'],
  ['焦慮', '緊張', '不安', 'anxious', 'anxiety', 'nervous'],
  ['擔心', '煩惱', 'worry'],
  ['難過', '傷心', '悲傷', 'sad', 'unhappy'],
  ['開心', '快樂', '高興', 'happy', 'glad'],
  ['生氣', '憤怒', '火大', 'angry', 'mad'],
  ['睡覺', '睡眠', '入睡', 'sleep'],
  ['失眠', '睡不著', 'insomnia'],
  ['壓力', 'stress', 'pressure'],
  ['老闆', '主管', '上司', 'boss', 'manager'],
  ['同事', 'coworker', 'colleague'],
  ['朋友', 'friend'],
  ['考試', '測驗', 'exam', 'test'],
  ['報告', 'report'],
  ['伴侶', '另一半', '男友', '女友', '男朋友', '女朋友', 'partner', 'boyfriend', 'girlfriend'],
  ['孤單', '寂寞', 'lonely', 'alone'],
  ['害怕', '恐懼', 'afraid', 'scared', 'fear'],
  ['拖延', 'procrastinate', 'procrastination'],
  ['家人', '家裡', 'family'],
  ['學校', 'school'],
  ['運動', 'exercise', 'workout'],
  ['散步', '走路', 'walk'],
];

// each member, tokenized once: how to spot it in a query and which terms to add for it
const SYN_GROUPS = SYNONYMS.map((group) =>
  group.map((member) => {
    const norm = normalizeText(member);
    const toks = tokenize(member);
    if (CJK.test(norm)) {
      const bis = toks.filter((t) => t.kind === 'bi').map((t) => t.term);
      return { cjk: norm, add: bis.length ? bis : [norm] };
    }
    return { words: toks.map((t) => t.term), add: toks.map((t) => t.term) };
  })
);

// A run of Chinese with the filler characters removed: 好累, 很累 and 累了 all come down to 累.
const content = (run) => [...run].filter((c) => !STOP_ZH.has(c) && !INTENSIFIER.has(c)).join('');

// Turns what was typed into weighted terms.
// Returns { terms: Map(term -> { weight, strong }), phrase, prefix }. Only a "strong" term can
// bring an item into the results; weak ones (filler words, single characters taken out of a
// longer Chinese query) only adjust the order.
export function parseQuery(query, { prefix = false, synonyms = true } = {}) {
  const text = String(query ?? '').slice(0, MAX_QUERY_CHARS);
  const toks = tokenize(text).slice(0, MAX_QUERY_TOKENS);
  const out = new Map();
  const put = (term, weight, strong) => {
    const cur = out.get(term);
    if (!cur) out.set(term, { weight, strong });
    else {
      cur.weight = Math.max(cur.weight, weight);
      cur.strong = cur.strong || strong;
    }
  };
  const words = new Set();
  const runs = new Set();
  for (const t of toks) {
    if (t.kind === 'word') {
      const stop = STOP_EN.has(t.raw);
      put(t.term, stop ? WEAK_WEIGHT : 1, !stop);
      words.add(t.term);
    } else if (t.kind === 'num') put(t.term, 1, true);
    else if (t.kind === 'uni') {
      runs.add(t.run);
      const stop = STOP_ZH.has(t.term);
      if ([...t.run].length === 1) put(t.term, stop ? WEAK_WEIGHT : 1, !stop);
      else if (content(t.run) === t.term) put(t.term, 1, true); // 好累 is a search for 累
      else if (!stop) put(t.term, UNIGRAM_IN_RUN_WEIGHT, false);
    } else {
      const stop = [...t.term].some((c) => STOP_ZH.has(c));
      put(t.term, stop ? WEAK_WEIGHT : 1, !stop);
    }
  }
  if (synonyms) {
    for (const group of SYN_GROUPS) {
      const hit = group.filter((m) => (m.cjk ? ([...m.cjk].length > 1 ? [...runs].some((r) => r.includes(m.cjk)) : [...runs].some((r) => content(r) === m.cjk)) : m.words.every((w) => words.has(w))));
      if (!hit.length) continue;
      for (const m of group) {
        if (hit.includes(m)) continue;
        for (const term of m.add) put(term, SYNONYM_WEIGHT / m.add.length, true);
      }
    }
  }
  // a query made only of filler ("the", 我的) still searches for what was typed
  if (out.size && ![...out.values()].some((v) => v.strong)) for (const v of out.values()) v.strong = true;
  // while typing, the last unfinished English word also matches words that start with it
  const last = toks[toks.length - 1];
  const open = prefix && last && last.kind === 'word' && last.end === text.length && last.raw.length >= 2 ? last.raw : null;
  return { terms: out, phrase: normalizeText(text), prefix: open };
}

// Does `phrase` occur in `norm` as written? English must match whole words; Chinese may start
// anywhere. One word (or one character) alone is not a phrase.
function hasPhrase(norm, phrase) {
  if (!phrase || (!phrase.includes(' ') && [...phrase].filter((c) => CJK.test(c)).length < 2)) return false;
  const edge = (c) => c === undefined || c === ' ' || CJK.test(c);
  for (let at = norm.indexOf(phrase); at !== -1; at = norm.indexOf(phrase, at + 1)) {
    const before = CJK.test(phrase[0]) || edge(norm[at - 1]);
    const after = CJK.test(phrase[phrase.length - 1]) || edge(norm[at + phrase.length]);
    if (before && after) return true;
  }
  return false;
}

// ---------- index ----------
// A document is { id, date?, fields: { name: text } } plus anything else the caller wants back.
// `fields` here gives each field's weight; a term found in a heavier field counts for more.
export function createIndex({ fields = { text: 1 }, k1 = K1, b = B, phraseBoost = PHRASE_BOOST, recencyWeight = RECENCY_WEIGHT, halfLifeDays = HALF_LIFE_DAYS } = {}) {
  const docs = new Map(); // id -> { doc, tf: Map, len, norm: [], sig }
  const postings = new Map(); // term -> Map(id -> weighted term frequency)
  let totalLen = 0;

  const signature = (doc) => JSON.stringify([doc.date ?? null, Object.keys(fields).map((f) => (doc.fields && doc.fields[f]) || '')]);

  function remove(id) {
    const d = docs.get(id);
    if (!d) return false;
    for (const term of d.tf.keys()) {
      const p = postings.get(term);
      p.delete(id);
      if (!p.size) postings.delete(term);
    }
    totalLen -= d.len;
    docs.delete(id);
    return true;
  }

  function add(doc) {
    remove(doc.id);
    const tf = new Map();
    const norm = [];
    let len = 0;
    for (const [name, weight] of Object.entries(fields)) {
      const text = (doc.fields && doc.fields[name]) || '';
      if (!text) continue;
      const toks = tokenize(text);
      for (const t of toks) tf.set(t.term, (tf.get(t.term) || 0) + weight);
      len += weight * toks.length;
      norm.push(normalizeText(text));
    }
    for (const [term, f] of tf) {
      if (!postings.has(term)) postings.set(term, new Map());
      postings.get(term).set(doc.id, f);
    }
    totalLen += len;
    docs.set(doc.id, { doc, tf, len, norm, sig: signature(doc) });
  }

  // Bring the index in line with a fresh list: only what changed is touched.
  function sync(list) {
    const seen = new Set();
    let added = 0;
    let removed = 0;
    for (const doc of list) {
      seen.add(doc.id);
      const cur = docs.get(doc.id);
      if (cur && cur.sig === signature(doc)) {
        cur.doc = doc;
        continue;
      }
      add(doc);
      added++;
    }
    for (const id of [...docs.keys()]) if (!seen.has(id) && remove(id)) removed++;
    return { added, removed };
  }

  function search(query, { limit = Infinity, now = Date.now(), filter = null, prefix = false, synonyms = true } = {}) {
    const q = query && typeof query === 'object' ? query : parseQuery(query, { prefix, synonyms });
    const N = docs.size;
    if (!N || !q.terms.size) return [];
    const avg = totalLen / N || 1;
    const acc = new Map();
    const score = (term, weight, strong) => {
      const p = postings.get(term);
      if (!p) return;
      const idf = Math.log(1 + (N - p.size + 0.5) / (p.size + 0.5));
      for (const [id, f] of p) {
        const d = docs.get(id);
        if (filter && !filter(d.doc)) continue;
        const s = (weight * idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / avg));
        const a = acc.get(id) || { bm25: 0, strong: false };
        a.bm25 += s;
        a.strong = a.strong || strong;
        acc.set(id, a);
      }
    };
    for (const [term, { weight, strong }] of q.terms) score(term, weight, strong);
    if (q.prefix) {
      for (const term of postings.keys()) {
        if (term.length > q.prefix.length && term.startsWith(q.prefix) && !q.terms.has(term) && /^[a-z]/.test(term)) score(term, PREFIX_WEIGHT, true);
      }
    }
    const results = [];
    for (const [id, a] of acc) {
      if (!a.strong) continue;
      const d = docs.get(id);
      const phrase = d.norm.some((n) => hasPhrase(n, q.phrase));
      const ageDays = Number.isFinite(d.doc.date) ? Math.max(0, (now - d.doc.date) / 86400000) : null;
      const recency = ageDays === null ? 0 : Math.pow(0.5, ageDays / halfLifeDays);
      results.push({ id, doc: d.doc, bm25: a.bm25, phrase, score: a.bm25 * (1 + (phrase ? phraseBoost : 0)) * (1 + recencyWeight * recency) });
    }
    results.sort((x, y) => y.score - x.score || (y.doc.date || 0) - (x.doc.date || 0) || (x.id < y.id ? -1 : 1));
    return results.slice(0, limit);
  }

  return {
    add,
    remove,
    sync,
    search,
    has: (id) => docs.has(id),
    get: (id) => (docs.get(id) || {}).doc,
    clear: () => {
      docs.clear();
      postings.clear();
      totalLen = 0;
    },
    get size() {
      return docs.size;
    },
  };
}

// ---------- snippets ----------
// Cuts a window out of `text` around the matches and splits it into plain and matched parts.
// The parts are slices of the original text: show them as text nodes (or through partsToHtml),
// never as markup.
export function highlight(text, query, { max = 96, prefix = false } = {}) {
  const s = String(text ?? '');
  const q = query && typeof query === 'object' ? query : parseQuery(query, { prefix });
  const strong = new Set([...q.terms].filter(([, v]) => v.strong).map(([term]) => term));
  const spans = [];
  for (const t of tokenize(s)) {
    const hit = strong.has(t.term) || (q.prefix && t.kind === 'word' && t.raw.startsWith(q.prefix));
    if (!hit) continue;
    const prev = spans[spans.length - 1];
    if (prev && t.start <= prev.end) prev.end = Math.max(prev.end, t.end);
    else spans.push({ start: t.start, end: t.end });
  }
  let from = 0;
  let to = s.length;
  if (s.length > max) {
    // the window that holds the most matches, starting a little before the first of them
    let best = 0;
    let bestCount = -1;
    for (const anchor of spans.length ? spans : [{ start: 0 }]) {
      const start = Math.max(0, Math.min(anchor.start - Math.floor(max / 4), s.length - max));
      const count = spans.filter((sp) => sp.start >= start && sp.end <= start + max).length;
      if (count > bestCount) {
        best = start;
        bestCount = count;
      }
    }
    from = best;
    to = Math.min(s.length, from + max);
    const first = spans.find((sp) => sp.start >= from);
    const wordChar = (i) => i >= 0 && i < s.length && /[\p{L}\p{Nd}\p{M}]/u.test(s[i]) && !CJK.test(s[i]);
    // do not start or stop in the middle of an English word, or of a surrogate pair
    for (let n = 0; from > 0 && n < 16 && wordChar(from - 1) && wordChar(from) && (!first || from < first.start); n++) from++;
    for (let n = 0; to < s.length && n < 16 && wordChar(to - 1) && wordChar(to) && !spans.some((sp) => sp.start < to && sp.end >= to); n++) to--;
    const low = (i) => s.charCodeAt(i) >= 0xdc00 && s.charCodeAt(i) <= 0xdfff;
    if (from > 0 && low(from)) from--;
    if (to < s.length && low(to)) to++;
  }
  const parts = [];
  const push = (t, hit) => t && parts.push({ text: t, hit });
  if (from > 0) push('…', false);
  let at = from;
  for (const sp of spans) {
    const a = Math.max(sp.start, from);
    const z = Math.min(sp.end, to);
    if (z <= a) continue;
    push(s.slice(at, a), false);
    push(s.slice(a, z), true);
    at = z;
  }
  push(s.slice(at, to), false);
  if (to < s.length) push('…', false);
  return { parts, count: spans.length };
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);
// For places without a DOM (tests, exports). The app itself builds text nodes instead.
export const partsToHtml = (parts) => parts.map((p) => (p.hit ? `<mark>${escapeHtml(p.text)}</mark>` : escapeHtml(p.text))).join('');

// ---------- the journal ----------
// What can be searched: notes on voice entries and silent check-ins, bedtime worries (present
// only when the person chose to keep them), kind things, and saved lens exercises.
export const JOURNAL_FIELDS = { text: 2, more: 1, title: 0.5 };

export function entryDoc(e) {
  if (!e || !e.note || !String(e.note).trim()) return null;
  return { id: `entry:${e.id}`, type: e.silent ? 'checkin' : 'voice', ref: e.id, date: e.createdAt, fields: { text: String(e.note) } };
}

export function journalDocs({ entries = [], nights = [], sessions = [] } = {}) {
  const docs = [];
  for (const e of entries) {
    const d = entryDoc(e);
    if (d) docs.push(d);
  }
  for (const n of nights) {
    if (n.worry && String(n.worry).trim()) docs.push({ id: `worry:${n.id}`, type: 'worry', ref: n.id, date: n.createdAt, fields: { text: String(n.worry) } });
    if (n.kindness && String(n.kindness).trim()) docs.push({ id: `kind:${n.id}`, type: 'kind', ref: n.id, date: n.createdAt, fields: { text: String(n.kindness) } });
  }
  for (const s of sessions) {
    const lens = lensById(s.lensId);
    const answers = (s.answers || []).filter((a) => typeof a === 'string' && !isNonAnswer(a));
    if (!(s.concern && String(s.concern).trim()) && !answers.length) continue;
    docs.push({ id: `lens:${s.id}`, type: 'lens', ref: s.id, date: s.createdAt, lensId: s.lensId, fields: { text: String(s.concern || ''), more: answers.join('\n'), title: lens ? `${lens.zh.name} ${lens.en.name}` : '' } });
  }
  return docs;
}

const S = {
  'zh-TW': {
    label: '搜尋你寫過的內容',
    hint: '備註、只記心情、睡前的心事和對自己好的事、存下的練習。只在這個裝置上搜尋。',
    clear: '清除',
    count: (n, shown) => (n > shown ? `共 ${n} 筆，顯示前 ${shown} 筆` : `${n} 筆結果`),
    none: '找不到符合的內容。',
    loading: '正在整理……',
    results: '搜尋結果',
    types: { voice: '聲音紀錄的備註', checkin: '只記心情', worry: '睡前放下的心事', kind: '對自己好的一件事', lens: '換角度練習' },
    concern: '那時候的煩惱',
    answers: '你的回答',
    worry: '那天放下的心事',
    kind: '對自己好的一件事',
    mood: '心情',
    energy: '精神',
    close: '關閉',
    gone: '這一筆已經不在了。',
  },
  en: {
    label: 'Search what you wrote',
    hint: 'Notes, silent check-ins, bedtime worries and kind things, saved exercises. Searched on this device only.',
    clear: 'Clear',
    count: (n, shown) => (n > shown ? `${n} results, showing the first ${shown}` : n === 1 ? '1 result' : `${n} results`),
    none: 'Nothing matches.',
    loading: 'Getting ready…',
    results: 'Search results',
    types: { voice: 'Voice entry note', checkin: 'Silent check-in', worry: 'Bedtime worry', kind: 'Kind thing', lens: 'Lens exercise' },
    concern: 'The worry',
    answers: 'Your answers',
    worry: 'What you set down',
    kind: 'One kind thing',
    mood: 'Mood',
    energy: 'Energy',
    close: 'Close',
    gone: 'This item is no longer there.',
  },
};

const SHOWN = 30;

// The search field at the top of the Journal and its results.
// `openEntry(id, opener)` opens a voice entry; everything else opens in a sheet built here.
export function createJournalSearch({ h, getLang, db, getEntries, openEntry, openSheet, closeSheet }) {
  const index = createIndex({ fields: JOURNAL_FIELDS });
  const st = { q: '', ready: false, loading: null, sources: { entries: [], nights: [], sessions: [] }, dom: null, timer: null };
  const L = () => S[getLang()] || S.en;
  const lk = () => (getLang() === 'en' ? 'en' : 'zh');
  const fmt = (ts, opts = { dateStyle: 'medium' }) => new Intl.DateTimeFormat(getLang(), opts).format(new Date(ts));

  // Read what is stored now and bring the index in line with it. Called each time the Journal
  // is drawn, so items saved or removed on other screens are picked up.
  function refresh() {
    if (st.loading) return st.loading;
    st.loading = Promise.all([db.listEntries().catch(() => getEntries()), db.listNights().catch(() => []), db.listLensSessions().catch(() => [])])
      .then(([entries, nights, sessions]) => {
        st.sources = { entries, nights, sessions };
        const changed = index.sync(journalDocs(st.sources));
        const first = !st.ready;
        st.ready = true;
        if (first || changed.added || changed.removed) redrawKeepingFocus();
      })
      .catch(() => {
        st.ready = true;
      })
      .finally(() => {
        st.loading = null;
      });
    return st.loading;
  }

  function sheetFor(doc) {
    const src = st.sources;
    if (doc.type === 'checkin') {
      const e = src.entries.find((x) => x.id === doc.ref);
      if (!e) return null;
      const ratings = [Number.isFinite(e.mood) ? `${L().mood} ${e.mood}/7` : null, Number.isFinite(e.energy) ? `${L().energy} ${e.energy}/7` : null].filter(Boolean).join(' · ');
      return [h('h2', {}, L().types.checkin), h('p', { class: 'muted' }, fmt(e.createdAt, { dateStyle: 'medium', timeStyle: 'short' })), ratings ? h('p', { class: 'muted' }, ratings) : null, h('blockquote', { class: 'detail-note' }, e.note)];
    }
    if (doc.type === 'worry' || doc.type === 'kind') {
      const n = src.nights.find((x) => x.id === doc.ref);
      if (!n) return null;
      return [h('h2', {}, L().types[doc.type]), h('p', { class: 'muted' }, fmt(n.createdAt, { dateStyle: 'long' })), n.worry ? [h('h3', {}, L().worry), h('blockquote', { class: 'detail-note' }, n.worry)] : null, n.kindness ? [h('h3', {}, L().kind), h('p', {}, n.kindness)] : null];
    }
    if (doc.type === 'lens') {
      const s = src.sessions.find((x) => x.id === doc.ref);
      if (!s) return null;
      const lens = lensById(s.lensId);
      const steps = lens ? lens[lk()].steps : [];
      return [
        h('h2', {}, lens ? lens[lk()].name : L().types.lens),
        h('p', { class: 'muted' }, `${L().types.lens} · ${fmt(s.createdAt)}`),
        s.concern ? [h('h3', {}, L().concern), h('blockquote', { class: 'detail-note' }, s.concern)] : null,
        h('h3', {}, L().answers),
        h('ol', { class: 'plain-list' }, (s.answers || []).map((a, i) => h('li', {}, steps[i] ? [h('span', { class: 'muted small' }, steps[i].q), h('br')] : null, String(a ?? '–') || '–'))),
      ];
    }
    return null;
  }

  function open(doc, button) {
    // Safari does not focus a tapped button; focus it so closing the sheet can come back here
    button.focus();
    if (doc.type === 'voice') return openEntry(doc.ref, button);
    openSheet(() => [sheetFor(doc) || h('p', { class: 'empty' }, L().gone), h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn', onclick: closeSheet }, L().close))]);
  }

  function snippet(doc, q) {
    let best = null;
    for (const f of ['text', 'more', 'title']) {
      const text = doc.fields[f];
      if (!text) continue;
      const hl = highlight(text, q);
      if (hl.count) return hl;
      best = best || hl;
    }
    return best || { parts: [], count: 0 };
  }

  // Fill the results under the field, without redrawing the page (the field keeps its focus).
  function draw(fresh = false) {
    const dom = st.dom;
    // a late answer from storage must not touch a page that has since been redrawn or left
    if (!dom || (!fresh && !dom.wrap.isConnected)) return;
    const query = st.q.trim();
    dom.clear.hidden = !st.q;
    dom.wrap.classList.toggle('searching', !!query);
    dom.results.hidden = !query;
    dom.list.replaceChildren();
    if (!query) {
      dom.count.textContent = '';
      return;
    }
    if (!st.ready) {
      dom.count.textContent = L().loading;
      return;
    }
    const q = parseQuery(query, { prefix: true });
    const found = index.search(q);
    const shown = found.slice(0, SHOWN);
    dom.count.textContent = found.length ? L().count(found.length, shown.length) : L().none;
    for (const r of shown) {
      const lens = r.doc.type === 'lens' ? lensById(r.doc.lensId) : null;
      const type = L().types[r.doc.type] + (lens ? ` · ${lens[lk()].name}` : '');
      const button = h(
        'button',
        { type: 'button', class: 'search-hit', 'data-key': `hit-${r.id}`, onclick: (ev) => open(r.doc, ev.currentTarget) },
        h('span', { class: 'search-meta' }, `${fmt(r.doc.date)} · ${type}`),
        // every piece is a text node; what the person wrote is never parsed as markup
        h('span', { class: 'search-snippet' }, snippet(r.doc, q).parts.map((p) => (p.hit ? h('mark', {}, p.text) : p.text)))
      );
      dom.list.appendChild(h('li', {}, button));
    }
  }

  // after storage is read again: redraw, and keep focus on the same result if it is still there
  function redrawKeepingFocus() {
    const a = document.activeElement;
    const key = a && st.dom && st.dom.list.contains(a) ? a.dataset.key : null;
    draw();
    if (!key) return;
    const again = [...st.dom.list.querySelectorAll('.search-hit')].find((n) => n.dataset.key === key);
    (again || st.dom.input).focus();
  }

  function moveFocus(ev) {
    const hits = [...st.dom.list.querySelectorAll('.search-hit')];
    const at = hits.indexOf(document.activeElement);
    if (ev.key === 'Escape' && st.q) {
      ev.preventDefault();
      setQuery('');
      st.dom.input.focus();
    } else if (ev.key === 'ArrowDown' || (ev.key === 'Enter' && ev.target === st.dom.input && !ev.isComposing)) {
      if (!hits.length) return;
      ev.preventDefault();
      hits[Math.min(at + 1, hits.length - 1)].focus();
    } else if (ev.key === 'ArrowUp' && at !== -1) {
      ev.preventDefault();
      (at === 0 ? st.dom.input : hits[at - 1]).focus();
    }
  }

  function setQuery(value) {
    st.q = value;
    if (st.dom && st.dom.input.value !== value) st.dom.input.value = value;
    clearTimeout(st.timer);
    draw();
  }

  // `wrap` is the Journal section: while a query is typed it gets the class `searching`, which
  // hides the rest of the Journal so the results are all there is to read.
  function view(wrap) {
    const input = h('input', {
      id: 'journal-search-input',
      type: 'search',
      'data-key': 'journal-search',
      maxlength: String(MAX_QUERY_CHARS),
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      enterkeyhint: 'search',
      'aria-describedby': 'journal-search-hint',
      'aria-controls': 'journal-search-results',
      oninput: (e) => {
        st.q = e.target.value;
        clearTimeout(st.timer);
        // a short wait, so a screen reader hears one count and not one per keystroke
        st.timer = setTimeout(() => draw(), 120);
      },
    });
    input.value = st.q;
    const clear = h('button', { type: 'button', class: 'link search-clear', 'data-key': 'journal-search-clear', onclick: () => (setQuery(''), input.focus()) }, L().clear);
    const count = h('p', { class: 'search-count', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const list = h('ul', { class: 'search-list', 'aria-label': L().results });
    const results = h('div', { class: 'search-results', id: 'journal-search-results' }, list);
    const box = h('div', { class: 'journal-search', role: 'search', onkeydown: moveFocus }, h('label', { for: 'journal-search-input' }, L().label), h('div', { class: 'search-row' }, input, clear), h('p', { class: 'muted small', id: 'journal-search-hint' }, L().hint), count, results);
    st.dom = { wrap, input, clear, count, list, results };
    wrap.appendChild(box);
    // results are drawn at once from the index in memory, so focus can return to a result after
    // a redraw; storage is read again in the background
    draw(true);
    refresh();
    return box;
  }

  return {
    view,
    refresh,
    // kept in step right away when the app itself saves or deletes an entry
    entrySaved: (entry) => {
      st.sources.entries = st.sources.entries.filter((e) => e.id !== entry.id).concat(entry);
      const doc = entryDoc(entry);
      if (doc) index.add(doc);
      else index.remove(`entry:${entry.id}`);
    },
    entryDeleted: (id) => {
      st.sources.entries = st.sources.entries.filter((e) => e.id !== id);
      index.remove(`entry:${id}`);
    },
    reset: () => {
      index.clear();
      st.sources = { entries: [], nights: [], sessions: [] };
      st.q = '';
      st.ready = false;
    },
    size: () => index.size,
  };
}
