// Card pictures drawn from what the person wrote.
//
// readScene() turns the person's own words into a small scene: a backdrop for the topic,
// weather for how heavy it felt, up to three objects they actually mentioned, and a small
// companion. Every element that comes from their text keeps the word it came from, so the
// card can say why the picture looks the way it does ("the rain is from 下雨").
//
// Safety: if the text trips the risk screen, nothing is read from it and the scene is a
// plain calm one (lamp, stars). The object list only holds everyday, harmless things.
//
// sceneSvg() draws it. Original motifs only. With animate: true the SVG carries its own
// small animation (clouds drift aside, the companion hops, a few sparkles), wrapped in
// prefers-reduced-motion so it stays still for people who asked for less motion.

import { checkRisk } from './safety.js';

// word lists: [element, zh words, en words]
const OBJECTS = [
  ['cat', ['貓', '猫', '喵'], ['cat', 'kitten']],
  ['dog', ['狗'], ['dog', 'puppy']],
  ['coffee', ['咖啡', '拿鐵'], ['coffee', 'latte', 'espresso']],
  ['tea', ['茶', '奶茶', '珍奶'], ['tea', 'boba']],
  ['book', ['書', '读书', '讀書', '考試', '考试', '論文', '论文', '作業', '作业', '期末', '期中', '上課', '學校', '学校'], ['book', 'exam', 'study', 'thesis', 'homework', 'class', 'school', 'paper']],
  ['laptop', ['電腦', '电脑', '工作', '上班', '報告', '报告', '會議', '会议', '老闆', '老板', '主管', '公司', '加班', '專案', '专案', '面試', '面试', 'email', '郵件'], ['laptop', 'computer', 'work', 'job', 'meeting', 'boss', 'manager', 'office', 'project', 'interview', 'email', 'deadline']],
  ['phone', ['手機', '手机', '訊息', '讯息', '已讀', '已读', '電話', '电话', 'line', 'ig', '貼文'], ['phone', 'text', 'message', 'call', 'instagram', 'post']],
  ['clock', ['時間', '时间', '來不及', '来不及', '遲到', '迟到', '截止', '期限', '趕', '赶'], ['time', 'late', 'hurry', 'rush', 'clock']],
  ['house', ['家', '房間', '房间', '回家', '搬家', '租屋'], ['home', 'house', 'room', 'apartment', 'move']],
  ['plant', ['花', '植物', '盆栽', '樹', '树', '公園', '公园'], ['flower', 'plant', 'tree', 'park', 'garden']],
  ['letter', ['信', '卡片', '寫給'], ['letter', 'card', 'note']],
  ['music', ['音樂', '音乐', '歌', '唱', '彈', '吉他', '鋼琴'], ['music', 'song', 'sing', 'guitar', 'piano']],
  ['food', ['吃', '飯', '饭', '便當', '晚餐', '早餐', '午餐', '宵夜', '煮'], ['eat', 'food', 'dinner', 'lunch', 'breakfast', 'cook', 'meal']],
  ['bed', ['睡', '床', '失眠', '熬夜', '晚上'], ['sleep', 'bed', 'insomnia', 'night', 'tired']],
  ['bus', ['公車', '公车', '捷運', '捷运', '火車', '通勤', '開車', '开车', '高鐵'], ['bus', 'train', 'subway', 'commute', 'drive']],
  ['sea', ['海', '沙灘', '河', '湖'], ['sea', 'ocean', 'beach', 'lake', 'river']],
  ['mountain', ['山', '爬山', '登山'], ['mountain', 'hike', 'hill']],
  ['heart', ['喜歡', '喜欢', '愛', '爱', '想念', '暗戀', '在一起', '約會', '约会'], ['love', 'crush', 'miss', 'date', 'together']],
  ['gift', ['禮物', '礼物', '生日'], ['gift', 'present', 'birthday']],
  ['bike', ['腳踏車', '單車', '騎車'], ['bike', 'bicycle', 'cycling']],
  ['friends', ['朋友', '同學', '室友', '聚餐', '閨蜜'], ['friend', 'friends', 'roommate', 'classmate']],
  ['money', ['錢', '钱', '薪水', '房租', '帳單', '存款', '預算'], ['money', 'rent', 'salary', 'bill', 'bills', 'budget']],
  ['game', ['遊戲', '游戏', '打電動', '手遊', 'switch'], ['game', 'games', 'gaming']],
  ['suitcase', ['旅行', '出國', '旅遊', '行李', '機場'], ['trip', 'travel', 'airport', 'vacation', 'luggage']],
];

// How heavy the words are, by kind, so the weather fits the feeling: sad words bring rain,
// worried words wind, tired words fog, angry words a warm dusk.
const MOOD = {
  rain: ['難過', '难过', '傷心', '伤心', '哭', '孤單', '孤单', '寂寞', '失望', '委屈', '低落', '沮喪', '空虛', '後悔', '后悔', '想念', '分手', '過世', '走了', '下雨', 'sad', 'cry', 'lonely', 'alone', 'disappointed', 'regret', 'hurt', 'upset', 'grief', 'miss', 'breakup', 'rain'],
  wind: ['焦慮', '焦虑', '擔心', '担心', '害怕', '怕', '不安', '慌', '壓力', '压力', '緊張', '紧张', '崩潰', '崩溃', '來不及', 'anxious', 'anxiety', 'worried', 'worry', 'afraid', 'scared', 'nervous', 'panic', 'stress', 'stressed', 'overwhelmed'],
  fog: ['累', '心累', '疲倦', '疲憊', '沒力', '没力', '熬夜', '好睏', '提不起勁', 'tired', 'exhausted', 'drained', 'sleepy', 'numb'],
  dusk: ['生氣', '生气', '煩', '烦', '討厭', '讨厌', '吵架', '不公平', '火大', '氣死', 'angry', 'annoyed', 'mad', 'furious', 'fight', 'unfair'],
};
const LIGHT = ['開心', '开心', '放鬆', '放松', '感謝', '感谢', '謝謝', '谢谢', '安心', '輕鬆', '轻松', '期待', '好玩', '笑', '溫暖', '温暖', '舒服', '平靜', '平静', '踏實', '有希望', '晴', 'happy', 'relieved', 'grateful', 'thankful', 'calm', 'excited', 'glad', 'fun', 'laugh', 'warm', 'peaceful', 'hopeful', 'proud', 'sunny'];

const SETTINGS = { work: 'desk', relationship: 'bench', family: 'roof', self: 'path', loss: 'candle', other: 'field' };

// The small companion follows the topic unless the person named an animal themselves.
const COMPANIONS = { work: 'bun', relationship: 'bird', family: 'cat', self: 'sprout', loss: 'bird', other: 'cloudlet' };

const LENS_GLYPH = {
  psychoanalytic: 'iceberg',
  adlerian: 'bridge',
  existential: 'star',
  'person-centered': 'sun',
  gestalt: 'chair',
  behavioral: 'steps',
  acceptance: 'leaf',
  rebt: 'scale',
  cognitive: 'lens',
  reality: 'compass',
  feminist: 'circle',
  'solution-focused': 'ladder',
  narrative: 'book',
  'family-systems': 'knots',
};

const lower = (s) => String(s || '').toLowerCase();

// Find a word in the text. Latin words must stand alone ("cat" not in "category").
function findWord(text, word) {
  if (/[a-z]/i.test(word)) {
    const m = new RegExp(`(^|[^a-z])(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(s|es|ed|ing)?(?=$|[^a-z])`, 'i').exec(text);
    return m ? m.index + m[1].length : -1;
  }
  return text.indexOf(word);
}

// A short window of the person's text around a word, for the "why this picture" note.
function around(text, at, len) {
  const start = Math.max(0, at - 6);
  const end = Math.min(text.length, at + len + 6);
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '');
}

// Read the scene out of the person's words.
// texts: array of strings (concern, answers); topics: chosen topics; lensId: optional.
// shift: optional before/after heaviness change (negative = lighter), turns the weather.
export function readScene({ texts = [], topics = [], lensId = null, shift = null } = {}) {
  const raw = texts.filter(Boolean).join('\n');
  const text = lower(raw);
  const topic = topics.find((t) => SETTINGS[t]) || 'other';
  const base = {
    setting: SETTINGS[topic],
    topic,
    weather: 'clear',
    objects: [],
    companion: COMPANIONS[topic],
    lensGlyph: LENS_GLYPH[lensId] || null,
    evidence: [],
    calm: false,
  };
  if (raw && checkRisk(raw).risk) {
    // never draw from text that may be about being unsafe
    return { ...base, setting: 'field', weather: 'night', companion: 'lamp', calm: true };
  }
  // objects in the order the person mentioned them, at most three
  const found = [];
  for (const [el, zh, en] of OBJECTS) {
    let best = null;
    for (const w of [...zh, ...en]) {
      const at = findWord(text, lower(w));
      if (at >= 0 && (!best || at < best.at)) best = { el, word: w, at };
    }
    if (best) found.push(best);
  }
  found.sort((a, b) => a.at - b.at);
  // the bed and the clock are background ideas; keep concrete things first
  const pets = found.filter((f) => f.el === 'cat' || f.el === 'dog');
  const things = found.filter((f) => f.el !== 'cat' && f.el !== 'dog').slice(0, 3);
  for (const f of things) {
    base.objects.push(f.el);
    base.evidence.push({ element: f.el, word: f.word, context: around(raw, raw.toLowerCase().indexOf(lower(f.word)), f.word.length) });
  }
  if (pets.length) {
    base.companion = pets[0].el;
    base.evidence.push({ element: pets[0].el, word: pets[0].word, context: around(raw, raw.toLowerCase().indexOf(lower(pets[0].word)), pets[0].word.length) });
  }
  // weather from how heavy the words are, and of what kind
  const counts = {};
  let heavy = 0;
  let heavyWord = null;
  let topWord = {};
  for (const [kind, words] of Object.entries(MOOD)) {
    counts[kind] = 0;
    for (const w of words) {
      const at = findWord(text, lower(w));
      if (at >= 0) {
        counts[kind]++;
        if (!topWord[kind] || at < topWord[kind].at) topWord[kind] = { w, at };
      }
    }
    heavy += counts[kind];
  }
  let light = 0;
  let lightWord = null;
  for (const w of LIGHT) if (findWord(text, lower(w)) >= 0) { light++; lightWord = lightWord || w; }
  // the most frequent kind wins; on a tie, feelings beat events (sad, then worried, tired, angry)
  const order = Object.keys(MOOD);
  const kinds = order.filter((k) => counts[k]).sort((a, b) => counts[b] - counts[a] || order.indexOf(a) - order.indexOf(b));
  if (kinds.length) heavyWord = topWord[kinds[0]].w;
  if (heavy && heavy >= light * 2) base.weather = heavy === 1 && kinds[0] === 'rain' ? 'cloudy' : kinds[0];
  else if (heavy && light) base.weather = 'mixed';
  else if (light) base.weather = 'sunny';
  const wWord = base.weather === 'sunny' || base.weather === 'mixed' ? lightWord : heavyWord;
  if (wWord && base.weather !== 'clear') {
    base.evidence.push({ element: base.weather, word: wWord, context: around(raw, raw.toLowerCase().indexOf(lower(wWord)), wWord.length) });
  }
  // after the exercise felt lighter, the sky opens a little
  if (shift != null && shift < 0 && ['rain', 'cloudy', 'wind', 'fog', 'dusk'].includes(base.weather)) base.clearing = true;
  return base;
}

// Plain-language notes on where each part of the picture came from.
const EL_NAME = {
  zh: { cat: '貓', dog: '狗', coffee: '咖啡', tea: '茶', book: '書', laptop: '電腦', phone: '手機', clock: '時鐘', house: '小房子', plant: '小花', letter: '信', music: '音符', food: '碗', bed: '枕頭', bus: '公車', sea: '海浪', mountain: '小山', heart: '愛心', gift: '禮物', bike: '腳踏車', friends: '兩個杯子', money: '小存錢罐', game: '遊戲手把', suitcase: '行李箱', rain: '小雨', cloudy: '雲', mixed: '雲後面的太陽', sunny: '太陽', wind: '風', fog: '薄霧', dusk: '傍晚的天色' },
  en: { cat: 'cat', dog: 'dog', coffee: 'coffee cup', tea: 'tea', book: 'book', laptop: 'laptop', phone: 'phone', clock: 'clock', house: 'little house', plant: 'flower', letter: 'letter', music: 'music notes', food: 'bowl', bed: 'pillow', bus: 'bus', sea: 'waves', mountain: 'hill', heart: 'heart', gift: 'gift', bike: 'bike', friends: 'two cups', money: 'coin jar', game: 'game controller', suitcase: 'suitcase', rain: 'rain', cloudy: 'clouds', mixed: 'sun behind clouds', sunny: 'sun', wind: 'wind', fog: 'mist', dusk: 'dusk sky' },
};

export function sceneNotes(scene, lang = 'zh') {
  const names = EL_NAME[lang] || EL_NAME.zh;
  if (scene.calm) return [lang === 'en' ? 'A quiet night scene. Nothing in it is drawn from what you wrote.' : '一個安靜的夜晚。這張圖沒有從你寫的內容取材。'];
  const notes = scene.evidence.map((e) => (lang === 'en' ? `"${e.word}" became the ${names[e.element] || e.element} (${e.context})` : `${names[e.element] || e.element}來自你寫的「${e.word}」（${e.context}）`));
  if (scene.clearing) notes.push(lang === 'en' ? 'You said it felt a little lighter, so the sky opens a bit.' : '你說寫完輕一點了，所以天空開了一點。');
  return notes;
}

// For tests: every readable object must have a drawing and a name in both languages.
export function coverage() {
  return OBJECTS.map(([el]) => ({ el, drawn: typeof OBJ[el] === 'function', zh: !!EL_NAME.zh[el], en: !!EL_NAME.en[el] }));
}

// ---------- drawing ----------

const PAL = {
  rain: { bg: ['#dfe7f5', '#ece4f6'], ink: '#3f4b66', soft: '#f7f9ff', accent: '#9fb3dd', leaf: '#9cc3b3', ground: '#cfd9ee' },
  cloudy: { bg: ['#e4ebf2', '#f3eaf0'], ink: '#46506a', soft: '#fbfcff', accent: '#b4bfd9', leaf: '#9fc6ad', ground: '#d7e2e8' },
  mixed: { bg: ['#e2f1ec', '#fdf0dc'], ink: '#475a52', soft: '#fbfffd', accent: '#f2c57c', leaf: '#8fbf9f', ground: '#d4ead9' },
  sunny: { bg: ['#fff1d1', '#fde1e6'], ink: '#6b4f4a', soft: '#fffaf0', accent: '#f4a7a0', leaf: '#a8cf8f', ground: '#f5e1c4' },
  wind: { bg: ['#e0efef', '#eceaf6'], ink: '#3f5a5c', soft: '#f7fdfd', accent: '#9cc8c4', leaf: '#9cc3b3', ground: '#d3e6e3' },
  fog: { bg: ['#e9e7ef', '#f2eef0'], ink: '#4f4d63', soft: '#fbfaff', accent: '#bdb6d3', leaf: '#a9c4b5', ground: '#dedbe8' },
  dusk: { bg: ['#fbe0d2', '#efd6ea'], ink: '#6a4552', soft: '#fff6f1', accent: '#f0a58f', leaf: '#b7c99a', ground: '#f0d2c8' },
  clear: { bg: ['#e9f0fb', '#f5ecfa'], ink: '#4d4a6e', soft: '#fbf9ff', accent: '#c7a6e3', leaf: '#a3c9b7', ground: '#e2e0f3' },
  night: { bg: ['#2f3557', '#4a3f66'], ink: '#f2ecff', soft: '#fff7e6', accent: '#f3d08a', leaf: '#9fc6b8', ground: '#3b3f63' },
};

function rng(seed) {
  let s = 7;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

const eyes = (x, y, s, ink, blush) => `
  <circle cx="${x - s}" cy="${y}" r="${s * 0.22}" fill="${ink}"/><circle cx="${x + s}" cy="${y}" r="${s * 0.22}" fill="${ink}"/>
  <path d="M${x - s * 0.35} ${y + s * 0.45} q${s * 0.35} ${s * 0.35} ${s * 0.7} 0" stroke="${ink}" stroke-width="${s * 0.16}" fill="none" stroke-linecap="round"/>
  <ellipse cx="${x - s * 1.5}" cy="${y + s * 0.55}" rx="${s * 0.35}" ry="${s * 0.2}" fill="${blush}" opacity=".7"/>
  <ellipse cx="${x + s * 1.5}" cy="${y + s * 0.55}" rx="${s * 0.35}" ry="${s * 0.2}" fill="${blush}" opacity=".7"/>`;

// Objects, drawn around (x, y) at size r. Each sits on the ground line.
const OBJ = {
  cat: (p, x, y, r) => `<ellipse cx="${x}" cy="${y - r * 0.45}" rx="${r * 0.7}" ry="${r * 0.5}" fill="${p.accent}"/><path d="M${x - r * 0.6} ${y - r * 0.75} l${r * 0.1} ${-r * 0.45} l${r * 0.3} ${r * 0.3}Z M${x + r * 0.6} ${y - r * 0.75} l${-r * 0.1} ${-r * 0.45} l${-r * 0.3} ${r * 0.3}Z" fill="${p.accent}"/><path d="M${x + r * 0.65} ${y - r * 0.2} q${r * 0.5} ${-r * 0.1} ${r * 0.4} ${-r * 0.6}" stroke="${p.accent}" stroke-width="${r * 0.14}" fill="none" stroke-linecap="round"/>${eyes(x, y - r * 0.5, r * 0.18, p.ink, p.soft)}`,
  dog: (p, x, y, r) => `<ellipse cx="${x}" cy="${y - r * 0.45}" rx="${r * 0.68}" ry="${r * 0.52}" fill="${p.soft}" stroke="${p.accent}" stroke-width="${r * 0.06}"/><ellipse cx="${x - r * 0.62}" cy="${y - r * 0.55}" rx="${r * 0.2}" ry="${r * 0.38}" fill="${p.accent}"/><ellipse cx="${x + r * 0.62}" cy="${y - r * 0.55}" rx="${r * 0.2}" ry="${r * 0.38}" fill="${p.accent}"/>${eyes(x, y - r * 0.5, r * 0.18, p.ink, p.accent)}`,
  coffee: (p, x, y, r) => `<path d="M${x - r * 0.45} ${y - r * 0.85} h${r * 0.9} l${-r * 0.1} ${r * 0.85} h${-r * 0.7}z" fill="${p.soft}" stroke="${p.ink}" stroke-opacity=".25" stroke-width="${r * 0.04}"/><path d="M${x + r * 0.42} ${y - r * 0.7} q${r * 0.35} ${r * 0.1} ${r * 0.05} ${r * 0.45}" stroke="${p.soft}" stroke-width="${r * 0.1}" fill="none"/><rect x="${x - r * 0.45}" y="${y - r * 0.6}" width="${r * 0.9}" height="${r * 0.2}" fill="${p.accent}" opacity=".8"/><path d="M${x - r * 0.1} ${y - r * 1.0} q${r * 0.1} ${-r * 0.15} 0 ${-r * 0.3}" stroke="${p.ink}" stroke-opacity=".35" stroke-width="${r * 0.05}" fill="none" stroke-linecap="round"/>`,
  tea: (p, x, y, r) => `<path d="M${x - r * 0.55} ${y - r * 0.6} h${r * 1.1} c0 ${r * 0.5} ${-r * 0.25} ${r * 0.6} ${-r * 0.55} ${r * 0.6} s${-r * 0.55} ${-r * 0.1} ${-r * 0.55} ${-r * 0.6}z" fill="${p.soft}"/><path d="M${x + r * 0.52} ${y - r * 0.45} c${r * 0.3} 0 ${r * 0.3} ${r * 0.3} 0 ${r * 0.3}" stroke="${p.soft}" stroke-width="${r * 0.09}" fill="none"/><path d="M${x} ${y - r * 0.75} q${r * 0.1} ${-r * 0.15} 0 ${-r * 0.3}" stroke="${p.ink}" stroke-opacity=".35" stroke-width="${r * 0.05}" fill="none" stroke-linecap="round"/>`,
  book: (p, x, y, r) => `<path d="M${x} ${y - r * 0.15} q${-r * 0.45} ${-r * 0.25} ${-r * 0.85} 0 v${-r * 0.6} q${r * 0.4} ${-r * 0.25} ${r * 0.85} 0z" fill="${p.soft}" stroke="${p.accent}" stroke-width="${r * 0.06}"/><path d="M${x} ${y - r * 0.15} q${r * 0.45} ${-r * 0.25} ${r * 0.85} 0 v${-r * 0.6} q${-r * 0.4} ${-r * 0.25} ${-r * 0.85} 0z" fill="${p.soft}" stroke="${p.accent}" stroke-width="${r * 0.06}"/>`,
  laptop: (p, x, y, r) => `<rect x="${x - r * 0.6}" y="${y - r * 1.0}" width="${r * 1.2}" height="${r * 0.75}" rx="${r * 0.08}" fill="${p.ink}" opacity=".75"/><rect x="${x - r * 0.5}" y="${y - r * 0.92}" width="${r * 1.0}" height="${r * 0.58}" rx="${r * 0.04}" fill="${p.soft}"/><path d="M${x - r * 0.8} ${y - r * 0.2} h${r * 1.6} l${-r * 0.1} ${r * 0.15} h${-r * 1.4}z" fill="${p.ink}" opacity=".6"/>${eyes(x, y - r * 0.65, r * 0.1, p.ink, p.accent)}`,
  phone: (p, x, y, r) => `<rect x="${x - r * 0.32}" y="${y - r * 1.05}" width="${r * 0.64}" height="${r * 1.05}" rx="${r * 0.12}" fill="${p.ink}" opacity=".7"/><rect x="${x - r * 0.25}" y="${y - r * 0.95}" width="${r * 0.5}" height="${r * 0.8}" rx="${r * 0.06}" fill="${p.soft}"/><rect x="${x - r * 0.18}" y="${y - r * 0.82}" width="${r * 0.3}" height="${r * 0.12}" rx="${r * 0.06}" fill="${p.accent}"/><rect x="${x - r * 0.12}" y="${y - r * 0.62}" width="${r * 0.3}" height="${r * 0.12}" rx="${r * 0.06}" fill="${p.leaf}"/>`,
  clock: (p, x, y, r) => `<circle cx="${x}" cy="${y - r * 0.55}" r="${r * 0.5}" fill="${p.soft}" stroke="${p.accent}" stroke-width="${r * 0.08}"/><path d="M${x} ${y - r * 0.55} v${-r * 0.3} M${x} ${y - r * 0.55} h${r * 0.22}" stroke="${p.ink}" stroke-width="${r * 0.07}" stroke-linecap="round"/>`,
  house: (p, x, y, r) => `<path d="M${x - r * 0.7} ${y - r * 0.55} l${r * 0.7} ${-r * 0.55} l${r * 0.7} ${r * 0.55}z" fill="${p.accent}"/><rect x="${x - r * 0.55}" y="${y - r * 0.6}" width="${r * 1.1}" height="${r * 0.6}" fill="${p.soft}"/><rect x="${x - r * 0.12}" y="${y - r * 0.35}" width="${r * 0.24}" height="${r * 0.35}" rx="${r * 0.05}" fill="${p.leaf}"/>`,
  plant: (p, x, y, r) => `<path d="M${x} ${y} v${-r * 0.75}" stroke="${p.leaf}" stroke-width="${r * 0.08}"/><path d="M${x} ${y - r * 0.35} q${-r * 0.35} ${-r * 0.05} ${-r * 0.4} ${-r * 0.35} q${r * 0.3} 0 ${r * 0.4} ${r * 0.35}z" fill="${p.leaf}"/>${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(x + Math.cos((a * Math.PI) / 180) * r * 0.2).toFixed(1)}" cy="${(y - r * 0.85 + Math.sin((a * Math.PI) / 180) * r * 0.2).toFixed(1)}" r="${r * 0.16}" fill="${p.accent}"/>`).join('')}<circle cx="${x}" cy="${y - r * 0.85}" r="${r * 0.12}" fill="${p.soft}"/>`,
  letter: (p, x, y, r) => `<rect x="${x - r * 0.6}" y="${y - r * 0.75}" width="${r * 1.2}" height="${r * 0.75}" rx="${r * 0.06}" fill="${p.soft}" stroke="${p.accent}" stroke-width="${r * 0.05}"/><path d="M${x - r * 0.6} ${y - r * 0.75} l${r * 0.6} ${r * 0.42} l${r * 0.6} ${-r * 0.42}" stroke="${p.accent}" stroke-width="${r * 0.05}" fill="none"/><path d="M${x} ${y - r * 0.22} c${-r * 0.12} ${-r * 0.1} ${-r * 0.06} ${-r * 0.22} 0 ${-r * 0.14} c${r * 0.06} ${-r * 0.08} ${r * 0.12} ${r * 0.04} 0 ${r * 0.14}z" fill="${p.accent}"/>`,
  music: (p, x, y, r) => `<path d="M${x - r * 0.2} ${y - r * 0.3} v${-r * 0.7} l${r * 0.55} ${-r * 0.15} v${r * 0.7}" stroke="${p.ink}" stroke-opacity=".6" stroke-width="${r * 0.07}" fill="none"/><ellipse cx="${x - r * 0.32}" cy="${y - r * 0.28}" rx="${r * 0.15}" ry="${r * 0.11}" fill="${p.accent}"/><ellipse cx="${x + r * 0.23}" cy="${y - r * 0.43}" rx="${r * 0.15}" ry="${r * 0.11}" fill="${p.accent}"/>`,
  food: (p, x, y, r) => `<path d="M${x - r * 0.65} ${y - r * 0.5} h${r * 1.3} c0 ${r * 0.4} ${-r * 0.3} ${r * 0.5} ${-r * 0.65} ${r * 0.5} s${-r * 0.65} ${-r * 0.1} ${-r * 0.65} ${-r * 0.5}z" fill="${p.soft}" stroke="${p.accent}" stroke-width="${r * 0.05}"/><ellipse cx="${x}" cy="${y - r * 0.55}" rx="${r * 0.55}" ry="${r * 0.18}" fill="${p.accent}" opacity=".6"/><path d="M${x + r * 0.2} ${y - r * 0.6} l${r * 0.5} ${-r * 0.5} M${x + r * 0.35} ${y - r * 0.55} l${r * 0.5} ${-r * 0.5}" stroke="${p.ink}" stroke-opacity=".5" stroke-width="${r * 0.05}" stroke-linecap="round"/>`,
  bed: (p, x, y, r) => `<rect x="${x - r * 0.7}" y="${y - r * 0.45}" width="${r * 1.4}" height="${r * 0.45}" rx="${r * 0.22}" fill="${p.soft}" stroke="${p.accent}" stroke-width="${r * 0.05}"/><text x="${x + r * 0.45}" y="${y - r * 0.6}" font-size="${r * 0.35}" fill="${p.ink}" opacity=".5" font-family="sans-serif">z</text>`,
  bus: (p, x, y, r) => `<rect x="${x - r * 0.75}" y="${y - r * 0.85}" width="${r * 1.5}" height="${r * 0.7}" rx="${r * 0.15}" fill="${p.accent}"/><rect x="${x - r * 0.6}" y="${y - r * 0.75}" width="${r * 0.5}" height="${r * 0.25}" rx="${r * 0.05}" fill="${p.soft}"/><rect x="${x + r * 0.05}" y="${y - r * 0.75}" width="${r * 0.5}" height="${r * 0.25}" rx="${r * 0.05}" fill="${p.soft}"/><circle cx="${x - r * 0.4}" cy="${y - r * 0.12}" r="${r * 0.13}" fill="${p.ink}" opacity=".7"/><circle cx="${x + r * 0.4}" cy="${y - r * 0.12}" r="${r * 0.13}" fill="${p.ink}" opacity=".7"/>`,
  sea: (p, x, y, r) => `<path d="M${x - r} ${y - r * 0.25} q${r * 0.25} ${-r * 0.25} ${r * 0.5} 0 t${r * 0.5} 0 t${r * 0.5} 0 t${r * 0.5} 0" stroke="${p.accent}" stroke-width="${r * 0.1}" fill="none" stroke-linecap="round"/><path d="M${x - r * 0.75} ${y - r * 0.55} q${r * 0.25} ${-r * 0.25} ${r * 0.5} 0 t${r * 0.5} 0 t${r * 0.5} 0" stroke="${p.accent}" stroke-opacity=".6" stroke-width="${r * 0.08}" fill="none" stroke-linecap="round"/>`,
  mountain: (p, x, y, r) => `<path d="M${x - r * 0.9} ${y} l${r * 0.6} ${-r * 0.95} l${r * 0.35} ${r * 0.45} l${r * 0.25} ${-r * 0.25} l${r * 0.6} ${r * 0.75}z" fill="${p.leaf}"/><path d="M${x - r * 0.42} ${y - r * 0.75} l${r * 0.12} ${-r * 0.2} l${r * 0.12} ${r * 0.18}z" fill="${p.soft}"/>`,
  heart: (p, x, y, r) => `<path d="M${x} ${y - r * 0.15} c${-r * 0.8} ${-r * 0.45} ${-r * 0.55} ${-r * 1.15} 0 ${-r * 0.8} c${r * 0.55} ${-r * 0.35} ${r * 0.8} ${r * 0.35} 0 ${r * 0.8}z" fill="${p.accent}"/>`,
  gift: (p, x, y, r) => `<rect x="${x - r * 0.5}" y="${y - r * 0.7}" width="${r}" height="${r * 0.7}" rx="${r * 0.06}" fill="${p.accent}"/><rect x="${x - r * 0.08}" y="${y - r * 0.7}" width="${r * 0.16}" height="${r * 0.7}" fill="${p.soft}"/><path d="M${x} ${y - r * 0.7} c${-r * 0.3} ${-r * 0.35} ${-r * 0.45} 0 0 0 c${r * 0.3} ${-r * 0.35} ${r * 0.45} 0 0 0" stroke="${p.soft}" stroke-width="${r * 0.08}" fill="none"/>`,
  friends: (p, x, y, r) => `<path d="M${x - r * 0.75} ${y - r * 0.7} h${r * 0.6} l${-r * 0.06} ${r * 0.7} h${-r * 0.48}z" fill="${p.soft}" stroke="${p.accent}" stroke-width="${r * 0.05}"/><path d="M${x + r * 0.15} ${y - r * 0.7} h${r * 0.6} l${-r * 0.06} ${r * 0.7} h${-r * 0.48}z" fill="${p.accent}"/>${eyes(x - r * 0.45, y - r * 0.4, r * 0.08, p.ink, p.accent)}${eyes(x + r * 0.45, y - r * 0.4, r * 0.08, p.ink, p.soft)}<path d="M${x - r * 0.1} ${y - r * 1.0} c${-r * 0.1} ${-r * 0.12} ${-r * 0.02} ${-r * 0.22} ${r * 0.1} ${-r * 0.1} c${r * 0.12} ${-r * 0.12} ${r * 0.2} ${-r * 0.02} ${r * 0.1} ${r * 0.1} l${-r * 0.1} ${r * 0.1}z" fill="${p.accent}"/>`,
  money: (p, x, y, r) => `<rect x="${x - r * 0.45}" y="${y - r * 0.85}" width="${r * 0.9}" height="${r * 0.85}" rx="${r * 0.2}" fill="${p.soft}" stroke="${p.accent}" stroke-width="${r * 0.05}" opacity=".9"/><rect x="${x - r * 0.35}" y="${y - r * 0.98}" width="${r * 0.7}" height="${r * 0.16}" rx="${r * 0.05}" fill="${p.accent}"/>${[[-0.15, -0.25], [0.15, -0.25], [0, -0.48]].map(([dx, dy]) => `<circle cx="${(x + dx * r).toFixed(1)}" cy="${(y + dy * r).toFixed(1)}" r="${(r * 0.15).toFixed(1)}" fill="${p.accent}"/>`).join('')}`,
  game: (p, x, y, r) => `<rect x="${x - r * 0.7}" y="${y - r * 0.65}" width="${r * 1.4}" height="${r * 0.6}" rx="${r * 0.3}" fill="${p.accent}"/><path d="M${x - r * 0.45} ${y - r * 0.35} h${r * 0.3} M${x - r * 0.3} ${y - r * 0.5} v${r * 0.3}" stroke="${p.soft}" stroke-width="${r * 0.08}" stroke-linecap="round"/><circle cx="${x + r * 0.3}" cy="${y - r * 0.42}" r="${r * 0.08}" fill="${p.soft}"/><circle cx="${x + r * 0.48}" cy="${y - r * 0.3}" r="${r * 0.08}" fill="${p.soft}"/>`,
  suitcase: (p, x, y, r) => `<rect x="${x - r * 0.55}" y="${y - r * 0.85}" width="${r * 1.1}" height="${r * 0.8}" rx="${r * 0.12}" fill="${p.accent}"/><path d="M${x - r * 0.2} ${y - r * 0.85} v${-r * 0.15} h${r * 0.4} v${r * 0.15}" stroke="${p.ink}" stroke-opacity=".5" stroke-width="${r * 0.06}" fill="none"/><path d="M${x - r * 0.3} ${y - r * 0.85} v${r * 0.8} M${x + r * 0.3} ${y - r * 0.85} v${r * 0.8}" stroke="${p.soft}" stroke-width="${r * 0.06}"/><circle cx="${x - r * 0.35}" cy="${y}" r="${r * 0.07}" fill="${p.ink}" opacity=".5"/><circle cx="${x + r * 0.35}" cy="${y}" r="${r * 0.07}" fill="${p.ink}" opacity=".5"/>`,
  bike: (p, x, y, r) => `<circle cx="${x - r * 0.5}" cy="${y - r * 0.3}" r="${r * 0.3}" fill="none" stroke="${p.ink}" stroke-opacity=".6" stroke-width="${r * 0.06}"/><circle cx="${x + r * 0.5}" cy="${y - r * 0.3}" r="${r * 0.3}" fill="none" stroke="${p.ink}" stroke-opacity=".6" stroke-width="${r * 0.06}"/><path d="M${x - r * 0.5} ${y - r * 0.3} l${r * 0.35} ${-r * 0.45} h${r * 0.45} l${r * 0.2} ${r * 0.45} M${x - r * 0.15} ${y - r * 0.75} l${r * 0.2} ${r * 0.45}" stroke="${p.accent}" stroke-width="${r * 0.07}" fill="none" stroke-linecap="round"/>`,
};

// Companions: small, round, original. Drawn with their feet at (x, y).
const PAL_CREATURE = {
  bun: (p, x, y, r) => `<path d="M${x - r} ${y} C ${x - r * 1.05} ${y - r * 0.8}, ${x - r * 0.45} ${y - r * 1.35}, ${x} ${y - r * 1.38} C ${x + r * 0.45} ${y - r * 1.35}, ${x + r * 1.05} ${y - r * 0.8}, ${x + r} ${y} Z" fill="${p.soft}" stroke="${p.accent}" stroke-width="${r * 0.06}"/><path d="M${x - r * 0.25} ${y - r * 1.15} q${r * 0.25} ${r * 0.15} ${r * 0.5} 0" stroke="${p.accent}" stroke-width="${r * 0.06}" fill="none" stroke-linecap="round"/>${eyes(x, y - r * 0.55, r * 0.14, p.ink, p.accent)}`,
  bird: (p, x, y, r) => `<ellipse cx="${x}" cy="${y - r * 0.6}" rx="${r * 0.75}" ry="${r * 0.62}" fill="${p.accent}"/><path d="M${x + r * 0.7} ${y - r * 0.7} l${r * 0.3} ${r * 0.1} l${-r * 0.3} ${r * 0.1}z" fill="${p.soft}"/><path d="M${x - r * 0.3} ${y - r * 0.55} q${r * 0.3} ${r * 0.35} ${r * 0.55} 0" fill="${p.soft}" opacity=".7"/><path d="M${x - r * 0.15} ${y} v${-r * 0.1} M${x + r * 0.15} ${y} v${-r * 0.1}" stroke="${p.ink}" stroke-width="${r * 0.06}"/>${eyes(x + r * 0.2, y - r * 0.8, r * 0.12, p.ink, p.soft)}`,
  cat: (p, x, y, r) => `<ellipse cx="${x}" cy="${y - r * 0.55}" rx="${r * 0.85}" ry="${r * 0.6}" fill="${p.accent}"/><path d="M${x - r * 0.75} ${y - r * 0.9} l${r * 0.12} ${-r * 0.5} l${r * 0.35} ${r * 0.32}Z M${x + r * 0.75} ${y - r * 0.9} l${-r * 0.12} ${-r * 0.5} l${-r * 0.35} ${r * 0.32}Z" fill="${p.accent}"/><path d="M${x + r * 0.8} ${y - r * 0.3} q${r * 0.6} ${-r * 0.1} ${r * 0.5} ${-r * 0.7}" stroke="${p.accent}" stroke-width="${r * 0.16}" fill="none" stroke-linecap="round"/>${eyes(x, y - r * 0.62, r * 0.17, p.ink, p.soft)}`,
  dog: (p, x, y, r) => `<ellipse cx="${x}" cy="${y - r * 0.6}" rx="${r * 0.82}" ry="${r * 0.65}" fill="${p.soft}" stroke="${p.accent}" stroke-width="${r * 0.06}"/><ellipse cx="${x - r * 0.78}" cy="${y - r * 0.7}" rx="${r * 0.24}" ry="${r * 0.45}" fill="${p.accent}"/><ellipse cx="${x + r * 0.78}" cy="${y - r * 0.7}" rx="${r * 0.24}" ry="${r * 0.45}" fill="${p.accent}"/>${eyes(x, y - r * 0.65, r * 0.17, p.ink, p.accent)}`,
  sprout: (p, x, y, r) => `<path d="M${x - r * 0.7} ${y - r * 0.8} h${r * 1.4} l${-r * 0.18} ${r * 0.8} h${-r * 1.04}z" fill="${p.accent}"/><path d="M${x} ${y - r * 0.8} v${-r * 0.45}" stroke="${p.leaf}" stroke-width="${r * 0.09}"/><path d="M${x} ${y - r * 1.2} c${-r * 0.2} ${-r * 0.45} ${-r * 0.75} ${-r * 0.4} ${-r * 0.7} 0 c${r * 0.3} ${r * 0.12} ${r * 0.55} ${r * 0.05} ${r * 0.7} 0z M${x} ${y - r * 1.2} c${r * 0.2} ${-r * 0.45} ${r * 0.75} ${-r * 0.4} ${r * 0.7} 0 c${-r * 0.3} ${r * 0.12} ${-r * 0.55} ${r * 0.05} ${-r * 0.7} 0z" fill="${p.leaf}"/>${eyes(x, y - r * 0.45, r * 0.13, p.ink, p.soft)}`,
  cloudlet: (p, x, y, r) => `<g fill="${p.soft}" stroke="${p.accent}" stroke-width="${r * 0.05}"><path d="M${x - r * 0.9} ${y} a${r * 0.4} ${r * 0.4} 0 0 1 ${r * 0.2} ${-r * 0.75} a${r * 0.5} ${r * 0.5} 0 0 1 ${r * 0.95} ${-r * 0.2} a${r * 0.4} ${r * 0.4} 0 0 1 ${r * 0.65} ${r * 0.95}z"/></g>${eyes(x, y - r * 0.45, r * 0.13, p.ink, p.accent)}`,
  lamp: (p, x, y, r) => `<circle cx="${x}" cy="${y - r * 0.95}" r="${r * 0.95}" fill="${p.accent}" opacity=".18"/><path d="M${x - r * 0.45} ${y - r * 1.35} h${r * 0.9} l${r * 0.22} ${r * 0.6} h${-r * 1.34}z" fill="${p.accent}"/><rect x="${x - r * 0.06}" y="${y - r * 0.75}" width="${r * 0.12}" height="${r * 0.65}" fill="${p.soft}" opacity=".7"/><ellipse cx="${x}" cy="${y - r * 0.08}" rx="${r * 0.4}" ry="${r * 0.1}" fill="${p.soft}" opacity=".7"/>`,
};

// Small corner glyph for the lens the person looked through.
const GLYPH = {
  iceberg: (c) => `<path d="M-9 1 l5 -8 l4 4 l3 -2 l6 6z" fill="${c}"/><path d="M-11 3 h22 l-5 8 h-12z" fill="${c}" opacity=".45"/>`,
  bridge: (c) => `<path d="M-11 5 q11 -14 22 0" stroke="${c}" stroke-width="2.5" fill="none"/><path d="M-11 5 h22" stroke="${c}" stroke-width="2"/>`,
  star: (c) => `<path d="M0 -10 l3 7 l7 1 l-5 5 l1 7 l-6 -3 l-6 3 l1 -7 l-5 -5 l7 -1z" fill="${c}"/>`,
  sun: (c) => `<circle r="5" fill="${c}"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M${(Math.cos((a * Math.PI) / 180) * 8).toFixed(1)} ${(Math.sin((a * Math.PI) / 180) * 8).toFixed(1)} L${(Math.cos((a * Math.PI) / 180) * 11).toFixed(1)} ${(Math.sin((a * Math.PI) / 180) * 11).toFixed(1)}" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`).join('')}`,
  chair: (c) => `<path d="M-6 -10 v18 M-6 0 h12 v8 M6 0 v-2" stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  steps: (c) => `<path d="M-10 8 h6 v-6 h6 v-6 h6 v-6" stroke="${c}" stroke-width="2.5" fill="none" stroke-linejoin="round"/>`,
  leaf: (c) => `<path d="M-8 8 C -8 -6, 4 -10, 10 -10 C 10 -2, 4 8, -8 8z" fill="${c}"/>`,
  scale: (c) => `<path d="M0 -9 v17 M-9 -5 h18 M-9 -5 l-3 7 h6z M9 -5 l-3 7 h6z" stroke="${c}" stroke-width="2" fill="none" stroke-linejoin="round"/>`,
  lens: (c) => `<circle cx="-2" cy="-2" r="6" stroke="${c}" stroke-width="2.5" fill="none"/><path d="M3 3 l6 6" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,
  compass: (c) => `<circle r="9" stroke="${c}" stroke-width="2" fill="none"/><path d="M0 -6 l3 6 l-3 6 l-3 -6z" fill="${c}"/>`,
  circle: (c) => `${[0, 90, 180, 270].map((a) => `<circle cx="${(Math.cos((a * Math.PI) / 180) * 6).toFixed(1)}" cy="${(Math.sin((a * Math.PI) / 180) * 6).toFixed(1)}" r="3.5" fill="${c}"/>`).join('')}`,
  ladder: (c) => `<path d="M-5 10 v-20 M5 10 v-20 M-5 5 h10 M-5 0 h10 M-5 -5 h10" stroke="${c}" stroke-width="2" fill="none"/>`,
  book: (c) => `<path d="M0 6 q-5 -3 -10 0 v-12 q5 -3 10 0z M0 6 q5 -3 10 0 v-12 q-5 -3 -10 0z" fill="${c}"/>`,
  knots: (c) => `<circle cx="-6" cy="3" r="4" fill="${c}"/><circle cx="6" cy="3" r="4" fill="${c}"/><circle cx="0" cy="-6" r="4" fill="${c}"/><path d="M-6 3 L0 -6 L6 3z" stroke="${c}" stroke-width="1.5" fill="none"/>`,
};

function backdrop(setting, p, W, G) {
  switch (setting) {
    case 'desk':
      return `<rect x="34" y="70" width="110" height="86" rx="10" fill="${p.soft}" opacity=".75"/><path d="M89 70 v86 M34 113 h110" stroke="${p.accent}" stroke-opacity=".5" stroke-width="3"/><rect x="0" y="${G}" width="${W}" height="10" fill="${p.ink}" opacity=".12"/>`;
    case 'bench':
      return `<rect x="40" y="${G - 34}" width="190" height="10" rx="5" fill="${p.accent}" opacity=".55"/><rect x="40" y="${G - 52}" width="190" height="8" rx="4" fill="${p.accent}" opacity=".4"/><path d="M55 ${G - 24} v24 M215 ${G - 24} v24" stroke="${p.accent}" stroke-opacity=".55" stroke-width="6"/>`;
    case 'roof':
      return `<path d="M20 ${G - 120} l115 -70 l115 70z" fill="${p.accent}" opacity=".3"/><rect x="40" y="${G - 120}" width="190" height="120" fill="${p.soft}" opacity=".35"/>`;
    case 'path':
      return `<path d="M60 ${G} C 120 ${G - 40}, 170 ${G - 70}, 240 ${G - 140}" stroke="${p.soft}" stroke-width="26" fill="none" opacity=".7" stroke-linecap="round"/>`;
    case 'candle':
      return `<rect x="206" y="${G - 58}" width="18" height="58" rx="4" fill="${p.soft}"/><path d="M215 ${G - 74} c-7 8 -5 16 0 16 c5 0 7 -8 0 -16z" fill="${p.accent}"/><circle cx="215" cy="${G - 66}" r="22" fill="${p.accent}" opacity=".15"/>`;
    default:
      return '';
  }
}

function sky(weather, p, rand, uid) {
  const cloud = (x, y, s, cls = '') => `<g class="${cls}" fill="${p.soft}"><circle cx="${x - s * 0.6}" cy="${y + s * 0.15}" r="${s * 0.55}"/><circle cx="${x}" cy="${y - s * 0.15}" r="${s * 0.75}"/><circle cx="${x + s * 0.65}" cy="${y + s * 0.15}" r="${s * 0.55}"/><rect x="${x - s * 1.1}" y="${y + s * 0.1}" width="${s * 2.2}" height="${s * 0.6}" rx="${s * 0.3}"/></g>`;
  const sun = (x, y, s) => `<g class="${uid}-sun"><circle cx="${x}" cy="${y}" r="${s * 1.6}" fill="${p.accent}" opacity=".18"/><circle cx="${x}" cy="${y}" r="${s}" fill="${p.accent}"/></g>`;
  const drops = () => {
    let d = '';
    for (let i = 0; i < 9; i++) {
      const x = 50 + rand() * 170;
      const y = 92 + rand() * 60;
      d += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l-3 9" stroke="${p.accent}" stroke-width="2.5" stroke-linecap="round"/>`;
    }
    return `<g class="${uid}-rain">${d}</g>`;
  };
  switch (weather) {
    case 'sunny':
      return sun(205, 74, 22);
    case 'mixed':
      return sun(190, 70, 20) + cloud(150, 82, 30, `${uid}-cloud`);
    case 'cloudy':
      return sun(200, 70, 18) + cloud(110, 70, 30, `${uid}-cloud`) + cloud(190, 86, 24, `${uid}-cloud2`);
    case 'rain':
      return sun(200, 70, 18) + drops() + cloud(120, 74, 34, `${uid}-cloud`) + cloud(195, 84, 26, `${uid}-cloud2`);
    case 'wind': {
      let w = '';
      for (let i = 0; i < 3; i++) {
        const y = 70 + i * 28 + rand() * 8;
        const x = 30 + rand() * 40;
        w += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q40 -14 80 0 t80 0 q16 6 8 -10" stroke="${p.accent}" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="150 60"/>`;
      }
      return sun(210, 62, 16) + cloud(200, 92, 22, `${uid}-cloud2`) + `<g class="${uid}-wind">${w}</g>`;
    }
    case 'fog': {
      let f = '';
      for (let i = 0; i < 4; i++) f += `<rect x="${(-20 + rand() * 40).toFixed(1)}" y="${(90 + i * 42).toFixed(1)}" width="${(200 + rand() * 90).toFixed(1)}" height="14" rx="7" fill="${p.soft}" opacity=".55"/>`;
      return sun(200, 66, 18) + `<g class="${uid}-fog">${f}</g>`;
    }
    case 'dusk':
      return `<g class="${uid}-sun"><circle cx="200" cy="150" r="46" fill="${p.accent}" opacity=".22"/><circle cx="200" cy="150" r="26" fill="${p.accent}"/></g>` + cloud(110, 80, 26, `${uid}-cloud`);
    case 'night': {
      let s = '';
      for (let i = 0; i < 12; i++) s += `<circle cx="${(20 + rand() * 230).toFixed(1)}" cy="${(30 + rand() * 120).toFixed(1)}" r="${(1 + rand() * 2).toFixed(1)}" fill="${p.soft}" opacity=".8"/>`;
      return s + `<circle cx="205" cy="70" r="18" fill="${p.soft}"/><circle cx="214" cy="63" r="15" fill="${p.bg[0]}"/>`;
    }
    default:
      return '';
  }
}

// The animation, scoped to this card. Clouds drift aside, rain eases, the companion hops
// twice, sparkles twinkle. Nothing moves when reduced motion is asked for.
function motionCss(uid, scene) {
  const clear = scene.clearing || scene.weather === 'sunny' || scene.weather === 'mixed';
  return `<style>@media (prefers-reduced-motion: no-preference){
  .${uid}-pal{animation:${uid}hop 1.1s cubic-bezier(.3,1.6,.5,1) .5s 2 both;transform-box:fill-box;transform-origin:50% 100%}
  .${uid}-spark{animation:${uid}tw 1.6s ease-in-out .9s 3 both;transform-box:fill-box;transform-origin:center}
  .${uid}-obj{animation:${uid}pop .55s cubic-bezier(.3,1.5,.5,1) both;transform-box:fill-box;transform-origin:50% 100%}
  ${clear ? `.${uid}-wind{animation:${uid}fade 2s ease .4s both}.${uid}-fog{animation:${uid}fade 2.4s ease .3s both}.${uid}-cloud{animation:${uid}drift 2.4s ease-in-out .3s both}.${uid}-cloud2{animation:${uid}drift2 2.4s ease-in-out .3s both}.${uid}-rain{animation:${uid}fade 1.8s ease .4s both}.${uid}-sun{animation:${uid}glow 2.4s ease .6s both}` : `.${uid}-rain{animation:${uid}fall 1.2s linear infinite}.${uid}-wind path{animation:${uid}blow 2.2s linear infinite}`}
  @keyframes ${uid}hop{0%,100%{transform:translateY(0) scale(1,1)}30%{transform:translateY(-14px) scale(.95,1.06)}60%{transform:translateY(0) scale(1.06,.94)}}
  @keyframes ${uid}tw{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1)}}
  @keyframes ${uid}pop{0%{opacity:0;transform:scale(.3)}100%{opacity:1;transform:scale(1)}}
  @keyframes ${uid}drift{to{transform:translateX(-70px);opacity:.55}}
  @keyframes ${uid}drift2{to{transform:translateX(60px);opacity:.55}}
  @keyframes ${uid}fade{to{opacity:0}}
  @keyframes ${uid}blow{to{stroke-dashoffset:-210}}
  @keyframes ${uid}glow{0%{opacity:.4}100%{opacity:1}}
  @keyframes ${uid}fall{0%{transform:translateY(-4px);opacity:.9}100%{transform:translateY(8px);opacity:.3}}
}</style>`;
}

// Draw the card. line: the main text; label: a small heading; date; animate: add motion.
export function sceneSvg(scene, { seed = 'm', line = '', label = '', date = '', brand = 'Murmur', animate = false, fitText = null } = {}) {
  const rand = rng(seed + JSON.stringify(scene.objects) + scene.weather);
  const uid = 'sc' + Math.floor(rand() * 1e9).toString(36);
  const p = PAL[scene.weather] || PAL.clear;
  const W = 600;
  const H = 400;
  const G = 318; // ground line
  const pieces = [];
  pieces.push(`<rect width="${W}" height="${H}" rx="28" fill="url(#${uid}bg)"/>`);
  pieces.push(`<path d="M0 ${G} Q 140 ${G - 18} 280 ${G} L280 ${H - 28} Q280 ${H} 252 ${H} L28 ${H} Q0 ${H} 0 ${H - 28}z" fill="${p.ground}"/>`);
  pieces.push(backdrop(scene.setting, p, 280, G));
  pieces.push(sky(scene.weather, p, rand, uid));
  // objects spread along the ground, companion in front
  const slots = [[62, G], [215, G - 4], [72, G - 150]];
  scene.objects.forEach((o, i) => {
    const [x, y] = slots[i];
    const r = i === 2 ? 34 : 42;
    // the third one sits on a small floating shelf, so it reads as placed, not dropped
    const shelf = i === 2 ? `<rect x="${x - 46}" y="${y}" width="92" height="9" rx="4.5" fill="${p.soft}" opacity=".85"/>` : '';
    if (OBJ[o]) pieces.push(`<g class="${uid}-obj" style="animation-delay:${(0.15 + i * 0.18).toFixed(2)}s">${shelf}${OBJ[o](p, x, y, r)}</g>`);
  });
  const draw = PAL_CREATURE[scene.companion] || PAL_CREATURE.cloudlet;
  pieces.push(`<g class="${uid}-pal">${draw(p, 138, G + 30, 38)}</g>`);
  // sparkles
  let sp = '';
  for (let i = 0; i < 5; i++) {
    const x = 30 + rand() * 230;
    const y = 40 + rand() * 120;
    const s = 4 + rand() * 4;
    sp += `<path class="${uid}-spark" style="animation-delay:${(0.9 + i * 0.25).toFixed(2)}s" d="M${x.toFixed(1)} ${(y - s).toFixed(1)} l${(s * 0.3).toFixed(1)} ${(s * 0.7).toFixed(1)} l${(s * 0.7).toFixed(1)} ${(s * 0.3).toFixed(1)} l${(-s * 0.7).toFixed(1)} ${(s * 0.3).toFixed(1)} l${(-s * 0.3).toFixed(1)} ${(s * 0.7).toFixed(1)} l${(-s * 0.3).toFixed(1)} ${(-s * 0.7).toFixed(1)} l${(-s * 0.7).toFixed(1)} ${(-s * 0.3).toFixed(1)} l${(s * 0.7).toFixed(1)} ${(-s * 0.3).toFixed(1)}z" fill="#fff" opacity=".85"/>`;
  }
  pieces.push(sp);
  // text panel
  const fontStack = `'Bricolage', ui-sans-serif, system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif`;
  pieces.push(`<rect x="296" y="36" width="272" height="328" rx="22" fill="#fff" opacity="${scene.weather === 'night' ? '.12' : '.5'}"/>`);
  if (scene.lensGlyph && GLYPH[scene.lensGlyph]) pieces.push(`<g transform="translate(546 300)">${GLYPH[scene.lensGlyph](p.ink)}</g>`);
  if (label) pieces.push(`<text x="320" y="76" font-size="16" fill="${p.ink}" opacity=".75" font-family="${fontStack}">${esc(label)}</text>`);
  const fit = fitText ? fitText(line) : { lines: [line], size: 20, lh: 28 };
  const top = Math.max(200 - ((fit.lines.length - 1) * fit.lh) / 2, 104 + fit.size);
  fit.lines.forEach((l, i) => pieces.push(`<text x="320" y="${top + i * fit.lh}" font-size="${fit.size}" font-weight="600" fill="${p.ink}" font-family="${fontStack}">${esc(l)}</text>`));
  pieces.push(`<text x="320" y="340" font-size="14" fill="${p.ink}" opacity=".7" font-family="${fontStack}">${esc(date)}</text>`);
  pieces.push(`<text x="548" y="340" font-size="13" fill="${p.ink}" opacity=".55" text-anchor="end" font-family="${fontStack}">${esc(brand)}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
  <defs><linearGradient id="${uid}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg[0]}"/><stop offset="1" stop-color="${p.bg[1]}"/></linearGradient>
  <clipPath id="${uid}clip"><rect width="${W}" height="${H}" rx="28"/></clipPath></defs>
  ${animate ? motionCss(uid, scene) : ''}
  <g clip-path="url(#${uid}clip)">${pieces.join('')}</g>
</svg>`;
}

// What a model may choose from when it picks the card's picture (js/lens-llm.js).
export const CHOICES = {
  objects: OBJECTS.map(([el]) => el),
  weather: ['clear', 'sunny', 'mixed', 'cloudy', 'rain', 'wind', 'fog', 'dusk'],
  companion: ['bun', 'bird', 'cat', 'dog', 'sprout', 'cloudlet'],
};

// A scene from a model's choices. Every object must come with a word that is really in the
// person's text; anything else is dropped. The keyword scene fills in whatever is missing,
// and the risk rule still wins.
export function sceneFromSpec(spec, { texts = [], topics = [], lensId = null, shift = null } = {}) {
  const base = readScene({ texts, topics, lensId, shift });
  if (base.calm || !spec || typeof spec !== 'object') return base;
  const raw = texts.filter(Boolean).join('\n');
  const lowRaw = raw.toLowerCase();
  const picked = [];
  const evidence = [];
  for (const o of Array.isArray(spec.objects) ? spec.objects.slice(0, 3) : []) {
    if (!o || !CHOICES.objects.includes(o.object) || typeof o.word !== 'string') continue;
    const w = o.word.trim();
    const at = lowRaw.indexOf(w.toLowerCase());
    if (!w || w.length > 12 || at < 0 || picked.includes(o.object)) continue;
    picked.push(o.object);
    evidence.push({ element: o.object, word: w, context: around(raw, at, w.length), by: 'model' });
  }
  const out = { ...base };
  if (picked.length) {
    out.objects = picked;
    out.evidence = [...evidence, ...base.evidence.filter((e) => !OBJECTS.some(([el]) => el === e.element))];
  }
  if (CHOICES.weather.includes(spec.weather) && typeof spec.weatherWord === 'string' && spec.weatherWord.trim() && lowRaw.includes(spec.weatherWord.trim().toLowerCase())) {
    const w = spec.weatherWord.trim();
    out.weather = spec.weather;
    out.evidence = out.evidence.filter((e) => !CHOICES.weather.includes(e.element));
    out.evidence.push({ element: spec.weather, word: w, context: around(raw, lowRaw.indexOf(w.toLowerCase()), w.length), by: 'model' });
    if (shift != null && shift < 0 && ['rain', 'cloudy', 'wind', 'fog', 'dusk'].includes(out.weather)) out.clearing = true;
  }
  if (CHOICES.companion.includes(spec.companion)) out.companion = spec.companion;
  return out;
}
