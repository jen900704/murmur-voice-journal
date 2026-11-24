// Smaller features around the core: gentle recommendations, the nights list and kindness
// jar in the Journal, a low-mood card on Today, and exchanging today's prompt with someone.
import { postcardSvg } from './postcard.js';
import { trackById } from './bedtime.js';
import { checkRisk, helpList } from './safety.js';

const S = {
  'zh-TW': {
    gentleTitle: '今晚來點溫柔的',
    orderNote: '排序會參考現在的時間和你最近記下的心情，只在這個裝置上計算。',
    typeLabel: '想看哪一種',
    toneLabel: '今晚想要的感覺（可不選）',
    more: (n) => `再看 ${n} 個`,
    exchangeHow: '寫下你的回答，用手機的分享功能傳給一個人。對方會收到你的回答，和一個連結，可以回答同一題再傳回給你。Murmur 不會經手或保存。',
    cancel: '取消',
    recsFailed: '片單沒有載入成功，請連上網路後再試一次。',
    gentleNote: '這些是有些人覺得溫柔、有陪伴感的作品，不是治療。清單由 Murmur 整理，可能有錯，歡迎回報。',
    all: '全部',
    types: { film: '電影', series: '影集', book: '書', musical: '音樂劇', opera: '歌劇', music: '音樂', short: '短片' },
    tones: { quiet: '安靜', warm: '溫暖', funny: '輕鬆好笑', 'good-cry': '想好好哭一場', companionship: '有人陪的感覺' },
    showHeavy: '也顯示內容較沉重的作品',
    cw: '內容提醒：',
    cwNames: { death: '死亡', illness: '疾病', abuse: '虐待', violence: '暴力', suicide: '自殺', 'self-harm': '自傷', 'mental illness': '精神疾病', grief: '哀傷', war: '戰爭', genocide: '大屠殺', bullying: '霸凌', infidelity: '外遇', divorce: '離婚', 'panic attacks': '恐慌發作', 'social anxiety': '社交焦慮', 'sexual content': '性內容', 'parent-child conflict': '親子衝突', 'workplace sexism': '職場性別歧視' },
    minutes: (m) => `${m} 分鐘`,
    close: '關閉',
    none: '沒有符合的作品。',
    modes: { voice: '聲音', nights: '夜晚', jar: '小罐子' },
    nightsEmpty: '還沒有夜晚的紀錄。晚上在「今天」可以開始睡前儀式。',
    jarTitle: '對自己好的小罐子',
    jarIntro: '你寫過的、對自己好的事。低潮的時候，可以從這裡抽一張。',
    jarEmpty: '小罐子還是空的。睡前儀式的第二步，可以放進今天對自己好的一件事。',
    draw: '抽一張',
    worry: '那天放下的心事',
    kind: '對自己好的一件事',
    track: '聽的是',
    delete: '刪除',
    confirmDelete: '確定刪除這個夜晚的紀錄嗎？',
    lowTitle: '最近好像比較沉重',
    lowBody: '你之前寫下的、對自己好的事：',
    lowBodyEmpty: '可以試試這些，也可以什麼都不做。',
    lowSmall: '心情低落時，有些人覺得這些小事有一點幫助。挑一件就好，不做也沒關係：',
    lowBreathe: '呼吸一分鐘',
    smallThings: ['喝一杯溫的東西', '看看窗外兩分鐘', '洗把臉，或沖個熱水澡', '傳個貼圖給一個人，或在喜歡的貼文按個讚', '喝點水，或吃一點東西', '把一個小地方收乾淨，例如桌角', '聽一首以前喜歡的歌', '換一套舒服的衣服', '白天的話，走到巷口再走回來', '摸摸寵物，或抱著一個軟的東西', '把明天最小的一件事寫下來，然後先放著', '早一點躺下，不用馬上睡著', '去便利商店買個熱的', '如果你有信仰，上個香、禱告或念一段經'],
    lowDismiss: '先不用',
    helpTitle: '想先讓你知道這些',
    helpBody: '你寫的筆記裡，有些字詞可能代表你現在很辛苦。筆記已經照常存在這個裝置上。如果你想找人說話，這些地方隨時都在。',
    helpBodyShare: '你寫的內容聽起來可能很沉重。把它傳給信任的人是很好的事；如果需要，這些地方也隨時都在。再按一次「分享」就會送出。',
    lowRitual: '睡前儀式',
    lowLens: '換個角度看看',
    lowHelp: '可以找人說話的地方',
    exchange: '寫下來，和別人交換這一題',
    exchangePlaceholder: '我的回答……',
    exchangeShare: '分享',
    exchangeCopied: '已複製，可以貼給對方',
    exchangeFrom: '有人想和你交換這一題',
    exchangeText: (p, a, url) => `今天的題目：${p}\n\n我的回答：${a}\n\n你也來回答同一題：${url}`,
  },
  en: {
    recsFailed: 'The list did not load. Please try again when you are online.',
    exchangeHow: 'Write your answer and send it to one person with your phone\'s share sheet. They get your answer and a link to answer the same prompt and send it back. Murmur does not pass it on or keep it.',
    cancel: 'Cancel',
    typeLabel: 'What kind',
    toneLabel: 'The feeling you want tonight (optional)',
    more: (n) => `Show ${n} more`,
    orderNote: 'The order takes the time of day and your latest mood check-in into account, worked out on this device.',
    gentleTitle: 'Something gentle for tonight',
    gentleNote: 'Works some people find gentle or companionable. This is not treatment. The list was put together for Murmur and may contain mistakes; please report them.',
    all: 'All',
    types: { film: 'Films', series: 'Series', book: 'Books', musical: 'Musicals', opera: 'Opera', music: 'Music', short: 'Short films' },
    tones: { quiet: 'Quiet', warm: 'Warm', funny: 'Light and funny', 'good-cry': 'A good cry', companionship: 'Feels like company' },
    showHeavy: 'Also show works with heavier content',
    cw: 'Content notes: ',
    cwNames: {},
    minutes: (m) => `${m} min`,
    close: 'Close',
    none: 'Nothing matches.',
    modes: { voice: 'Voice', nights: 'Nights', jar: 'Kindness jar' },
    nightsEmpty: 'No nights yet. In the evening, start the bedtime ritual from Today.',
    jarTitle: 'Kindness jar',
    jarIntro: 'Kind things you have done for yourself. On a low day, draw one from here.',
    jarEmpty: 'The jar is empty. Step two of the bedtime ritual adds one kind thing you did for yourself today.',
    draw: 'Draw one',
    worry: 'What you set down',
    kind: 'One kind thing for yourself',
    track: 'Track',
    delete: 'Delete',
    confirmDelete: 'Delete this night?',
    lowTitle: 'Things seemed heavy lately',
    lowBody: 'Kind things you wrote down before:',
    lowBodyEmpty: 'You could try one of these, or nothing at all.',
    lowSmall: 'Small things many people say help a little when they feel low. Pick one, or none:',
    lowBreathe: 'Breathe for a minute',
    smallThings: ['Drink something warm', 'Look out of a window for two minutes', 'Wash your face or take a warm shower', 'Send a sticker to someone, or like a post you enjoyed', 'Drink some water, or eat a little', 'Clear one small spot, like a corner of the desk', 'Play a song you used to love', 'Change into something comfortable', 'In the daytime, walk to the end of the street and back', 'Pet an animal, or hold something soft', 'Write down the smallest task for tomorrow, then leave it', 'Lie down a little early; no need to fall asleep right away', 'Get something warm from a convenience store', 'If you have a faith, pray, light incense, or read a passage'],
    lowDismiss: 'Not now',
    helpTitle: 'Before you go on',
    helpBody: 'Some words in your note can mean things are very hard right now. The note was saved on this device as usual. If you want to talk to someone, these are always available.',
    helpBodyShare: 'What you wrote sounds like it may be heavy. Sending it to someone you trust is a good thing to do; if you need more, these are always available. Tap Share again to send it.',
    lowRitual: 'Bedtime ritual',
    lowLens: 'Look through a theory lens',
    lowHelp: 'Where to find someone to talk to',
    exchange: 'Swap answers with someone',
    exchangePlaceholder: 'My answer…',
    exchangeShare: 'Share',
    exchangeCopied: 'Copied. Paste it to them.',
    exchangeFrom: 'Someone wants to swap answers to this prompt with you',
    exchangeText: (p, a, url) => `Today's prompt: ${p}\n\nMy answer: ${a}\n\nAnswer it too: ${url}`,
  },
};

const HEAVY = new Set(['suicide', 'self-harm', 'abuse', 'genocide', 'violence', 'mental illness', 'war', 'sexual content']);
const TYPE_HUE = { film: 262, series: 200, book: 28, musical: 340, opera: 300, music: 160, short: 90 };

export function createExtras({ h, add, getLang, render, toast, db, getState, openSheet, closeSheet, goLens, startRitual, openBreathe }) {
  const L = () => S[getLang()] || S.en;
  const ex = { recs: null, type: 'all', tone: null, heavy: false, nights: [], loaded: false, jarPick: null, exchangeOpen: false, exchangeText: '' };

  async function loadNights() {
    ex.nights = await db.listNights().catch(() => []);
    ex.loaded = true;
    ex.jarPickFor = null; // a deleted night's kind thing must not linger on the low-mood card
  }

  // ---------- recommendations ----------
  async function openGentle() {
    if (!ex.recs) {
      try {
        ex.recs = (await fetch('./data/recs.json').then((r) => r.json())).items;
      } catch (_) {
        // not cached, so the next tap tries again
        toast(L().recsFailed);
        return;
      }
    }
    openSheet(gentleBody);
  }

  // Order for right now: shorter things late at night, gentler ones after a low check-in, and a
  // daily shuffle so the top of the list changes from day to day. Everything stays on the device.
  function forNow(list) {
    const entries = (getState && getState().entries) || [];
    let mood = null;
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (!e.demo && Number.isFinite(e.mood)) {
        if (Date.now() - e.createdAt < 36 * 3600 * 1000) mood = e.mood;
        break;
      }
    }
    const hour = new Date().getHours();
    const late = hour >= 20 || hour < 4;
    const day = new Date().toDateString();
    const jitter = (id) => {
      let x = 0;
      for (const c of day + id) x = (x * 31 + c.charCodeAt(0)) >>> 0;
      return (x % 1000) / 1000;
    };
    const score = (it) => {
      let s = jitter(it.id);
      if (late) s += it.minutes && it.minutes <= 60 ? 1.5 : it.minutes > 150 ? -1 : 0;
      if (mood !== null && mood <= 3) s += it.tones.some((t) => t === 'warm' || t === 'companionship' || t === 'quiet') ? 2 : 0;
      if (mood !== null && mood <= 2 && it.tones.includes('good-cry')) s -= 1;
      if (mood !== null && mood >= 5 && it.tones.includes('funny')) s += 1;
      return s;
    };
    return [...list].sort((a, b) => score(b) - score(a));
  }

  function gentleBody(rerender) {
    const items = forNow(ex.recs.filter((it) => (ex.type === 'all' || it.type === ex.type) && (!ex.tone || it.tones.includes(ex.tone)) && (ex.heavy || !it.cw.some((c) => HEAVY.has(c)))));
    const chip = (on, label, onclick) => h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick }, label);
    const lang = getLang();
    return [
      h('h2', {}, L().gentleTitle),
      h('p', { class: 'muted small' }, L().gentleNote, ' ', L().orderNote),
      h('p', { class: 'lens-label', id: 'recs-type' }, L().typeLabel),
      h('div', { class: 'chips wrap', role: 'group', 'aria-labelledby': 'recs-type' }, chip(ex.type === 'all', L().all, () => ((ex.type = 'all'), (ex.showAll = false), rerender())), Object.keys(L().types).map((k) => chip(ex.type === k, L().types[k], () => ((ex.type = k), (ex.showAll = false), rerender())))),
      h('p', { class: 'lens-label', id: 'recs-tone' }, L().toneLabel),
      h('div', { class: 'chips wrap', role: 'group', 'aria-labelledby': 'recs-tone' }, Object.keys(L().tones).map((k) => chip(ex.tone === k, L().tones[k], () => ((ex.tone = ex.tone === k ? null : k), (ex.showAll = false), rerender())))),
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: ex.heavy, onchange: (e) => ((ex.heavy = e.target.checked), (ex.showAll = false), rerender()) }), h('span', {}, L().showHeavy)),
      items.length ? null : h('p', { class: 'empty' }, L().none),
      h(
        'div',
        { class: 'recs' },
        // a short list first; the rest on request, so the sheet is not endless at bedtime
        (ex.showAll ? items : items.slice(0, 6)).map((it) => {
          const main = (lang === 'en' ? it.title.en : it.title.zh) || it.title.orig || it.title.en;
          const sub = [it.title.orig !== main ? it.title.orig : null, it.creator, it.year].filter(Boolean).join(' · ');
          const cwNames = it.cw.map((c) => L().cwNames[c] || c);
          return h(
            'article',
            { class: 'rec', style: `--lens-hue:${TYPE_HUE[it.type] || 200}` },
            h('div', { class: 'rec-tile', 'aria-hidden': 'true' }, (main || '?').slice(0, 1)),
            h(
              'div',
              {},
              h('h3', {}, main),
              h('p', { class: 'muted small' }, L().types[it.type], ' · ', sub, it.minutes ? ` · ${L().minutes(it.minutes)}` : ''),
              h('p', { class: 'small' }, it.why[lang === 'en' ? 'en' : 'zh']),
              cwNames.length ? h('p', { class: 'small rec-cw' }, L().cw, cwNames.join(lang === 'en' ? ', ' : '、')) : null
            )
          );
        })
      ),
      h(
        'div',
        { class: 'actions left wrap' },
        !ex.showAll && items.length > 6 ? h('button', { type: 'button', class: 'btn', 'data-key': 'recs-more', onclick: () => ((ex.showAll = true), rerender()) }, L().more(items.length - 6)) : null,
        h('button', { type: 'button', class: 'btn ghost', onclick: closeSheet }, L().close)
      ),
    ];
  }

  // ---------- journal: nights and jar ----------
  function modeChips(mode, setMode) {
    return h(
      'div',
      { class: 'seg journal-modes', role: 'tablist' },
      ['voice', 'nights', 'jar'].map((m) =>
        h('button', { type: 'button', role: 'tab', 'aria-selected': mode === m ? 'true' : 'false', class: 'seg-btn' + (mode === m ? ' on' : ''), 'data-key': `jmode-${m}`, onclick: () => setMode(m) }, L().modes[m])
      )
    );
  }

  function nightCardSvg(n) {
    const date = new Intl.DateTimeFormat(getLang(), { dateStyle: 'long' }).format(new Date(n.createdAt));
    const zh = n.lang !== 'en';
    return postcardSvg({
      seed: n.seed,
      line: n.kindness || (zh ? '今晚就到這裡。' : 'That is enough for tonight.'),
      label: n.kindness ? (zh ? '今天對自己好的一件事' : 'One kind thing I did for myself') : zh ? '晚安' : 'Good night',
      date,
    });
  }

  function nightsSection() {
    if (!ex.loaded) {
      loadNights().then(render);
      return [];
    }
    if (!ex.nights.length) return [h('p', { class: 'empty' }, L().nightsEmpty)];
    return [
      h(
        'div',
        { class: 'night-grid' },
        [...ex.nights].reverse().map((n) => {
          const b = h('button', { type: 'button', class: 'night-thumb', 'aria-label': new Intl.DateTimeFormat(getLang(), { dateStyle: 'long' }).format(new Date(n.createdAt)), onclick: () => openSheet((rr) => nightBody(n, rr)) });
          b.innerHTML = nightCardSvg(n);
          return b;
        })
      ),
    ];
  }

  function nightBody(n) {
    const card = h('div', { class: 'postcard' });
    card.innerHTML = nightCardSvg(n);
    const tr = n.track && trackById(n.track);
    return [
      card,
      n.worry ? [h('h3', {}, L().worry), h('blockquote', { class: 'detail-note' }, n.worry)] : null,
      n.kindness ? [h('h3', {}, L().kind), h('p', {}, n.kindness)] : null,
      tr ? h('p', { class: 'muted small' }, L().track, '：', tr[getLang() === 'en' ? 'en' : 'zh'].name) : null,
      h(
        'div',
        { class: 'actions left' },
        h('button', { type: 'button', class: 'btn', onclick: closeSheet }, L().close),
        h(
          'button',
          {
            type: 'button',
            class: 'btn danger',
            onclick: async () => {
              if (!confirm(L().confirmDelete)) return;
              await db.deleteNight(n.id);
              await loadNights();
              closeSheet();
              render();
            },
          },
          L().delete
        )
      ),
    ];
  }

  function jarItems() {
    return ex.nights.filter((n) => n.kindness).map((n) => ({ text: n.kindness, at: n.createdAt }));
  }

  function jarSection() {
    if (!ex.loaded) {
      loadNights().then(render);
      return [];
    }
    const items = jarItems();
    return [
      h('h2', {}, L().jarTitle),
      h('p', { class: 'muted small' }, L().jarIntro),
      items.length
        ? [
            h(
              'button',
              {
                type: 'button',
                class: 'btn',
                onclick: () => {
                  ex.jarPick = items[Math.floor(Math.random() * items.length)];
                  render();
                },
              },
              L().draw
            ),
            ex.jarPick ? h('div', { class: 'jar-pick', role: 'status' }, h('p', {}, ex.jarPick.text), h('p', { class: 'muted small' }, new Intl.DateTimeFormat(getLang(), { dateStyle: 'medium' }).format(new Date(ex.jarPick.at)))) : null,
            h('ul', { class: 'jar-list' }, [...items].reverse().map((it) => h('li', {}, h('span', {}, it.text), h('span', { class: 'muted small' }, new Intl.DateTimeFormat(getLang(), { month: 'numeric', day: 'numeric' }).format(new Date(it.at)))))),
          ]
        : h('p', { class: 'empty' }, L().jarEmpty),
    ];
  }

  // ---------- low mood ----------
  function lowMoodCard(latest) {
    if (!latest || !Number.isFinite(latest.mood) || latest.mood > 2) return null;
    if (ex.lowDismissed === latest.id) return null;
    try {
      if (localStorage.getItem('murmur-low-dismissed') === latest.id) return null;
    } catch (_) {
      /* storage unavailable */
    }
    if (Date.now() - latest.createdAt > 36 * 3600 * 1000) return null;
    if (!ex.loaded) {
      loadNights().then(render);
      return null;
    }
    const items = jarItems();
    // pick once per check-in, so the card does not reshuffle on every screen update
    if (!ex.jarPickFor || ex.jarPickFor.id !== latest.id) ex.jarPickFor = { id: latest.id, items: items.sort(() => Math.random() - 0.5).slice(0, 3) };
    const pick = ex.jarPickFor.items;
    // general small actions, not other users' posts: something outside oneself, with nothing to compare against
    if (!ex.smallPick || ex.smallPick.lang !== getLang()) {
      // no walking outside suggested late at night
      const late = new Date().getHours() >= 21 || new Date().getHours() < 6;
      const things = L().smallThings.filter((t) => !(late && /白天|daytime|便利商店|convenience/i.test(t)));
      ex.smallPick = { lang: getLang(), items: things.sort(() => Math.random() - 0.5).slice(0, 3) };
    }
    return h(
      'div',
      { class: 'low-card', role: 'note' },
      h('h3', {}, L().lowTitle),
      pick.length ? h('p', { class: 'small' }, L().lowBody) : null,
      pick.length ? h('ul', { class: 'plain-list' }, pick.map((p) => h('li', {}, p.text))) : null,
      h('p', { class: 'small' }, L().lowSmall),
      h('ul', { class: 'plain-list' }, ex.smallPick.items.map((t) => h('li', {}, t))),
      h(
        'div',
        { class: 'low-links' },
        // at the lowest rating, finding a person to talk to comes first
        latest.mood <= 1 ? h('button', { type: 'button', class: 'link', onclick: () => goLens('resources') }, L().lowHelp) : null,
        openBreathe ? h('button', { type: 'button', class: 'link', onclick: openBreathe }, L().lowBreathe) : null,
        h('button', { type: 'button', class: 'link', onclick: startRitual }, L().lowRitual),
        h('button', { type: 'button', class: 'link', onclick: () => goLens('home') }, L().lowLens),
        latest.mood <= 1 ? null : h('button', { type: 'button', class: 'link', onclick: () => goLens('resources') }, L().lowHelp),
        h('button', { type: 'button', class: 'link muted-link', onclick: () => {
          ex.lowDismissed = latest.id;
          try {
            localStorage.setItem('murmur-low-dismissed', latest.id);
          } catch (_) {
            /* storage unavailable */
          }
          render();
        } }, L().lowDismiss)
      )
    );
  }

  // ---------- exchange today's prompt ----------
  function exchangeBox(prompt, promptIndex, fromSomeone) {
    if (!ex.exchangeOpen && !fromSomeone) {
      return h('button', { type: 'button', class: 'link', 'data-key': 'exchange-open', onclick: () => ((ex.exchangeOpen = true), render()) }, L().exchange);
    }
    const ta = h('textarea', { rows: '3', maxlength: '600', placeholder: L().exchangePlaceholder, 'aria-label': L().exchangePlaceholder, 'data-key': 'exchange-text', oninput: (e) => (ex.exchangeText = e.target.value) });
    ta.value = ex.exchangeText;
    return h(
      'div',
      { class: 'exchange' },
      fromSomeone ? h('p', { class: 'small exchange-from' }, L().exchangeFrom) : null,
      h('p', { class: 'muted small' }, L().exchangeHow),
      ta,
      h(
        'div',
        { class: 'actions left wrap' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: async () => {
            const a = ex.exchangeText.trim();
            if (!a) return;
            // sharing with someone you trust is good; still make help visible first (once per text)
            if (checkRisk(a).risk && ex.helpShownFor !== a) {
              ex.helpShownFor = a;
              showHelp({ sharing: true });
              return;
            }
            const url = `${location.origin}${location.pathname}#ask=${promptIndex}`;
            const text = L().exchangeText(prompt, a, url);
            if (navigator.share) {
              try {
                await navigator.share({ text });
                return;
              } catch (e) {
                if (e && e.name === 'AbortError') return;
              }
            }
            try {
              await navigator.clipboard.writeText(text);
              toast(L().exchangeCopied);
            } catch (_) {
              toast(text);
            }
          },
        },
        L().exchangeShare
      ),
        fromSomeone
          ? null
          : h('button', { type: 'button', class: 'btn ghost', 'data-key': 'exchange-cancel', onclick: () => ((ex.exchangeOpen = false), render()) }, L().cancel)
      )
    );
  }

  function showHelp({ sharing = false } = {}) {
    openSheet(() => [
      h('h2', {}, L().helpTitle),
      h('p', {}, sharing ? L().helpBodyShare : L().helpBody),
      helpList(h, getLang()),
      h('button', { type: 'button', class: 'btn', onclick: closeSheet }, L().close),
    ]);
  }

  return { openGentle, modeChips, nightsSection, jarSection, lowMoodCard, exchangeBox, loadNights, showHelp };
}
