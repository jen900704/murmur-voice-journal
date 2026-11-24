// Tokenizer for English and Traditional Chinese, sentence splitting, and language detection.
// Every token keeps its position in the original text so that the words behind a score can be
// highlighted exactly. URLs, e-mail addresses, @mentions and #hashtags are left out of scoring
// (they stay in the text that is displayed).

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
// does not use. The word lists are Traditional, so Simplified text would be undercounted.
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

// Longest-match segmentation of a run of Chinese characters. dict: { set, maxLen }.
function segmentCjk(run, offset, dict, out) {
  const maxLen = dict ? dict.maxLen : 1;
  let i = 0;
  while (i < run.length) {
    let len = 1;
    if (dict) {
      for (let L = Math.min(maxLen, run.length - i); L > 1; L--) {
        if (dict.set.has(run.substr(i, L))) {
          len = L;
          break;
        }
      }
    }
    out.push({ t: run.substr(i, len), start: offset + i, end: offset + i + len, kind: 'z' });
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
    if (c >= 0x3400) segmentCjk(raw, m.index, dict, out);
    else if (c >= 48 && c <= 57) out.push({ t: raw, start: m.index, end: m.index + raw.length, kind: 'n' });
    else out.push({ t: raw.toLowerCase().replace(/’/g, "'"), start: m.index, end: m.index + raw.length, kind: 'w' });
  }
  return out;
}

export function makeDict(words) {
  const set = new Set();
  let maxLen = 1;
  for (const w of words) {
    if (!w) continue;
    set.add(w);
    if (w.length > maxLen) maxLen = w.length;
  }
  return { set, maxLen };
}
