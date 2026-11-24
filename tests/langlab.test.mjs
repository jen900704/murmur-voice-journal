// Unit tests for the language mirror engine (js/langlab). Run: node tests/langlab.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tokenize, splitSentences, detectLanguage, maskSpans, looksSimplified, toTraditional, variantSpelling, makeDict } from '../js/langlab/tokenize.js';
import { analyze, allScores, findScore, bootstrapRatios, mulberry32, wilson, zhDict, timeSeries, compare, highlightSpans, categoryWords, CATEGORY_IDS, GROUPS, INDICES, MIN_WORDS } from '../js/langlab/score.js';
import { createVader } from '../js/langlab/vader.js';
import { fixMojibake, parseFile, parseCSV, parseTime, dedupe, wantedInArchive } from '../js/langlab/importers.js';
import { readZip } from '../js/langlab/zip.js';
import { buildReportData, buildReportHtml } from '../js/langlab/report.js';
import { scoreMeta, groupLabel, groupNote, NOTICE, SIMPLIFIED_NOTE, chooseObservations, observationText, validationNote, OBS_AGGREGATES, OBS_TEMPLATES, VALIDATION } from '../js/langlab/meta.js';
import { EN_CATEGORIES, EN_WILDCARD_EXCEPTIONS } from '../js/langlab/lexicon-en.js';
import { ZH_CATEGORIES, ZH_COMMON, ZH_LOOSE_HEADS } from '../js/langlab/lexicon-zh.js';
import { ZH_S2T_SAFE, ZH_S2T_VARIANT } from '../js/langlab/zh-s2t.js';
import { checkRisk } from '../js/safety.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (p) => path.join(here, 'fixtures', 'exports', p);
const read = (p) => readFileSync(fx(p), 'utf8');
const vaderData = JSON.parse(readFileSync(path.join(here, '..', 'data', 'lexica', 'vader.json'), 'utf8'));
const data = { vader: vaderData };

let passed = 0;
const pending = [];
function test(name, fn) {
  const done = () => {
    passed++;
    console.log('ok   ', name);
  };
  const fail = (e) => {
    console.log('FAIL ', name, '\n     ', e.message);
    process.exitCode = 1;
  };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') pending.push(r.then(done, fail));
    else done();
  } catch (e) {
    fail(e);
  }
}
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);
const words = (text) => tokenize(text, zhDict()).map((t) => t.t);
const score = (res, id) => findScore(res, id);

// ---------- tokenizer ----------
test('English tokens: lowercase, contractions whole, curly apostrophe, numbers', () => {
  assert.deepEqual(words("I don\u2019t KNOW, it's 3.5 km!"), ['i', "don't", 'know', "it's", '3.5', 'km']);
});
test('tokens keep their position in the original text', () => {
  const text = 'Well, I am here.';
  for (const t of tokenize(text)) assert.equal(text.slice(t.start, t.end).toLowerCase(), t.t);
});
test('links, e-mail, mentions and hashtags are not tokens', () => {
  assert.deepEqual(words('see https://example.com/a?b=1 and www.x.org @some.one #happy a@b.co ok'), ['see', 'and', 'ok']);
  assert.deepEqual(
    maskSpans('hi @bob #tag https://t.co/x').map((m) => m.type),
    ['mention', 'hashtag', 'url']
  );
});
test('Chinese: longest match over the word lists, single characters otherwise', () => {
  assert.deepEqual(words('我們今天不開心'), ['我們', '今天', '不開心']);
  assert.deepEqual(words('天氣不錯，我沒有不高興'), ['天氣', '不錯', '我', '沒有', '不高興']);
  assert.deepEqual(words('貓咪'), ['貓', '咪']);
});
test('Chinese: words that only look like negation or a pronoun are kept whole', () => {
  for (const w of ['不錯', '不過', '差不多', '不好意思', '沒關係', '對不起', '了不起', '不但', '不僅', '不管', '不如', '其他', '手機', '人生']) {
    assert.deepEqual(words(w), [w], w);
  }
  const res = analyze([{ text: '不錯，不過差不多，不好意思，沒關係，對不起，了不起，不但不僅不管不如。' }], {}).byLang.zh;
  assert.equal(score(res, 'negate').count, 0);
});
test('mixed text: Latin words and Chinese words in one string', () => {
  assert.deepEqual(words('我今天 happy 到不行'), ['我', '今天', 'happy', '到', '不行']);
});
test('sentences: both punctuation systems, decimals are not sentence ends', () => {
  const s = 'I ran 3.5 km. It was fine! 今天很好。明天呢？\nlast line';
  assert.deepEqual(
    splitSentences(s).map((x) => s.slice(x.start, x.end)),
    ['I ran 3.5 km.', 'It was fine!', '今天很好。', '明天呢？', 'last line']
  );
});
test('language detection per item', () => {
  assert.equal(detectLanguage('I went home early today'), 'en');
  assert.equal(detectLanguage('我今天很早回家'), 'zh');
  assert.equal(detectLanguage('今日は早く帰りました'), 'other');
  assert.equal(detectLanguage('https://example.com #tag'), 'other');
  assert.equal(detectLanguage('我今天去 Costco 買東西'), 'zh');
  assert.equal(looksSimplified('我们这个时候还没说过什么话，没关系的'), true);
  assert.equal(looksSimplified('我們這個時候還沒說過什麼話，沒關係的'), false);
});

// ---------- lexicon shape ----------
test('both languages define the same categories, and every category has a label, a definition and a limits line', () => {
  assert.deepEqual(Object.keys(EN_CATEGORIES), Object.keys(ZH_CATEGORIES));
  for (const id of [...CATEGORY_IDS, ...Object.keys(INDICES), 'vader']) {
    for (const lang of ['en', 'zh-TW']) {
      const m = scoreMeta(id, lang);
      assert.ok(m.label && m.label !== id, `${id} label ${lang}`);
      assert.ok(m.definition.length > 5 && m.limits.length > 10, `${id} text ${lang}`);
      assert.ok(!/\u2014/.test(m.label + m.definition + m.limits), `${id} has an em dash`);
    }
  }
  for (const g of GROUPS) for (const lang of ['en', 'zh-TW']) assert.ok(groupLabel(g.id, lang) !== g.id && groupNote(g.id, lang));
});
test('every category that the request named exists', () => {
  for (const id of ['i', 'we', 'you', 'negate', 'certain', 'tentat', 'cogproc', 'cause', 'insight', 'social', 'family', 'friend', 'work', 'body', 'posemo', 'negemo', 'anx', 'anger', 'sad', 'focuspast', 'focuspresent', 'focusfuture', 'affil', 'conflict', 'lonely', 'belong', 'grat', 'apology', 'compare', 'request', 'polite', 'loss', 'achieve', 'reward', 'risk', 'care', 'fair', 'loyal', 'authority', 'sanct', 'excl', 'other']) {
    assert.ok(EN_CATEGORIES[id].words.length >= 3 && ZH_CATEGORIES[id].words.length >= 2, id);
  }
});
test('no clinical or forbidden labels in the interface text', () => {
  const all = [...CATEGORY_IDS, ...Object.keys(INDICES), 'vader'].flatMap((id) => ['en', 'zh-TW'].map((l) => scoreMeta(id, l)));
  for (const m of all) {
    assert.ok(!/depress|disorder|diagnos|personality score|憂鬱症|診斷|人格分數/i.test(m.label), m.label);
    assert.ok(!/\b(lie|lying|liar|decepti|honesty)\b|說謊|欺騙|誠實/i.test(m.label + m.definition + m.limits + m.cite), m.label);
    assert.ok(!/liberal|conservative|left-wing|right-wing|藍營|綠營|保守派|自由派/i.test(m.label + m.definition + m.limits), m.label);
  }
  assert.ok(NOTICE.en.includes('not a professional assessment or diagnosis') && NOTICE.zh.includes('不是專業評估或診斷'));
});
test('Chinese single-character entries with risky look-alikes are not in the lists', () => {
  const all = new Set(Object.values(ZH_CATEGORIES).flatMap((c) => c.words));
  for (const ch of ['想', '了', '過', '會', '要', '在', '死', '人', '氣', '手', '頭', '本人']) assert.ok(!all.has(ch), ch);
  assert.ok(ZH_COMMON.includes('不錯') && ZH_COMMON.includes('沒關係'));
});

// ---------- fixes after the lab/langval study (2026.11-3) ----------
const hitsOf = (text, lang) => {
  const res = analyze([{ text, lang }], {}).byLang[lang];
  return res.hits[0].filter((h) => !h.ids[0].startsWith('fc:')).map((h) => ({ w: h.w, ids: h.ids }));
};
const countOf = (text, lang, id) => score(analyze([{ text, lang }], {}).byLang[lang], id).count;

test('English wildcards: hug*, yell*, heal* no longer match huge, yellow, health', () => {
  assert.deepEqual(hitsOf('A huge yellow sign about health and healthcare for healthy dogs.', 'en'), []);
  for (const [text, id, n] of [
    ['We hug, she hugs, they hugged, hugging helps.', 'affil', 4],
    ['We hug, she hugs, they hugged, hugging helps.', 'posemo', 4],
    ['They yell, he yells, she yelled, yelling again.', 'anger', 4],
    ['Wounds heal, time heals, I healed, healing is slow.', 'care', 4],
    ['Hugely huge.', 'social', 0],
  ]) assert.equal(countOf(text, 'en', id), n, `${id}: ${text}`);
});
test('English wildcards: an excepted word is still counted through another entry', () => {
  // hostile is kept out of host* (social) and still matched by hostil* (anger, conflict)
  const h = hitsOf('The host was hostile to every guest.', 'en');
  assert.deepEqual(h.find((x) => x.w === 'hostile').ids.sort(), ['anger', 'conflict', 'negemo']);
  assert.ok(h.find((x) => x.w === 'host').ids.includes('social'));
  // completely is an exact entry of `certain` and no longer an `achieve` hit through complete*
  assert.deepEqual(h.length && hitsOf('completely', 'en')[0].ids.sort(), ['certain', 'cogproc']);
});
test('English wildcards: the audited misfires are out, the real forms stay in', () => {
  const out = ['sight', 'sighting', 'earnest', 'officer', 'officers', 'neighborhood', 'opposite', 'original', 'originally', 'socialism', 'socialist',
    'fearless', 'harmless', 'harmony', 'blameless', 'successor', 'treasurer', 'sweater', 'unclear', 'grandmaster', 'scarecrow', 'shoutout',
    'respective', 'confidential', 'accustomed', 'cheeky', 'adultery', 'compartment', 'complexion', 'joystick', 'trustee', 'wager', 'motherfucker',
    'progressive', 'projecting', 'punchline', 'reactor', 'relies', 'apologist', 'brainwashed', 'optimise', 'twinkle', 'kneel', 'lunge'];
  for (const wd of out) assert.deepEqual(hitsOf(wd, 'en'), [], wd);
  const kept = { sighed: 'sad', earned: 'achieve', offices: 'work', neighbors: 'friend', opposed: 'conflict', origin: 'cause', socially: 'social',
    fearful: 'anx', harmful: 'negemo', successful: 'posemo', treasures: 'posemo', sweating: 'body', uncles: 'family', grandmas: 'family',
    scared: 'anx', shouting: 'anger', respected: 'authority', confident: 'posemo', accused: 'conflict', cheeks: 'body', adults: 'social',
    comparing: 'compare', joyful: 'posemo', trusted: 'affil', wages: 'work', mothers: 'family', progress: 'achieve', projects: 'work',
    relieved: 'posemo', apologize: 'apology', brains: 'body', optimistic: 'posemo', twins: 'family', knees: 'body', lungs: 'body' };
  for (const [wd, id] of Object.entries(kept)) assert.ok((hitsOf(wd, 'en')[0] || { ids: [] }).ids.includes(id), `${wd} should count for ${id}`);
});
test('English wildcards: every exception belongs to a wildcard that exists and would have matched it', () => {
  const stems = new Set(Object.values(EN_CATEGORIES).flatMap((c) => c.words).filter((x) => x.endsWith('*')).map((x) => x.slice(0, -1)));
  for (const [stem, list] of Object.entries(EN_WILDCARD_EXCEPTIONS)) {
    assert.ok(stems.has(stem), `${stem}* is not a wildcard in any category`);
    for (const x of list) assert.ok(x.replace(/\*$/, '').startsWith(stem) && x.replace(/\*$/, '') !== stem, `${x} under ${stem}*`);
  }
  assert.ok(categoryWords('en', 'affil').includes('hug* (not huge*, hugh, hugo)'));
});

test('Chinese guards: a degree word plus one character does not swallow the start of an emotion word', () => {
  for (const [text, word, id] of [
    ['我很難過', '難過', 'sad'], ['太難過了', '難過', 'sad'], ['真的很難過', '難過', 'sad'], ['很難受', '難受', 'negemo'],
    ['我很高興', '高興', 'posemo'], ['很快樂', '快樂', 'posemo'], ['太高興了', '高興', 'posemo'], ['最高興的一天', '高興', 'posemo'],
    ['很低落', '低落', 'sad'], ['太空虛', '空虛', 'lonely'], ['最後悔的事', '後悔', 'negemo'], ['好感動', '感動', 'posemo'],
    ['真心痛', '心痛', 'sad'], ['超過癮', '過癮', 'posemo'], ['很好吃', '好吃', 'posemo'], ['很小心', '小心', 'risk'],
    ['一生氣就哭', '生氣', 'anger'], ['一下班就回家', '下班', 'work'],
  ]) {
    const h = hitsOf(text, 'zh').find((x) => x.w === word);
    assert.ok(h && h.ids.includes(id), `${text}: ${word} should count for ${id}`);
  }
  assert.deepEqual(words('我很難過'), ['我', '很', '難過']);
  assert.deepEqual(words('我很高興'), ['我', '很', '高興']);
});
test('Chinese guards: the guard still wins where it should', () => {
  // a longer word right after the guard keeps the old cut
  assert.deepEqual(words('很難過去'), ['很難', '過去']);
  assert.deepEqual(words('最後來不及了'), ['最後', '來不及', '了']);
  assert.deepEqual(words('真正在乎'), ['真正', '在乎']);
  // nothing crosses: the guard is kept whole
  assert.deepEqual(words('這題很難'), ['這', '題', '很難']);
  assert.deepEqual(words('最後我們回家'), ['最後', '我們', '回家']);
  // guards that do not begin with a loose head never give way (經過 + 世界, not 經 + 過世 + 界)
  assert.deepEqual(words('經過世界'), ['經過', '世界']);
  assert.equal(countOf('經過世界', 'zh', 'loss'), 0);
  assert.deepEqual(words('不得不想'), ['不得不', '想']);
  assert.equal(countOf('不得不想，不只是這樣', 'zh', 'negate'), 0);
  assert.deepEqual(words('自然而然'), ['自然', '而', '然']);
  assert.deepEqual(words('人生'), ['人生']);
  // negation next to a freed emotion word still works
  assert.equal(countOf('我不是很難過', 'zh', 'sad'), 0);
});
test('Chinese guards: audit of every loose-head guard against every category word', () => {
  const dict = zhDict();
  const lex = new Set(Object.values(ZH_CATEGORIES).flatMap((c) => c.words));
  assert.ok(ZH_LOOSE_HEADS.every((h) => h.length === 1));
  let freed = 0;
  for (const g of ZH_COMMON) {
    if (lex.has(g)) continue;
    for (const c of lex) {
      if (c.length < 2 || g.length < 2 || !c.startsWith(g.slice(1)) || c.length <= g.length - 1) continue;
      // g = head + rest, c begins with rest and runs past the end of g
      const text = g[0] + c;
      if (dict.set.has(text)) continue; // 一家人 is a list word of its own
      const toks = tokenize(text, dict).map((x) => x.t);
      if (ZH_LOOSE_HEADS.includes(g[0])) {
        assert.deepEqual(toks, [g[0], c], `${text} should be ${g[0]} + ${c}`);
        freed++;
      } else assert.equal(toks[0], g, `${text} should keep the guard ${g}`);
    }
  }
  assert.ok(freed > 100, `only ${freed} pairs checked`);
});
test('Chinese: the verb 幹 ("to do") is not counted as anger, the swear word still is', () => {
  for (const t of ['你在幹什麼', '幹嘛這樣', '你幹麼', '他想幹啥', '幹嗎不說', '你到底幹甚麼', '幹得好', '我不幹了', '他很能幹', '幹部開會', '幹細胞研究', '你干什么', '干吗这样']) {
    assert.equal(countOf(t, 'zh', 'anger'), 0, t);
  }
  for (const t of ['幹，又下雨', '幹！', '真的很幹']) assert.equal(countOf(t, 'zh', 'anger'), 1, t);
});

test('Simplified Chinese: characters are mapped to the Traditional list words, positions do not move', () => {
  assert.equal(toTraditional('我们这个时候很难过'), '我們這個時候很難過');
  assert.equal(toTraditional('我們這個時候很難過'), '我們這個時候很難過');
  assert.equal(toTraditional('今日は学校 abc 123'), '今日は學校 abc 123');
  const s = '他们说我很难过，可是我很高兴。';
  const toks = tokenize(s, zhDict());
  assert.deepEqual(toks.map((x) => x.t), ['他們', '說', '我', '很', '難過', '可是', '我', '很', '高興']);
  for (const tk of toks) assert.equal(tk.end - tk.start, tk.t.length);
  assert.equal(s.slice(toks[4].start, toks[4].end), '难过'); // highlights point at the text as typed
});
test('Simplified Chinese: the same counts as the Traditional spelling of the same text', () => {
  const pairs = [
    ['我今天很难过，也很担心明天的考试，谢谢你陪我。', '我今天很難過，也很擔心明天的考試，謝謝你陪我。'],
    ['妈妈说她很高兴，我们一起吃饭，我觉得很幸福。', '媽媽說她很高興，我們一起吃飯，我覺得很幸福。'],
    ['因为压力太大，我没办法睡觉，头发一直掉。以后再说吧。', '因為壓力太大，我沒辦法睡覺，頭髮一直掉。以後再說吧。'],
    ['房间很干净，心里很平静，这里的关系也不复杂。', '房間很乾淨，心裡很平靜，這裡的關係也不複雜。'],
    ['对不起，我后悔了，我们还是朋友吗？', '對不起，我後悔了，我們還是朋友嗎？'],
  ];
  for (const [simp, trad] of pairs) {
    const a = analyze([{ text: simp }], {}).byLang.zh;
    const b = analyze([{ text: trad }], {}).byLang.zh;
    assert.equal(a.words, b.words);
    for (const id of CATEGORY_IDS) assert.equal(score(a, id).count, score(b, id).count, `${id}: ${simp}`);
    assert.ok(score(b, 'posemo').count + score(b, 'negemo').count > 0, trad);
    assert.deepEqual(a.hits[0].map((h) => h.w), b.hits[0].map((h) => h.w));
  }
  assert.equal(analyze([{ text: '我们这个时候还没说过什么话，没关系的' }], {}).simplifiedItems, 1);
});
test('Simplified Chinese: characters that both scripts use are only read through whole words', () => {
  // 后, 里, 干, 准 are Traditional characters too, so they are never converted alone
  assert.equal(toTraditional('皇后在公里外干扰批准'), '皇后在公里外干擾批准');
  assert.equal(variantSpelling('以後'), '以后');
  assert.equal(variantSpelling('頭髮'), '頭發');
  assert.equal(variantSpelling('開心'), null);
  assert.deepEqual(words('以后'), ['以後']);
  assert.deepEqual(words('头发'), ['頭髮']);
  assert.deepEqual(words('心里'), ['心裡']);
  assert.deepEqual(words('干净'), ['乾淨']);
  assert.deepEqual(words('皇后'), ['皇', '后']);
  assert.equal(countOf('干扰', 'zh', 'anger'), 0);
  assert.equal(countOf('不准去', 'zh', 'request'), 1); // 不准 is the Traditional spelling and stays as it is
  // Traditional text is unchanged by the map: every list word still cuts as itself
  const dict = zhDict();
  for (const wd of new Set([...ZH_COMMON, ...Object.values(ZH_CATEGORIES).flatMap((c) => c.words)])) {
    assert.equal(toTraditional(wd), wd, wd);
    assert.equal(dict.alias && dict.alias.get(wd), undefined, wd);
  }
});
test('Simplified Chinese: the generated map covers the list characters and nothing else', () => {
  const safe = [...ZH_S2T_SAFE];
  const variant = [...ZH_S2T_VARIANT];
  assert.ok(safe.length % 2 === 0 && variant.length % 2 === 0 && safe.length >= 600);
  const listChars = new Set([...ZH_COMMON, ...Object.values(ZH_CATEGORIES).flatMap((c) => c.words)].join(''));
  for (let k = 0; k < safe.length; k += 2) {
    assert.ok(!listChars.has(safe[k]), `${safe[k]} is used by a list word and must not be converted`);
    assert.ok(listChars.has(safe[k + 1]), `${safe[k + 1]} is not a list character`);
  }
  for (let k = 0; k < variant.length; k += 2) assert.ok(listChars.has(variant[k]), variant[k]);
  // makeDict without guards behaves as before the fix
  const plain = makeDict(['很難', '難過']);
  assert.deepEqual(tokenize('很難過', plain).map((x) => x.t), ['很難', '過']);
  assert.ok(SIMPLIFIED_NOTE.zh.includes('繁體中文') && SIMPLIFIED_NOTE.en.includes('Traditional Chinese'));
  for (const lang of ['en', 'zh-TW']) {
    const zh = analyze([{ text: '我今天很开心。'.repeat(3) }], {});
    const d = buildReportData(zh, { uiLang: lang, files: [], hash: 'x', generatedAt: '2026-11-24T00:00:00.000Z' });
    assert.ok(JSON.stringify(d).includes(lang === 'en' ? 'written for Traditional Chinese' : '照繁體中文'), lang);
  }
});

// ---------- scores on tiny hand-computed texts ----------
test('English rates are hits per 100 words (hand count)', () => {
  // 10 words: i am not sad but we will call my mom
  const res = analyze([{ text: 'I am not sad, but we will call my mom.' }], {}).byLang.en;
  assert.equal(res.words, 10);
  near(score(res, 'i').value, 20); // i, my
  near(score(res, 'we').value, 10);
  near(score(res, 'negate').value, 10);
  near(score(res, 'family').value, 10);
  near(score(res, 'focusfuture').value, 10);
  near(score(res, 'excl').value, 10);
  // "sad" follows "not": left out of the feeling counts and listed apart
  assert.equal(score(res, 'sad').count, 0);
  assert.deepEqual(score(res, 'sad').negated.map((x) => x.word), ['sad']);
  assert.deepEqual(score(res, 'i').contributors.map((c) => [c.word, c.count]), [['i', 1], ['my', 1]]);
  near(score(res, 'i').contributors[0].share, 0.5);
  assert.equal(score(res, 'i').enough, false); // far below the minimum
});
test('wildcards and phrases', () => {
  const res = analyze([{ text: 'She worried and kept worrying. I am going to rest, kind of.' }], {}).byLang.en;
  assert.deepEqual(score(res, 'anx').contributors.map((c) => c.word).sort(), ['worried', 'worrying']);
  assert.ok(score(res, 'focusfuture').contributors.some((c) => c.word === 'going to'));
  assert.ok(score(res, 'tentat').contributors.some((c) => c.word === 'kind of'));
  assert.equal(score(res, 'posemo').count, 0); // "kind" inside "kind of" is not kindness
});
test('Chinese rates are hits per 100 Chinese characters (hand count)', () => {
  // 我們今天很開心因為朋友來了 : 13 characters
  const res = analyze([{ text: '我們今天很開心，因為朋友來了。' }], {}).byLang.zh;
  assert.equal(res.words, 13);
  near(score(res, 'we').value, 100 / 13);
  assert.equal(score(res, 'i').count, 0); // 我 inside 我們 is not counted
  near(score(res, 'posemo').value, 100 / 13);
  near(score(res, 'cause').value, 100 / 13);
  near(score(res, 'friend').value, 100 / 13);
  near(score(res, 'focuspresent').value, 100 / 13);
  near(res.gateUnits, 13 / 1.5);
});
test('Chinese: a negated feeling word is listed apart, and 想 alone is not an insight word', () => {
  const res = analyze([{ text: '我沒有很開心。我想吃飯。' }], {}).byLang.zh;
  assert.equal(score(res, 'posemo').count, 0);
  assert.deepEqual(score(res, 'posemo').negated.map((x) => x.word), ['開心']);
  assert.equal(score(res, 'insight').count, 0);
});
test('indices are sums and differences of category rates', () => {
  const res = analyze([{ text: 'I am not sad, but we will call my mom.' }], data).byLang.en;
  near(score(res, 'status').value, 10 + 0 - 20); // we + you - i
  near(score(res, 'selfother').value, 20 - 0);
  near(score(res, 'authentic').value, 20 + 10 - 0); // i + exception words - negative feeling words
  near(score(res, 'tone').value, 0);
  // analytic: 30 + articles 0 + prepositions 0 - ppron 30 (i, we, my) - ipron 0 - aux 20 (am, will) - conj 10 (but) - adverb 0 - negate 10 (not)
  near(score(res, 'analytic').value, 30 - 30 - 20 - 10 - 10);
  const zh = analyze([{ text: '我們今天很開心，因為朋友來了。' }], data).byLang.zh;
  assert.equal(score(zh, 'analytic'), null); // English only
  assert.equal(zh.vader, null);
});
test('counterfactual: the rate without the top three contributing words', () => {
  const text = 'I think I know. I think you know. Maybe we all know my plan.';
  const res = analyze([{ text }], {}).byLang.en;
  const s = score(res, 'i');
  assert.deepEqual(s.counterfactual.words, ['i', 'my']);
  near(s.counterfactual.value, 0);
  const k = score(res, 'insight'); // know x3, think x2 out of 14 words
  assert.equal(res.words, 14);
  near(k.value, (100 * 5) / 14);
  near(k.counterfactual.value, 0);
});
test('highlights point at the exact words in the original text', () => {
  const text = 'Today I called my mom @her #family https://x.co/1 and I felt calm.';
  const res = analyze([{ text }], data).byLang.en;
  assert.deepEqual(highlightSpans(res, 0, 'i').map((h) => text.slice(h.s, h.e)), ['I', 'my', 'I']);
  assert.deepEqual(highlightSpans(res, 0, 'family').map((h) => text.slice(h.s, h.e)), ['mom']); // not the hashtag
  assert.ok(highlightSpans(res, 0, 'vader').some((h) => text.slice(h.s, h.e) === 'calm'));
  assert.ok(highlightSpans(res, 0, 'status').length >= 3);
});

// ---------- VADER ----------
test('VADER port matches the Python reference on every sample sentence', () => {
  const v = createVader(vaderData);
  const exp = JSON.parse(readFileSync(path.join(here, 'fixtures', 'vader-expected.json'), 'utf8'));
  assert.ok(exp.cases.length >= 20);
  for (const c of exp.cases) {
    const r = v.polarity(c.text);
    assert.deepEqual([r.compound, r.pos, r.neu, r.neg], [c.compound, c.pos, c.neu, c.neg], c.text);
  }
});
test('VADER: word-level contributions and the mean over sentences', () => {
  const v = createVader(vaderData);
  const r = v.polarity('The book was good.');
  assert.deepEqual(r.tokens.filter((t) => t.v).map((t) => t.t), ['good']);
  const res = analyze([{ text: 'The book was good. The food was horrible.' }], data).byLang.en;
  near(res.vader.value, (v.polarity('The book was good.').compound + v.polarity('The food was horrible.').compound) / 2, 1e-9);
  assert.equal(res.vader.nSentences, 2);
  assert.deepEqual(res.vader.contributors.map((c) => c.word).sort(), ['good', 'horrible']);
});

// ---------- uncertainty ----------
test('bootstrap is deterministic for a seed and changes with the seed', () => {
  const rng = mulberry32(7);
  const num = Int32Array.from({ length: 60 }, () => Math.floor(rng() * 4));
  const den = Int32Array.from({ length: 60 }, () => 10 + Math.floor(rng() * 10));
  const a = bootstrapRatios([num], [den], { B: 400, seed: 42 });
  const b = bootstrapRatios([num], [den], { B: 400, seed: 42 });
  const c = bootstrapRatios([num], [den], { B: 400, seed: 43 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  const point = num.reduce((x, y) => x + y, 0) / den.reduce((x, y) => x + y, 0);
  assert.ok(a[0][0] < point && point < a[0][1]);
  assert.equal(bootstrapRatios([num.slice(0, 5)], [den.slice(0, 5)], { seed: 1 })[0], null); // too few units
});
test('intervals: items resampled from 20 items, sentences below that, Wilson for very short text', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ text: `I think number ${i} is fine. We will see what my friend says about it.` }));
  const a = analyze(many, data).byLang.en;
  assert.equal(a.ciMethod, 'bootstrap-items');
  const s = score(a, 'i');
  assert.ok(s.ci[0] <= s.value && s.value <= s.ci[1]);
  assert.deepEqual(analyze(many, data).byLang.en.scores.map((x) => x.ci), a.scores.map((x) => x.ci)); // same every run
  const one = analyze([{ text: many.map((m) => m.text).join(' ') }], data).byLang.en;
  assert.equal(one.ciMethod, 'bootstrap-sentences');
  const short = analyze([{ text: 'I think so. We will see.' }], data).byLang.en;
  assert.equal(short.ciMethod, 'wilson');
  assert.equal(score(short, 'i').ciMethod, 'wilson');
  const w = wilson(1, 6);
  near(score(short, 'i').ci[0], 100 * w[0]);
  assert.equal(short.vader.ci, null);
});
test('minimum text: short text is marked "not enough", tiers have their own gates', () => {
  const short = analyze([{ text: 'I think so.' }], data).byLang.en;
  assert.ok(allScores(short).every((s) => s.enough === false));
  const mid = analyze([{ text: Array.from({ length: 20 }, () => 'I walked to the shop and we talked.').join(' ') }], data).byLang.en;
  assert.equal(mid.words, 160);
  assert.equal(score(mid, 'i').enough, true); // tier A from 50 words
  assert.equal(score(mid, 'tentat').enough, false); // tier B from 300
  assert.equal(score(mid, 'posemo').enough, false);
  assert.equal(MIN_WORDS.A, 50);
  assert.equal(MIN_WORDS.B, 300);
});

// ---------- importers ----------
test('mojibake repair: Meta exports, and strings that must be left alone', () => {
  const broken = [...new TextEncoder().encode('我覺得很開心 😀')].map((b) => String.fromCharCode(b)).join('');
  assert.equal(fixMojibake(broken), '我覺得很開心 😀');
  assert.equal(fixMojibake('plain ascii'), 'plain ascii');
  assert.equal(fixMojibake('café'), 'café'); // real Latin-1 text that is not UTF-8 bytes
  assert.equal(fixMojibake('已經是中文'), '已經是中文');
});
test('Instagram posts and comments', () => {
  const p = parseFile('your_instagram_activity/content/posts_1.json', read('instagram/posts_1.json'));
  assert.equal(p.kind, 'instagram-posts');
  assert.deepEqual(p.items.map((x) => x.text), ['今天和朋友一起吃飯，很開心 #美食 @friend', '我覺得最近工作壓力很大，可是我們還是撐過來了。']);
  assert.equal(p.items[0].timestamp, 1650000000000);
  assert.equal(p.items[0].source, 'instagram');
  const c = parseFile('your_instagram_activity/comments/post_comments_1.json', read('instagram/post_comments_1.json'));
  assert.equal(c.kind, 'instagram-comments');
  assert.deepEqual(c.items.map((x) => x.text), ['謝謝你，辛苦了！', 'So happy for you']);
  assert.equal(c.items[0].timestamp, 1651000000000);
});
test('Threads export', () => {
  const t = parseFile('your_instagram_activity/threads/threads_and_replies.json', read('threads/threads_and_replies.json'));
  assert.equal(t.kind, 'threads-posts');
  assert.deepEqual(t.items.map((x) => [x.text, x.source]), [['明天打算早點睡，因為真的太累了。', 'threads'], ['Maybe I will try again tomorrow.', 'threads']]);
});
test('Facebook posts and comments: only the person\'s own text, never the generated title', () => {
  const p = parseFile('your_facebook_activity/posts/your_posts__check_ins__photos_and_videos_1.json', read('facebook/your_posts__check_ins__photos_and_videos_1.json'));
  assert.equal(p.kind, 'facebook-posts');
  assert.deepEqual(p.items.map((x) => x.text), ['媽媽今天生日，我們全家一起回家吃飯。', 'I never thought this would be so hard, but we made it.']);
  const c = parseFile('comments.json', read('facebook/comments.json'));
  assert.equal(c.kind, 'facebook-comments');
  assert.deepEqual(c.items.map((x) => [x.text, x.timestamp]), [['恭喜你！真的很替你高興。', 1501000000000]]);
});
test('X archive: window.YTD prefix, reposts dropped, entities decoded, dates parsed by hand', () => {
  const t = parseFile('data/tweets.js', read('x/data/tweets.js'));
  assert.equal(t.kind, 'x-tweets');
  assert.equal(t.items.length, 3); // the repost is dropped; the duplicate goes at dedupe
  assert.equal(t.items[0].text, 'I am so happy today & grateful https://t.co/abc #blessed');
  assert.equal(t.items[0].timestamp, Date.UTC(2018, 9, 10, 20, 19, 24));
  assert.equal(dedupe(t.items).length, 2);
  assert.equal(parseTime('Wed Oct 10 20:19:24 +0800 2018'), Date.UTC(2018, 9, 10, 12, 19, 24));
});
test('Bluesky: JSON listing and CAR repository', () => {
  const j = parseFile('records.json', read('bluesky/records.json'));
  assert.equal(j.kind, 'bluesky-records');
  assert.deepEqual(j.items.map((x) => x.text), ['We are planning a small trip next week.', '今天天氣不錯，我們去散步。']);
  assert.equal(j.items[0].timestamp, Date.UTC(2024, 2, 1, 10));
  const car = parseFile('repo.car', new Uint8Array(readFileSync(fx('bluesky/repo.car'))));
  assert.equal(car.kind, 'bluesky-car');
  assert.deepEqual(car.items.map((x) => x.text), ['I miss my grandmother, but I am thankful for the time we had.', '阿嬤去年過世了，我很想念她。']);
  assert.equal(car.items[1].timestamp, Date.UTC(2024, 4, 3, 8));
  assert.deepEqual(parseFile('bad.car', new Uint8Array([1, 2, 3])).items, []);
});
test('Reddit CSV: quoted fields, deleted rows, quoted lines of others, no IP kept', () => {
  const p = parseFile('posts.csv', read('reddit/posts.csv'));
  assert.equal(p.kind, 'reddit-posts');
  assert.deepEqual(p.items.map((x) => x.text), ['A question, with a comma\nFirst line\nsecond line with "quotes" inside']); // the deleted post is skipped
  assert.equal(p.items[0].timestamp, Date.UTC(2021, 2, 4, 12, 34, 56));
  const c = parseFile('comments.csv', read('reddit/comments.csv'));
  assert.equal(c.kind, 'reddit-comments');
  assert.deepEqual(c.items.map((x) => x.text), ['I agree, maybe we should wait.']);
  assert.ok(!JSON.stringify([p, c]).includes('203.0.113'));
  assert.deepEqual(parseCSV('a,b\r\n"x,1","y ""z"""\n'), [['a', 'b'], ['x,1', 'y "z"']]);
});
test('plain text, Markdown, generic CSV and JSON', () => {
  assert.equal(parseFile('notes.txt', read('notes.txt')).items.length, 1);
  const md = parseFile('notes.md', read('notes.md')).items[0].text;
  assert.ok(md.includes('I think the meeting went well.') && !md.includes('https://') && !md.includes('#'));
  const csv = parseFile('generic.csv', read('generic.csv'));
  assert.deepEqual(csv.items.map((x) => [x.text, x.timestamp]), [['I was tired, but we finished.', Date.UTC(2022, 0, 2)], ['明天我們再試一次。', Date.UTC(2022, 0, 3)]]);
  const js = parseFile('generic.json', read('generic.json'));
  assert.deepEqual(js.items.map((x) => x.text), ['Because I care, I will call her.', 'A bare string entry.']);
  assert.equal(js.items[0].timestamp, Date.UTC(2022, 1, 1, 9));
});
test('dates before 2004 or in the future are dropped; broken files throw', () => {
  assert.equal(parseTime(946684800), null);
  assert.equal(parseTime('2999-01-01'), null);
  assert.equal(parseTime('not a date'), null);
  assert.throws(() => parseFile('x.json', '{not json'));
});
test('zip archive: posts are read, private messages and media are not', async () => {
  const buf = readFileSync(fx('export.zip'));
  const entries = await readZip(new Blob([buf]));
  assert.equal(entries.length, 4);
  const wanted = entries.filter((e) => wantedInArchive(e.name));
  assert.deepEqual(wanted.map((e) => e.name).sort(), ['data/tweets.js', 'your_instagram_activity/content/posts_1.json']);
  const items = [];
  for (const e of wanted) items.push(...parseFile(e.name, new TextDecoder().decode(await e.read())).items);
  assert.equal(items.length, 5);
  assert.ok(items.some((x) => x.text.startsWith('今天和朋友一起吃飯')));
  assert.equal(wantedInArchive('your_instagram_activity/messages/inbox/a/message_1.json'), false);
  await assert.rejects(() => readZip(new Blob([new Uint8Array(40)])));
});

// ---------- time series, comparison, report ----------
test('time series: one row per month, gaps where a month has too little text', () => {
  const items = parseFile('data/tweets.js', read('x-long/data/tweets.js')).items;
  assert.equal(items.length, 168);
  items.push({ text: 'I am back after a while.', timestamp: Date.UTC(2023, 5, 2), source: 'x' });
  const res = analyze(items, data).byLang.en;
  const rows = timeSeries(res, 'i', { utc: true });
  assert.deepEqual(rows.map((r) => r.key), ['2023-01', '2023-02', '2023-03', '2023-06']);
  assert.ok(rows.slice(0, 3).every((r) => r.value > 0 && r.words >= 300));
  assert.equal(rows[3].value, null); // shown as a gap
  const tone = timeSeries(res, 'tone', { utc: true });
  assert.ok(tone.slice(0, 3).every((r) => Number.isFinite(r.value)));
  assert.equal(timeSeries(res, 'vader', { utc: true, bin: 'year' }).length, 1);
  assert.deepEqual(timeSeries(res, 'i', { utc: true, source: 'instagram' }), []);
});
test('comparison is with the person\'s own earlier texts and only calls a difference when intervals do not overlap', () => {
  const mk = (subject, n) => Array.from({ length: n }, (_, i) => ({ text: `${subject} walked to the old shop near the river again today. ${subject} bought bread and some tea there. Day ${i}.` }));
  const a = analyze(mk('I', 30), data).byLang.en;
  const b = analyze(mk('They', 30), data).byLang.en;
  const c = compare(a, b);
  assert.equal(c.i.verdict, 'higher');
  assert.equal(compare(a, a).i.verdict, 'similar');
  assert.equal(compare(b, a).i.verdict, 'lower');
});
test('evidence report: self-contained HTML and JSON with method, versions, licenses, words, limits, references', () => {
  const items = parseFile('data/tweets.js', read('x-long/data/tweets.js')).items;
  items.push({ text: '我們今天很開心，因為朋友來了。<script>alert(1)</script>', timestamp: null, source: 'paste' });
  const a = analyze(items, data);
  for (const ui of ['en', 'zh-TW']) {
    const d = buildReportData(a, { uiLang: ui, files: [{ name: 'tweets.js', size: 1, kind: 'x-tweets', items: 168 }], hash: 'abc123', generatedAt: '2026-11-24T00:00:00.000Z' });
    assert.equal(d.notice, ui === 'en' ? NOTICE.en : NOTICE.zh);
    assert.ok(d.lexica.some((l) => l.id === 'vader' && l.license === 'MIT' && l.version === '3.3.2'));
    assert.ok(d.lexica.some((l) => l.id === 'murmur-zh' && l.license === 'MIT'));
    assert.ok(!d.lexica.some((l) => l.id === 'empath'));
    const i = d.languages.en.scores.find((s) => s.id === 'i');
    assert.equal(i.shown, 'rate');
    assert.ok(i.interval && i.contributors.length && i.wordList.includes("i'm") && i.limits && i.withoutTop3);
    assert.equal(d.languages.en.seed, a.byLang.en.seed);
    assert.ok(d.references.length >= 10 && d.limits.length >= 5 && d.method.length >= 5);
    const html = buildReportHtml(d, ui);
    assert.ok(html.startsWith('<!doctype html>') && !/<script|<link|src=|@import|url\(/i.test(html));
    assert.ok(html.includes(d.notice) && html.includes('abc123') && html.includes('VADER'));
    assert.ok(!html.includes('因為朋友來了')); // the text itself is not in the report
    assert.ok(!/\u2014/.test(html));
    JSON.parse(JSON.stringify(d));
  }
});
test('categoryWords lists what the lexicon says', () => {
  assert.ok(categoryWords('zh', 'we').includes('我們'));
  assert.ok(categoryWords('en', 'focusfuture').includes('going to'));
  assert.ok(categoryWords('en', 'analytic').length === 8);
});

// ---------- safety ----------
test('risk language in pasted or imported text is found by the app\'s own check', () => {
  const items = [...parseFile('repo.car', new Uint8Array(readFileSync(fx('bluesky/repo.car')))).items, { text: '那陣子我真的不想活了', timestamp: null, source: 'paste' }];
  assert.equal(items.some((it) => checkRisk(it.text).risk), true);
  assert.equal(parseFile('notes.txt', read('notes.txt')).items.some((it) => checkRisk(it.text).risk), false);
  const moji = [...new TextEncoder().encode('有時候覺得活著好累')].map((b) => String.fromCharCode(b)).join('');
  const viaExport = parseFile('posts_1.json', JSON.stringify([{ media: [{ title: moji, creation_timestamp: 1650000000 }] }])).items;
  assert.equal(checkRisk(viaExport[0].text).risk, true); // only after the encoding repair
  assert.equal(checkRisk(moji).risk, false);
});

// ---------- what stood out ----------
const obsRow = (id, count, value, extra = {}) => ({ id, kind: 'pct', count, value, enough: true, rateShown: true, ci: [value * 0.9, value * 1.1], ...extra });
test('observations: only rows that pass their minimum and have a rate; most hits first; at most three', () => {
  const res = {
    lang: 'zh',
    scores: [
      obsRow('i', 40, 4.7),
      obsRow('cause', 30, 2.3),
      obsRow('family', 90, 9, { enough: false, rateShown: false }), // not enough text
      obsRow('friend', 4, 0.4, { rateShown: false }), // too few hits for a rate
      obsRow('cogproc', 80, 8), // a sum of other categories
      obsRow('work', 20, 2),
      obsRow('body', 10, 1),
      { id: 'empath:work', kind: 'empath', count: 99, value: 9, enough: true, rateShown: true },
    ],
  };
  const pick = chooseObservations(res, null);
  assert.equal(pick.mode, 'counts');
  assert.equal(pick.hadBaseline, false);
  assert.deepEqual(pick.items.map((x) => x.id), ['i', 'cause', 'work']);
  assert.equal(observationText(pick.items[0], 'zh-TW', 'zh'), '你常寫到自己（每 100 字約 4.7 個「我」的詞）。');
  assert.equal(observationText(pick.items[1], 'zh-TW', 'zh'), '這段文字裡，想到原因和理由的詞比較多（每 100 字約 2.3 個）。');
  assert.equal(observationText(pick.items[0], 'en', 'en'), 'You write about yourself often (about 4.7 I-words per 100 words).');
  assert.equal(observationText(pick.items[1], 'en', 'zh'), 'In this text, words about causes and reasons are among the most frequent (about 2.3 per 100 Chinese characters).');
  assert.equal(chooseObservations(res, null, 2).items.length, 2);
  assert.deepEqual(chooseObservations({ lang: 'zh', scores: res.scores.filter((x) => !x.enough || !x.rateShown) }, null), { mode: 'none', hadBaseline: false, items: [] });
  assert.deepEqual(chooseObservations(null, null).items, []);
});
test('observations: with a baseline, chosen by distance from the person\'s own earlier texts', () => {
  const res = { lang: 'en', scores: [obsRow('i', 400, 8), obsRow('work', 30, 3), obsRow('cause', 20, 2), obsRow('body', 10, 1, { enough: false, rateShown: false })] };
  const cmp = {
    i: { earlier: 7.9, earlierCi: [7.5, 8.3], delta: 0.1, verdict: 'similar' },
    work: { earlier: 0.5, earlierCi: [0.3, 0.7], delta: 2.5, verdict: 'higher' },
    cause: { earlier: 4, earlierCi: [3.6, 4.4], delta: -2, verdict: 'lower' },
    body: { earlier: 9, earlierCi: [8, 10], delta: -8, verdict: 'lower' },
  };
  const pick = chooseObservations(res, cmp);
  assert.equal(pick.mode, 'baseline');
  assert.deepEqual(pick.items.map((x) => [x.id, x.kind]), [['work', 'higher'], ['cause', 'lower']]); // not i (overlaps), not body (short)
  assert.equal(observationText(pick.items[0], 'en', 'en'), 'Compared with your earlier kept texts, there are more words about work and school this time (about 3.0 per 100 words; earlier about 0.50).');
  assert.equal(observationText(pick.items[1], 'zh-TW', 'en'), '和你之前留下的文字比，這次想到原因和理由的詞比較少（每 100 個英文單字約 2.0 個，之前約 4.0 個）。');
  // a baseline in which nothing differs clearly falls back to counts, and remembers why
  const flat = chooseObservations(res, { i: cmp.i });
  assert.equal(flat.mode, 'counts');
  assert.equal(flat.hadBaseline, true);
  assert.deepEqual(flat.items.map((x) => x.id), ['i', 'work', 'cause']);
});
test('observations on real text: every category has a sentence in both languages, with no evaluation, clinical or advice words', () => {
  const text = Array.from({ length: 40 }, (_, i) => `我今天和朋友一起去吃飯，我覺得很開心，因為工作終於做完了。也許明天我們再聊。第${i + 1}天。`).join('\n');
  const res = analyze([{ text, timestamp: null, source: 'paste' }], data).byLang.zh;
  const pick = chooseObservations(res, null);
  assert.equal(pick.items.length, 3);
  for (const it of pick.items) {
    const sc = findScore(res, it.id);
    assert.ok(sc.enough && sc.rateShown && sc.kind === 'pct', it.id);
  }
  const banned = /\b(good|bad|healthy|unhealthy|worrying|concerning|normal|should|try to|consider)\b|symptom|disorder|depress|anxiety|clinical|diagnos|健康|令人擔心|正常|異常|建議|應該要|試著|症狀|憂鬱|焦慮症|診斷|臨床|良好|不良/i;
  for (const id of CATEGORY_IDS) {
    if (OBS_AGGREGATES.includes(id)) continue;
    for (const ui of ['zh-TW', 'en'])
      for (const kind of ['counts', 'higher', 'lower']) {
        const line = observationText({ id, kind, value: 4.66, earlier: 1.2 }, ui, 'zh');
        assert.ok(/4\.7/.test(line) && !/undefined/.test(line), `${id} ${ui} ${kind}: ${line}`);
        // quoted example words ("should" in the requests category) are the person's words, not the app's voice
        assert.ok(!banned.test(line.replace(/"[^"]*"|「[^」]*」/g, '')), `${id} ${ui} ${kind}: ${line}`);
        assert.ok(/[（(].*4\.7.*[)）][。.]$/.test(line), `number in parentheses, one sentence: ${line}`);
      }
  }
  for (const k of ['zh', 'en']) for (const v of Object.values(OBS_TEMPLATES[k].basis)) assert.ok(!banned.test(v));
});
test('validation status says what lab/langval found, and no more', () => {
  assert.equal(validationNote('posemo', 'en', 'zh-TW').text, '和人工情緒標註比對過（英文）：AUC .79。.50 等於亂猜，1.00 是完全分得開。');
  assert.equal(validationNote('grat', 'en', 'en').text, 'Checked against human emotion labels (English): AUC .93. .50 is chance and 1.00 is perfect.');
  assert.ok(validationNote('loss', 'en', 'en').text.includes('very few comments'));
  assert.equal(validationNote('cause', 'en', 'en').checked, false);
  for (const id of ['posemo', 'negemo', 'anx', 'anger', 'sad', 'tone', 'i', 'cause']) assert.deepEqual(validationNote(id, 'zh', 'zh-TW'), { checked: false, text: '中文還沒驗證' });
  assert.equal(validationNote('posemo', 'zh', 'en').text, 'Not yet validated for Chinese');
  const g = validationNote('grat', 'zh', 'zh-TW');
  assert.ok(g.checked && g.text.includes('AUC .80') && g.text.includes('電視劇對白'));
  assert.deepEqual(Object.keys(VALIDATION.en.auc).sort(), ['affil', 'anger', 'anx', 'apology', 'grat', 'loss', 'negemo', 'posemo', 'sad', 'tone', 'vader']);
  assert.deepEqual(Object.keys(VALIDATION.zh.auc), ['grat']);
});

await Promise.all(pending);
console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);

// From the security review: long crafted input must not make matching quadratic.
test('masking and markdown stripping stay fast on long crafted input', async () => {
  let t = Date.now();
  maskSpans('a'.repeat(150000));
  assert.ok(Date.now() - t < 1000, `maskSpans took ${Date.now() - t} ms`);
  t = Date.now();
  await parseFile('notes.md', '['.repeat(200000));
  assert.ok(Date.now() - t < 1000, `markdown parsing took ${Date.now() - t} ms`);
});
