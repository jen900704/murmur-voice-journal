// Unit tests for the pure helpers in js/writing.js.
// Run with: node tests/writing.test.mjs
import assert from 'node:assert/strict';
import * as W from '../js/writing.js';

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

// local times, so the tests do not depend on the machine's time zone
const at = (y, m, d, hh = 12) => new Date(y, m - 1, d, hh).getTime();
const NOW = at(2026, 11, 24, 15);
const deepId = 'd-alone';
const saved = (promptId, when, lang = 'zh-TW') => W.buildEntry({ text: 'x', promptId, lang, now: when, id: `e-${promptId}-${when}` });

test('prompts: three weights, 4 to 6 each, both languages, unique ids, no em dashes', () => {
  assert.deepEqual(W.WEIGHTS, ['light', 'middle', 'deep']);
  const ids = new Set();
  for (const w of W.WEIGHTS) {
    for (const lang of ['zh-TW', 'en']) {
      const list = W.promptsFor(w, lang);
      assert.ok(list.length >= 4 && list.length <= 6, `${w} ${lang} has ${list.length}`);
      for (const p of list) {
        assert.ok(p.text && p.text.length <= 300, `${p.id} fits the stored prompt length`);
        assert.ok(!/[—–]|--/.test(p.text), `${p.id} has no dash`);
        ids.add(p.id);
      }
    }
  }
  assert.equal(ids.size, W.WEIGHTS.reduce((n, w) => n + W.PROMPTS[w].length, 0));
  assert.ok(W.promptsFor('light', 'zh-TW').concat(W.promptsFor('middle', 'zh-TW')).some((p) => p.text.includes('我注意到我有一個想法：')));
});

test('day count: first day is 1', () => {
  assert.equal(W.dayCount([], deepId, NOW), 1);
  assert.equal(W.dayCount(null, deepId, NOW), 1);
});

test('day count: one earlier day makes it day 2, two earlier days day 3', () => {
  assert.equal(W.dayCount([saved(deepId, at(2026, 11, 23, 22))], deepId, NOW), 2);
  assert.equal(W.dayCount([saved(deepId, at(2026, 11, 22)), saved(deepId, at(2026, 11, 23))], deepId, NOW), 3);
});

test('day count: several saves on one day count once, and today does not count', () => {
  const list = [saved(deepId, at(2026, 11, 23, 9)), saved(deepId, at(2026, 11, 23, 21)), saved(deepId, at(2026, 11, 24, 8))];
  assert.equal(W.dayCount(list, deepId, NOW), 2);
  assert.equal(W.dayCount([saved(deepId, at(2026, 11, 24, 1))], deepId, NOW), 1);
});

test('day count: a skipped day changes nothing, and days more than a week back start over', () => {
  assert.equal(W.dayCount([saved(deepId, at(2026, 11, 20)), saved(deepId, at(2026, 11, 22))], deepId, NOW), 3);
  assert.equal(W.dayCount([saved(deepId, at(2026, 11, 17))], deepId, NOW), 2);
  assert.equal(W.dayCount([saved(deepId, at(2026, 11, 16))], deepId, NOW), 1);
});

test('day count: other prompts, light prompts, demo entries and mood check-ins are not counted', () => {
  const y = at(2026, 11, 23);
  assert.equal(W.dayCount([saved('d-unsaid', y)], deepId, NOW), 1);
  assert.equal(W.dayCount([saved('l-body', y)], 'l-body', NOW), 1);
  assert.equal(W.dayCount([{ ...saved(deepId, y), demo: true }], deepId, NOW), 1);
  assert.equal(W.dayCount([{ id: 'c', createdAt: y, silent: true, prompt: '', mood: 2, note: '', features: null }], deepId, NOW), 1);
  assert.equal(W.dayCount([{ ...saved(deepId, y), silent: undefined, features: { ok: true } }], deepId, NOW), 1);
});

test('day count: still works after a backup dropped the writing field, and across languages', () => {
  const e = saved(deepId, at(2026, 11, 23), 'en');
  delete e.writing;
  assert.equal(W.writingPromptId(e), deepId);
  assert.equal(W.dayCount([e], deepId, NOW), 2);
  assert.equal(W.isWritingEntry({ silent: true, prompt: '', note: 'hi' }), false);
});

test('save decision: empty, save, and help first for risk wording', () => {
  assert.equal(W.saveDecision(''), 'empty');
  assert.equal(W.saveDecision('   \n '), 'empty');
  assert.equal(W.saveDecision('今天寫了那年冬天的事。'), 'save');
  assert.equal(W.saveDecision('那時候我真的不想活了'), 'help');
  assert.equal(W.saveDecision('some nights I just want to die'), 'help');
});

test('save decision: help is shown once per text; a changed text is checked again', () => {
  const risky = '那時候我真的不想活了';
  assert.equal(W.saveDecision(risky, risky), 'save');
  assert.equal(W.saveDecision(`  ${risky}  `, risky), 'save');
  assert.equal(W.saveDecision(risky + '，現在也是', risky), 'help');
});

test('note cap: trims, cuts at the limit, and does not split an emoji', () => {
  assert.equal(W.capNote('  hi  '), 'hi');
  assert.equal(W.capNote('字'.repeat(5000)).length, W.NOTE_MAX);
  assert.equal(W.capNote('a'.repeat(10), 4), 'aaaa');
  assert.equal(W.capNote('aaa😀', 4), 'aaa');
  assert.equal(W.capNote(null), '');
  assert.ok(W.BODY_MAX < W.NOTE_MAX);
});

test('entry shape: a silent check-in with the prompt text and the capped note', () => {
  const e = W.buildEntry({ text: ' ' + '寫'.repeat(5000), promptId: deepId, lang: 'zh-TW', now: NOW, id: 'abc' });
  assert.equal(e.id, 'abc');
  assert.equal(e.createdAt, NOW);
  assert.equal(e.silent, true);
  assert.equal(e.features, null);
  assert.equal(e.hasAudio, false);
  assert.equal(e.mood, null);
  assert.equal(e.energy, null);
  assert.equal(e.featureVersion, 0);
  assert.equal(e.lang, 'zh-TW');
  assert.equal(e.prompt, W.promptsFor('deep', 'zh-TW')[0].text);
  assert.equal(e.note.length, W.BODY_MAX);
  assert.deepEqual(e.writing, { weight: 'deep', promptId: deepId });
});

test('closing lines: added under the text, empty ones left out, whole note within the cap', () => {
  assert.equal(W.closingBlock({ cared: ['', ' '], line: '' }, 'zh-TW'), '');
  assert.equal(W.withClosing('正文', { cared: [], line: '' }, 'zh-TW'), '正文');
  const note = W.withClosing('正文', { cared: ['同事幫我留了便當', '', '洗了熱水澡'], line: '今天這樣可以了' }, 'zh-TW');
  assert.equal(note, '正文\n\n收尾：\n今天被照顧到的小地方：\n- 同事幫我留了便當\n- 洗了熱水澡\n給自己的一句話：今天這樣可以了');
  assert.ok(W.withClosing('body', { cared: ['tea'], line: 'rest now' }, 'en').endsWith('One line to myself: rest now'));
  const long = 'x'.repeat(W.CLOSING_LINE_MAX + 50);
  const full = W.withClosing('字'.repeat(W.BODY_MAX), { cared: [long, long, long], line: long }, 'en');
  assert.ok(full.length <= W.NOTE_MAX);
  assert.ok(full.endsWith('x'.repeat(W.CLOSING_LINE_MAX)), 'the last closing line is kept whole');
});

console.log(`\n${passed} passed`);
