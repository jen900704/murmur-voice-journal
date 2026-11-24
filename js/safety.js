// Checks free text for signs that someone may be at risk, so the theory-lens exercise can
// stop and show where to get help instead. This is a coarse safety net, not a classifier:
// it will miss some indirect wording, which is why help resources are also always visible.
// Common exaggerations ("累死了", "笑死", "this is killing me") are deliberately not matched.

const PATTERNS = {
  self: [
    /自殺|自杀|輕生|轻生|尋死|寻死|自殘|自残|自傷|自伤|割腕|跳樓|跳楼|燒炭|烧炭|上吊|遺書|遗书/,
    /(?:好|很|真的|一直|有點|有点|突然)?想死(?!你|妳|了你)/,
    /不想活|活不下去|活著沒(?:有)?意義|活着没(?:有)?意义|不如死了|死了算了|死掉算了|死了比較好|死了比较好/,
    /結束(?:我的|自己的)?生命|结束(?:我的|自己的)?生命|了結自己|了结自己|結束自己|结束自己/,
    /傷害自己|伤害自己|弄傷自己|弄伤自己|想不開|想不开|想消失|消失就好|不想醒來|不想醒来|吞藥|吞药|吃很多藥|吃很多药/,
    /\bsuicid/i,
    /\bkill(?:ing)?\s+my\s?self\b/i,
    /\bend(?:ing)?\s+(?:my\s+life|it\s+all)\b/i,
    /\b(?:want|wanna|wish)\s+(?:to\s+)?(?:die|be\s+dead|disappear)\b/i,
    /\b(?:don'?t|do\s+not)\s+want\s+to\s+(?:live|be\s+alive|wake\s+up)\b/i,
    /\bbetter\s+off\s+dead\b/i,
    /\bno\s+reason\s+to\s+live\b/i,
    /\bself[-\s]?harm/i,
    /\b(?:hurt(?:ing)?|cut(?:ting)?)\s+my\s?self\b/i,
    /\boverdos/i,
  ],
  others: [
    /(?:殺|杀|弄死|砍)(?:了|死)?(?:他|她|你|妳|他們|她們|他们|她们)/,
    /想(?:要)?(?:殺|杀)人/,
    /\bkill\s+(?:him|her|them|you|someone|somebody)\b/i,
    /\b(?:hurt|harm)\s+(?:him|her|them|someone|somebody)\b/i,
  ],
  abuse: [
    /家暴|性侵|強暴|强暴|性騷擾|性骚扰|虐待|被打|打我|揍我|不敢回家|威脅我|威胁我|被(?:他|她)摸/,
    /\babus(?:e|ed|ive|ing)\b/i,
    /\b(?:hits?|beats?|hurts?|chokes?)\s+me\b/i,
    /\b(?:raped?|sexual(?:ly)?\s+assault|molest)/i,
    /\bdomestic\s+violence\b/i,
    /\bafraid\s+to\s+go\s+home\b/i,
  ],
};

export function checkRisk(text) {
  const s = String(text || '');
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
    { label: '有立即危險：警察 110、救護 119', number: '110' },
    { label: '在美國：自殺與危機專線（可打電話或傳簡訊）', number: '988' },
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
