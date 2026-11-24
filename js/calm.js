// "Calm now": one large button that starts paced breathing (js/breathe.js), then 5-4-3-2-1
// grounding one step per screen, then a card of phrases to say to oneself. The phrases follow
// the three parts of self-compassion Kristin Neff describes (mindfulness, common humanity,
// self-kindness). They are written for Murmur and carry no praise: nothing here grades how
// the person is doing. Not therapy and not a replacement for medical care.
//
// This file and js/breathe.js import each other. That is safe because each only calls the
// other's functions after both modules have loaded.

import { breatheFlow } from './breathe.js';
import { pickVoice, voicesReady, unlockSpeech } from './bedtime.js';
import { helpList } from './safety.js';

const S = {
  'zh-TW': {
    title: '先穩下來',
    lead: '先跟著呼吸五回，再用 5-4-3-2-1 把注意力帶回身邊，大約兩分鐘。頭暈或更不舒服的話，就停下來，用自己的節奏呼吸。',
    start: '我現在很慌，帶我呼吸',
    voice: '唸出來',
    stepOf: (i, n) => `第 ${i} 步，共 ${n} 步`,
    next: '下一步',
    stopHere: '到這裡就好',
    back: '你回來了。慌的感覺會慢慢退下去，不用急。',
    steps: [
      { n: 5, text: '看看四周，找 5 樣你看得到的東西。', hint: '在心裡一樣一樣說出它的名字。' },
      { n: 4, text: '摸 4 樣東西，感覺它們的觸感。', hint: '衣服、桌面、椅子、自己的手，都可以。' },
      { n: 3, text: '聽聽看，找 3 種聲音。', hint: '遠的、近的都算。' },
      { n: 2, text: '聞聞看，找 2 種味道。', hint: '聞不到也沒關係。' },
      { n: 1, text: '想 1 件你現在喜歡自己的地方。', hint: '很小的也可以。一時想不到，也沒關係。' },
    ],
    phrasesTitle: '可以對自己說的話',
    phrasesIntro: '點一句，可以聽它唸出來。在心裡跟著說，或只是看著也可以。',
    draw: '抽一句',
    phrases: [
      // mindfulness: naming what is here without making it bigger or smaller
      '我現在很難受，這是真的。',
      '心跳很快，手在抖。我注意到了。',
      '這個感覺現在很強。它會過去。',
      // common humanity
      '很多人在這種時候也會這樣。',
      '會慌，不代表我有問題。人本來就會慌。',
      '現在在別的地方，也有人正在撐過一樣的感覺。',
      // self-kindness
      '如果是好朋友這麼累，我會叫她先休息。那我也可以。',
      '我可以慢慢來，不用現在就好起來。',
      '我可以對自己溫柔一點，就像對待我在乎的人。',
    ],
    body: '胸痛或心跳很快，如果一直沒有緩下來，或越來越嚴重，請去看醫生。',
    help: '可以找人說話的地方',
  },
  en: {
    title: 'Calm now',
    lead: 'Five slow breaths first, then 5-4-3-2-1 to bring your attention back to what is around you. About two minutes. If you feel dizzy or worse, stop and breathe at your own pace.',
    start: "I'm panicking. Breathe with me",
    voice: 'Read it aloud',
    stepOf: (i, n) => `Step ${i} of ${n}`,
    next: 'Next',
    stopHere: 'Stop here',
    back: 'You are back. The panic will ease slowly. No rush.',
    steps: [
      { n: 5, text: 'Look around. Find 5 things you can see.', hint: 'Name each one in your head.' },
      { n: 4, text: 'Touch 4 things. Notice how each one feels.', hint: 'Your clothes, the table, a chair, your own hands.' },
      { n: 3, text: 'Listen. Find 3 sounds.', hint: 'Near or far, both count.' },
      { n: 2, text: 'Find 2 things you can smell.', hint: 'None is fine.' },
      { n: 1, text: 'Think of 1 thing you like about yourself right now.', hint: 'Small is fine. If nothing comes, that is fine too.' },
    ],
    phrasesTitle: 'Things to say to yourself',
    phrasesIntro: 'Tap one to hear it. Say it along in your head, or just read it.',
    draw: 'Draw one',
    phrases: [
      'This is hard right now. That is real.',
      'My heart is fast and my hands are shaking. I notice that.',
      'This feeling is strong right now. It will pass.',
      'Many people feel this way at times like this.',
      'Panicking does not mean something is wrong with me. People panic.',
      'Somewhere else, someone is getting through this same feeling right now.',
      'If a good friend were this tired, I would tell them to rest first. So can I.',
      'I can go slowly. I do not have to feel better right away.',
      'I can be gentle with myself, the way I am with people I care about.',
    ],
    body: 'Chest pain or a racing heart that does not ease, or that gets worse, needs a doctor.',
    help: 'Where to find someone to talk to',
  },
};

const text = (getLang) => S[getLang()] || S.en;

export function calmStrings(lang) {
  return S[lang] || S.en;
}

// ---------- voice ----------
// Spoken guidance with the device's own voices only (pickVoice in js/bedtime.js leaves out
// online voices). With no such voice, or when anything fails, nothing is said and the words
// on screen carry the flow. Off until the person turns it on; the choice is remembered.
const VOICE_KEY = 'murmur-calm-voice';

export function createSpeaker(getLang) {
  let on = false;
  try {
    on = localStorage.getItem(VOICE_KEY) === '1';
  } catch (_) {
    /* storage unavailable */
  }
  const saved = {}; // the voice picked in the bedtime ritual, per language
  let asked = false;
  let last = null; // keep a reference: some browsers drop utterances that are collected

  function prepare() {
    if (asked) return;
    asked = true;
    voicesReady().catch(() => {});
    import('./db.js')
      .then(async (db) => {
        for (const l of ['zh-TW', 'en']) saved[l] = await db.getSetting(`voice-${l}`, null);
      })
      .catch(() => {});
  }

  return {
    get on() {
      return on;
    },
    set(v) {
      on = !!v;
      try {
        localStorage.setItem(VOICE_KEY, on ? '1' : '0');
      } catch (_) {
        /* the choice just will not be remembered */
      }
      if (on) this.unlock();
      else this.cancel();
    },
    prepare,
    // call inside a tap, before any await (iOS only allows speech that starts in a gesture)
    unlock() {
      prepare();
      unlockSpeech();
    },
    // force: the person tapped this very sentence to hear it, so it is spoken even with guidance off
    say(sentence, { force = false } = {}) {
      if (!on && !force) return false;
      try {
        if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return false;
        const lang = getLang();
        const voice = pickVoice(lang === 'en' ? 'en' : 'zh', saved[lang]);
        if (!voice) return false;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(sentence);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = 0.85;
        u.pitch = 0.95;
        last = u;
        speechSynthesis.speak(u);
        return true;
      } catch (_) {
        return false;
      }
    },
    cancel() {
      try {
        if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
      } catch (_) {
        /* ignore */
      }
      last = null;
    },
  };
}

export function voiceToggle({ h, getLang, speaker }) {
  return h(
    'label',
    { class: 'toggle calm-voice' },
    h('input', { type: 'checkbox', checked: speaker.on, 'data-key': 'calm-voice', onchange: (e) => speaker.set(e.target.checked) }),
    h('span', {}, text(getLang).voice)
  );
}

// Redraw, then put focus on the control that continues the flow. The app's sheet keeps focus
// only when the same data-key still exists, and each stage has different controls.
export function redrawAndFocus(rerender, key) {
  rerender();
  const el = document.querySelector(`#sheet [data-key="${key}"]`) || document.querySelector(`[data-key="${key}"]`);
  if (el) el.focus();
}

// ---------- 5-4-3-2-1 grounding ----------
// One step per screen. onEnd runs after the last step, onStop when the person stops early.
export function groundingStage({ h, getLang, speaker, onEnd, onStop }) {
  const st = { i: 0, spoken: -1 };
  return {
    reset() {
      st.i = 0;
      st.spoken = -1;
    },
    render(rerender) {
      const L = text(getLang);
      const step = L.steps[st.i];
      if (st.spoken !== st.i) {
        st.spoken = st.i;
        if (speaker) speaker.say(`${step.text}${step.hint}`);
      }
      return h(
        'div',
        { class: 'ground', 'data-step': String(st.i + 1) },
        h('p', { class: 'muted small ground-progress' }, L.stepOf(st.i + 1, L.steps.length)),
        h('p', { class: 'ground-num', 'aria-hidden': 'true' }, String(step.n)),
        h('p', { class: 'calm-big ground-text', id: 'ground-text' }, step.text),
        h('p', { class: 'muted ground-hint', id: 'ground-hint' }, step.hint),
        h(
          'div',
          { class: 'actions calm-actions' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn primary calm-next',
              'data-key': 'calm-next',
              // a screen reader hears the new step when the redraw returns focus to this button
              'aria-describedby': 'ground-text ground-hint',
              onclick: () => {
                if (st.i + 1 < L.steps.length) {
                  st.i++;
                  return rerender();
                }
                onEnd(rerender);
              },
            },
            L.next
          ),
          h('button', { type: 'button', class: 'link', 'data-key': 'calm-stop-here', onclick: () => onStop(rerender) }, L.stopHere)
        )
      );
    },
  };
}

// ---------- phrases ----------
// The same text, one span per clause, so css/calm.css can keep a Chinese clause on one line.
const clauses = (h, s) => (s.match(/[^，。？！；]+[，。？！；]*/g) || [s]).map((c) => h('span', { class: 'calm-clause' }, c));

function phraseCard({ h, getLang, speaker, st }, rerender) {
  const L = text(getLang);
  if (st.pickLang !== getLang()) {
    st.pick = null;
    st.pickLang = getLang();
  }
  const choose = (i, { spoken }) => {
    st.pick = i;
    // a tap on a phrase is a request to hear it; a drawn one is spoken only with guidance on
    speaker.say(L.phrases[i], { force: spoken });
    rerender();
  };
  return h(
    'section',
    { class: 'calm-phrases', 'aria-labelledby': 'calm-phrases-title' },
    h('h3', { id: 'calm-phrases-title' }, L.phrasesTitle),
    h('p', { class: 'muted small' }, L.phrasesIntro),
    h(
      'div',
      { class: 'actions left' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn',
          'data-key': 'calm-draw',
          onclick: () => {
            speaker.unlock();
            let i = Math.floor(Math.random() * L.phrases.length);
            if (i === st.pick) i = (i + 1) % L.phrases.length; // never the same one twice in a row
            choose(i, { spoken: false });
          },
        },
        L.draw
      )
    ),
    h('p', { class: 'calm-big calm-picked', role: 'status' }, st.pick === null ? '' : clauses(h, L.phrases[st.pick])),
    h(
      'ul',
      { class: 'calm-phrase-list' },
      L.phrases.map((p, i) =>
        h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: 'calm-phrase' + (i === st.pick ? ' on' : ''),
              'data-key': `calm-phrase-${i}`,
              'aria-pressed': i === st.pick ? 'true' : 'false',
              onclick: () => {
                speaker.unlock();
                choose(i, { spoken: true });
              },
            },
            p
          )
        )
      )
    )
  );
}

// ---------- the sheet ----------
// Open it like the breathing sheet: openSheet(calmSheet({ h, getLang })).
export function calmSheet({ h, getLang }) {
  const speaker = createSpeaker(getLang);
  const st = { pick: null, pickLang: null, helpOpen: false };
  const flow = breatheFlow({
    h,
    getLang,
    speaker,
    pattern: '426', // the hold gives a panicking mind one more thing to follow
    choosePattern: false,
    compact: true,
    startKey: 'calm-start',
    startClass: 'btn primary calm-start',
    startLabel: () => text(getLang).start,
    // skipping the grounding lands on the phrases
    onSkip: (rerender) => redrawAndFocus(rerender, 'calm-draw'),
  });

  return (rerender) => {
    const L = text(getLang);
    speaker.prepare();
    const stage = flow.stage();
    const busy = stage === 'breathing' || stage === 'handoff' || stage === 'ground';
    return [
      h('h2', {}, L.title),
      stage === 'idle' ? h('p', { class: 'muted small' }, L.lead) : null,
      h('div', { class: 'calm-flow' }, flow.render(rerender)),
      // one thing at a time: the phrases wait until the flow is over or has not begun
      busy ? null : phraseCard({ h, getLang, speaker, st }, rerender),
      h('p', { class: 'small calm-body-note', role: 'note' }, clauses(h, L.body)),
      h(
        'div',
        { class: 'calm-help' },
        h('button', { type: 'button', class: 'link', 'data-key': 'calm-help', 'aria-expanded': st.helpOpen ? 'true' : 'false', onclick: () => ((st.helpOpen = !st.helpOpen), rerender()) }, L.help),
        st.helpOpen ? helpList(h, getLang()) : null
      ),
    ];
  };
}
