import assert from 'node:assert/strict';
import { tokenize, terms, stem, normalizeText, parseQuery, createIndex, highlight, partsToHtml, journalDocs, entryDoc, SYNONYMS, JOURNAL_FIELDS } from '../js/search.js';
import { buildChunks, retrieve, referenceBlock, basedOn, stripCitations, citedIds } from '../js/rag.js';
import { LENSES } from '../js/lenses.js';

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
const near = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${a} is not within ${eps} of ${b}`);
const ids = (results) => results.map((r) => r.id);

// ---------- tokenizer ----------
test('Chinese text becomes single characters plus neighbouring pairs', () => {
  assert.deepEqual(terms('工作壓力'), ['工', '工作', '作', '作壓', '壓', '壓力', '力']);
  assert.deepEqual(terms('累'), ['累']);
});

test('punctuation, spaces and emoji separate tokens and are dropped', () => {
  assert.deepEqual(terms('今天，很累！！'), ['今', '今天', '天', '很', '很累', '累']);
  assert.deepEqual(terms('…。「」、？ 🙂 --- '), []);
  // a pair never reaches across punctuation
  assert.ok(!terms('上班。累').includes('班累'));
});

test('English words are lowercased and lightly stemmed', () => {
  assert.deepEqual(terms('Worries WORRIED worrying'), ['worry', 'worry', 'worry']);
  assert.deepEqual(terms('working works worked'), ['work', 'work', 'work']);
  assert.equal(stem('running'), 'run');
  assert.equal(stem('stopped'), 'stop');
  assert.equal(stem('parents'), 'parent');
  assert.equal(stem('boxes'), 'box');
  assert.equal(stem('slept'), 'sleep');
  assert.equal(stem('making'), stem('make'));
  // short words and words that only look inflected are left alone
  for (const w of ['was', 'his', 'boss', 'stress', 'anxious', 'morning', 'sing', 'bring', 'need']) assert.equal(stem(w), w);
});

test('apostrophes join, accents fold, digits stand alone', () => {
  assert.deepEqual(terms("Mom's café, don’t"), ['mom', 'caf', 'dont']);
  assert.deepEqual(terms('slept 6 hours, 2024/03/05'), ['sleep', '6', 'hour', '2024', '03', '05']);
  assert.deepEqual(terms('b12'), ['b', '12']);
});

test('full-width and compatibility forms are normalized (NFKC)', () => {
  assert.deepEqual(terms('ＷＯＲＫ　１２３'), ['work', '123']);
  assert.deepEqual(terms('ﬁne'), terms('fine'));
  assert.equal(normalizeText('ＡＢＣ，１２３！'), 'abc 123');
  // half-width katakana folds to the full-width form
  assert.deepEqual(terms('ｶﾞ'), terms('ガ'));
});

test('mixed Chinese and English in one sentence', () => {
  assert.deepEqual(terms('今天meeting很多'), ['今', '今天', '天', 'meet', '很', '很多', '多']);
  assert.deepEqual(terms('跟 boss 開會3次'), ['跟', 'boss', '開', '開會', '會', '3', '次']);
});

test('tokens keep their place in the original text', () => {
  const text = 'ＷＯＲＫ 好累 café';
  for (const t of tokenize(text)) {
    const slice = text.slice(t.start, t.end);
    if (t.kind === 'word') assert.equal(normalizeText(slice).normalize('NFC'), t.raw);
    else assert.equal(slice, t.term);
  }
  // an astral character (two code units) is one token with both units
  const rare = tokenize('𠮷野家');
  assert.equal(rare[0].term, '𠮷');
  assert.equal(rare[0].end - rare[0].start, 2);
  assert.equal(rare[1].term, '𠮷野');
});

// ---------- query and synonyms ----------
test('synonyms: 工作/上班, 爸媽/父母, mom/mother find one another, at a lower weight', () => {
  const has = (q, term) => parseQuery(q).terms.get(term);
  assert.equal(has('工作', '工作').weight, 1);
  assert.ok(has('工作', '上班').weight < 1 && has('工作', '上班').strong);
  assert.ok(has('上班', '工作'));
  assert.ok(has('上班', 'work'));
  assert.ok(has('爸媽', '父母'));
  assert.ok(has('父母', '爸媽'));
  assert.ok(has('mom', 'mother'));
  assert.ok(has('Mother', 'mom'));
  assert.ok(has('my mom', '媽媽'));
  assert.equal(has('工作', '父母'), undefined);
  assert.equal(parseQuery('工作', { synonyms: false }).terms.get('上班'), undefined);
});

test('a single-character synonym needs the character to stand alone: 好累 yes, 累積 no', () => {
  const tired = stem('tired');
  assert.ok(parseQuery('累').terms.get(tired));
  assert.ok(parseQuery('好累').terms.get(tired));
  assert.ok(parseQuery('很累了').terms.get(tired));
  assert.equal(parseQuery('累積').terms.get(tired), undefined);
});

test('every synonym is searchable: its own terms come out of the tokenizer', () => {
  for (const group of SYNONYMS) for (const member of group) assert.ok(terms(member).length > 0, member);
});

test('synonyms in a search', () => {
  const ix = createIndex();
  ix.add({ id: 'zh', fields: { text: '最近上班都很晚才回家' } });
  ix.add({ id: 'en', fields: { text: 'Called my mother after dinner' } });
  ix.add({ id: 'no', fields: { text: '和朋友去爬山' } });
  assert.deepEqual(ids(ix.search('工作')), ['zh']);
  assert.deepEqual(ids(ix.search('mom')), ['en']);
  assert.deepEqual(ids(ix.search('媽媽')), ['en']);
  assert.deepEqual(ids(ix.search('工作', { synonyms: false })), []);
});

test('filler words and loose characters cannot bring an item in on their own', () => {
  const ix = createIndex();
  ix.add({ id: 'a', fields: { text: '工作壓力很大' } });
  ix.add({ id: 'b', fields: { text: '努力運動' } }); // shares only 力 with the query
  ix.add({ id: 'c', fields: { text: 'the cat sat on the mat' } });
  assert.deepEqual(ids(ix.search('工作壓力')), ['a']);
  assert.deepEqual(ids(ix.search('the dog')), []);
  // a query that is nothing but filler still searches for what was typed
  assert.deepEqual(ids(ix.search('the')), ['c']);
});

test('while typing, the last English word matches words that start with it', () => {
  const ix = createIndex();
  ix.add({ id: 'a', fields: { text: 'felt anxious before the exam' } });
  assert.deepEqual(ids(ix.search('anx')), []);
  assert.deepEqual(ids(ix.search('anx', { prefix: true })), ['a']);
  // a finished word (followed by a space) is no longer a prefix
  assert.deepEqual(ids(ix.search('anx ', { prefix: true })), []);
});

// ---------- BM25 ----------
// Three documents, one field, k1 = 1.2, b = 0.75, no dates, no phrase boost. Lengths 3, 2, 4;
// average 3. Worked by hand:
//   idf(cat)  = ln(1 + (3 - 1 + 0.5) / (1 + 0.5)) = ln(2.66667) = 0.980829
//   idf(dog)  = idf(bird) = ln(1 + (3 - 2 + 0.5) / (2 + 0.5)) = ln(1.6) = 0.470004
//   tf part   = tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * len / 3))
//   d1 "cat cat dog":        cat 2 * 2.2 / 3.2 = 1.375;  dog 2.2 / 2.2 = 1
//   d2 "dog bird":           dog, bird 2.2 / 1.9 = 1.157895
//   d3 "bird fish tree leaf": bird 2.2 / 2.5 = 0.88
test('BM25 scores match the hand-computed values and order', () => {
  const ix = createIndex({ fields: { text: 1 }, k1: 1.2, b: 0.75, phraseBoost: 0, recencyWeight: 0 });
  ix.add({ id: 'd1', fields: { text: 'cat cat dog' } });
  ix.add({ id: 'd2', fields: { text: 'dog bird' } });
  ix.add({ id: 'd3', fields: { text: 'bird fish tree leaf' } });
  const cat = ix.search('cat');
  assert.deepEqual(ids(cat), ['d1']);
  near(cat[0].score, 0.980829 * 1.375);
  const dog = ix.search('dog');
  assert.deepEqual(ids(dog), ['d2', 'd1']); // the shorter document wins at equal term frequency
  near(dog[0].score, 0.470004 * 1.157895);
  near(dog[1].score, 0.470004);
  const both = ix.search('dog bird');
  assert.deepEqual(ids(both), ['d2', 'd1', 'd3']);
  near(both[0].score, 2 * 0.470004 * 1.157895);
  near(both[1].score, 0.470004);
  near(both[2].score, 0.470004 * 0.88);
  assert.deepEqual(ids(ix.search('zebra')), []);
});

test('b = 0 switches length normalization off; the term frequency saturates with k1', () => {
  const ix = createIndex({ k1: 1.2, b: 0, phraseBoost: 0, recencyWeight: 0 });
  ix.add({ id: 'short', fields: { text: 'dog' } });
  ix.add({ id: 'long', fields: { text: 'dog bird fish tree leaf cat' } });
  ix.add({ id: 'many', fields: { text: 'dog dog dog dog' } });
  ix.add({ id: 'other', fields: { text: 'fish' } });
  const r = ix.search('dog');
  near(r.find((x) => x.id === 'short').score, r.find((x) => x.id === 'long').score);
  // four mentions are worth less than twice one mention: 4 * 2.2 / 5.2 against 1
  near(r[0].score / r[1].score, (4 * 2.2) / 5.2);
});

test('a match in a heavier field ranks above the same match in a lighter one', () => {
  const ix = createIndex({ fields: { text: 2, more: 1 }, recencyWeight: 0 });
  ix.add({ id: 'light', fields: { text: 'walked by the river', more: 'thinking about the deadline' } });
  ix.add({ id: 'heavy', fields: { text: 'thinking about the deadline', more: 'walked by the river' } });
  assert.deepEqual(ids(ix.search('deadline')), ['heavy', 'light']);
});

test('the query as written outranks the same words scattered', () => {
  const ix = createIndex({ recencyWeight: 0 });
  ix.add({ id: 'scattered', fields: { text: 'I called my sister late and could not sleep' } });
  ix.add({ id: 'exact', fields: { text: 'I could not sleep; my late sister called' } });
  const r = ix.search('sister called');
  assert.deepEqual(ids(r), ['exact', 'scattered']);
  assert.equal(r[0].phrase, true);
  assert.equal(r[1].phrase, false);
  near(r[0].score / r[0].bm25, 1.5);
  // one word alone is not a phrase, and a phrase must match whole words
  assert.equal(ix.search('sister')[0].phrase, false);
  assert.equal(ix.search('ate and')[0]?.phrase ?? false, false);
  const zh = createIndex({ recencyWeight: 0 });
  zh.add({ id: 'a', fields: { text: '睡不著，一直想工作的事' } });
  assert.equal(zh.search('想工作')[0].phrase, true);
});

test('recency only separates near ties', () => {
  const day = 86400000;
  const now = 1_800_000_000_000;
  const ix = createIndex();
  ix.add({ id: 'old', date: now - 300 * day, fields: { text: 'argued with my sister' } });
  ix.add({ id: 'new', date: now - 1 * day, fields: { text: 'argued with my sister' } });
  ix.add({ id: 'newer-weaker', date: now, fields: { text: 'my sister visited and we cooked and talked for a long while about nothing much' } });
  const r = ix.search('argued sister', { now });
  assert.deepEqual(ids(r), ['new', 'old', 'newer-weaker']);
  assert.ok(r[0].score / r[1].score < 1.04);
});

// ---------- index upkeep ----------
test('adding, replacing, removing and syncing keep the index consistent', () => {
  const ix = createIndex();
  ix.add({ id: 'a', fields: { text: '今天很累' } });
  ix.add({ id: 'b', fields: { text: 'long walk' } });
  assert.equal(ix.size, 2);
  ix.add({ id: 'a', fields: { text: '今天很開心' } }); // same id replaces
  assert.equal(ix.size, 2);
  assert.deepEqual(ids(ix.search('累', { synonyms: false })), []);
  assert.deepEqual(ids(ix.search('開心')), ['a']);
  assert.equal(ix.remove('a'), true);
  assert.equal(ix.remove('a'), false);
  assert.deepEqual(ids(ix.search('開心')), []);
  const changed = ix.sync([{ id: 'b', fields: { text: 'long walk' } }, { id: 'c', fields: { text: 'short nap' } }]);
  assert.deepEqual(changed, { added: 1, removed: 0 });
  assert.deepEqual(ix.sync([{ id: 'c', fields: { text: 'short nap, then tea' } }]), { added: 1, removed: 1 });
  assert.deepEqual(ids(ix.search('walk')), []);
  assert.deepEqual(ids(ix.search('tea')), ['c']);
  ix.clear();
  assert.equal(ix.size, 0);
  assert.deepEqual(ix.search('tea'), []);
});

// ---------- snippets ----------
test('snippet parts are the original text, and markup in it is escaped', () => {
  const text = '<img src=x onerror=alert(1)> felt "tired" & <b>slept</b> early';
  const { parts, count } = highlight(text, 'tired sleep');
  assert.equal(parts.map((p) => p.text).join(''), text);
  assert.deepEqual(parts.filter((p) => p.hit).map((p) => p.text), ['tired', 'slept']);
  assert.equal(count, 2);
  const html = partsToHtml(parts);
  assert.equal(html, '&lt;img src=x onerror=alert(1)&gt; felt &quot;<mark>tired</mark>&quot; &amp; &lt;b&gt;<mark>slept</mark>&lt;/b&gt; early');
  assert.ok(!/<(?!\/?mark>)/.test(html), 'only <mark> tags may appear');
  // a query made of markup is just words
  assert.ok(!/<(?!\/?mark>)/.test(partsToHtml(highlight('a <script> tag', '<script>').parts)));
});

test('highlighting in Chinese, with full-width and synonym matches', () => {
  const zh = highlight('今天工作壓力很大，回家只想睡覺', '工作壓力');
  assert.deepEqual(zh.parts.filter((p) => p.hit).map((p) => p.text), ['工作壓力']);
  assert.deepEqual(highlight('ＷＯＲＫ到很晚', 'work').parts.filter((p) => p.hit).map((p) => p.text), ['ＷＯＲＫ']);
  assert.deepEqual(highlight('最近上班都很晚', '工作').parts.filter((p) => p.hit).map((p) => p.text), ['上班']);
  // loose single characters from a longer query are not marked
  assert.equal(highlight('努力運動', '工作壓力').count, 0);
});

test('a long text is cut to a window around the matches, on word boundaries', () => {
  const long = 'Lorem ipsum dolor sit amet consectetur. '.repeat(8) + 'Then the deadline moved again and I panicked. ' + 'Nothing else happened that afternoon at all. '.repeat(8);
  const { parts } = highlight(long, 'deadline', { max: 80 });
  const shown = parts.map((p) => p.text).join('');
  assert.ok(shown.length <= 82, String(shown.length));
  assert.equal(parts[0].text, '…');
  assert.equal(parts[parts.length - 1].text, '…');
  assert.deepEqual(parts.filter((p) => p.hit).map((p) => p.text), ['deadline']);
  const body = shown.slice(1, -1);
  assert.ok(long.includes(body));
  assert.ok(/^\W|^[A-Z]/.test(body) || long[long.indexOf(body) - 1] === ' ', 'starts at a word boundary');
  assert.ok(long[long.indexOf(body) + body.length] === ' ' || /\W$/.test(body), 'ends at a word boundary');
  // nothing matched: the start of the text
  const none = highlight(long, 'zebra', { max: 40 });
  assert.equal(none.count, 0);
  assert.ok(none.parts[0].text.startsWith('Lorem'));
  // an astral character at the edge is not cut in half
  const astral = '𠮷'.repeat(60) + '工作' + '𠮷'.repeat(60);
  for (const p of highlight(astral, '工作', { max: 31 }).parts) assert.ok(!/[\ud800-\udbff]$|^[\udc00-\udfff]/.test(p.text));
});

// ---------- odd queries ----------
test('empty, blank and punctuation-only queries return nothing', () => {
  const ix = createIndex();
  ix.add({ id: 'a', fields: { text: '今天很累 tired' } });
  for (const q of ['', '   ', '\n\t', '。，！？', '...', '🙂', null, undefined]) assert.deepEqual(ix.search(q), [], JSON.stringify(q));
  assert.deepEqual(highlight('今天很累', '').parts, [{ text: '今天很累', hit: false }]);
  assert.deepEqual(highlight('', 'x').parts, []);
  assert.deepEqual(createIndex().search('anything'), []);
});

test('a very long query is cut off and still answers quickly', () => {
  const ix = createIndex();
  for (let i = 0; i < 300; i++) ix.add({ id: `d${i}`, date: i, fields: { text: `第 ${i} 天 工作 ${i % 7 === 0 ? '很累' : '還好'} walked ${i} steps` } });
  const long = '工作很累 tired walk '.repeat(5000);
  assert.ok(long.length > 60000);
  const started = Date.now();
  const q = parseQuery(long);
  const r = ix.search(long, { limit: 10 });
  assert.ok(Date.now() - started < 1000, 'took too long');
  assert.ok(q.terms.size <= 64 * 2 + 40);
  assert.ok(q.phrase.length <= 200);
  assert.equal(r.length, 10);
  // one enormous unbroken word
  assert.deepEqual(ix.search('a'.repeat(100000)), []);
});

// ---------- what the journal index holds ----------
test('journal documents: notes, check-ins, kept worries, kind things, lens exercises', () => {
  const docs = journalDocs({
    entries: [
      { id: 'e1', createdAt: 1, note: 'voice note', features: { ok: true } },
      { id: 'e2', createdAt: 2, note: '只記心情', silent: true },
      { id: 'e3', createdAt: 3, note: '   ' },
      { id: 'e4', createdAt: 4, note: '', prompt: 'a prompt the app wrote' },
    ],
    nights: [
      { id: 'n1', createdAt: 5, worry: '', kindness: '泡了一杯茶' }, // the worry was not kept
      { id: 'n2', createdAt: 6, worry: '明天的報告', kindness: '' },
    ],
    sessions: [
      { id: 's1', createdAt: 7, lensId: 'cognitive', concern: '報告一直拖著', answers: ['我一定會搞砸', '不知道', 7, null] },
      { id: 's2', createdAt: 8, lensId: 'gone-lens', concern: '', answers: ['skip'] },
    ],
  });
  assert.deepEqual(docs.map((d) => [d.id, d.type]), [['entry:e1', 'voice'], ['entry:e2', 'checkin'], ['kind:n1', 'kind'], ['worry:n2', 'worry'], ['lens:s1', 'lens']]);
  const lens = docs[4];
  assert.equal(lens.fields.text, '報告一直拖著');
  assert.equal(lens.fields.more, '我一定會搞砸'); // "not sure" and ratings are not searchable text
  assert.ok(lens.fields.title.includes('認知取向') && lens.fields.title.includes('Cognitive'));
  assert.equal(entryDoc({ id: 'x', note: '' }), null);
  const ix = createIndex({ fields: JOURNAL_FIELDS });
  ix.sync(docs);
  assert.deepEqual(ids(ix.search('報告')).sort(), ['lens:s1', 'worry:n2']);
  assert.deepEqual(ids(ix.search('搞砸')), ['lens:s1']);
  assert.deepEqual(ids(ix.search('認知')), ['lens:s1']);
  assert.deepEqual(ids(ix.search('prompt')), []);
});

// ---------- retrieval for the AI conversation ----------
test('passages come only from lens content and help lines, each with its own id', () => {
  const chunks = buildChunks('TW');
  assert.equal(new Set(chunks.map((c) => c.id)).size, chunks.length);
  for (const lens of LENSES) {
    const own = chunks.filter((c) => c.lensId === lens.id);
    assert.equal(own.length, 3 + lens.zh.steps.filter((s) => s.why).length, lens.id);
    assert.equal(own.find((c) => c.kind === 'idea').text.zh, lens.zh.idea);
    assert.equal(own.find((c) => c.kind === 'misses').text.en, lens.en.misses);
    for (const c of own) {
      assert.match(c.id, /^[a-z-]+\.(idea|concepts|misses|why\d)$/);
      assert.ok(c.text.zh && c.text.en && !/\{\d\}/.test(c.text.zh + c.text.en), c.id);
    }
  }
  const help = chunks.filter((c) => c.kind === 'help');
  assert.equal(help.length, 1);
  assert.ok(help[0].text.zh.includes('1925') && help[0].text.en.includes('1925'));
  assert.ok(buildChunks('US').find((c) => c.kind === 'help').text.en.includes('988'));
});

test('retrieval returns three passages of the current lens, best match first', () => {
  const r = retrieve('有什麼證據可以支持', 'cognitive', { lang: 'zh-TW', region: 'TW' });
  assert.equal(r.length, 3);
  assert.equal(r[0].id, 'cognitive.why2');
  assert.ok(r.every((c) => c.lensId === 'cognitive'));
  const en = retrieve('what evidence is there', 'cognitive', { lang: 'en', region: 'TW' });
  assert.equal(en[0].id, 'cognitive.why2');
  assert.ok(en[0].text.includes('evidence'));
  // nothing matches: the lens's idea, concepts and limits
  assert.deepEqual(ids(retrieve('zzz', 'narrative', { region: 'TW' })), ['narrative.idea', 'narrative.concepts', 'narrative.misses']);
  assert.deepEqual(ids(retrieve('', 'narrative', { region: 'TW' })), ['narrative.idea', 'narrative.concepts', 'narrative.misses']);
  assert.deepEqual(retrieve('anything', 'no-such-lens'), []);
  for (const lens of LENSES) assert.equal(retrieve('我覺得很累', lens.id, { region: 'TW' }).length, 3);
});

test('help lines are offered only when the person asks where to find help', () => {
  assert.ok(!ids(retrieve('我想打電話給媽媽', 'cognitive', { region: 'TW' })).includes('help.tw'));
  assert.equal(retrieve('哪裡可以找心理師', 'cognitive', { region: 'TW' })[0].id, 'help.tw');
  assert.equal(retrieve('is there a hotline', 'cognitive', { lang: 'en', region: 'US' })[0].id, 'help.us');
});

test('the reference block is fenced, lists ids, and holds only app text', () => {
  const message = '我覺得自己很爛，報告一直拖著沒寫';
  const chunks = retrieve(message, 'cognitive', { region: 'TW' });
  const block = referenceBlock(chunks);
  assert.match(block, /<murmur_reference>\n[\s\S]+\n<\/murmur_reference>$/);
  for (const c of chunks) assert.ok(block.includes(`[${c.id}] `));
  assert.ok(!block.includes('很爛') && !block.includes('報告一直拖著'));
  assert.equal(block.match(/<\/?murmur_reference>/g).length, 3); // once in the instruction, then open and close
  assert.ok(block.includes('stay within these passages'));
  assert.ok(block.includes('help lines, always come first'));
  assert.equal(referenceBlock([]), '');
  // every piece of the block is findable in the app's own content
  const all = buildChunks('TW');
  for (const c of chunks) assert.equal(all.find((x) => x.id === c.id).text.zh, c.text);
});

test('passage ids are taken out of the shown reply and drive the "based on" line', () => {
  const chunks = retrieve('有什麼證據', 'cognitive', { region: 'TW' });
  const reply = '你提到報告一直拖著。[cognitive.why2] 當你想到要開始寫，第一個想法是什麼？［cognitive.why1、cognitive.concepts］';
  assert.equal(stripCitations(reply), '你提到報告一直拖著。 當你想到要開始寫，第一個想法是什麼？');
  assert.equal(stripCitations('年份 [1988] 和 [不是代號] 留著'), '年份 [1988] 和 [不是代號] 留著');
  assert.deepEqual(citedIds('x [cognitive.why2] y [narrative.idea]', chunks), ['cognitive.why2']);
  assert.equal(basedOn(chunks, 'zh-TW', 'x [cognitive.why1]'), '根據：認知取向｜自動化思考');
  assert.match(basedOn(chunks, 'zh-TW', 'no ids'), /^根據：認知取向｜/);
  assert.match(basedOn(retrieve('evidence', 'cognitive', { lang: 'en', region: 'TW' }), 'en'), /^Based on: Cognitive · /);
  assert.equal(basedOn([], 'en'), '');
});

console.log(`\n${passed} passed`);
