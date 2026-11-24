import assert from 'node:assert/strict';
import { checkRisk } from '../js/safety.js';
import { LENSES, fill, rewriteText, lensesForTopic, TOPICS } from '../js/lenses.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('ok   ', name);
  } catch (e) {
    console.log('FAIL ', name, '\n     ', e.message);
    process.exitCode = 1;
  }
}

const shouldFlag = [
  ['我最近一直想死', 'self'],
  ['覺得不想活了', 'self'],
  ['活著沒有意義', 'self'],
  ['有時候會想傷害自己', 'self'],
  ['我想不開', 'self'],
  ['我好想消失', 'self'],
  ['考慮自殺', 'self'],
  ['我想自杀', 'self'],
  ['I want to die', 'self'],
  ['I keep thinking about killing myself', 'self'],
  ["I don't want to live anymore", 'self'],
  ['maybe everyone is better off dead without me', 'self'],
  ['I have been cutting myself', 'self'],
  ['thinking of ending it all', 'self'],
  ['我真的想殺了他', 'others'],
  ['I could kill him', 'others'],
  ['他喝醉會打我', 'abuse'],
  ['家裡有家暴', 'abuse'],
  ['my partner hits me', 'abuse'],
  ['I was sexually assaulted', 'abuse'],
];

const shouldNotFlag = [
  '今天累死了',
  '笑死，那個梗太好笑',
  '熱死了不想出門',
  '煩死了報告寫不完',
  '想你想死你了',
  'this deadline is killing me',
  'I was just killing time',
  'my feet are killing me',
  'I died laughing',
  '我很擔心期末考',
  'I feel stuck at work and my boss ignores me',
  '和媽媽吵架了，覺得她不懂我',
];

for (const [text, kind] of shouldFlag) {
  test(`flags: ${text}`, () => {
    const r = checkRisk(text);
    assert.ok(r.risk && r.kinds.includes(kind), JSON.stringify(r));
  });
}
for (const text of shouldNotFlag) {
  test(`does not flag: ${text}`, () => assert.equal(checkRisk(text).risk, false));
}

test('every lens has both languages, matching step counts, and a chapter', () => {
  for (const l of LENSES) {
    assert.ok(l.zh && l.en && l.chapter >= 4 && l.chapter <= 14, l.id);
    assert.equal(l.zh.steps.length, l.en.steps.length, l.id);
    for (const lang of ['zh', 'en']) {
      for (const k of ['name', 'idea', 'noticed', 'experiment', 'misses']) assert.ok(l[lang][k], `${l.id}.${lang}.${k}`);
      assert.ok(l[lang].steps.length >= 3 && l[lang].steps.length <= 4, l.id);
    }
  }
});

test('placeholders only refer to answers that exist', () => {
  for (const l of LENSES) {
    for (const lang of ['zh', 'en']) {
      const n = l[lang].steps.length;
      const texts = [l[lang].noticed, l[lang].experiment, ...l[lang].steps.map((s) => s.q)];
      for (const t of texts) {
        for (const m of t.matchAll(/\{(\d)\}/g)) assert.ok(Number(m[1]) <= n, `${l.id}.${lang}: ${m[0]}`);
      }
      // a step may only quote earlier answers
      l[lang].steps.forEach((s, i) => {
        for (const m of s.q.matchAll(/\{(\d)\}/g)) assert.ok(Number(m[1]) <= i, `${l.id}.${lang} step ${i + 1}`);
      });
    }
  }
});

test('fill quotes and shortens answers', () => {
  assert.equal(fill('你說「{1}」', ['很累']), '你說「很累」');
  assert.ok(fill('{1}', ['x'.repeat(200)]).length <= 60);
});

test('rewrite turns "I have to" into "I choose"', () => {
  assert.equal(rewriteText(true, '我必須每天加班', 'zh'), '我選擇每天加班');
  assert.equal(rewriteText(true, 'I have to answer every email', 'en'), 'I choose to answer every email');
  assert.ok(rewriteText('defuse', '我不夠好', 'zh').includes('我注意到我有一個想法'));
});

test('lenses unsuited to loss are excluded for that topic', () => {
  const ids = lensesForTopic('loss').map((l) => l.id);
  for (const bad of ['existential', 'solution-focused', 'rebt', 'narrative', 'adlerian', 'reality']) assert.ok(!ids.includes(bad), bad);
  assert.ok(ids.includes('person-centered'));
  for (const t of TOPICS) assert.ok(lensesForTopic(t).length >= 5, t);
});

console.log(`\n${passed} passed`);
