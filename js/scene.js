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
//
// A flat print. Paper, two spot inks per card and their overprint colour, the way a riso
// print looks: shapes are circles, half-circles and bands with no outlines, gradients or
// see-through shading; where the two inks cross, the crossing is a fixed third colour; one
// ink layer sits a couple of pixels off, like a print that slipped. Ink is only for small
// line details and the words. The words lead: the person's line large on the right, the
// card's name small and vertical by a hairline at the edge, like the spine of a book.

const PAPER = '#F5F6F1';
const INK = '#1B1F3B';
const NIGHT = '#14172B';
const AO = '#2747C7'; // 群青
const MOMO = '#FF7A8A'; // 桃
const EGG = '#FFC83D'; // 蛋黃
const MOSS = '#2E9C7E'; // 青苔

const rgbOf = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const hexOf = (a) => '#' + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
// a flat screen of an ink on paper (t = how much ink)
const tint = (c, t, base = PAPER) => hexOf(rgbOf(base).map((v, i) => v + (rgbOf(c)[i] - v) * t));

// Each card: paper, ink for lines and words, a sky screen, ink a (land, and the
// accents of things) and ink b (the sun, and the bodies of things), c where they cross.
const PRINT = {
  clear: { a: AO, b: EGG, c: MOSS, sky: tint(AO, 0.13) },
  sunny: { a: MOMO, b: EGG, c: '#FF6A3D', sky: tint(MOMO, 0.12) },
  mixed: { a: MOSS, b: EGG, c: '#5E8F2E', sky: tint(MOSS, 0.12) },
  cloudy: { a: AO, b: MOMO, c: '#5B3B9E', sky: tint(AO, 0.12) },
  rain: { a: AO, b: MOSS, c: '#1D3F86', sky: tint(AO, 0.16) },
  wind: { a: MOSS, b: EGG, c: '#5E8F2E', sky: tint(EGG, 0.16) },
  fog: { paper: '#E9EAE4', a: tint(AO, 0.4, '#E9EAE4'), b: AO, c: '#2A3F9A', sky: tint(AO, 0.1, '#E9EAE4'), sun: '#F7F8F4' },
  dusk: { a: MOMO, b: EGG, c: '#FF6A3D', sky: tint(MOMO, 0.16) },
  night: { paper: NIGHT, ink: PAPER, a: MOSS, b: EGG, c: '#8AB84A', sky: '#20264A' },
};
const pal = (w) => ({ paper: PAPER, ink: INK, ...PRINT.clear, ...(PRINT[w] || {}) });

// the slipped layer
const OFF = [2.5, -2];

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

// geometry, no fill: the layer decides the colour
const n = (v) => +(+v).toFixed(1);
const circ = (cx, cy, r) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/>`;
const box = (x, y, w, h, rx = 0) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rx ? ` rx="${n(rx)}"` : ''}/>`;
// a half-circle with its flat side on (cx, cy): up, down, left or right
function half(cx, cy, r, dir = 'up') {
  if (dir === 'up') return `<path d="M${n(cx - r)} ${n(cy)} A${n(r)} ${n(r)} 0 0 1 ${n(cx + r)} ${n(cy)}Z"/>`;
  if (dir === 'down') return `<path d="M${n(cx - r)} ${n(cy)} A${n(r)} ${n(r)} 0 0 0 ${n(cx + r)} ${n(cy)}Z"/>`;
  if (dir === 'left') return `<path d="M${n(cx)} ${n(cy - r)} A${n(r)} ${n(r)} 0 0 0 ${n(cx)} ${n(cy + r)}Z"/>`;
  return `<path d="M${n(cx)} ${n(cy - r)} A${n(r)} ${n(r)} 0 0 1 ${n(cx)} ${n(cy + r)}Z"/>`;
}
const poly = (...pts) => `<path d="M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(' L')}Z"/>`;
const fillWith = (c, g) => (g ? `<g fill="${c}">${g}</g>` : '');
// ink line details
const line = (p, d, w = 2.2) => `<path d="${d}" fill="none" stroke="${p.ink}" stroke-width="${n(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const dot = (p, x, y, r) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${p.ink}"/>`;
// a small face: two dot eyes and a soft smile
const face = (p, x, y, s) => dot(p, x - s, y, s * 0.24) + dot(p, x + s, y, s * 0.24) + line(p, `M${n(x - s * 0.32)} ${n(y + s * 0.42)} q${n(s * 0.32)} ${n(s * 0.3)} ${n(s * 0.64)} 0`, Math.max(1.4, s * 0.18));
// a cloud of stacked half-circles, flat along the bottom
const cloudShape = (x, y, s) => half(x, y, s * 0.62) + half(x - s * 0.78, y, s * 0.4) + half(x + s * 0.74, y, s * 0.46);

// Objects, drawn at (x, y) = where they stand, size r. Each returns its parts:
// a and b for the two ink layers, k for paper cut out of the inks, l for ink lines.
const OBJ = {
  cat: (p, x, y, r) => ({
    b: half(x + r * 0.1, y, r * 0.55) + circ(x - r * 0.38, y - r * 0.52, r * 0.3) + poly([x - r * 0.66, y - r * 0.62], [x - r * 0.6, y - r * 0.98], [x - r * 0.38, y - r * 0.8]) + poly([x - r * 0.1, y - r * 0.62], [x - r * 0.16, y - r * 0.98], [x - r * 0.38, y - r * 0.8]),
    a: half(x + r * 0.62, y, r * 0.2),
    l: face(p, x - r * 0.38, y - r * 0.52, r * 0.1),
  }),
  dog: (p, x, y, r) => ({
    b: half(x + r * 0.1, y, r * 0.55) + circ(x - r * 0.35, y - r * 0.55, r * 0.32),
    a: box(x - r * 0.72, y - r * 0.78, r * 0.18, r * 0.36, r * 0.09) + box(x - r * 0.16, y - r * 0.78, r * 0.18, r * 0.36, r * 0.09),
    l: face(p, x - r * 0.35, y - r * 0.52, r * 0.1),
  }),
  coffee: (p, x, y, r) => ({
    b: box(x - r * 0.4, y - r * 0.84, r * 0.8, r * 0.84, r * 0.1),
    a: box(x - r * 0.5, y - r * 0.56, r * 1.0, r * 0.26),
    l: line(p, `M${n(x + r * 0.4)} ${n(y - r * 0.66)} h${n(r * 0.14)} a${n(r * 0.14)} ${n(r * 0.14)} 0 0 1 0 ${n(r * 0.36)} h${n(-r * 0.14)}`) + line(p, `M${n(x - r * 0.1)} ${n(y - r * 1.02)} q${n(r * 0.1)} ${n(-r * 0.12)} 0 ${n(-r * 0.26)} M${n(x + r * 0.14)} ${n(y - r * 1.02)} q${n(r * 0.1)} ${n(-r * 0.12)} 0 ${n(-r * 0.26)}`),
  }),
  tea: (p, x, y, r) => ({
    b: half(x, y - r * 0.62, r * 0.62, 'down'),
    a: box(x - r * 0.7, y - r * 0.68, r * 1.4, r * 0.16, r * 0.08) + box(x - r * 0.5, y - r * 0.06, r * 1.0, r * 0.06),
    l: line(p, `M${n(x + r * 0.56)} ${n(y - r * 0.5)} a${n(r * 0.16)} ${n(r * 0.16)} 0 0 1 ${n(-r * 0.1)} ${n(r * 0.3)}`) + line(p, `M${n(x - r * 0.12)} ${n(y - r * 0.86)} q${n(r * 0.1)} ${n(-r * 0.12)} 0 ${n(-r * 0.26)} M${n(x + r * 0.14)} ${n(y - r * 0.86)} q${n(r * 0.1)} ${n(-r * 0.12)} 0 ${n(-r * 0.26)}`),
  }),
  book: (p, x, y, r) => ({
    b: box(x - r * 0.62, y - r * 0.26, r * 1.24, r * 0.26, r * 0.04) + box(x - r * 0.46, y - r * 0.8, r * 0.92, r * 0.26, r * 0.04),
    a: box(x - r * 0.54, y - r * 0.5, r * 1.04, r * 0.28, r * 0.04),
    l: line(p, `M${n(x - r * 0.48)} ${n(y - r * 0.13)} h${n(r * 0.7)} M${n(x - r * 0.3)} ${n(y - r * 0.67)} h${n(r * 0.5)}`, 1.6),
  }),
  laptop: (p, x, y, r) => ({
    b: box(x - r * 0.56, y - r * 0.92, r * 1.12, r * 0.76, r * 0.06),
    a: box(x - r * 0.78, y - r * 0.2, r * 1.56, r * 0.2, r * 0.06),
    k: fillWith(p.paper, box(x - r * 0.44, y - r * 0.8, r * 0.88, r * 0.52, r * 0.03)),
    l: face(p, x, y - r * 0.56, r * 0.1),
  }),
  phone: (p, x, y, r) => ({
    b: box(x - r * 0.32, y - r * 1.04, r * 0.64, r * 1.04, r * 0.12),
    a: box(x - r * 0.06, y - r * 0.86, r * 0.56, r * 0.26, r * 0.13) + box(x - r * 0.46, y - r * 0.5, r * 0.5, r * 0.22, r * 0.11),
    k: fillWith(p.paper, box(x - r * 0.22, y - r * 0.92, r * 0.44, r * 0.78, r * 0.04)),
  }),
  clock: (p, x, y, r) => ({
    b: circ(x, y - r * 0.5, r * 0.5),
    a: half(x - r * 0.36, y - r * 0.9, r * 0.17) + half(x + r * 0.36, y - r * 0.9, r * 0.17) + box(x - r * 0.4, y - r * 0.08, r * 0.8, r * 0.08),
    k: fillWith(p.paper, circ(x, y - r * 0.5, r * 0.36)),
    l: line(p, `M${n(x)} ${n(y - r * 0.5)} v${n(-r * 0.24)} M${n(x)} ${n(y - r * 0.5)} h${n(r * 0.18)}`),
  }),
  house: (p, x, y, r) => ({
    b: box(x - r * 0.52, y - r * 0.62, r * 1.04, r * 0.62),
    a: poly([x - r * 0.7, y - r * 0.5], [x, y - r * 1.1], [x + r * 0.7, y - r * 0.5]),
    k: fillWith(p.paper, half(x, y, r * 0.18, 'up') + box(x - r * 0.18, y - r * 0.2, r * 0.36, r * 0.2)),
  }),
  plant: (p, x, y, r) => ({
    a: poly([x - r * 0.34, y - r * 0.44], [x + r * 0.34, y - r * 0.44], [x + r * 0.26, y], [x - r * 0.26, y]),
    b: circ(x, y - r * 1.0, r * 0.22) + half(x - r * 0.02, y - r * 0.56, r * 0.26, 'left') + half(x + r * 0.02, y - r * 0.7, r * 0.22, 'right'),
    l: line(p, `M${n(x)} ${n(y - r * 0.44)} V${n(y - r * 0.86)}`),
  }),
  letter: (p, x, y, r) => ({
    b: box(x - r * 0.62, y - r * 0.78, r * 1.24, r * 0.78, r * 0.05),
    a: circ(x, y - r * 0.36, r * 0.14) + box(x + r * 0.3, y - r * 0.9, r * 0.26, r * 0.3),
    l: line(p, `M${n(x - r * 0.62)} ${n(y - r * 0.78)} L${n(x)} ${n(y - r * 0.36)} L${n(x + r * 0.62)} ${n(y - r * 0.78)}`, 1.8),
  }),
  music: (p, x, y, r) => ({
    b: circ(x - r * 0.38, y - r * 0.2, r * 0.18) + circ(x + r * 0.3, y - r * 0.34, r * 0.18),
    a: poly([x - r * 0.24, y - r * 0.98], [x + r * 0.46, y - r * 1.12], [x + r * 0.46, y - r * 0.96], [x - r * 0.24, y - r * 0.82]),
    l: line(p, `M${n(x - r * 0.22)} ${n(y - r * 0.22)} V${n(y - r * 0.92)} M${n(x + r * 0.46)} ${n(y - r * 0.36)} V${n(y - r * 1.06)}`),
  }),
  food: (p, x, y, r) => ({
    b: half(x, y - r * 0.5, r * 0.62, 'down'),
    a: circ(x + r * 0.22, y - r * 0.68, r * 0.13) + box(x - r * 0.3, y - r * 0.06, r * 0.6, r * 0.06),
    k: fillWith(p.paper, half(x - r * 0.04, y - r * 0.5, r * 0.46, 'up')),
    l: line(p, `M${n(x + r * 0.1)} ${n(y - r * 0.62)} l${n(r * 0.5)} ${n(-r * 0.5)} M${n(x + r * 0.26)} ${n(y - r * 0.56)} l${n(r * 0.5)} ${n(-r * 0.5)}`, 1.8),
  }),
  bed: (p, x, y, r) => ({
    b: box(x - r * 0.72, y - r * 0.5, r * 1.44, r * 0.5, r * 0.25),
    a: half(x + r * 0.72, y, r * 0.3, 'up') + box(x - r * 0.1, y - r * 0.24, r * 0.82, r * 0.24),
    l: line(p, `M${n(x + r * 0.44)} ${n(y - r * 0.98)} h${n(r * 0.18)} l${n(-r * 0.18)} ${n(r * 0.2)} h${n(r * 0.18)}`, 1.8),
  }),
  bus: (p, x, y, r) => ({
    b: box(x - r * 0.76, y - r * 0.9, r * 1.52, r * 0.74, r * 0.16),
    a: circ(x - r * 0.42, y - r * 0.16, r * 0.15) + circ(x + r * 0.42, y - r * 0.16, r * 0.15),
    k: fillWith(p.paper, box(x - r * 0.62, y - r * 0.78, r * 0.52, r * 0.26, r * 0.05) + box(x + r * 0.06, y - r * 0.78, r * 0.52, r * 0.26, r * 0.05)),
  }),
  // a band of water with paper wave lines and a strip of shore
  sea: (p, x, y, r) => ({
    b: box(x - r * 0.9, y - r * 0.56, r * 1.8, r * 0.56, r * 0.06),
    a: box(x - r * 0.9, y - r * 0.12, r * 1.8, r * 0.12),
    k: `<g fill="none" stroke="${p.paper}" stroke-width="${n(r * 0.07)}" stroke-linecap="round">` + [0.4, 0.2].map((dy, i) => `<path d="M${n(x - r * (0.7 - i * 0.2))} ${n(y - r * dy)} q${n(r * 0.15)} ${n(-r * 0.12)} ${n(r * 0.3)} 0 t${n(r * 0.3)} 0 t${n(r * 0.3)} 0${i ? '' : ` t${n(r * 0.3)} 0`}"/>`).join('') + '</g>',
  }),
  mountain: (p, x, y, r) => ({
    a: poly([x - r * 0.9, y], [x - r * 0.3, y - r * 0.96], [x + r * 0.3, y]),
    b: poly([x - r * 0.3, y], [x + r * 0.3, y - r * 0.7], [x + r * 0.9, y]),
    k: fillWith(p.paper, poly([x - r * 0.42, y - r * 0.77], [x - r * 0.3, y - r * 0.96], [x - r * 0.18, y - r * 0.77])),
  }),
  heart: (p, x, y, r) => {
    const hp = (cx, cy, s) => `<path d="M${n(cx)} ${n(cy)} L${n(cx - s)} ${n(cy - s)} A${n(s * 0.5)} ${n(s * 0.5)} 0 0 1 ${n(cx)} ${n(cy - s * 1.5)} A${n(s * 0.5)} ${n(s * 0.5)} 0 0 1 ${n(cx + s)} ${n(cy - s)}Z"/>`;
    return { b: hp(x - r * 0.12, y - r * 0.04, r * 0.5), a: hp(x + r * 0.34, y - r * 0.4, r * 0.26) };
  },
  gift: (p, x, y, r) => ({
    b: box(x - r * 0.48, y - r * 0.7, r * 0.96, r * 0.7),
    a: box(x - r * 0.09, y - r * 0.7, r * 0.18, r * 0.7) + circ(x - r * 0.17, y - r * 0.82, r * 0.13) + circ(x + r * 0.17, y - r * 0.82, r * 0.13),
  }),
  friends: (p, x, y, r) => ({
    b: box(x - r * 0.74, y - r * 0.72, r * 0.6, r * 0.72, r * 0.08),
    a: box(x - r * 0.24, y - r * 0.58, r * 0.6, r * 0.58, r * 0.08),
    l: face(p, x - r * 0.48, y - r * 0.44, r * 0.08) + face(p, x + r * 0.08, y - r * 0.3, r * 0.08),
  }),
  money: (p, x, y, r) => ({
    b: half(x, y - r * 0.12, r * 0.56) + box(x - r * 0.4, y - r * 0.12, r * 0.8, r * 0.12),
    a: circ(x + r * 0.08, y - r * 0.66, r * 0.17) + poly([x + r * 0.34, y - r * 0.5], [x + r * 0.62, y - r * 0.6], [x + r * 0.54, y - r * 0.3]),
    l: line(p, `M${n(x - r * 0.14)} ${n(y - r * 0.52)} h${n(r * 0.3)}`, 1.8) + dot(p, x - r * 0.3, y - r * 0.3, r * 0.04),
  }),
  game: (p, x, y, r) => ({
    b: box(x - r * 0.72, y - r * 0.64, r * 1.44, r * 0.6, r * 0.3),
    a: circ(x + r * 0.3, y - r * 0.4, r * 0.09) + circ(x + r * 0.48, y - r * 0.28, r * 0.09),
    l: line(p, `M${n(x - r * 0.5)} ${n(y - r * 0.34)} h${n(r * 0.26)} M${n(x - r * 0.37)} ${n(y - r * 0.47)} v${n(r * 0.26)}`, 2),
  }),
  suitcase: (p, x, y, r) => ({
    b: box(x - r * 0.52, y - r * 0.86, r * 1.04, r * 0.8, r * 0.12),
    a: box(x - r * 0.3, y - r * 0.86, r * 0.14, r * 0.8) + box(x + r * 0.16, y - r * 0.86, r * 0.14, r * 0.8),
    l: line(p, `M${n(x - r * 0.18)} ${n(y - r * 0.86)} v${n(-r * 0.14)} h${n(r * 0.36)} v${n(r * 0.14)}`) + dot(p, x - r * 0.34, y - r * 0.02, r * 0.06) + dot(p, x + r * 0.34, y - r * 0.02, r * 0.06),
  }),
  bike: (p, x, y, r) => ({
    a: circ(x - r * 0.48, y - r * 0.28, r * 0.28) + circ(x + r * 0.48, y - r * 0.28, r * 0.28),
    b: box(x - r * 0.2, y - r * 0.86, r * 0.32, r * 0.1, r * 0.05) + half(x + r * 0.36, y - r * 0.74, r * 0.12, 'right'),
    k: fillWith(p.paper, circ(x - r * 0.48, y - r * 0.28, r * 0.08) + circ(x + r * 0.48, y - r * 0.28, r * 0.08)),
    l: line(p, `M${n(x - r * 0.48)} ${n(y - r * 0.28)} L${n(x - r * 0.08)} ${n(y - r * 0.76)} H${n(x + r * 0.32)} L${n(x + r * 0.48)} ${n(y - r * 0.28)} M${n(x - r * 0.08)} ${n(y - r * 0.76)} L${n(x + r * 0.08)} ${n(y - r * 0.28)} L${n(x - r * 0.48)} ${n(y - r * 0.28)}`, 1.8),
  }),
};

// Companions: paper-white with a thin ink outline and pink cheeks, standing at (x, y).
const outline = (p, d, w) => `<path d="${d}" fill="${p.paper === NIGHT ? '#F5F6F1' : '#FFFFFF'}" stroke="${p.paper === NIGHT ? '#F5F6F1' : p.ink}" stroke-width="${n(w)}" stroke-linejoin="round"/>`;
const cheeks = (x, y, s) => `<ellipse cx="${n(x - s)}" cy="${n(y)}" rx="${n(s * 0.24)}" ry="${n(s * 0.14)}" fill="${MOMO}"/><ellipse cx="${n(x + s)}" cy="${n(y)}" rx="${n(s * 0.24)}" ry="${n(s * 0.14)}" fill="${MOMO}"/>`;
const sprout = (x, y, s, ink) => `<path d="M${n(x)} ${n(y)} v${n(-s * 0.3)}" stroke="${ink}" stroke-width="${n(s * 0.06)}" stroke-linecap="round"/>` + `<g fill="${MOSS}">${half(x - s * 0.17, y - s * 0.3, s * 0.17)}${half(x + s * 0.17, y - s * 0.36, s * 0.17)}</g>`;
// ink on the paper-white body is always dark, even at night
const kp = (p) => ({ ...p, ink: INK });
const PAL_CREATURE = {
  // a small cloud, round and soft, with a sprout: Murmur's own companion
  cloudlet: (p, x, y, r) => {
    const s = r / 40;
    const T = (px, py) => `${n(x + (px - 52) * s)} ${n(y + (py - 80) * s)}`;
    const d = `M${T(18, 70)} C${T(10, 70)} ${T(8, 56)} ${T(17, 51)} C${T(14, 36)} ${T(30, 24)} ${T(42, 29)} C${T(48, 19)} ${T(66, 19)} ${T(71, 30)} C${T(84, 26)} ${T(96, 38)} ${T(90, 51)} C${T(99, 56)} ${T(96, 71)} ${T(86, 71)} C${T(80, 84)} ${T(26, 84)} ${T(18, 70)}Z`;
    return sprout(x, y - r * 1.38, r, INK) + outline(p, d, r * 0.06) + cheeks(x, y - r * 0.4, r * 0.46) + face(kp(p), x, y - r * 0.6, r * 0.28);
  },
  bun: (p, x, y, r) => outline(p, `M${n(x - r * 0.95)} ${n(y)} C${n(x - r)} ${n(y - r * 0.75)} ${n(x - r * 0.45)} ${n(y - r * 1.2)} ${n(x)} ${n(y - r * 1.2)} C${n(x + r * 0.45)} ${n(y - r * 1.2)} ${n(x + r)} ${n(y - r * 0.75)} ${n(x + r * 0.95)} ${n(y)}Z`, r * 0.06) + line(kp(p), `M${n(x - r * 0.22)} ${n(y - r * 1.02)} q${n(r * 0.22)} ${n(r * 0.14)} ${n(r * 0.44)} 0`, r * 0.05) + cheeks(x, y - r * 0.36, r * 0.5) + face(kp(p), x, y - r * 0.56, r * 0.26),
  cat: (p, x, y, r) => `<path d="M${n(x + r * 0.7)} ${n(y - r * 0.2)} q${n(r * 0.55)} ${n(-r * 0.05)} ${n(r * 0.42)} ${n(-r * 0.62)}" stroke="${p.b}" stroke-width="${n(r * 0.18)}" fill="none" stroke-linecap="round"/>` + outline(p, `M${n(x - r * 0.85)} ${n(y)} C${n(x - r * 0.9)} ${n(y - r * 0.6)} ${n(x - r * 0.8)} ${n(y - r * 0.9)} ${n(x - r * 0.72)} ${n(y - r * 1.0)} L${n(x - r * 0.66)} ${n(y - r * 1.36)} L${n(x - r * 0.34)} ${n(y - r * 1.1)} Q${n(x)} ${n(y - r * 1.18)} ${n(x + r * 0.34)} ${n(y - r * 1.1)} L${n(x + r * 0.66)} ${n(y - r * 1.36)} L${n(x + r * 0.72)} ${n(y - r * 1.0)} C${n(x + r * 0.8)} ${n(y - r * 0.9)} ${n(x + r * 0.9)} ${n(y - r * 0.6)} ${n(x + r * 0.85)} ${n(y)}Z`, r * 0.06) + cheeks(x, y - r * 0.5, r * 0.5) + face(kp(p), x, y - r * 0.7, r * 0.26),
  dog: (p, x, y, r) => outline(p, `M${n(x - r * 0.82)} ${n(y)} C${n(x - r * 0.9)} ${n(y - r * 0.9)} ${n(x - r * 0.5)} ${n(y - r * 1.2)} ${n(x)} ${n(y - r * 1.2)} C${n(x + r * 0.5)} ${n(y - r * 1.2)} ${n(x + r * 0.9)} ${n(y - r * 0.9)} ${n(x + r * 0.82)} ${n(y)}Z`, r * 0.06) + `<g fill="${p.b}">${box(x - r * 0.96, y - r * 1.02, r * 0.3, r * 0.6, r * 0.15)}${box(x + r * 0.66, y - r * 1.02, r * 0.3, r * 0.6, r * 0.15)}</g>` + cheeks(x, y - r * 0.42, r * 0.48) + face(kp(p), x, y - r * 0.64, r * 0.26),
  bird: (p, x, y, r) => outline(p, `M${n(x - r * 0.8)} ${n(y - r * 0.12)} C${n(x - r * 0.84)} ${n(y - r * 0.9)} ${n(x - r * 0.3)} ${n(y - r * 1.16)} ${n(x + r * 0.1)} ${n(y - r * 1.12)} C${n(x + r * 0.6)} ${n(y - r * 1.08)} ${n(x + r * 0.84)} ${n(y - r * 0.6)} ${n(x + r * 0.8)} ${n(y - r * 0.12)}Z`, r * 0.06) + `<g fill="${p.b}">${half(x - r * 0.16, y - r * 0.46, r * 0.36, 'down')}</g>` + `<path d="M${n(x + r * 0.78)} ${n(y - r * 0.78)} l${n(r * 0.3)} ${n(r * 0.1)} l${n(-r * 0.3)} ${n(r * 0.12)}Z" fill="${EGG}"/>` + line(kp(p), `M${n(x - r * 0.2)} ${n(y - r * 0.1)} v${n(r * 0.1)} M${n(x + r * 0.2)} ${n(y - r * 0.1)} v${n(r * 0.1)}`, r * 0.06) + dot(kp(p), x + r * 0.36, y - r * 0.8, r * 0.07) + `<ellipse cx="${n(x + r * 0.5)}" cy="${n(y - r * 0.6)}" rx="${n(r * 0.1)}" ry="${n(r * 0.06)}" fill="${MOMO}"/>`,
  sprout: (p, x, y, r) => sprout(x, y - r * 0.86, r * 1.3, INK) + outline(p, `M${n(x - r * 0.72)} ${n(y - r * 0.86)} H${n(x + r * 0.72)} L${n(x + r * 0.56)} ${n(y)} H${n(x - r * 0.56)}Z`, r * 0.06) + cheeks(x, y - r * 0.34, r * 0.42) + face(kp(p), x, y - r * 0.52, r * 0.22),
  lamp: (p, x, y, r) => `<g fill="${p.b}">${half(x, y - r * 0.8, r * 0.62)}${box(x - r * 0.36, y - r * 0.08, r * 0.72, r * 0.08, r * 0.04)}</g>` + `<path d="M${n(x)} ${n(y - r * 0.8)} V${n(y - r * 0.08)}" stroke="${p.ink}" stroke-width="${n(r * 0.06)}" stroke-linecap="round"/>` + dot(kp(p), x - r * 0.18, y - r * 0.98, r * 0.05) + dot(kp(p), x + r * 0.18, y - r * 0.98, r * 0.05),
};

// Small mark for the lens the person looked through, in ink.
const GLYPH = {
  iceberg: (c) => `<path d="M-9 1 l5 -8 l4 4 l3 -2 l6 6z" fill="${c}"/><path d="M-11 4 h22 l-5 8 h-12z" fill="none" stroke="${c}" stroke-width="1.4"/>`,
  bridge: (c) => `<path d="M-11 5 q11 -14 22 0" stroke="${c}" stroke-width="2" fill="none"/><path d="M-11 5 h22" stroke="${c}" stroke-width="1.6"/>`,
  star: (c) => `<path d="M0 -10 l3 7 l7 1 l-5 5 l1 7 l-6 -3 l-6 3 l1 -7 l-5 -5 l7 -1z" fill="${c}"/>`,
  sun: (c) => `<circle r="5" fill="${c}"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M${(Math.cos((a * Math.PI) / 180) * 8).toFixed(1)} ${(Math.sin((a * Math.PI) / 180) * 8).toFixed(1)} L${(Math.cos((a * Math.PI) / 180) * 11).toFixed(1)} ${(Math.sin((a * Math.PI) / 180) * 11).toFixed(1)}" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`).join('')}`,
  chair: (c) => `<path d="M-6 -10 v18 M-6 0 h12 v8 M6 0 v-2" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  steps: (c) => `<path d="M-10 8 h6 v-6 h6 v-6 h6 v-6" stroke="${c}" stroke-width="2" fill="none" stroke-linejoin="round"/>`,
  leaf: (c) => `<path d="M-8 8 C -8 -6, 4 -10, 10 -10 C 10 -2, 4 8, -8 8z" fill="${c}"/>`,
  scale: (c) => `<path d="M0 -9 v17 M-9 -5 h18 M-9 -5 l-3 7 h6z M9 -5 l-3 7 h6z" stroke="${c}" stroke-width="1.6" fill="none" stroke-linejoin="round"/>`,
  lens: (c) => `<circle cx="-2" cy="-2" r="6" stroke="${c}" stroke-width="2" fill="none"/><path d="M3 3 l6 6" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`,
  compass: (c) => `<circle r="9" stroke="${c}" stroke-width="1.6" fill="none"/><path d="M0 -6 l3 6 l-3 6 l-3 -6z" fill="${c}"/>`,
  circle: (c) => `${[0, 90, 180, 270].map((a) => `<circle cx="${(Math.cos((a * Math.PI) / 180) * 6).toFixed(1)}" cy="${(Math.sin((a * Math.PI) / 180) * 6).toFixed(1)}" r="3.5" fill="${c}"/>`).join('')}`,
  ladder: (c) => `<path d="M-5 10 v-20 M5 10 v-20 M-5 5 h10 M-5 0 h10 M-5 -5 h10" stroke="${c}" stroke-width="1.6" fill="none"/>`,
  book: (c) => `<path d="M0 6 q-5 -3 -10 0 v-12 q5 -3 10 0z M0 6 q5 -3 10 0 v-12 q-5 -3 -10 0z" fill="${c}"/>`,
  knots: (c) => `<circle cx="-6" cy="3" r="4" fill="${c}"/><circle cx="6" cy="3" r="4" fill="${c}"/><circle cx="0" cy="-6" r="4" fill="${c}"/><path d="M-6 3 L0 -6 L6 3z" stroke="${c}" stroke-width="1.4" fill="none"/>`,
};

// The picture sits in an arch on the left; the words take the right.
const ARCH = { x: 32, y: 32, w: 232, b: 368 };
const G = 300; // where things stand
const archPath = () => {
  const r = ARCH.w / 2;
  return `M${ARCH.x} ${ARCH.b} V${ARCH.y + r} A${r} ${r} 0 0 1 ${ARCH.x + ARCH.w} ${ARCH.y + r} V${ARCH.b}Z`;
};

// The ground and what stands behind the things, by topic. Returns layer parts.
function backdrop(setting, p, count = 0) {
  const L = ARCH.x;
  const R = ARCH.x + ARCH.w;
  const ground = box(L - 4, G, ARCH.w + 8, ARCH.b - G + 4);
  switch (setting) {
    case 'desk':
      // a small window
      return { a: ground, k: fillWith(p.paper, box(L + 30, 190, 56, 46, 3)), l: line(p, `M${L + 58} 190 v46 M${L + 30} 213 h56`, 1) };
    case 'bench':
      return { a: ground + box(L + 30, G - 30, 172, 8, 4) + box(L + 44, G - 26, 7, 26) + box(L + 182, G - 26, 7, 26) };
    case 'roof':
      if (count > 1) return { a: ground };
      // a house far off on the ground
      return { a: ground + box(R - 66, G - 40, 46, 40) + poly([R - 74, G - 38], [R - 43, G - 64], [R - 12, G - 38]), k: fillWith(p.sky, box(R - 50, G - 30, 14, 14, 1)) };
    case 'path':
      return { a: ground + half(L + 60, G, 64) };
    case 'candle':
      if (count > 1) return { a: ground };
      return { a: ground, b: box(R - 40, G - 44, 14, 44, 2) + circ(R - 33, G - 54, 6) + poly([R - 39, G - 55], [R - 33, G - 70], [R - 27, G - 55]) };
    default:
      return { a: ground + half(R - 26, G, 58) };
  }
}

// The sky: sun or moon in ink b, and the weather on top (clouds of paper, rain and wind
// in ink a, fog as bands of paper).
function sky(weather, p, rand, uid, count = 0) {
  const out = { b: '', k: '', top: '' };
  const cloud = (x, y, s, cls) => `<g class="${cls}" fill="${p.paper}">${cloudShape(x, y, s)}</g>`;
  const sunAt = { sunny: [192, 112, 44], clear: [196, 110, 34], mixed: [178, 128, 38], cloudy: [200, 110, 26], rain: [204, 104, 22], wind: [196, 104, 28], fog: [150, 132, 40], dusk: [158, G, 56], night: [196, 104, 28] }[weather] || [196, 110, 34];
  let [sx, sy, sr] = sunAt;
  // the low dusk sun sets in the gap between things, or stays up when there is none
  if (weather === 'dusk') [sx, sy, sr] = [[196, G, 52], [196, G, 52], [146, G, 40], [150, 196, 38]][Math.min(3, count)];
  if (weather === 'fog') out.k += `<g class="${uid}-sun" fill="${p.sun}">${circ(sx, sy, sr)}</g>`;
  else out.b += circ(sx, sy, sr);
  if (weather === 'night') {
    // a crescent: the sky takes a bite out of the moon, and a few small stars
    out.k += fillWith(p.sky, circ(sx + sr * 0.46, sy - sr * 0.3, sr * 0.86));
    for (let i = 0; i < 7; i++) out.b += circ(48 + rand() * 120, 70 + rand() * 120, 1.6 + rand() * 1.8);
  }
  switch (weather) {
    case 'mixed':
      out.top += cloud(150, 158, 46, `${uid}-cloud`);
      break;
    case 'cloudy':
      out.top += cloud(112, 128, 44, `${uid}-cloud`) + cloud(206, 150, 34, `${uid}-cloud2`);
      break;
    case 'rain': {
      let d = '';
      for (let i = 0; i < 10; i++) {
        const x = 52 + rand() * 180;
        const y = 150 + rand() * 90;
        d += box(x, y, 3, 11, 1.5);
      }
      out.top += `<g class="${uid}-rain" fill="${p.a}">${d}</g>` + cloud(110, 128, 46, `${uid}-cloud`) + cloud(214, 112, 30, `${uid}-cloud2`);
      break;
    }
    case 'wind': {
      let w = '';
      for (let i = 0; i < 3; i++) {
        const y = 140 + i * 24;
        const x = 70 + i * 16 + rand() * 12;
        w += `<path d="M${n(x)} ${n(y)} h${n(100 + rand() * 30)} a10 10 0 1 0 -10 -10" stroke="${p.a}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="150 60"/>`;
      }
      out.top += `<g class="${uid}-wind">${w}</g>`;
      break;
    }
    case 'fog': {
      let f = '';
      for (let i = 0; i < 4; i++) f += box(ARCH.x - 10 + (i % 2) * 40 + rand() * 20, 150 + i * 40, 150 + rand() * 50, 12, 6);
      out.top += `<g class="${uid}-fog" fill="${p.paper}">${f}</g>`;
      break;
    }
    case 'dusk':
      out.top += cloud(96, 118, 34, `${uid}-cloud`);
      break;
    default:
  }
  return out;
}

// The animation, scoped to this card. Clouds slide aside, rain eases, the companion hops
// twice, sparkles twinkle. Nothing moves when reduced motion is asked for.
function motionCss(uid, scene) {
  const clear = scene.clearing || scene.weather === 'sunny' || scene.weather === 'mixed';
  return `<style>@media (prefers-reduced-motion: no-preference){
  .${uid}-pal{animation:${uid}hop 1.1s cubic-bezier(.3,1.6,.5,1) .5s 2 both;transform-box:fill-box;transform-origin:50% 100%}
  .${uid}-spark{animation:${uid}tw 1.6s ease-in-out .9s 3 both;transform-box:fill-box;transform-origin:center}
  ${clear ? `.${uid}-wind{animation:${uid}fade 2s ease .4s both}.${uid}-fog{animation:${uid}fade 2.4s ease .3s both}.${uid}-cloud{animation:${uid}drift 2.4s ease-in-out .3s both}.${uid}-cloud2{animation:${uid}drift2 2.4s ease-in-out .3s both}.${uid}-rain{animation:${uid}fade 1.8s ease .4s both}.${uid}-sun{animation:${uid}rise 2.4s ease .6s both}` : `.${uid}-cloud{animation:${uid}sway 6s ease-in-out infinite alternate}.${uid}-cloud2{animation:${uid}sway 7s ease-in-out -2s infinite alternate-reverse}.${uid}-rain{animation:${uid}fall 1.2s linear infinite}.${uid}-wind path{animation:${uid}blow 2.2s linear infinite}`}
  @keyframes ${uid}hop{0%,100%{transform:translateY(0) scale(1,1)}30%{transform:translateY(-14px) scale(.95,1.06)}60%{transform:translateY(0) scale(1.06,.94)}}
  @keyframes ${uid}tw{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1)}}
  @keyframes ${uid}drift{to{transform:translateX(-90px)}}
  @keyframes ${uid}drift2{to{transform:translateX(80px)}}
  @keyframes ${uid}sway{from{transform:translateX(-6px)}to{transform:translateX(8px)}}
  @keyframes ${uid}fade{to{opacity:0}}
  @keyframes ${uid}blow{to{stroke-dashoffset:-210}}
  @keyframes ${uid}rise{from{transform:translateY(10px)}to{transform:translateY(0)}}
  @keyframes ${uid}fall{0%{transform:translateY(-6px)}100%{transform:translateY(8px)}}
}</style>`;
}

const FONT = `'Murmur Round', ui-sans-serif, system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif`;
const isCjk = (s) => /[　-鿿＀-￯]/.test(s);

// The words: the line large on the right, the name small and vertical along a hairline at
// the right edge with a small English caption under it, the date and "Murmur" small.
function words(p, { line: text, label, caption, date, brand, glyph, fitText }) {
  const out = [];
  const X = 300;
  const fit = fitText ? fitText(text) : { lines: [text], size: 20, lh: 28 };
  const top = 60 + fit.size;
  fit.lines.forEach((l, i) => out.push(`<text x="${X}" y="${top + i * fit.lh}" font-size="${fit.size}" font-weight="600" fill="${p.ink}" font-family="${FONT}">${esc(l)}</text>`));
  // the spine
  const SX = 548;
  out.push(`<path d="M${SX} 32 V368" stroke="${p.ink}" stroke-width="0.75"/>`);
  const cx = 570;
  let y = 40;
  const lab = String(label || '').trim();
  if (lab && isCjk(lab)) {
    const chars = [...lab];
    const step = Math.min(17, 236 / chars.length);
    const size = Math.min(14, step - 1);
    out.push(`<text font-size="${n(size)}" fill="${p.ink}" text-anchor="middle" font-family="${FONT}" letter-spacing="0">${chars.map((ch, i) => `<tspan x="${cx}" y="${n(y + size + i * step)}">${esc(ch)}</tspan>`).join('')}</text>`);
    y += size + chars.length * step + 6;
  } else if (lab) {
    const size = Math.min(12, 250 / Math.max(1, lab.length * 0.56));
    out.push(`<text transform="translate(${cx - size * 0.36} ${y}) rotate(90)" font-size="${n(size)}" fill="${p.ink}" font-family="${FONT}" letter-spacing=".04em">${esc(lab)}</text>`);
    y += lab.length * size * 0.6 + 12;
  }
  if (caption && y < 300) out.push(`<text transform="translate(${cx - 3} ${n(y + 4)}) rotate(90)" font-size="8" fill="${p.ink}" font-family="${FONT}" letter-spacing=".16em">${esc(caption.toUpperCase())}</text>`);
  if (glyph) out.push(`<g transform="translate(${cx} 350) scale(.8)">${glyph}</g>`);
  out.push(`<text x="${X}" y="364" font-size="12" fill="${p.ink}" font-family="${FONT}" letter-spacing=".04em">${esc(date || '')}</text>`);
  out.push(`<text x="528" y="364" font-size="11" fill="${p.ink}" text-anchor="end" font-family="${FONT}" letter-spacing=".08em">${esc(brand || '')}</text>`);
  return out.join('');
}

// Put the parts together as a print: ink a, ink b slipped by OFF, their crossing in c,
// paper cut-outs, then ink lines. passes: lists of parts { a, b, k, l } printed one over the
// other (the land and sky first, then the things), so a thing covers the land behind it.
// top: weather over the inks; front: the companion, not clipped by the arch.
export function printCard(p, { uid, passes, top = '', front = '', css = '', words: w, img = true }) {
  const off = `translate(${OFF[0]} ${OFF[1]})`;
  const defs = [];
  const body = passes.map((parts, i) => {
    const A = parts.map((x) => x.a || '').join('');
    const B = parts.map((x) => x.b || '').join('');
    const K = parts.map((x) => x.k || '').join('');
    const Ln = parts.map((x) => x.l || '').join('');
    if (A && B) defs.push(`<clipPath id="${uid}ov${i}" transform="${off}">${B}</clipPath>`);
    return `${fillWith(p.a, A)}${B ? `<g transform="${off}" fill="${p.b}">${B}</g>` : ''}${A && B ? `<g fill="${p.c}" clip-path="url(#${uid}ov${i})">${A}</g>` : ''}${K ? `<g transform="${off}">${K}</g>` : ''}${Ln}`;
  });
  const W = 600;
  const H = 400;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"${img ? ' role="img"' : ''}>
  <defs><clipPath id="${uid}card"><rect width="${W}" height="${H}" rx="22"/></clipPath><clipPath id="${uid}arch"><path d="${archPath()}"/></clipPath>${defs.join('')}</defs>
  ${css}
  <g clip-path="url(#${uid}card)"><rect width="${W}" height="${H}" fill="${p.paper}"/>
  <g clip-path="url(#${uid}arch)"><rect x="0" y="0" width="300" height="${H}" fill="${p.sky}"/>
  ${body[0] || ''}${top}${body.slice(1).join('')}</g>
  ${front}${w}</g>
</svg>`;
}

const CAPTION = { clear: 'clear sky', sunny: 'sunny', mixed: 'sun and cloud', cloudy: 'cloudy', rain: 'rain', wind: 'wind', fog: 'mist', dusk: 'dusk', night: 'quiet night' };

// Draw the card. line: the main text; label: a small heading; date; animate: add motion.
export function sceneSvg(scene, { seed = 'm', line = '', label = '', date = '', brand = 'Murmur', animate = false, fitText = null } = {}) {
  const rand = rng(seed + JSON.stringify(scene.objects) + scene.weather);
  const uid = 'sc' + Math.floor(rand() * 1e9).toString(36);
  const p = pal(scene.weather);
  const back = backdrop(scene.setting, p, scene.objects.length);
  const s = sky(scene.weather, p, rand, uid, scene.objects.length);
  // things stand along the ground, spread by how many there are
  const xs = [[96], [84, 208], [72, 150, 226]][Math.max(0, scene.objects.length - 1)];
  const r = [44, 42, 36][Math.max(0, scene.objects.length - 1)];
  const things = scene.objects.filter((o) => OBJ[o]).map((o, i) => OBJ[o](p, xs[i], G, r));
  const draw = PAL_CREATURE[scene.companion] || PAL_CREATURE.cloudlet;
  const front = `<g class="${uid}-pal">${draw(p, 148, 362, scene.companion === 'lamp' ? 56 : 34)}</g>`;
  // sparkles: small four-point stars in ink b, just above the arch
  let sp = '';
  for (let i = 0; i < 4; i++) {
    const x = 92 + rand() * 120;
    const y = 64 + rand() * 60;
    const k = 4 + rand() * 3;
    sp += `<path class="${uid}-spark" style="animation-delay:${(0.9 + i * 0.25).toFixed(2)}s" d="M${n(x)} ${n(y - k)} L${n(x + k * 0.28)} ${n(y - k * 0.28)} L${n(x + k)} ${n(y)} L${n(x + k * 0.28)} ${n(y + k * 0.28)} L${n(x)} ${n(y + k)} L${n(x - k * 0.28)} ${n(y + k * 0.28)} L${n(x - k)} ${n(y)} L${n(x - k * 0.28)} ${n(y - k * 0.28)}Z" fill="${p.b}"/>`;
  }
  const caption = scene.calm ? 'quiet night' : scene.clearing ? 'clearing' : CAPTION[scene.weather] || '';
  const glyph = scene.lensGlyph && GLYPH[scene.lensGlyph] ? GLYPH[scene.lensGlyph](p.ink) : '';
  return printCard(p, {
    uid,
    passes: [[back, { b: s.b, k: s.k }], things],
    top: s.top + `<g>${sp}</g>`,
    front,
    css: animate ? motionCss(uid, scene) : '',
    words: words(p, { line, label, caption, date, brand, glyph, fitText }),
  });
}

// For the postcard (js/postcard.js): the same print, with its own picture.
export const print = { PAPER, INK, NIGHT, AO, MOMO, EGG, MOSS, tint, circ, box, half, poly, line, dot, face, fillWith, cloudShape, OBJ, PAL_CREATURE, G, ARCH, words, n, esc };

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
