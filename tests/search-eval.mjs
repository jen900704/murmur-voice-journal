// Ranking quality of the journal search on a small labeled set.
// The built-in demo data (demo/demo-data.json) is voice measurements only and has no text, so
// this script adds a made-up demo journal in the same shapes the app stores: check-in notes,
// bedtime worries, kind things and saved lens exercises, in Chinese and English.
// Each query lists the items a person would want back: 2 = what they are looking for,
// 1 = related. Reports MRR and nDCG@5.
//   node tests/search-eval.mjs          the shipped settings
//   node tests/search-eval.mjs --grid   also a grid over k1 and b, and ablations
import { createIndex, journalDocs, JOURNAL_FIELDS, K1, B } from '../js/search.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 24);
const at = (daysAgo) => NOW - daysAgo * DAY;

const entries = [
  ['c01', 1, '今天工作壓力很大，回家只想睡覺', true],
  ['c02', 2, 'Slept badly again, kept waking up at 3am', true],
  ['c03', 3, '跟媽媽講電話講了一小時，心情好多了', true],
  ['c04', 4, '報告還是沒寫完，一直拖', true],
  ['c05', 5, 'Good run this morning, 5k along the river', false],
  ['c06', 6, '主管在會議上當眾否定我的提案', true],
  ['c07', 8, 'roommate asleep, quiet evening, read a little', true],
  ['c08', 9, '好累，什麼都不想做', true],
  ['c09', 10, 'Anxious about the presentation on Friday', false],
  ['c10', 12, '和朋友去吃火鍋，聊到很晚，很開心', true],
  ['c11', 13, 'Dad called. We talked about moving back home.', false],
  ['c12', 15, '失眠第三天，凌晨四點還醒著', true],
  ['c13', 17, 'Exam tomorrow, cannot focus at all', true],
  ['c14', 19, '下雨天，在家煮了咖哩', true],
  ['c15', 21, 'Argued with my partner about money', false],
  ['c16', 24, '今天上班被同事稱讚，有點不習慣', true],
  ['c17', 27, 'Felt lonely at the party even with people around', true],
  ['c18', 30, '去河濱散步四十分鐘，腦袋清楚一點', true],
  ['c19', 33, 'Too tired to cook, ordered noodles', true],
  ['c20', 36, '考試考完了，鬆一口氣', true],
].map(([id, ago, note, silent]) => ({ id, createdAt: at(ago), note, silent: silent || undefined, features: silent ? null : { ok: true } }));

const nights = [
  ['n01', 1, '明天要跟老闆談加薪，怕開不了口', '泡了一杯熱可可'],
  ['n02', 3, '爸媽又問什麼時候回台灣', '早一點關掉手機'],
  ['n03', 6, 'Worried the landlord will not return the deposit', 'Took a long shower'],
  ['n04', 9, '', '買了一束花給自己'],
  ['n05', 14, '覺得自己在團隊裡可有可無', '去公園走了一圈'],
  ['n06', 18, 'I keep replaying what I said in the meeting', 'Made tea and stretched'],
  ['n07', 25, '朋友沒回訊息，是不是我說錯話', '把房間整理乾淨'],
  ['n08', 31, 'Not sure I chose the right program', 'Called an old friend'],
].map(([id, ago, worry, kindness]) => ({ id, createdAt: at(ago), worry, kindness }));

const sessions = [
  ['s01', 2, 'cognitive', '報告一直拖著沒寫', ['我一定會寫得很爛', '上次的報告其實拿到不錯的評語', '先寫一段就好，不用完美']],
  ['s02', 7, 'family-systems', '爸媽一直催我回家工作', ['哥哥也被催過', '我夾在爸爸和媽媽中間', '我想先留在這裡兩年']],
  ['s03', 11, 'acceptance', 'I cannot stop worrying about the visa', ['My chest gets tight', 'I notice I am having the thought that I will be sent home', 'Walk to the library anyway']],
  ['s04', 16, 'solution-focused', '和男友遠距離，常常吵架', ['上週視訊一起煮飯那次沒吵', '大概 4 分', '約固定時間視訊']],
  ['s05', 22, 'rebt', 'I must get an A or I am a failure', ['The exam is in two weeks', 'I must not make mistakes', 'I would like an A, and a B is survivable']],
  ['s06', 28, 'narrative', '拖延症又來了', ['叫它「明天怪」', '它讓我不敢打開信箱', '上週五我有先回一封信']],
  ['s07', 34, 'person-centered', 'My grandmother passed away last month', ['Sadness, and some relief', 'I need to talk about her', 'not sure']],
].map(([id, ago, lensId, concern, answers]) => ({ id, createdAt: at(ago), lensId, concern, answers }));

// [query, { id: grade }]
const QUERIES = [
  ['工作壓力', { 'entry:c01': 2, 'worry:n01': 1, 'entry:c06': 1 }],
  ['上班', { 'entry:c16': 2, 'entry:c01': 1, 'lens:s02': 1 }],
  ['報告', { 'entry:c04': 2, 'lens:s01': 2 }],
  ['媽媽', { 'entry:c03': 2, 'lens:s02': 1, 'worry:n02': 1 }],
  ['父母', { 'worry:n02': 2, 'lens:s02': 2 }],
  ['失眠', { 'entry:c12': 2, 'entry:c02': 1 }],
  ['sleep', { 'entry:c02': 2, 'entry:c01': 1, 'entry:c12': 1 }],
  ['好累', { 'entry:c08': 2, 'entry:c19': 1 }],
  ['睡不好', { 'entry:c02': 2, 'entry:c12': 2, 'entry:c01': 1 }],
  ['exam stress', { 'entry:c13': 2, 'lens:s05': 2, 'entry:c20': 1 }],
  ['緊張', { 'entry:c09': 2, 'entry:c13': 1, 'worry:n01': 1 }],
  ['boss meeting', { 'entry:c06': 2, 'worry:n01': 2, 'worry:n06': 1 }],
  ['朋友', { 'entry:c10': 2, 'worry:n07': 2, 'kind:n08': 1 }],
  ['散步', { 'entry:c18': 2, 'kind:n05': 1, 'lens:s03': 1 }],
  ['拖延', { 'lens:s06': 2, 'lens:s01': 1, 'entry:c04': 1 }],
  ['worried visa', { 'lens:s03': 2, 'worry:n03': 1 }],
  ['男友 吵架', { 'lens:s04': 2, 'entry:c15': 1 }],
  ['家人', { 'worry:n02': 2, 'lens:s02': 2, 'entry:c03': 1, 'entry:c11': 1 }],
  ['feeling alone at night', { 'entry:c17': 2 }],
  ['認知治療', { 'lens:s01': 2 }],
];

const docs = journalDocs({ entries, nights, sessions });

function evaluate(options = {}, searchOptions = {}) {
  const ix = createIndex({ fields: JOURNAL_FIELDS, ...options });
  ix.sync(docs);
  let rr = 0;
  let ndcg = 0;
  const rows = [];
  for (const [query, rel] of QUERIES) {
    const got = ix.search(query, { now: NOW, ...searchOptions }).map((r) => r.id);
    const first = got.findIndex((id) => rel[id]);
    const dcg = got.slice(0, 5).reduce((sum, id, i) => sum + (2 ** (rel[id] || 0) - 1) / Math.log2(i + 2), 0);
    const ideal = Object.values(rel).sort((a, b) => b - a).slice(0, 5).reduce((sum, g, i) => sum + (2 ** g - 1) / Math.log2(i + 2), 0);
    rr += first === -1 ? 0 : 1 / (first + 1);
    ndcg += dcg / ideal;
    rows.push({ query, rr: first === -1 ? 0 : 1 / (first + 1), ndcg: dcg / ideal, top: got.slice(0, 5) });
  }
  return { mrr: rr / QUERIES.length, ndcg: ndcg / QUERIES.length, rows };
}

const f = (x) => x.toFixed(3);
const main = evaluate();
console.log(`${docs.length} items, ${QUERIES.length} queries, k1 = ${K1}, b = ${B}\n`);
for (const r of main.rows) console.log(`${r.query.padEnd(22)} RR ${f(r.rr)}  nDCG@5 ${f(r.ndcg)}  ${r.top.join(' ')}`);
console.log(`\nMRR ${f(main.mrr)}   nDCG@5 ${f(main.ndcg)}`);

if (process.argv.includes('--grid')) {
  console.log('\nk1 \\ b   ' + [0, 0.2, 0.4, 0.6, 0.75, 1].map((b) => String(b).padEnd(14)).join(''));
  for (const k1 of [0.6, 0.9, 1.2, 1.6, 2.0]) {
    console.log(String(k1).padEnd(9) + [0, 0.2, 0.4, 0.6, 0.75, 1].map((b) => { const e = evaluate({ k1, b }); return `${f(e.mrr)}/${f(e.ndcg)}`.padEnd(14); }).join(''));
  }
  const show = (name, e) => console.log(`${name.padEnd(28)} MRR ${f(e.mrr)}   nDCG@5 ${f(e.ndcg)}`);
  console.log('');
  show('shipped', main);
  show('no synonyms', evaluate({}, { synonyms: false }));
  show('no phrase boost', evaluate({ phraseBoost: 0 }));
  show('no recency', evaluate({ recencyWeight: 0 }));
  show('all fields weighted equally', evaluate({ fields: { text: 1, more: 1, title: 1 } }));
}

// a guard against regressions when the tokenizer or weights change
if (main.mrr < 0.85 || main.ndcg < 0.8) {
  console.log('\nFAIL: ranking quality fell below the floor (MRR 0.85, nDCG@5 0.80)');
  process.exitCode = 1;
}
