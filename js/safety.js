// Checks free text for signs that someone may be at risk, so the app can pause and show
// where to get help. This is a coarse safety net, not a classifier: it misses some
// indirect wording and sometimes matches ordinary text. That is why help resources are
// always visible, and why a match pauses with help rather than deleting what was written:
// the person can say it was something else and carry on.

const KIN = '(?:爸|媽|爸爸|媽媽|父親|母親|老爸|老媽|哥|哥哥|姊|姐|姊姊|姐姐|弟|弟弟|妹|妹妹|叔叔|舅舅|伯伯|阿姨|姑姑|爺爺|奶奶|外公|外婆|男友|女友|男朋友|女朋友|老公|老婆|先生|太太|伴侶|前男友|前女友|前夫|前妻|老師|主管|老闆|同學|室友|繼父|繼母)';
const WHO = `(?:他|她|${KIN})`;

// A pattern is a RegExp, or { re, notAfter } where notAfter is tested against the text just
// before the match. No regex lookbehind anywhere: Safari before 16.4 rejects it at parse
// time, and since app.js imports this file, one lookbehind would blank the whole app.
const PATTERNS = {
  self: [
    /自殺|自杀|輕生|轻生|尋死|寻死|尋短|寻短|自殘|自残|自傷|自伤|割腕|燒炭|烧炭|上吊|遺書|遗书|一了百了|自我了斷|自我了断|紫砂|自鯊|自鲨/,
    /跳樓(?!大拍賣|價|拍賣)|跳楼(?!大拍卖|价)|跳河|跳軌|跳轨|臥軌|卧轨/,
    {
      re: /(?:好|很|真的|一直|有點|有点|突然|我)?想(?:去)?死(?!你|妳|了你|掉了?你|心|背|守|胡同|忠|黨|硬|角|穴|記|讀|命)/,
      notAfter: /(?:尷尬|丟臉|糗|忙|累|寫|考|熱|笑|餓|煩|氣|吵|醜|冷|痛|做|讀|唸|改|加班|無聊|睏)到$/,
    },
    /想欲死|欲死欲活|袂想活|毋想活/,
    /死一死|死了算了|死掉算了|死掉就好|死了就好|死了比較好|死了比较好|不如死了|不如死掉|不如去死|去死好了|乾脆去死|干脆去死/,
    /不想活|活不下去|撐不住了|撑不住了|活著好累|活着好累|活著好痛苦|活着好痛苦|活著沒(?:有)?(?:意義|意思)|活着没(?:有)?(?:意义|意思)|活著有什麼意義|活着有什么意义|活著幹嘛|活着干嘛|沒有活下去的(?:理由|意義)|没有活下去的(?:理由|意义)|不想存在/,
    // 撐不下去 is often about a project; skip it when a work noun comes right before or 的 comes after
    { re: /撐不下去(?!的)|撑不下去(?!的)/, notAfter: /(?:報告|报告|專案|专案|計畫|计划|公司|店|團隊|团队|系統|系统|手機|手机|電池|电池|沒電|案子|論文|论文)[^。！？!?]{0,8}$/ },
    /結束(?:我的|自己的)?生命|结束(?:我的|自己的)?生命|了結自己|了结自己|結束自己|结束自己|離開這個世界|离开这个世界|想結束(?:這一切|一切)|想结束(?:这一切|一切)|想解脫|想解脱/,
    { re: /傷害自己|伤害自己|弄傷自己|弄伤自己|割(?:自己|手|手腕)(?!的頭髮|的头发|指甲|指|的指)|劃(?:自己|手)(?!指)|划(?:自己|手)(?!指)|拿刀割/, notAfter: /(?:不小心|切菜|煮飯|做菜|被紙)[^，。]{0,4}$/ },
    /想不開(?!心|冷氣|燈|窗|門|電視)|想不开(?!心|冷气|灯|窗|门)|不想醒來|不想醒来|不想再醒|一覺不醒|一觉不醒|一睡不醒|希望(?:明天|明早)?不要(?:再)?醒來|希望(?:明天|明早)?不要(?:再)?醒来/,
    /想(?:要)?消失(?!一下|幾天|几天|一陣子|一阵子|一天|一週|一個(?:週末|禮拜|星期|月))|(?:我|自己)(?:就)?消失(?:比較好|比较好|就好|算了)/,
    /沒有我(?:的話)?(?:大家|你們|他們|她們|世界)?(?:會)?(?:過得)?(?:比較好|更好)|没有我(?:大家|你们|他们)?(?:会)?(?:过得)?(?:比较好|更好)|如果我不在了|我是(?:大家的|家裡的|他們的)?(?:負擔|累贅)|我是(?:大家的|家里的|他们的)?(?:负担|累赘)|我是多餘的|我是多余的|拖累(?:大家|家人|你們|所有人)|拖累(?:大家|家人|你们)/,
    /吞(?:了)?(?:一堆|很多|整瓶)?(?:安眠)?藥|吞(?:了)?(?:一堆|很多|整瓶)?(?:安眠)?药|吃(?:了)?(?:一堆|很多|整瓶)(?:安眠)?藥|吃(?:了)?(?:一堆|很多|整瓶)(?:安眠)?药|存(?:了)?(?:很多|一些)?安眠藥|存(?:了)?(?:很多|一些)?安眠药|把.{0,4}藥.{0,2}全(?:部)?吃|把.{0,4}药.{0,2}全(?:部)?吃/,
    /從(?:頂樓|樓上|橋上|陽台|窗戶)跳|从(?:顶楼|楼上|桥上|阳台|窗户)跳|想(?:從.{0,4})?跳下去|想(?:从.{0,4})?跳下去|跳下去就好|想被車撞|想被车撞/,
    /不想再(?:撐|撑|活)(?:了|下去)?|活得(?:好|很|太)(?:累|痛苦)|不知道為什麼還要(?:繼續|活)/,
    /想(?:要)?從(?:這個)?世界上?消失/,
    /不用(?:再)?醒來|睡著.{0,6}不要再(?:醒|起)來|不要再醒來/,
    /沒有我.{0,6}(?:比較|更)(?:好|輕鬆|快樂|開心)/,
    /查.{0,4}(?:怎麼|怎樣)死|(?:怎麼|怎樣)死(?:比較|才)|死.{0,3}比較不痛|(?:怎麼|怎樣)自殺/,
    /藥.{0,8}(?:一次|全部?)吃(?:掉|光)|收集.{0,4}藥|藥.{0,3}收集|囤.{0,4}安眠藥/,
    { re: /一走了之/, notAfter: /(?:辭職|離職|辭掉|出國|搬走|分手)[^，。]{0,4}$/ },
    /沒(?:有)?人(?:會)?在乎我/,
    /(?:留給|寫給)(?:家人|爸媽|爸爸|媽媽|大家|他們).{0,3}的(?:信|話)|遺言|交代後事/,
    /(?:頂樓|樓頂|天台|橋上|月台).{0,6}(?:想了很久|站了很久|往下看|邊緣)/,
    // warning signs found missing by the eval harness (lab/eval): giving things away, leaving for good
    /(?:喜歡|心愛|重要|珍惜|寶貝|所有|全部)的?(?:東西|物品|收藏|寵物).{0,8}(?:送人|送給|分送|送掉|送光|分給)/,
    /(?:很遠|遠遠)的地方.{0,16}(?:不用|不要|不會|再也不)(?:再)?回來/,
    /催吐|故意(?:吐出來|把.{0,4}吐掉)/,
    /\b(?:don'?t|can'?t)\s+see\s+(?:the|a|any)\s+point\s+(?:of|in)\s+(?:anything|living|life|going\s+on|it\s+all|being\s+here)\b/i,
    /\b(?:happier|better\s+off|easier)\s+(?:if\s+i\s+(?:wasn'?t|weren'?t|was\s+not|were\s+not)\s+(?:around|here|alive)|if\s+i\s+(?:was|were)\s+(?:gone|dead))\b/i,
    /\bthinking\s+(?:about|of)\s+ending\s+(?:it|things|everything)\b(?!\s+with)/i,
    /\b(?:sleep|asleep)\s+and\s+(?:not|never)\s+wake\s+up\b/i,
    /\b(?:can'?t|cannot|not\s+sure\s+(?:if\s+)?i\s+can|don'?t\s+(?:think|know\s+if)\s+i\s+can)\s+keep\s+my\s?self\s+safe\b/i,
    /\bsuicid(?!e\s+squad)/i,
    /(?:^|\b(?:i|gonna|wanna|to|just|literally|might|should)\s+)kms\b|\bunalive/i,
    /\bkill(?:ing)?\s+my\s?self\b/i,
    /\b(?:hang|shoot)(?:ing)?\s+my\s?self\b/i,
    /\btak(?:e|ing)\s+my\s+(?:own\s+)?life\b/i,
    /\bend(?:ing)?\s+(?:my\s+life|it\s+all)\b/i,
    /\b(?:want|wanna|going)\s+to\s+end\s+(?:it|things)\b(?!\s+with)/i,
    /\b(?:want|wanna|wish|wanted|wished)\s+(?:to\s+)?(?:die|be\s+dead|disappear)\b/i,
    /\bwanted\s+to\s+(?:kill|end)\s+(?:my\s?self|my\s+life|it\s+all)\b/i,
    /\bwish\s+i\s+could\s+(?:die|disappear|just\s+disappear)\b|\bi\s+should\s+(?:just\s+)?die\b/i,
    /\bwish\s+i\s+(?:was|were)\s+(?:dead|never\s+born)\b|\bwish\s+i\s+(?:wasn'?t|hadn'?t\s+been)\s+born\b/i,
    /\b(?:don'?t|do\s+not)\s+want\s+to\s+(?:live|be\s+alive|exist|wake\s+up|be\s+here\s+anymore)\b/i,
    /\bhope\s+i\s+(?:don'?t|do\s+not|never)\s+wake\s+up\b/i,
    /\bnever\s+wake\s+up\b(?!\s+(?:on\s+time|in\s+time|early|before|when|until|at|for))/i,
    /\bcan'?t\s+go\s+on(?=\s*(?:$|[.,!?;]|like\s+this|anymore|any\s+longer|living|much\s+longer))|\bcan'?t\s+(?:do\s+this\s+anymore|keep\s+going\s+anymore)\b/i,
    /\bbetter\s+off\s+(?:dead|without\s+me|if\s+i\s+(?:was|were)\s+gone)\b/i,
    /\b(?:i'?m|i\s+am)\s+(?:a|such\s+a)\s+burden\b|\bburden\s+to\s+everyone\b/i,
    /\bno\s+(?:reason|point)\s+(?:to|in)\s+liv(?:e|ing)\b|\bnothing\s+to\s+live\s+for\b/i,
    /\b(?:life\s+is\s+)?not\s+worth\s+living\b/i,
    /\bself[-\s]?harm/i,
    /\b(?:hurt(?:ing)?|cut(?:ting)?)\s+my\s?self\b(?!\s+(?:some\s+slack|shaving|while|at\s+(?:the\s+)?(?:gym|work)|cooking|playing|in\s+the\s+kitchen|by\s+accident|accidentally|on\s+(?:a|the)))/i,
    /\bcutting\s+again\b|\bslit(?:ting)?\s+my\s+wrists?\b/i,
    /\bjump(?:ing)?\s+off\s+(?:a|the)\s+(?:bridge|roof|building)\b/i,
    /\b(?:took|take|taking)\s+(?:too\s+many|all\s+(?:of\s+)?my)\s+pills\b/i,
    /\boverdos(?!ed\s+on\s+(?:coffee|caffeine|sugar))/i,
    /\bgiv(?:e|ing|en)\s+(?:all\s+)?(?:of\s+)?(?:my\s+)?(?:stuff|things|belongings|possessions)\s+away\b[^]{0,80}?\bwon'?t\s+(?:be\s+)?need(?:ing)?\b/i,
    /\b(?:it\s+all|all\s+of\s+it|everything)\s+(?:to\s+)?stop\s+(?:for\s+good|forever)\b/i,
    /\bmak(?:e|ing)\s+my\s?self\s+(?:throw\s+up|vomit|puke)\b/i,
  ],
  others: [
    { re: /(?:殺|杀|弄死|打死)(?:了|死)?(?:他|她|你|妳|他們|她們|他们|她们)/, notAfter: /(?:遊戲|游戏|game|電玩|副本|劇裡|剧里|小說|小说)[^，。,.]{0,8}$/i },
    /想(?:要)?(?:殺|杀)人|同歸於盡|同归于尽|帶(?:著)?(?:孩子|小孩).{0,3}一起(?:走|死)|带(?:着)?(?:孩子|小孩).{0,3}一起(?:走|死)/,
    /\bkill\s+(?:him|her|them|you|someone|somebody)\b/i,
    { re: /\b(?:want|going)\s+to\s+(?:hurt|harm)\s+(?:him|her|them|someone|somebody)\b(?!\s+feelings)/i, notAfter: /(?:n't|not)\s+$/i },
  ],
  abuse: [
    /家暴(?!的?(?:電影|新聞|案|議題|防治|宣導|課|講座|影集|劇|報導|小說|电影|新闻|议题|宣导|讲座|剧|报导|小说))|性侵(?!的?(?:電影|新聞|案|議題|防治|宣導|課|講座|影集|劇|報導|小說|电影|新闻|议题|宣导|讲座|剧|报导|小说))|強暴|强暴|虐待(?!動物的?新聞)|不敢回家|恐嚇我|恐吓我|被霸凌|被跟蹤|被跟踪|被尾隨|被尾随/,
    { re: /威脅我|威胁我/, notAfter: /(?:老闆|主管|公司|老板)[^，。]{0,3}$/ },
    /(?:說|说|威脅|威胁|揚言|扬言)(?:要)?(?:殺|杀)(?:了)?我/,
    /性騷擾(?!防治|課程|課|宣導|講座)|性骚扰(?!防治|课程|宣导)/,
    new RegExp(`被(?:我的?)?(?:${WHO})?(?:打|揍|踹|掐|摸(?!頭|头))(?!槍|斷|擾|臉|敗|折|卡|工|電話|字|球|開|掃|包|烊|針|分|預防針|了預防針|進|入|中)`),
    new RegExp(`${WHO}[^，。,.!?！？]{0,6}?(?:打|揍|踹|掐|摸|甩巴掌)(?:了)?我(?!電話|手機|的)`),
    new RegExp(`${WHO}[^，。,.!?！？]{0,6}?(?:對我動手|強迫我(?!吃|唸|念|讀|加班|寫|做功課)|强迫我(?!吃|念|读|加班|写)|逼我(?!們|们|加班|吃|唸|念|讀|去相親|結婚|生小孩|考|補習))`),
    /要我好看|不會放過我/,
    /\bby\s+the\s+(?:throat|neck)\b|\bstrangl|\bhands?\s+(?:around|on)\s+my\s+(?:throat|neck)\b/i,
    /\babus(?:e|ed|ive|ing)\b(?!\s+(?:of\s+notation|class|course|prevention|program))/i,
    /\b(?:he|she|they|my\s+(?!baby|cat|dog|kitten|puppy|toddler)\w+)\s+(?:keeps\s+|kept\s+|always\s+|still\s+|sometimes\s+)?(?:hits?|hitting|hit|beats?|beat|beating|punch(?:es|ed)?|chok(?:es|ed|ing)|slap(?:s|ped|ping)|kick(?:s|ed|ing)|threaten(?:s|ed|ing)?)\s+me\b(?!\s+(?:out|with|that|at|up|back)|[^.!?]{0,30}\b(?:jok|play|game|practice))/i,
    /\bthreaten(?:s|ed|ing)?\s+to\s+(?:kill|hurt)\s+me\b/i,
    /\b(?:he|she|they|my\s+\w+)\s+(?:forces?|forced|forcing)\s+me\s+to\b(?!\s+(?:work|eat|study|go\s+to))/i,
    /\brap(?:e|ed|es|ing|ist)\b|\bsexual(?:ly)?\s+assault|\bmolest|\bi\s+was\s+assaulted\b/i,
    /\bdomestic\s+violence\b(?!\s+(?:movie|film|documentary|class|course|awareness))/i,
    /\b(?:afraid|scared)\s+to\s+go\s+home\b/i,
  ],
};

function matches(entry, s) {
  if (entry instanceof RegExp) return entry.test(s);
  const re = new RegExp(entry.re.source, entry.re.flags.includes('g') ? entry.re.flags : entry.re.flags + 'g');
  for (const m of s.matchAll(re)) {
    if (!entry.notAfter.test(s.slice(Math.max(0, m.index - 12), m.index))) return true;
  }
  return false;
}

// iOS types curly apostrophes, and people sometimes put spaces between Chinese characters.
export function normalizeForCheck(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/([㐀-鿿])\s+(?=[㐀-鿿])/g, '$1');
}

export function checkRisk(text) {
  const s = normalizeForCheck(text);
  const kinds = [];
  for (const [kind, list] of Object.entries(PATTERNS)) {
    if (list.some((entry) => matches(entry, s))) kinds.push(kind);
  }
  return { risk: kinds.length > 0, kinds };
}


// A help line as a model gives it: a number next to a word like call, text, line or 專線.
// A bare number ("in 1925 my grandmother", "room 112") does not count.
const NUMS = '(?:1925|1995|1980|113|988|911|116\\s?123|13\\s?11\\s?14|741741|112|999)';
const WORDS = '(?:call|text|dial|phone|ring|hotline|helpline|lifeline|crisis line|samaritans|專線|撥打|撥|打給|打電話|打|電話|生命線|安心專線|保護專線)';
const HELP_LINE = new RegExp(`${WORDS}[^\\n\\d]{0,20}${NUMS}(?![\\d/])|${NUMS}(?![\\d/])[^\\n\\d]{0,12}(?:專線|生命線|line|hotline|lifeline)`, 'i');
export function hasHelpLine(text) {
  return HELP_LINE.test(String(text || ''));
}

// Help lines by region. Shown for the region the person picks (a guess from the time zone
// at first), so a person in Taiwan does not have to read past US numbers in a hard moment.
const LINES = {
  TW: [
    { zh: '安心專線（24 小時，免付費）', en: '1925 mental health line (24 hours, free)', number: '1925' },
    { zh: '生命線（24 小時）', en: 'Lifeline (24 hours)', number: '1995' },
    { zh: '保護專線：家暴、性侵、兒少保護（24 小時）', en: '113 protection line: domestic violence, sexual assault, child protection (24 hours)', number: '113' },
    { zh: '有立即危險：報警', en: 'Immediate danger: police', number: '110' },
    { zh: '有立即危險：叫救護車', en: 'Immediate danger: ambulance', number: '119' },
    { zh: '張老師專線（非 24 小時）', en: 'Teacher Chang line (not 24 hours)', number: '1980' },
  ],
  US: [
    { zh: '自殺與危機專線（可打電話或傳簡訊，24 小時）', en: '988 Suicide & Crisis Lifeline (call or text, 24 hours)', number: '988' },
    { zh: '全國家暴求助專線（24 小時）', en: 'National Domestic Violence Hotline (24 hours)', number: '18007997233', display: '1-800-799-7233' },
    { zh: '有立即危險', en: 'Immediate danger', number: '911' },
  ],
  other: [
    { zh: '有立即危險：打當地的緊急電話', en: 'Immediate danger: call your local emergency number', number: '' },
    { zh: '找你所在國家的免費求助專線', en: 'Find a free helpline in your country', href: 'https://findahelpline.com', display: 'findahelpline.com' },
  ],
};
export const REGIONS = ['TW', 'US', 'other'];

function guessRegion(lang) {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz === 'Asia/Taipei') return 'TW';
    if (/^America\/(?:New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana|Indianapolis|Kentucky|Louisville|Boise|Juneau|Adak|Menominee|Metlakatla|Nome|Sitka|Yakutat|North_Dakota|Puerto_Rico)|^Pacific\/Honolulu$|^US\//.test(tz)) return 'US';
    // a known time zone elsewhere: do not guess Taiwan or the US from the language
    if (tz && tz !== 'UTC' && tz !== 'Etc/UTC') return 'other';
  } catch (_) {
    /* fall through */
  }
  return lang === 'en' ? 'US' : 'TW';
}

export function getRegion(lang) {
  try {
    const r = localStorage.getItem('murmur-region');
    if (REGIONS.includes(r)) return r;
  } catch (_) {
    /* storage can be unavailable */
  }
  return guessRegion(lang);
}

export function setRegion(r) {
  try {
    localStorage.setItem('murmur-region', r);
  } catch (_) {
    /* the choice just will not be remembered */
  }
}

export function resourcesFor(lang, region = getRegion(lang)) {
  const k = lang === 'en' ? 'en' : 'zh';
  return (LINES[region] || LINES.other).map((r) => ({ label: r[k], number: r.number || '', display: r.display, href: r.href }));
}

// RESOURCES[lang] is the list for the current region (kept for older callers and tests).
export const RESOURCES = {
  get 'zh-TW'() {
    return resourcesFor('zh-TW');
  },
  get en() {
    return resourcesFor('en');
  },
};

const REGION_LABEL = {
  zh: { title: '地區', TW: '台灣', US: '美國', other: '其他地方' },
  en: { title: 'Region', TW: 'Taiwan', US: 'US', other: 'Elsewhere' },
};

// The help list with a small region switch. h is the app's element helper.
export function helpList(h, lang) {
  const k = lang === 'en' ? 'en' : 'zh';
  const ul = h('ul', { class: 'resource-list' });
  const fill = (region) => {
    ul.replaceChildren(
      ...resourcesFor(lang, region).map((r) =>
        h(
          'li',
          {},
          h('span', {}, r.label),
          r.number
            ? h('a', { class: 'btn call', href: `tel:${r.number}` }, r.display || r.number)
            : r.href
              ? h('a', { class: 'btn call', href: r.href, target: '_blank', rel: 'noopener' }, r.display || r.href)
              : null
        )
      )
    );
  };
  const current = getRegion(lang);
  const chips = REGIONS.map((r) =>
    h(
      'button',
      {
        type: 'button',
        class: 'chip small' + (r === current ? ' on' : ''),
        'aria-pressed': r === current ? 'true' : 'false',
        'data-key': `region-${r}`,
        onclick: (e) => {
          setRegion(r);
          for (const c of e.currentTarget.parentNode.children) {
            const on = c === e.currentTarget;
            c.classList.toggle('on', on);
            c.setAttribute('aria-pressed', on ? 'true' : 'false');
          }
          fill(r);
        },
      },
      REGION_LABEL[k][r]
    )
  );
  fill(current);
  return h('div', { class: 'help-lines' }, h('div', { class: 'chips wrap region-chips', role: 'group', 'aria-label': REGION_LABEL[k].title }, chips), ul);
}
