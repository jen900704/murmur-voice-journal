// The question deck: wording rules, no repeats, area filtering, and follow-ups that quote exactly.
import assert from 'node:assert/strict';
import { DECK, AREAS, AREA_IDS, NEVER_ASK, BACK_GENERIC, allQuestions, pickQuestion, followUpFor, quotePiece } from '../js/questions.js';
import { DAILY } from '../js/prompts.js';
import { TOPICS } from '../js/lenses.js';
import { ICON_NAMES } from '../js/icons.js';
import { checkRisk } from '../js/safety.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log('ok   ', name);
};
// a fixed sequence of "random" numbers
const seq = (...xs) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};
const lcg = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const BANNED = /(你很棒|好棒|太棒了|真勇敢|我好想你|想你了|憂鬱症|焦慮症|障礙|診斷|great job|well done|proud of you|miss you|disorder|diagnos)/i;

test('the deck has 60 to 80 questions, seven or more in every area, both levels, unique ids', () => {
  assert.ok(DECK.length >= 60 && DECK.length <= 80, String(DECK.length));
  assert.equal(new Set(DECK.map((q) => q.id)).size, DECK.length);
  assert.equal(AREAS.length, 9);
  for (const a of AREAS) {
    const mine = DECK.filter((q) => q.area === a.id);
    assert.ok(mine.length >= 7, a.id);
    assert.ok(mine.some((q) => q.level === 'light') && mine.some((q) => q.level === 'deep'), a.id);
    assert.ok(ICON_NAMES.includes(a.icon), a.icon);
    assert.ok(a.zh && a.en);
    for (const t of a.topics) assert.ok(TOPICS.includes(t), t);
  }
  for (const q of DECK) assert.ok(AREA_IDS.includes(q.area) && ['light', 'deep'].includes(q.level), q.id);
});

test('every question is in both languages, ends as a question or an invitation, and keeps to the wording rules', () => {
  for (const q of DECK) {
    for (const text of [q.zh, q.en, q.back && q.back.zh, q.back && q.back.en].filter(Boolean)) {
      assert.ok(text.trim().length > 5, q.id);
      assert.ok(!/[—–]/.test(text), `${q.id}: dash`);
      assert.ok(!BANNED.test(text), `${q.id}: banned word`);
      assert.ok(!NEVER_ASK.test(text), `${q.id}: asks for too much`);
      assert.ok(!checkRisk(text).risk, `${q.id}: matches the risk screen`);
    }
    assert.ok(/[？。]$/.test(q.zh), q.id);
    assert.ok(/[?.]$/.test(q.en), q.id);
    assert.ok(/[㐀-鿿]/.test(q.zh) && !/[㐀-鿿]/.test(q.en), q.id);
    if (q.back) assert.ok(q.back.zh.includes('「{q}」') && q.back.en.includes('"{q}"'), q.id);
  }
  assert.ok(BACK_GENERIC.zh.includes('「{q}」') && BACK_GENERIC.en.includes('"{q}"'));
});

test('the full list keeps the daily prompts at their old numbers, then the deck', () => {
  for (const lang of ['zh-TW', 'en']) {
    const all = allQuestions(lang);
    assert.equal(all.length, DAILY[lang === 'en' ? 'en' : 'zh-TW'].length + DECK.length);
    assert.equal(all[0].text, DAILY[lang === 'en' ? 'en' : 'zh-TW'][0]);
    assert.equal(all[0].id, 'd0');
    all.forEach((q, i) => assert.equal(q.index, i));
  }
});

test('no question repeats within the last twelve asked', () => {
  const rand = lcg(7);
  const recent = [];
  for (let i = 0; i < 300; i++) {
    const q = pickQuestion({ recent, rand });
    assert.ok(!recent.slice(-12).includes(q.id), `repeat of ${q.id} at draw ${i}`);
    recent.push(q.id);
  }
});

test('with an area chosen, every draw comes from that area, without repeats until it runs out', () => {
  for (const a of AREA_IDS) {
    const rand = lcg(3);
    const recent = [];
    for (let i = 0; i < 7; i++) {
      const q = pickQuestion({ area: a, recent, rand });
      assert.equal(q.area, a);
      assert.ok(!recent.includes(q.id));
      recent.push(q.id);
    }
    // the area is used up: it starts again instead of leaving the area
    assert.equal(pickQuestion({ area: a, recent, rand, avoid: 100 }).area, a);
  }
});

test('areas the person has not touched lately are drawn more often', () => {
  const rand = lcg(11);
  const counts = Object.fromEntries(AREA_IDS.map((a) => [a, a === 'money' ? 0 : 9]));
  let money = 0;
  for (let i = 0; i < 900; i++) if (pickQuestion({ counts, rand, avoid: 0 }).area === 'money') money++;
  assert.ok(money > 300, String(money)); // 1/9 of the draws would be 100
});

test('a follow-up quotes an exact piece of the earlier answer and nothing else of theirs', () => {
  const answers = [{ qid: 'm1', text: '一台二手的腳踏車' }];
  const q = pickQuestion({ lang: 'zh-TW', answers, rand: seq(0.01, 0), backChance: 0.2 });
  assert.equal(q.id, 'm1~back');
  assert.equal(q.text, '上次你說想買「一台二手的腳踏車」，後來呢？');
  assert.ok(answers[0].text.includes(q.quote));
  const en = followUpFor({ qid: 'm1', text: 'a second-hand bike, maybe a blue one. Not sure yet' }, 'en');
  assert.equal(en.quote, 'a second-hand bike');
  assert.equal(en.text, 'Last time you said you wanted to buy "a second-hand bike". What happened since?');
  // a question without its own follow-up uses the general one
  assert.equal(followUpFor({ qid: 'b4', text: '剛煮好的飯' }, 'zh-TW').text, '你之前寫過「剛煮好的飯」。現在怎麼看？');
  // nothing short enough to quote exactly: no follow-up, and the deck is used
  assert.equal(followUpFor({ qid: 'm1', text: '我想了很久其實也不確定到底想買什麼東西因為最近開銷有點多所以一直在猶豫' }, 'zh-TW'), null);
  assert.equal(quotePiece(''), '');
  const again = pickQuestion({ answers, rand: seq(0.01, 0), recent: ['m1~back'] });
  assert.ok(!String(again.id).endsWith('~back'));
  // most draws are plain deck questions
  assert.ok(!String(pickQuestion({ answers, rand: seq(0.9, 0.5) }).id).endsWith('~back'));
});

console.log(`\n${passed} passed`);
