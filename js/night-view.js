// The bedtime ritual: set a worry down, note one kind thing, listen to a short wind-down
// track, and get a postcard. Every step can be skipped. No streaks, no reminders of missed days.
import { TRACKS, THEMES, trackById, buildScript, BedtimePlayer, pickVoice, voicesFor, voicesReady, unlockSpeech } from './bedtime.js';
import { postcardSvg, postcardPng, sharePng } from './postcard.js';
import { checkRisk, helpList } from './safety.js';

const S = {
  'zh-TW': {
    cardTitle: '睡前儀式',
    cardBody: '放下今天的心事，聽一段三到五分鐘的睡前引導，收一張小明信片。',
    cardStart: '開始',
    cardListen: '只想聽一段',
    leave: '離開睡前儀式',
    helpBar: '需要現在就找人說說話？',
    helpOpen: '求助專線',
    step: (i, n) => `${i} / ${n}`,
    worryTitle: '把今天的心事放下來',
    worryHelp: '寫幾句也好，不寫也可以。這些字只存在你的手機上。',
    worryPlaceholder: '今天讓我放不下的是……',
    themeLabel: '它比較像哪一類？（睡前引導只會提到類別，不會唸出你寫的字）',
    themes: { work: '工作或學業', relationship: '關係', family: '家人', health: '身體', future: '以後的事', unsure: '說不清楚' },
    keep: '存進心事日記',
    kindTitle: '今天對自己好的一件事',
    kindHelp: '再小都算：好好吃一餐、早點睡、拒絕一件事。',
    kindPlaceholder: '今天我……',
    kindIdeas: '以前你做過的：',
    toneTitle: '今晚想聽哪一種？',
    toneHelp: '每一段都是為 Murmur 寫的，靈感來自不同的諮商取向，不是治療。',
    surprise: '幫我選',
    playTitle: '把手機放在旁邊，讓螢幕亮著',
    pause: '暫停',
    resume: '繼續',
    stop: '結束',
    readAlong: '這台裝置沒有可用的中文語音，改成跟著文字慢慢讀。',
    voice: '聲音',
    voiceDefault: '自動選擇',
    preview: '試聽',
    cardDone: '今晚的明信片',
    kindLabel: '今天對自己好的一件事',
    nightLabel: '晚安',
    nightLine: '今晚就到這裡。',
    sendTitle: '寄一張晚安卡給一個人',
    sendHelp: '卡片上只會有你選的這句話，不會有你今晚寫的任何內容。',
    sendLines: ['晚安。今天辛苦了。', '想到你了。希望你今晚睡得好。', '明天見。先好好休息。'],
    savePng: '存成圖片或分享',
    done: '完成',
    gentle: '今晚來點溫和的作品',
    skip: '略過',
    skipTrack: '今晚不聽，直接收明信片',
    next: '下一步',
    back: '上一步',
    crisisTitle: '先停一下',
    crisisBody: '你寫的內容裡，有些字詞可能代表你現在很辛苦。如果是這樣，今晚比起睡前引導，你更值得和一個真人說說話。',
    crisisKept: '你寫的內容還在，沒有被刪掉。如果這不是你的意思，可以繼續。',
    crisisContinue: '我沒事，這是別的意思，繼續',
    crisisBack: '回到今天（不儲存）',
    shared: '已分享',
    downloaded: '已存成圖片',
  },
  en: {
    cardTitle: 'Bedtime ritual',
    cardBody: 'Set down today\'s worry, listen to a three to five minute wind-down, and get a small postcard.',
    cardStart: 'Start',
    cardListen: 'Just listen',
    leave: 'Leave the ritual',
    helpBar: 'Need to talk to someone now?',
    helpOpen: 'Help lines',
    step: (i, n) => `${i} of ${n}`,
    worryTitle: 'Set down what is on your mind',
    worryHelp: 'A few lines, or nothing at all. What you write stays on this phone.',
    worryPlaceholder: 'What I cannot put down tonight is…',
    themeLabel: 'What is it closest to? (The track only mentions the category, never your words.)',
    themes: { work: 'Work or school', relationship: 'A relationship', family: 'Family', health: 'My body', future: 'What comes next', unsure: 'Hard to say' },
    keep: 'Keep it in my worry diary',
    kindTitle: 'One kind thing I did for myself today',
    kindHelp: 'Anything counts: a proper meal, going to bed early, saying no to something.',
    kindPlaceholder: 'Today I…',
    kindIdeas: 'Things you have done before:',
    toneTitle: 'What would you like to hear tonight?',
    toneHelp: 'Each track was written for Murmur, inspired by a counseling approach. None of them is therapy.',
    surprise: 'Choose for me',
    playTitle: 'Put the phone down nearby and leave the screen on',
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop',
    readAlong: 'No English voice is available on this device, so the track plays as slow read-along text.',
    voice: 'Voice',
    voiceDefault: 'Automatic',
    preview: 'Preview',
    cardDone: 'Tonight\'s postcard',
    kindLabel: 'One kind thing I did for myself',
    nightLabel: 'Good night',
    nightLine: 'That is enough for tonight.',
    sendTitle: 'Send a goodnight card to someone',
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
  },
};

export function isEvening(d = new Date()) {
  const hr = d.getHours();
  return hr >= 20 || hr < 4;
}

export function createNightView({ h, add, getLang, rerender, toast, db, onExit, latestMood, openGentle }) {
  const st = { stage: 'card', worry: '', theme: null, keep: true, kind: '', track: null, player: null, line: '', lineIndex: 0, paused: false, readAlong: false, postcard: null, jar: [], voiceName: null };
  const L = () => S[getLang()] || S.en;
  const lk = () => (getLang() === 'en' ? 'en' : 'zh');

  function go(stage) {
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

  // One tap from the card straight to a track, for nights when writing is too much.
  async function listenNow() {
    unlockSpeech(); // must run inside the tap, before any await
    await begin({ stay: true });
    await play(chooseFor());
  }

  async function begin({ stay = false } = {}) {
    st.helpOpen = false;
    st.worry = '';
    st.theme = null;
    st.kind = '';
    st.track = null;
    st.keep = (await db.getSetting('nightKeep', true).catch(() => true)) !== false;
    st.voiceName = await db.getSetting(`voice-${getLang()}`, null).catch(() => null);
    const nights = await db.listNights().catch(() => []);
    st.jar = nights.map((n) => n.kindness).filter(Boolean);
    st.finishing = false;
    voicesReady(); // start loading voices early
    if (!stay) go('worry');
  }

  // Pause with help instead of deleting; the person can carry on if it was something else.
  function guard(text, onContinue) {
    if (checkRisk(text).risk) {
      st.onContinue = onContinue;
      go('crisis');
      return false;
    }
    return true;
  }

  function stepHead(i, title, help) {
    return [h('p', { class: 'muted small night-step' }, L().step(i, 4)), h('h2', {}, title), help ? h('p', { class: 'muted small' }, help) : null];
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
    return h(
      'div',
      { class: 'night-card' + (isEvening() ? ' evening' : '') },
      h('div', { class: 'night-moon', 'aria-hidden': 'true' }),
      h('div', {}, h('h2', {}, L().cardTitle), h('p', {}, L().cardBody), h('div', { class: 'actions left wrap' }, h('button', { type: 'button', class: 'btn primary', 'data-key': 'night-start', onclick: () => begin() }, L().cardStart), h('button', { type: 'button', class: 'btn ghost night-listen', 'data-key': 'night-listen', onclick: listenNow }, L().cardListen)))
    );
  }

  function worry() {
    const ta = h('textarea', { id: 'night-worry', rows: '4', maxlength: '1000', placeholder: L().worryPlaceholder, oninput: (e) => (st.worry = e.target.value) });
    ta.value = st.worry;
    return [
      ...stepHead(1, L().worryTitle, L().worryHelp),
      ta,
      h('p', { class: 'lens-label', id: 'night-theme' }, L().themeLabel),
      h(
        'div',
        { class: 'chips wrap', role: 'radiogroup', 'aria-labelledby': 'night-theme' },
        THEMES.map((tm) =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': st.theme === tm ? 'true' : 'false',
              class: 'chip' + (st.theme === tm ? ' on' : ''),
              'data-key': `night-theme-${tm}`,
              onclick: () => {
                st.theme = st.theme === tm ? null : tm;
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
            db.setSetting('nightKeep', st.keep);
          },
        }),
        h('span', {}, L().keep)
      ),
      nav(() => {
        if (guard(st.worry, () => go('kind'))) go('kind');
      }, { back: () => { st.stage = 'card'; onExit(); } }),
    ];
  }

  function kind() {
    const input = h('input', { type: 'text', id: 'night-kind', maxlength: '120', placeholder: L().kindPlaceholder, oninput: (e) => (st.kind = e.target.value) });
    input.value = st.kind;
    const ideas = [...new Set(st.jar)].slice(-30).sort(() => Math.random() - 0.5).slice(0, 3);
    return [
      ...stepHead(2, L().kindTitle, L().kindHelp),
      input,
      ideas.length ? h('div', { class: 'jar-ideas' }, h('p', { class: 'muted small' }, L().kindIdeas), h('ul', { class: 'plain-list' }, ideas.map((k) => h('li', {}, k)))) : null,
      nav(() => {
        if (guard(st.kind, () => go('tone'))) go('tone');
      }, { back: () => go('worry') }),
    ];
  }

  function chooseFor() {
    const mood = latestMood();
    const gentle = ['person-centered', 'relaxation', 'acceptance'];
    const pool = mood !== null && mood <= 3 ? gentle : TRACKS.map((t) => t.id);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function tone() {
    return [
      ...stepHead(3, L().toneTitle, L().toneHelp),
      h(
        'div',
        { class: 'tracks' },
        TRACKS.map((t) =>
          h(
            'button',
            { type: 'button', class: 'track', 'data-key': `track-${t.id}`, onclick: () => play(t.id) },
            h('strong', {}, t[lk()].name),
            h('span', {}, t[lk()].style)
          )
        ),
        h('button', { type: 'button', class: 'track surprise', 'data-key': 'track-surprise', onclick: () => play(chooseFor()) }, h('strong', {}, L().surprise))
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
    if (st.player) st.player.stop();
    st.track = trackId;
    const lang = getLang();
    const script = buildScript(trackId, st.theme, lang);
    await voicesReady();
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
      h('div', { class: 'night-bar' }, h('div', { id: 'night-progress' })),
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
      const seed = `${now.toDateString()}-${st.track}-${st.kind}`;
      const date = new Intl.DateTimeFormat(getLang(), { dateStyle: 'long' }).format(now);
      const hasKind = st.kind.trim().length > 0;
      st.postcard = postcardSvg({
        seed,
        line: hasKind ? st.kind.trim() : L().nightLine,
        label: hasKind ? L().kindLabel : L().nightLabel,
        date,
      });
      const night = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        createdAt: Date.now(),
        theme: st.theme,
        worry: st.keep ? st.worry.trim() : '',
        kindness: st.kind.trim(),
        track: st.track,
        seed,
        lang: getLang(),
      };
      // the postcard still shows even if saving failed
      await db.saveNight(night).catch(() => {});
      go('postcard');
    } finally {
      st.finishing = false;
    }
  }

  function postcard() {
    const holder = h('div', { class: 'postcard', role: 'img', 'aria-label': L().cardDone });
    holder.innerHTML = st.postcard;
    return [
      h('h2', {}, L().cardDone),
      holder,
      h(
        'div',
        { class: 'actions left wrap' },
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
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn primary',
            'data-key': 'night-done',
            onclick: () => {
              st.stage = 'card';
              onExit();
            },
          },
          L().done
        )
      ),
      sendCard(),
      openGentle ? h('button', { type: 'button', class: 'link', onclick: () => openGentle() }, L().gentle) : null,
    ];
  }

  // A goodnight card for one person, through the phone's own share sheet. Only a fixed line
  // the person picks goes on it; never the worry or the kind thing. No feed, counts, or receipts.
  function sendCard() {
    const lines = L().sendLines;
    return h(
      'details',
      { class: 'send-card' },
      h('summary', { 'data-key': 'night-send' }, L().sendTitle),
      h('p', { class: 'muted small' }, L().sendHelp),
      h(
        'div',
        { class: 'chips wrap' },
        lines.map((line, i) =>
          h(
            'button',
            {
              type: 'button',
              class: 'chip',
              'data-key': `send-line-${i}`,
              onclick: async () => {
                const date = new Intl.DateTimeFormat(getLang(), { dateStyle: 'long' }).format(new Date());
                const svg = postcardSvg({ seed: `send-${Date.now()}`, line, label: getLang() === 'en' ? 'Good night' : '晚安', date });
                const png = await postcardPng(svg);
                const r = await sharePng(png, `goodnight-${new Date().toISOString().slice(0, 10)}.png`, line);
                if (r === 'shared') toast(L().shared);
                if (r === 'downloaded') toast(L().downloaded);
              },
            },
            line
          )
        )
      )
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
    // help lines one tap away on every step, as in the lens exercise (playback stays uncluttered)
    if (st.stage !== 'crisis' && st.stage !== 'play')
      add(
        wrap,
        h(
          'div',
          { class: 'lens-help' },
          h('span', {}, L().helpBar),
          h('button', { type: 'button', class: 'link', 'aria-expanded': st.helpOpen ? 'true' : 'false', 'data-key': 'night-help', onclick: () => {
            st.helpOpen = !st.helpOpen;
            rerender();
          } }, L().helpOpen)
        ),
        st.helpOpen ? helpList(h, getLang()) : null
      );
    return wrap;
  }

  // Leaving the Today tab stops the sound but keeps what was written, so coming back
  // picks up where the person was. A full reset is only for "delete all data".
  function stopAll(full = false) {
    if (st.player) st.player.stop();
    st.player = null;
    if (full) {
      st.worry = '';
      st.kind = '';
      st.theme = null;
      st.track = null;
      st.stage = 'card';
    } else if (st.stage === 'play') st.stage = 'tone';
  }

  return { view, card, begin, active: () => st.stage !== 'card', stopAll };
}
