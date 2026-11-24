// Pure, read-only views over Murmur's own content modules. Nothing here writes to disk,
// opens a socket, or logs. The app's files under ../../../js and ../../../data are the single
// source of truth: this file reshapes them for tool output and adds nothing of its own
// beyond the scope note.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { LENSES, TOPICS, TOPIC_COMMON, lensById, lensesForTopic } from '../../../js/lenses.js';
import { checkRisk, resourcesFor, REGIONS } from '../../../js/safety.js';
import { THEMES, THEME_TRACK, TRACKS, trackById, buildScript, scriptSeconds } from '../../../js/bedtime.js';

export { TOPICS, REGIONS, THEMES };
export const LANGS = ['zh-TW', 'en'];
export const LENS_IDS = LENSES.map((l) => l.id);

const SCOPE = {
  en: 'Psychoeducation from Murmur, not therapy, diagnosis or crisis care. It does not replace a counselor or doctor.',
  'zh-TW': '這是 Murmur 的心理教育內容，不是治療、診斷或危機處理，也不能取代諮商師或醫師。',
};
export function scopeNote(lang) {
  return SCOPE[lang === 'en' ? 'en' : 'zh-TW'];
}

const key = (lang) => (lang === 'en' ? 'en' : 'zh');

// ---------- lenses ----------

function lensSummary(l, lang) {
  return {
    id: l.id,
    name: l[key(lang)].name,
    name_zh: l.zh.name,
    name_en: l.en.name,
    chapter: l.chapter,
    people: lang === 'en' ? l.people : l.peopleZh || l.people,
    exclude_topics: l.excludeTopics,
  };
}

export function listLenses(lang) {
  return { count: LENSES.length, topics: TOPICS, lenses: LENSES.map((l) => lensSummary(l, lang)), scope_note: scopeNote(lang) };
}

export function getLens(id, lang) {
  const l = lensById(id);
  if (!l) return null;
  const t = l[key(lang)];
  return {
    ...lensSummary(l, lang),
    lang,
    idea: t.idea,
    steps: t.steps.map((s, i) => ({
      number: i + 1,
      question: s.q,
      why: s.why,
      kind: s.scale ? 'scale_0_to_10' : 'text',
      ...(s.rewrite ? { shows_previous_answer_rewritten: true } : {}),
      ...(s.qZero ? { question_if_zero: s.qZero } : {}),
    })),
    summary_template: t.noticed,
    summary_template_note: 'Placeholders {1}, {2}, {3} stand for the answers to steps 1 to 3. The app fills them on the device.',
    experiment: t.experiment,
    concepts: t.concepts,
    misses: t.misses,
    scope_note: scopeNote(lang),
  };
}

export function lensesFor(topic, lang) {
  const common = TOPIC_COMMON[topic] || [];
  const all = lensesForTopic(topic);
  const rank = (l) => {
    const i = common.indexOf(l.id);
    return i === -1 ? common.length : i;
  };
  const ordered = [...all].sort((a, b) => rank(a) - rank(b));
  return {
    topic,
    count: ordered.length,
    lenses: ordered.map((l) => ({ ...lensSummary(l, lang), often_used_for_topic: common.includes(l.id) })),
    excluded: LENSES.filter((l) => l.excludeTopics.includes(topic)).map((l) => l.id),
    ordering_note: 'Lenses often used for this kind of worry come first. This is a reading aid, not a recommendation.',
    scope_note: scopeNote(lang),
  };
}

// ---------- help lines and the risk screen ----------

function lines(region, lang) {
  return resourcesFor(lang, region).map((r) => ({
    label: r.label,
    ...(r.number ? { number: r.display || r.number, tel: r.number } : {}),
    ...(r.href ? { url: r.href } : {}),
  }));
}

export function getHelpLines(region, lang) {
  return {
    region,
    lang,
    lines: lines(region, lang),
    note: lang === 'en' ? 'If someone is in immediate danger, call the local emergency number first.' : '如果有立即危險，請先打當地的緊急電話。',
    scope_note: scopeNote(lang),
  };
}

const SCREEN = {
  en: 'This is a keyword screen, not a risk assessment. It misses indirect wording and sometimes matches ordinary text.',
  'zh-TW': '這只是關鍵字篩檢，不是風險評估。它會漏掉間接的說法，有時也會誤判一般的句子。',
};
const NO_MATCH = {
  en: 'No pattern matched. That does not mean the person is safe. Help lines are available from get_help_lines.',
  'zh-TW': '沒有符合的字詞，但這不代表這個人是安全的。求助專線可以用 get_help_lines 取得。',
};
const MATCH = {
  en: 'A pattern matched. Pause, show the help lines, and let the person say if it was something else. Do not delete or correct what they wrote.',
  'zh-TW': '有符合的字詞。先暫停，顯示求助專線，讓對方可以說明是不是別的意思。不要刪掉或糾正對方寫的內容。',
};

// The text is checked in memory and dropped. The result never echoes it back.
export function riskScreen(text, region, lang) {
  const { risk, kinds } = checkRisk(text);
  const out = {
    risk,
    kinds,
    is_assessment: false,
    limits: SCREEN[lang === 'en' ? 'en' : 'zh-TW'],
    guidance: (risk ? MATCH : NO_MATCH)[lang === 'en' ? 'en' : 'zh-TW'],
    scope_note: scopeNote(lang),
  };
  if (risk) {
    const regions = region ? [region] : REGIONS;
    out.help_lines = regions.map((r) => ({ region: r, lines: lines(r, lang) }));
  }
  return out;
}

// ---------- bedtime tracks ----------

// Rough speaking rates used only to give a length estimate.
const CHARS_PER_SECOND = { en: 13, 'zh-TW': 3.5 };

function trackSummary(t, lang) {
  const tt = t[key(lang)];
  return { id: t.id, name: tt.name, style: tt.style, lens: t.lens, ...(tt.note ? { caution: tt.note } : {}) };
}

export function suggestTrack(theme, lang, includeScript) {
  const id = THEME_TRACK[theme];
  const t = trackById(id);
  const l = lang === 'en' ? 'en' : 'zh-TW';
  const script = buildScript(id, theme, l);
  return {
    theme,
    lang,
    track: { ...trackSummary(t, lang), approx_minutes: Math.round((scriptSeconds(script, CHARS_PER_SECOND[l]) / 60) * 10) / 10 },
    ...(includeScript ? { script: script.map(([text, pause_seconds]) => ({ text, pause_seconds })) } : {}),
    other_tracks: TRACKS.filter((x) => x.id !== id).map((x) => trackSummary(x, lang)),
    note:
      lang === 'en'
        ? 'A gentle suggestion for this kind of worry. The person can pick any track. A track with a caution is only ever chosen on purpose.'
        : '這只是依煩惱類型給的溫和建議，可以自己選任何一段。附有提醒的那一段只在本人主動選擇時使用。',
    scope_note: scopeNote(lang),
  };
}

export function listTracks(lang) {
  return { themes: THEMES, theme_track: THEME_TRACK, tracks: TRACKS.map((t) => trackSummary(t, lang)), scope_note: scopeNote(lang) };
}

// ---------- recommendations ----------

const RECS = JSON.parse(readFileSync(fileURLToPath(new URL('../../../data/recs.json', import.meta.url)), 'utf8'));
const ITEMS = RECS.items.map((it) => ({ ...it, tones: it.tones || [], cw: it.cw || [], why: it.why || {}, title: it.title || {} }));
export const REC_TYPES = [...new Set(ITEMS.map((i) => i.type))].sort();
export const REC_TONES = [...new Set(ITEMS.flatMap((i) => i.tones))].sort();

// The app keeps its list of heavy content warnings as a private constant in js/extras.js,
// which cannot be imported in Node without the app's DOM helpers. It is read from the source
// text so there is still one list. If that line can no longer be found, the rule fails closed:
// any item with a content warning counts as heavy.
export function parseHeavy(source) {
  const m = /const\s+HEAVY\s*=\s*new\s+Set\(\s*\[([^\]]*)\]\s*\)/.exec(source);
  if (!m) return null;
  const tags = [...m[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => x[1] ?? x[2]);
  return tags.length ? tags : null;
}
function loadHeavy() {
  try {
    return parseHeavy(readFileSync(fileURLToPath(new URL('../../../js/extras.js', import.meta.url)), 'utf8'));
  } catch {
    return null;
  }
}
const HEAVY_TAGS = loadHeavy();
export const HEAVY_RULE = HEAVY_TAGS ? 'app' : 'fallback-any-content-warning';
const HEAVY = new Set(HEAVY_TAGS || []);
export function isHeavy(item) {
  return HEAVY_TAGS ? item.cw.some((c) => HEAVY.has(c)) : item.cw.length > 0;
}

function haystack(it) {
  return [it.id, it.type, it.creator, it.lens, it.year, ...Object.values(it.title), ...Object.values(it.why), ...it.tones].filter(Boolean).join(' \n ').toLowerCase();
}

export function searchRecommendations(query, filters = {}) {
  const lang = filters.lang === 'en' ? 'en' : 'zh-TW';
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const matched = ITEMS.filter(
    (it) => (!filters.type || it.type === filters.type) && (!filters.tone || it.tones.includes(filters.tone)) && (!filters.max_minutes || (it.minutes && it.minutes <= filters.max_minutes)) && words.every((w) => haystack(it).includes(w))
  );
  const allowed = filters.include_heavy === true ? matched : matched.filter((it) => !isHeavy(it));
  const limit = filters.limit || 10;
  return {
    query: words.join(' '),
    total: allowed.length,
    heavy_included: filters.include_heavy === true,
    heavy_hidden: matched.length - allowed.length,
    heavy_rule: HEAVY_RULE,
    heavy_tags: HEAVY_TAGS || [],
    items: allowed.slice(0, limit).map((it) => ({
      id: it.id,
      type: it.type,
      title: it.title[key(lang)] || it.title.en || it.title.orig,
      ...(it.title.orig ? { original_title: it.title.orig } : {}),
      creator: it.creator,
      ...(it.year ? { year: it.year } : {}),
      ...(it.minutes ? { minutes: it.minutes } : {}),
      tones: it.tones,
      content_warnings: it.cw,
      heavy: isHeavy(it),
      why: it.why[key(lang)] || '',
      ...(it.lens ? { lens: it.lens } : {}),
    })),
    list_note: RECS.note,
    scope_note: scopeNote(lang),
  };
}
