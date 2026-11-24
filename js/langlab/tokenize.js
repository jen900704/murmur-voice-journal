// Tokenizer for English and Traditional Chinese, sentence splitting, and language detection.
// Every token keeps its position in the original text so that the words behind a score can be
// highlighted exactly. URLs, e-mail addresses, @mentions and #hashtags are left out of scoring
// (they stay in the text that is displayed).

import { ZH_S2T_SAFE, ZH_S2T_VARIANT } from './zh-s2t.js';

const CJK_RUN = '[\\u3400-\\u9fff\\uf900-\\ufaff]+';
const TOKEN_RE = new RegExp(`[A-Za-z\\u00c0-\\u024f]+(?:['\\u2019][A-Za-z]+)*|\\d+(?:[.,]\\d+)*|${CJK_RUN}`, 'g');
const MASK_RE = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[\w.+-]+@[\w-]+\.[\w.-]+|@[\w.]*\w|#[\p{L}\p{N}_]+/gu;

export function maskSpans(text) {
  const out = [];
  for (const m of String(text).matchAll(MASK_RE)) {
    const s = m[0];
    const type = s[0] === '@' ? 'mention' : s[0] === '#' ? 'hashtag' : /^[\w.+-]+@/.test(s) && !/^https?:/.test(s) ? 'email' : 'url';
    out.push({ start: m.index, end: m.index + s.length, type });
  }
  return out;
}

// The same text with masked spans turned into spaces, so positions do not move.
export function maskText(text) {
  return String(text).replace(MASK_RE, (m) => ' '.repeat(m.length));
}

// 'zh', 'en', or 'other' (not enough of either, or a script the word lists do not cover).
export function detectLanguage(text) {
  const s = maskText(text);
  let cjk = 0;
  let kana = 0;
  let otherScript = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if ((c >= 0x3400 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff)) cjk++;
    else if (c >= 0x3040 && c <= 0x30ff) kana++;
    else if ((c >= 0xac00 && c <= 0xd7af) || (c >= 0x0400 && c <= 0x04ff) || (c >= 0x0600 && c <= 0x06ff) || (c >= 0x0e00 && c <= 0x0e7f) || (c >= 0x0900 && c <= 0x097f)) otherScript++;
  }
  const latinWords = (s.match(/[A-Za-zÀ-ɏ]+/g) || []).length;
  if (kana > 0 && kana >= 0.1 * (cjk + kana)) return 'other';
  if (otherScript > cjk + latinWords) return 'other';
  if (cjk === 0 && latinWords === 0) return 'other';
  return cjk >= latinWords ? 'zh' : 'en';
}

// A rough check for Simplified Chinese: a few very common characters that Traditional text
// does not use. The word lists were written for Traditional Chinese. Simplified text is read
// through a character map (toTraditional below), which covers the list words but not usage
// that differs between the two (mainland wording that the lists do not have).
const SIMPLIFIED = /[们这说没为时来个会对还过吗么让给觉现样问题间关东见长门开难车马鸟龙应该爱亲习业专两办边写买卖话语读课谁请让认识记讲计许论设试该调谈谢贝贵费资赶转软轻输边达迁过运进远连选递邮释里钟钱银错长门问间闻闹阳阴队际难须顾风飞饭饮马验鱼鸡]/g;
export function looksSimplified(text) {
  const s = String(text);
  const hits = (s.match(SIMPLIFIED) || []).length;
  const cjk = (s.match(/[㐀-鿿]/g) || []).length;
  // the list above includes characters shared by both scripts on purpose only where rare in Traditional;
  // ask for a clear share before saying anything
  const strict = (s.match(/[们这说没为时个会对还过吗么让给觉现样]/g) || []).length;
  return cjk >= 10 && strict >= 3 && hits / cjk >= 0.08;
}

export function splitSentences(text) {
  const s = String(text);
  const out = [];
  const re = /[^.!?。！？…\n]+(?:[.!?。！？…]+(?=["'”’」』）)\s]|$)["'”’」』）)]*|[。！？…]+|\n+|$)|[.!?。！？…\n]+/g;
  // simpler and safer: walk the text and cut at sentence-final marks
  let start = 0;
  const cut = (end) => {
    let a = start;
    let b = end;
    while (a < b && /\s/.test(s[a])) a++;
    while (b > a && /\s/.test(s[b - 1])) b--;
    if (b > a && /[\p{L}\p{N}]/u.test(s.slice(a, b))) out.push({ start: a, end: b });
    start = end;
  };
  void re;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\n') {
      cut(i + 1);
    } else if ('。！？'.includes(ch)) {
      while (i + 1 < s.length && '。！？…」』）'.includes(s[i + 1])) i++;
      cut(i + 1);
    } else if ('.!?…'.includes(ch)) {
      while (i + 1 < s.length && '.!?…"\'”’)'.includes(s[i + 1])) i++;
      // a full stop inside a number or abbreviation is followed by a letter or digit: not an end
      if (i + 1 >= s.length || /\s/.test(s[i + 1]) || ch !== '.') cut(i + 1);
    }
  }
  cut(s.length);
  return out;
}

// ---------- Simplified to Traditional, for matching only ----------
const pairMap = (str) => {
  const m = new Map();
  const chars = [...str];
  for (let k = 0; k + 1 < chars.length; k += 2) m.set(chars[k], chars[k + 1]);
  return m;
};
const S2T = pairMap(ZH_S2T_SAFE);
const VARIANT = pairMap(ZH_S2T_VARIANT);
const S2T_RE = new RegExp('[' + [...S2T.keys()].join('') + ']', 'g');

// Simplified characters that Traditional text never uses are replaced by the Traditional
// character the word lists use. One character for one, so positions do not move. Characters
// that both scripts use with different meanings (后, 里, 干, 准) are left alone here and are
// handled by alias spellings of whole words (variantSpelling).
export function toTraditional(text) {
  return String(text).replace(S2T_RE, (ch) => S2T.get(ch));
}

// How a list word looks when it was typed in Simplified and has gone through toTraditional:
// 頭髮 arrives as 頭發, 以後 as 以后, 乾淨 as 干淨. Null when the word does not change.
export function variantSpelling(word) {
  let out = '';
  let changed = false;
  for (const ch of word) {
    const v = VARIANT.get(ch);
    if (v) changed = true;
    out += v || ch;
  }
  return changed ? out : null;
}

// Longest-match segmentation of a run of Chinese characters.
// dict: { set, maxLen, guards, heads, alias } from makeDict.
//
// A guard is a frequent word with no category (ZH_COMMON). It exists so that a character or a
// shorter word inside it is not counted (天氣 keeps 氣 from being read alone, 經過 keeps 過世 out
// of 經過世界). Some guards are only a degree word plus the next character (很難, 很高, 太空, 最後,
// 一下). Such a guard must not eat the first character of a category word that runs past its
// end: 很難 + 過 would lose 難過, 很高 + 興 would lose 高興. So when the longest match is a guard
// that begins with a loose head (ZH_LOOSE_HEADS) and a category word starts right after the head
// and crosses the end of the guard, the text is cut after the head instead: 很 + 難過.
// One exception keeps the guard: a word of two or more characters starts right after the guard
// and reaches further than the crossing word (很難 + 過去, 最後 + 來不及 stay as they are).
// Guards that do not begin with a loose head always win, as before.
function segmentCjk(run, offset, dict, out) {
  if (!dict) {
    for (let i = 0; i < run.length; i++) out.push({ t: run[i], start: offset + i, end: offset + i + 1, kind: 'z' });
    return;
  }
  const { set, maxLen, guards, heads, alias } = dict;
  const n = run.length;
  const canon = (s) => (alias && alias.get(s)) || s;
  // longest dictionary word starting at i within `limit` characters; lexOnly skips guards
  const longest = (i, limit, lexOnly) => {
    for (let L = Math.min(maxLen, limit); L > 1; L--) {
      const s = run.substr(i, L);
      if (set.has(s) && !(lexOnly && guards.has(canon(s)))) return L;
    }
    return 1;
  };
  let i = 0;
  while (i < n) {
    let len = longest(i, n - i, false);
    if (len > 1 && heads && guards && heads.has(run[i]) && guards.has(canon(run.substr(i, len)))) {
      const end = i + len;
      const cross = longest(i + 1, n - i - 1, true);
      if (cross > 1 && i + 1 + cross > end) {
        const next = end < n ? longest(end, n - end, false) : 1;
        if (!(next > 1 && end + next > i + 1 + cross)) len = 1;
      }
    }
    const surface = run.substr(i, len);
    out.push({ t: canon(surface), start: offset + i, end: offset + i + len, kind: 'z' });
    i += len;
  }
}

// Tokens: { t (lowercase, straight apostrophe), start, end, kind: 'w' Latin word, 'n' number, 'z' Chinese }
export function tokenize(text, dict = null) {
  const s = maskText(text);
  const out = [];
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(s))) {
    const raw = m[0];
    const c = raw.charCodeAt(0);
    if (c >= 0x3400) segmentCjk(toTraditional(raw), m.index, dict, out);
    else if (c >= 48 && c <= 57) out.push({ t: raw, start: m.index, end: m.index + raw.length, kind: 'n' });
    else out.push({ t: raw.toLowerCase().replace(/’/g, "'"), start: m.index, end: m.index + raw.length, kind: 'w' });
  }
  return out;
}

// words: every word used for cutting. guards: the ones among them that carry no category.
// heads: single characters after which a guard may give way (see segmentCjk).
// Words with a character that Simplified text spells differently also get an alias spelling
// that points back to the list word; a token always carries the list spelling.
export function makeDict(words, guards = null, heads = null) {
  const set = new Set();
  let maxLen = 1;
  for (const w of words) {
    if (!w) continue;
    set.add(w);
    if (w.length > maxLen) maxLen = w.length;
  }
  const alias = new Map();
  for (const w of [...set]) {
    if (w.length < 2) continue; // one character alone is too ambiguous (干 is 幹, 乾 or 干)
    const v = variantSpelling(w);
    if (v && !set.has(v) && !alias.has(v)) alias.set(v, w);
  }
  for (const v of alias.keys()) set.add(v);
  return { set, maxLen, guards: guards ? new Set(guards) : null, heads: heads && guards ? new Set(heads) : null, alias: alias.size ? alias : null };
}
