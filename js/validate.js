// Cleans records read from a backup file before they are stored. A backup can be edited by
// hand or come from somewhere else, and one bad record (a date far in the future, a missing
// field) could otherwise break a screen on every launch. Each cleaner keeps only known fields
// of the right type and returns null for a record that cannot be used.

const MAX_TIME = 8.64e15; // the largest date JavaScript can show
const isTime = (v) => Number.isFinite(v) && v > 0 && v < MAX_TIME;
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const optStr = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);
const num = (v) => (Number.isFinite(v) ? v : null);
const rating = (v) => (Number.isInteger(v) && v >= 1 && v <= 7 ? v : null);
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function cleanFeatures(f) {
  if (!plain(f)) return null;
  const out = {};
  for (const [k, v] of Object.entries(f)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 40);
  }
  // the drawing contour: up to 64 points of { f0, e }, f0 null where unvoiced
  if (Array.isArray(f.contour)) out.contour = f.contour.slice(0, 200).map((p) => ({ f0: plain(p) ? num(p.f0) : null, e: plain(p) ? num(p.e) ?? 0 : 0 }));
  if (plain(f.quality)) {
    const q = f.quality;
    out.quality = {
      clipFraction: num(q.clipFraction),
      noiseFloorDb: num(q.noiseFloorDb),
      snrDb: num(q.snrDb),
      flags: Array.isArray(q.flags) ? q.flags.filter((x) => typeof x === 'string').slice(0, 10) : [],
    };
  }
  return out;
}

export function cleanEntry(e) {
  if (!plain(e) || typeof e.id !== 'string' || !e.id || !isTime(e.createdAt)) return null;
  const silent = e.silent === true && (e.features === null || e.features === undefined);
  const features = silent ? null : cleanFeatures(e.features);
  if (!features && !silent) return null;
  return {
    id: e.id.slice(0, 80),
    createdAt: e.createdAt,
    prompt: str(e.prompt, 300),
    lang: str(e.lang, 10),
    mood: rating(e.mood),
    energy: rating(e.energy),
    note: str(e.note, 4000), // written pieces (js/writing.js) can run long
    demo: e.demo === true,
    features,
    silent: silent || undefined,
    featureVersion: Number.isInteger(e.featureVersion) ? e.featureVersion : 0,
    hasAudio: false,
    capture: plain(e.capture) ? { mimeType: str(e.capture.mimeType, 60), sampleRate: num(e.capture.sampleRate), autoGainControl: e.capture.autoGainControl ?? null, noiseSuppression: e.capture.noiseSuppression ?? null, echoCancellation: e.capture.echoCancellation ?? null } : null,
  };
}

export function cleanNight(n) {
  if (!plain(n) || typeof n.id !== 'string' || !n.id || !isTime(n.createdAt)) return null;
  return {
    id: n.id.slice(0, 80),
    createdAt: n.createdAt,
    theme: optStr(n.theme, 30),
    worry: str(n.worry, 1000),
    kindness: str(n.kindness, 200),
    track: optStr(n.track, 40),
    seed: str(n.seed, 200) || n.id.slice(0, 80),
    lang: str(n.lang, 10),
  };
}

export function cleanSession(s) {
  if (!plain(s) || typeof s.id !== 'string' || !s.id || !isTime(s.createdAt) || typeof s.lensId !== 'string') return null;
  return {
    id: s.id.slice(0, 80),
    createdAt: s.createdAt,
    lensId: s.lensId.slice(0, 40),
    topic: optStr(s.topic, 30),
    concern: str(s.concern, 400),
    answers: Array.isArray(s.answers) ? s.answers.slice(0, 10).map((a) => (Number.isFinite(a) ? a : str(a, 400))) : [],
    rating: Number.isInteger(s.rating) && s.rating >= 1 && s.rating <= 5 ? s.rating : null,
  };
}
