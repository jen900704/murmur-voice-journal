// Theory lens: a self-guided exercise that looks at one worry through a counseling theory.
// Offline: nothing typed here leaves the device, and nothing is saved unless asked.
import { icon } from './icons.js';
import { LENSES, TOPICS, lensById, lensesForTopics, commonForTopics, answerRows, fill, rewriteText, quote, isNonAnswer } from './lenses.js';
import { cardSvg, postcardPng, sharePng } from './postcard.js';
import { readScene, sceneNotes } from './scene.js';
import { suggestLenses, heavinessShift, onlyHere, relatedSessions } from './lens-insight.js';
import { checkRisk, helpList } from './safety.js';
import { createAiChat, callModel, MODELS } from './ai-chat.js';
import { pickProvider, adaptQuestions, personalSummary } from './lens-llm.js';
import { lookBack } from './lookback.js';
import { sceneFromSpec, sceneSvg } from './scene.js';
import { fitText } from './postcard.js';
import { stripCitations } from './rag.js';
import { createFlowHistory } from './flow-history.js';
import { mascot, setMascot } from './mascot.js';

// The featured-row policy (js/policy.js) is optional and off by default. It is loaded on its
// own so the lens screens still work if that one file cannot be fetched.
const policyModule = import('./policy.js').catch(() => null);

const S = {
  'zh-TW': {
    title: '換個角度看看',
    drewTitle: '你抽到的是',
    redraw: '再抽一張',
    moreAbout: '多了解這個學派',
    savedMore: '這個角度的看法和小練習',
    plan: {
      label: '想試的話，打算在什麼時候？（可不填）',
      placeholder: '例如：下次開會前五分鐘',
      checkTitle: '上次你打算試試的：',
      answers: { tried: '試了', notYet: '還沒', notForMe: '不適合我' },
      thanks: { tried: '記下來了。', notYet: '沒關係，記下來了。', notForMe: '知道了，這個不適合也很正常。' },
    },
    map: {
      title: (n, k) => `回頭看：${n} 次練習，用過 ${k} 個角度`,
      note: (m) => `只是整理你自己的紀錄，不代表哪個取向比較有效。前後輕重至少有 ${m} 次才算平均。`,
      row: (r) => [`${r.sessions} 次`, r.withShift ? `輕了 ${r.lighter}・差不多 ${r.same}・重了 ${r.heavier}` : null, r.meanShift !== null ? `平均 ${r.meanShift > 0 ? '+' : ''}${r.meanShift}` : null, r.meanRating !== null ? `幫助程度平均 ${r.meanRating}` : null].filter(Boolean).join('，'),
    },
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
    gentle: '溫柔的作品推薦',
    homeLine: '心裡有什麼事？換個角度看看。',
    stays: '寫的內容只留在這台裝置上',
    about: '關於這個練習',
    worryLabel: '什麼事讓你在意？',
    worryPlaceholder: '一句話就好',
    topicLabel: '比較像哪一類？可以選好幾個',
    heavyAsk: '現在感覺有多重？',
    heavySlide: '拖動來選',
    skip: '跳過',
    stageOf: (i, n) => `第 ${i} 步，共 ${n} 步`,
    pickAll: (n) => `看全部 ${n} 個`,
    dunno: '不知道也可以',
    dunnoValue: '不知道',
    doneLine: '寫完了，這是這次的小卡',
    seeAll: (n) => `看全部 ${n} 題`,
    seeLess: '收起',
    more: '更多',
    close: '關閉',
    topics: { work: '學業或工作', relationship: '伴侶或朋友', family: '家人', self: '自己（情緒、自我價值）', loss: '失落或悲傷', other: '其他' },
    next: '下一步',
    back: '上一步',
    choose: '試試這幾個角度',
    draw: '抽一張卡',
    compare: '比較三個角度',
    pickTitle: '選一個角度',
    pickCommon: '常用來看這類煩惱的',
    pickOthers: '其他角度',
    useThis: '用這個角度',
    stepOf: (i, n) => `第 ${i} 題，共 ${n} 題`,
    why: '為什麼這樣問',
    answerPlaceholder: '寫下你想到的，幾個字也可以',
    seeSummary: '看小結',
    wrote: '你寫下的',
    leftOpen: '（先留白）',
    allOpen: '（這次每一題都先留白）',
    perspective: '這個角度會怎麼看',
    tryThis: '可以試試',
    aiNote: '這一頁只照原樣列出你寫的內容，不會解讀它。想針對你寫的內容聊，可以用下面的 AI 對話。',
    concepts: '關鍵概念',
    misses: '這個角度可能忽略的',
    reading: (ch) => `想多了解：Corey《Theory and Practice of Counseling and Psychotherapy》原文第 10 版第 ${ch} 章（中譯本章節可能不同）`,
    people: '代表人物',
    talk: '這個練習可以幫你換個角度，但它取代不了和一個人好好談談。如果這件事已經讓你辛苦了一段時間，學校的諮商中心、公司的員工協助方案，或各縣市的社區心理衛生中心，都是很好的起點，很多是免費或低價的。',
    rateQ: '這個角度對你有幫助嗎？',
    rateLabels: ['沒什麼幫助', '有一點', '普通', '有幫助', '很有幫助'],
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
    heavyAfterQ: '寫完之後，現在呢？',
    heavyEnds: ['0 很輕', '10 很重'],
    heavyLighter: '這是寫完之後此刻的感覺，之後還可能再變。',
    heavySame: '數字沒有變也很常見，看清楚一件事不一定會讓它變輕。',
    heavyHeavier: '有時候看清楚反而更重，這也很常見。',
    cardAlt: (name) => `一張從你寫的話畫出來的小卡，角度是「${name}」`,
    cardNotes: '這張圖從哪裡來',
    cardSave: '存成圖片',
    cardSaveFailed: '沒辦法存成圖片，請再試一次。',
    suggestTitle: '從你寫的話看，這些角度可能合適',
    because: '因為你寫了',
    relatedLine: (date, name) => `你在 ${date} 用「${name}」看過類似的事`,
    relatedOpen: '打開那次的練習',
    addedTitle: '這次這個角度多看見的',
    addedEmpty: '這兩次寫下的內容很接近，沒有找到只出現在這次的句子。',
    sameAnother: '同一件事，換另一個角度',
    backToSummary: '回到這次的小結',
    distTitle: '再拉遠一點看（可以跳過）',
    distIntro: '想的話，選一個問題回答。不回答也可以。',
    distFriend: '如果是一個好朋友遇到這件事，你會跟他說什麼？',
    distYear: '一年後回頭看，你猜你會怎麼看這件事？',
    distAdd: '加到小結裡',
    distEdit: '修改',
    distHeadFriend: '如果是好朋友遇到',
    distHeadYear: '一年後回頭看',
    llmCloud: '這次寫的內容會傳給 Anthropic 來調整問題和小結；不想的話可以關掉。',
    llmDevice: '問題和小結會依你寫的內容調整，在這台裝置上產生，不會傳出去。',
    llmOff: '用固定版本',
    adaptedNote: '依你寫的內容調整過的問題',
    showOriginal: '原本的問題',
    llmLabel: '依你寫的內容寫成（AI 產生，可能不準）',
    llmLoading: '正在依你寫的內容整理……',
  },
  en: {
    drewTitle: 'You drew',
    redraw: 'Draw again',
    moreAbout: 'More about this approach',
    savedMore: 'The approach and something to try',
    plan: {
      label: 'If you want to try it, when? (optional)',
      placeholder: 'For example: five minutes before the next meeting',
      checkTitle: 'Last time you planned to try:',
      answers: { tried: 'Tried it', notYet: 'Not yet', notForMe: 'Not for me' },
      thanks: { tried: 'Noted.', notYet: 'That is fine. Noted.', notForMe: 'Got it. Not every idea fits, and that is normal.' },
    },
    map: {
      title: (n, k) => `Looking back: ${n} exercises, ${k} approaches`,
      note: (m) => `A summary of your own records, not a sign that one approach works better. Averages need at least ${m} sessions with both ratings.`,
      row: (r) => [`${r.sessions} ${r.sessions === 1 ? 'time' : 'times'}`, r.withShift ? `lighter ${r.lighter}, same ${r.same}, heavier ${r.heavier}` : null, r.meanShift !== null ? `average ${r.meanShift > 0 ? '+' : ''}${r.meanShift}` : null, r.meanRating !== null ? `helpfulness ${r.meanRating}` : null].filter(Boolean).join('; '),
    },
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
    gentle: 'Gentle recommendations',
    homeLine: 'Something on your mind? Look at it from another angle.',
    stays: 'What you write stays on this device',
    about: 'About this exercise',
    worryLabel: 'What is on your mind?',
    worryPlaceholder: 'One sentence is enough',
    topicLabel: 'What kind of worry is it? Pick any',
    heavyAsk: 'How heavy does it feel right now?',
    heavySlide: 'Slide to choose',
    skip: 'Skip',
    stageOf: (i, n) => `Step ${i} of ${n}`,
    pickAll: (n) => `See all ${n}`,
    dunno: 'Not sure is fine',
    dunnoValue: 'not sure',
    doneLine: 'All written. Here is your card',
    seeAll: (n) => `See all ${n}`,
    seeLess: 'Show less',
    more: 'More',
    close: 'Close',
    topics: { work: 'School or work', relationship: 'Partner or friends', family: 'Family', self: 'Myself (feelings, self-worth)', loss: 'Loss or grief', other: 'Something else' },
    next: 'Next',
    back: 'Back',
    choose: 'Try one of these angles',
    draw: 'Draw a card',
    compare: 'Compare three lenses',
    pickTitle: 'Choose a lens',
    pickCommon: 'Often used for this kind of worry',
    pickOthers: 'Other lenses',
    useThis: 'Use this lens',
    stepOf: (i, n) => `Question ${i} of ${n}`,
    why: 'Why this question',
    answerPlaceholder: 'Write what comes to mind. A few words is fine',
    seeSummary: 'See summary',
    wrote: 'What you wrote',
    leftOpen: '(left open)',
    allOpen: '(every question left open this time)',
    perspective: 'How this approach looks at it',
    tryThis: 'Something to try',
    aiNote: 'This page lists what you wrote as you wrote it and does not interpret it. For a response to your own words, use the AI conversation below.',
    concepts: 'Key ideas',
    misses: 'What this lens might miss',
    reading: (ch) => `To read more: Corey, Theory and Practice of Counseling and Psychotherapy (10th ed.), chapter ${ch}`,
    people: 'Associated with',
    talk: 'This can help you see things differently, but it does not replace talking with a person. If this keeps weighing on you, campus counseling, an employee assistance program, or a community mental health center is a good place to start; many are free or low cost.',
    rateQ: 'Was this lens helpful?',
    rateLabels: ['Not at all', 'A little', 'Somewhat', 'Helpful', 'Very helpful'],
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
    heavyAfterQ: 'Now that you have written it out, how heavy does it feel?',
    heavyEnds: ['0 light', '10 very heavy'],
    heavyLighter: 'This is how it feels right after writing; it may shift again.',
    heavySame: 'It is common for the number to stay the same; looking closely does not always make something lighter.',
    heavyHeavier: 'Sometimes seeing it more clearly makes it feel heavier, and that is common too.',
    cardAlt: (name) => `A small card drawn from your own words, through the ${name} lens`,
    cardNotes: 'Where this picture comes from',
    cardSave: 'Save as image',
    cardSaveFailed: 'Could not save the image. Please try again.',
    suggestTitle: 'From your words, these angles may fit',
    because: 'Because you wrote',
    relatedLine: (date, name) => `On ${date} you looked at something similar through ${name}`,
    relatedOpen: 'Open that exercise',
    addedTitle: 'What this angle added',
    addedEmpty: 'What you wrote both times is close; nothing came up only this time.',
    sameAnother: 'Same worry, another angle',
    backToSummary: 'Back to this summary',
    distTitle: 'One step further back (you can skip this)',
    distIntro: 'If you like, pick one question to answer. You can also leave it.',
    distFriend: 'If a good friend were going through this, what would you tell them?',
    distYear: 'Looking back a year from now, how do you think you will see this?',
    distAdd: 'Add to the summary',
    distEdit: 'Edit',
    distHeadFriend: 'If it were a good friend',
    distHeadYear: 'A year from now',
    llmCloud: 'What you write this time is sent to Anthropic to adjust the questions and summary. You can turn this off.',
    llmDevice: 'The questions and summary are adjusted to what you write, on this device. Nothing is sent out.',
    llmOff: 'Use the fixed version',
    adaptedNote: 'Adjusted to what you wrote',
    showOriginal: 'Original question',
    llmLabel: 'Written for what you wrote (AI-generated, may be wrong)',
    llmLoading: 'Fitting this to what you wrote…',
  },
};

// each approach prints in one of three spot inks (桃, 蛋黃, 青苔), as CSS colours; cards use them
// only as flat fills (a light tint or the mark's offset shape), never as text colour
const HUES = ['var(--pink)', 'var(--yolk)', 'var(--moss)'];

// Shapes for the marks, in a 44 x 44 box: [spot-ink shapes, ink-line shapes], one pair per
// approach in the order of LENSES. ring() is a circle, halfRing() a half circle, quarter() a quarter circle.
const ring = (cx, cy, r) => ['circle', { cx, cy, r }];
const halfRing = (cx, cy, r, dir) => {
  // the flat side faces away from dir: 'up' is a dome, 'down' a bowl, 'left'/'right' a D
  const d = {
    up: `M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}Z`,
    down: `M${cx - r} ${cy}A${r} ${r} 0 0 0 ${cx + r} ${cy}Z`,
    left: `M${cx} ${cy - r}A${r} ${r} 0 0 0 ${cx} ${cy + r}Z`,
    right: `M${cx} ${cy - r}A${r} ${r} 0 0 1 ${cx} ${cy + r}Z`,
  }[dir];
  return ['path', { d }];
};
const quarter = (cx, cy, r, corner) => {
  // the quarter that opens towards corner: 'ne', 'nw', 'se', 'sw'
  const sx = corner.includes('e') ? 1 : -1;
  const sy = corner.includes('s') ? 1 : -1;
  const sweep = sx * sy > 0 ? 1 : 0;
  return ['path', { d: `M${cx} ${cy}L${cx + sx * r} ${cy}A${r} ${r} 0 0 ${sweep} ${cx} ${cy + sy * r}Z` }];
};
const MARKS = [
  // psychoanalytic: rings going down, a deep bowl under them
  [[halfRing(22, 24, 15, 'down')], [ring(22, 22, 15), ring(22, 22, 9), ring(22, 22, 3)]],
  // adlerian: two people side by side, one held in colour
  [[ring(15, 22, 9)], [ring(15, 22, 9), ring(29, 22, 9)]],
  // existential: a sun over the horizon
  [[ring(22, 13, 6)], [halfRing(22, 32, 14, 'up'), ring(22, 13, 6)]],
  // person-centered: one whole circle, a dot at its centre
  [[ring(22, 22, 14)], [ring(22, 22, 14), ring(22, 22, 2.5)]],
  // gestalt: four quarters make the whole; one is printed
  [[quarter(22, 22, 13, 'nw')], [quarter(22, 22, 13, 'nw'), quarter(22, 22, 13, 'ne'), quarter(22, 22, 13, 'se'), quarter(22, 22, 13, 'sw')]],
  // behavioral: three small steps, the last one done
  [[ring(33, 22, 7)], [ring(9, 22, 4), ring(19, 22, 5.5), ring(33, 22, 7)]],
  // acceptance: room around a small thought
  [[ring(22, 22, 7)], [ring(22, 22, 15), ring(22, 22, 7)]],
  // rebt: two halves turned towards each other
  [[halfRing(20, 22, 12, 'left')], [halfRing(20, 22, 12, 'left'), halfRing(24, 22, 12, 'right')]],
  // cognitive: a lens over one quarter of the picture
  [[quarter(22, 22, 14, 'ne')], [ring(22, 22, 14), quarter(22, 22, 14, 'ne')]],
  // reality: a head over a choice
  [[halfRing(22, 34, 12, 'up')], [ring(22, 15, 7), halfRing(22, 34, 12, 'up')]],
  // feminist: three circles overlapping
  [[ring(22, 16, 8)], [ring(22, 16, 8), ring(15, 27, 8), ring(29, 27, 8)]],
  // solution-focused: one small bright spot inside a bigger arc
  [[ring(21, 22, 6)], [quarter(9, 35, 26, 'ne'), ring(21, 22, 6), ring(14, 12, 2.5)]],
  // narrative: pages of a story, one turning
  [[halfRing(22, 30, 9, 'up')], [halfRing(22, 18, 9, 'up'), halfRing(22, 30, 9, 'up'), halfRing(22, 30, 15, 'up')]],
  // family-systems: three people inside one circle
  [[ring(22, 22, 15)], [ring(22, 22, 15), ring(22, 14, 4), ring(15, 27, 4), ring(29, 27, 4)]],
];

// One plain line per approach for the suggestion cards: what it does, in everyday words.
const HOOK = {
  psychoanalytic: ['看看這種感覺以前是不是也出現過', 'Notice whether this feeling has come up before'],
  adlerian: ['找出心裡那句「我必須……才……」', 'Find the "I must ... in order to ..." you tell yourself'],
  existential: ['看看這件事透露你在乎什麼', 'See what this worry says you care about'],
  'person-centered': ['先好好聽見自己真正的感受', 'Hear what you really feel, first'],
  gestalt: ['從身體此刻的感覺開始', 'Start with what your body feels right now'],
  behavioral: ['拆開前因和後果，找一個小做法', 'Take apart what came before and after, and find one small change'],
  acceptance: ['把想法當成一個想法，不用跟它吵', 'Treat the thought as a thought, with no need to argue'],
  rebt: ['把「一定要」換成「很希望」', 'Turn "it must" into "I would like"'],
  cognitive: ['把第一個冒出來的想法拿來檢查', 'Check the first thought that came up'],
  reality: ['想要什麼、正在做什麼、有沒有更接近', 'What you want, what you are doing, and whether it helps'],
  feminist: ['看看哪些「應該」是別人給的', 'See which "shoulds" came from other people'],
  'solution-focused': ['找出已經有用的那一點點', 'Find the little that already works'],
  narrative: ['你不等於這個問題，換個說法看看', 'You are not the problem. Try telling it another way'],
  'family-systems': ['看看你在家裡的位置', 'Look at where you stand in your family'],
};
const TOPIC_ICON = { work: 'work', relationship: 'relationship', family: 'family', self: 'self', loss: 'loss', other: 'other' };
const RATE_FACES = ['face1', 'face2', 'face3', 'face4', 'face5'];
// how heavy, as weather: clear when light, rain when heavy
const weather = (v) => (v === null || v === undefined ? 'partly' : v <= 1 ? 'sun' : v <= 3 ? 'partly' : v <= 5 ? 'cloud' : v <= 7 ? 'rain' : 'storm');

export function createLensView({ h, add, getLang, rerender, toast, db, openGentle }) {
  const st = {
    stage: 'home',
    concern: '',
    topics: [], // in the order chosen; 'other' stands alone
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
    st.sheet = false; // the More sheet belongs to the summary it was opened on
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
    st.cstep = 0;
    st.sheet = false;
    st.showAll = false;
    st.topics = [];
    st.lensId = null;
    st.answers = [];
    st.step = 0;
    st.compare = [];
    st.rating = null;
    st.before = null;
    st.after = null;
    st.distance = null;
    st.plan = '';
    st.planChecked = false;
    st.cardAnimated = null;
    st.savedReturn = null;
    st.riskSeen = false;
    // language-model help: provider undefined until worked out, null for none
    st.llm = { provider: undefined, resolving: false, off: false, shown: false, adapt: null, lock: {}, orig: {}, sum: null };
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
    st.after = null;
    st.distance = null;
    st.plan = '';
    st.planChecked = false;
    st.cardAnimated = null;
    st.showAll = false;
    st.startedAt = Date.now();
    st.counted = false;
    startAdapt(lensById(id));
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

  // One flat mark per approach, in the app's riso style: a solid spot-ink shape printed 2 units
  // down and to the right, under a drawing in one even ink line built only from circles,
  // half circles and quarter circles. Same family, fourteen different pictures.
  function lensMark(lens, size = 44) {
    const i = Math.max(0, LENSES.indexOf(lens));
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 44 44');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'lens-mark');
    svg.style.setProperty('--mark-ink', HUES[i % HUES.length]);
    const [spot, line] = MARKS[i % MARKS.length];
    const layer = (cls, shapes, shift) => {
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('class', cls);
      if (shift) g.setAttribute('transform', 'translate(2 2)');
      for (const [tag, attrs] of shapes) {
        const el = document.createElementNS(ns, tag);
        for (const k in attrs) el.setAttribute(k, attrs[k]);
        g.appendChild(el);
      }
      svg.appendChild(g);
    };
    layer('mark-spot', spot, true);
    layer('mark-line', line, false);
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

  // Mumu leans in while the person types, and settles back a moment after they stop.
  let listenTimer = null;
  function listen(m) {
    if (!m) return;
    setMascot(m, 'listen');
    clearTimeout(listenTimer);
    listenTimer = setTimeout(() => setMascot(m, 'idle'), 1400);
  }

  // A short row of segments (the worry's three screens) or dots (a lens's questions).
  function progress(i, n, { dots = false, label } = {}) {
    return h(
      'div',
      { class: 'lens-progress' + (dots ? ' dots' : ''), role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(n), 'aria-valuenow': String(i), 'aria-label': label || L().stageOf(i, n) },
      Array.from({ length: n }, (_, k) => h('span', { class: 'lens-progress-seg' + (k < i ? ' on' : '') + (k === i - 1 ? ' now' : ''), 'aria-hidden': 'true' })),
      dots ? h('span', { class: 'lens-progress-num', 'aria-hidden': 'true' }, `${i} / ${n}`) : null
    );
  }

  // Back on the left, the one primary button on the right: the same place on every screen.
  function nav(primary, onBack) {
    return h('div', { class: 'actions lens-nav' }, h('button', { type: 'button', class: 'btn ghost', 'data-key': 'lens-back', onclick: onBack }, L().back), primary);
  }

  // ----- stages -----
  function home() {
    const explored = LENSES.filter((l) => st.stats[l.id] && st.stats[l.id].used).length;
    const tile = (icon, label, meta, onclick, key) =>
      h('button', { type: 'button', class: 'lens-link lens-tile', 'data-key': key, onclick }, h('span', { class: 'lens-tile-icon', 'aria-hidden': 'true' }, icon), h('strong', {}, label), meta ? h('span', { class: 'lens-tile-meta' }, meta) : null);
    return [
      h(
        'div',
        { class: 'lens-hero' },
        mascot('idle', { size: 112 }),
        h('h2', { class: 'lens-hero-line' }, L().homeLine),
        h('button', { type: 'button', class: 'btn primary lens-hero-btn', 'data-key': 'lens-start', onclick: () => {
          st.cstep = 0;
          go('concern');
        } }, L().start),
        h('p', { class: 'muted small lens-stays' }, L().stays)
      ),
      planCheck(),
      h(
        'div',
        { class: 'lens-home-links lens-tiles' },
        tile(icon('deck', { size: 24 }), L().deck, L().explored(explored), () => go('deck'), 'lens-tile-deck'),
        tile(icon('compass', { size: 24 }), L().fit, null, () => go('fit'), 'lens-tile-fit'),
        tile(icon('bookmark', { size: 24 }), L().saved, L().savedCount(st.sessions.length), () => go('saved'), 'lens-tile-saved'),
        openGentle ? tile(icon('gentle', { size: 24 }), L().gentle, null, openGentle, 'lens-tile-gentle') : null
      ),
      h(
        'details',
        { class: 'lens-more lens-about', 'data-key': 'lens-about' },
        h('summary', {}, L().about),
        h('p', {}, L().intro),
        h('p', { class: 'muted small' }, L().madeBy, ' ', L().privacy, st.aiEnabled ? ' ' + L().privacyAi : '')
      ),
      policyPanel(),
    ];
  }

  // ----- language-model help (js/lens-llm.js); with no provider everything stays fixed -----
  function llmState() {
    if (!st.llm) st.llm = { provider: undefined, resolving: false, off: false, shown: false, adapt: null, lock: {}, orig: {}, sum: null };
    return st.llm;
  }

  async function resolveProvider() {
    const m = llmState();
    if (m.provider !== undefined || m.resolving) return;
    m.resolving = true;
    let p = null;
    try {
      const [key, model] = await Promise.all([db.getSetting('aiKey', '').catch(() => ''), db.getSetting('aiModel', MODELS[0].id).catch(() => MODELS[0].id)]);
      p = await pickProvider({ lang: lk(), aiEnabled: st.aiEnabled === true, key, model, callModel });
    } catch (_) {
      p = null;
    }
    m.resolving = false;
    if (st.llm !== m) return; // the exercise was reset meanwhile
    m.provider = p || null;
    if (m.provider && (st.stage === 'concern' || st.stage === 'concern-for-lens')) rerender();
  }

  // the provider to call now: only after the person has seen the disclosure, never after risk words
  function activeProvider() {
    const m = llmState();
    return m.provider && m.shown && !m.off && !st.riskSeen ? m.provider : null;
  }

  // one line before the first call: where the text goes, and a switch back to the fixed version
  function llmDisclosure() {
    const m = llmState();
    if (!m.provider) return null;
    m.shown = true;
    return h(
      'div',
      { class: 'lens-llm-note', 'data-key': 'lens-llm-note' },
      h('p', { class: 'muted small' }, m.provider.kind === 'cloud' ? L().llmCloud : L().llmDevice),
      h(
        'label',
        { class: 'toggle' },
        h('input', { type: 'checkbox', checked: m.off, 'data-key': 'lens-llm-off', onchange: (e) => (m.off = e.target.checked) }),
        h('span', {}, L().llmOff)
      )
    );
  }

  function startAdapt(lens) {
    const m = llmState();
    m.adapt = null;
    m.lock = {};
    m.orig = {};
    m.sum = null;
    const provider = activeProvider();
    if (!provider) return;
    const id = lens.id;
    adaptQuestions({ provider, lens, lang: lk(), concern: st.concern, topics: st.topics })
      .then((res) => {
        if (st.llm !== m || st.lensId !== id || !res || res.source === 'fixed') return;
        m.adapt = res;
        // swap in only on a step the person has not started typing in
        if (st.stage === 'step' && m.lock[st.step] === undefined && !String(st.answers[st.step] ?? '').trim()) {
          rerender();
          const f = document.getElementById('lens-answer');
          if (f) f.focus({ preventScroll: true });
        }
      })
      .catch(() => {});
  }

  // which question to show for step i: the adapted one if it was there before typing began
  function adaptedFor(i, s) {
    const m = llmState();
    if (s.scale || !m.adapt || !m.adapt.adapted[i]) return null;
    if (m.lock[i] !== undefined) return m.lock[i];
    return String(st.answers[i] ?? '').trim() ? null : m.adapt.questions[i];
  }

  function startSummary(lens) {
    const m = llmState();
    const key = `${lens.id}|${st.concern}|${st.answers.join('\u0001')}`;
    if (m.sum && m.sum.key === key) return m.sum;
    const provider = activeProvider();
    if (!provider) return (m.sum = null);
    const sum = (m.sum = { key, status: 'loading', result: null });
    const done = (status, result) => {
      if (st.llm !== m || m.sum !== sum || sum.status !== 'loading') return;
      sum.status = status;
      sum.result = result;
      if (st.stage === 'summary') {
        const y = window.scrollY;
        rerender();
        window.scrollTo(0, y);
      }
    };
    setTimeout(() => done('timeout', null), 8000);
    personalSummary({ provider, lens, lang: lk(), concern: st.concern, answers: st.answers.map((a) => String(a ?? '')) })
      .then((r) => done(r && r.source !== 'fixed' ? 'done' : 'fixed', r))
      .catch(() => done('fixed', null));
    return sum;
  }

  // The worry in three short screens: the words, the kinds of worry, how heavy it feels.
  // The risk check runs when the words are done, before anything else uses them.
  function concern(onNext) {
    const cs = Math.min(2, Math.max(0, st.cstep || 0));
    const here = st.stage;
    const to = (i) => {
      st.cstep = i;
      go(here);
    };
    const back = () => (cs > 0 ? to(cs - 1) : go('home'));
    if (cs === 0) {
      const m = mascot('idle', { size: 64 });
      const input = h('textarea', {
        id: 'lens-concern',
        rows: '4',
        maxlength: '400',
        placeholder: L().worryPlaceholder,
        'aria-labelledby': 'lens-concern-q',
        'data-key': 'lens-concern',
        oninput: (e) => {
          st.concern = e.target.value;
          listen(m);
          const b = document.querySelector('[data-key="lens-worry-next"]');
          if (b) b.disabled = !st.concern.trim();
        },
      });
      input.value = st.concern;
      return [
        progress(1, 3),
        h('div', { class: 'lens-ask' }, m, h('h2', { id: 'lens-concern-q' }, L().worryLabel)),
        input,
        (resolveProvider(), llmDisclosure()),
        nav(
          h('button', { type: 'button', class: 'btn primary', 'data-key': 'lens-worry-next', disabled: !st.concern.trim(), onclick: () => {
            if (!st.concern.trim()) return;
            if (guard(st.concern, () => to(1))) to(1);
          } }, L().next),
          back
        ),
      ];
    }
    if (cs === 1) {
      return [
        progress(2, 3),
        h('h2', { id: 'topic-label' }, L().topicLabel),
        // several can be chosen; each chip is a toggle button. "Other" stands alone.
        h(
          'div',
          { class: 'chips wrap topic-chips', role: 'group', 'aria-labelledby': 'topic-label' },
          TOPICS.map((tp) => {
            const on = st.topics.includes(tp);
            return h(
              'button',
              {
                type: 'button',
                'aria-pressed': on ? 'true' : 'false',
                class: 'chip topic-chip' + (on ? ' on' : ''),
                'data-key': `topic-${tp}`,
                onclick: () => {
                  if (on) st.topics = st.topics.filter((t) => t !== tp);
                  else if (tp === 'other') st.topics = ['other'];
                  else st.topics = [...st.topics.filter((t) => t !== 'other'), tp];
                  rerender();
                },
              },
              h('span', { class: 'topic-emoji', 'aria-hidden': 'true' }, icon(TOPIC_ICON[tp], { size: 24 })),
              h('span', {}, L().topics[tp])
            );
          })
        ),
        nav(h('button', { type: 'button', class: 'btn primary', 'data-key': 'lens-topics-next', disabled: !st.topics.length, onclick: () => st.topics.length && to(2) }, L().next), back),
      ];
    }
    // Next sits in the same place on every screen: the second tap of a double tap on the
    // previous screen's Next (detail 2) must not also answer this one
    const next = (e) => {
      if (e && e.detail > 1) return;
      if (!st.concern.trim() || !st.topics.length) return to(st.concern.trim() ? 1 : 0);
      if (onNext) onNext();
      else go('choose');
    };
    return [
      progress(3, 3),
      h('h2', { id: 'heavy-before-label' }, L().heavyAsk),
      heavySlider('before'),
      h('div', { class: 'lens-skip-row' }, h('button', { type: 'button', class: 'link', 'data-key': 'lens-heavy-skip', onclick: (e) => {
        if (e.detail > 1) return;
        st.before = null;
        next();
      } }, L().skip)),
      nav(h('button', { type: 'button', class: 'btn primary', 'data-key': 'lens-concern-next', onclick: next }, L().next), back),
    ];
  }

  // 0 to 10 as a slider with a little weather that changes with it. Untouched, nothing is
  // chosen (the question is optional); the label for it is the <h2> or <p> with id heavy-<which>-label.
  function heavySlider(which, onChange) {
    const cur = st[which];
    const set = Number.isInteger(cur);
    const sky = h('span', { class: 'heavy-sky' + (set ? '' : ' unset'), 'aria-hidden': 'true' }, icon(weather(set ? cur : null), { size: 56 }));
    const num = h('span', { class: 'heavy-val' + (set ? '' : ' unset'), 'aria-hidden': 'true' }, set ? String(cur) : L().heavySlide);
    const text = (v) => `${v} / 10`;
    const input = h('input', {
      type: 'range',
      min: '0',
      max: '10',
      step: '1',
      class: 'heavy-range' + (set ? '' : ' unset'),
      'data-key': `heavy-${which}-input`,
      'aria-labelledby': `heavy-${which}-label`,
      'aria-valuetext': set ? text(cur) : L().heavySlide,
      oninput: (e) => {
        const v = Number(e.target.value);
        st[which] = v;
        sky.replaceChildren(icon(weather(v), { size: 56 }));
        num.textContent = String(v);
        for (const el of [sky, num, e.target]) el.classList.remove('unset');
        e.target.setAttribute('aria-valuetext', text(v));
      },
      onchange: () => onChange && onChange(),
    });
    input.value = String(set ? cur : 5);
    return h(
      'div',
      { class: 'heavy heavy-slider', 'data-key': `heavy-${which}` },
      h('div', { class: 'heavy-readout' }, sky, num),
      input,
      h('div', { class: 'scale-ends', 'aria-hidden': 'true' }, h('span', {}, L().heavyEnds[0]), h('span', {}, L().heavyEnds[1]))
    );
  }

  // Up to three approaches to start from: first those whose cue words appear in the worry
  // (each with the words that matched), then the ones usually used for this kind of worry.
  function suggestions() {
    let found = [];
    try {
      found = suggestLenses(st.concern, { allowed: lensesForTopics(st.topics).map((l) => l.id) }).filter((x) => lensById(x.id));
    } catch (_) {
      found = [];
    }
    const out = found.map((x) => ({ lens: lensById(x.id), evidence: x.evidence || [] }));
    const { common, rest } = expertOrder(st.topics);
    for (const l of [...common, ...rest]) {
      if (out.length >= 3) break;
      if (!out.some((x) => x.lens === l)) out.push({ lens: l, evidence: [] });
    }
    return out.slice(0, 3);
  }

  function suggestCard({ lens, evidence }) {
    const zh = lk() === 'zh';
    const ev = evidence[0];
    return h(
      'button',
      { type: 'button', class: 'lens-pick-card', 'data-key': `suggest-${lens.id}`, style: `--lens-hue:${HUES[LENSES.indexOf(lens) % HUES.length]}`, onclick: () => startLens(lens.id) },
      h('span', { class: 'lens-pick-mark' }, lensMark(lens, 48)),
      h(
        'span',
        { class: 'lens-pick-text' },
        h('span', { class: 'lens-pick-name' }, lens[lk()].name),
        h('span', { class: 'lens-pick-hook' }, (HOOK[lens.id] || [])[zh ? 0 : 1] || ''),
        ev ? h('span', { class: 'lens-because' }, L().because, zh ? '「' : ' "', ev.before, h('mark', {}, ev.match), ev.after, zh ? '」' : '"') : null
      )
    );
  }

  function choose() {
    const pool = lensesForTopics(st.topics);
    const option = (label, key, onclick) => h('button', { type: 'button', class: 'lens-option', 'data-key': key, onclick }, label);
    return [
      h('div', { class: 'lens-ask' }, mascot('idle', { size: 56 }), h('h2', {}, L().choose)),
      h('div', { class: 'lens-suggest', 'data-key': 'lens-suggest' }, suggestions().map(suggestCard)),
      h(
        'div',
        { class: 'lens-options lens-choose-options' },
        option(L().draw, 'lens-draw', () => {
          // show what was drawn first, with a chance to draw again
          const others = pool.filter((l) => l.id !== st.drawn);
          st.drawn = shuffle(others.length ? others : pool)[0].id;
          go('drawn');
        }),
        option(L().compare, 'lens-compare', () => {
          st.compare = shuffle(pool).slice(0, 3).map((l) => l.id);
          go('compare');
        }),
        option(L().pickAll(pool.length), 'lens-pick-all', openPick)
      ),
      pool.length < LENSES.length ? h('p', { class: 'muted small lens-hidden-note' }, L().topicHidden) : null,
      h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => {
        st.cstep = 2;
        go('concern');
      } }, L().back)),
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
    const pool = lensesForTopics(st.topics);
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
  // (with several topics: each topic's usual approaches in the order the topics were chosen)
  function expertOrder(topics) {
    const all = lensesForTopics(topics);
    const common = commonForTopics(topics);
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
    const { common, rest } = expertOrder(st.topics);
    // one small context per decision: 'loss' if it is among the topics, else the first chosen
    const context = p.mod.topicsContext(st.topics);
    const [entries, risk, evidence] = await Promise.all([db.listEntries(), p.store.recentRisk(), p.store.evidence('lens', context)]);
    const gated = p.mod.gateReason({ optedIn: true, risk: st.riskSeen || risk, mood: p.mod.recentMood(entries), surface: 'lens', context });
    const decision = p.mod.decide({ eligible: [...common, ...rest].map((l) => l.id), evidence, gated, seed: p.mod.newSeed() });
    if (!decision) return;
    const record = p.mod.makeRecord({ surface: 'lens', context, decision });
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
    const order = expertOrder(st.topics);
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
    const fq = (t) => fill(t, st.answers, { inQuestion: true });
    const fixedQ = fq(s.qZero && String(st.answers[0]) === '0' ? s.qZero : s.q);
    const adapted = adaptedFor(st.step, s);
    const m = mascot('idle', { size: 48 });
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
        'data-key': 'lens-answer',
        oninput: (e) => {
          st.answers[st.step] = e.target.value;
          // from the first keystroke this step keeps the question it showed
          const ls = llmState();
          if (ls.lock[st.step] === undefined) ls.lock[st.step] = adapted;
          listen(m);
          const btn = document.querySelector('[data-key="lens-next"]');
          if (btn) btn.disabled = !e.target.value.trim();
        },
      });
      field.value = answer;
    }
    // "not sure" is a real answer here: one tap writes it in, and Next works as usual
    const dunno = field.tagName === 'TEXTAREA'
      ? h('div', { class: 'chips lens-dunno-row' }, h('button', { type: 'button', class: 'chip lens-dunno', 'data-key': 'lens-dunno', onclick: () => {
          const ls = llmState();
          if (ls.lock[st.step] === undefined) ls.lock[st.step] = adapted;
          st.answers[st.step] = L().dunnoValue;
          field.value = L().dunnoValue;
          const btn = document.querySelector('[data-key="lens-next"]');
          if (btn) btn.disabled = false;
        } }, L().dunno))
      : null;
    return [
      h(
        'div',
        { class: 'lens-step-head' },
        lensMark(lens, 36),
        h('div', { class: 'lens-step-title' }, h('p', { class: 'lens-name' }, c.name), progress(st.step + 1, n, { dots: true, label: L().stepOf(st.step + 1, n) })),
        m
      ),
      st.step === 0 ? h('blockquote', { class: 'lens-concern-quote' }, st.concern) : null,
      s.rewrite && prevAnswer ? h('p', { class: 'lens-rewrite' }, rewriteText(s.rewrite, prevAnswer, getLang())) : null,
      h('p', { class: 'lens-q', id: 'lens-q' }, adapted ? fq(adapted) : fixedQ),
      adapted
        ? h(
            'p',
            { class: 'muted small lens-adapted', 'data-key': 'lens-adapted' },
            L().adaptedNote,
            ' · ',
            h('button', { type: 'button', class: 'link', 'aria-expanded': llmState().orig[st.step] ? 'true' : 'false', 'data-key': 'lens-show-original', onclick: () => {
              const o = llmState().orig;
              o[st.step] = !o[st.step];
              rerender();
            } }, L().showOriginal)
          )
        : null,
      adapted && llmState().orig[st.step] ? h('p', { class: 'muted small lens-original', 'data-key': 'lens-original' }, fixedQ) : null,
      field,
      dunno,
      h('details', { class: 'lens-why' }, h('summary', {}, L().why), h('p', {}, s.why)),
      nav(h('button', { type: 'button', class: 'btn primary', 'data-key': 'lens-next', disabled: !String(answer).trim(), onclick: advance }, isLast ? L().seeSummary : L().next), () => {
        if (st.step === 0) go('choose');
        else {
          st.step--;
          rerender();
        }
      }),
    ];
  }

  // One optional question that steps back from the worry, shown on the summary under the
  // answers (as a separate page it would sit between the questions and the summary every time).
  // The person picks which question. For a loss it stays folded unless opened.
  function distanceInline() {
    const d = (st.distance = st.distance || { kind: null, text: '', done: false });
    if (d.done && distanceOf(d)) {
      return [
        ...distanceBlock(d),
        h('button', { type: 'button', class: 'link', 'data-key': 'lens-distance-edit', onclick: () => {
          d.done = false;
          rerender();
          const f = document.getElementById('lens-distance');
          if (f) f.focus();
        } }, L().distEdit),
      ];
    }
    // folded to one line, so Save stays close; for a loss it is not suggested beyond that line
    if (!d.open) {
      return h('button', { type: 'button', class: 'link', 'data-key': 'lens-distance-open', onclick: () => {
        d.open = true;
        rerender();
      } }, L().distTitle);
    }
    const kinds = [
      ['friend', L().distFriend],
      ['year', L().distYear],
    ];
    const field = d.kind
      ? h('textarea', {
          id: 'lens-distance',
          rows: '3',
          maxlength: '1000',
          placeholder: L().answerPlaceholder,
          'aria-labelledby': 'lens-distance-q',
          'data-key': 'lens-distance',
          oninput: (e) => {
            d.text = e.target.value;
            const b = document.querySelector('[data-key="lens-distance-add"]');
            if (b) b.disabled = !d.text.trim();
          },
        })
      : null;
    if (field) field.value = d.text;
    const done = () => {
      d.done = true;
      rerender();
    };
    return h(
      'div',
      { class: 'lens-distance', 'data-key': 'lens-distance-block' },
      h('h3', { id: 'lens-distance-title' }, L().distTitle),
      h('p', { class: 'muted small' }, L().distIntro),
      h(
        'div',
        { class: 'lens-options', role: 'group', 'aria-labelledby': 'lens-distance-title' },
        kinds.map(([k, q]) =>
          h(
            'button',
            {
              type: 'button',
              class: 'lens-option' + (d.kind === k ? ' on' : ''),
              'aria-pressed': d.kind === k ? 'true' : 'false',
              'data-key': `distance-${k}`,
              onclick: () => {
                d.kind = k;
                rerender();
                const f = document.getElementById('lens-distance');
                if (f) f.focus();
              },
            },
            h('strong', {}, q)
          )
        )
      ),
      d.kind ? h('p', { class: 'lens-q', id: 'lens-distance-q' }, d.kind === 'friend' ? L().distFriend : L().distYear) : null,
      field,
      d.kind
        ? h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn', 'data-key': 'lens-distance-add', disabled: !d.text.trim(), onclick: () => {
            if (guard(d.text, done)) done();
          } }, L().distAdd))
        : null
    );
  }

  // the distance answer, if one was written and is more than "not sure"
  function distanceOf(d) {
    if (!d || !d.kind || d.done === false || !d.text || !String(d.text).trim() || isNonAnswer(d.text)) return null;
    return d;
  }

  function distanceBlock(d, head = 'h3') {
    d = distanceOf(d);
    if (!d) return null;
    return [h(head, {}, d.kind === 'friend' ? L().distHeadFriend : L().distHeadYear), h('blockquote', { class: 'lens-answer', 'data-key': 'lens-distance-answer' }, d.text)];
  }

  // The card's line: the person's own last real answer (not a scale number, not "not sure").
  function cardLine(answers, name) {
    const real = (answers || []).filter((a) => typeof a === 'string' && a.trim() && !isNonAnswer(a) && !/^\d+$/.test(a.trim()));
    return real.length ? quote(real[real.length - 1], 60) : name;
  }

  function fmtDay(t) {
    return new Intl.DateTimeFormat(getLang(), { dateStyle: 'medium' }).format(new Date(t));
  }

  // An SVG string from postcard.js, parsed as XML (not innerHTML) and placed in the page.
  function svgNode(str) {
    const doc = new DOMParser().parseFromString(str, 'image/svg+xml');
    const el = doc.documentElement;
    if (!el || el.nodeName !== 'svg') return null;
    const node = document.importNode(el, true);
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('focusable', 'false');
    return node;
  }

  // The keepsake card, in parts: how to draw it (from the worry and answers) and the notes on
  // where each part of the picture came from. null if it cannot be drawn.
  function cardParts({ concern, answers, topics, lensId, before, after, createdAt, spec = null, genLine = null }) {
    const lens = lensById(lensId);
    const name = lens[lk()].name;
    const sh = heavinessShift(before, after);
    const shift = sh ? sh.delta : null;
    const texts = [concern, ...(answers || []).filter((a) => typeof a === 'string')];
    const args = { seed: String(createdAt || concern || lensId), line: genLine || cardLine(answers, name), label: name, date: fmtDay(createdAt || Date.now()), texts, topics, lensId, shift };
    // with a model's picture choices: the scene from them (each tied to a word the person wrote)
    const specScene = spec ? sceneFromSpec(spec, { texts, topics, lensId, shift }) : null;
    const draw = (anim) => (specScene && !specScene.calm ? sceneSvg(specScene, { seed: args.seed, line: args.line, label: args.label, date: args.date, animate: anim, fitText }) : cardSvg({ ...args, animate: anim }));
    try {
      const first = draw(false);
      const notes = sceneNotes(specScene || readScene({ texts, topics, lensId, shift }), lk()) || [];
      return { name, draw, first, notes, createdAt };
    } catch (_) {
      return null;
    }
  }

  // The picture itself. Animated, it plays when it first comes into view.
  function cardArt(parts, { animate = false, onPlayed = null } = {}) {
    let art;
    try {
      art = svgNode(animate ? parts.draw(true) : parts.first);
    } catch (_) {
      art = null;
    }
    if (!art) return null;
    const box = h('div', { class: 'lens-card-art', role: 'img', 'aria-label': L().cardAlt(parts.name), 'data-key': 'lens-card-art' });
    if (animate && 'IntersectionObserver' in window) {
      box.classList.add('waiting');
      const io = new IntersectionObserver((list) => {
        if (!list.some((e) => e.isIntersecting)) return;
        io.disconnect();
        box.classList.remove('waiting');
        box.classList.add('arrive');
        box.appendChild(art);
        if (onPlayed) onPlayed();
      }, { threshold: 0.3 });
      io.observe(box);
    } else {
      box.appendChild(art);
      if (animate && onPlayed) onPlayed();
    }
    return box;
  }

  function cardNotes(parts) {
    if (!parts || !parts.notes.length) return null;
    return h('details', { class: 'lens-more', 'data-key': 'lens-card-notes' }, h('summary', {}, L().cardNotes), h('ul', { class: 'lens-card-notes' }, parts.notes.map((n) => h('li', {}, n))));
  }

  function cardSave(parts, cls = 'btn') {
    if (!parts) return null;
    return h('button', { type: 'button', class: cls, 'data-key': 'lens-card-save', onclick: async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      try {
        const png = await postcardPng(parts.draw(false));
        const d = new Date(parts.createdAt || Date.now());
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        await sharePng(png, `murmur-lens-${ymd}.png`, parts.name);
      } catch (_) {
        toast(L().cardSaveFailed);
      } finally {
        b.disabled = false;
      }
    } }, L().cardSave);
  }

  // The card still, for the saved list.
  function keepsake(opts) {
    const parts = cardParts(opts);
    const box = parts && cardArt(parts);
    return box ? h('div', { class: 'lens-keepsake' }, box) : null;
  }

  function heavyResult() {
    const sh = heavinessShift(st.before, st.after);
    if (!sh) return null;
    const line = sh.direction === 'lighter' ? L().heavyLighter : sh.direction === 'same' ? L().heavySame : L().heavyHeavier;
    return h('div', { class: 'heavy-result', 'data-key': 'heavy-result' }, h('p', { class: 'heavy-nums' }, `${sh.before} → ${sh.after}`), h('p', { class: 'muted small' }, line));
  }

  // Earlier saved exercises about a similar worry; for one with a different lens, what only this one brought up.
  function relatedBlock(lens) {
    let rel = [];
    try {
      rel = relatedSessions(st.concern, st.sessions, { excludeId: st.savedId }).filter((r) => lensById(r.session.lensId)).slice(0, 2);
    } catch (_) {
      rel = [];
    }
    if (!rel.length) return null;
    const other = rel.find((r) => r.session.lensId !== lens.id);
    const mine = st.answers.filter((a) => typeof a === 'string');
    const added = other ? onlyHere(mine, (other.session.answers || []).filter((a) => typeof a === 'string')) : [];
    return h(
      'div',
      { class: 'lens-related', 'data-key': 'lens-related' },
      rel.map((r) =>
        h(
          'div',
          { class: 'lens-related-row' },
          h('p', {}, L().relatedLine(fmtDay(r.session.createdAt), lensById(r.session.lensId)[lk()].name)),
          h('button', { type: 'button', class: 'link', 'data-key': 'lens-related-open', onclick: () => {
            st.savedReturn = 'summary';
            st.savedFocus = r.session.id;
            go('saved');
            const el = document.getElementById(`lens-saved-${r.session.id}`);
            if (el) {
              el.scrollIntoView({ block: 'start' });
              const hd = el.querySelector('h3');
              if (hd) {
                hd.setAttribute('tabindex', '-1');
                hd.focus({ preventScroll: true });
              }
            }
          } }, L().relatedOpen)
        )
      ),
      other
        ? h(
            'details',
            { class: 'lens-more', 'data-key': 'lens-added' },
            h('summary', {}, L().addedTitle),
            added.length ? added.map((x) => h('blockquote', { class: 'lens-answer' }, x.text)) : h('p', { class: 'muted small' }, L().addedEmpty)
          )
        : null
    );
  }

  // The person's answers, exactly as written: each question in its short form, then the answer
  // as a quotation. Nothing here puts their words inside a sentence of ours.
  // collapsible: only the first answer shows, the rest one tap away ("see all").
  function answerList(lens, answers, { collapsible = false } = {}) {
    const rows = answerRows(lens, lk(), answers);
    // nothing written at all: one line, rather than the same note under every question
    if (rows.every((r) => r.open)) return h('div', { class: 'lens-answers' }, h('p', { class: 'lens-answer-open muted' }, L().allOpen));
    const row = (r) => [
      h('p', { class: 'lens-answer-q' }, r.q),
      r.open ? h('p', { class: 'lens-answer-open muted' }, L().leftOpen) : h('blockquote', { class: 'lens-answer' }, r.text),
    ];
    if (!collapsible || rows.length < 2) return h('div', { class: 'lens-answers' }, rows.map(row));
    const rest = h('div', { id: 'lens-answers-rest', hidden: st.showAll ? null : true }, rows.slice(1).map(row));
    const toggle = h('button', {
      type: 'button',
      class: 'link lens-see-all',
      'data-key': 'lens-see-all',
      'aria-expanded': st.showAll ? 'true' : 'false',
      'aria-controls': 'lens-answers-rest',
      onclick: (e) => {
        st.showAll = !st.showAll;
        rest.hidden = !st.showAll;
        e.currentTarget.setAttribute('aria-expanded', st.showAll ? 'true' : 'false');
        e.currentTarget.textContent = st.showAll ? L().seeLess : L().seeAll(rows.length);
      },
    }, st.showAll ? L().seeLess : L().seeAll(rows.length));
    return h('div', { class: 'lens-answers' }, row(rows[0]), rest, toggle);
  }

  // An optional if-then plan for the small thing to try ("I'll try it when ..."). Saved with
  // the exercise; the next visit asks once how it went.
  function planInput() {
    const input = h('input', {
      type: 'text',
      id: 'lens-plan',
      maxlength: '120',
      'data-key': 'lens-plan',
      placeholder: L().plan.placeholder,
      oninput: (e) => {
        st.plan = e.target.value;
        st.planChecked = false;
      },
    });
    input.value = st.plan || '';
    return h('div', { class: 'lens-plan' }, h('label', { class: 'lens-label small', for: 'lens-plan' }, L().plan.label), input);
  }

  // The latest saved plan nobody has answered yet, at least half a day old.
  function pendingPlan() {
    const now = Date.now();
    return [...st.sessions].reverse().find((s) => s.plan && s.plan.text && !s.followUp && now - s.createdAt > 12 * 3600 * 1000 && lensById(s.lensId)) || null;
  }

  function planCheck() {
    const s = pendingPlan();
    if (!s) return null;
    const answer = async (v) => {
      const updated = { ...s, followUp: { answer: v, at: Date.now() } };
      try {
        await db.saveLensSession(updated);
        st.sessions = await db.listLensSessions();
      } catch (_) {
        /* not saved; the question comes back next time */
      }
      toast(L().plan.thanks[v]);
      rerender();
    };
    return h(
      'section',
      { class: 'card lens-plan-check', 'data-key': 'lens-plan-check', 'aria-labelledby': 'plan-check-title' },
      h('h3', { id: 'plan-check-title' }, L().plan.checkTitle),
      h('blockquote', { class: 'lens-answer' }, s.plan.text),
      h(
        'div',
        { class: 'chips wrap' },
        ['tried', 'notYet', 'notForMe'].map((v) => h('button', { type: 'button', class: 'chip', 'data-key': `plan-${v}`, onclick: () => answer(v) }, L().plan.answers[v]))
      )
    );
  }

  function summary() {
    const lens = lensById(st.lensId);
    const c = lens[lk()];
    const hue = `--lens-hue:${HUES[LENSES.indexOf(lens) % HUES.length]}`;
    const sum = startSummary(lens);
    const loading = sum && sum.status === 'loading';
    const gen = sum && sum.status === 'done' ? sum.result : null;
    const genPerspective = gen && gen.perspective ? stripCitations(gen.perspective) : null;
    const genTry = gen && gen.tryThis ? gen.tryThis : null;
    const skel = () => h('p', { class: 'lens-skel', 'aria-hidden': 'true' }, h('span', {}), h('span', {}));
    const genLabel = () => h('p', { class: 'muted small lens-llm-label', 'data-key': 'lens-llm-label' }, L().llmLabel);
    // the card waits for the summary, so its picture does not change under the person
    const key = `${st.lensId}|${st.before}|${st.after}`;
    const parts = loading ? null : cardParts({ concern: st.concern, answers: st.answers, topics: st.topics, lensId: lens.id, before: st.before, after: st.after, createdAt: st.startedAt, spec: gen && gen.card, genLine: gen && gen.cardLine });
    const fresh = st.cardAnimated !== key;
    const rate = (v) => {
      st.rating = v;
      rerender();
    };
    // the high point of the exercise: Mumu and the card, with a few sparkles the first time
    const title = h('div', { class: 'lens-celebrate-title' }, h('h2', {}, c.name), h('p', { class: 'lens-celebrate-line' }, loading ? L().llmLoading : L().doneLine));
    const top = loading
      ? h('section', { class: 'lens-celebrate thinking', style: hue, 'aria-busy': 'true', 'data-key': 'lens-llm-loading' }, h('div', { class: 'lens-celebrate-head' }, mascot('think', { size: 64 }), title))
      : h(
          'section',
          { class: 'lens-celebrate' + (fresh ? ' fresh' : ''), style: hue },
          h('div', { class: 'lens-celebrate-head' }, mascot('happy', { size: 64 }), title),
          parts
            ? h(
                'div',
                { class: 'lens-card-stage' },
                fresh ? h('span', { class: 'lens-confetti', 'aria-hidden': 'true' }, Array.from({ length: 9 }, (_, i) => h('i', { style: `--i:${i}` }))) : null,
                h('div', { class: 'lens-keepsake' }, cardArt(parts, { animate: fresh, onPlayed: () => (st.cardAnimated = key) }))
              )
            : null
        );
    return [
      top,
      h(
        'article',
        { class: 'lens-summary lens-summary-body', style: hue, 'aria-label': c.name },
        h('h3', {}, L().wrote),
        answerList(lens, st.answers, { collapsible: true }),
        distanceInline(),
        h('h3', {}, L().perspective),
        loading ? skel() : [genPerspective ? genLabel() : null, h('p', { 'data-key': 'lens-perspective' }, genPerspective || c.perspective)],
        h('h3', {}, L().tryThis),
        loading ? skel() : [genTry ? genLabel() : null, h('p', { 'data-key': 'lens-try' }, genTry || c.tryThis)],
        planInput()
      ),
      relatedBlock(lens),
      st.before !== null && st.before !== undefined
        ? h('div', { class: 'lens-after' }, h('p', { class: 'lens-label', id: 'heavy-after-label' }, L().heavyAfterQ), heavySlider('after', () => {
            const y = window.scrollY;
            rerender();
            window.scrollTo(0, y);
          }))
        : null,
      heavyResult(),
      h(
        'div',
        { class: 'lens-rate' },
        h('p', { id: 'rate-q' }, L().rateQ),
        h(
          'div',
          { class: 'lens-faces', role: 'radiogroup', 'aria-labelledby': 'rate-q' },
          [1, 2, 3, 4, 5].map((v) =>
            h(
              'button',
              {
                type: 'button',
                role: 'radio',
                'aria-checked': st.rating === v ? 'true' : 'false',
                'aria-label': `${v}/5 ${L().rateLabels[v - 1]}`,
                class: 'lens-face' + (st.rating === v ? ' on' : ''),
                'data-key': `rate-${v}`,
                onclick: () => rate(v),
              },
              icon(RATE_FACES[v - 1], { size: 30 })
            )
          )
        ),
        h('p', { class: 'lens-face-word muted small', 'aria-hidden': 'true' }, st.rating ? L().rateLabels[st.rating - 1] : ' ')
      ),
      h(
        'div',
        { class: 'actions lens-summary-actions' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn primary',
            'data-key': 'lens-save',
            disabled: st.saving,
            onclick: async () => {
              if (st.saving) return;
              // the plan is free text too: check it before anything is saved
              if (st.plan && st.plan.trim() && !st.planChecked) {
                st.planChecked = true;
                if (!guard(st.plan, () => {})) return;
              }
              st.saving = true;
              const session = {
                id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
                createdAt: Date.now(),
                lensId: lens.id,
                topics: st.topics.slice(),
                concern: st.concern,
                answers: st.answers.slice(),
                rating: st.rating,
              };
              if (Number.isInteger(st.before)) session.before = st.before;
              if (Number.isInteger(st.after)) session.after = st.after;
              const dist = distanceOf(st.distance);
              if (dist) session.distance = { kind: dist.kind, text: dist.text.slice(0, 1000) };
              if (st.plan && st.plan.trim() && !checkRisk(st.plan).risk) session.plan = { text: st.plan.trim().slice(0, 120) };
              // keep what the model wrote, so reopening shows the same words (and says they were AI-written)
              if (genPerspective || genTry) session.generated = { perspective: genPerspective || null, tryThis: genTry || null, source: gen.source };
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
        h('button', { type: 'button', class: 'btn lens-more-btn', 'data-key': 'lens-more-open', 'aria-haspopup': 'dialog', onclick: () => {
          st.sheet = true;
          const y = window.scrollY;
          rerender();
          window.scrollTo(0, y);
        } }, L().more)
      ),
      // what this exercise is not, right under the buttons rather than between the summary and them
      h('p', { class: 'lens-talk' }, L().talk),
      st.sheet ? moreSheet(lens, parts) : null,
    ];
  }

  // Everything else the summary offers, in a sheet from the bottom: another angle on the same
  // worry, the card as an image and its notes, the AI conversation, the approach's limits and
  // background, and finishing without saving. Escape, the close button and the backdrop close it.
  function moreSheet(lens, parts) {
    const c = lens[lk()];
    const dlg = h('dialog', { class: 'lens-sheet', 'data-key': 'lens-sheet', 'aria-labelledby': 'lens-sheet-title' });
    const close = () => {
      st.sheet = false;
      if (dlg.open) dlg.close();
      const y = window.scrollY;
      rerender();
      window.scrollTo(0, y);
      const b = document.querySelector('[data-key="lens-more-open"]');
      if (b) b.focus({ preventScroll: true });
    };
    // leaving the summary from the sheet: close it first, then go
    const leave = (fn) => () => {
      st.sheet = false;
      if (dlg.open) dlg.close();
      fn();
    };
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      close();
    });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) close();
    });
    add(
      dlg,
      h(
        'div',
        { class: 'lens-sheet-body' },
        h('div', { class: 'lens-sheet-head' }, h('h2', { id: 'lens-sheet-title' }, L().more), h('button', { type: 'button', class: 'lens-sheet-close', 'data-key': 'lens-sheet-close', 'aria-label': L().close, onclick: close }, icon('close', { size: 20 }))),
        h(
          'div',
          { class: 'lens-sheet-actions' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn',
              'data-key': 'lens-another',
              onclick: leave(() => {
                commitRating();
                const keep = { concern: st.concern, topics: st.topics.slice(), riskSeen: st.riskSeen, before: st.before, startedAt: st.startedAt };
                const m = llmState();
                reset();
                Object.assign(st.llm, { provider: m.provider, off: m.off, shown: m.shown });
                Object.assign(st, keep);
                go('choose');
              }),
            },
            L().sameAnother
          ),
          cardSave(parts),
          st.aiEnabled
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'btn',
                  'data-key': 'ai-open',
                  onclick: leave(() => {
                    ai.open(lens.id, { concern: st.concern, answers: st.answers.slice() });
                    go('ai');
                  }),
                },
                L().aiContinue
              )
            : null
        ),
        // personal responses belong in the AI conversation, not in fixed sentences on this page
        st.aiEnabled ? h('p', { class: 'muted small lens-ai-note', 'data-key': 'ai-note' }, L().aiNote) : null,
        cardNotes(parts),
        h('section', { class: 'lens-sheet-misses', 'data-key': 'lens-misses' }, h('h3', {}, L().misses), h('p', {}, c.misses)),
        h(
          'details',
          { class: 'lens-more' },
          h('summary', {}, L().moreAbout),
          h('h3', {}, L().concepts),
          h('p', { class: 'tags' }, c.concepts.map((k) => h('span', { class: 'tag' }, k))),
          h('p', { class: 'muted small' }, L().people, lk() === 'zh' ? '：' : ': ', (lk() === 'zh' && lens.peopleZh) || lens.people),
          h('p', { class: 'muted small' }, L().reading(lens.chapter))
        ),
        h('button', { type: 'button', class: 'btn ghost lens-finish', 'data-key': 'lens-finish', onclick: leave(finish) }, L().finish)
      )
    );
    // shown as a modal once it is in the page (the view is attached right after it is built)
    const show = (n) => {
      if (!st.sheet || dlg.open) return;
      if (!dlg.isConnected) return n < 5 && requestAnimationFrame(() => show(n + 1));
      try {
        dlg.showModal();
      } catch (_) {
        dlg.setAttribute('open', '');
      }
    };
    queueMicrotask(() => show(0));
    return dlg;
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
      if (!lensesForTopics(st.topics).includes(lens)) go('choose');
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

  // A plain look back over saved exercises: how many times each approach was used, and how
  // the heaviness changed (lighter / same / heavier counts; an average only from three on).
  function angleMap() {
    const known = st.sessions.filter((s) => lensById(s.lensId));
    if (known.length < 2) return null;
    const lb = lookBack(known);
    const T = L().map;
    return h(
      'details',
      { class: 'lens-more angle-map', 'data-key': 'lens-angle-map' },
      h('summary', {}, T.title(lb.sessions, lb.distinctLenses)),
      h('p', { class: 'muted small' }, T.note(lb.minForAverage)),
      h(
        'ul',
        { class: 'angle-map-list' },
        lb.lenses.map((r) =>
          h(
            'li',
            {},
            h('span', { class: 'angle-map-name' }, lensById(r.lensId)[lk()].name),
            h('span', { class: 'muted small' }, T.row(r))
          )
        )
      )
    );
  }

  function saved() {
    return [
      h('h2', {}, L().saved),
      st.sessions.some((s) => lensById(s.lensId)) ? null : h('p', { class: 'empty' }, L().savedEmpty),
      angleMap(),
      [...st.sessions].reverse().map((s) => {
        const l = lensById(s.lensId);
        if (!l) return null; // from a lens that no longer exists; "delete all data" still removes it
        const c = l[lk()];
        return h(
          'article',
          { class: 'lens-summary compact', id: `lens-saved-${s.id}`, style: `--lens-hue:${HUES[LENSES.indexOf(l) % HUES.length]}` },
          h('div', { class: 'lens-card-head' }, lensMark(l, 32), h('h3', {}, c.name)),
          h('p', { class: 'muted small' }, new Intl.DateTimeFormat(getLang(), { dateStyle: 'medium' }).format(new Date(s.createdAt))),
          h('blockquote', { class: 'lens-concern-quote' }, s.concern),
          h('h4', {}, L().wrote),
          answerList(l, s.answers),
          distanceBlock(s.distance, 'h4'),
          Number.isInteger(s.before) && Number.isInteger(s.after) ? h('p', { class: 'muted small heavy-nums-small' }, `${s.before} → ${s.after}`) : null,
          h(
            'details',
            { class: 'lens-more' },
            h('summary', {}, L().savedMore),
            keepsake({ concern: s.concern, answers: s.answers, topics: s.topics || [], lensId: l.id, before: s.before, after: s.after, createdAt: s.createdAt, }),
            h('h4', {}, L().perspective),
            s.generated && s.generated.perspective ? h('p', { class: 'muted small lens-llm-label' }, L().llmLabel) : null,
            h('p', {}, (s.generated && s.generated.perspective) || c.perspective),
            h('h4', {}, L().tryThis),
            s.generated && s.generated.tryThis ? h('p', { class: 'muted small lens-llm-label' }, L().llmLabel) : null,
            h('p', {}, (s.generated && s.generated.tryThis) || c.tryThis)
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
      st.savedReturn === 'summary' && lensById(st.lensId)
        ? h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn', 'data-key': 'lens-back-summary', onclick: () => {
            st.savedReturn = null;
            go('summary');
          } }, L().backToSummary))
        : h('div', { class: 'actions left' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => go('home') }, L().back)),
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
    // the worry and the questions are one-question screens: their buttons sit at the bottom
    wrap.classList.toggle('lens-flow', ['concern', 'concern-for-lens', 'step'].includes(st.stage));
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
    if (s === 'summary' && st.sheet) {
      // the More sheet closes first, as a sheet does
      st.sheet = false;
      const y = window.scrollY;
      rerender();
      window.scrollTo(0, y);
      const b = document.querySelector('[data-key="lens-more-open"]');
      if (b) b.focus({ preventScroll: true });
    } else if ((s === 'concern' || s === 'concern-for-lens') && st.cstep > 0) {
      st.cstep--;
      go(s);
    } else if (s === 'choose') {
      st.cstep = 2;
      go('concern');
    }
    else if (s === 'drawn' || s === 'compare' || s === 'pick') go('choose');
    else if (s === 'step') {
      if (st.step === 0) go('choose');
      else {
        st.step--;
        go('step');
      }
    } else if (s === 'saved' && st.savedReturn === 'summary' && lensById(st.lensId)) {
      st.savedReturn = null;
      go('summary');
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
    setAiEnabled: (v) => {
      st.aiEnabled = v;
      if (st.llm && !st.llm.shown) st.llm.provider = undefined; // worked out again on the next worry
    },
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
