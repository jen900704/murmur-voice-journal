// The bedtime ritual: set a worry down, note one kind thing, listen to a short wind-down
// track, and get a postcard. Every step can be skipped. No streaks, no reminders of missed days.
import { TRACKS, THEMES, THEME_TRACK, trackById, buildScript, BedtimePlayer, pickVoice, voicesFor, voicesReady, unlockSpeech } from './bedtime.js';
import { cardSvg, postcardPng, sharePng } from './postcard.js';
import { checkRisk, helpList } from './safety.js';
import { createFlowHistory } from './flow-history.js';
import { mascot } from './mascot.js';
import { blockArt } from './icons.js';

// The suggested-track policy (js/policy.js) is optional and off by default; loaded on its own
// so the ritual still works if that one file cannot be fetched.
const policyModule = import('./policy.js').catch(() => null);

const S = {
  'zh-TW': {
    cardTitle: '睡前儀式',
    cardDoneTitle: '今晚完成了，晚安',
    cardDoneBody: '明信片收在「紀錄」的「夜晚」裡。',
    cardBody: '放下心事，聽一段睡前引導，收一張明信片。',
    cardStart: '開始',
    cardAgain: '再做一次',
    cardListen: '只想聽一段',
    preparing: '準備中…',
    leave: '離開睡前儀式',
    helpBar: '需要現在就找人說說話？',
    helpOpen: '求助專線',
    step: (i, n) => `${i} / ${n}`,
    worryTitle: '把今天的心事放下來',
    worryHelp: '寫幾句也好，不寫也可以。這些字只存在這個裝置上，睡前引導也不會唸出來。',
    worryPlaceholder: '今天讓我放不下的是……',
    themeLabel: '它比較像哪幾類？可以不只選一個。（選填）',
    themes: { work: '學業或工作', relationship: '伴侶或朋友', family: '家人', health: '身體', future: '以後的事', unsure: '說不清楚' },
    keep: '存進夜晚的紀錄',
    kindTitle: '今天對自己好的一件事',
    kindHelp: '再小都算：好好吃一餐、早點睡、拒絕一件事。想不到也沒關係。',
    kindPlaceholder: '今天我……',
    kindIdeas: '以前你做過的：',
    toneTitle: '今晚想聽哪一種？',
    toneHelp: '每一段都是為 Murmur 寫的，靈感來自不同的諮商取向，是自我照顧的練習，不是心理治療或諮商。',
    surprise: '幫我選',
    allTracks: (n) => `看全部 ${n} 段`,
    suggested: '適合今晚的心事',
    playTitle: '把手機放在旁邊，讓螢幕亮著',
    pause: '暫停',
    resume: '繼續',
    stop: '結束',
    readAlong: '這台裝置沒有可用的中文語音，改成跟著文字慢慢讀。',
    voice: '聲音',
    voiceDefault: '自動選擇',
    preview: '試聽',
    cardDone: '今晚的明信片',
    cardDoneDay: '今天的明信片',
    kindLabel: '今天對自己好的一件事',
    nightLabel: '晚安',
    nightLine: '今晚就到這裡。',
    sendTitle: '寄一張晚安明信片給一個人',
    sendShare: '分享這張明信片',
    sendHelp: '明信片上只會有你選的這句話，不會有你今晚寫的任何內容。',
    sendLines: ['晚安。今天辛苦了。', '想到你了。希望你今晚睡得好。', '明天見。先好好休息。'],
    savePng: '存成圖片或分享',
    done: '完成',
    gentle: '今晚來點溫柔的作品',
    skip: '略過',
    skipTrack: '今晚不聽，直接收明信片',
    next: '下一步',
    back: '上一步',
    crisisTitle: '先停一下',
    crisisBody: '你寫的內容裡，有些字詞可能代表你現在很辛苦。如果是這樣，今晚先找一個人說說話，可能會比睡前引導更有幫助。',
    crisisKept: '你寫的內容還在，沒有被刪掉。如果這不是你的意思，可以繼續。',
    crisisContinue: '我不是那個意思，繼續',
    crisisBack: '回到今天（不儲存）',
    shared: '已分享',
    downloaded: '已存成圖片',
    notKept: '今晚的紀錄沒有存進這台裝置，明信片還是可以存成圖片。',
  },
  en: {
    cardTitle: 'Bedtime ritual',
    cardDoneTitle: 'Done for tonight. Good night',
    cardDoneBody: 'Your postcard is in Journal, under Nights.',
    cardBody: 'Set a worry down, listen to a wind-down, get a postcard.',
    cardStart: 'Start',
    cardAgain: 'Do it again',
    cardListen: 'Just listen',
    preparing: 'Getting ready…',
    leave: 'Leave the ritual',
    helpBar: 'Need to talk to someone now?',
    helpOpen: 'Help lines',
    step: (i, n) => `${i} of ${n}`,
    worryTitle: 'Set down what is on your mind',
    worryHelp: 'A few lines, or nothing at all. What you write stays on this device, and the track never reads it aloud.',
    worryPlaceholder: 'What I cannot put down tonight is…',
    themeLabel: 'What is it closest to? Pick as many as fit. (optional)',
    themes: { work: 'School or work', relationship: 'Partner or friends', family: 'Family', health: 'My body', future: 'What comes next', unsure: 'Hard to say' },
    keep: 'Keep it in Journal, under Nights',
    kindTitle: 'One kind thing I did for myself today',
    kindHelp: 'Anything counts: a proper meal, going to bed early, saying no to something. If nothing comes to mind, that is fine.',
    kindPlaceholder: 'Today I…',
    kindIdeas: 'Things you have done before:',
    toneTitle: 'What would you like to hear tonight?',
    toneHelp: 'Each track was written for Murmur, inspired by a counseling approach. They are self-care exercises, not therapy or counseling.',
    surprise: 'Choose for me',
    allTracks: (n) => `Show all ${n}`,
    suggested: "Suits tonight's worry",
    playTitle: 'Put the phone down nearby and leave the screen on',
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop',
    readAlong: 'No English voice is available on this device, so the track plays as slow read-along text.',
    voice: 'Voice',
    voiceDefault: 'Automatic',
    preview: 'Preview',
    cardDone: 'Tonight\'s postcard',
    cardDoneDay: 'Today\'s postcard',
    kindLabel: 'One kind thing I did for myself',
    nightLabel: 'Good night',
    nightLine: 'That is enough for tonight.',
    sendTitle: 'Send a goodnight card to someone',
    sendShare: 'Share this card',
    sendHelp: 'The card carries only the line you pick, nothing you wrote tonight.',
    sendLines: ['Good night. You worked hard today.', 'Thinking of you. Sleep well tonight.', 'See you tomorrow. Rest well.'],
    savePng: 'Save or share image',
    done: 'Done',
    gentle: 'Something gentle to watch or read',
    skip: 'Skip',
    skipTrack: 'Skip the track, just the postcard',
    next: 'Next',
    back: 'Back',
    crisisTitle: 'Let us pause here',
    crisisBody: 'Some words in what you wrote can mean things are very hard right now. If so, tonight you deserve to talk with a real person, more than a wind-down track.',
    crisisKept: 'What you wrote is still here; nothing was deleted. If this is not what you meant, you can carry on.',
    crisisContinue: 'I am okay, I meant something else. Continue',
    crisisBack: 'Back to Today (nothing saved)',
    shared: 'Shared',
    downloaded: 'Image saved',
    notKept: 'Tonight could not be stored on this device. You can still save the postcard as an image.',
  },
};

export function isEvening(d = new Date()) {
  const hr = d.getHours();
  return hr >= 20 || hr < 4;
}

export function createNightView({ h, add, getLang, rerender, toast, db, onExit, latestMood, openGentle }) {
  const st = { run: 0, preparing: false, stage: 'card', worry: '', themes: [], keep: true, kind: '', track: null, player: null, line: '', lineIndex: 0, paused: false, readAlong: false, postcard: null, jar: [], voiceName: null };
  const L = () => S[getLang()] || S.en;
  const lk = () => (getLang() === 'en' ? 'en' : 'zh');
  // suggested track: mod and store once loaded, optIn, and dec for tonight's suggestion
  const pol = { mod: null, store: null, optIn: undefined, dec: null, whyOpen: false };
  const PT = () => pol.mod.policyText(getLang());

  function go(stage) {
    if (stage !== st.stage) st.helpOpen = false; // the help list closes when the step changes
    st.stage = stage;
    rerender();
    window.scrollTo(0, 0);
    // move focus to the new step's heading so screen readers announce it
    const hd = document.querySelector('.view.night h2');
    if (hd) {
      hd.setAttribute('tabindex', '-1');
      hd.focus({ preventScroll: true });
    }
  }

  // An evening runs from 4 pm to the next 4 pm, so 1 am still belongs to the night before.
  function eveningStart(now = new Date()) {
    const start = new Date(now);
    start.setHours(16, 0, 0, 0);
    if (now.getHours() < 16) start.setDate(start.getDate() - 1);
    return start.getTime();
  }

  // "Done for tonight" is true when the last ritual finished since this evening began.
  // st.doneAt is a time, not a date, so the card, a reload and past midnight all agree.
  const doneTonight = () => (st.doneAt || 0) >= eveningStart();

  // the same answer after a reload: take the time of the latest saved night
  function markDone(nights) {
    st.doneAt = Math.max(st.doneAt || 0, ...nights.map((n) => n.createdAt || 0));
  }
  db.listNights().then(markDone, () => {});

  // One tap from the card straight to a track, for nights when writing is too much.
  async function listenNow() {
    unlockSpeech(); // must run inside the tap, before any await
    if (st.preparing) return;
    st.preparing = true;
    rerender(); // show "getting ready" so a second tap is not needed
    try {
      const run = await begin({ stay: true });
      if (run !== st.run) return;
      await play(chooseFor());
    } finally {
      st.preparing = false;
      if (st.stage === 'card') rerender();
    }
  }

  // st.run changes whenever the person leaves or starts over; work that was waiting
  // (loading settings or voices) checks it and quietly gives up instead of reopening the ritual.
  async function begin({ stay = false } = {}) {
    const run = ++st.run;
    st.helpOpen = false;
    st.sendPick = null;
    st.allTracks = false;
    st.sendPng = null;
    st.sendOpen = false;
    st.worry = '';
    st.themes = [];
    st.kind = '';
    st.track = null;
    st.keep = (await db.getSetting('nightKeep', true).catch(() => true)) !== false;
    st.voiceName = await db.getSetting(`voice-${getLang()}`, null).catch(() => null);
    const nights = await db.listNights().catch(() => []);
    st.jar = nights.map((n) => n.kindness).filter(Boolean);
    markDone(nights);
    st.finishing = false;
    st.riskSeen = false;
    pol.dec = null;
    pol.whyOpen = false;
    pol.mod = pol.mod || (await policyModule);
    if (pol.mod) {
      pol.store = pol.store || pol.mod.createPolicyStore(db);
      pol.optIn = await pol.store.optIn();
    }
    voicesReady(); // start loading voices early
    if (run !== st.run) return null;
    if (!stay) go('worry');
    return run;
  }

  // Pause with help instead of deleting; the person can carry on if it was something else.
  function guard(text, onContinue) {
    if (checkRisk(text).risk) {
      // from here on nothing tonight is used to adjust suggestions
      st.riskSeen = true;
      if (pol.store) pol.store.noteRisk();
      st.onContinue = onContinue;
      st.crisisFrom = st.stage;
      go('crisis');
      return false;
    }
    return true;
  }

  function stepHead(i, title, help) {
    return [h('p', { class: 'muted small night-step', 'data-step': i }, L().step(i, 4)), h('h2', {}, title), help ? h('p', { class: 'muted small' }, help) : null];
  }

  // an empty step says "Skip", so it is clear nothing has to be written
  function nextLabel(text) {
    const b = document.querySelector('[data-key="night-next"]');
    if (b) b.textContent = text.trim() ? L().next : L().skip;
  }

  function nav(onNext, { back = null, nextLabel } = {}) {
    return h(
      'div',
      { class: 'actions left' },
      h('button', { type: 'button', class: 'btn primary', 'data-key': 'night-next', onclick: onNext }, nextLabel || L().next),
      back ? h('button', { type: 'button', class: 'btn ghost', onclick: back }, L().back) : null
    );
  }

  function card() {
    const done = doneTonight();
    return h(
      'div',
      { class: 'night-card' + (isEvening() ? ' evening' : '') },
      // Mumu, dozing: the bedtime card is where the companion sits in the evening
      isEvening() ? h('div', { class: 'cblock cblock--night night-card-block' }, blockArt('nightcard'), mascot('sleepy', { size: 96, variant: 'solid' })) : mascot('idle', { size: 64 }),
      h('div', {}, h('h2', {}, done ? L().cardDoneTitle : L().cardTitle), h('p', {}, done ? L().cardDoneBody : L().cardBody), h('div', { class: 'actions left wrap' }, h('button', { type: 'button', class: 'btn primary', 'data-key': 'night-start', onclick: () => begin() }, done ? L().cardAgain : L().cardStart), h('button', { type: 'button', class: 'btn ghost night-listen', 'data-key': 'night-listen', disabled: st.preparing, onclick: listenNow }, st.preparing ? L().preparing : L().cardListen)))
    );
  }

  function worry() {
    const ta = h('textarea', { id: 'night-worry', rows: '4', maxlength: '1000', placeholder: L().worryPlaceholder, oninput: (e) => {
      st.worry = e.target.value;
      nextLabel(st.worry || (st.themes.length ? '-' : ''));
    } });
    ta.value = st.worry;
    return [
      h('div', { class: 'night-mumu cblock cblock--night' }, blockArt('night'), mascot('sleepy', { size: 168, variant: 'solid' })),
      ...stepHead(1, L().worryTitle, L().worryHelp),
      ta,
      h('p', { class: 'lens-label', id: 'night-theme' }, L().themeLabel),
      h(
        'div',
        { class: 'chips wrap theme-chips', role: 'group', 'aria-labelledby': 'night-theme' },
        THEMES.map((tm) =>
          h(
            'button',
            {
              type: 'button',
              'aria-pressed': st.themes.includes(tm) ? 'true' : 'false',
              class: 'chip' + (st.themes.includes(tm) ? ' on' : ''),
              'data-key': `night-theme-${tm}`,
              onclick: () => {
                // several kinds can be on at once, kept in the order chosen;
                // 'unsure' stands alone, so it and the named kinds switch each other off
                if (st.themes.includes(tm)) st.themes = st.themes.filter((x) => x !== tm);
                else if (tm === 'unsure') st.themes = ['unsure'];
                else st.themes = [...st.themes.filter((x) => x !== 'unsure'), tm];
                rerender();
              },
            },
            L().themes[tm]
          )
        )
      ),
      h(
        'label',
        { class: 'toggle' },
        h('input', {
          type: 'checkbox',
          checked: st.keep,
          'data-key': 'night-keep',
          onchange: (e) => {
            st.keep = e.target.checked;
            db.setSetting('nightKeep', st.keep).catch(() => {});
          },
        }),
        h('span', {}, L().keep)
      ),
      nav(() => {
        if (guard(st.worry, () => go('kind'))) go('kind');
      }, { back: () => { st.stage = 'card'; flow.sync(); onExit(); }, nextLabel: st.worry.trim() || st.themes.length ? L().next : L().skip }),
    ];
  }

  function kind() {
    const input = h('input', { type: 'text', id: 'night-kind', maxlength: '120', placeholder: L().kindPlaceholder, oninput: (e) => {
      st.kind = e.target.value;
      nextLabel(st.kind);
    } });
    input.value = st.kind;
    const ideas = [...new Set(st.jar)].slice(-30).sort(() => Math.random() - 0.5).slice(0, 3);
    return [
      ...stepHead(2, L().kindTitle, L().kindHelp),
      input,
      ideas.length ? h('div', { class: 'jar-ideas' }, h('p', { class: 'muted small' }, L().kindIdeas), h('ul', { class: 'plain-list' }, ideas.map((k) => h('li', {}, k)))) : null,
      nav(() => {
        if (guard(st.kind, toTone)) toTone();
      }, { back: () => go('worry'), nextLabel: st.kind.trim() ? L().next : L().skip }),
    ];
  }

  // the usual order: the track suited to tonight's kind of worry, then the others as listed.
  // 'drift' invites images to surface, so it is never suggested, only chosen on purpose.
  // With several kinds chosen, the first one's track leads and the others' follow, each once.
  const themeTracks = () => [...new Set(st.themes.map((tm) => THEME_TRACK[tm]).filter(Boolean))];
  const themeContext = () => st.themes[0] || 'none'; // what the suggestion is learned under
  function trackOrder() {
    const lead = themeTracks();
    const rest = TRACKS.map((t) => t.id).filter((id) => id !== 'drift' && !lead.includes(id));
    return [...lead, ...rest];
  }

  // Decides tonight's one suggested track, only when the person has switched this on. The gate
  // (risk language, a low latest mood) is worked out here, outside the learner; a gated
  // suggestion is the usual one. One decision per first-chosen theme per night, however often the step is opened.
  async function featureTrack() {
    const context = themeContext();
    if (!pol.mod || pol.optIn !== true) return (pol.dec = null); // off: nothing decided, nothing logged
    if (pol.dec && pol.dec.context === context && !pol.dec.used) return;
    pol.dec = null;
    const [risk, evidence] = await Promise.all([pol.store.recentRisk(), pol.store.evidence('track', context)]);
    const gated = pol.mod.gateReason({ optedIn: true, risk: st.riskSeen || risk, mood: latestMood(), surface: 'track', context });
    const decision = pol.mod.decide({ eligible: trackOrder(), evidence, gated, seed: pol.mod.newSeed() });
    if (!decision) return;
    const record = pol.mod.makeRecord({ surface: 'track', context, decision });
    await pol.store.log(record);
    pol.dec = { id: record.id, context, action: decision.action, gated: decision.gated, used: null, answered: false };
  }

  async function toTone() {
    if (st.toning) return;
    st.toning = true;
    const run = st.run;
    try {
      await featureTrack();
    } catch (_) {
      pol.dec = null;
    } finally {
      st.toning = false;
    }
    if (run === st.run) go('tone');
  }

  // after a track: one optional question, the only thing the suggestion ever learns from
  function trackQuestion() {
    const dec = pol.dec;
    if (!dec || !dec.used || !pol.mod) return null;
    if (dec.answered) return h('p', { class: 'muted small', role: 'status', 'data-key': 'track-helped-thanks' }, PT().thanks);
    const answer = (reward) => {
      dec.answered = true;
      pol.store.rate(dec.id, { reward, allowLearning: !st.riskSeen && !pol.mod.isLowMood(latestMood()) }).catch(() => {});
      rerender();
    };
    return h(
      'div',
      { class: 'track-helped' },
      h('p', { class: 'small', id: 'track-helped-q' }, PT().trackQ),
      h('div', { class: 'actions left', role: 'group', 'aria-labelledby': 'track-helped-q' }, h('button', { type: 'button', class: 'btn', 'data-key': 'track-helped-yes', onclick: () => answer(1) }, PT().trackYes), h('button', { type: 'button', class: 'btn', 'data-key': 'track-helped-no', onclick: () => answer(0) }, PT().trackNo))
    );
  }

  function chooseFor() {
    const mood = latestMood();
    const gentle = ['person-centered', 'relaxation', 'acceptance'];
    // 'drift' invites images to surface, so it is only ever chosen on purpose
    const pool = mood !== null && mood <= 3 ? gentle : TRACKS.map((t) => t.id).filter((id) => id !== 'drift');
    // when kinds of worry were chosen, pick among the tracks that suit them, if the pool allows any
    const fitting = themeTracks().filter((id) => pool.includes(id));
    const from = fitting.length ? fitting : pool;
    return from[Math.floor(Math.random() * from.length)];
  }

  function tone() {
    // with suggestions switched on and not gated, the policy's track takes the suggested place
    const learned = pol.dec && !pol.dec.gated && pol.dec.context === themeContext() ? pol.dec.action : null;
    const lead = themeTracks();
    const suggestedId = learned || lead[0];
    const tag = learned && learned !== lead[0] ? PT().trackTag : L().suggested;
    // the suggestion, then the tracks for the other kinds chosen, then the rest as listed
    const front = [...new Set([suggestedId, ...lead].filter(Boolean))];
    const rank = (id) => (front.includes(id) ? front.indexOf(id) : front.length);
    return [
      ...stepHead(3, L().toneTitle, L().toneHelp),
      h(
        'div',
        { class: 'tracks' },
        h('button', { type: 'button', class: 'track surprise', 'data-key': 'track-surprise', onclick: () => play(chooseFor()) }, h('strong', {}, L().surprise)),
        // the track suited to tonight's kind of worry comes first, marked as a suggestion;
        // a few are shown at first so the choice is not a long list at bedtime
        [...TRACKS]
          .sort((a, b) => rank(a.id) - rank(b.id))
          .slice(0, st.allTracks ? TRACKS.length : 3)
          .map((t) =>
          h(
            'button',
            { type: 'button', class: 'track' + (t.id === suggestedId ? ' suggested' : ''), 'data-key': `track-${t.id}`, onclick: () => play(t.id) },
            t.id === suggestedId ? h('span', { class: 'track-tag' }, tag) : null,
            h('strong', {}, t[lk()].name),
            h('span', {}, t[lk()].style),
            t[lk()].note ? h('span', { class: 'track-note' }, t[lk()].note) : null
          )
        ),
        learned ? h('button', { type: 'button', class: 'link', 'data-key': 'policy-why', 'aria-expanded': pol.whyOpen ? 'true' : 'false', onclick: () => ((pol.whyOpen = !pol.whyOpen), rerender()) }, PT().why) : null,
        learned && pol.whyOpen ? h('p', { class: 'muted small', 'data-key': 'policy-why-body' }, PT().whyBody) : null,
        st.allTracks ? null : h('button', { type: 'button', class: 'link', 'data-key': 'tracks-all', onclick: () => ((st.allTracks = true), rerender()) }, L().allTracks(TRACKS.length))
      ),
      h(
        'div',
        { class: 'actions left' },
        h('button', { type: 'button', class: 'btn ghost', onclick: () => go('kind') }, L().back),
        h(
          'button',
          {
            type: 'button',
            class: 'btn ghost',
            'data-key': 'night-skip-track',
            onclick: () => {
              st.track = null;
              st.stage = 'play';
              finishTrack();
            },
          },
          L().skipTrack
        )
      ),
    ];
  }

  async function play(trackId, from = 0) {
    unlockSpeech(); // must run before the first await
    if (st.starting) return; // a double tap would start two players talking over each other
    st.starting = true;
    try {
      await startTrack(trackId, from);
    } finally {
      st.starting = false;
    }
  }

  async function startTrack(trackId, from = 0) {
    const run = ++st.run;
    if (st.player) st.player.stop();
    st.track = trackId;
    const lang = getLang();
    const script = buildScript(trackId, st.themes, lang);
    await voicesReady();
    if (run !== st.run) return; // the person left while voices were loading
    const voice = pickVoice(lang === 'en' ? 'en' : 'zh', st.voiceName);
    st.readAlong = !voice;
    st.paused = false;
    st.line = '';
    st.lineIndex = from;
    st.player = new BedtimePlayer({
      script,
      lang,
      voice,
      onLine: (i, text) => {
        st.lineIndex = i;
        st.line = text;
        const el = document.getElementById('night-line');
        if (el) el.textContent = text;
        const bar = document.getElementById('night-progress');
        if (bar) bar.style.width = `${((i + 1) / script.length) * 100}%`;
      },
      onEnd: () => finishTrack(),
    });
    go('play');
    st.player.i = Math.max(0, Math.min(from, script.length - 1));
    st.player.start();
  }

  function playView() {
    const track = trackById(st.track);
    if (!track) return tone();
    const t = track[lk()];
    const voices = voicesFor(getLang() === 'en' ? 'en' : 'zh');
    return h(
      'div',
      { class: 'night-play' },
      h('p', { class: 'night-track' }, t.name, h('span', {}, ' · ', t.style)),
      h('div', { class: 'breath', 'aria-hidden': 'true' }),
      // only announce lines when they are not already being spoken aloud
      h('p', { class: 'night-line', id: 'night-line', 'aria-live': st.readAlong ? 'polite' : 'off' }, st.line || '…'),
      // keep the bar where it was when the view is rebuilt (opening help, changing voice)
      h('div', { class: 'night-bar' }, h('div', { id: 'night-progress', style: st.player ? `width:${((st.lineIndex + 1) / st.player.script.length) * 100}%` : null })),
      st.readAlong ? h('p', { class: 'small night-dim' }, L().readAlong) : h('p', { class: 'small night-dim' }, L().playTitle),
      h(
        'div',
        { class: 'actions' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn night-btn',
            'data-key': 'night-pause',
            onclick: () => {
              if (st.paused) {
                st.paused = false;
                st.player.resume();
              } else {
                st.paused = true;
                st.player.pause();
              }
              rerender();
            },
          },
          st.paused ? L().resume : L().pause
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn night-btn ghost',
            'data-key': 'night-stop',
            onclick: () => {
              st.player.stop();
              finishTrack();
            },
          },
          L().stop
        )
      ),
      voices.length > 1
        ? h(
            'label',
            { class: 'night-voice small night-dim' },
            h('span', {}, L().voice, ' '),
            h(
              'select',
              {
                onchange: async (e) => {
                  st.voiceName = e.target.value || null;
                  await db.setSetting(`voice-${getLang()}`, st.voiceName);
                  // carry on from the current line in the new voice, not from the top
                  const from = st.lineIndex;
                  if (!st.player || st.stage !== 'play') return; // left while saving the choice
                  st.player.stop();
                  play(st.track, from);
                },
              },
              h('option', { value: '' }, L().voiceDefault),
              voices.map((v) => h('option', { value: v.name, selected: v.name === st.voiceName ? 'selected' : null }, v.name))
            )
          )
        : null
    );
  }

  async function finishTrack() {
    if (st.stage !== 'play' || st.finishing) return;
    st.finishing = true;
    try {
      const now = new Date();
      // note which track was actually played, whether or not it was the suggested one
      if (pol.dec && st.track && !pol.dec.used) {
        pol.dec.used = st.track;
        pol.store.setUsed(pol.dec.id, st.track).catch(() => {});
      }
      const seed = `${now.toDateString()}-${st.track}-${st.kind}`;
      const date = new Intl.DateTimeFormat(getLang(), { dateStyle: 'long' }).format(now);
      const hasKind = st.kind.trim().length > 0;
      // the picture follows the kind thing they wrote (never the worry, which stays private)
      st.postcard = cardSvg({
        seed,
        line: hasKind ? st.kind.trim() : L().nightLine,
        label: hasKind ? L().kindLabel : L().nightLabel,
        date,
        texts: hasKind ? [st.kind.trim()] : [''],
        animate: true,
      });
      const night = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        createdAt: Date.now(),
        theme: st.themes[0] || null, // kept so an older copy of the app can still read this night
        themes: [...st.themes],
        worry: st.keep ? st.worry.trim() : '',
        kindness: st.kind.trim(),
        track: st.track,
        seed,
        lang: getLang(),
      };
      // the postcard still shows even if saving failed
      const run = st.run;
      const kept = await db.saveNight(night).then(() => true, () => false);
      if (run !== st.run) return; // left during the save: do not reopen the ritual
      st.nightAt = night.createdAt;
      go('postcard');
      if (!kept) toast(L().notKept);
    } finally {
      st.finishing = false;
    }
  }

  // the postcard's Done button, and the phone's Back button on the postcard
  function done() {
    st.stage = 'card';
    flow.sync();
    st.doneAt = Math.max(st.doneAt || 0, st.nightAt || Date.now());
    // draw Today now and put focus on the ritual's button there, so it does not
    // fall to <body>; the render that follows onExit keeps it by data-key
    rerender();
    const next = document.querySelector('[data-key="night-start"], [data-key="night-link"]') || document.getElementById('main');
    if (next) {
      if (next.id === 'main') next.setAttribute('tabindex', '-1');
      next.focus({ preventScroll: true });
    }
    onExit();
    window.scrollTo(0, 0);
  }

  function postcard() {
    const holder = h('div', { class: 'postcard', role: 'img', 'aria-label': isEvening() ? L().cardDone : L().cardDoneDay });
    holder.innerHTML = st.postcard;
    // Mumu is glad, quietly: one slow hop (css "Night, Mumu"), no words
    return [
      h('div', { class: 'night-mumu night-mumu--done' }, h('span', { class: 'mumu-seat' }, mascot('happy', { size: 76, variant: 'solid' }))),
      h('h2', {}, isEvening() ? L().cardDone : L().cardDoneDay),
      holder,
      h(
        'div',
        { class: 'actions left wrap' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn primary',
            'data-key': 'night-done',
            onclick: done,
          },
          L().done
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn',
            onclick: async () => {
              const png = await postcardPng(st.postcard);
              const r = await sharePng(png, `murmur-${new Date().toISOString().slice(0, 10)}.png`, '');
              if (r === 'shared') toast(L().shared);
              if (r === 'downloaded') toast(L().downloaded);
            },
          },
          L().savePng
        )
      ),
      trackQuestion(),
      sendCard(),
      openGentle ? h('button', { type: 'button', class: 'link', onclick: () => openGentle() }, L().gentle) : null,
    ];
  }

  // A goodnight card for one person, through the phone's own share sheet. Only a fixed line
  // the person picks goes on it; never the worry or the kind thing. No feed, counts, or receipts.
  function sendCard() {
    if (st.sendLang !== getLang()) {
      // language changed: the chosen line and its drawn card belong to the old language
      st.sendLang = getLang();
      st.sendPick = null;
      st.sendPng = null;
    }
    const lines = L().sendLines;
    const date = new Intl.DateTimeFormat(getLang(), { dateStyle: 'long' }).format(new Date());
    const svgFor = (line) => cardSvg({ seed: `send-${line}-${date}`, line, label: getLang() === 'en' ? 'Good night' : '晚安', date });
    const pick = st.sendPick ?? null;
    const preview = pick !== null ? h('div', { class: 'send-preview', role: 'img', 'aria-label': lines[pick] }) : null;
    if (preview) preview.innerHTML = svgFor(lines[pick]);
    return h(
      'details',
      {
        class: 'send-card',
        open: st.sendOpen ? '' : null,
        ontoggle: (e) => (st.sendOpen = e.currentTarget.open),
      },
      h('summary', { 'data-key': 'night-send' }, L().sendTitle),
      h('p', { class: 'muted small' }, L().sendHelp),
      h(
        'div',
        { class: 'chips wrap', role: 'radiogroup', 'aria-label': L().sendTitle },
        lines.map((line, i) =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': pick === i ? 'true' : 'false',
              class: 'chip' + (pick === i ? ' on' : ''),
              'data-key': `send-line-${i}`,
              onclick: () => {
                st.sendPick = i;
                st.sendPng = postcardPng(svgFor(line)); // drawn now, so sharing opens right away
                rerender();
                const share = document.querySelector('[data-key="send-share"]');
                if (share) share.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              },
            },
            line
          )
        )
      ),
      preview,
      pick !== null
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn',
              'data-key': 'send-share',
              onclick: async () => {
                if (st.sending) return; // a second tap while the share sheet opens would fail
                st.sending = true;
                try {
                  const png = await (st.sendPng || postcardPng(svgFor(lines[pick])));
                  const d = new Date();
                  const r = await sharePng(png, `goodnight-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.png`, lines[pick]);
                  if (r === 'shared') toast(L().shared);
                  if (r === 'downloaded') toast(L().downloaded);
                } finally {
                  st.sending = false;
                }
              },
            },
            L().sendShare
          )
        : null
    );
  }

  function crisis() {
    return [
      h(
        'div',
        { class: 'crisis', role: 'alert' },
        h('h2', {}, L().crisisTitle),
        h('p', {}, L().crisisBody),
        helpList(h, getLang()),
        h('p', { class: 'muted small' }, L().crisisKept)
      ),
      h(
        'div',
        { class: 'actions left wrap' },
        st.onContinue
          ? h(
              'button',
              {
                type: 'button',
                class: 'btn',
                'data-key': 'crisis-continue',
                onclick: () => {
                  const next = st.onContinue;
                  st.onContinue = null;
                  next();
                },
              },
              L().crisisContinue
            )
          : null,
        h(
          'button',
          {
            type: 'button',
            class: 'btn ghost',
            onclick: () => {
              st.onContinue = null;
              st.worry = '';
              st.kind = '';
              st.stage = 'card';
              flow.sync();
              onExit();
            },
          },
          L().crisisBack
        )
      ),
    ];
  }

  function view() {
    const stages = { worry, kind, tone, play: playView, postcard, crisis };
    const wrap = h('section', { class: 'view night' + (st.stage === 'play' ? ' playing' : '') });
    if (st.stage !== 'postcard')
      add(
        wrap,
        h('button', { type: 'button', class: 'link night-leave', 'data-key': 'night-leave', onclick: () => {
          stopAll(true);
          onExit();
        } }, L().leave)
      );
    add(wrap, (stages[st.stage] || worry)());
    flow.sync(true); // the ritual is on screen: it owns one history entry (js/flow-history.js)
    // help lines one tap away on every step, as in the lens exercise (playback stays uncluttered)
    if (st.stage !== 'crisis')
      add(
        wrap,
        h(
          'div',
          { class: 'lens-help' },
          h('span', {}, L().helpBar),
          h('button', { type: 'button', class: 'link', 'aria-expanded': st.helpOpen ? 'true' : 'false', 'data-key': 'night-help', onclick: () => {
            st.helpOpen = !st.helpOpen;
            rerender();
            const list = st.helpOpen && document.querySelector('.view.night .help-lines');
            if (list) list.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          } }, L().helpOpen)
        ),
        st.helpOpen ? helpList(h, getLang()) : null
      );
    return wrap;
  }

  // Leaving the Today tab stops the sound but keeps what was written, so coming back
  // picks up where the person was. A full reset is only for "delete all data".
  function stopAll(full = false) {
    st.run++;
    if (st.player) st.player.stop();
    st.player = null;
    if (full) {
      st.doneAt = null;
      st.nightAt = null;
      st.worry = '';
      st.kind = '';
      st.themes = [];
      st.track = null;
      st.stage = 'card';
      flow.sync();
    } else if (st.stage === 'play') st.stage = 'tone';
  }

  // The phone's Back button: one step back, never out of the tab or the app. On the first step
  // it does what "Leave the ritual" does; during a track it stops the sound and shows the
  // track list; on the postcard (the night is already saved) it is the same as Done.
  function goBack() {
    if (st.stage === 'kind') go('worry');
    else if (st.stage === 'tone') go('kind');
    else if (st.stage === 'play') {
      stopAll();
      go('tone');
    } else if (st.stage === 'crisis') {
      // back to the step the pause came from; what was written there is still in the field
      st.onContinue = null;
      go(st.crisisFrom === 'kind' ? 'kind' : 'worry');
    } else if (st.stage === 'postcard') done();
    else {
      stopAll(true);
      onExit();
    }
  }

  const flow = createFlowHistory({
    name: 'night',
    active: () => st.stage !== 'card',
    visible: () => !!document.querySelector('.view.night'),
    hashes: ['', '#', '#today'],
    back: goBack,
  });

  // active: a ritual step is on screen; busy: that, or a track is getting ready to play
  return { view, card, begin, active: () => st.stage !== 'card', busy: () => st.stage !== 'card' || st.preparing, stopAll };
}
