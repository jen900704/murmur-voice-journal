import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkRisk, HELP_NUMBER } from '../js/safety.js';
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
  ['I don\u2019t want to live anymore', 'self'],
  ['我 想 死', 'self'],
  ['我想去死', 'self'],
  ['真的好想死一死算了', 'self'],
  ['活著好累', 'self'],
  ['活著有什麼意義', 'self'],
  ['沒有我大家會比較好', 'self'],
  ['想離開這個世界', 'self'],
  ['乾脆一了百了', 'self'],
  ['昨天吞了一堆安眠藥', 'self'],
  ['想從頂樓跳下去', 'self'],
  ['拿刀割自己', 'self'],
  ['如果我不在了會怎樣', 'self'],
  ['不想再醒過來', 'self'],
  ['I wish I were dead', 'self'],
  ['everyone would be better off without me', 'self'],
  ['there is no point in living', 'self'],
  ['life is not worth living', 'self'],
  ['I want to take my own life', 'self'],
  ["I don't want to be here anymore", 'self'],
  ['他喝醉會掐我', 'abuse'],
  ['昨天又被他揍', 'abuse'],
  ['他一直摸我', 'abuse'],
  ['he keeps hitting me', 'abuse'],
  ['he choked me', 'abuse'],
  ['she slapped me', 'abuse'],
  ['he forced me to stay', 'abuse'],
  ['我爸打我', 'abuse'],
  ['爸爸昨天又打我', 'abuse'],
  ['男友會打我', 'abuse'],
  ['他昨天打了我', 'abuse'],
  ['他對我動手', 'abuse'],
  ['我叔叔摸我', 'abuse'],
  ['他說要殺我', 'abuse'],
  ['he punched me', 'abuse'],
  ['he threatens me', 'abuse'],
  ['真的撐不下去了', 'self'],
  ['想解脫', 'self'],
  ['想結束這一切', 'self'],
  ['不如死掉', 'self'],
  ['乾脆去死', 'self'],
  ['好想跳下去', 'self'],
  ['想被車撞', 'self'],
  ['想一覺不醒', 'self'],
  ['我是大家的負擔', 'self'],
  ['我是多餘的', 'self'],
  ['沒有我他們會過得更好', 'self'],
  ['又割手了', 'self'],
  ['偷偷存安眠藥', 'self'],
  ['想欲死', 'self'],
  ['kms', 'self'],
  ['thinking about how to unalive myself', 'self'],
  ['I just want to end it', 'self'],
  ['I wish I wasn\'t born', 'self'],
  ['I want to hang myself', 'self'],
  ['took too many pills last night', 'self'],
  ['I am such a burden', 'self'],
  ['想打死他', 'others'],
  ['想要消失', 'self'], ['不想存在', 'self'], ['想自我了斷', 'self'], ['想尋短', 'self'],
  ['希望明天不要醒來', 'self'], ['想一睡不醒', 'self'], ['想結束一切', 'self'], ['沒有活下去的理由', 'self'],
  ['活著好痛苦', 'self'], ['活著沒意思', 'self'], ['我是累贅', 'self'], ['我只會拖累大家', 'self'],
  ['跳下去就好了', 'self'], ['想從陽台跳下去', 'self'], ['想去跳河', 'self'], ['想跳軌', 'self'],
  ['想把藥全吃了', 'self'], ['拿刀割', 'self'], ['想紫砂', 'self'], ['好想自鯊', 'self'],
  ['被我爸打', 'abuse'], ['他說要殺了我', 'abuse'], ['他威脅要殺我', 'abuse'], ['在學校被霸凌', 'abuse'],
  ['下班被跟蹤', 'abuse'], ['想帶孩子一起死', 'others'],
  ["I can't go on", 'self'], ["I can't do this anymore", 'self'], ["I don't want to exist", 'self'],
  ['I wish I could disappear', 'self'], ["I hope I don't wake up", 'self'], ['nothing to live for', 'self'],
  ['I should just die', 'self'], ['I want to slit my wrists', 'self'], ['jump off a bridge', 'self'],
  ['I took all my pills', 'self'], ['he threatened to kill me', 'abuse'], ['scared to go home', 'abuse'],
  ['I was assaulted', 'abuse'],
  ['想跟他同歸於盡', 'others'],
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
  '提案又被打槍了',
  '開會一直被打斷',
  '不好意思被打擾到你',
  '下午打我電話就好',
  '如果這份報告消失就好了',
  '老闆砍了他們的預算',
  "I don't want to hurt her feelings",
  'it hurts me that she did not call',
  'I need to cut myself some slack',
  '想死你了，快回來',
  '尷尬到想死',
  '報告寫到想死',
  '我想死心了，不再等他',
  '單字只能想死背',
  '我消失了一週去旅行',
  '今天想不開心也難',
  '去剪頭髮，順便割自己的頭髮好了',
  '早上被打針，手好痠',
  '考卷被打分數了',
  '百貨公司跳樓大拍賣',
  'that bug really beats me',
  'it hits me that we graduate soon',
  'my landlord is kicking me out',
  'the city slapped me with a fine',
  'my boss forced me to work overtime',
  '她強迫我吃青菜',
  '主管逼我加班',
  'this is an abuse of notation',
  '公司辦了性騷擾防治課程',
  'I overdosed on coffee today',
  '我 1988 年出生',
  '報告撐不下去了', '撐不下去的專案', '想消失一下', '這報告做到想死', '不小心割手指', '老闆威脅我要扣薪水',
  '看了一部家暴的電影', '性侵新聞看了很難過', '遊戲裡殺了他', '我被老闆摸頭',
  '尷尬到好想死', 'ran 5 kms today', 'I never wake up on time', 'I cut myself shaving', 'I hurt myself at the gym',
  "I want to end things with my boyfriend", 'I teach a drug abuse class', 'he hit me up last night',
  'my baby kicks me all night', 'the rapeseed field was yellow', 'we watched suicide squad',
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
  assert.ok(!rewriteText(true, '他們逼我加班', 'zh').startsWith('我選擇他們'));
  assert.equal(rewriteText(true, 'I have to answer every email', 'en'), 'I choose to answer every email');
  assert.ok(rewriteText('defuse', '我不夠好', 'zh').includes('我注意到我有一個想法'));
  assert.ok(!rewriteText(true, '我得了憂鬱症', 'zh').startsWith('我選擇'));
});

test('lenses unsuited to loss are excluded for that topic', () => {
  const ids = lensesForTopic('loss').map((l) => l.id);
  for (const bad of ['existential', 'solution-focused', 'rebt', 'narrative', 'adlerian', 'reality', 'gestalt']) assert.ok(!ids.includes(bad), bad);
  assert.ok(ids.includes('person-centered'));
  for (const t of TOPICS) assert.ok(lensesForTopic(t).length >= 5, t);
});


test('help numbers are matched as whole numbers only', () => {
  for (const t of ['請打 1925', 'call or text 988.', '113 保護專線', '(911)']) assert.ok(HELP_NUMBER.test(t), t);
  for (const t of ['我 1988 年出生', '民國 113 年', '113年的計畫', 'on 9/11', '21130', '1925/1/1']) assert.ok(!HELP_NUMBER.test(t), t);
});

test('no regex lookbehind in app code (Safari before 16.4 cannot parse it)', () => {
  for (const f of ['js/safety.js', 'js/ai-chat.js', 'js/lenses.js', 'js/app.js', 'js/extras.js', 'js/lens-view.js', 'js/night-view.js', 'js/bedtime.js']) {
    assert.ok(!/\(\?<[=!]/.test(readFileSync(new URL('../' + f, import.meta.url), 'utf8')), f);
  }
});

console.log(`\n${passed} passed`);
