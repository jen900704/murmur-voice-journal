// A research donation package, built and previewed on the device. Nothing here sends data:
// there is no study to send to yet. When an ethics-approved study exists, the person would
// build the package, read every field in the preview, and choose to hand it over.
//
// What goes in by default: numbers only (voice features, mood and energy, which approaches
// were tried, ratings, heaviness before and after, worry kinds, track ids). Dates become
// days since the first record, so no calendar date or time of day is included. Record ids
// are replaced. Free text (worries, answers, notes, kind things) is left out unless the person
// turns it on separately, and even then obvious identifiers are masked and the preview says
// that names and places can still be in it.

const VOICE_KEYS = ['durationS', 'speechS', 'pauseCount', 'pauseRatio', 'meanPauseS', 'syllables', 'speechRate', 'articulationRate', 'voicedFraction', 'f0MedianHz', 'f0SdSt', 'f0RangeSt', 'intensitySdDb', 'periodicityDb'];

const DAY = 86400000;

// Mask what can be found reliably: e-mail, links, @handles, phone and ID-like digit runs.
export function maskIdentifiers(text) {
  return String(text || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/@[\w.]{2,}/g, '[handle]')
    .replace(/[A-Za-z]?\d[\d\s-]{6,}\d/g, '[number]');
}

function pick(features) {
  if (!features) return null;
  const out = {};
  for (const k of VOICE_KEYS) if (Number.isFinite(features[k])) out[k] = Math.round(features[k] * 1000) / 1000;
  return Object.keys(out).length ? out : null;
}

export function buildDonation({ entries = [], sessions = [], nights = [] } = {}, { includeText = false, appVersion = '' } = {}) {
  const real = entries.filter((e) => !e.demo);
  const times = [...real, ...sessions, ...nights].map((r) => r.createdAt).filter(Number.isFinite);
  const t0 = times.length ? Math.min(...times) : 0;
  const day = (t) => Math.floor((t - t0) / DAY);
  const text = (s) => (includeText && s ? maskIdentifiers(s) : undefined);
  const byDay = (a, b) => a.day - b.day;
  return {
    format: 'murmur-donation-1',
    appVersion,
    includesText: includeText,
    days: times.length ? day(Math.max(...times)) + 1 : 0,
    voice: real
      .map((e) => ({ day: day(e.createdAt), silent: !!e.silent, mood: e.mood ?? null, energy: e.energy ?? null, lang: e.lang || null, features: pick(e.features), note: text(e.note) }))
      .sort(byDay),
    angles: sessions
      .map((s) => ({
        day: day(s.createdAt),
        lens: s.lensId,
        topics: s.topics || (s.topic ? [s.topic] : []),
        rating: s.rating ?? null,
        before: s.before ?? null,
        after: s.after ?? null,
        answered: (s.answers || []).filter((a) => typeof a === 'string' && a.trim()).length,
        distance: s.distance ? s.distance.kind : null,
        worry: text(s.concern),
        answers: includeText ? (s.answers || []).map((a) => (typeof a === 'string' ? maskIdentifiers(a) : a)) : undefined,
      }))
      .sort(byDay),
    nights: nights.map((n) => ({ day: day(n.createdAt), themes: n.themes || (n.theme ? [n.theme] : []), track: n.track || null, kindness: text(n.kindness) })).sort(byDay),
  };
}

// Counts for the preview screen, so the person sees what is in the package before anything else.
export function describeDonation(pkg) {
  const has = (arr, k) => arr.filter((r) => r[k] !== undefined && r[k] !== null && r[k] !== '').length;
  return {
    days: pkg.days,
    voiceRecords: pkg.voice.length,
    withFeatures: has(pkg.voice, 'features'),
    angleSessions: pkg.angles.length,
    nights: pkg.nights.length,
    textFields: pkg.includesText ? has(pkg.voice, 'note') + has(pkg.angles, 'worry') + has(pkg.nights, 'kindness') : 0,
  };
}
