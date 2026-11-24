// Unit tests for the language mirror engine (js/langlab). Run: node tests/langlab.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tokenize, splitSentences, detectLanguage, maskSpans, looksSimplified } from '../js/langlab/tokenize.js';
import { analyze, allScores, findScore, bootstrapRatios, mulberry32, wilson, zhDict, timeSeries, compare, highlightSpans, categoryWords, CATEGORY_IDS, GROUPS, INDICES, MIN_WORDS } from '../js/langlab/score.js';
import { createVader } from '../js/langlab/vader.js';
import { fixMojibake, parseFile, parseCSV, parseTime, dedupe, wantedInArchive } from '../js/langlab/importers.js';
import { readZip } from '../js/langlab/zip.js';
import { buildReportData, buildReportHtml } from '../js/langlab/report.js';
import { scoreMeta, groupLabel, groupNote, NOTICE } from '../js/langlab/meta.js';
import { EN_CATEGORIES } from '../js/langlab/lexicon-en.js';
import { ZH_CATEGORIES, ZH_COMMON } from '../js/langlab/lexicon-zh.js';
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

await Promise.all(pending);
console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
