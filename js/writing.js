// Writing mode: prompts by weight (light, middle, deep). Light and middle prompts come from
// acceptance and commitment therapy and self-compassion work (values, stepping back from a
// thought, the letter to a friend). Deep prompts follow Pennebaker's expressive-writing
// procedure: about 15 minutes on one hard topic, the same topic again on three or four days.
// Deep writing can leave a person heavier for a while, so it has a note before it and a short
// closing after it. This is a writing aid, not treatment.
//
// A saved text is a normal Murmur entry in the silent check-in shape (silent: true,
// features: null), with the prompt text in `prompt` and the writing in `note`.
import { checkRisk, helpList } from './safety.js';

export const NOTE_MAX = 4000; // the whole stored note
export const BODY_MAX = 3600; // the writing itself; the rest is room for the closing lines
export const CLOSING_LINE_MAX = 80;
export const TIMER_MS = 15 * 60 * 1000;
export const WEIGHTS = ['light', 'middle', 'deep'];
const DAY_WINDOW = 7; // earlier days further back than this start a new count
const DAYS_USUAL = 4; // the procedure is three or four days

export const PROMPTS = {
  light: [
    { id: 'l-body', zh: '現在身體哪裡最有感覺？寫下位置和感覺就好，不用解釋原因。', en: 'Where in your body do you feel the most right now? Write down the place and the feeling. No need to explain why.' },
    { id: 'l-defuse', zh: '寫下腦中現在最常出現的一句話。接著在前面加上「我注意到我有一個想法：」，再寫一次。', en: 'Write down the sentence your mind keeps repeating right now. Then write it again, starting with "I notice I am having the thought that".' },
    { id: 'l-value', zh: '今天有沒有哪一小段時間，你做的事和你在乎的事有一點關係？很小的也算。', en: 'Was there a small stretch of today when what you were doing had something to do with what you care about? Small counts.' },
    { id: 'l-kind', zh: '如果現在對自己說一句不帶要求的話，會是哪一句？', en: 'If you said one sentence to yourself right now that asks nothing of you, what would it be?' },
    { id: 'l-enough', zh: '今天哪一件事，可以算是「這樣就夠了」？', en: 'What is one thing from today that can count as "that was enough"?' },
  ],
  middle: [
    { id: 'm-friend', zh: '想一件最近讓你責怪自己的事。如果是一個好朋友遇到一樣的事，你會寫什麼給他？寫完後，把稱呼換成自己的名字，再讀一遍。', en: 'Think of something you have blamed yourself for lately. If a close friend were in the same spot, what would you write to them? When you finish, read it again with your own name in it.' },
    { id: 'm-values', zh: '先不管別人的期待。你希望自己怎麼對待別人、怎麼對待自己？選一個方向，寫下這星期做得到的一個很小的動作。', en: 'Set other people\'s expectations aside for now. How do you want to treat others, and yourself? Pick one direction and write one very small thing you could do this week.' },
    { id: 'm-defuse', zh: '有沒有一個關於自己的老說法，例如「我就是不夠好」？寫下它，再用「我注意到我有一個想法：」開頭重寫一次。這個想法通常什麼時候出現？它想讓你避開什麼？', en: 'Is there an old line about yourself, such as "I am just not good enough"? Write it down, then rewrite it starting with "I notice I am having the thought that". When does this thought usually show up? What is it trying to keep you away from?' },
    { id: 'm-common', zh: '你現在辛苦的這件事，別人也可能遇到。寫下你猜他們會有的感覺，再寫下你自己的。', en: 'Other people may be going through the thing that is hard for you now. Write what you guess they feel, then what you feel.' },
    { id: 'm-room', zh: '有沒有一個你一直想趕走的感覺？寫下它在身體的哪裡、多大、像什麼。如果先不趕它，讓它待五分鐘，會怎麼樣？', en: 'Is there a feeling you keep trying to push away? Write where it sits in your body, how big it is, what it is like. What happens if you let it stay for five minutes without pushing?' },
  ],
  deep: [
    { id: 'd-alone', zh: '寫一段你一個人撐過來、最辛苦的日子。那時候發生了什麼，你當時怎麼想、有什麼感覺，現在回頭看又是什麼。', en: 'Write about the hardest stretch you carried alone. What happened, what you thought and felt then, and how it looks from here.' },
    { id: 'd-unsaid', zh: '有些話你一直沒有機會說出口。寫給那個人，這封信不會寄出。寫下發生的事，和你最深的感覺。', en: 'There are words you never got to say. Write them to that person; this letter is not sent. Write what happened and what you feel most deeply about it.' },
    { id: 'd-deserve', zh: '「我要夠努力，才值得被照顧」這個想法，最早是從哪裡來的？寫下你記得的場景、當時的感覺，還有它到現在怎麼影響你。', en: 'Where did "I must work hard to deserve care" first come from? Write the scenes you remember, how they felt, and how the idea still shapes what you do.' },
    { id: 'd-secret', zh: '有一件事你很少對人提起，但到現在還會影響你。寫下這件事，和你對它最深的想法和感覺。', en: 'There is something you rarely tell anyone that still affects you. Write about it, and your deepest thoughts and feelings about it.' },
    { id: 'd-change', zh: '寫一個把生活分成「之前」和「之後」的轉變。失去了什麼，留下了什麼，到現在還在想的是什麼。', en: 'Write about a change that split your life into before and after. What was lost, what stayed, and what you still think about.' },
  ],
};

const T = {
  'zh-TW': {
    title: '寫一寫',
    intro: '選一個重量，選一題，用打字的。寫下的字只在這個裝置上，按「存起來」才會進日記。',
    tabsLabel: '題目的重量',
    weights: { light: '輕', middle: '中', deep: '重' },
    pick: '選一題',
    deepNoteTitle: '寫重的題目之前',
    deepNote: ['挑一個有 15 分鐘的時間，寫完之後留一點空檔，做點平靜的事。', '連續寫，不用管錯字、文法和順序。', '如果寫到覺得太多，就停下來。停在哪裡都可以。', '同一個主題，接下來幾天可以再回來寫，通常寫三到四天。', '寫完的當下心情可能會沉一點，許多人是這樣，通常過一陣子會淡下來。'],
    deepNotTherapy: '這是寫作練習，不是治療。如果事情才剛發生，或你現在很不穩，今天不寫也可以。',
    deepLate: '現在比較晚了。重的題目留到白天或傍晚寫，會比睡前合適。',
    helpLink: '可以找人說話的地方',
    placeholder: '從哪裡開始都可以……',
    textLabel: '你寫的內容',
    count: (n, max) => `${n} / ${max} 字`,
    day: (n) => `第 ${n} 天`,
    dayEnough: '這個主題已經寫了幾天。這個做法通常寫三到四天，之後可以先放著。',
    timerStart: '計時 15 分鐘（可不用）',
    timerStop: '停止計時',
    timerRunning: '計時中。15 分鐘到的時候，這裡會出現一行字，沒有聲音。',
    timerDone: '15 分鐘到了。可以停在這裡，也可以把這一句寫完。',
    save: '存起來',
    copy: '複製文字',
    copied: '已複製',
    copyFailed: '沒有複製成功，可以長按文字自己複製。',
    discard: '不存，寫到這裡',
    saved: '存好了，在日記裡。',
    saveFailed: '沒有存成功，草稿還在這裡。',
    empty: '還沒有寫字。',
    helpTitle: '想先讓你知道這些',
    helpBody: '你寫的內容裡，有些字詞可能代表你現在很辛苦。草稿還在，沒有被刪掉。如果想找人說話，這些地方隨時都在。',
    helpSave: '照原樣存起來',
    helpBack: '回去繼續寫',
    closeTitle: '收尾',
    closeIntro: '寫完重的題目，先把注意力帶回今天。',
    closeThree: '寫下今天三個被照顧到的小地方。別人做的、自己做的、剛好發生的都算。',
    closeItem: (i) => `第 ${i} 個`,
    closeLine: '最後，寫一句話給自己。',
    closeLineLabel: '給自己的一句話',
    closeKeep: '把這幾行也存進去',
    closeSkip: '這樣就好',
    closeNotKept: '這幾行不會存，寫完就留在這裡。',
    closingHead: '收尾：',
    closingCared: '今天被照顧到的小地方：',
    closingSelf: '給自己的一句話：',
    doneTitle: '寫到這裡',
    doneSaved: '這篇存在日記裡了。',
    doneUnsaved: '這篇沒有存。',
    doneDeep: '接下來做點平靜的事：喝點水、洗把臉，或走幾步。',
    again: '再寫一題',
  },
  en: {
    title: 'Write it out',
    intro: 'Pick a weight, pick a prompt, and type. What you write stays on this device, and goes into the journal only when you tap Save.',
    tabsLabel: 'Prompt weight',
    weights: { light: 'Light', middle: 'Middle', deep: 'Deep' },
    pick: 'Pick a prompt',
    deepNoteTitle: 'Before a deep prompt',
    deepNote: ['Choose a time when you have 15 minutes, with room afterward for something calm.', 'Write without stopping. Spelling, grammar, and order do not matter.', 'If it becomes too much, stop. Anywhere is a fine place to stop.', 'You can come back to the same topic on the next days. Three or four days is usual.', 'Right after writing, your mood may dip. That is common, and it usually fades after a while.'],
    deepNotTherapy: 'This is a writing exercise, not treatment. If the event is very recent, or you feel unsteady right now, it is fine to skip it today.',
    deepLate: 'It is late. Deep prompts fit daytime or early evening better than the hour before sleep.',
    helpLink: 'Where to find someone to talk to',
    placeholder: 'Start anywhere…',
    textLabel: 'Your writing',
    count: (n, max) => `${n} / ${max} characters`,
    day: (n) => `Day ${n}`,
    dayEnough: 'You have written on this topic for several days. Three or four days is the usual length, and after that it can rest.',
    timerStart: 'Time 15 minutes (optional)',
    timerStop: 'Stop the timer',
    timerRunning: 'Timing. When 15 minutes have passed, a line appears here. There is no sound.',
    timerDone: '15 minutes have passed. You can stop here, or finish the sentence.',
    save: 'Save',
    copy: 'Copy text',
    copied: 'Copied',
    copyFailed: 'Copying did not work. You can select the text and copy it yourself.',
    discard: 'Stop here without saving',
    saved: 'Saved to the journal.',
    saveFailed: 'Saving did not work. Your draft is still here.',
    empty: 'Nothing written yet.',
    helpTitle: 'Before you go on',
    helpBody: 'Some words in your writing can mean things are very hard right now. Your draft is still here; nothing was deleted. If you want to talk to someone, these are always available.',
    helpSave: 'Save it as it is',
    helpBack: 'Go back to writing',
    closeTitle: 'Closing',
    closeIntro: 'After a deep prompt, bring your attention back to today.',
    closeThree: 'Write three small ways you were cared for today. By someone else, by yourself, or by chance all count.',
    closeItem: (i) => `Number ${i}`,
    closeLine: 'Last, write one line to yourself.',
    closeLineLabel: 'One line to yourself',
    closeKeep: 'Keep these lines with the entry',
    closeSkip: 'That is enough',
    closeNotKept: 'These lines are not saved. They stay here until you close this page.',
    closingHead: 'Closing:',
    closingCared: 'Small ways I was cared for today:',
    closingSelf: 'One line to myself:',
    doneTitle: 'Done for now',
    doneSaved: 'This is saved in the journal.',
    doneUnsaved: 'This was not saved.',
    doneDeep: 'Next, do something calm: drink some water, wash your face, or walk a few steps.',
    again: 'Write another',
  },
};

// ---------- pure helpers (tests/writing.test.mjs) ----------

const langKey = (lang) => (lang === 'en' ? 'en' : 'zh');

export function promptsFor(weight, lang) {
  return (PROMPTS[weight] || []).map((p) => ({ id: p.id, text: p[langKey(lang)] }));
}

function findPrompt(id) {
  for (const weight of WEIGHTS) {
    const p = PROMPTS[weight].find((x) => x.id === id);
    if (p) return { weight, prompt: p };
  }
  return null;
}

// Cuts by code point, so an emoji at the limit is not split in half.
export function capNote(text, max = NOTE_MAX) {
  const s = String(text ?? '').trim();
  if (s.length <= max) return s;
  let out = '';
  for (const ch of s) {
    if (out.length + ch.length > max) break;
    out += ch;
  }
  return out.trimEnd();
}

// Which writing prompt an entry answered, or null. The id travels in entry.writing, and the
// prompt text is checked too, because a backup keeps `prompt` but drops fields it does not know.
export function writingPromptId(entry) {
  if (!entry || entry.silent !== true) return null;
  const id = entry.writing && entry.writing.promptId;
  if (typeof id === 'string' && findPrompt(id)) return id;
  if (typeof entry.prompt !== 'string' || !entry.prompt) return null;
  for (const weight of WEIGHTS) {
    const p = PROMPTS[weight].find((x) => x.zh === entry.prompt || x.en === entry.prompt);
    if (p) return p.id;
  }
  return null;
}

export function isWritingEntry(entry) {
  return writingPromptId(entry) !== null;
}

// Local calendar day as a whole number, so "an earlier day" follows the person's own midnight.
export function localDay(ts) {
  const d = new Date(ts);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

// Day number for a deep prompt: 1 on the first day, 2 if it was saved on one earlier day, and
// so on. Only days in the last week count, and several saves on one day count once. This is a
// plain count of days written, not a streak: a skipped day changes nothing.
export function dayCount(entries, promptId, now = Date.now()) {
  const found = findPrompt(promptId);
  if (!found || found.weight !== 'deep') return 1;
  const today = localDay(now);
  const days = new Set();
  for (const e of entries || []) {
    if (!e || e.demo || !Number.isFinite(e.createdAt) || writingPromptId(e) !== promptId) continue;
    const d = localDay(e.createdAt);
    if (d < today && today - d <= DAY_WINDOW) days.add(d);
  }
  return days.size + 1;
}

// What a tap on Save does: nothing for an empty text, help lines first when the text matches
// risk wording (once per text, so the second tap saves), otherwise save.
export function saveDecision(text, helpShownFor = null) {
  const body = capNote(text, BODY_MAX);
  if (!body) return 'empty';
  if (checkRisk(body).risk && helpShownFor !== body) return 'help';
  return 'save';
}

export function closingBlock({ cared = [], line = '' } = {}, lang = 'zh-TW') {
  const L = T[lang] || T.en;
  const items = cared.map((c) => capNote(c, CLOSING_LINE_MAX)).filter(Boolean);
  const self = capNote(line, CLOSING_LINE_MAX);
  if (!items.length && !self) return '';
  const out = [L.closingHead];
  if (items.length) out.push(L.closingCared, ...items.map((c) => `- ${c}`));
  if (self) out.push(`${L.closingSelf}${lang === 'en' ? ' ' : ''}${self}`);
  return out.join('\n');
}

export function withClosing(note, closing, lang) {
  const block = closingBlock(closing, lang);
  return block ? capNote(`${capNote(note, BODY_MAX)}\n\n${block}`, NOTE_MAX) : capNote(note, NOTE_MAX);
}

function newId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function buildEntry({ text, promptId, lang, now = Date.now(), id = newId() }) {
  const found = findPrompt(promptId);
  return {
    id,
    createdAt: now,
    prompt: found ? found.prompt[langKey(lang)] : '',
    lang,
    mood: null,
    energy: null,
    note: capNote(text, BODY_MAX),
    features: null,
    featureVersion: 0,
    capture: null,
    hasAudio: false,
    silent: true,
    writing: found ? { weight: found.weight, promptId } : undefined,
  };
}

// ---------- the sheet ----------

function ensureCss() {
  if (typeof document === 'undefined' || document.querySelector('link[data-writing-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../css/writing.css', import.meta.url).href;
  link.setAttribute('data-writing-css', '');
  document.head.appendChild(link);
}

// Drafts live in memory for as long as the page is open, so closing the sheet by accident
// does not lose the text. They are never written to storage unless the person taps Save.
const mem = { weight: 'light', promptId: null, drafts: new Map(), timerStart: null, timerDone: false };

export function resetWritingMemory() {
  Object.assign(mem, { weight: 'light', promptId: null, timerStart: null, timerDone: false });
  mem.drafts.clear();
}

// Returns a function for openSheet. onSaved(entry) is called once after the entry is stored;
// if the closing lines are added later, the same entry object is updated in place, stored with
// db.updateEntry, and passed to onUpdated when one is given.
export function writingSheet({ h, getLang, db, toast, onSaved, onUpdated }) {
  ensureCss();
  const L = () => T[getLang()] || T.en;
  const st = { stage: 'write', entries: null, helpShownFor: null, saved: null, wasDeep: false, busy: false, closing: { cared: ['', '', ''], line: '' }, renders: 0 };
  let dayNode = null;

  const draft = () => mem.drafts.get(mem.promptId) || '';
  const say = (msg) => toast && toast(msg);

  function fillDay() {
    if (!dayNode) return;
    const n = mem.weight === 'deep' && mem.promptId && st.entries ? dayCount(st.entries, mem.promptId) : 1;
    dayNode.replaceChildren();
    dayNode.hidden = n < 2;
    if (n < 2) return;
    dayNode.append(h('span', { class: 'writing-day-n', 'data-key': 'writing-day' }, L().day(n)));
    if (n > DAYS_USUAL) dayNode.append(h('span', { class: 'muted small' }, ' ', L().dayEnough));
  }

  // earlier entries are only needed for the day count; the sheet works without them
  Promise.resolve()
    .then(() => db.listEntries())
    .then((list) => {
      st.entries = Array.isArray(list) ? list : [];
      fillDay();
    })
    .catch(() => {
      st.entries = [];
    });

  async function store(rerender) {
    if (st.busy) return;
    st.busy = true;
    const deep = mem.weight === 'deep';
    const entry = buildEntry({ text: draft(), promptId: mem.promptId, lang: getLang() });
    try {
      await db.saveEntry(entry, null);
    } catch (_) {
      st.busy = false;
      say(L().saveFailed);
      if (st.stage !== 'write') {
        st.stage = 'write';
        rerender();
      }
      return;
    }
    st.busy = false;
    mem.drafts.delete(mem.promptId);
    mem.timerStart = null;
    mem.timerDone = false;
    if (st.entries) st.entries.push(entry);
    st.saved = entry;
    st.wasDeep = deep;
    st.stage = deep ? 'closing' : 'done';
    say(L().saved);
    if (onSaved) onSaved(entry);
    rerender();
  }

  function trySave(rerender) {
    const text = capNote(draft(), BODY_MAX);
    const what = saveDecision(text, st.helpShownFor);
    if (what === 'empty') return say(L().empty);
    if (what === 'help') {
      st.helpShownFor = text;
      st.stage = 'help';
      // only the time is kept, so that nothing is tried out or learned from for a while
      import('./policy.js').then((mod) => mod.createPolicyStore(db).noteRisk()).catch(() => {});
      return rerender();
    }
    return store(rerender);
  }

  async function copy() {
    const text = draft();
    if (!text.trim()) return say(L().empty);
    try {
      await navigator.clipboard.writeText(text);
      say(L().copied);
    } catch (_) {
      say(L().copyFailed);
    }
  }

  // ----- stages -----

  function helpStage(rerender) {
    return [
      h('h2', {}, L().helpTitle),
      h('p', {}, L().helpBody),
      helpList(h, getLang()),
      h(
        'div',
        { class: 'actions left wrap writing-actions' },
        h('button', { type: 'button', class: 'btn', 'data-key': 'writing-help-back', onclick: () => ((st.stage = 'write'), rerender()) }, L().helpBack),
        h('button', { type: 'button', class: 'btn ghost', 'data-key': 'writing-help-save', onclick: () => store(rerender) }, L().helpSave)
      ),
    ];
  }

  function closingStage(rerender) {
    const c = st.closing;
    const field = (key, label, value, set) => {
      const input = h('input', { type: 'text', class: 'writing-input', maxlength: String(CLOSING_LINE_MAX), 'aria-label': label, placeholder: label, 'data-key': key, oninput: (e) => set(e.target.value) });
      input.value = value;
      return input;
    };
    const finish = () => {
      st.stage = 'done';
      rerender();
    };
    const keep = async () => {
      const entry = st.saved;
      const block = closingBlock(c, getLang());
      if (!entry || !block) return finish();
      // help first here too, once, if these lines carry risk wording
      if (checkRisk(block).risk && st.helpShownFor !== block) {
        st.helpShownFor = block;
        st.closingHelp = true;
        return rerender();
      }
      const before = entry.note;
      entry.note = withClosing(before, c, getLang());
      try {
        await (db.updateEntry ? db.updateEntry(entry) : db.saveEntry(entry, null));
      } catch (_) {
        entry.note = before;
        return say(L().saveFailed);
      }
      if (onUpdated) onUpdated(entry);
      finish();
    };
    return [
      h('h2', {}, L().closeTitle),
      h('p', {}, L().closeIntro),
      h('p', { class: 'writing-label', id: 'writing-cared' }, L().closeThree),
      h('div', { class: 'writing-fields', role: 'group', 'aria-labelledby': 'writing-cared' }, c.cared.map((v, i) => field(`writing-cared-${i + 1}`, L().closeItem(i + 1), v, (x) => (c.cared[i] = x)))),
      h('p', { class: 'writing-label' }, L().closeLine),
      field('writing-self-line', L().closeLineLabel, c.line, (x) => (c.line = x)),
      st.saved ? null : h('p', { class: 'muted small' }, L().closeNotKept),
      st.closingHelp ? h('div', { class: 'writing-note', role: 'note' }, h('p', { class: 'small' }, L().helpBody), helpList(h, getLang())) : null,
      h(
        'div',
        { class: 'actions left wrap writing-actions' },
        st.saved ? h('button', { type: 'button', class: 'btn primary', 'data-key': 'writing-closing-keep', onclick: keep }, L().closeKeep) : null,
        h('button', { type: 'button', class: st.saved ? 'btn ghost' : 'btn primary', 'data-key': 'writing-closing-done', onclick: finish }, L().closeSkip)
      ),
    ];
  }

  function doneStage(rerender) {
    return [
      h('h2', {}, L().doneTitle),
      h('p', { 'data-key': 'writing-done-line' }, st.saved ? L().doneSaved : L().doneUnsaved),
      st.wasDeep ? h('p', {}, L().doneDeep) : null,
      h(
        'div',
        { class: 'actions left' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn',
            'data-key': 'writing-again',
            onclick: () => {
              Object.assign(st, { stage: 'write', saved: null, wasDeep: false, helpShownFor: null, closingHelp: false, closing: { cared: ['', '', ''], line: '' } });
              mem.promptId = null;
              mem.weight = 'light';
              rerender();
            },
          },
          L().again
        )
      ),
    ];
  }

  function deepNote() {
    const hour = new Date().getHours();
    const late = hour >= 21 || hour < 5;
    return h(
      'div',
      { class: 'writing-note', role: 'note', 'data-key': 'writing-deep-note' },
      h('h3', {}, L().deepNoteTitle),
      h('ul', { class: 'plain-list' }, L().deepNote.map((line) => h('li', {}, line))),
      h('p', { class: 'small' }, L().deepNotTherapy),
      late ? h('p', { class: 'small', 'data-key': 'writing-late' }, L().deepLate) : null,
      h('details', { class: 'writing-help' }, h('summary', {}, L().helpLink), helpList(h, getLang()))
    );
  }

  function timerBox(view) {
    const line = h('p', { class: 'small writing-timer-line', role: 'status', 'aria-live': 'polite', 'data-key': 'writing-timer-line' });
    const btn = h('button', { type: 'button', class: 'link', 'data-key': 'writing-timer' });
    const paint = () => {
      const running = mem.timerStart !== null && !mem.timerDone;
      btn.textContent = running ? L().timerStop : L().timerStart;
      line.textContent = mem.timerDone ? L().timerDone : running ? L().timerRunning : '';
      line.hidden = !line.textContent;
    };
    // the line changes in place: a redraw of the sheet would move the caret while typing
    const watch = () => {
      const timer = setInterval(() => {
        if (view !== st.renders || !line.isConnected || mem.timerStart === null) return clearInterval(timer);
        if (Date.now() - mem.timerStart >= TIMER_MS) {
          mem.timerDone = true;
          clearInterval(timer);
          paint();
        }
      }, 1000);
    };
    btn.addEventListener('click', () => {
      const running = mem.timerStart !== null && !mem.timerDone;
      mem.timerDone = false;
      mem.timerStart = running ? null : Date.now();
      paint();
      if (!running) watch();
    });
    if (mem.timerStart !== null && !mem.timerDone) {
      if (Date.now() - mem.timerStart >= TIMER_MS) mem.timerDone = true;
      else setTimeout(watch, 0); // after this render is in the page
    }
    paint();
    return h('div', { class: 'writing-timer' }, btn, line);
  }

  function writeStage(rerender, view) {
    const prompts = promptsFor(mem.weight, getLang());
    if (mem.promptId && !prompts.some((p) => p.id === mem.promptId)) mem.promptId = null;
    const chosen = prompts.find((p) => p.id === mem.promptId) || null;
    const tabs = h(
      'div',
      { class: 'seg writing-tabs', role: 'tablist', 'aria-label': L().tabsLabel },
      WEIGHTS.map((w) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': mem.weight === w ? 'true' : 'false',
            class: 'seg-btn' + (mem.weight === w ? ' on' : ''),
            'data-key': `writing-tab-${w}`,
            onclick: () => {
              if (mem.weight === w) return;
              mem.weight = w;
              mem.promptId = null;
              rerender();
            },
          },
          L().weights[w]
        )
      )
    );
    const list = h(
      'ul',
      { class: 'writing-prompts', 'aria-label': L().pick },
      prompts.map((p) =>
        h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: 'writing-prompt' + (p.id === mem.promptId ? ' on' : ''),
              'aria-pressed': p.id === mem.promptId ? 'true' : 'false',
              'data-key': `writing-prompt-${p.id}`,
              onclick: () => {
                mem.promptId = p.id;
                rerender();
              },
            },
            p.text
          )
        )
      )
    );
    const out = [h('h2', {}, L().title), h('p', { class: 'muted small' }, L().intro), tabs, mem.weight === 'deep' ? deepNote() : null, h('p', { class: 'writing-label' }, L().pick), list];
    dayNode = null;
    if (!chosen) return out;

    const count = h('span', { class: 'muted small writing-count', 'data-key': 'writing-count' }, L().count(draft().length, BODY_MAX));
    const ta = h('textarea', {
      class: 'writing-text',
      rows: '10',
      maxlength: String(BODY_MAX),
      placeholder: L().placeholder,
      'aria-label': L().textLabel,
      'data-key': 'writing-text',
      oninput: (e) => {
        mem.drafts.set(mem.promptId, e.target.value);
        count.textContent = L().count(e.target.value.length, BODY_MAX);
      },
    });
    ta.value = draft();
    dayNode = h('p', { class: 'writing-day', hidden: true });
    fillDay();
    out.push(
      h(
        'div',
        { class: 'writing-area' },
        h('p', { class: 'writing-chosen', 'data-key': 'writing-chosen' }, chosen.text),
        dayNode,
        ta,
        h('div', { class: 'writing-meta' }, timerBox(view), count),
        h(
          'div',
          { class: 'actions left wrap writing-actions' },
          h('button', { type: 'button', class: 'btn primary', 'data-key': 'writing-save', onclick: () => trySave(rerender) }, L().save),
          h('button', { type: 'button', class: 'btn', 'data-key': 'writing-copy', onclick: copy }, L().copy),
          h(
            'button',
            {
              type: 'button',
              class: 'btn ghost',
              'data-key': 'writing-discard',
              onclick: () => {
                const deep = mem.weight === 'deep';
                const wrote = draft().trim().length > 0;
                mem.drafts.delete(mem.promptId);
                mem.timerStart = null;
                mem.timerDone = false;
                st.saved = null;
                st.wasDeep = deep && wrote;
                // the closing follows deep writing whether or not the text is kept
                st.stage = deep && wrote ? 'closing' : 'done';
                rerender();
              },
            },
            L().discard
          )
        )
      )
    );
    return out;
  }

  return (rerender) => {
    const view = ++st.renders;
    if (st.stage === 'help') return helpStage(rerender);
    if (st.stage === 'closing') return closingStage(rerender);
    if (st.stage === 'done') return doneStage(rerender);
    return writeStage(rerender, view);
  };
}
