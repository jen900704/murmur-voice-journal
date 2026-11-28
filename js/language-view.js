// Language mirror (語言鏡): paste or import your own writing and see which kinds of words you
// used, with every number traced back to the exact words. Everything runs on this device.
// Nothing typed or imported here is sent anywhere, and nothing is saved unless you choose
// "keep in Murmur".
import { checkRisk, helpList } from './safety.js';
import { analyze, findScore, compare, timeSeries, sourcesOf, highlightSpans, GROUPS, INDICES, CI_LEVEL, MIN_HITS_FOR_RATE, MIN_WORDS } from './langlab/score.js';
import { scoreMeta, groupLabel, groupNote, NOTICE, OBS_TEMPLATES, chooseObservations, observationText, validationNote } from './langlab/meta.js';
import { parseFile, wantedInArchive, dedupe, sortByTime } from './langlab/importers.js';
import { readZip, zipSupported } from './langlab/zip.js';

// limits that keep a phone responsive: one file, and text pasted at once
const MAX_FILE_BYTES = 50e6;
const MAX_PASTE_CHARS = 200000;
import { buildReportData, buildReportHtml, sha256Hex } from './langlab/report.js';
import { keepTexts, listKept, deleteKept } from './langlab/store.js';
import { FAMILIES, FAMILY_TEXT, FAMILY_SCORES, findClues, tallyAnalysis, topWords, topFamily } from './langlab/clues.js';
import { fingerprintSvg, FP_W, FP_H } from './langlab/fingerprint.js';
import { sharePng } from './postcard.js';
import { mascot } from './mascot.js';

// the live playground lights at most this much text; the full analysis counts everything
const LIVE_MAX = 4000;
const LIT_SHOWN = 140;
const GUESS_FROM = 50; // units: the same amount the first rows of the results need
const FP_MIN = 8; // lit words needed before a fingerprint is drawn

const PCT = Math.round(CI_LEVEL * 100);

const S = {
  'zh-TW': {
    title: '語言鏡',
    lead: '打一句話，看哪些字亮起來。',
    playLabel: '寫一句，或貼上一大段',
    litLabel: '亮起來的字',
    litSample: '範例',
    famousTag: '名句示範，不是你的資料',
    famousNext: '下一句',
    famousAt: (i, n) => `${i} / ${n}`,
    famousTop: (name, n) => `這句亮最多的是「${name}」，${n} 個。`,
    famousNone: '這句一個字都沒亮。詞表是照現代白話寫的，古文多半數不到。',
    famousSaved: '示範的句子不會存下來。',
    litMore: '只亮前面這一段。完整結果會數全部。',
    litNone: '這句沒有字亮起來。換一句試試。',
    legendLabel: '每種記號代表什麼',
    legendCount: (name, n) => `${name}，${n} 個`,
    samplesLabel: '沒有靈感？試試虛構的範例',
    samples: [
      { name: '趕報告', text: '報告又拖到最後一天，我總是這樣。我應該早點開始的，也許明天會好一點。' },
      { name: '吵架之後', text: '我們昨天吵架了。他永遠不聽我說話，我很難過，可是我也必須承認我說得太重。' },
      { name: '搬家前', text: '下個月我們就要搬走了。以前我很怕改變，現在好像有一點期待，也有一點捨不得大家。' },
    ],
    guessQ: '先猜猜看：你最常用哪一類？',
    guessHit: (g) => `你猜「${g}」，數起來最多的也是「${g}」。`,
    guessMiss: (g, top) => `你猜「${g}」，數起來最多的是「${top}」。`,
    fullResults: '看完整結果',
    importTitle: '匯入檔案',
    howLink: '這是怎麼算的',
    howTitle: '這是怎麼算的',
    howBody: [
      '語言鏡只做一件事：照著寫好的詞表，數你用了哪幾類詞。亮起來的字就是被數到的字。',
      '七種記號裡，六種和完整結果用同一份詞表；「應該」是另外一小份清單。',
      '英文的幾個感受類別和人工情緒標註比對過（AUC .68 到 .94）。中文幾乎都還沒驗證，請當成「你用過的詞」來看。',
      '同一個字在不同句子裡意思不同，詞表分不出來，也看不懂反話。',
    ],
    honest: '這是在數詞，不是測驗。字不會離開這個裝置。',
    fpTitle: '用字指紋',
    fpIntro: '這次亮起來的字，各類有幾個。',
    fpAlt: (parts) => `用字指紋：${parts}`,
    fpTop: '最常亮起來',
    fpFoot: '在數詞，不是測驗',
    fpUnit: '個',
    fpSave: '存成圖片',
    fpSaved: '圖片存好了。',
    fpFailed: '圖片沒有存成功。',
    fpFew: '亮起來的字還不夠畫指紋。',
    fpWordsTitle: (name) => `「${name}」數到的字`,
    fpSee: (name, n) => `${name} ${n}`,
    fpOpen: '點一類，看數到哪些字',
    fpFull: (label) => `完整數字：${label}`,
    fpRisk: '這次不畫指紋。',
    intro: '貼上或匯入你自己寫的文字，看看你用了哪幾類詞。每個數字都可以點開，看到是哪些詞算進去的。',
    notTest: '這是在數詞，不是在測量你是誰，也不是在測量你過得好不好。',
    privacy: '全部在這個裝置上計算，文字不會傳出去。沒有按「留在 Murmur」的話，關掉就消失。',
    own: '請只放你自己寫的文字。',
    pasteLabel: '貼上文字',
    pastePlaceholder: '在這裡打一句話，或貼上你寫的一大段文字',
    fileLabel: '或選擇檔案',
    fileHint: '可以選 .txt、.md、.csv、.json，或各平台官方的資料匯出檔：Instagram、Facebook、Threads（JSON 格式）、X（data/tweets.js）、Bluesky（.car 或 JSON）、Reddit（posts.csv、comments.csv）。可以一次選多個檔案。',
    zipHint: '.zip 檔會直接在這個裝置上打開，只讀取貼文和留言，不讀私訊。如果打不開（檔案太大或瀏覽器較舊），請先解壓縮，再選裡面的檔案。',
    zipNo: '這個瀏覽器不能直接打開 .zip。請先解壓縮，再選裡面的檔案。',
    analyze: '看完整結果',
    working: '正在計算，全部在這個裝置上。',
    reading: '正在讀取檔案。',
    needText: '請先貼上文字或選擇檔案。',
    filesRead: '已讀取的檔案',
    fileRow: (n, kind, c) => `${n}：${kind}，${c} 則`,
    fileBad: (n) => `${n}：讀不出來。請確認是 JSON 或文字格式的匯出檔。`,
    fileZipBad: (n) => `${n}：這個 .zip 打不開。請先解壓縮，再選裡面的檔案。`,
    fileTooBig: (n) => `${n}：檔案太大，這台手機讀不動。可以只選需要的那幾個檔案。`,
    fileNone: (n) => `${n}：沒有找到可以分析的文字。`,
    clearFiles: '清除檔案',
    kinds: { text: '文字檔', csv: 'CSV', json: 'JSON', 'x-tweets': 'X 貼文', 'instagram-posts': 'Instagram 貼文', 'instagram-comments': 'Instagram 留言', 'threads-posts': 'Threads 貼文', 'facebook-posts': 'Facebook 貼文', 'facebook-comments': 'Facebook 留言', 'bluesky-records': 'Bluesky 貼文', 'bluesky-car': 'Bluesky 貼文', 'reddit-posts': 'Reddit 貼文', 'reddit-comments': 'Reddit 留言' },
    results: '你的用詞',
    summary: (items, lang, units) => `${lang}：${items} 則，${units}`,
    unitsZh: (n) => `${n} 個中文字`,
    unitsEn: (n) => `${n} 個英文單字`,
    langName: { zh: '中文', en: '英文' },
    showLang: '顯示哪種語言',
    skipped: (n) => `有 ${n} 則是其他語言，沒有計分。`,
    simplified: '有些文字看起來是簡體中文。這些類別是照繁體中文（台灣用語）寫的。簡體字會先逐字轉成繁體再比對，所以和台灣用語不同的說法還是會漏掉。',
    unvalidated: '這些詞表是為這個 app 寫的，不是 LIWC。只有英文的幾個感受類別和人工情緒標註比對過，中文幾乎都還沒驗證。點開每一類可以看到。',
    lockedSome: (n) => `還有 ${n} 組需要更多文字`,
    lockedAll: (n) => (n === 1 ? '這一組需要更多文字' : `這 ${n} 組都需要更多文字`),
    lockedNeed: (need, have) => `（約 ${need} 個單位，目前 ${have}）`,
    groupNeed: (need) => `約 ${need} 個單位`,
    filePick: '選擇檔案',
    fileNonePicked: '尚未選擇檔案',
    fileMore: (names, n) => `${names}，還有 ${n} 個`,
    fileSep: '、',
    moreShort: (n) => `還有 ${n} 項文字不夠`,
    riskTitle: '先說一件事',
    riskBody: '這些文字裡，有些地方提到想死、受到傷害，或想傷害別人。舊的文字可能是在說已經過去的時候。如果其中有任何一點是你現在的狀況，這些電話可以打：',
    perZh: '每 100 個中文字',
    perEn: '每 100 個單字',
    interval: (lo, hi) => `${PCT}% 區間 ${lo} 到 ${hi}`,
    intervalApprox: '（近似）',
    notEnough: (need, have) => `文字還不夠（需要約 ${need} 個單位，目前 ${have}）`,
    countOnly: (c) => `出現 ${c} 次，次數太少，不算比率`,
    zero: '沒有出現',
    open: '看是哪些詞',
    tierC: '這幾類詞表永遠列不完，也最容易誤算。研究發現它們和人實際的感受、處境對不太上。請當成「你用過的詞」來看。',
    tierCShort: '文字不到 1000 個單位時，這幾類特別不穩定，所以先收起來。',
    lossHelp: '如果寫到的失去現在還是很重，想找人說說，這些電話可以打：',
    motivated: (c) => `這個類別參考的研究：${c}`,
    partsTitle: '這個指數的組成（每 100 單位）',
    earlier: (v, verdict) => `你之前留下的文字：${v}（${verdict}）`,
    verdict: { higher: '這次比較高', lower: '這次比較低', similar: '差不多，區間重疊', unknown: '區間不足，無法比較' },
    compareNote: '只和你自己之前留下的文字比較，不和其他人比較。',
    seriesTitle: '隨時間的變化',
    seriesIntro: '每一段時間的比率。文字太少的時段留空，不補值。用詞的變化可能來自主題、對象、平台或生活事件，怎麼解讀交給你。',
    seriesCat: '類別',
    seriesSource: '來源',
    seriesNone: '有日期的文字還不夠，畫不出變化。每個時段至少需要約 300 個單位。',
    seriesTable: '用表格看',
    period: '時段',
    itemsCol: '則數',
    unitsCol: '單位數',
    rateCol: '比率',
    gap: '文字不夠',
    chartLabel: (label) => `${label}隨時間變化的折線圖`,
    reportHtml: '下載依據報告（HTML）',
    reportJson: '下載資料（JSON）',
    reportNote: '報告在這個裝置上產生，包含方法、詞表版本與授權、每個分數的區間和計入的詞、限制和參考文獻。報告不包含你的原文。',
    keep: '留在 Murmur',
    kept: '已留在這個裝置上。',
    keepNote: '留下之後，下次可以和這次比較。文字只存在這個裝置上。',
    keepFailed: '沒有存成功。這次的結果還在畫面上。',
    restart: '重新開始',
    keptTitle: '留在 Murmur 的文字',
    keptRow: (d, n) => `${d}，${n} 則`,
    delete: '刪除',
    deleted: '已刪除。',
    detailRate: '數值',
    whatCounts: '這一類算什麼',
    wordsTitle: '計入的詞',
    word: '詞',
    count: '次數',
    share: '占這一類的比例',
    valence: '語氣分數合計',
    points: '對指數的影響（點）',
    moreWords: (n) => `另外還有 ${n} 個詞，完整清單在報告裡。`,
    negatedTitle: '因為前面有否定詞而沒有計入',
    cfTitle: '如果沒有這幾個詞',
    cf: (words, v, now) => `把出現最多的「${words}」拿掉，這個數字會從 ${now} 變成 ${v}。少數幾個詞就能讓數字變動這麼多。這只是在說明數字怎麼來的，不是建議你換掉這些詞。`,
    inText: '在原文裡的位置',
    inTextNote: (shown, total) => `顯示 ${shown} 則，共 ${total} 則有計入的詞。`,
    more: '再看更多',
    cannot: '這個數字不能告訴你什麼',
    noHits: '這一類的詞沒有出現。',
    classesTitle: '八類小詞各占多少',
    classNames: { article: '冠詞', prep: '介系詞', ppron: '人稱代名詞', ipron: '非人稱代名詞', auxverb: '助動詞', conj: '連接詞', adverb: '常見副詞', negate: '否定詞' },
    sentShares: (p, n, m) => `句子中偏正向的占 ${p}%，中性 ${n}%，偏負向 ${m}%。`,
    back: '回到結果',
  },
  en: {
    title: 'Language mirror',
    lead: 'Type a sentence and watch the words light up.',
    playLabel: 'Write a sentence, or paste a long piece',
    litLabel: 'Words that lit up',
    litSample: 'Sample',
    famousTag: 'A famous line, not your data',
    famousNext: 'Next line',
    famousAt: (i, n) => `${i} / ${n}`,
    famousTop: (name, n) => `Lit up most in this line: ${name}, ${n}.`,
    famousNone: 'Nothing lit up in this line. The word lists were written for modern everyday writing, so classical text is mostly missed.',
    famousSaved: 'Sample lines are never saved.',
    litMore: 'Only this first part is lit. The full results count everything.',
    litNone: 'No words lit up in this one. Try another sentence.',
    legendLabel: 'What each mark means',
    legendCount: (name, n) => `${name}, ${n}`,
    samplesLabel: 'Nothing in mind? Try a made-up sample',
    samples: [
      { name: 'Deadline', text: 'The report slipped to the last day again. I always do this. I should have started sooner, but maybe tomorrow will be easier.' },
      { name: 'After a fight', text: 'We argued yesterday. He never listens to me and I felt sad, but I have to admit my words were harsh.' },
      { name: 'Before moving', text: 'Next month we will move away. I was afraid of change before, and now I am perhaps a little excited, and I will miss everyone.' },
    ],
    guessQ: 'Guess first: which kind do you use most?',
    guessHit: (g) => `You guessed ${g}, and ${g} was counted most.`,
    guessMiss: (g, top) => `You guessed ${g}. Counted most: ${top}.`,
    fullResults: 'See full results',
    importTitle: 'Import files',
    howLink: 'How this is counted',
    howTitle: 'How this is counted',
    howBody: [
      'The language mirror does one thing: it counts which kinds of words you used, from word lists written in advance. The words that light up are the words that were counted.',
      'Six of the seven marks use the same word lists as the full results. "Shoulds" has a short list of its own.',
      'A few English feeling categories were checked against human emotion labels (AUC .68 to .94). Almost none of the Chinese ones have been checked, so read them as "words you used".',
      'The same word means different things in different sentences. A word list cannot tell, and it does not understand irony.',
    ],
    honest: 'This counts words. It is not a test. Nothing leaves this device.',
    fpTitle: 'Word fingerprint',
    fpIntro: 'How many words of each kind lit up this time.',
    fpAlt: (parts) => `Word fingerprint: ${parts}`,
    fpTop: 'Lit up most',
    fpFoot: 'Counts words. Not a test.',
    fpUnit: '',
    fpSave: 'Save as picture',
    fpSaved: 'Picture saved.',
    fpFailed: 'The picture could not be saved.',
    fpFew: 'Not enough words lit up to draw a fingerprint.',
    fpWordsTitle: (name) => `Words counted as ${name}`,
    fpSee: (name, n) => `${name} ${n}`,
    fpOpen: 'Tap a kind to see the words counted',
    fpFull: (label) => `Full numbers: ${label}`,
    fpRisk: 'No fingerprint is drawn this time.',
    intro: 'Paste or import your own writing and see which kinds of words you used. Every number opens to the exact words that were counted.',
    notTest: 'This counts words. It does not measure who you are or how you are doing.',
    privacy: 'Everything is computed on this device and no text is sent anywhere. Unless you choose "Keep in Murmur", it is gone when you close this.',
    own: 'Please use only text you wrote yourself.',
    pasteLabel: 'Paste text',
    pastePlaceholder: 'Type a sentence here, or paste a long piece you wrote',
    fileLabel: 'Or choose files',
    fileHint: 'You can choose .txt, .md, .csv, .json, or the official data export of Instagram, Facebook, Threads (JSON format), X (data/tweets.js), Bluesky (.car or JSON), or Reddit (posts.csv, comments.csv). Several files at once are fine.',
    zipHint: 'A .zip is opened right here on this device; only posts and comments are read, never direct messages. If it cannot be opened (very large file or older browser), extract it first and choose the files inside.',
    zipNo: 'This browser cannot open .zip files directly. Extract the archive first and choose the files inside.',
    analyze: 'See full results',
    working: 'Working. Everything stays on this device.',
    reading: 'Reading the files.',
    needText: 'Paste some text or choose a file first.',
    filesRead: 'Files read',
    fileRow: (n, kind, c) => `${n}: ${kind}, ${c} ${c === 1 ? 'item' : 'items'}`,
    fileBad: (n) => `${n}: could not be read. Check that it is a JSON or text export.`,
    fileZipBad: (n) => `${n}: this .zip could not be opened. Extract it first and choose the files inside.`,
    fileTooBig: (n) => `${n}: this file is too large to read on a phone. Choose only the files you need.`,
    fileNone: (n) => `${n}: no text to analyze was found.`,
    clearFiles: 'Clear files',
    kinds: { text: 'text file', csv: 'CSV', json: 'JSON', 'x-tweets': 'X posts', 'instagram-posts': 'Instagram posts', 'instagram-comments': 'Instagram comments', 'threads-posts': 'Threads posts', 'facebook-posts': 'Facebook posts', 'facebook-comments': 'Facebook comments', 'bluesky-records': 'Bluesky posts', 'bluesky-car': 'Bluesky posts', 'reddit-posts': 'Reddit posts', 'reddit-comments': 'Reddit comments' },
    results: 'Your words',
    summary: (items, lang, units) => `${lang}: ${items} ${items === 1 ? 'item' : 'items'}, ${units}`,
    unitsZh: (n) => `${n} Chinese characters`,
    unitsEn: (n) => `${n} words`,
    langName: { zh: 'Chinese', en: 'English' },
    showLang: 'Language to show',
    skipped: (n) => `${n} ${n === 1 ? 'item was' : 'items were'} in another language and not scored.`,
    simplified: 'Some of the text looks like Simplified Chinese. The categories were written for Traditional Chinese (Taiwan usage). Simplified characters are converted one by one before matching, so wording that differs from Taiwan usage is still missed.',
    unvalidated: 'These word lists were written for this app, and they are not LIWC. Only a few English feeling categories have been checked against human emotion labels; almost none of the Chinese ones have. Each category says which when you open it.',
    lockedSome: (n) => `${n} more ${n === 1 ? 'group needs' : 'groups need'} more text`,
    lockedAll: (n) => (n === 1 ? 'This group needs more text' : `All ${n} groups need more text`),
    lockedNeed: (need, have) => ` (about ${need} units, you have ${have})`,
    groupNeed: (need) => `about ${need} units`,
    filePick: 'Choose files',
    fileNonePicked: 'No file chosen',
    fileMore: (names, n) => `${names}, and ${n} more`,
    fileSep: ', ',
    moreShort: (n) => `${n} more ${n === 1 ? 'needs' : 'need'} more text`,
    riskTitle: 'One thing first',
    riskBody: 'Some of this text mentions wanting to die, being hurt, or hurting someone. Older writing may describe a time that has passed. If any of it is true for you now, these lines are open:',
    perZh: 'per 100 Chinese characters',
    perEn: 'per 100 words',
    interval: (lo, hi) => `${PCT}% interval ${lo} to ${hi}`,
    intervalApprox: ' (approximate)',
    notEnough: (need, have) => `Not enough text yet (needs about ${need} units, has ${have})`,
    countOnly: (c) => `Used ${c} ${c === 1 ? 'time' : 'times'}; too few for a rate`,
    zero: 'Not used',
    open: 'See the words',
    tierC: 'Lists like these can never be complete and are the easiest to miscount. Studies find they match poorly with how people actually feel or live. Read them as "words you used".',
    tierCShort: 'Under 1,000 units these are especially unstable, so they start folded.',
    lossHelp: 'If a loss you wrote about still weighs on you and you would like to talk to someone, these lines are open:',
    motivated: (c) => `Work that motivated this category: ${c}`,
    partsTitle: 'What the index is made of (per 100 units)',
    earlier: (v, verdict) => `Your earlier kept texts: ${v} (${verdict})`,
    verdict: { higher: 'higher this time', lower: 'lower this time', similar: 'about the same; the intervals overlap', unknown: 'no interval to compare' },
    compareNote: 'Compared only with your own earlier kept texts, never with other people.',
    seriesTitle: 'Over time',
    seriesIntro: 'The rate in each period. Periods with too little text are left empty and never filled in. A change in wording can come from topic, audience, platform or life events; how to read it is up to you.',
    seriesCat: 'Category',
    seriesSource: 'Source',
    seriesNone: 'There is not enough dated text for a series. Each period needs about 300 units.',
    seriesTable: 'See as a table',
    period: 'Period',
    itemsCol: 'Items',
    unitsCol: 'Units',
    rateCol: 'Rate',
    gap: 'not enough text',
    chartLabel: (label) => `Line chart of ${label} over time`,
    reportHtml: 'Download evidence report (HTML)',
    reportJson: 'Download data (JSON)',
    reportNote: 'The report is made on this device. It holds the method, word list versions and licenses, every score with its interval and the words that counted, the limits, and references. It does not hold your text.',
    keep: 'Keep in Murmur',
    kept: 'Kept on this device.',
    keepNote: 'Kept texts let you compare next time. They are stored only on this device.',
    keepFailed: 'Could not save. The results are still on screen.',
    restart: 'Start over',
    keptTitle: 'Texts kept in Murmur',
    keptRow: (d, n) => `${d}, ${n} ${n === 1 ? 'item' : 'items'}`,
    delete: 'Delete',
    deleted: 'Deleted.',
    detailRate: 'Value',
    whatCounts: 'What this counts',
    wordsTitle: 'Words that counted',
    word: 'Word',
    count: 'Count',
    share: 'Share of this category',
    valence: 'Total tone score',
    points: 'Effect on the index (points)',
    moreWords: (n) => `${n} more words; the full list is in the report.`,
    negatedTitle: 'Left out because a negation came just before',
    cfTitle: 'Without these words',
    cf: (words, v, now) => `Without your top words (${words}) this would go from ${now} to ${v}. A few words can move the number this much. This explains where the number comes from; it is not a suggestion to avoid these words.`,
    inText: 'Where they are in your text',
    inTextNote: (shown, total) => `Showing ${shown} of ${total} ${total === 1 ? 'item' : 'items'} with counted words.`,
    more: 'Show more',
    cannot: 'What this cannot tell you',
    noHits: 'No words of this kind were found.',
    classesTitle: 'Share of each of the eight kinds of small words',
    classNames: { article: 'articles', prep: 'prepositions', ppron: 'personal pronouns', ipron: 'impersonal pronouns', auxverb: 'auxiliary verbs', conj: 'conjunctions', adverb: 'common adverbs', negate: 'negations' },
    sentShares: (p, n, m) => `${p}% of sentences lean positive, ${n}% are neutral, ${m}% lean negative.`,
    back: 'Back to results',
  },
};

// Famous lines for the playground's demonstration. Public-domain text only (all published long
// before 1929), each with its author and source. Shown in the interface language first.
const FAMOUS = {
  zh: [
    { text: '我欲乘風歸去，又恐瓊樓玉宇，高處不勝寒。', by: '蘇軾〈水調歌頭〉' },
    { text: '三人行，必有我師焉。', by: '《論語．述而》' },
    { text: '尋尋覓覓，冷冷清清，淒淒慘慘戚戚。', by: '李清照〈聲聲慢〉' },
    { text: '舉頭望明月，低頭思故鄉。', by: '李白〈靜夜思〉' },
  ],
  en: [
    { text: 'Tomorrow, and tomorrow, and tomorrow, creeps in this petty pace from day to day.', by: 'William Shakespeare, Macbeth' },
    { text: 'Parting is such sweet sorrow, that I shall say good night till it be morrow.', by: 'William Shakespeare, Romeo and Juliet' },
    { text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.', by: 'Jane Austen, Pride and Prejudice' },
    { text: 'The world will little note, nor long remember what we say here, but it can never forget what they did here.', by: 'Abraham Lincoln, Gettysburg Address' },
  ],
};
const famousLines = (lang) => (lang === 'en' ? [...FAMOUS.en, ...FAMOUS.zh] : [...FAMOUS.zh, ...FAMOUS.en]);
const stillMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const SVG = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) n.setAttribute(k, v);
  for (const k of kids) if (k) n.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
  return n;
}

// Lexicon files are fetched from this app's own folder (they are in the offline cache).
let lexiconPromise = null;
function loadLexica() {
  if (!lexiconPromise) {
    const get = (name) =>
      fetch(new URL(`../data/lexica/${name}`, import.meta.url))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    lexiconPromise = get('vader.json').then((vader) => (vader ? { vader } : {}));
  }
  return lexiconPromise;
}

export function createLanguageView({ h, add, getLang, toast, openSheet }) {
  const L = () => S[getLang()] || S['zh-TW'];
  const root = h('section', { class: 'view language' });
  const st = {
    screen: 'home',
    text: '',
    files: [],
    picked: [],
    imported: [],
    notes: [],
    busy: '',
    analysis: null,
    earlier: null,
    risk: false,
    lang: null,
    seriesId: 'tone',
    seriesSource: null,
    kept: null,
    keptThis: false,
    open: new Set(),
    closed: new Set(),
    detailId: null,
    excerpts: 15,
    legend: null,
    guess: null,
    sample: 0,
    famous: 0,
    importOpen: false,
    howOpen: false,
    clues: null,
    family: null,
  };

  const num = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '');
  const tone = (x) => (Number.isFinite(x) ? (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(2).replace(/^0(?=\.)/, '') : '');
  const show = (s, v) => (s.kind === 'sentiment' ? tone(v) : num(v));

  function refreshKept() {
    return listKept()
      .then((list) => (st.kept = list))
      .catch(() => (st.kept = []));
  }

  function draw() {
    const key = document.activeElement && root.contains(document.activeElement) && document.activeElement.dataset ? document.activeElement.dataset.key : null;
    root.replaceChildren();
    add(root, st.screen === 'results' ? results() : st.screen === 'detail' ? [h('button', { type: 'button', class: 'link back', 'data-key': 'll-back', onclick: () => go('results') }, L().back), detail(st.detailId)] : home());
    if (key) {
      const again = root.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (again) again.focus();
    }
  }

  function go(screen) {
    st.screen = screen;
    draw();
    const head = root.querySelector('h2');
    if (head) {
      head.setAttribute('tabindex', '-1');
      head.focus();
    }
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
  }

  // ---------- reading files ----------
  async function readOne(name, getText, getBytes, size) {
    try {
      const lower = name.toLowerCase();
      const content = lower.endsWith('.car') ? await getBytes() : await getText();
      const res = parseFile(name, content);
      if (!res.items.length) st.notes.push(L().fileNone(name));
      else {
        st.files.push({ name, size, kind: res.kind, items: res.items.length });
        st.imported.push(...res.items);
      }
    } catch (_) {
      st.notes.push(L().fileBad(name));
    }
  }

  async function readFiles(fileList) {
    st.busy = L().reading;
    for (const f of fileList) if (!st.picked.includes(f.name)) st.picked.push(f.name);
    draw();
    for (const f of fileList) {
      if (/\.zip$/i.test(f.name)) {
        if (!zipSupported()) {
          st.notes.push(L().zipNo);
          continue;
        }
        try {
          if (f.size > MAX_FILE_BYTES * 4) {
            st.notes.push(L().fileTooBig(f.name));
            continue;
          }
          const entries = (await readZip(f)).filter((e) => wantedInArchive(e.name) && e.size < MAX_FILE_BYTES);
          if (!entries.length) st.notes.push(L().fileNone(f.name));
          for (const e of entries) {
            let bytes = null;
            const load = async () => (bytes ||= await e.read());
            await readOne(e.name, async () => new TextDecoder().decode(await load()), load, e.size);
          }
        } catch (_) {
          st.notes.push(L().fileZipBad(f.name));
        }
      } else {
        if (f.size > MAX_FILE_BYTES) {
          st.notes.push(L().fileTooBig(f.name));
          continue;
        }
        await readOne(f.name, () => f.text(), async () => new Uint8Array(await f.arrayBuffer()), f.size);
      }
    }
    st.busy = '';
    draw();
  }

  // ---------- analysis ----------
  async function run() {
    const items = [];
    if (st.text.trim()) items.push({ text: st.text.slice(0, MAX_PASTE_CHARS), timestamp: null, source: 'paste' });
    items.push(...st.imported);
    if (!items.length) {
      st.notes = [L().needText];
      draw();
      const ta = root.querySelector('#ll-text');
      if (ta) ta.focus();
      return;
    }
    st.busy = L().working;
    draw();
    const data = await loadLexica();
    await new Promise((r) => setTimeout(r, 30)); // let the "working" line paint first
    const clean = sortByTime(dedupe(items));
    st.items = clean;
    st.analysis = analyze(clean, data);
    st.risk = clean.some((it) => checkRisk(it.text).risk);
    st.clues = tallyAnalysis(st.analysis);
    st.lang = st.analysis.langs[0] || null;
    st.earlier = null;
    st.keptThis = false;
    await refreshKept();
    if (st.kept && st.kept.length) st.earlier = analyze(st.kept.flatMap((k) => k.items), data);
    st.busy = '';
    st.seriesSource = null;
    go('results');
  }

  // ---------- home ----------
  const fl = () => (getLang() === 'en' ? 'en' : 'zh');

  // text with its counted words marked: text nodes and <mark> only, never markup built from the text
  function litNodes(text, spans, limit = Infinity) {
    const out = [];
    let at = 0;
    for (const sp of spans) {
      if (sp.s >= limit) break;
      if (sp.s > at) out.push(document.createTextNode(text.slice(at, sp.s)));
      out.push(h('mark', { class: `ll-m ll-m-${sp.fam}` }, text.slice(sp.s, sp.e)));
      at = sp.e;
    }
    const end = Math.min(text.length, limit);
    if (at < end) out.push(document.createTextNode(text.slice(at, end)));
    return out;
  }

  // the file picker, its formats and the files read: folded until asked for
  function importBox() {
    const s = L();
    const file = h('input', {
      id: 'll-file',
      class: 'll-file',
      type: 'file',
      multiple: true,
      accept: '.txt,.md,.csv,.json,.js,.car,.zip,text/plain,application/json,text/csv,application/zip',
      'data-key': 'll-file',
      'aria-describedby': 'll-file-names ll-file-hint',
      onchange: (e) => {
        const list = [...e.target.files];
        st.importOpen = true;
        if (list.length) readFiles(list);
      },
    });
    return h(
      'details',
      { class: 'll-import', 'data-key': 'll-import', open: st.importOpen || st.files.length > 0 || st.picked.length > 0, ontoggle: (e) => (st.importOpen = e.currentTarget.open) },
      h('summary', {}, s.importTitle),
      h('label', { class: 'll-label', for: 'll-file' }, s.fileLabel),
      // the real file input lies, transparent, over a button drawn in the page's language:
      // it still takes the click, the keyboard, a dropped file and the label
      h(
        'div',
        { class: 'll-pick' },
        file,
        h('span', { class: 'll-file-btn', 'aria-hidden': 'true' }, s.filePick),
        h('span', { id: 'll-file-names', class: 'll-file-names' + (st.picked.length ? ' on' : ''), 'data-key': 'll-file-names' }, pickedText())
      ),
      h('p', { id: 'll-file-hint', class: 'muted small' }, s.fileHint + ' ' + (zipSupported() ? s.zipHint : s.zipNo)),
      st.files.length
        ? h(
            'div',
            { class: 'll-files' },
            h('p', { class: 'll-label' }, s.filesRead),
            h('ul', {}, st.files.map((f) => h('li', {}, s.fileRow(f.name, s.kinds[f.kind] || f.kind, f.items)))),
            h('button', { type: 'button', class: 'link', 'data-key': 'll-clear', onclick: () => ((st.files = []), (st.picked = []), (st.imported = []), (st.notes = []), draw()) }, s.clearFiles)
          )
        : null
    );
  }

  // method, validity, limits and privacy: one tap away
  function howContent() {
    const s = L();
    return [h('h2', {}, s.howTitle), h('p', { class: 'll-frame' }, s.notTest), s.howBody.map((x) => h('p', {}, x)), h('p', {}, s.privacy), h('p', {}, s.own), h('p', { class: 'muted small' }, NOTICE[fl()])];
  }

  function home() {
    const s = L();
    const F = FAMILY_TEXT[fl()];
    if (st.kept === null) refreshKept().then(() => st.screen === 'home' && st.kept.length && draw());
    const ta = h('textarea', { id: 'll-text', class: 'll-text', rows: '3', placeholder: s.pastePlaceholder, 'data-key': 'll-text' });
    ta.value = st.text;
    const lit = h('div', { class: 'll-lit', 'data-key': 'll-lit', role: 'group', 'aria-label': s.litLabel });
    const said = h('p', { class: 'sr-only', role: 'status', 'data-key': 'll-lit-status' });
    const note = h('p', { class: 'll-key-note', id: 'll-key-note', 'data-key': 'll-key-note' });
    const mumu = mascot('idle', { size: 64 });
    const keys = {};
    const setLegend = () => {
      for (const f of FAMILIES) keys[f].btn.setAttribute('aria-expanded', st.legend === f ? 'true' : 'false');
      note.textContent = st.legend ? F[st.legend].note : '';
      note.hidden = !st.legend;
    };
    const legend = h(
      'div',
      { class: 'll-legend', role: 'group', 'aria-label': s.legendLabel, 'data-key': 'll-legend' },
      FAMILIES.map((f) => {
        const n = h('span', { class: 'll-key-n' }, '0');
        const btn = h(
          'button',
          {
            type: 'button',
            class: 'll-key',
            'data-key': `ll-key-${f}`,
            'aria-controls': 'll-key-note',
            onclick: () => {
              st.legend = st.legend === f ? null : f;
              setLegend();
            },
          },
          h('span', { class: `ll-m ll-m-${f}` }, F[f].name),
          n
        );
        keys[f] = { btn, n };
        return btn;
      })
    );
    const guess = h(
      'div',
      { class: 'll-guess', 'data-key': 'll-guess', hidden: true },
      h('p', { class: 'll-label', id: 'll-guess-q' }, s.guessQ),
      h(
        'div',
        { class: 'chips wrap', role: 'group', 'aria-labelledby': 'll-guess-q' },
        FAMILIES.map((f) =>
          h(
            'button',
            {
              type: 'button',
              class: 'chip' + (st.guess === f ? ' on' : ''),
              'aria-pressed': st.guess === f ? 'true' : 'false',
              'data-key': `ll-guess-${f}`,
              onclick: (e) => {
                st.guess = st.guess === f ? null : f;
                for (const b of e.currentTarget.parentNode.children) {
                  const on = b === e.currentTarget && !!st.guess;
                  b.classList.toggle('on', on);
                  b.setAttribute('aria-pressed', on ? 'true' : 'false');
                }
              },
            },
            F[f].name
          )
        )
      )
    );
    let sayTimer = 0;
    let typeTimer = 0;
    const setCounts = (c) => {
      for (const f of FAMILIES) {
        keys[f].n.textContent = String(c ? c.counts[f] : 0);
        keys[f].btn.classList.toggle('has', !!c && c.counts[f] > 0);
      }
    };
    // Before anything is typed: a famous line is typed in and its words light up one by one,
    // then one plain line says what was counted most. With reduced motion the finished
    // colouring is shown at once. These are samples: nothing here is the person's or is saved.
    const famous = (animate) => {
      const lines = famousLines(getLang());
      const idx = st.famous % lines.length;
      const line = lines[idx];
      const c = findClues(line.text);
      const top = topFamily(c.counts);
      const text = h('p', { class: 'll-lit-text', lang: /[一-鿿]/.test(line.text) ? 'zh-Hant' : 'en' });
      const after = h('p', { class: 'll-famous-note', 'data-key': 'll-famous-note' }, top ? s.famousTop(F[top].name, c.counts[top]) : s.famousNone);
      const finish = () => {
        clearInterval(typeTimer);
        text.replaceChildren(...litNodes(line.text, c.spans));
        after.hidden = false;
        lit.dataset.typing = 'false';
        setCounts(c);
      };
      lit.classList.add('is-sample');
      lit.replaceChildren(
        h('span', { class: 'll-lit-tag', 'data-key': 'll-famous-tag' }, s.famousTag),
        text,
        h('p', { class: 'll-famous-by muted small', 'data-key': 'll-famous-by' }, line.by),
        after,
        h(
          'p',
          { class: 'll-famous-nav' },
          h(
            'button',
            {
              type: 'button',
              class: 'link',
              'data-key': 'll-famous-next',
              onclick: () => {
                st.famous = (idx + 1) % lines.length;
                famous(true);
                const again = lit.querySelector('[data-key="ll-famous-next"]');
                if (again) again.focus();
              },
            },
            s.famousNext
          ),
          h('span', { class: 'll-famous-at muted small' }, s.famousAt(idx + 1, lines.length)),
          h('span', { class: 'muted small' }, s.famousSaved)
        )
      );
      clearInterval(typeTimer);
      if (!animate || stillMotion()) return finish();
      // type it in: a few characters at a time, about three seconds for any line
      const step = Math.max(1, Math.ceil(line.text.length / 45));
      let n = 0;
      after.hidden = true;
      lit.dataset.typing = 'true';
      setCounts(null);
      typeTimer = setInterval(() => {
        if (!lit.isConnected) return clearInterval(typeTimer);
        n += step;
        if (n >= line.text.length) return finish();
        // a word lights when its last character has been typed
        const done = c.spans.filter((sp) => sp.e <= n);
        text.replaceChildren(...litNodes(line.text, done, n), h('span', { class: 'll-caret', 'aria-hidden': 'true' }));
        for (const f of FAMILIES) keys[f].n.textContent = String(done.filter((sp) => sp.fam === f).length);
      }, 70);
    };
    // light the words in place; the page is not redrawn, so the caret and the keyboard stay
    const live = () => {
      const text = st.text;
      if (!text.trim()) {
        guess.hidden = true;
        if (mumu.dataset.state !== 'idle') setMumu('idle');
        return famous(true);
      }
      clearInterval(typeTimer);
      delete lit.dataset.typing;
      lit.classList.remove('is-sample');
      if (checkRisk(text).risk) {
        // nothing is lit or counted from text that matches; the words stay in the field
        lit.replaceChildren(h('div', { class: 'll-help', role: 'note', 'data-key': 'll-live-help' }, h('h3', {}, s.riskTitle), h('p', {}, s.riskBody), helpList(h, getLang())));
        setCounts(null);
        guess.hidden = true;
        return;
      }
      const c = findClues(text, { max: LIVE_MAX });
      const shown = text.slice(0, LIVE_MAX);
      lit.replaceChildren(
        ...[
          h('p', { class: 'll-lit-text' }, litNodes(shown, c.spans, LIT_SHOWN), shown.length > LIT_SHOWN ? '…' : ''),
          shown.length > LIT_SHOWN ? h('p', { class: 'muted small' }, s.litMore) : null,
          !c.total && c.units >= 4 ? h('p', { class: 'muted small', 'data-key': 'll-lit-none' }, s.litNone) : null,
        ].filter(Boolean)
      );
      setCounts(c);
      guess.hidden = c.units < GUESS_FROM;
      if (c.total && mumu.dataset.state !== 'happy') setMumu('happy');
      else if (!c.total && mumu.dataset.state !== 'idle') setMumu('idle');
      clearTimeout(sayTimer);
      sayTimer = setTimeout(() => (said.textContent = FAMILIES.filter((f) => c.counts[f]).map((f) => s.legendCount(F[f].name, c.counts[f])).join(getLang() === 'en' ? '; ' : '；')), 900);
    };
    const setMumu = (state) => {
      const fresh = mascot(state, { size: 64 });
      mumu.dataset.state = state;
      mumu.className = fresh.className;
      mumu.replaceChildren(...fresh.childNodes);
    };
    let liveTimer = 0;
    ta.addEventListener('input', (e) => {
      st.text = e.target.value;
      clearTimeout(liveTimer);
      liveTimer = setTimeout(live, st.text.length > 600 ? 160 : 40);
    });
    live();
    setLegend();
    return [
      h('div', { class: 'll-head' }, h('div', {}, h('h2', {}, s.title), h('p', { class: 'll-lead' }, s.lead)), mumu),
      h(
        'div',
        { class: 'll-play', 'data-key': 'll-play' },
        h('label', { class: 'sr-only', for: 'll-text' }, s.playLabel),
        ta,
        lit
      ),
      said,
      legend,
      note,
      h(
        'div',
        { class: 'll-samples', role: 'group', 'aria-label': s.samplesLabel },
        h('span', { class: 'll-samples-label', 'aria-hidden': 'true' }, s.litSample),
        s.samples.map((x, i) =>
          h(
            'button',
            {
              type: 'button',
              class: 'link ll-sample',
              'data-key': `ll-sample-${i}`,
              onclick: () => {
                st.sample = i;
                st.text = x.text;
                ta.value = x.text;
                live();
              },
            },
            x.name
          )
        )
      ),
      guess,
      h('div', { class: 'll-status', role: 'status', 'aria-live': 'polite' }, st.busy ? h('p', {}, st.busy) : null, st.notes.map((n) => h('p', { class: 'll-note' }, n))),
      h('button', { type: 'button', class: 'btn primary', 'data-key': 'll-analyze', disabled: !!st.busy, onclick: run }, s.analyze),
      importBox(),
      h('p', { class: 'll-honest', 'data-key': 'll-honest' }, s.honest, ' ', h('button', { type: 'button', class: 'link', 'data-key': 'll-how', 'aria-expanded': openSheet ? null : st.howOpen ? 'true' : 'false', onclick: () => (openSheet ? openSheet(() => howContent()) : ((st.howOpen = !st.howOpen), draw())) }, s.howLink)),
      !openSheet && st.howOpen ? h('div', { class: 'll-how', 'data-key': 'll-how-body' }, howContent()) : null,
      keptList(),
    ];
  }

  // ---------- the word fingerprint ----------
  function fingerprint() {
    const s = L();
    const F = FAMILY_TEXT[fl()];
    const c = st.clues;
    if (!c) return null;
    const head = h('h3', { id: 'll-fp-title' }, s.fpTitle);
    if (st.risk) return null; // a picture is never drawn from text that matched the risk check
    if (c.total < FP_MIN) return h('section', { class: 'll-fp', 'data-key': 'll-fp', 'aria-labelledby': 'll-fp-title' }, head, h('p', { class: 'muted' }, s.fpFew));
    const top = topFamily(c.counts);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    const svgText = fingerprintSvg({ counts: c.counts, words: c.words, uiLang: getLang(), date, title: s.fpTitle, topLabel: s.fpTop, foot: s.fpFoot });
    const art = h('div', { class: 'll-fp-art', role: 'img', 'data-key': 'll-fp-art', 'aria-label': s.fpAlt(FAMILIES.map((f) => s.legendCount(F[f].name, c.counts[f])).join(getLang() === 'en' ? '; ' : '；')) });
    // built by js/langlab/fingerprint.js from counts and counted words only, every text escaped
    art.innerHTML = svgText;
    return h(
      'section',
      { class: 'll-fp', 'data-key': 'll-fp', 'aria-labelledby': 'll-fp-title' },
      head,
      h('p', { class: 'muted small' }, s.fpIntro),
      st.guess ? h('p', { class: 'll-fp-guess', 'data-key': 'll-fp-guess' }, st.guess === top ? s.guessHit(F[top].name) : s.guessMiss(F[st.guess].name, F[top].name)) : null,
      art,
      h('p', { class: 'muted small', id: 'll-fp-open' }, s.fpOpen),
      h(
        'div',
        { class: 'll-legend', role: 'group', 'aria-labelledby': 'll-fp-open' },
        FAMILIES.map((f) => h('button', { type: 'button', class: 'll-key' + (c.counts[f] ? ' has' : ''), 'data-key': `ll-fp-${f}`, onclick: () => openFamily(f) }, h('span', { class: `ll-m ll-m-${f}` }, F[f].name), h('span', { class: 'll-key-n' }, String(c.counts[f]))))
      ),
      h('button', { type: 'button', class: 'btn', 'data-key': 'll-fp-save', onclick: () => saveFingerprint(svgText) }, s.fpSave)
    );
  }

  // the exact words behind one family's count
  function familyContent(f) {
    const s = L();
    const F = FAMILY_TEXT[fl()];
    const rows = topWords(st.clues.words[f], 40);
    const res = st.analysis.byLang[st.lang];
    return [
      h('h2', {}, s.fpWordsTitle(F[f].name)),
      h('p', {}, F[f].note),
      rows.length
        ? h(
            'table',
            { class: 'll-table', 'data-key': 'll-fp-words' },
            h('thead', {}, h('tr', {}, [s.word, s.count].map((x) => h('th', { scope: 'col' }, x)))),
            h('tbody', {}, rows.map(([w, n]) => h('tr', {}, h('th', { scope: 'row' }, h('span', { class: 'll-word' }, w)), h('td', {}, n))))
          )
        : h('p', { class: 'muted' }, s.noHits),
      FAMILY_SCORES[f].filter((id) => findScore(res, id)).map((id) => h('button', { type: 'button', class: 'link ll-fp-full', 'data-key': `ll-fp-full-${id}`, onclick: () => openDetail(id) }, s.fpFull(scoreMeta(id, getLang()).label))),
      h('p', { class: 'muted small' }, s.honest),
    ];
  }
  function openFamily(f) {
    if (typeof openSheet === 'function') openSheet(() => familyContent(f));
    else {
      st.family = st.family === f ? null : f;
      draw();
    }
  }

  // a still PNG, three times the drawn size
  async function saveFingerprint(svgText) {
    const s = L();
    try {
      const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = FP_W * 3;
      canvas.height = FP_H * 3;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const res = await sharePng(png, `murmur-word-fingerprint-${new Date().toISOString().slice(0, 10)}.png`, s.fpTitle);
      if (res !== 'cancelled') toast(s.fpSaved);
    } catch (_) {
      toast(s.fpFailed);
    }
  }

  // the names just chosen, in the page's language; a long selection is cut after three
  function pickedText() {
    const s = L();
    if (!st.picked.length) return s.fileNonePicked;
    const names = st.picked.slice(0, 3).join(s.fileSep);
    return st.picked.length > 3 ? s.fileMore(names, st.picked.length - 3) : names;
  }

  function keptList() {
    const s = L();
    if (!st.kept || !st.kept.length) return null;
    const fmtDate = (t) => new Intl.DateTimeFormat(getLang(), { dateStyle: 'medium' }).format(new Date(t));
    return h(
      'div',
      { class: 'll-kept' },
      h('h3', {}, s.keptTitle),
      h(
        'ul',
        {},
        st.kept.map((k) =>
          h(
            'li',
            {},
            h('span', {}, s.keptRow(fmtDate(k.createdAt), k.items.length)),
            h(
              'button',
              {
                type: 'button',
                class: 'link',
                'data-key': `ll-del-${k.id}`,
                'aria-label': `${s.delete}: ${s.keptRow(fmtDate(k.createdAt), k.items.length)}`,
                onclick: async () => {
                  await deleteKept(k.id).catch(() => {});
                  await refreshKept();
                  toast(s.deleted);
                  draw();
                },
              },
              s.delete
            )
          )
        )
      )
    );
  }

  // ---------- results ----------
  // The engine leaves the minimum of some open-class categories unset; show the open-class
  // minimum for those and never the word "undefined".
  const needOf = (sc) => (Number.isFinite(sc.minWords) ? sc.minWords : MIN_WORDS.openC);

  // "What stood out": up to three plain sentences, each a button that opens its evidence.
  function observations(res, cmp) {
    const T = OBS_TEMPLATES[getLang() === 'en' ? 'en' : 'zh'];
    const pick = chooseObservations(res, cmp);
    const basis = pick.mode === 'baseline' ? T.basis.baseline : pick.hadBaseline ? T.basis.countsAfterBaseline : T.basis.counts;
    return h(
      'section',
      { class: 'll-obs', 'data-key': 'll-obs', 'data-mode': pick.mode, 'aria-labelledby': 'll-obs-title' },
      h('h3', { id: 'll-obs-title' }, T.title),
      pick.items.length
        ? [
            h(
              'ul',
              { class: 'll-obs-list' },
              pick.items.map((it) =>
                h('li', {}, h('button', { type: 'button', class: 'll-obs-item', 'data-key': `obs-${it.id}`, onclick: () => openDetail(it.id) }, h('span', { class: 'll-obs-text' }, observationText(it, getLang(), res.lang)), h('span', { class: 'll-row-open' }, L().open)))
              )
            ),
            h('p', { class: 'll-obs-basis muted small' }, basis),
          ]
        : h('p', { class: 'muted' }, T.none)
    );
  }

  function valueText(sc, res) {
    const s = L();
    if (!sc.enough) return s.notEnough(needOf(sc), Math.floor(res.gateUnits));
    if ((sc.kind === 'pct' || sc.kind === 'empath') && sc.count === 0) return s.zero;
    if ((sc.kind === 'pct' || sc.kind === 'empath') && sc.count < MIN_HITS_FOR_RATE) return s.countOnly(sc.count);
    let txt = show(sc, sc.value);
    if (sc.kind === 'pct' || sc.kind === 'empath') txt += ' ' + (res.lang === 'zh' ? s.perZh : s.perEn);
    if (sc.ci) txt += `, ${s.interval(show(sc, sc.ci[0]), show(sc, sc.ci[1]))}${sc.ciMethod === 'wilson' ? s.intervalApprox : ''}`;
    return txt;
  }

  // The same sentence as valueText; the interval is its own piece so it wraps whole (css/language.css).
  function valueParts(sc, res) {
    const txt = valueText(sc, res);
    const i = sc.enough && sc.ci ? txt.indexOf(', ') : -1;
    return i < 0 ? txt : [txt.slice(0, i + 2), h('span', { class: 'll-ci' }, txt.slice(i + 2))];
  }

  function row(sc, res, cmp, max, keySuffix = '') {
    const s = L();
    const m = scoreMeta(sc.id, getLang());
    const rate = sc.enough && (sc.kind === 'pct' || sc.kind === 'empath') && sc.count >= MIN_HITS_FOR_RATE;
    let bar = null;
    if (rate && max > 0) {
      const pos = (v) => `${Math.max(0, Math.min(100, (100 * v) / max)).toFixed(1)}%`;
      bar = h(
        'span',
        { class: 'll-bar', 'aria-hidden': 'true' },
        sc.ci ? h('span', { class: 'll-bar-ci', style: `left:${pos(sc.ci[0])};width:${pos(sc.ci[1] - sc.ci[0])}` }) : null,
        h('span', { class: 'll-bar-dot', style: `left:${pos(sc.value)}` })
      );
    }
    const c = cmp && cmp[sc.id];
    return h(
      'li',
      {},
      h(
        'button',
        { type: 'button', class: 'll-row', 'data-key': `score-${sc.id}${keySuffix}`, onclick: () => openDetail(sc.id) },
        h('span', { class: 'll-row-label' }, m.label),
        h('span', { class: 'll-row-value' + (sc.enough ? '' : ' muted') }, valueParts(sc, res)),
        bar,
        c ? h('span', { class: 'll-row-cmp muted' }, s.earlier(show(sc, c.earlier), s.verdict[c.verdict])) : null,
        h('span', { class: 'll-row-open' }, s.open)
      )
    );
  }

  function results() {
    const s = L();
    const a = st.analysis;
    if (!a || !a.langs.length) {
      return [h('h2', {}, s.results), h('p', {}, s.fileNone(s.pasteLabel)), h('button', { type: 'button', class: 'btn', 'data-key': 'll-restart', onclick: restart }, s.restart)];
    }
    const res = a.byLang[st.lang];
    const cmp = st.earlier && st.earlier.byLang[st.lang] ? compare(res, st.earlier.byLang[st.lang]) : null;
    const pct = res.scores.filter((x) => x.enough && x.count >= MIN_HITS_FOR_RATE);
    const max = Math.max(1, ...pct.map((x) => (x.ci ? x.ci[1] : x.value)));
    const out = [h('h2', {}, s.results), h('p', { class: 'll-notice', role: 'note', 'data-key': 'll-notice' }, NOTICE[getLang() === 'en' ? 'en' : 'zh'])];
    if (st.risk) out.push(h('div', { class: 'll-help', role: 'note', 'data-key': 'll-help' }, h('h3', {}, s.riskTitle), h('p', {}, s.riskBody), helpList(h, getLang())));
    out.push(observations(res, cmp));
    out.push(fingerprint());
    if (!openSheet && st.family && st.clues) out.push(h('div', { class: 'll-how', 'data-key': 'll-fp-family' }, familyContent(st.family)));
    out.push(
      h(
        'ul',
        { class: 'll-summary' },
        a.langs.map((l) => h('li', {}, s.summary(a.byLang[l].nItems, s.langName[l], l === 'zh' ? s.unitsZh(a.byLang[l].words) : s.unitsEn(a.byLang[l].words))))
      ),
      a.skipped.otherLanguage ? h('p', { class: 'muted small' }, s.skipped(a.skipped.otherLanguage)) : null,
      a.simplifiedItems ? h('p', { class: 'll-note' }, s.simplified) : null,
      h('p', { class: 'll-frame' }, s.notTest),
      h('p', { class: 'muted small' }, s.unvalidated + (cmp ? ' ' + s.compareNote : ''))
    );
    if (a.langs.length > 1) {
      out.push(
        h(
          'div',
          { class: 'chips wrap', role: 'group', 'aria-label': s.showLang },
          a.langs.map((l) => h('button', { type: 'button', class: 'chip' + (l === st.lang ? ' on' : ''), 'aria-pressed': l === st.lang ? 'true' : 'false', 'data-key': `ll-lang-${l}`, onclick: () => ((st.lang = l), draw()) }, s.langName[l]))
        )
      );
    }
    // collapsible sections: the closed-class basics start open, the rest open on request
    // groups where no row has enough text do not get a line each: they wait together behind
    // one line that says how many there are, and each still opens from there
    const used = new Set();
    const have = Math.floor(res.gateUnits);
    const locked = [];
    let shown = 0;
    for (const g of GROUPS) {
      const rows = g.ids.map((id) => findScore(res, id)).filter(Boolean);
      if (!rows.length) continue;
      const item = (sc) => {
        const dup = used.has(sc.id);
        used.add(sc.id);
        return row(sc, res, cmp, max, dup ? `-${g.id}` : '');
      };
      // rows with enough text first; the rest wait behind one quiet toggle
      const pass = rows.filter((sc) => sc.enough);
      const short = rows.filter((sc) => !sc.enough);
      const allShort = !pass.length;
      const moreKey = `${g.id}:more`;
      const body = allShort
        ? h('ul', { class: 'll-rows' }, short.map(item))
        : [
            h('ul', { class: 'll-rows' }, pass.map(item)),
            short.length
              ? h(
                  'details',
                  { class: 'll-more', open: st.open.has(moreKey), 'data-key': `ll-more-${g.id}`, ontoggle: (e) => (e.currentTarget.open ? st.open.add(moreKey) : st.open.delete(moreKey)) },
                  h('summary', {}, s.moreShort(short.length)),
                  h('ul', { class: 'll-rows' }, short.map(item))
                )
              : null,
          ];
      const isOpen = allShort ? st.open.has(g.id) : st.closed.has(g.id) ? false : !!g.tier1 || st.open.has(g.id);
      const need = allShort ? Math.min(...short.map(needOf)) : 0;
      if (!allShort) shown++;
      const group = h(
          'details',
          {
            class: 'll-group' + (allShort ? ' ll-group-short' : ''),
            open: isOpen,
            'data-key': `ll-group-${g.id}`,
            ontoggle: (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.currentTarget.open) st.open.add(g.id), st.closed.delete(g.id);
              else st.open.delete(g.id), st.closed.add(g.id);
            },
          },
          h('summary', {}, h('span', { class: 'll-group-name' }, groupLabel(g.id, getLang()), allShort ? h('span', { class: 'll-group-need' }) : null)),
          h('p', { class: 'muted small' }, groupNote(g.id, getLang())),
          g.id === 'loss' && st.risk ? h('div', { class: 'll-help', role: 'note' }, h('p', {}, s.lossHelp), helpList(h, getLang())) : null,
          body
        );
      if (allShort) locked.push({ node: group, need });
      else out.push(group);
    }
    if (locked.length) {
      // the nearest amount of text that would unlock something
      const needs = locked.map((d) => d.need);
      const next = Math.min(...(needs.some((n) => n > have) ? needs.filter((n) => n > have) : needs));
      for (const d of locked) {
        const slot = d.node.querySelector('.ll-group-need');
        if (d.need === next) slot.remove();
        else slot.textContent = s.groupNeed(d.need);
      }
      out.push(
        h(
          'details',
          { class: 'll-locked', open: st.open.has('locked'), 'data-key': 'll-locked', ontoggle: (e) => e.target === e.currentTarget && (e.currentTarget.open ? st.open.add('locked') : st.open.delete('locked')) },
          h('summary', {}, h('span', { class: 'll-locked-line' }, shown ? s.lockedSome(locked.length) : s.lockedAll(locked.length), h('span', { class: 'll-locked-need' }, s.lockedNeed(next, have)))),
          locked.map((d) => d.node)
        )
      );
    }
    out.push(series(res));
    out.push(
      h(
        'div',
        { class: 'll-actions' },
        h('p', { class: 'muted small' }, s.reportNote),
        h('button', { type: 'button', class: 'btn', 'data-key': 'll-report-html', onclick: () => download('html') }, s.reportHtml),
        h('button', { type: 'button', class: 'btn', 'data-key': 'll-report-json', onclick: () => download('json') }, s.reportJson),
        h('p', { class: 'muted small' }, s.keepNote),
        h('button', { type: 'button', class: 'btn', 'data-key': 'll-keep', disabled: st.keptThis, onclick: keep }, st.keptThis ? s.kept : s.keep),
        h('button', { type: 'button', class: 'btn ghost', 'data-key': 'll-restart', onclick: restart }, s.restart)
      )
    );
    return out;
  }

  function restart() {
    Object.assign(st, { text: '', files: [], picked: [], imported: [], notes: [], analysis: null, earlier: null, risk: false, items: [], keptThis: false, clues: null, guess: null, family: null, importOpen: false });
    st.open.clear();
    st.closed.clear();
    go('home');
  }

  async function keep() {
    const s = L();
    try {
      const id = globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'll-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
      await keepTexts({ id, createdAt: Date.now(), items: st.items.map((it) => ({ text: it.text, timestamp: it.timestamp, source: it.source })) });
      st.keptThis = true;
      await refreshKept();
      toast(s.kept);
    } catch (_) {
      toast(s.keepFailed);
    }
    draw();
  }

  async function download(kind) {
    const a = st.analysis;
    const hash = await sha256Hex(st.items.map((it) => it.text).join('\n'));
    const data = buildReportData(a, { uiLang: getLang(), files: st.files.map((f) => ({ name: f.name.split('/').pop(), size: f.size, kind: f.kind, items: f.items })), hash });
    const body = kind === 'html' ? buildReportHtml(data, getLang()) : JSON.stringify(data, null, 1);
    const blob = new Blob([body], { type: kind === 'html' ? 'text/html;charset=utf-8' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = h('a', { href: url, download: `murmur-language-report-${new Date().toISOString().slice(0, 10)}.${kind}` });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ---------- time series ----------
  function series(res) {
    const s = L();
    const sources = sourcesOf(res);
    if (!sources.length) return null;
    if (!sources.includes(st.seriesSource)) st.seriesSource = sources[0];
    const ids = ['tone', ...(res.vader ? ['vader'] : []), ...res.scores.map((x) => x.id), ...res.indices.map((x) => x.id).filter((x) => x !== 'tone' && x !== 'analytic')];
    if (!ids.includes(st.seriesId)) st.seriesId = 'tone';
    const rows = timeSeries(res, st.seriesId, { source: st.seriesSource });
    const label = scoreMeta(st.seriesId, getLang()).label;
    const sel = h('select', { id: 'll-series-cat', 'data-key': 'll-series-cat', onchange: (e) => ((st.seriesId = e.target.value), draw()) }, ids.map((id) => h('option', { value: id, selected: id === st.seriesId }, scoreMeta(id, getLang()).label)));
    const srcSel = sources.length > 1 ? h('select', { id: 'll-series-src', 'data-key': 'll-series-src', onchange: (e) => ((st.seriesSource = e.target.value), draw()) }, sources.map((x) => h('option', { value: x, selected: x === st.seriesSource }, x))) : null;
    const ok = rows.filter((r) => r.value !== null);
    const isTone = st.seriesId === 'vader' || !!INDICES[st.seriesId];
    const f = (v) => (st.seriesId === 'vader' ? tone(v) : num(v));
    return h(
      'div',
      { class: 'll-group ll-series' },
      h('h3', {}, s.seriesTitle),
      h('p', { class: 'muted small' }, s.seriesIntro),
      h('div', { class: 'll-series-pick' }, h('label', { for: 'll-series-cat' }, s.seriesCat), sel, srcSel ? [h('label', { for: 'll-series-src' }, s.seriesSource), srcSel] : null),
      ok.length >= 2 ? chart(rows, label, f, isTone) : h('p', { class: 'll-note' }, s.seriesNone),
      h(
        'details',
        {},
        h('summary', {}, s.seriesTable),
        h(
          'table',
          { class: 'll-table' },
          h('thead', {}, h('tr', {}, [s.period, s.itemsCol, s.unitsCol, s.rateCol].map((c) => h('th', { scope: 'col' }, c)))),
          h('tbody', {}, rows.map((r) => h('tr', {}, h('th', { scope: 'row' }, r.key), h('td', {}, r.items), h('td', {}, r.words), h('td', {}, r.value === null ? s.gap : f(r.value)))))
        )
      )
    );
  }

  // One series, so no legend: the title names it. Gaps stay gaps. Each point has a tooltip.
  function chart(rows, label, f, isTone) {
    const W = 340;
    const H = 170;
    const pad = { l: 40, r: 10, t: 12, b: 26 };
    const vals = rows.filter((r) => r.value !== null).map((r) => r.value);
    let lo = isTone ? Math.min(0, ...vals) : 0;
    let hi = Math.max(...vals);
    if (hi === lo) hi = lo + 1;
    const x = (i) => pad.l + (rows.length === 1 ? 0 : (i * (W - pad.l - pad.r)) / (rows.length - 1));
    const y = (v) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / (hi - lo);
    const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'll-chart', role: 'img', 'aria-label': L().chartLabel(label) });
    for (const v of [lo, (lo + hi) / 2, hi]) {
      g.appendChild(svg('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: 'll-grid' }));
      g.appendChild(svg('text', { x: pad.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'll-axis' }, f(v)));
    }
    let d = '';
    let pen = false;
    rows.forEach((r, i) => {
      if (r.value === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.value).toFixed(1)} `;
      pen = true;
    });
    g.appendChild(svg('path', { d: d.trim(), class: 'll-line' }));
    rows.forEach((r, i) => {
      if (r.value === null) return;
      g.appendChild(svg('circle', { cx: x(i), cy: y(r.value), r: 4.5, class: 'll-point' }, svg('title', {}, `${r.key}: ${f(r.value)}`)));
    });
    const ticks = rows.length <= 6 ? rows.map((_, i) => i) : [0, Math.floor((rows.length - 1) / 2), rows.length - 1];
    for (const i of ticks) g.appendChild(svg('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle', class: 'll-axis' }, rows[i].key));
    return g;
  }

  // ---------- one score, opened ----------
  function openDetail(id) {
    st.detailId = id;
    st.excerpts = 15;
    if (typeof openSheet === 'function') openSheet((rerender) => detail(id, rerender));
    else go('detail');
  }

  function marked(text, spans) {
    const p = h('p', { class: 'll-excerpt' });
    let at = 0;
    for (const sp of spans) {
      if (sp.s > at) p.appendChild(document.createTextNode(text.slice(at, sp.s)));
      p.appendChild(h('mark', { class: 'll-hit' + (sp.v < 0 ? ' neg' : '') }, text.slice(sp.s, sp.e)));
      at = sp.e;
    }
    if (at < text.length) p.appendChild(document.createTextNode(text.slice(at)));
    return p;
  }

  function detail(id, rerender) {
    const s = L();
    const res = st.analysis.byLang[st.lang];
    const sc = findScore(res, id);
    const m = scoreMeta(id, getLang());
    const again = () => (rerender ? rerender() : draw());
    const valid = sc.kind === 'empath' || (sc.kind === 'index' && id !== 'tone') ? null : validationNote(id, res.lang, getLang());
    const out = [
      h('h2', {}, m.label),
      valid ? h('p', { class: 'll-valid' + (valid.checked ? ' checked' : ''), 'data-key': 'll-valid' }, valid.text) : null,
      h('p', { class: 'll-detail-value', 'data-key': 'll-detail-value' }, valueParts(sc, res)),
    ];
    out.push(h('h3', {}, s.whatCounts), h('p', {}, m.definition), m.cite ? h('p', { class: 'muted small' }, s.motivated(m.cite)) : null);
    if (sc.kind === 'sentiment' && sc.nSentences) {
      const p = (x) => Math.round(100 * x);
      out.push(h('p', {}, s.sentShares(p(sc.shares.pos), p(sc.shares.neu), p(sc.shares.neg))));
    }
    if (sc.kind === 'index') {
      out.push(
        h('h3', {}, id === 'analytic' ? s.classesTitle : s.partsTitle),
        h('ul', { class: 'll-classes' }, Object.entries(sc.classes).map(([k, c]) => h('li', {}, `${c.weight > 0 ? '+' : '-'} ${id === 'analytic' ? s.classNames[k] : scoreMeta(k, getLang()).label}: ${num(c.pct)}`)))
      );
    }
    out.push(h('h3', {}, s.wordsTitle));
    if (!sc.contributors.length) out.push(h('p', { class: 'muted' }, s.noHits));
    else {
      const third = sc.kind === 'sentiment' ? s.valence : sc.kind === 'index' ? s.points : s.share;
      const cell = (c) => (sc.kind === 'sentiment' ? tone(c.sum) : sc.kind === 'index' ? (c.points > 0 ? '+' : '') + num(c.points) : `${Math.round(100 * c.share)}%`);
      const top = sc.contributors.slice(0, 15);
      out.push(
        h(
          'table',
          { class: 'll-table', 'data-key': 'll-words' },
          h('thead', {}, h('tr', {}, [s.word, s.count, third].map((c) => h('th', { scope: 'col' }, c)))),
          h('tbody', {}, top.map((c) => h('tr', {}, h('th', { scope: 'row' }, h('span', { class: 'll-word' }, c.word)), h('td', {}, c.count), h('td', {}, cell(c)))))
        )
      );
      const rest = (sc.nTypes ?? sc.contributors.length) - top.length;
      if (rest > 0) out.push(h('p', { class: 'muted small' }, s.moreWords(rest)));
    }
    if (sc.negated && sc.negated.length) out.push(h('p', { class: 'muted small' }, `${s.negatedTitle}: ${sc.negated.map((c) => `${c.word} ×${c.count}`).join(getLang() === 'en' ? ', ' : '、')}`));
    if (sc.counterfactual && sc.contributors.length) {
      out.push(h('div', { class: 'll-cf', 'data-key': 'll-cf' }, h('h3', {}, s.cfTitle), h('p', {}, s.cf(sc.counterfactual.words.join(getLang() === 'en' ? ', ' : '、'), show(sc, sc.counterfactual.value), show(sc, sc.value)))));
    }
    out.push(h('div', { class: 'll-cannot', role: 'note', 'data-key': 'll-cannot' }, h('h3', {}, s.cannot), h('p', {}, m.limits)));
    // the words in place: text nodes and <mark> only, never markup built from the text
    const withHits = [];
    for (let i = 0; i < res.items.length; i++) {
      const spans = highlightSpans(res, i, id);
      if (spans.length) withHits.push([i, spans]);
    }
    if (withHits.length) {
      const shown = withHits.slice(0, st.excerpts);
      out.push(
        h('h3', {}, s.inText),
        h('p', { class: 'muted small' }, s.inTextNote(shown.length, withHits.length)),
        h('div', { class: 'll-excerpts', 'data-key': 'll-excerpts', tabindex: '0', role: 'region', 'aria-label': s.inText }, shown.map(([i, spans]) => marked(res.items[i].text, spans))),
        withHits.length > shown.length ? h('button', { type: 'button', class: 'link', 'data-key': 'll-more', onclick: () => ((st.excerpts += 30), again()) }, s.more) : null
      );
    }
    return out;
  }

  return {
    view() {
      draw();
      return root;
    },
    active: () => st.screen !== 'home' || !!st.text || st.files.length > 0,
  };
}
