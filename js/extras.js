// Smaller features around the core: gentle recommendations, the nights list and kindness
// jar in the Journal, a low-mood card on Today, and exchanging today's prompt with someone.
import { postcardSvg } from './postcard.js';
import { trackById } from './bedtime.js';
import { checkRisk, helpList } from './safety.js';

const S = {
  'zh-TW': {
    gentleTitle: '今晚來點溫和的',
    gentleNote: '這些是有些人覺得溫和、有陪伴感的作品，不是治療。片單由 Murmur 整理，可能有錯，歡迎回報。',
    all: '全部',
    types: { film: '電影', series: '影集', book: '書', musical: '音樂劇', opera: '歌劇', music: '音樂', short: '短片' },
    tones: { quiet: '安靜', warm: '溫暖', funny: '輕鬆好笑', 'good-cry': '想好好哭一場', companionship: '有人陪的感覺' },
    showHeavy: '也顯示內容較沉重的作品',
    cw: '內容提醒：',
    cwNames: { death: '死亡', illness: '疾病', abuse: '虐待', violence: '暴力', suicide: '自殺', 'self-harm': '自傷', 'mental illness': '精神疾病', grief: '失落', war: '戰爭', genocide: '大屠殺', bullying: '霸凌', infidelity: '外遇', divorce: '離婚', 'panic attacks': '恐慌發作', 'social anxiety': '社交焦慮', 'sexual content': '性內容', 'parent-child conflict': '親子衝突', 'workplace sexism': '職場性別歧視' },
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
    lowDismiss: '先不用',
    helpTitle: '想先讓你知道這些',
    helpBody: '你寫的筆記裡，有些字詞可能代表你現在很辛苦。筆記已經照常存在這個裝置上。如果你想找人說話，這些地方隨時都在。',
    helpBodyShare: '你寫的內容聽起來可能很沉重。把它傳給信任的人是很好的事；如果需要，這些地方也隨時都在。再按一次「分享」就會送出。',
    lowRitual: '睡前儀式',
    lowLens: '用理論透鏡看看',
    lowHelp: '找人說話的資源',
    exchange: '寫下來，和別人交換這一題',
    exchangePlaceholder: '我的回答……',
    exchangeShare: '分享',
    exchangeCopied: '已複製，可以貼給對方',
    exchangeFrom: '有人想和你交換這一題',
    exchangeText: (p, a, url) => `今天的小題：${p}\n\n我的回答：${a}\n\n你也來回答同一題：${url}`,
  },
  en: {
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
    lowDismiss: 'Not now',
    helpTitle: 'Before you go on',
    helpBody: 'Some words in your note can mean things are very hard right now. The note was saved on this device as usual. If you want to talk to someone, these are always available.',
    helpBodyShare: 'What you wrote sounds like it may be heavy. Sending it to someone you trust is a good thing to do; if you need more, these are always available. Tap Share again to send it.',
    lowRitual: 'Bedtime ritual',
    lowLens: 'Look through a theory lens',
    lowHelp: 'Where to find someone to talk to',
    exchange: 'Write it down and swap answers with someone',
    exchangePlaceholder: 'My answer…',
    exchangeShare: 'Share',
    exchangeCopied: 'Copied. Paste it to them.',
    exchangeFrom: 'Someone wants to swap answers to this prompt with you',
    exchangeText: (p, a, url) => `Today's prompt: ${p}\n\nMy answer: ${a}\n\nAnswer it too: ${url}`,
  },
};

const HEAVY = new Set(['suicide', 'self-harm', 'abuse', 'genocide', 'violence', 'mental illness']);
const TYPE_HUE = { film: 262, series: 200, book: 28, musical: 340, opera: 300, music: 160, short: 90 };

export function createExtras({ h, add, getLang, render, toast, db, getState, openSheet, closeSheet, goLens, startRitual }) {
  const L = () => S[getLang()] || S.en;
  const ex = { recs: null, type: 'all', tone: null, heavy: false, nights: [], loaded: false, jarPick: null, exchangeOpen: false, exchangeText: '' };

  async function loadNights() {
    ex.nights = await db.listNights().catch(() => []);
    ex.loaded = true;
  }

  // ---------- recommendations ----------
  async function openGentle() {
    if (!ex.recs) {
      try {
        ex.recs = (await fetch('./data/recs.json').then((r) => r.json())).items;
      } catch (_) {
        ex.recs = [];
      }
    }
    openSheet(gentleBody);
  }

  function gentleBody(rerender) {
    const items = ex.recs.filter((it) => (ex.type === 'all' || it.type === ex.type) && (!ex.tone || it.tones.includes(ex.tone)) && (ex.heavy || !it.cw.some((c) => HEAVY.has(c))));
    const chip = (on, label, onclick) => h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick }, label);
    const lang = getLang();
    return [
      h('h2', {}, L().gentleTitle),
      h('p', { class: 'muted small' }, L().gentleNote),
      h('div', { class: 'chips wrap' }, chip(ex.type === 'all', L().all, () => ((ex.type = 'all'), rerender())), Object.keys(L().types).map((k) => chip(ex.type === k, L().types[k], () => ((ex.type = k), rerender())))),
      h('div', { class: 'chips wrap' }, Object.keys(L().tones).map((k) => chip(ex.tone === k, L().tones[k], () => ((ex.tone = ex.tone === k ? null : k), rerender())))),
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: ex.heavy, onchange: (e) => ((ex.heavy = e.target.checked), rerender()) }), h('span', {}, L().showHeavy)),
      items.length ? null : h('p', { class: 'empty' }, L().none),
      h(
        'div',
        { class: 'recs' },
        items.map((it) => {
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
      h('button', { type: 'button', class: 'btn', onclick: closeSheet }, L().close),
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
    if (Date.now() - latest.createdAt > 36 * 3600 * 1000) return null;
    if (!ex.loaded) {
      loadNights().then(render);
      return null;
    }
    const items = jarItems();
    const pick = items.sort(() => Math.random() - 0.5).slice(0, 3);
    return h(
      'div',
      { class: 'low-card', role: 'note' },
      h('h3', {}, L().lowTitle),
      h('p', { class: 'small' }, pick.length ? L().lowBody : L().lowBodyEmpty),
      pick.length ? h('ul', { class: 'plain-list' }, pick.map((p) => h('li', {}, p.text))) : null,
      h(
        'div',
        { class: 'low-links' },
        h('button', { type: 'button', class: 'link', onclick: startRitual }, L().lowRitual),
        h('button', { type: 'button', class: 'link', onclick: () => goLens('home') }, L().lowLens),
        h('button', { type: 'button', class: 'link', onclick: () => goLens('resources') }, L().lowHelp),
        h('button', { type: 'button', class: 'link muted-link', onclick: () => ((ex.lowDismissed = latest.id), render()) }, L().lowDismiss)
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
      ta,
      h(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: async () => {
            const a = ex.exchangeText.trim();
            if (!a) return;
            // sharing with someone you trust is good; still make help visible first
            if (checkRisk(a).risk && !ex.helpShown) {
              ex.helpShown = true;
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
