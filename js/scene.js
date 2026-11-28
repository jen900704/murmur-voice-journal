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
// small animation (the pieces come in on the grid, the sun grows, Mumu hops once), wrapped
// in prefers-reduced-motion so it stays still for people who asked for less motion.

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
// 丙「圓方」: a small poster built from circles, half-circles and square blocks in flat
// colour. The left of the card is the picture, drawn on an 80-unit grid (two columns, three
// rows): a ground colour picked by the weather, a second colour square top right holding
// the sun or moon, the weather as ink bars top left, a ground plane along the bottom, an
// ink hill, the things the person named as chunky pictograms, and Mumu sitting on the
// plane. The right is a white panel with the person's line large, the approach name and
// the date small. No gradients, shadows or outlines; ink is only for small details.

const INK = '#151515';
const WHITE = '#FFFFFF';
const MUTED = '#5C5A55';
const JADE = '#0E7C66'; // 玉
const RED = '#EA4B2D'; // 朱
const SUN = '#F2B91D'; // 黃
const PINK = '#F4A7B9'; // 粉
const NAVY = '#12173A'; // 夜

// Each card: ground (the whole picture), cell (the square behind the sun), orb (sun or
// moon), plane (what Mumu sits on), hill, mark (weather bars) and acc (the second colour of
// things; things are white first).
const PRINT = {
  clear: { ground: JADE, cell: SUN, orb: RED, plane: PINK, acc: SUN },
  sunny: { ground: PINK, cell: SUN, orb: RED, plane: JADE, acc: RED },
  mixed: { ground: SUN, cell: JADE, orb: RED, plane: PINK, acc: RED },
  cloudy: { ground: PINK, cell: JADE, orb: WHITE, plane: SUN, acc: RED },
  rain: { ground: JADE, cell: PINK, orb: WHITE, plane: SUN, acc: SUN },
  wind: { ground: SUN, cell: PINK, orb: RED, plane: JADE, acc: RED },
  fog: { ground: PINK, cell: JADE, orb: SUN, plane: JADE, acc: RED, mark: WHITE },
  dusk: { ground: RED, cell: PINK, orb: SUN, plane: JADE, acc: SUN },
  night: { ground: NAVY, cell: NAVY, orb: SUN, plane: JADE, hill: RED, acc: SUN, mark: PINK, night: true },
};
const pal = (w) => ({ hill: INK, mark: INK, night: false, ...(PRINT[w] || PRINT.clear) });

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

// shapes, each with its flat fill
const n = (v) => +(+v).toFixed(1);
const circ = (cx, cy, r, c) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${c}"/>`;
const box = (x, y, w, h, c) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${c}"/>`;
// a half-circle with its flat side on (cx, cy): up, down, left or right
function half(cx, cy, r, dir, c) {
  const d =
    dir === 'down' ? `M${n(cx - r)} ${n(cy)} A${n(r)} ${n(r)} 0 0 0 ${n(cx + r)} ${n(cy)}Z`
    : dir === 'left' ? `M${n(cx)} ${n(cy - r)} A${n(r)} ${n(r)} 0 0 0 ${n(cx)} ${n(cy + r)}Z`
    : dir === 'right' ? `M${n(cx)} ${n(cy - r)} A${n(r)} ${n(r)} 0 0 1 ${n(cx)} ${n(cy + r)}Z`
    : `M${n(cx - r)} ${n(cy)} A${n(r)} ${n(r)} 0 0 1 ${n(cx + r)} ${n(cy)}Z`;
  return `<path d="${d}" fill="${c}"/>`;
}
const poly = (c, ...pts) => `<path d="M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(' L')}Z" fill="${c}"/>`;
// a cloud: three half-circles on one flat line
const cloudShape = (x, y, s, c) => half(x, y, s * 0.6, 'up', c) + half(x - s * 0.74, y, s * 0.38, 'up', c) + half(x + s * 0.72, y, s * 0.44, 'up', c);
// a crescent: the ground takes a bite out of the moon
const crescent = (x, y, r, c, ground) => circ(x, y, r, c) + circ(x - r * 0.4, y - r * 0.3, r * 0.88, ground);

// Things, as pictograms of two or three flat pieces. Each is drawn in its own 60 x 60
// square, standing on (0, 0) with x from -30 to 30 and y going up to -60. W is white, A the
// card's accent, B its second colour, K ink.
const OBJ = {
  cat: ({ W, A, K }) => half(6, 0, 22, 'up', W) + circ(-12, -28, 14, W) + poly(W, [-26, -30], [-24, -50], [-12, -40]) + poly(W, [2, -30], [0, -50], [-12, -40]) + circ(-17, -29, 2.4, K) + circ(-7, -29, 2.4, K) + box(22, -22, 6, 22, A),
  dog: ({ W, A, K }) => half(6, 0, 22, 'up', W) + circ(-12, -28, 14, W) + box(-30, -40, 9, 22, A) + box(-3, -40, 9, 22, A) + circ(-17, -30, 2.4, K) + circ(-7, -30, 2.4, K) + circ(-12, -22, 3, K),
  coffee: ({ W, A, K }) => half(14, -20, 14, 'right', A) + box(-18, -40, 34, 40, W) + box(-10, -56, 5, 11, W) + box(2, -56, 5, 11, W),
  tea: ({ W, A, K }) => half(0, -32, 24, 'down', W) + box(-28, -8, 56, 8, A) + box(-8, -50, 5, 12, W) + box(4, -50, 5, 12, W),
  book: ({ W, A, B }) => box(-28, -14, 56, 14, A) + box(-20, -28, 46, 14, W) + box(-26, -42, 42, 14, B),
  laptop: ({ W, A }) => box(-22, -40, 44, 30, W) + box(-30, -10, 60, 10, A),
  phone: ({ W, A, K }) => box(-15, -54, 30, 54, W) + box(-10, -47, 20, 32, A) + circ(0, -8, 3.2, K),
  clock: ({ W, A, K }) => circ(0, -28, 27, W) + box(-2.5, -47, 5, 21, K) + box(-2.5, -30.5, 17, 5, K) + circ(0, -28, 4.5, A),
  house: ({ W, A, K }) => poly(A, [-30, -30], [0, -58], [30, -30]) + box(-22, -30, 44, 30, W) + box(-6, -18, 12, 18, K),
  plant: ({ W, A }) => box(-2.5, -42, 5, 22, W) + half(-2, -40, 15, 'left', W) + half(2, -46, 12, 'right', W) + box(-15, -22, 30, 22, A),
  letter: ({ W, A }) => box(-28, -38, 56, 38, W) + poly(A, [-28, -38], [0, -15], [28, -38]),
  music: ({ W, A }) => circ(-14, -10, 10, W) + circ(16, -15, 10, W) + box(-9, -50, 5, 40, W) + box(21, -55, 5, 40, W) + poly(A, [-9, -52], [26, -58], [26, -47], [-9, -41]),
  food: ({ W, A, K }) => half(0, -30, 19, 'up', A) + half(0, -30, 27, 'down', W) + poly(W, [8, -40], [26, -58], [29, -55], [11, -37]) + poly(W, [16, -38], [34, -56], [37, -53], [19, -35]),
  bed: ({ W, A, B }) => box(-30, -42, 8, 42, W) + box(-22, -18, 52, 18, W) + box(-20, -29, 20, 11, B) + box(4, -26, 26, 26, A),
  bus: ({ W, A, K }) => box(-30, -46, 60, 36, W) + box(-24, -40, 21, 14, K) + box(3, -40, 21, 14, K) + circ(-16, -9, 9, A) + circ(16, -9, 9, A),
  // three curling crests over a band of water
  sea: ({ W, A, G }) => [-20, 0, 20].map((x) => circ(x, -20, 10, W) + circ(x + 5, -24, 8, G)).join('') + box(-30, -20, 60, 8, W) + box(-30, -12, 60, 12, A),
  mountain: ({ W, A }) => poly(W, [-30, 0], [-6, -50], [18, 0]) + poly(A, [-2, 0], [14, -30], [30, 0]),
  heart: ({ W, A }) => circ(-10, -34, 12, A) + circ(10, -34, 12, A) + poly(A, [-20.4, -27.5], [0, -4], [20.4, -27.5], [0, -36]) + circ(22, -52, 6, W),
  gift: ({ W, A }) => box(-22, -34, 44, 34, W) + box(-5, -34, 10, 34, A) + circ(-9, -41, 8, A) + circ(9, -41, 8, A),
  bike: ({ W, A, K }) => circ(-17, -14, 14, W) + circ(17, -14, 14, W) + `<path d="M-17 -14 L-5 -38 H12 L17 -14 M-5 -38 L4 -14 H-17" fill="none" stroke="${A}" stroke-width="4" stroke-linejoin="miter"/>` + box(-12, -46, 14, 5, W) + circ(-17, -14, 3.4, K) + circ(17, -14, 3.4, K),
  friends: ({ W, A, K }) => box(-26, -36, 24, 36, W) + box(2, -28, 24, 28, A) + box(-16, -48, 4, 9, W) + box(12, -40, 4, 9, A),
  money: ({ W, A, K }) => box(-19, -38, 38, 38, W) + box(-22, -46, 44, 8, A) + circ(0, -18, 10, A) + box(-1.5, -24, 3, 12, K),
  game: ({ W, A, K }) => circ(-18, -18, 14, W) + circ(18, -18, 14, W) + box(-18, -32, 36, 22, W) + box(-25, -24, 14, 4.5, K) + box(-20.2, -28.8, 4.5, 14, K) + circ(14, -25, 4, A) + circ(22, -17, 4, A),
  suitcase: ({ W, A }) => box(-10, -50, 4, 12, W) + box(6, -50, 4, 12, W) + box(-10, -50, 20, 4, W) + box(-23, -40, 46, 40, A) + box(-23, -26, 46, 7, W),
};
// one thing standing on (x, y), w wide
const thing = (name, p, x, y, w) => `<g transform="translate(${n(x)} ${n(y)}) scale(${n4(w / 60)})">${OBJ[name]({ W: WHITE, A: p.acc, B: p.night ? PINK : p.cell, K: INK, G: p.ground })}</g>`;
const n4 = (v) => +(+v).toFixed(4);

// Mumu, solid: white body, big red cheeks, ink features, a sprout. Drawn in her own
// 124 x 92 box (see docs: viewBox 0 -12 124 104); the caller places and scales her.
function mumu(state, leaf) {
  const rot = state === 'sleepy' ? -38 : 6;
  const faceOf =
    state === 'sleepy'
      ? box(44, 59, 10, 3, INK) + box(68, 59, 10, 3, INK) + circ(61, 69, 2, INK)
      : `<path d="M44 62 a5 5 0 0 1 10 0z M68 62 a5 5 0 0 1 10 0z M54 66 a7 7 0 0 0 14 0z" fill="${INK}"/>`;
  return (
    `<g transform="rotate(${rot} 62 20)" fill="${leaf}"><path d="M62 20 A15 15 0 0 1 47 5 A15 15 0 0 1 62 20Z"/><path d="M62 20 A12 12 0 0 0 74 8 A12 12 0 0 0 62 20Z"/></g>` +
    `<g fill="${WHITE}"><circle cx="36" cy="54" r="20"/><circle cx="61" cy="43" r="24"/><circle cx="88" cy="56" r="19"/><rect x="16" y="54" width="91" height="29" rx="14.5"/></g>` +
    circ(38, 69, 6, RED) + circ(84, 69, 6, RED) + faceOf
  );
}

// Small friends beside Mumu, standing on (0, 0) in a 60-wide square like the things.
// Mumu herself is the companion on every card; bun, sprout and cloudlet are her alone.
const FRIEND = {
  cat: () => half(0, 0, 25, 'up', WHITE) + poly(WHITE, [-24, -8], [-22, -42], [-4, -23]) + poly(WHITE, [24, -8], [22, -42], [4, -23]) + circ(-8, -13, 3, INK) + circ(8, -13, 3, INK) + circ(-16, -6, 4, RED) + circ(16, -6, 4, RED) + `<path d="M-3 -9 a3 3 0 0 0 6 0z" fill="${INK}"/>`,
  dog: () => box(-28, -38, 12, 26, INK) + box(16, -38, 12, 26, INK) + box(-20, -22, 40, 22, WHITE) + half(0, -22, 20, 'up', WHITE) + circ(-8, -24, 3, INK) + circ(8, -24, 3, INK) + circ(-13, -9, 4.4, RED) + circ(13, -9, 4.4, RED) + circ(0, -14, 3.6, INK),
  bird: (p) => box(-9, -7, 5, 7, INK) + box(4, -7, 5, 7, INK) + circ(0, -27, 22, WHITE) + poly(p.acc === RED ? SUN : p.acc, [19, -36], [36, -28], [19, -20]) + circ(7, -32, 3.4, INK) + circ(3, -18, 5, RED),
  lamp: () => box(-2.5, -40, 5, 36, WHITE) + box(-13, -5, 26, 5, WHITE) + half(0, -34, 19, 'up', SUN),
};

// The picture is drawn in units of 160 x 240 and scaled to the card's left part.
const ART = { w: 160, h: 240, k: 5 / 3 };
const LINE = 160; // where the plane starts: things stand on it

// Weather marks in the top left cell, and the sun or moon in the top right one.
function sky(weather, p, uid) {
  let cell = p.cell === p.ground ? '' : box(80, 0, 80, 80, p.cell);
  let orb = '';
  let mark = '';
  switch (weather) {
    case 'night':
      orb = crescent(122, 40, 27, p.orb, p.ground);
      mark = circ(26, 52, 3.4, PINK) + box(46, 24, 6.5, 6.5, SUN) + circ(64, 60, 2.6, WHITE);
      break;
    case 'dusk':
      // the sun going down behind the edge of its square
      orb = half(120, 80, 30, 'up', p.orb);
      break;
    case 'sunny':
      orb = circ(120, 40, 31, p.orb);
      break;
    case 'mixed':
      orb = circ(124, 36, 26, p.orb);
      mark = `<g class="${uid}-cloud">${cloudShape(82, 66, 40, WHITE)}</g>`;
      break;
    case 'cloudy':
      orb = circ(120, 40, 26, p.orb);
      mark = `<g class="${uid}-cloud">${cloudShape(40, 62, 38, WHITE)}</g>`;
      break;
    case 'rain':
      orb = circ(120, 40, 26, p.orb);
      mark = `<g class="${uid}-rain">${[[16, 14], [36, 22], [56, 14], [16, 40], [36, 48], [56, 40]].map(([x, y]) => box(x, y, 6, 16, p.mark)).join('')}</g>`;
      break;
    case 'wind':
      orb = circ(120, 40, 26, p.orb);
      mark = `<g class="${uid}-wind">${box(14, 26, 52, 6, p.mark)}${box(14, 42, 36, 6, p.mark)}${box(14, 58, 44, 6, p.mark)}</g>`;
      break;
    case 'fog':
      orb = circ(120, 40, 26, p.orb);
      // long pale bands lying across the sky and the sun
      mark = `<g class="${uid}-fog">${box(0, 22, 66, 7, p.mark)}${box(24, 38, 112, 7, p.mark)}${box(0, 54, 92, 7, p.mark)}${box(52, 70, 108, 7, p.mark)}</g>`;
      break;
    default:
      orb = circ(120, 40, 26, p.orb);
  }
  return { cell, orb, mark };
}

// What stands at the right of the ground line when the person named nothing: one piece
// for the place the topic suggests.
function prop(setting, p) {
  const B = p.night ? PINK : p.cell;
  switch (setting) {
    case 'desk':
      return box(104, 126, 56, 34, B) + box(116, 110, 26, 16, WHITE);
    case 'bench':
      return box(96, 142, 64, 18, B) + box(104, 124, 48, 8, WHITE);
    case 'roof':
      return thing('house', p, 124, LINE, 54);
    default:
      return `<path d="M160 160 V104 A56 56 0 0 0 104 160Z" fill="${B}"/>`;
  }
}

// The animation, scoped to this card: the pieces come in on the grid in reading order, the
// sun grows, Mumu hops once, then the card is still. When the person felt lighter after the
// exercise, the weather marks leave. Nothing moves when reduced motion is asked for.
function motionCss(uid, scene) {
  const clear = scene.clearing || scene.weather === 'sunny' || scene.weather === 'mixed';
  const marks = ['wind', 'rain', 'fog', 'cloud'];
  const inn = (cls, kf, i, from) => `.${uid}-${cls}{animation:${uid}${kf} .16s steps(4,end) ${(0.06 * i).toFixed(2)}s both;transform-box:fill-box;transform-origin:${from}}`;
  return `<style>@media (prefers-reduced-motion: no-preference){
  ${clear ? marks.map((m) => `.${uid}-${m}{animation:${uid}away .9s steps(6,end) 1.2s both;transform-box:fill-box}`).join('') : marks.map((m) => inn(m, 'wx', 1, '0 50%')).join('')}
  ${inn('cell', 'wx', 2, '0 50%')}${inn('hill', 'wy', 3, '50% 100%')}${inn('things', 'wy', 4, '50% 100%')}${inn('plane', 'wx', 5, '0 50%')}
  .${uid}-orb{animation:${uid}orb .32s steps(6,end) .5s both;transform-box:fill-box;transform-origin:center}
  .${uid}-pal{animation:${uid}hop .52s cubic-bezier(.34,1.56,.64,1) .9s 1 both;transform-box:fill-box;transform-origin:50% 100%}
  @keyframes ${uid}wx{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  @keyframes ${uid}wy{from{transform:scaleY(0)}to{transform:scaleY(1)}}
  @keyframes ${uid}orb{from{transform:scale(0)}to{transform:scale(1)}}
  @keyframes ${uid}hop{0%{transform:translateY(0) scale(1,1)}45%{transform:translateY(-8px) scale(1,1)}80%{transform:translateY(0) scale(1.06,.94)}100%{transform:translateY(0) scale(1,1)}}
  @keyframes ${uid}away{from{transform:translateX(0);opacity:1}to{transform:translateX(-60px);opacity:0}}
}</style>`;
}

// The person's line: Murmur Black where the bundled subset has the glyph, then the
// system's heaviest sans. The small print: the app's display face, and Bricolage for the date.
const FONT_LINE = `'Murmur Black', 'PingFang TC', 'Noto Sans TC', 'Noto Sans CJK TC', 'Microsoft JhengHei', ui-sans-serif, system-ui, -apple-system, sans-serif`;
const FONT_LABEL = FONT_LINE;
const FONT_NUM = `'Bricolage', 'Murmur Black', ui-sans-serif, system-ui, -apple-system, sans-serif`;
const isCjk = (s) => /[　-鿿＀-￯]/.test(s);

// The white panel: x 267 to 600, 30 of padding. TEXT.w is what fitText (js/postcard.js)
// wraps to; keep the two in step.
const PANEL = { x: 267, pad: 30, w: 276 };

// the approach name: one line when it fits, shrunk a little, else two lines
function labelLines(lab) {
  const cjk = isCjk(lab);
  const wide = (s, size) => [...s].reduce((sum, ch) => sum + (/[　-鿿＀-￯]/.test(ch) ? 1.06 : /[A-Z]/.test(ch) ? 0.74 : /[\s.,:;'|!iljtf()]/.test(ch) ? 0.36 : 0.62), 0) * size;
  for (const size of [20, 18, 16]) if (wide(lab, size) <= PANEL.w) return { size, lines: [lab] };
  const size = 16;
  const lines = [''];
  for (const piece of cjk ? [...lab] : lab.split(/(?=\s)/)) {
    const cur = lines[lines.length - 1];
    if (cur && wide(cur + piece, size) > PANEL.w) lines.push(piece.trimStart());
    else lines[lines.length - 1] = cur + piece;
  }
  if (lines.length > 2) {
    lines.length = 2;
    let last = lines[1];
    while (last && wide(last + '…', size) > PANEL.w) last = [...last].slice(0, -1).join('');
    lines[1] = last.trimEnd() + '…';
  }
  return { size, lines };
}

// The words: the line large at the top of the white panel, the name and the date small at
// its foot. Nothing else.
function words(p, { line: text, label, date, brand, fitText }) {
  const out = [];
  const X = PANEL.x + PANEL.pad;
  const fit = fitText ? fitText(text) : { lines: [text], size: 20, lh: 28 };
  const top = PANEL.pad + Math.round(fit.size * 0.9);
  // one text element, so the line reads as one string
  out.push(`<text font-size="${fit.size}" font-weight="900" fill="${INK}" font-family="${FONT_LINE}">${fit.lines.map((l, i) => `<tspan x="${X}" y="${top + i * fit.lh}">${esc(l)}</tspan>`).join('')}</text>`);
  const lab = String(label || '').trim();
  if (lab) {
    const L = labelLines(lab);
    L.lines.forEach((l, i) => out.push(`<text x="${X}" y="${346 - (L.lines.length - 1 - i) * (L.size + 5)}" font-size="${L.size}" font-weight="700" fill="${MUTED}" font-family="${FONT_LABEL}" letter-spacing="${isCjk(lab) ? '.06em' : '.01em'}">${esc(l)}</text>`));
  }
  const foot = [date, brand].filter(Boolean).join(' · ');
  out.push(`<text x="${X}" y="374" font-size="19" font-weight="600" fill="${MUTED}" font-family="${FONT_NUM}" letter-spacing=".05em">${esc(foot)}</text>`);
  return out.join('');
}

// Put a card together: the picture (markup in 160 x 240 units, clipped to its part of the
// card and scaled), the white panel and the words. Square corners, no border.
// art: the picture; css: optional animation; img: false when the card sits beside its own
// text and should not be announced as a picture.
// The keepsake's paper: a few flat specks on the white panel, and a fine ink frame with
// notched corners and one glint at its foot, like a ticket kept in a book.
const PAPER_GRAIN = (() => {
  let v = 11;
  const r = () => ((v = (v * 1103515245 + 12345) % 2147483648) / 2147483648);
  let d = '';
  for (let i = 0; i < 90; i++) d += `M${Math.round(268 + r() * 330)} ${Math.round(r() * 398)}h${r() < 0.3 ? 2 : 1}v1h-1z`;
  return `<path fill="#ECE7DB" d="${d}"/>`;
})();
const CARD_FRAME =
  `<path fill="none" stroke="${INK}" stroke-width="1.5" d="M291 10H576A14 14 0 0 0 590 24V376A14 14 0 0 0 576 390H291A14 14 0 0 0 277 376V24A14 14 0 0 0 291 10Z"/>` +
  `<rect x="421" y="385" width="25" height="10" fill="${WHITE}"/><path fill="${INK}" transform="translate(433.5 390)" d="M0 -7Q0 0 7 0Q0 0 0 7Q0 0 -7 0Q0 0 0 -7z"/>`;

export function printCard(p, { uid, art = '', css = '', words: w = '', img = true }) {
  const W = 600;
  const H = 400;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"${img ? ' role="img"' : ''}>
  <defs><clipPath id="${uid}art"><rect width="${ART.w}" height="${ART.h}"/></clipPath></defs>
  ${css}
  <rect width="${W}" height="${H}" fill="${WHITE}"/>
  ${PAPER_GRAIN}
  <g transform="scale(${n4(ART.k)})" clip-path="url(#${uid}art)"><rect width="${ART.w}" height="${ART.h}" fill="${p.ground}"/>${art}</g>
  ${CARD_FRAME}
  ${w}
</svg>`;
}

// Draw the card. line: the main text; label: a small heading; date; animate: add motion.
export function sceneSvg(scene, { seed = 'm', line = '', label = '', date = '', brand = 'Murmur', animate = false, fitText = null } = {}) {
  const rand = rng(seed + JSON.stringify(scene.objects) + scene.weather);
  const uid = 'sc' + Math.floor(rand() * 1e9).toString(36);
  const p = pal(scene.weather);
  const s = sky(scene.weather, p, uid);
  const objs = scene.objects.filter((o) => OBJ[o]).slice(0, 3);
  const count = objs.length;
  // the hill, and the things along the ground line, spread by how many there are
  const hillAt = [[60, 60], [60, 60], [80, 46], [80, 54]][count];
  const slots = [[], [[124, 58]], [[32, 50], [128, 50]], [[26, 42], [80, 46], [134, 42]]][count];
  const hill = half(hillAt[0], LINE, hillAt[1], 'up', p.hill);
  let things = objs.map((o, i) => thing(o, p, slots[i][0], LINE, slots[i][1])).join('');
  if (!count) things = prop(scene.setting, p);
  // a candle on the hill for someone who is missed
  if (scene.setting === 'candle' && count < 3) things += box(hillAt[0] - 4, LINE - hillAt[1] - 17, 8, 18, WHITE) + circ(hillAt[0], LINE - hillAt[1] - 23, 5.5, p.acc === RED || p.ground === SUN ? RED : SUN);
  // Mumu sits on the plane; a pet the person named (or the lamp of a quiet night) sits beside her
  const friend = FRIEND[scene.companion];
  const mx = friend ? 6 : 36;
  const my = count === 3 ? 166 : 150;
  // her sprout shows against the hill, or against the plane when there is no hill behind it
  const behind = count === 3 ? p.plane : p.hill;
  const leaf = behind === SUN || behind === PINK || behind === WHITE ? JADE : SUN;
  const pal_ = `<g class="${uid}-pal"><g transform="translate(${mx} ${my}) scale(.72)">${mumu(p.night ? 'sleepy' : 'happy', leaf)}</g></g>`;
  const mate = friend ? `<g transform="translate(126 ${n(my + 60)}) scale(${scene.companion === 'lamp' ? 0.9 : 0.8})">${friend(p)}</g>` : '';
  const art =
    `<g class="${uid}-cell">${s.cell}</g><g class="${uid}-orb">${s.orb}</g>${s.mark}` +
    `<g class="${uid}-plane">${box(0, LINE, ART.w, ART.h - LINE, p.plane)}</g>` +
    `<g class="${uid}-hill">${hill}</g><g class="${uid}-things">${things}</g>${mate}${pal_}`;
  return printCard(p, {
    uid,
    art,
    css: animate ? motionCss(uid, scene) : '',
    words: words(p, { line, label, date, brand, fitText }),
  });
}

// For the postcard (js/postcard.js): the same pieces, with its own picture.
export const print = { INK, WHITE, MUTED, JADE, RED, SUN, PINK, NAVY, circ, box, half, poly, cloudShape, crescent, thing, mumu, FRIEND, PANEL, words, n, esc };

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
