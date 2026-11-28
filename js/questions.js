// The question deck for Today's composer: small, warm questions and a few that go a little
// deeper, each tagged with one of the nine areas (九宮格) and a level. The app asks because it
// is curious about the person's days; it never asks for identifying details (addresses, ID
// numbers, phone numbers, names of workplaces or schools) and never pushes toward trauma or
// health. Every question can be skipped with the shuffle.
// The 40 daily prompts (js/prompts.js) come first in the full list, so old #ask=N links keep
// their numbers; the deck follows.
import { DAILY } from './prompts.js';

// The nine areas, in grid order, with the icon (js/icons.js), the lens topics each one feeds
// (js/lenses.js TOPICS) and its name. No area is named with a diagnosis word.
export const AREAS = [
  { id: 'work', icon: 'work', topics: ['work'], zh: '工作課業', en: 'Work, study' },
  { id: 'people', icon: 'people', topics: ['relationship'], zh: '人際', en: 'People' },
  { id: 'family', icon: 'family', topics: ['family'], zh: '家人', en: 'Family' },
  { id: 'love', icon: 'relationship', topics: ['relationship'], zh: '感情', en: 'Love' },
  { id: 'body', icon: 'body', topics: ['self'], zh: '身體睡眠', en: 'Body, sleep' },
  { id: 'money', icon: 'money', topics: ['other'], zh: '錢', en: 'Money' },
  { id: 'self', icon: 'self', topics: ['self'], zh: '自己', en: 'Myself' },
  { id: 'small', icon: 'sun', topics: ['other'], zh: '今天的小事', en: 'Small things' },
  { id: 'unsure', icon: 'other', topics: ['other'], zh: '說不上來', en: 'Not sure' },
];
export const AREA_IDS = AREAS.map((a) => a.id);
export const areaById = (id) => AREAS.find((a) => a.id === id) || null;

// [id, area, level, zh, en, zh follow-up, en follow-up]. A follow-up refers back to an earlier
// answer and quotes it exactly at {q}; it is only ever filled with the person's own words.
const ROWS = [
  ['w1', 'work', 'light', '最近工作或課業裡，哪件小事做起來還算順手？', 'What small thing at work or school has gone fairly smoothly lately?'],
  ['w2', 'work', 'light', '這星期最想快點做完的是哪一件事？', 'What is the one thing you most want to get done this week?', '上次你說最想做完的是「{q}」，後來呢？', 'Last time you said you most wanted to finish "{q}". What happened since?'],
  ['w3', 'work', 'light', '最近學到的一個小技巧或小知識是什麼？', 'What is one small trick or fact you learned recently?'],
  ['w4', 'work', 'light', '如果明天可以少做一件事，你會拿掉哪一件？', 'If you could drop one task tomorrow, which would it be?'],
  ['w5', 'work', 'deep', '最近讓你覺得有意義的一件事是什麼？', 'What is one thing that felt meaningful to you lately?', '上次你說有意義的是「{q}」。現在想起來，是哪裡讓你這樣覺得？', 'Last time you said "{q}" felt meaningful. Looking back, what made it so?'],
  ['w6', 'work', 'deep', '現在手上的事情裡，哪一件最卡？卡在哪裡？', 'Of the things on your plate, which one is most stuck, and where?'],
  ['w7', 'work', 'deep', '一年後回頭看，你希望現在的自己把力氣放在哪裡？', 'Looking back a year from now, where would you want your effort to have gone?'],
  ['p1', 'people', 'light', '最近和誰聊得最開心？聊了什麼？', 'Who did you most enjoy talking with lately, and about what?'],
  ['p2', 'people', 'light', '最近誰做了一件讓你覺得貼心的小事？', 'Who did something small and thoughtful for you recently?'],
  ['p3', 'people', 'light', '有沒有一個想約但還沒約的人？', 'Is there someone you have been meaning to meet up with?', '上次你說想約「{q}」，後來約了嗎？', 'Last time you mentioned wanting to meet "{q}". Did it happen?'],
  ['p4', 'people', 'light', '最近笑出來的一刻，是和誰在一起？', 'The last time you laughed out loud, who were you with?'],
  ['p5', 'people', 'deep', '最近有沒有一句話，你想說卻沒說出口？', 'Is there something you wanted to say to someone lately and did not?'],
  ['p6', 'people', 'deep', '和人相處時，你最在意對方的哪一點？', 'When you spend time with people, what matters most to you in them?'],
  ['p7', 'people', 'deep', '最近哪一段相處讓你有點累？累在哪裡？', 'Which time with others left you a little tired lately, and why?'],
  ['f1', 'family', 'light', '家裡最近吃的哪一道菜，你覺得最好吃？', 'What is the best dish you have had at home lately?'],
  ['f2', 'family', 'light', '小時候最喜歡家裡的哪一個角落？', 'Which corner of your childhood home did you like best?'],
  ['f3', 'family', 'light', '家人最近說過哪一句話，讓你印象很深？', 'What is something a family member said recently that stayed with you?'],
  ['f4', 'family', 'light', '家裡有什麼只有你們自己懂的小習慣？', 'What small habit does your family have that only you all understand?'],
  ['f5', 'family', 'deep', '你和家人之間，最近有什麼變得不太一樣？', 'What has changed lately between you and your family?'],
  ['f6', 'family', 'deep', '有什麼事，你希望家人更了解你一點？', 'What do you wish your family understood a little better about you?'],
  ['f7', 'family', 'deep', '你從家人身上學到、現在還在用的一件事是什麼？', 'What is one thing you learned from family that you still use?'],
  ['l1', 'love', 'light', '最近一次覺得被放在心上，是什麼時候？', 'When did you last feel that someone had you in mind?'],
  ['l2', 'love', 'light', '你覺得最舒服的相處方式是什麼樣子？', 'What does an easy, comfortable time with someone look like for you?'],
  ['l3', 'love', 'light', '最近想和喜歡的人一起做的一件小事是什麼？', 'What small thing would you like to do with someone you like?', '上次你說想一起「{q}」，後來呢？', 'Last time you said you would like to "{q}" together. What happened since?'],
  ['l4', 'love', 'light', '最喜歡收到哪一種訊息？', 'What kind of message do you most like to receive?'],
  ['l5', 'love', 'deep', '在感情裡，你最需要的是什麼？', 'What do you need most in a close relationship?'],
  ['l6', 'love', 'deep', '最近在感情上，有什麼一直放在心裡的事？', 'Is there something about love that has stayed on your mind lately?'],
  ['l7', 'love', 'deep', '你希望對方怎麼知道你在乎？', 'How would you like the other person to know that you care?'],
  ['b1', 'body', 'light', '今天吃到最好吃的東西是什麼？', 'What is the best thing you ate today?'],
  ['b2', 'body', 'light', '最近哪一覺睡得最舒服？', 'Which night of sleep felt best lately?'],
  ['b3', 'body', 'light', '身體現在最想做的一件事是什麼？', 'What is one thing your body would most like to do right now?'],
  ['b4', 'body', 'light', '最喜歡的味道或氣味是什麼？', 'What is your favourite taste or smell?'],
  ['b5', 'body', 'light', '最近一次覺得身體很放鬆，是在做什麼？', 'What were you doing the last time your body felt at ease?'],
  ['b6', 'body', 'deep', '最近身體有沒有在提醒你什麼？', 'Has your body been trying to tell you something lately?'],
  ['b7', 'body', 'deep', '睡前腦袋裡最常轉的是什麼？', 'What does your mind most often turn over before sleep?'],
  ['m1', 'money', 'light', '最近想買的東西是什麼？', 'What is something you have been wanting to buy?', '上次你說想買「{q}」，後來呢？', 'Last time you said you wanted to buy "{q}". What happened since?'],
  ['m2', 'money', 'light', '最近花得最值得的一筆錢是什麼？', 'What is the best money you spent recently?'],
  ['m3', 'money', 'light', '如果多出一小筆錢，你想怎麼用？', 'If you had a little extra money, how would you use it?'],
  ['m4', 'money', 'light', '哪一樣便宜的小東西，讓你用得很開心？', 'Which cheap little thing do you really enjoy using?'],
  ['m5', 'money', 'deep', '關於錢，最近最常想到的是哪一件事？', 'When it comes to money, what has been on your mind most lately?'],
  ['m6', 'money', 'deep', '你覺得「夠用」對你來說是什麼樣子？', 'What does "enough" look like for you?'],
  ['m7', 'money', 'deep', '有什麼東西，你寧願多花一點也不想省？', 'What would you rather spend a bit more on than save?'],
  ['s1', 'self', 'light', '最喜歡的季節是哪一個？為什麼？', 'Which season do you like best, and why?'],
  ['s2', 'self', 'light', '最近一直重複聽的歌或看的東西是什麼？', 'What song or show have you kept coming back to lately?', '上次你說一直在聽或看「{q}」，現在還是嗎？', 'Last time you said you kept coming back to "{q}". Is that still true?'],
  ['s3', 'self', 'light', '一個人的時候，你最喜歡做什麼？', 'What do you most like to do when you are on your own?'],
  ['s4', 'self', 'light', '小時候最喜歡去的地方是哪裡？', 'Where did you most like to go as a child?'],
  ['s5', 'self', 'deep', '最近讓你有點驕傲的一件小事是什麼？', 'What is one small thing you felt a little proud of lately?'],
  ['s6', 'self', 'deep', '你想對一個月前的自己說什麼？', 'What would you say to yourself of a month ago?'],
  ['s7', 'self', 'deep', '最近你對自己有什麼新的發現？', 'What have you noticed about yourself lately that is new?'],
  ['t1', 'small', 'light', '今天看到什麼，讓你多看了一眼？', 'What did you see today that made you look twice?'],
  ['t2', 'small', 'light', '今天最安靜的一刻是什麼時候？', 'When was the quietest moment of today?'],
  ['t3', 'small', 'light', '今天有什麼小事，比你想的順利？', 'What small thing went better than you expected today?'],
  ['t4', 'small', 'light', '現在窗外或身邊，是什麼樣子？', 'What is it like outside your window, or around you, right now?'],
  ['t5', 'small', 'light', '今天最想記下來的一個畫面是什麼？', 'What is one picture from today you would like to keep?'],
  ['t6', 'small', 'light', '最近笑出來的一刻是什麼？', 'What made you laugh lately?'],
  ['t7', 'small', 'deep', '今天有哪一刻，你希望可以再久一點？', 'Which moment of today do you wish had lasted a little longer?'],
  ['u1', 'unsure', 'light', '現在腦袋裡第一個冒出來的是什麼？', 'What is the first thing that comes to mind right now?'],
  ['u2', 'unsure', 'light', '如果用天氣形容現在，是什麼天氣？', 'If right now were weather, what weather would it be?'],
  ['u3', 'unsure', 'light', '現在最想要的是什麼？一件小事也可以。', 'What do you want most right now? A small thing is fine.'],
  ['u4', 'unsure', 'light', '今天的你，最像哪一種顏色？', 'Which colour is most like you today?'],
  ['u5', 'unsure', 'deep', '有什麼事放在心裡，還說不清楚？寫幾個字就好。', 'Is something on your mind that you cannot put clearly yet? A few words will do.'],
  ['u6', 'unsure', 'deep', '最近最常想到的一件事是什麼？', 'What have you been thinking about most lately?'],
  ['u7', 'unsure', 'deep', '如果現在可以放下一件事，你想放下什麼？', 'If you could put one thing down right now, what would it be?'],
];

export const DECK = ROWS.map(([id, area, level, zh, en, backZh, backEn]) => ({ id, area, level, zh, en, back: backZh ? { zh: backZh, en: backEn } : null }));

// when a question has no follow-up of its own
export const BACK_GENERIC = { zh: '你之前寫過「{q}」。現在怎麼看？', en: 'You once wrote "{q}". How does it look now?' };
// a question the app must never ask: identifying details, and wording that pushes too far
export const NEVER_ASK = /(地址|住址|身分證|電話|手機號|公司名|校名|密碼|帳號|創傷|自殺|診斷|病史|address|phone number|\bID number|password|employer|trauma|diagnos|medical history)/i;

const lk = (lang) => (lang === 'en' ? 'en' : 'zh');

// Every question with its number: the daily prompts (d0..d39), then the deck. The number is
// what #ask=N carries.
export function allQuestions(lang) {
  const daily = (DAILY[lang] || DAILY.en).map((text, i) => ({ id: `d${i}`, area: null, level: 'light', text }));
  return [...daily, ...DECK.map((q) => ({ id: q.id, area: q.area, level: q.level, text: q[lk(lang)] }))].map((q, index) => ({ ...q, index }));
}
export const questionById = (id, lang) => allQuestions(lang).find((q) => q.id === id) || null;

// The piece of an earlier answer that a follow-up quotes: the whole answer when it is short,
// otherwise its first clause. Always an exact piece of what the person wrote.
export function quotePiece(answer, max = 24) {
  const text = String(answer || '').trim();
  if (!text) return '';
  if (text.length <= max) return text.replace(/[。.!！?？，,、；;\s]+$/, '');
  const first = text.split(/[。.!！?？，,、；;\n]/)[0].trim();
  return first && first.length <= max ? first : '';
}

// A follow-up built from one earlier answer ({ qid, text }), or null when nothing can be quoted.
export function followUpFor(answer, lang) {
  const base = DECK.find((q) => q.id === answer.qid);
  const piece = quotePiece(answer.text);
  if (!piece || /[「」"]/.test(piece)) return null;
  const tpl = (base && base.back ? base.back : BACK_GENERIC)[lk(lang)];
  return { id: `${base ? base.id : 'x'}~back`, area: base ? base.area : null, level: 'light', text: tpl.replace('{q}', piece), quote: piece, backOf: answer.qid || null };
}

// Picks the next question.
//   area     a nine-grid area to draw from, or null for any
//   recent   ids asked lately, newest last; none of the last `avoid` is asked again while others remain
//   counts   how often each area came up lately; areas touched less are drawn more often
//   answers  earlier answers ({ qid, text }), already screened by the caller (no risk matches)
//   rand     a 0..1 source, so tests can fix it
export function pickQuestion({ lang = 'zh-TW', area = null, recent = [], counts = {}, answers = [], rand = Math.random, avoid = 12, backChance = 0.2 } = {}) {
  const all = allQuestions(lang).filter((q) => q.area);
  const lately = new Set(recent.slice(-avoid));
  if (answers.length && rand() < backChance) {
    const usable = answers.filter((a) => !lately.has(`${a.qid}~back`) && (!area || (DECK.find((q) => q.id === a.qid) || {}).area === area));
    const back = usable.length ? followUpFor(usable[Math.floor(rand() * usable.length)], lang) : null;
    if (back) return back;
  }
  let pool = all.filter((q) => (!area || q.area === area) && !lately.has(q.id));
  if (!pool.length) pool = all.filter((q) => !area || q.area === area);
  const weights = pool.map((q) => 1 / (1 + (counts[q.area] || 0)));
  let x = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    x -= weights[i];
    if (x <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
