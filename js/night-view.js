// The bedtime ritual: set a worry down, note one kind thing, listen to a short wind-down
// track, and get a postcard. Every step can be skipped. No streaks, no reminders of missed days.
import { TRACKS, THEMES, trackById, buildScript, BedtimePlayer, pickVoice, voicesFor } from './bedtime.js';
import { postcardSvg, postcardPng, sharePng } from './postcard.js';
import { checkRisk, RESOURCES } from './safety.js';

const S = {
  'zh-TW': {
    cardTitle: '睡前儀式',
    cardBody: '放下今天的心事，聽一段三到五分鐘的睡前引導，收一張小明信片。',
    cardStart: '開始',
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
    savePng: '存成圖片或分享',
    done: '完成',
    gentle: '今晚來點溫和的作品',
    skip: '略過',
    next: '下一步',
    back: '上一步',
    crisisTitle: '先停一下',
    crisisBody: '你寫的內容聽起來可能比一般的心事更沉重。今晚比起睡前引導，你更值得和一個真人說說話。',
    crisisNotSaved: '剛剛寫的內容沒有被儲存。',
    crisisBack: '回到今天',
    shared: '已分享',
    downloaded: '已存成圖片',
  },
  en: {
    cardTitle: 'Bedtime ritual',
    cardBody: 'Set down today\'s worry, listen to a three to five minute wind-down, and get a small postcard.',
    cardStart: 'Start',
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
    savePng: 'Save or share image',
    done: 'Done',
    gentle: 'Something gentle to watch or read',
    skip: 'Skip',
    next: 'Next',
    back: 'Back',
    crisisTitle: 'Let us pause here',
    crisisBody: 'What you wrote sounds like it may be heavier than an everyday worry. Tonight you deserve to talk with a real person, more than a wind-down track.',
    crisisNotSaved: 'Nothing you just wrote has been saved.',
    crisisBack: 'Back to Today',
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
  }

  async function begin() {
    st.worry = '';
    st.theme = null;
    st.kind = '';
    st.track = null;
    st.keep = (await db.getSetting('nightKeep', true).catch(() => true)) !== false;
    st.voiceName = await db.getSetting(`voice-${getLang()}`, null).catch(() => null);
    const nights = await db.listNights().catch(() => []);
    st.jar = nights.map((n) => n.kindness).filter(Boolean);
    go('worry');
  }

  function guard(text) {
    if (checkRisk(text).risk) {
      st.worry = '';
      st.kind = '';
      go('crisis');
      return false;
    }
    return true;
  }

  function stepHead(i, title, help) {
    return [h('p', { class: 'muted small night-step' }, L().step(i, 4)), h('h2', {}, title), help ? h('p', { class: 'muted small' }, help) : null];
  }

  function nav(onNext, { skip = true, back = null, nextLabel } = {}) {
    return h(
      'div',
      { class: 'actions left' },
      h('button', { type: 'button', class: 'btn primary', 'data-key': 'night-next', onclick: onNext }, nextLabel || L().next),
      back ? h('button', { type: 'button', class: 'btn ghost', onclick: back }, L().back) : null,
      skip ? null : null
    );
  }

  function card() {
    return h(
      'div',
      { class: 'night-card' + (isEvening() ? ' evening' : '') },
      h('div', { class: 'night-moon', 'aria-hidden': 'true' }),
      h('div', {}, h('h2', {}, L().cardTitle), h('p', {}, L().cardBody), h('button', { type: 'button', class: 'btn primary', 'data-key': 'night-start', onclick: begin }, L().cardStart))
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
        if (guard(st.worry)) go('kind');
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
        if (guard(st.kind)) go('tone');
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
      h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => go('kind') }, L().back)),
    ];
  }

  function play(trackId) {
    st.track = trackId;
    const lang = getLang();
    const script = buildScript(trackId, st.theme, lang);
    const voice = pickVoice(lang === 'en' ? 'en' : 'zh', st.voiceName);
    st.readAlong = !voice;
    st.paused = false;
    st.line = '';
    st.lineIndex = 0;
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
    st.player.start();
  }

  function playView() {
    const t = trackById(st.track)[lk()];
    const voices = voicesFor(getLang() === 'en' ? 'en' : 'zh');
    return h(
      'div',
      { class: 'night-play' },
      h('p', { class: 'night-track' }, t.name, h('span', {}, ' · ', t.style)),
      h('div', { class: 'breath', 'aria-hidden': 'true' }),
      h('p', { class: 'night-line', id: 'night-line', 'aria-live': 'polite' }, st.line || '…'),
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
                  st.player.stop();
                  play(st.track);
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
    if (st.stage !== 'play') return;
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
    await db.saveNight(night).catch(() => {});
    go('postcard');
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
      openGentle ? h('button', { type: 'button', class: 'link', onclick: () => openGentle({ night: true }) }, L().gentle) : null,
    ];
  }

  function crisis() {
    const list = RESOURCES[getLang()] || RESOURCES.en;
    return [
      h(
        'div',
        { class: 'crisis', role: 'alert' },
        h('h2', {}, L().crisisTitle),
        h('p', {}, L().crisisBody),
        h('ul', { class: 'resource-list' }, list.map((r) => h('li', {}, h('span', {}, r.label), r.number ? h('a', { class: 'btn call', href: `tel:${r.number}` }, r.display || r.number) : null))),
        h('p', { class: 'muted small' }, L().crisisNotSaved)
      ),
      h(
        'div',
        { class: 'actions left' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn ghost',
            onclick: () => {
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
    add(wrap, (stages[st.stage] || worry)());
    return wrap;
  }

  function stopAll() {
    if (st.player) st.player.stop();
    st.stage = 'card';
  }

  return { view, card, begin, active: () => st.stage !== 'card', stopAll };
}
