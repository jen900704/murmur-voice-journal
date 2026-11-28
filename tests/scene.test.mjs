import assert from 'node:assert/strict';
import { readScene, sceneSvg, sceneNotes, coverage } from '../js/scene.js';
import { fitText, postcardSvg } from '../js/postcard.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL', name); throw e; }
}

test('objects come from the words the person used, in order, at most three', () => {
  const s = readScene({ texts: ['考試快到了，我每天熬夜喝咖啡，手機一直響'], topics: ['self'] });
  assert.deepEqual(s.objects, ['book', 'bed', 'coffee']);
  assert.equal(s.evidence[0].word, '考試');
});
test('english words match whole words only', () => {
  const s = readScene({ texts: ['This category of work is a lot'], topics: ['work'] });
  assert.ok(!s.objects.includes('cat'));
  assert.ok(s.objects.includes('laptop'));
});
test('a pet the person names becomes the companion', () => {
  const s = readScene({ texts: ['回家只有我的貓陪我'], topics: ['family'] });
  assert.equal(s.companion, 'cat');
});
test('the kind of feeling picks the weather: sad rain, worried wind, tired fog, angry dusk, light sun', () => {
  assert.equal(readScene({ texts: ['好累好焦慮壓力好大'] }).weather, 'wind');
  assert.equal(readScene({ texts: ['很難過，一直哭，好寂寞'] }).weather, 'rain');
  assert.equal(readScene({ texts: ['好累，熬夜好幾天'] }).weather, 'fog');
  assert.equal(readScene({ texts: ['他這樣真的很不公平，我很生氣'] }).weather, 'dusk');
  assert.equal(readScene({ texts: ['I feel so lonely'] }).weather, 'cloudy');
  assert.equal(readScene({ texts: ['今天很開心也很放鬆'] }).weather, 'sunny');
  assert.equal(readScene({ texts: ['有點累但也很期待'] }).weather, 'mixed');
});
test('feeling lighter afterward opens the sky', () => {
  assert.equal(readScene({ texts: ['好累好焦慮壓力好大'], shift: -2 }).clearing, true);
  assert.ok(sceneSvg(readScene({ texts: ['好焦慮'], shift: -1 }), { animate: true }).includes('-wind{animation'));
  assert.ok(!readScene({ texts: ['好累好焦慮壓力好大'], shift: 1 }).clearing);
});
test('risky text is never drawn from', () => {
  const s = readScene({ texts: ['我的貓很可愛但我不想活了'], topics: ['self'] });
  assert.equal(s.calm, true);
  assert.deepEqual(s.objects, []);
  assert.equal(s.evidence.length, 0);
  assert.match(sceneNotes(s, 'zh')[0], /沒有從你寫的內容取材/);
});
test('notes explain each element with the source word', () => {
  const s = readScene({ texts: ['主管一直傳訊息給我'], topics: ['work'], lensId: 'narrative' });
  const notes = sceneNotes(s, 'zh');
  assert.ok(notes.some((n) => n.includes('「主管」')));
  assert.equal(s.lensGlyph, 'book');
});
test('svg is well formed, escapes text, animation only when asked', () => {
  const s = readScene({ texts: ['下雨天和貓'], topics: ['other'], lensId: 'acceptance' });
  const still = sceneSvg(s, { line: 'a < b & "c"', label: 'ACT', fitText });
  assert.ok(still.startsWith('<svg') && still.trim().endsWith('</svg>'));
  assert.ok(still.includes('a &lt; b &amp; &quot;c&quot;'));
  assert.ok(!still.includes('@keyframes'));
  const moving = sceneSvg(s, { line: 'x', animate: true, fitText });
  assert.ok(moving.includes('prefers-reduced-motion: no-preference'));
});
test('every object the scene can read has a drawing and a name in both languages', () => {
  for (const c of coverage()) assert.ok(c.drawn && c.zh && c.en, c.el);
});
test('no NaN or undefined in any drawing', () => {
  const s = readScene({ texts: ['朋友約我出國旅行，房租還沒繳，只想打電動，貓在睡'], topics: ['self'] });
  for (const animate of [false, true]) assert.ok(!/NaN|undefined/.test(sceneSvg(s, { animate })));
  for (const c of coverage()) {
    for (const weather of ['rain', 'wind', 'fog', 'dusk', 'mixed', 'sunny', 'clear', 'night', 'cloudy']) {
      const svg = sceneSvg({ ...s, objects: [c.el, c.el, c.el], weather, lensGlyph: 'book' }, { animate: true });
      assert.ok(!/NaN|undefined/.test(svg), c.el + ' ' + weather);
    }
  }
});
test('cards are flat: no gradients, filters, shadows or rounded card corners, and the line is set in Murmur Black', () => {
  const s = readScene({ texts: ['報告一直拖著，我好焦慮'], topics: ['work'] });
  for (const svg of [sceneSvg(s, { line: '先寫標題就好', label: '認知取向', date: '2026.11.24', animate: true, fitText }), postcardSvg({ seed: 'n1', line: '晚安', label: '晚安', date: '2026.11.24' })]) {
    assert.ok(!/Gradient|<filter|opacity=|drop-shadow|<image/.test(svg));
    assert.ok(svg.includes("font-family=\"'Murmur Black'"));
    assert.ok(svg.includes('2026.11.24 · Murmur'));
  }
  // every weather keeps to the 丙 colours
  // plus the flat paper speck of the card's grain
  const allowed = ['#151515', '#FFFFFF', '#5C5A55', '#0E7C66', '#EA4B2D', '#F2B91D', '#F4A7B9', '#12173A', '#ECE7DB'];
  for (const weather of ['rain', 'wind', 'fog', 'dusk', 'mixed', 'sunny', 'clear', 'night', 'cloudy']) {
    const svg = sceneSvg({ ...s, weather, objects: ['sea', 'bed', 'bike'], companion: 'dog' }, { fitText });
    for (const c of svg.match(/#[0-9A-Fa-f]{6}/g)) assert.ok(allowed.includes(c), weather + ' ' + c);
  }
});
test('a 120-character line is shown whole, and a short one is set large', () => {
  const zh = Array.from({ length: 118 }, (_, i) => '一二三四五六七八九十'[i % 10]).join('') + '結尾';
  const en = ('kind words to myself tonight '.repeat(5)).slice(0, 117) + 'end';
  for (const t of [zh, en]) {
    const f = fitText(t);
    assert.ok(f.lines.length <= f.maxLines && !f.lines.join('').includes('…'), t.slice(0, 8));
    assert.ok(f.lines[f.lines.length - 1].endsWith(t.slice(-2)));
    assert.ok(30 + f.size * 0.9 + (f.lines.length - 1) * f.lh < 310);
  }
  assert.equal(fitText('先寫標題就好').size, 44);
  assert.ok(postcardSvg({ seed: 'x', line: zh, label: '晚安', date: '' }).includes('結尾'));
});
console.log(`scene: ${passed} passed`);

const { suggestLenses, heavinessShift, onlyHere, relatedSessions, selfFocus, CUES } = await import('../js/lens-insight.js');
const { LENSES } = await import('../js/lenses.js');
test('every lens has cue words, and cue ids match the lenses', () => {
  assert.deepEqual(Object.keys(CUES).sort(), LENSES.map((l) => l.id).sort());
});
test('suggestions point to the words that matched', () => {
  const s = suggestLenses('我一直想停不下來，覺得我應該做得更好，每次都搞砸');
  assert.ok(s.length >= 2);
  const ids = s.map((x) => x.id);
  assert.ok(ids.includes('acceptance'));
  for (const x of s) for (const e of x.evidence) assert.ok(x.id && e.match.length > 0);
});
test('no cue, no suggestion; risky text, no suggestion; topic filter respected', () => {
  assert.deepEqual(suggestLenses('今天天氣普通'), []);
  assert.deepEqual(suggestLenses('我一直想，不想活了'), []);
  assert.ok(suggestLenses('我媽一直念我', { allowed: ['cognitive'] }).every((x) => x.id === 'cognitive'));
});
test('english cues need a word start', () => {
  assert.ok(!suggestLenses('the household budget').some((x) => x.id === 'rebt'));
});
test('shift and what only one lens noticed', () => {
  assert.equal(heavinessShift(7, 5).direction, 'lighter');
  assert.equal(heavinessShift(null, 5), null);
  const only = onlyHere(['我其實很想被主管看見', '報告寫不完'], ['報告寫不完好累']);
  assert.equal(only.length, 1);
  assert.equal(only[0].i, 0);
});
test('related sessions by overlap; self focus drops after distancing', () => {
  const r = relatedSessions('主管又在會議上念我', [{ id: 1, concern: '主管在會議上當眾念我' }, { id: 2, concern: '週末想去海邊' }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].session.id, 1);
  const a = selfFocus('I think I messed up and I feel like my boss hates me');
  const b = selfFocus('Jen thinks she messed up and feels like her boss is upset with her');
  assert.ok(a > b);
});
console.log(`scene + insight: ${passed} passed`);
