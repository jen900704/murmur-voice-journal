// Theory lens: a self-guided exercise that looks at one worry through a counseling theory.
// Offline: nothing typed here leaves the device, and nothing is saved unless asked.
import { LENSES, TOPICS, TOPIC_COMMON, lensById, lensesForTopic, fill, rewriteText, isNonAnswer } from './lenses.js';
import { checkRisk, helpList } from './safety.js';
import { createAiChat } from './ai-chat.js';
import { createFlowHistory } from './flow-history.js';

// The featured-row policy (js/policy.js) is optional and off by default. It is loaded on its
// own so the lens screens still work if that one file cannot be fetched.
const policyModule = import('./policy.js').catch(() => null);

const S = {
  'zh-TW': {
    title: '換個角度看看',
    drewTitle: '你抽到的是',
    redraw: '再抽一張',
    answerHint: '寫幾個字就好。想不到的話，寫「不知道」也可以。',
    moreAbout: '多了解這個學派',
    savedMore: '看完整內容',
    yourAnswers: '你當時的回答',
    saveFailed: '沒有存成功，請再試一次。',
    broken: '剛才那一頁出了問題，先回到這裡。你存下的練習都還在。',
    intro:
      '同一個煩惱，不同的諮商學派會問不同的問題。選一個角度，用 3 到 4 個問題重新看看這件事。這是幫助自己整理想法的練習，不是諮商或治療。',
    madeBy: '由諮商研究所學生製作，不是執業諮商心理師提供的服務，也沒有經過臨床驗證。',
    privacy: '你在這裡寫的內容不會離開這個裝置。沒有按「儲存」的話，關掉就消失；只會記下你用過哪些學派和給的評分。',
    privacyAi: '例外：你自己開啟並使用 AI 對話時，那次練習的內容會傳給 Anthropic。',
    start: '開始',
    deck: '理論卡',
    fit: '哪個角度適合我',
    saved: '我存下的練習',
    savedCount: (n) => (n ? `${n} 個` : '還沒有'),
    aiContinue: '和 AI 用這個角度繼續聊（實驗功能）',
    gentle: '溫柔的作品推薦（電影、書、音樂劇）',
    worryLabel: '用一兩句話寫下讓你在意的事',
    worryPlaceholder: '例如：我一直擔心報告做不好，晚上也睡不太好',
    topicLabel: '它比較接近哪一類？',
    topics: { work: '學業或工作', relationship: '伴侶或朋友', family: '家人', self: '自己（情緒、自我價值）', loss: '失落或悲傷', other: '其他' },
    next: '下一步',
    back: '上一步',
    choose: '要怎麼選角度？',
    draw: '抽一張卡',
    drawWhy: '隨機抽一個適合這類煩惱的學派',
    compare: '比較三個角度',
    compareWhy: '看三個學派各自會先問什麼，再選一個',
    pick: '自己選',
    pickTitle: '選一個角度',
    mostlyOpen: '這次的問題你大多先留白了，沒關係。下面的小練習一樣可以試。',
    pickCommon: '常用來看這類煩惱的',
    pickOthers: '其他角度',
    pickWhy: '從全部適合的學派裡挑',
    useThis: '用這個角度',
    stepOf: (i, n) => `第 ${i} 題，共 ${n} 題`,
    why: '為什麼這樣問',
    answerPlaceholder: '寫下你想到的，幾個字也可以',
    seeSummary: '看小結',
    noticed: '從這個角度看見的',
    experiment: '這週可以試試',
    concepts: '關鍵概念',
    misses: '這個角度可能忽略的',
    reading: (ch) => `想多了解：Corey《Theory and Practice of Counseling and Psychotherapy》原文第 10 版第 ${ch} 章（中譯本章節可能不同）`,
    people: '代表人物',
    talk: '這個練習可以幫你換個角度，但它取代不了和一個人好好談談。如果這件事已經讓你辛苦了一段時間，學校的諮商中心、公司的員工協助方案，或各縣市的社區心理衛生中心，都是很好的起點，很多是免費或低價的。',
    rateQ: '這個角度對你有幫助嗎？',
    rateLabels: ['沒什麼幫助', '', '普通', '', '很有幫助'],
    anotherLens: '換一個角度看同一件事',
    save: '儲存到這個裝置',
    savedToast: '已儲存，只存在這個裝置上',
    finish: '結束，不儲存',
    explored: (n) => (n ? `你看過 ${n} 種學派` : `${LENSES.length} 種學派`),
    times: (n) => `用過 ${n} 次`,
    notYet: '還沒用過',
    startWith: '用這個角度開始',
    fitEmpty: '用過幾個角度並評分之後，這裡會列出對你最有幫助的學派。',
    fitIntro: '依你的評分平均排序。這只是你自己的偏好，不代表哪個學派比較正確。',
    avg: (a, n) => `平均 ${a.toFixed(1)} 分（${n} 次）`,
    savedEmpty: '還沒有存下的練習。',
    delete: '刪除',
    confirmDelete: '確定刪除這筆練習嗎？',
    helpBar: '覺得這不只是一般的煩惱？',
    helpOpen: '求助專線',
    crisisTitle: '先停一下',
    crisisBody:
      '你寫的內容裡，有些字詞可能代表你現在很辛苦。如果是這樣，先找一個人說說話，可能會比這個練習更有幫助。',
    crisisCall: '你可以現在打給：',
    crisisKept: '你寫的內容還在，沒有被刪掉。如果這不是你的意思，可以繼續。',
    crisisContinue: '我不是那個意思，繼續',
    crisisBack: '結束這個練習（不儲存）',
    resourcesTitle: '求助資源',
    resourcesBody: '如果你或身邊的人有立即的危險，請直接打緊急電話。',
    topicHidden: '有些學派不適合用來看這類煩惱，所以沒有列出。',
  },
  en: {
    drewTitle: 'You drew',
    redraw: 'Draw again',
    answerHint: 'A few words are enough. If nothing comes, "not sure" is fine too.',
    moreAbout: 'More about this approach',
    savedMore: 'Show full exercise',
    yourAnswers: 'What you answered',
    saveFailed: 'Could not save. Please try again.',
    broken: 'That page ran into a problem, so you are back here. Saved exercises are still here.',
    title: 'Theory lens',
    intro:
      'Different counseling schools ask different questions about the same worry. Pick a lens and look at yours from a new angle in three or four questions. This is psychoeducation, not counseling or therapy.',
    madeBy: 'Made by a counseling graduate student. It is not a service from a licensed counselor and has not been clinically validated.',
    privacy: 'Nothing you write here leaves this device, and it disappears when you finish unless you choose Save. Only which lenses you used and your ratings are kept.',
    privacyAi: 'The exception: when you use the AI conversation, that exercise is sent to Anthropic.',
    start: 'Start',
    deck: 'Lens cards',
    fit: 'Which lens fits me',
    saved: 'My saved exercises',
    savedCount: (n) => (n ? `${n} saved` : 'None yet'),
    aiContinue: 'Keep talking with AI through this lens (experimental)',
    gentle: 'Gentle recommendations (films, books, musicals)',
    worryLabel: 'In a sentence or two, what is on your mind?',
    worryPlaceholder: 'For example: I keep worrying my report is not good enough, and I am not sleeping well',
    topicLabel: 'Which is it closest to?',
    topics: { work: 'School or work', relationship: 'Partner or friends', family: 'Family', self: 'Myself (feelings, self-worth)', loss: 'Loss or grief', other: 'Something else' },
    next: 'Next',
    back: 'Back',
    choose: 'How would you like to choose a lens?',
    draw: 'Draw a card',
    drawWhy: 'A random school that suits this kind of worry',
    compare: 'Compare three lenses',
    compareWhy: 'See what three schools would ask first, then pick one',
    pick: 'Choose myself',
    pickTitle: 'Choose a lens',
    mostlyOpen: 'You left most of these open this time, and that is fine. The small experiment below still works.',
    pickCommon: 'Often used for this kind of worry',
    pickOthers: 'Other lenses',
    pickWhy: 'Pick from every school that fits',
    useThis: 'Use this lens',
    stepOf: (i, n) => `Question ${i} of ${n}`,
    why: 'Why this question',
    answerPlaceholder: 'Write what comes to mind. A few words is fine',
    seeSummary: 'See summary',
    noticed: 'What this lens noticed',
    experiment: 'A small experiment',
    concepts: 'Key ideas',
    misses: 'What this lens might miss',
    reading: (ch) => `To read more: Corey, Theory and Practice of Counseling and Psychotherapy (10th ed.), chapter ${ch}`,
    people: 'Associated with',
    talk: 'This can help you see things differently, but it does not replace talking with a person. If this keeps weighing on you, campus counseling, an employee assistance program, or a community mental health center is a good place to start; many are free or low cost.',
    rateQ: 'Was this lens helpful?',
    rateLabels: ['Not at all', '', 'Somewhat', '', 'Very helpful'],
    anotherLens: 'Look at the same worry through another lens',
    save: 'Save on this device',
    savedToast: 'Saved on this device only',
    finish: 'Finish without saving',
    explored: (n) => (n ? `${n} of ${LENSES.length} tried` : `${LENSES.length} approaches`),
    times: (n) => `Used ${n} time${n === 1 ? '' : 's'}`,
    notYet: 'Not used yet',
    startWith: 'Start with this lens',
    fitEmpty: 'After you use and rate a few lenses, the ones you found most helpful will appear here.',
    fitIntro: 'Sorted by your average rating. This reflects your own preference, not which school is more correct.',
    avg: (a, n) => `Average ${a.toFixed(1)} (${n} time${n === 1 ? '' : 's'})`,
    savedEmpty: 'No saved exercises yet.',
    delete: 'Delete',
    confirmDelete: 'Delete this exercise?',
    helpBar: 'More than an everyday worry?',
    helpOpen: 'See where to get help',
    crisisTitle: 'Let us pause here',
    crisisBody:
      'Some words in what you wrote can mean things are very hard right now. If so, this exercise is not the right tool; you deserve to talk with a real person now, more than to look at things from a new angle.',
    crisisCall: 'You can reach:',
    crisisKept: 'What you wrote is still here; nothing was deleted. If this is not what you meant, you can carry on.',
    crisisContinue: 'I am okay, I meant something else. Continue',
    crisisBack: 'End this exercise (nothing saved)',
    resourcesTitle: 'Where to get help',
    resourcesBody: 'If you or someone near you is in immediate danger, call your emergency number.',
    topicHidden: 'Some schools are not suited to this kind of worry, so they are not listed.',
  },
};

const HUES = [262, 200, 28, 340, 160, 220, 120, 8, 300, 185, 45, 320, 95, 240];

export function createLensView({ h, add, getLang, rerender, toast, db, openGentle }) {
  const st = {
    stage: 'home',
    concern: '',
    topic: null,
    lensId: null,
    answers: [],
    step: 0,
    compare: [],
    rating: null,
    stats: {},
    sessions: [],
    loaded: false,
    // featured row: mod and store once loaded, optIn (undefined until asked), dec for this pick
    pol: { mod: null, store: null, optIn: undefined, dec: null, logCount: 0 },
  };
  const L = () => S[getLang()] || S.en;
  const PT = () => st.pol.mod.policyText(getLang());
  const lk = () => (getLang() === 'en' ? 'en' : 'zh');
  const ai = createAiChat({ h, add, getLang, db, onClose: () => go('summary') });

  // after "delete all data": forget what was loaded, so nothing deleted is shown or written back
  function reload() {
    reset();
    st.loaded = false;
    st.stats = {};
    st.sessions = [];
  }

  async function load() {
    if (st.loaded) return;
    st.stats = (await db.getSetting('lensStats', {}).catch(() => ({}))) || {};
    st.sessions = await db.listLensSessions().catch(() => []);
    st.aiEnabled = (await db.getSetting('aiEnabled', false).catch(() => false)) === true;
    const mod = await policyModule;
    if (mod) {
      const store = mod.createPolicyStore(db);
      st.pol = { mod, store, optIn: await store.optIn(), dec: null, logCount: (await store.getLog()).length };
    }
    st.loaded = true;
    rerender();
  }

  function go(stage) {
    st.stage = stage;
    rerender();
    window.scrollTo(0, 0);
    const hd = document.querySelector('.view.lens h2, .view.lens .lens-q');
    if (hd) {
      hd.setAttribute('tabindex', '-1');
      hd.focus({ preventScroll: true });
    }
  }

  function reset() {
    ai.abort();
    st.prevStage = null;
    st.concern = '';
    st.topic = null;
    st.lensId = null;
    st.answers = [];
    st.step = 0;
    st.compare = [];
    st.rating = null;
    st.riskSeen = false;
    st.pol.dec = null;
    st.counted = false;
  }

  // Text that suggests risk pauses the exercise and shows help. Nothing is deleted: if it
  // was something else (the check also matches some ordinary phrases), the person can go on.
  function guard(text, onContinue) {
    if (checkRisk(text).risk) {
      // from here on nothing in this exercise is used to adjust suggestions
      st.riskSeen = true;
      if (st.pol.store) st.pol.store.noteRisk();
      st.crisisFrom = st.stage;
      st.onContinue = onContinue;
      go('crisis');
      return false;
    }
    return true;
  }

  function startLens(id, fromPick = false) {
    // the featured-row decision belongs to the pick list; note which lens was actually opened
    const dec = st.pol.dec;
    if (dec && fromPick) {
      dec.used = id;
      st.pol.store.setUsed(dec.id, id).catch(() => {});
    } else st.pol.dec = null;
    st.lensId = id;
    st.answers = [];
    st.step = 0;
    st.rating = null;
    st.counted = false;
    go('step');
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function lensMark(lens, size = 44) {
    const hue = HUES[LENSES.indexOf(lens) % HUES.length];
    const n = 5 + (LENSES.indexOf(lens) % 4);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 44 44');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'lens-mark');
    svg.style.setProperty('--lens-hue', hue);
    for (let i = 0; i < n; i++) {
      const c = document.createElementNS(ns, 'ellipse');
      c.setAttribute('cx', 22);
      c.setAttribute('cy', 22);
      c.setAttribute('rx', 18);
      c.setAttribute('ry', 7);
      c.setAttribute('transform', `rotate(${(180 / n) * i} 22 22)`);
      svg.appendChild(c);
    }
    return svg;
  }

  function helpBar() {
    return h(
      'div',
      { class: 'lens-help' },
      h('span', {}, L().helpBar),
      h('button', { type: 'button', class: 'link', onclick: () => {
        st.prevStage = st.stage;
        go('resources');
      } }, L().helpOpen)
    );
  }

  function resourceList() {
    return helpList(h, getLang());
  }

  // ----- stages -----
  function home() {
    const explored = LENSES.filter((l) => st.stats[l.id] && st.stats[l.id].used).length;
    return [
      h('h2', {}, L().title),
      h('p', {}, L().intro),
      h('p', { class: 'muted small' }, L().madeBy, ' ', L().privacy, st.aiEnabled ? ' ' + L().privacyAi : ''),
      h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn primary', 'data-key': 'lens-start', onclick: () => go('concern') }, L().start)),
      h(
        'div',
        { class: 'lens-home-links' },
        h('button', { type: 'button', class: 'lens-link', onclick: () => go('deck') }, h('strong', {}, L().deck), h('span', {}, L().explored(explored))),
        h('button', { type: 'button', class: 'lens-link', onclick: () => go('fit') }, h('strong', {}, L().fit)),
        h('button', { type: 'button', class: 'lens-link', onclick: () => go('saved') }, h('strong', {}, L().saved), h('span', {}, L().savedCount(st.sessions.length))),
        openGentle ? h('button', { type: 'button', class: 'lens-link', onclick: openGentle }, h('strong', {}, L().gentle)) : null
      ),
      policyPanel(),
    ];
  }

  function concern(onNext) {
    const input = h('textarea', {
      id: 'lens-concern',
      rows: '3',
      maxlength: '400',
      placeholder: L().worryPlaceholder,
      'data-key': 'lens-concern',
      oninput: (e) => {
        st.concern = e.target.value;
        const b = document.querySelector('[data-key="lens-concern-next"]');
        if (b) b.disabled = !st.concern.trim() || !st.topic;
      },
    });
    input.value = st.concern;
    return [
      h('label', { class: 'lens-label', for: 'lens-concern' }, L().worryLabel),
      input,
      h('p', { class: 'lens-label', id: 'topic-label' }, L().topicLabel),
      h(
        'div',
        { class: 'chips wrap', role: 'radiogroup', 'aria-labelledby': 'topic-label' },
        TOPICS.map((tp) =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': st.topic === tp ? 'true' : 'false',
              class: 'chip' + (st.topic === tp ? ' on' : ''),
              'data-key': `topic-${tp}`,
              onclick: () => {
                st.topic = tp;
                rerender();
              },
            },
            L().topics[tp]
          )
        )
      ),
      h(
        'div',
        { class: 'actions left' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn primary',
            'data-key': 'lens-concern-next',
            disabled: !st.concern.trim() || !st.topic,
            onclick: () => {
              const next = () => (onNext ? onNext() : go('choose'));
              if (guard(st.concern, next)) next();
            },
          },
          L().next
        ),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => go('home') }, L().back)
      ),
    ];
  }

  function choose() {
    const pool = lensesForTopic(st.topic);
    const option = (label, why, onclick) => h('button', { type: 'button', class: 'lens-option', onclick }, h('strong', {}, label), h('span', {}, why));
    return [
      h('h2', {}, L().choose),
      h(
        'div',
        { class: 'lens-options' },
        option(L().draw, L().drawWhy, () => {
          // show what was drawn first, with a chance to draw again
          const others = pool.filter((l) => l.id !== st.drawn);
          st.drawn = shuffle(others.length ? others : pool)[0].id;
          go('drawn');
        }),
        option(L().compare, L().compareWhy, () => {
          st.compare = shuffle(pool).slice(0, 3).map((l) => l.id);
          go('compare');
        }),
        option(L().pick, L().pickWhy, openPick)
      ),
      pool.length < LENSES.length ? h('p', { class: 'muted small' }, L().topicHidden) : null,
      h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => go('concern') }, L().back)),
    ];
  }

  function lensCard(lens, { first = false, action, primary = false } = {}) {
    const c = lens[lk()];
    return h(
      'article',
      { class: 'lens-card', style: `--lens-hue:${HUES[LENSES.indexOf(lens) % HUES.length]}` },
      h('div', { class: 'lens-card-head' }, lensMark(lens), h('h3', {}, c.name)),
      h('p', { class: 'small' }, c.idea),
      first ? h('p', { class: 'lens-first' }, fill(c.steps[0].q, [])) : null,
      action ? h('button', { type: 'button', class: primary ? 'btn primary' : 'btn', onclick: action }, L().useThis) : null
    );
  }

  function compare() {
    return [
      h('h2', {}, L().compare),
      st.compare.map((id) => lensCard(lensById(id), { first: true, action: () => startLens(id) })),
      h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => go('choose') }, L().back)),
    ];
  }

  function drawn() {
    const lens = lensById(st.drawn);
    const pool = lensesForTopic(st.topic);
    return [
      h('h2', {}, L().drewTitle),
      lensCard(lens, { first: true, primary: true, action: () => startLens(lens.id) }),
      h(
        'div',
        { class: 'actions left wrap' },
        h('button', { type: 'button', class: 'btn ghost', 'data-key': 'lens-redraw', onclick: () => {
          const others = pool.filter((l) => l.id !== st.drawn);
          st.drawn = shuffle(others.length ? others : pool)[0].id;
          rerender();
        } }, L().redraw),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => go('choose') }, L().back)
      ),
    ];
  }

  // one compact row per lens (mark, name, first sentence of its idea); tapping starts it
  // the pick list's order: approaches often used for this kind of worry, then the other suitable ones
  function expertOrder(topic) {
    const all = lensesForTopic(topic);
    const common = (TOPIC_COMMON[topic] || []).map(lensById).filter((l) => l && all.includes(l));
    return { common, rest: all.filter((l) => !common.includes(l)) };
  }

  // Decides the one featured row, only when the person has switched this on. The safety gate
  // (risk language, a low latest mood, a loss) is worked out here, outside the learner; a gated
  // decision is simply the first lens of the usual order. If anything fails, no row is featured.
  async function featureForPick() {
    const p = st.pol;
    p.dec = null;
    p.whyOpen = false;
    if (!p.mod || p.optIn !== true) return; // off: nothing is decided and nothing is logged
    const { common, rest } = expertOrder(st.topic);
    const [entries, risk, evidence] = await Promise.all([db.listEntries(), p.store.recentRisk(), p.store.evidence('lens', st.topic)]);
    const gated = p.mod.gateReason({ optedIn: true, risk: st.riskSeen || risk, mood: p.mod.recentMood(entries), surface: 'lens', context: st.topic });
    const decision = p.mod.decide({ eligible: [...common, ...rest].map((l) => l.id), evidence, gated, seed: p.mod.newSeed() });
    if (!decision) return;
    const record = p.mod.makeRecord({ surface: 'lens', context: st.topic, decision });
    await p.store.log(record);
    p.logCount++;
    p.dec = { id: record.id, action: decision.action, gated: decision.gated, used: null };
  }

  async function openPick() {
    if (st.picking) return;
    st.picking = true;
    try {
      await featureForPick();
    } catch (_) {
      st.pol.dec = null;
    } finally {
      st.picking = false;
    }
    go('pick');
  }

  // tells the other screens (the low-mood note) that the switch or what was learned changed
  const policyChanged = () => window.dispatchEvent(new Event('murmur-policy'));

  // one line, shown until the person answers either way
  function policyOptInCard() {
    const p = st.pol;
    if (!p.mod || p.optIn !== undefined) return null;
    const answer = async (yes) => {
      p.optIn = yes;
      try {
        await p.store.setOptIn(yes);
        if (yes) await featureForPick();
      } catch (_) {
        p.dec = null;
      }
      policyChanged();
      rerender();
    };
    return h(
      'div',
      { class: 'policy-optin', 'data-key': 'policy-optin' },
      h('p', { class: 'muted small' }, PT().optInLine),
      h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn', 'data-key': 'policy-optin-yes', onclick: () => answer(true) }, PT().optInYes), h('button', { type: 'button', class: 'btn ghost', 'data-key': 'policy-optin-no', onclick: () => answer(false) }, PT().optInNo))
    );
  }

  function policyWhy(gated) {
    const p = st.pol;
    return [
      h('button', { type: 'button', class: 'link', 'data-key': 'policy-why', 'aria-expanded': p.whyOpen ? 'true' : 'false', onclick: () => ((p.whyOpen = !p.whyOpen), rerender()) }, PT().why),
      p.whyOpen ? h('p', { class: 'muted small', 'data-key': 'policy-why-body' }, gated ? PT().whyBodyLocked : PT().whyBody) : null,
    ];
  }

  // On the lens home page: the switch, what it does, the decision log as a file, and a reset.
  function policyPanel() {
    const p = st.pol;
    if (!p.mod) return null;
    return h(
      'details',
      { class: 'lens-more', 'data-key': 'policy-panel', open: p.panelOpen ? '' : null, ontoggle: (e) => (p.panelOpen = e.currentTarget.open) },
      h('summary', {}, PT().panelTitle),
      h('p', { class: 'muted small' }, PT().panelBody),
      h(
        'label',
        { class: 'toggle' },
        h('input', {
          type: 'checkbox',
          checked: p.optIn === true,
          'data-key': 'policy-toggle',
          onchange: async (e) => {
            p.optIn = e.target.checked;
            p.dec = null;
            await p.store.setOptIn(p.optIn).catch(() => {});
            policyChanged();
            rerender();
          },
        }),
        h('span', {}, PT().toggle)
      ),
      h('p', { class: 'muted small', 'data-key': 'policy-count' }, PT().logCount(p.logCount)),
      h(
        'div',
        { class: 'actions left wrap' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn',
            'data-key': 'policy-export',
            onclick: async () => {
              const log = (await p.store.getLog()).map(p.mod.cleanDecision).filter(Boolean);
              if (!log.length) return toast(PT().exportEmpty);
              const d = new Date();
              const name = `murmur-decisions-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.csv`;
              const url = URL.createObjectURL(new Blob(['\ufeff' + p.mod.decisionsCsv(log)], { type: 'text/csv' }));
              const a = h('a', { href: url, download: name });
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            },
          },
          PT().exportCsv
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn ghost',
            'data-key': 'policy-reset',
            onclick: async () => {
              if (!confirm(PT().resetConfirm)) return;
              try {
                await p.store.reset();
              } catch (_) {
                return toast(L().saveFailed);
              }
              p.dec = null;
              p.logCount = 0;
              policyChanged();
              toast(PT().resetDone);
              rerender();
            },
          },
          PT().reset
        )
      )
    );
  }

  function lensRow(lens) {
    const c = lens[lk()];
    // first sentence (no lookbehind: older Safari cannot parse it)
    const m = c.idea.match(lk() === 'en' ? /^.*?\.(?=\s|$)/ : /^.*?。/);
    const first = m ? m[0] : c.idea;
    return h(
      'button',
      { type: 'button', class: 'lens-row', 'data-key': `pick-${lens.id}`, style: `--lens-hue:${HUES[LENSES.indexOf(lens) % HUES.length]}`, onclick: () => startLens(lens.id, true) },
      lensMark(lens, 32),
      h('span', { class: 'lens-row-text' }, h('span', { class: 'lens-row-name' }, c.name), h('span', { class: 'lens-row-idea' }, first))
    );
  }

  function pick() {
    const order = expertOrder(st.topic);
    // the featured lens gets its own row on top; the others keep their usual order below it
    const dec = st.pol.dec;
    const featured = dec ? [...order.common, ...order.rest].find((l) => l.id === dec.action) : null;
    const common = order.common.filter((l) => l !== featured);
    const rest = order.rest.filter((l) => l !== featured);
    return [
      h('h2', {}, L().pickTitle),
      featured ? [h('h3', { class: 'lens-group' }, PT().featured), h('div', { class: 'lens-rows', 'data-key': 'policy-featured' }, lensRow(featured)), policyWhy(dec.gated)] : policyOptInCard(),
      common.length ? [h('h3', { class: 'lens-group' }, L().pickCommon), h('div', { class: 'lens-rows' }, common.map(lensRow)), h('h3', { class: 'lens-group' }, L().pickOthers)] : null,
      h('div', { class: 'lens-rows' }, rest.map(lensRow)),
      h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => go('choose') }, L().back)),
    ];
  }

  function step() {
    const lens = lensById(st.lensId);
    const c = lens[lk()];
    const s = c.steps[st.step];
    const n = c.steps.length;
    const prevAnswer = st.answers[st.step - 1];
    const answer = st.answers[st.step] ?? '';
    const isLast = st.step === n - 1;
    const advance = () => {
      const a = st.answers[st.step];
      if (a === undefined || a === null || String(a).trim() === '') return;
      const proceed = () => {
        st.stage = 'step';
        if (isLast) {
          // a lens counts as used once its exercise is finished, not when it is opened
          // (once: Back from the summary and Next again is still the same exercise)
          if (!st.counted) {
            st.counted = true;
            const s = (st.stats[st.lensId] = st.stats[st.lensId] || { used: 0, ratings: [] });
            s.used++;
            db.setSetting('lensStats', st.stats);
          }
          go('summary');
        }
        else {
          st.step++;
          rerender();
          const f = document.getElementById('lens-answer');
          if (f) f.focus();
        }
      };
      if (guard(String(a), proceed)) proceed();
    };
    let field;
    if (s.scale) {
      field = h(
        'div',
        { class: 'scale scale-11', role: 'radiogroup', 'aria-label': s.q },
        Array.from({ length: 11 }, (_, i) =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': String(answer) === String(i) ? 'true' : 'false',
              class: 'scale-num' + (String(answer) === String(i) ? ' on' : ''),
              'data-key': `scale-${i}`,
              onclick: () => {
                st.answers[st.step] = String(i);
                rerender();
              },
            },
            String(i)
          )
        )
      );
    } else {
      field = h('textarea', {
        id: 'lens-answer',
        rows: '3',
        maxlength: '400',
        placeholder: L().answerPlaceholder,
        'aria-labelledby': 'lens-q',
        oninput: (e) => {
          st.answers[st.step] = e.target.value;
          const btn = document.querySelector('[data-key="lens-next"]');
          if (btn) btn.disabled = !e.target.value.trim();
        },
      });
      field.value = answer;
    }
    return [
      h('div', { class: 'lens-step-head' }, lensMark(lens, 36), h('div', {}, h('p', { class: 'lens-name' }, c.name), h('p', { class: 'muted small' }, L().stepOf(st.step + 1, n)))),
      st.step === 0 ? h('blockquote', { class: 'lens-concern-quote' }, st.concern) : null,
      s.rewrite && prevAnswer ? h('p', { class: 'lens-rewrite' }, rewriteText(s.rewrite, prevAnswer, getLang())) : null,
      h('p', { class: 'lens-q', id: 'lens-q' }, fill(s.qZero && String(st.answers[0]) === '0' ? s.qZero : s.q, st.answers, { inQuestion: true })),
      h('details', { class: 'lens-why' }, h('summary', {}, L().why), h('p', {}, s.why)),
      field,
      field.tagName === 'TEXTAREA' ? h('p', { class: 'muted small lens-hint' }, L().answerHint) : null,
      h(
        'div',
        { class: 'actions left' },
        h('button', { type: 'button', class: 'btn primary', 'data-key': 'lens-next', disabled: !String(answer).trim(), onclick: advance }, isLast ? L().seeSummary : L().next),
        h(
          'button',
          {
            type: 'button',
            class: 'btn ghost',
            onclick: () => {
              if (st.step === 0) go('choose');
              else {
                st.step--;
                rerender();
              }
            },
          },
          L().back
        )
      ),
    ];
  }

  // when most written answers were left blank or "not sure", a sentence of dots helps no one
  function mostlyOpen(c, answers) {
    const typed = c.steps.map((s, i) => (s.scale ? null : answers[i])).filter((a) => a !== null);
    return typed.length > 0 && typed.filter(isNonAnswer).length * 2 > typed.length;
  }

  function summary() {
    const lens = lensById(st.lensId);
    const c = lens[lk()];
    const rate = (v) => {
      st.rating = v;
      rerender();
    };
    return [
      h(
        'article',
        { class: 'lens-summary', style: `--lens-hue:${HUES[LENSES.indexOf(lens) % HUES.length]}` },
        h('div', { class: 'lens-card-head' }, lensMark(lens), h('h2', {}, c.name)),
        h('h3', {}, L().noticed),
        h('p', {}, mostlyOpen(c, st.answers) ? L().mostlyOpen : fill(c.noticed, st.answers)),
        h('h3', {}, L().experiment),
        h('p', {}, fill(c.experiment, st.answers)),
        h('h3', {}, L().misses),
        h('p', {}, c.misses),
        // background on the approach, folded so rating and saving are close at hand
        h(
          'details',
          { class: 'lens-more' },
          h('summary', {}, L().moreAbout),
          h('h3', {}, L().concepts),
          h('p', { class: 'tags' }, c.concepts.map((k) => h('span', { class: 'tag' }, k))),
          h('p', { class: 'muted small' }, L().people, lk() === 'zh' ? '：' : ': ', (lk() === 'zh' && lens.peopleZh) || lens.people),
          h('p', { class: 'muted small' }, L().reading(lens.chapter))
        )
      ),
      h(
        'div',
        { class: 'lens-rate' },
        h('p', { id: 'rate-q' }, L().rateQ),
        h(
          'div',
          { class: 'scale', role: 'radiogroup', 'aria-labelledby': 'rate-q' },
          [1, 2, 3, 4, 5].map((v) =>
            h(
              'button',
              {
                type: 'button',
                role: 'radio',
                'aria-checked': st.rating === v ? 'true' : 'false',
                'aria-label': `${v}/5`,
                class: 'scale-num' + (st.rating === v ? ' on' : ''),
                'data-key': `rate-${v}`,
                onclick: () => rate(v),
              },
              String(v)
            )
          )
        ),
        h('div', { class: 'scale-ends', 'aria-hidden': 'true' }, h('span', {}, L().rateLabels[0]), h('span', {}, L().rateLabels[4]))
      ),
      h(
        'div',
        { class: 'actions left wrap' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn primary',
            'data-key': 'lens-save',
            disabled: st.saving,
            onclick: async () => {
              if (st.saving) return;
              st.saving = true;
              const session = {
                id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
                createdAt: Date.now(),
                lensId: lens.id,
                topic: st.topic,
                concern: st.concern,
                answers: st.answers.slice(),
                rating: st.rating,
              };
              try {
                await db.saveLensSession(session);
                st.sessions = await db.listLensSessions();
                toast(L().savedToast);
              } catch (_) {
                // keep the exercise on screen so nothing is lost; the person can try again
                toast(L().saveFailed);
                st.saving = false;
                return rerender();
              }
              st.saving = false;
              finish();
            },
          },
          L().save
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn',
            onclick: () => {
              commitRating();
              const keep = { concern: st.concern, topic: st.topic, riskSeen: st.riskSeen };
              reset();
              Object.assign(st, keep);
              go('choose');
            },
          },
          L().anotherLens
        ),
        h('button', { type: 'button', class: 'btn ghost', onclick: finish }, L().finish)
      ),
      st.aiEnabled
        ? h(
            'button',
            {
              type: 'button',
              class: 'link',
              'data-key': 'ai-open',
              onclick: () => {
                ai.open(lens.id, { concern: st.concern, answers: st.answers.slice() });
                go('ai');
              },
            },
            L().aiContinue
          )
        : null,
      // what this exercise is not, right under the buttons rather than between the summary and them
      h('p', { class: 'lens-talk' }, L().talk),
    ];
  }

  function commitRating() {
    // The exercise ends here. If it began from the pick list while suggestions were on, its
    // rating goes into the decision log (no rating stays "missing"), and it adjusts later
    // suggestions only when nothing risky was written and the latest mood is not low.
    const { dec, mod, store } = st.pol;
    st.pol.dec = null;
    if (dec && dec.used && dec.used === st.lensId && st.rating) {
      const rating = st.rating;
      const risky = st.riskSeen;
      db.listEntries()
        .then((entries) => store.rate(dec.id, { rating, allowLearning: !risky && !mod.isLowMood(mod.recentMood(entries)) }), () => store.rate(dec.id, { rating, allowLearning: false }))
        .catch(() => {});
    }
    if (!st.lensId || !st.rating) return;
    const s = (st.stats[st.lensId] = st.stats[st.lensId] || { used: 1, ratings: [] });
    s.ratings.push(st.rating);
    st.rating = null;
    db.setSetting('lensStats', st.stats);
  }

  function finish() {
    commitRating();
    reset();
    go('home');
  }

  function deck() {
    return [
      h('h2', {}, L().deck),
      h('p', { class: 'muted' }, L().explored(LENSES.filter((l) => st.stats[l.id] && st.stats[l.id].used).length)),
      h(
        'div',
        { class: 'deck' },
        LENSES.map((l) => {
          const used = (st.stats[l.id] && st.stats[l.id].used) || 0;
          return h(
            'button',
            {
              type: 'button',
              class: 'deck-card' + (used ? ' used' : ''),
              style: `--lens-hue:${HUES[LENSES.indexOf(l) % HUES.length]}`,
              onclick: () => {
                st.lensId = l.id;
                go('lensinfo');
              },
            },
            lensMark(l, 40),
            h('span', { class: 'deck-name' }, l[lk()].name),
            h('span', { class: 'deck-meta' }, used ? L().times(used) : L().notYet)
          );
        })
      ),
      h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => go('home') }, L().back)),
    ];
  }

  function lensInfo() {
    const l = lensById(st.lensId);
    const c = l[lk()];
    return [
      h(
        'article',
        { class: 'lens-summary', style: `--lens-hue:${HUES[LENSES.indexOf(l) % HUES.length]}` },
        h('div', { class: 'lens-card-head' }, lensMark(l), h('h2', {}, c.name)),
        h('p', {}, c.idea),
        h('h3', {}, L().concepts),
        h('p', { class: 'tags' }, c.concepts.map((k) => h('span', { class: 'tag' }, k))),
        h('h3', {}, L().misses),
        h('p', {}, c.misses),
        h('p', { class: 'muted small' }, L().people, lk() === 'zh' ? '：' : ': ', (lk() === 'zh' && l.peopleZh) || l.people),
        h('p', { class: 'muted small' }, L().reading(l.chapter))
      ),
      h(
        'div',
        { class: 'actions left' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn primary',
            onclick: () => {
              reset();
              st.pendingLens = l.id;
              go('concern-for-lens');
            },
          },
          L().startWith
        ),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => go('deck') }, L().back)
      ),
    ];
  }

  // Same as concern(), but goes straight to the chosen lens when it suits the topic.
  function concernForLens() {
    const lens = lensById(st.pendingLens);
    return concern(() => {
      if (lens.excludeTopics.includes(st.topic)) go('choose');
      else startLens(lens.id);
    });
  }

  function fit() {
    const rows = LENSES.map((l) => {
      const r = (st.stats[l.id] && st.stats[l.id].ratings) || [];
      const sum = r.reduce((a, b) => a + b, 0);
      // ranked by an average pulled toward the middle of the scale, so one rating of 5 does not
      // outrank many ratings near 5; the plain average and count are what is shown
      return { l, n: r.length, avg: r.length ? sum / r.length : 0, score: (sum + 3) / (r.length + 1) };
    })
      .filter((x) => x.n)
      .sort((a, b) => b.score - a.score || b.n - a.n);
    return [
      h('h2', {}, L().fit),
      rows.length ? h('p', { class: 'muted small' }, L().fitIntro) : h('p', { class: 'empty' }, L().fitEmpty),
      h(
        'ol',
        { class: 'fit-list' },
        rows.map((x) => h('li', { style: `--lens-hue:${HUES[LENSES.indexOf(x.l) % HUES.length]}` }, lensMark(x.l, 32), h('span', {}, x.l[lk()].name), h('span', { class: 'muted small' }, L().avg(x.avg, x.n))))
      ),
      h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => go('home') }, L().back)),
    ];
  }

  function saved() {
    return [
      h('h2', {}, L().saved),
      st.sessions.some((s) => lensById(s.lensId)) ? null : h('p', { class: 'empty' }, L().savedEmpty),
      [...st.sessions].reverse().map((s) => {
        const l = lensById(s.lensId);
        if (!l) return null; // from a lens that no longer exists; "delete all data" still removes it
        const c = l[lk()];
        return h(
          'article',
          { class: 'lens-summary compact', style: `--lens-hue:${HUES[LENSES.indexOf(l) % HUES.length]}` },
          h('div', { class: 'lens-card-head' }, lensMark(l, 32), h('h3', {}, c.name)),
          h('p', { class: 'muted small' }, new Intl.DateTimeFormat(getLang(), { dateStyle: 'medium' }).format(new Date(s.createdAt))),
          h('blockquote', { class: 'lens-concern-quote' }, s.concern),
          h('p', {}, mostlyOpen(c, s.answers) ? L().mostlyOpen : fill(c.noticed, s.answers)),
          h(
            'details',
            { class: 'lens-more' },
            h('summary', {}, L().savedMore),
            h('h4', {}, L().experiment),
            h('p', {}, fill(c.experiment, s.answers)),
            h('h4', {}, L().yourAnswers),
            h('ol', { class: 'plain-list' }, c.steps.map((stp, i) => h('li', {}, h('span', { class: 'muted small' }, stp.q), h('br'), String(s.answers[i] ?? '–'))))
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'btn danger small-btn',
              onclick: async () => {
                if (!confirm(L().confirmDelete)) return;
                await db.deleteLensSession(s.id);
                st.sessions = await db.listLensSessions();
                rerender();
              },
            },
            L().delete
          )
        );
      }),
      h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => go('home') }, L().back)),
    ];
  }

  function crisis() {
    return [
      h('div', { class: 'crisis', role: 'alert' }, h('h2', {}, L().crisisTitle), h('p', {}, L().crisisBody), h('p', { class: 'lens-label' }, L().crisisCall), resourceList(), h('p', { class: 'muted small' }, L().crisisKept)),
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
                  st.stage = st.crisisFrom || 'home';
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
              reset();
              st.onContinue = null;
              go('home');
            },
          },
          L().crisisBack
        )
      ),
    ];
  }

  function resources() {
    return [
      h('h2', {}, L().resourcesTitle),
      h('p', {}, L().resourcesBody),
      resourceList(),
      h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => go(st.prevStage || 'home') }, L().back)),
    ];
  }

  function view() {
    load();
    const stages = {
      home,
      concern: () => concern(),
      choose,
      drawn: () => (lensById(st.drawn) ? drawn() : choose()),
      compare,
      pick,
      step,
      summary,
      deck,
      lensinfo: lensInfo,
      'concern-for-lens': concernForLens,
      fit,
      saved,
      crisis,
      resources,
      ai: () => ai.view(rerender),
    };
    // stages that show a lens need one; anything stale falls back to the lens home page
    const needsLens = ['step', 'summary', 'ai'];
    if (needsLens.includes(st.stage) && !lensById(st.lensId)) st.stage = 'home';
    if (st.stage === 'concern-for-lens' && !lensById(st.pendingLens)) st.stage = 'home';
    const wrap = h('section', { class: 'view lens' });
    let body;
    try {
      body = (stages[st.stage] || home)();
    } catch (err) {
      // never leave the tab blank: go home and say something went wrong
      console.error(err);
      st.stage = 'home';
      body = [h('p', { class: 'error', role: 'alert' }, L().broken), ...home()];
    }
    add(wrap, body);
    // any page below the lens home owns one history entry; back on the home page it is removed
    flow.sync(true);
    if (st.stage !== 'crisis' && st.stage !== 'resources') add(wrap, helpBar());
    return wrap;
  }

  // The phone's Back button: what the Back button on each page does, so it never leaves the
  // Lens tab from inside an exercise. From the first page it goes to the lens home page, and
  // the worry typed so far stays in its field.
  function goBack() {
    const s = st.stage;
    if (s === 'choose') go('concern');
    else if (s === 'drawn' || s === 'compare' || s === 'pick') go('choose');
    else if (s === 'step') {
      if (st.step === 0) go('choose');
      else {
        st.step--;
        go('step');
      }
    } else if (s === 'summary') {
      // back to the last question, answers kept
      st.step = Math.max(0, lensById(st.lensId)[lk()].steps.length - 1);
      go('step');
    } else if (s === 'ai') ai.close(); // ends the chat as its own End button does
    else if (s === 'lensinfo') go('deck');
    else if (s === 'crisis') {
      st.onContinue = null;
      go(st.crisisFrom && st.crisisFrom !== 'crisis' ? st.crisisFrom : 'home');
    } else if (s === 'resources') go(st.prevStage && st.prevStage !== 'resources' ? st.prevStage : 'home');
    else go('home');
  }

  const flow = createFlowHistory({
    name: 'lens',
    active: () => st.stage !== 'home',
    visible: () => !!document.querySelector('.view.lens'),
    hashes: ['#lens'],
    back: goBack,
  });

  return {
    view,
    go,
    reset: () => {
      reset();
      st.stage = 'home';
      flow.sync();
    },
    setAiEnabled: (v) => (st.aiEnabled = v),
    // in the middle of an exercise or AI chat (not on the lens home page)
    active: () => {
      // on the help page, what matters is the page the person came from
      const stage = st.stage === 'resources' ? st.prevStage || 'home' : st.stage;
      return !['home', 'deck', 'saved', 'lensinfo', 'fit', 'resources', 'drawn', 'choose', 'pick', 'compare'].includes(stage) || !!st.concern.trim();
    },
    reload: () => {
      reload();
      st.stage = 'home';
      flow.sync();
    },
  };
}
