// Checks free text for signs that someone may be at risk, so the app can pause and show
// where to get help. This is a coarse safety net, not a classifier: it misses some
// indirect wording and sometimes matches ordinary text. That is why help resources are
// always visible, and why a match pauses with help rather than deleting what was written:
// the person can say it was something else and carry on.

const KIN = '(?:爸|媽|爸爸|媽媽|父親|母親|老爸|老媽|哥|哥哥|姊|姐|姊姊|姐姐|弟|弟弟|妹|妹妹|叔叔|舅舅|伯伯|阿姨|姑姑|爺爺|奶奶|外公|外婆|男友|女友|男朋友|女朋友|老公|老婆|先生|太太|伴侶|前男友|前女友|前夫|前妻|老師|主管|老闆|同學|室友|繼父|繼母)';
const WHO = `(?:他|她|${KIN})`;

const PATTERNS = {
  self: [
    /自殺|自杀|輕生|轻生|尋死|寻死|自殘|自残|自傷|自伤|割腕|燒炭|烧炭|上吊|遺書|遗书|一了百了/,
    /跳樓(?!大拍賣|價|拍賣)|跳楼(?!大拍卖|价)/,
    /(?<!(?:尷尬|丟臉|糗|忙|累|寫|考|熱|笑|餓|煩|氣|吵|醜|冷|痛)到)(?:好|很|真的|一直|有點|有点|突然|我)?想(?:去)?死(?!你|妳|了你|掉了?你|心|背|守|胡同|忠|黨|硬|角|穴|記|讀|命)/,
    /想欲死|欲死欲活|袂想活|毋想活/,
    /死一死|死了算了|死掉算了|死掉就好|死了就好|死了比較好|死了比较好|不如死了|不如死掉|不如去死|去死好了|乾脆去死|干脆去死/,
    /不想活|活不下去|撐不下去|撑不下去|撐不住了|撑不住了|活著好累|活着好累|活著沒(?:有)?意義|活着没(?:有)?意义|活著有什麼意義|活着有什么意义|活著幹嘛|活着干嘛/,
    /結束(?:我的|自己的)?生命|结束(?:我的|自己的)?生命|了結自己|了结自己|結束自己|结束自己|離開這個世界|离开这个世界|想結束這一切|想结束这一切|想解脫|想解脱/,
    /傷害自己|伤害自己|弄傷自己|弄伤自己|割(?:自己|手|手腕)(?!的頭髮|的头发|指甲)|劃(?:自己|手)|划(?:自己|手)/,
    /想不開(?!心|冷氣|燈|窗|門|電視)|想不开(?!心|冷气|灯|窗|门)|不想醒來|不想醒来|不想再醒|一覺不醒|一觉不醒|希望不要醒來|希望不要醒来/,
    /想消失|(?:我|自己)(?:就)?消失(?:比較好|比较好|就好|算了)/,
    /沒有我(?:的話)?(?:大家|你們|他們|她們|世界)?(?:會)?(?:過得)?(?:比較好|更好)|没有我(?:大家|你们|他们)?(?:会)?(?:过得)?(?:比较好|更好)|如果我不在了|我是(?:大家的|家裡的|他們的)?負擔|我是(?:大家的|家里的|他们的)?负担|我是多餘的|我是多余的/,
    /吞(?:了)?(?:一堆|很多|整瓶)?(?:安眠)?藥|吞(?:了)?(?:一堆|很多|整瓶)?(?:安眠)?药|吃(?:了)?(?:一堆|很多|整瓶)(?:安眠)?藥|吃(?:了)?(?:一堆|很多|整瓶)(?:安眠)?药|存(?:了)?(?:很多|一些)?安眠藥|存(?:了)?(?:很多|一些)?安眠药/,
    /從(?:頂樓|樓上|橋上)跳|从(?:顶楼|楼上|桥上)跳|想跳下去|想被車撞|想被车撞/,
    /\bsuicid/i,
    /\bkms\b|\bunalive/i,
    /\bkill(?:ing)?\s+my\s?self\b/i,
    /\b(?:hang|shoot)(?:ing)?\s+my\s?self\b/i,
    /\btak(?:e|ing)\s+my\s+(?:own\s+)?life\b/i,
    /\bend(?:ing)?\s+(?:my\s+life|it\s+all)\b/i,
    /\b(?:want|wanna|going)\s+to\s+end\s+(?:it|things)\b/i,
    /\b(?:want|wanna|wish)\s+(?:to\s+)?(?:die|be\s+dead|disappear)\b/i,
    /\bwish\s+i\s+(?:was|were)\s+(?:dead|never\s+born)\b|\bwish\s+i\s+(?:wasn'?t|hadn'?t\s+been)\s+born\b/i,
    /\b(?:don'?t|do\s+not)\s+want\s+to\s+(?:live|be\s+alive|wake\s+up|be\s+here\s+anymore)\b/i,
    /\bnever\s+wake\s+up\b/i,
    /\bbetter\s+off\s+(?:dead|without\s+me|if\s+i\s+(?:was|were)\s+gone)\b/i,
    /\b(?:i'?m|i\s+am)\s+(?:a|such\s+a)\s+burden\b|\bburden\s+to\s+everyone\b/i,
    /\bno\s+(?:reason|point)\s+(?:to|in)\s+liv(?:e|ing)\b/i,
    /\b(?:life\s+is\s+)?not\s+worth\s+living\b/i,
    /\bself[-\s]?harm/i,
    /\b(?:hurt(?:ing)?|cut(?:ting)?)\s+my\s?self\b(?!\s+some\s+slack)/i,
    /\bcutting\s+again\b/i,
    /\b(?:took|take|taking)\s+too\s+many\s+pills\b/i,
    /\boverdos(?!ed\s+on\s+(?:coffee|caffeine|sugar))/i,
  ],
  others: [
    /(?:殺|杀|弄死|打死)(?:了|死)?(?:他|她|你|妳|他們|她們|他们|她们)/,
    /想(?:要)?(?:殺|杀)人|同歸於盡|同归于尽|帶(?:著)?(?:孩子|小孩)一起走|带(?:着)?(?:孩子|小孩)一起走/,
    /\bkill\s+(?:him|her|them|you|someone|somebody)\b/i,
    /(?<!n't\s)(?<!not\s)\b(?:want|going)\s+to\s+(?:hurt|harm)\s+(?:him|her|them|someone|somebody)\b(?!\s+feelings)/i,
  ],
  abuse: [
    /家暴|性侵|強暴|强暴|虐待|不敢回家|威脅我|威胁我|恐嚇我|恐吓我/,
    /性騷擾(?!防治|課程|課|宣導|講座)|性骚扰(?!防治|课程|宣导)/,
    new RegExp(`被(?:${WHO})?(?:打|揍|踹|掐|摸)(?!槍|斷|擾|臉|敗|折|卡|工|電話|字|球|開|掃|包|烊|針|分|預防針|了預防針|進|入|中)`),
    new RegExp(`${WHO}[^，。,.!?！？]{0,6}?(?:打|揍|踹|掐|摸|甩巴掌)(?:了)?我(?!電話|手機|的)`),
    new RegExp(`${WHO}[^，。,.!?！？]{0,6}?(?:對我動手|強迫我(?!吃|唸|念|讀|加班|寫|做功課)|强迫我(?!吃|念|读|加班|写)|逼我(?!加班|吃|唸|念|讀)|說要殺我|说要杀我)`),
    /\babus(?:e|ed|ive|ing)\b(?!\s+of\s+notation)/i,
    /\b(?:he|she|they|my\s+\w+)\s+(?:keeps\s+|kept\s+|always\s+|still\s+|sometimes\s+)?(?:hits?|hitting|hit|beats?|beat|beating|punch(?:es|ed)?|chok(?:es|ed|ing)|slap(?:s|ped|ping)|kick(?:s|ed|ing)|threaten(?:s|ed|ing)?)\s+me\b(?!\s+(?:out|with|that|at))/i,
    /\b(?:he|she|they|my\s+\w+)\s+(?:forces?|forced|forcing)\s+me\s+to\b(?!\s+(?:work|eat|study|go\s+to))/i,
    /\b(?:raped?|sexual(?:ly)?\s+assault|molest)/i,
    /\bdomestic\s+violence\b/i,
    /\bafraid\s+to\s+go\s+home\b/i,
  ],
};

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
    if (list.some((re) => re.test(s))) kinds.push(kind);
  }
  return { risk: kinds.length > 0, kinds };
}

// Help lines given in model replies, as whole numbers (not inside 1988 or 2113).
export const HELP_NUMBER = /(?<!\d)(?:1925|1995|1980|113|988|911)(?!\d)/;

export const RESOURCES = {
  'zh-TW': [
    { label: '安心專線（24 小時，免付費）', number: '1925' },
    { label: '生命線', number: '1995' },
    { label: '張老師專線', number: '1980' },
    { label: '保護專線：家暴、性侵、兒少保護（24 小時）', number: '113' },
    { label: '在台灣有立即危險：警察 110、救護 119', number: '110' },
    { label: '在美國：自殺與危機專線（可打電話或傳簡訊）', number: '988' },
    { label: '在美國：全國家暴求助專線', number: '18007997233', display: '1-800-799-7233' },
    { label: '在美國有立即危險', number: '911' },
  ],
  en: [
    { label: 'US: 988 Suicide & Crisis Lifeline (call or text)', number: '988' },
    { label: 'US: National Domestic Violence Hotline', number: '18007997233', display: '1-800-799-7233' },
    { label: 'US: immediate danger', number: '911' },
    { label: 'Taiwan: 1925 mental health line (24 hours)', number: '1925' },
    { label: 'Taiwan: 113 protection line (domestic violence, sexual assault, child protection)', number: '113' },
    { label: 'Elsewhere: your local emergency number', number: '' },
  ],
};
