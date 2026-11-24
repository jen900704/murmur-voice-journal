// Checks free text for signs that someone may be at risk, so an exercise can stop and show
// where to get help instead. This is a coarse safety net, not a classifier: it will miss
// some indirect wording, which is why help resources are also always visible.
// Common exaggerations ("累死了", "笑死", "this is killing me", "被打斷") are deliberately
// not matched.

const PATTERNS = {
  self: [
    /自殺|自杀|輕生|轻生|尋死|寻死|自殘|自残|自傷|自伤|割腕|跳樓|跳楼|燒炭|烧炭|上吊|遺書|遗书|一了百了/,
    /(?:好|很|真的|一直|有點|有点|突然|我)?想(?:去)?死(?!你|妳|了你|掉了?你)/,
    /死一死|死了算了|死掉算了|死了比較好|死了比较好|不如死了|不如去死|去死好了/,
    /不想活|活不下去|活著好累|活着好累|活著沒(?:有)?意義|活着没(?:有)?意义|活著有什麼意義|活着有什么意义|活著幹嘛|活着干嘛/,
    /結束(?:我的|自己的)?生命|结束(?:我的|自己的)?生命|了結自己|了结自己|結束自己|结束自己|離開這個世界|离开这个世界/,
    /傷害自己|伤害自己|弄傷自己|弄伤自己|割自己|劃自己|划自己|想不開|想不开|不想醒來|不想醒来|不想再醒/,
    /(?:我|自己)(?:想|好想|只想)?消失(?:就好|算了|比較好|比较好)?|想消失/,
    /沒有我(?:的話)?(?:大家|你們|他們|世界)?(?:會)?(?:比較好|更好)|没有我(?:大家|你们|他们)?(?:会)?(?:比较好|更好)|如果我不在了/,
    /吞(?:了)?(?:一堆|很多|整瓶)?(?:安眠)?藥|吞(?:了)?(?:一堆|很多|整瓶)?(?:安眠)?药|吃(?:了)?(?:一堆|很多|整瓶)(?:安眠)?藥|吃(?:了)?(?:一堆|很多|整瓶)(?:安眠)?药/,
    /從(?:頂樓|樓上|橋上)跳|从(?:顶楼|楼上|桥上)跳/,
    /\bsuicid/i,
    /\bkill(?:ing)?\s+my\s?self\b/i,
    /\btak(?:e|ing)\s+my\s+(?:own\s+)?life\b/i,
    /\bend(?:ing)?\s+(?:my\s+life|it\s+all)\b/i,
    /\b(?:want|wanna|wish)\s+(?:to\s+)?(?:die|be\s+dead|disappear)\b/i,
    /\bwish\s+i\s+(?:was|were)\s+dead\b/i,
    /\b(?:don'?t|do\s+not)\s+want\s+to\s+(?:live|be\s+alive|wake\s+up|be\s+here\s+anymore)\b/i,
    /\bbetter\s+off\s+(?:dead|without\s+me)\b/i,
    /\bno\s+(?:reason|point)\s+(?:to|in)\s+liv(?:e|ing)\b/i,
    /\b(?:life\s+is\s+)?not\s+worth\s+living\b/i,
    /\bself[-\s]?harm/i,
    /\b(?:hurt(?:ing)?|cut(?:ting)?)\s+my\s?self\b(?!\s+some\s+slack)/i,
    /\boverdos/i,
  ],
  others: [
    /(?:殺|杀|弄死)(?:了|死)?(?:他|她|你|妳|他們|她們|他们|她们)/,
    /想(?:要)?(?:殺|杀)人/,
    /\bkill\s+(?:him|her|them|you|someone|somebody)\b/i,
  ],
  abuse: [
    /家暴|性侵|強暴|强暴|性騷擾|性骚扰|虐待|不敢回家|威脅我|威胁我/,
    /被(?:他|她|爸|媽|爸爸|媽媽|男友|女友|老公|老婆|伴侶)?(?:打|揍|踹|掐)(?!槍|斷|擾|臉|敗|折|卡|工|電話|字|球|開|掃|包|烊)/,
    /(?:他|她)[^，。,.!?！？]{0,6}?(?:打|揍|踹|掐)我(?!電話|手機|的)/,
    /(?:他|她)[^，。,.!?！？]{0,6}?(?:摸我|強迫我|强迫我)/,
    /\babus(?:e|ed|ive|ing)\b/i,
    /\b(?:hits?|hitting|beats?|beating|chok(?:es|ed|ing)|slap(?:s|ped|ping)|kick(?:s|ed|ing))\s+me\b/i,
    /\bforced?\s+me\s+to\b|\bforcing\s+me\s+to\b/i,
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
