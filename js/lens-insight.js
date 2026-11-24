// Small, explainable helpers for 換角度. No model, no network: every suggestion points
// back to the exact words that triggered it, and when nothing matches it says nothing.
//
// - suggestLenses: which ways of looking fit what the person wrote, with the matched span
// - heavinessShift: before/after "how heavy does this feel" (0-10), framed as how it feels now
// - onlyHere: what one lens's answers contain that another lens's answers do not
// - relatedSessions: earlier looks at a similar worry, by character-bigram overlap
// - selfFocus: share of first-person words, to show what a distancing step changed

import { checkRisk } from './safety.js';

// Cue words that suggest a lens may fit. Hand-written from each approach's core questions
// (Corey, Theory and Practice of Counseling and Psychotherapy). A cue is a hint, not a rule.
export const CUES = {
  psychoanalytic: { zh: ['又來了', '總是這樣', '從小', '小時候', '以前也', '一樣的模式', '重複', '每次都'], en: ['again', 'always happens', 'childhood', 'as a kid', 'same pattern', 'every time', 'growing up'] },
  adlerian: { zh: ['比不上', '不夠好', '被接納', '歸屬', '證明自己', '比較', '自卑', '被看見', '貢獻'], en: ['not good enough', 'compare', 'belong', 'prove myself', 'inferior', 'fit in', 'contribute'] },
  existential: { zh: ['意義', '為什麼要', '人生', '自由', '選擇', '未來', '活著', '空虛', '方向'], en: ['meaning', 'purpose', 'the point', 'my life', 'freedom', 'choice', 'future', 'empty', 'direction'] },
  'person-centered': { zh: ['沒人懂', '不被理解', '真正的自己', '委屈', '假裝', '做自己', '被接受', '討好'], en: ['nobody understands', 'not understood', 'real me', 'pretend', 'be myself', 'accepted', 'people pleas'] },
  gestalt: { zh: ['說不出口', '想對他說', '想對她說', '胸口', '身體', '卡住', '沒說完', '悶'], en: ["can't say", 'wish i told', 'never said', 'chest', 'body', 'stuck', 'unfinished', 'tight'] },
  behavioral: { zh: ['拖延', '習慣', '起不來', '一直滑', '做不到', '開始', '作息', '運動', '戒'], en: ['procrastinat', 'habit', "can't start", 'scroll', 'routine', 'exercise', 'quit', 'keep putting off'] },
  acceptance: { zh: ['一直想', '停不下來', '控制不了', '腦袋', '想太多', '甩不掉', '反覆想', '睡不著'], en: ['overthink', "can't stop thinking", 'control', 'my head', 'ruminat', 'keep thinking', "can't sleep"] },
  rebt: { zh: ['應該', '必須', '一定要', '受不了', '太糟了', '不可以', '絕對'], en: ['should', 'must', 'have to', "can't stand", 'terrible', 'awful', 'unbearable'] },
  cognitive: { zh: ['一定會', '搞砸', '都是我的錯', '大家都覺得', '失敗', '永遠', '完蛋', '每個人都'], en: ['will fail', 'mess up', 'my fault', 'everyone thinks', 'failure', 'never', 'ruined', 'everybody'] },
  reality: { zh: ['想要', '能做什麼', '有用嗎', '計畫', '怎麼辦', '做得到的'], en: ['what i want', 'plan', 'what can i do', 'is it working', 'what should i do'] },
  feminist: { zh: ['女生', '男生', '性別', '不公平', '被期待', '權力', '媳婦', '身為女'], en: ['gender', 'unfair', 'expected to', 'as a woman', 'as a man', 'power', 'role'] },
  'solution-focused': { zh: ['以前做到', '比較好的時候', '目標', '一小步', '有一次', '還好的時候'], en: ['worked before', 'better days', 'goal', 'small step', 'one time', 'when it was okay'] },
  narrative: { zh: ['我就是', '這種人', '標籤', '被說成', '故事', '我是個', '一直被當成'], en: ["i'm the kind of", 'that kind of person', 'label', 'story', 'i am a', 'always been'] },
  'family-systems': { zh: ['爸', '媽', '家人', '兄弟', '姊妹', '夾在中間', '家裡', '阿嬤', '爺爺', '奶奶'], en: ['parents', 'mom', 'dad', 'sibling', 'caught in the middle', 'family', 'brother', 'sister'] },
};

const low = (s) => String(s || '').toLowerCase();

function snippet(text, at, len) {
  const start = Math.max(0, at - 8);
  const end = Math.min(text.length, at + len + 8);
  return { before: (start > 0 ? '…' : '') + text.slice(start, at), match: text.slice(at, at + len), after: text.slice(at + len, end) + (end < text.length ? '…' : '') };
}

// Suggest lenses for this text. Returns at most `max` lenses, each with the spans that
// matched. allowed: lens ids that fit the chosen topics (others are never suggested).
export function suggestLenses(text, { allowed = null, max = 3 } = {}) {
  const raw = String(text || '');
  if (!raw.trim() || checkRisk(raw).risk) return [];
  const t = low(raw);
  const out = [];
  for (const [id, cue] of Object.entries(CUES)) {
    if (allowed && !allowed.includes(id)) continue;
    const hits = [];
    for (const w of [...cue.zh, ...cue.en]) {
      const at = t.indexOf(low(w));
      // latin cues must start at a word boundary
      if (at < 0 || (/[a-z]/.test(w[0]) && at > 0 && /[a-z]/.test(t[at - 1]))) continue;
      if (hits.some((h) => at >= h.at && at < h.at + h.len)) continue;
      hits.push({ word: w, at, len: w.length });
    }
    if (hits.length) {
      hits.sort((a, b) => a.at - b.at);
      out.push({ id, score: hits.length, evidence: hits.slice(0, 2).map((h) => ({ word: h.word, ...snippet(raw, h.at, h.len) })) });
    }
  }
  out.sort((a, b) => b.score - a.score || a.evidence[0].match.localeCompare(b.evidence[0].match));
  return out.slice(0, max);
}

// Before/after heaviness, 0-10. Returns null unless both are numbers.
export function heavinessShift(before, after) {
  if (typeof before !== 'number' || typeof after !== 'number') return null;
  const d = after - before;
  return { before, after, delta: d, direction: d < 0 ? 'lighter' : d > 0 ? 'heavier' : 'same' };
}

// Tokens for overlap: Latin words of 3+ letters and CJK character bigrams.
const STOP_ZH = new Set(['自己', '一個', '這個', '那個', '什麼', '因為', '所以', '然後', '可是', '但是', '覺得', '就是', '沒有', '不是', '可以', '還是', '我們', '他們', '一點', '一下', '的時', '時候', '如果', '真的', '這樣', '那樣']);
const STOP_EN = new Set(['the', 'and', 'that', 'this', 'with', 'for', 'was', 'are', 'but', 'not', 'you', 'have', 'just', 'about', 'what', 'when', 'like', 'from', 'they', 'feel', 'really', 'would', 'there', 'been', 'myself']);
export function tokens(text) {
  const t = low(text);
  const out = new Set();
  for (const w of t.match(/[a-z][a-z']{2,}/g) || []) if (!STOP_EN.has(w)) out.add(w);
  for (const run of t.match(/[㐀-鿿]+/g) || []) {
    for (let i = 0; i + 1 < run.length; i++) {
      const bg = run.slice(i, i + 2);
      if (!STOP_ZH.has(bg)) out.add(bg);
    }
  }
  return out;
}

export function overlap(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

// Answers in `mine` that share little with everything in `other`: what only this lens
// brought up. Each answer is compared with the whole other set; at most two are returned.
export function onlyHere(mine = [], other = []) {
  const otherAll = other.filter(Boolean).join('\n');
  return mine
    .map((a, i) => ({ i, text: a, sim: overlap(a, otherAll) }))
    .filter((x) => x.text && x.text.trim().length >= 4 && x.sim < 0.12)
    .sort((x, y) => x.sim - y.sim)
    .slice(0, 2);
}

// Earlier sessions about a similar worry, most similar first.
export function relatedSessions(concern, sessions = [], { min = 0.12, max = 3, excludeId = null } = {}) {
  if (!concern || !String(concern).trim()) return [];
  return sessions
    .filter((s) => s && s.id !== excludeId && s.concern)
    .map((s) => ({ session: s, sim: overlap(concern, s.concern) }))
    .filter((x) => x.sim >= min)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, max);
}

// Share of first-person words among all words (zh: 我/我的/我們 per character count
// estimate; en: I, me, my, mine, myself). Used only to show a change, never as a score.
export function selfFocus(text) {
  const t = String(text || '');
  const en = t.match(/[A-Za-z']+/g) || [];
  const zhChars = (t.match(/[㐀-鿿]/g) || []).length;
  const enSelf = en.filter((w) => /^(i|me|my|mine|myself|i'm|i've|i'd|i'll)$/i.test(w)).length;
  const zhSelf = (t.match(/我/g) || []).length;
  // a Chinese word is about 1.5 characters on average
  const words = en.length + zhChars / 1.5;
  if (words < 5) return null;
  return (enSelf + zhSelf) / words;
}
