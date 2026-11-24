// On-device contextual bandit for the ONE featured item: the row above the lens pick list and
// the suggested bedtime track (and, always gated, the small action shown first on the low-mood
// note). Everything else stays in expert order. This is plumbing for honest evaluation, not a
// claim that personalization helps: every decision is logged with its propensity so that the
// question can be tested off-policy with the scripts in lab/rl.
//
// The contract is lab/rl/POLICY_SPEC.md (v1); section numbers below refer to it.
//   model (4): one Beta-Bernoulli posterior per (surface, context, arm). The prior is worth
//     N0 = 3 pseudo-observations with mean 0.60 - 0.02 * r, r = place in the expert order of
//     the eligible arms, so with no data the greedy arm is the expert's first.
//   decision (5): pi(a) = (1 - EPS) * [a is greedy] + EPS * ((1 - KAPPA) * q_TS(a) + KAPPA / K)
//     with EPS = 0.20 and KAPPA = 0.25. q_TS (the chance each arm has the largest posterior
//     draw) has no closed form and is estimated by Monte Carlo, MC_DRAWS = 1000 joint draws
//     seeded per decision. The action is then drawn from exactly the vector pi that is logged,
//     so the logged propensity is exact for the mechanism that chose, and never below
//     EPS * KAPPA / K.
//   discounting (7): before each learning update in a context, all data counts in that context
//     are multiplied by GAMMA = 0.98. The data counts of one context therefore never sum to
//     more than 1 / (1 - GAMMA) = 50 (the effective sample size cap); a rating's weight halves
//     after about 34 later ratings. A session without a rating changes nothing.
//   safety (3) lives outside the learner: callers pass only eligible arms (topic exclusions
//     and so on), and a gated decision (opted out, risk language in the session or in the last
//     36 hours, latest mood 1 or 2 within 36 hours, or the topic is a loss) features the
//     expert's first item with probability 1, draws no random number, and is never learned
//     from. Opted out, nothing is logged at all. Help links are never arms.
//
// Pure functions with a seedable RNG, so the same file runs in Node for the tests.

export const POLICY_VERSION = 'murmur-ts-1';
export const SCHEMA = 1;
export const N0 = 3;
export const PRIOR_TOP = 0.6;
export const PRIOR_STEP = 0.02;
export const EPS = 0.2;
export const KAPPA = 0.25;
export const GAMMA = 0.98;
export const ESS_CAP = 1 / (1 - GAMMA); // 50
export const MC_DRAWS = 1000;
export const MAX_LOG = 5000;
export const RECENT_MS = 36 * 3600 * 1000;
export const SURFACES = ['lens', 'track', 'small'];
export const GATES = ['risk', 'low-mood', 'loss'];

// ---------- seedable random numbers ----------
export function hashSeed(text) {
  let x = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng) {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

// Marsaglia and Tsang (2000); shapes below 1 use the boost gamma(k) = gamma(k + 1) * u^(1/k)
export function sampleGamma(rng, shape) {
  if (shape < 1) {
    let u = 0;
    while (u === 0) u = rng();
    return sampleGamma(rng, shape + 1) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x;
    let v;
    do {
      x = normal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (u > 0 && Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampleBeta(rng, a, b) {
  const x = sampleGamma(rng, a);
  const y = sampleGamma(rng, b);
  return x + y > 0 ? x / (x + y) : 0.5;
}

// ---------- prior, posterior, evidence ----------
// rank 0 is the expert's first choice among the eligible arms
export function priorFor(rank) {
  const mean = Math.max(0.05, PRIOR_TOP - PRIOR_STEP * rank);
  return { a: N0 * mean, b: N0 * (1 - mean) };
}

const own = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
const amount = (v) => (Number.isFinite(v) && v > 0 ? Math.min(v, ESS_CAP) : 0);

// eligible: arm ids in expert order. evidence: { armId: { s, f } }, the data counts of this context.
export function posteriors(eligible, evidence = {}) {
  return eligible.map((arm, i) => {
    const p = priorFor(i);
    const e = own(evidence, arm) ? evidence[arm] : null;
    const a = p.a + (e ? amount(e.s) : 0);
    const b = p.b + (e ? amount(e.f) : 0);
    return { arm, a, b, mean: a / (a + b) };
  });
}

// index of the highest posterior mean; ties go to the earlier item in expert order
export function greedyIndex(post) {
  let best = 0;
  for (let i = 1; i < post.length; i++) if (post[i].mean > post[best].mean + 1e-12) best = i;
  return best;
}

export function rewardFromRating(rating) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null; // missing, never 0
  return rating >= 4 ? 1 : 0;
}

// One learning update for one context: discount every arm's data counts, then add the outcome
// to the arm that was used. Returns a new object; a missing reward changes nothing.
export function updateEvidence(evidence, used, reward, gamma = GAMMA) {
  if ((reward !== 0 && reward !== 1) || typeof used !== 'string' || !used) return evidence || {};
  const out = {};
  for (const k of Object.keys(evidence || {})) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    const s = amount(evidence[k] && evidence[k].s) * gamma;
    const f = amount(evidence[k] && evidence[k].f) * gamma;
    if (s + f > 1e-9) out[k] = { s, f };
  }
  const cur = own(out, used) ? out[used] : { s: 0, f: 0 };
  out[used] = { s: cur.s + reward, f: cur.f + (1 - reward) };
  return out;
}

export function evidenceTotal(evidence) {
  let n = 0;
  for (const k of Object.keys(evidence || {})) n += amount(evidence[k].s) + amount(evidence[k].f);
  return n;
}

// ---------- gate and decision ----------
// The first reason that applies, in the spec's order, or null. 'opt-out' logs nothing.
export function gateReason({ optedIn = false, risk = false, mood = null, surface, context } = {}) {
  if (!optedIn) return 'opt-out';
  if (risk) return 'risk';
  if (isLowMood(mood)) return 'low-mood';
  if (surface === 'lens' && context === 'loss') return 'loss';
  return null;
}

// a mood of 1 or 2 (of 7); no rating at all is not a low mood
export const isLowMood = (mood) => Number.isFinite(mood) && mood <= 2;

// q_TS by Monte Carlo: how often each arm has the largest of one draw per arm
export function thompsonProbs(post, rng, draws = MC_DRAWS) {
  const k = post.length;
  const wins = new Array(k).fill(0);
  for (let d = 0; d < draws; d++) {
    let best = 0;
    let bestV = -1;
    for (let i = 0; i < k; i++) {
      const v = sampleBeta(rng, post[i].a, post[i].b);
      if (v > bestV) {
        bestV = v;
        best = i;
      }
    }
    wins[best]++;
  }
  return wins.map((w) => w / draws);
}

// eligible: arm ids, already safety-filtered, in expert order. gated: null or the reason.
// Returns null when there is nothing to choose from.
export function decide({ eligible, evidence = {}, gated = null, seed = 1, eps = EPS, kappa = KAPPA, draws = MC_DRAWS }) {
  const E = [...new Set((eligible || []).filter((a) => typeof a === 'string' && a))];
  const k = E.length;
  if (!k) return null;
  const post = posteriors(E, evidence);
  const greedy = E[greedyIndex(post)];
  const base = { eligible: E, greedy, eps, kappa, gamma: GAMMA, n0: N0, propMethod: 'mc', mcDraws: draws, seed: seed >>> 0 };
  if (gated) {
    // the expert's first item, with certainty; no random number is drawn
    return { ...base, probs: E.map((_, i) => (i === 0 ? 1 : 0)), action: E[0], propensity: 1, gated, mcDraws: 0 };
  }
  const rng = mulberry32(seed);
  const q = thompsonProbs(post, rng, draws);
  const g = E.indexOf(greedy);
  const raw = q.map((qi, i) => (i === g ? 1 - eps : 0) + eps * ((1 - kappa) * qi + kappa / k));
  const total = raw.reduce((a, b) => a + b, 0);
  const probs = raw.map((p) => p / total);
  // one uniform number, inverse CDF over the eligible arms in expert order
  const u = rng();
  let acc = 0;
  let pick = k - 1;
  for (let i = 0; i < k; i++) {
    acc += probs[i];
    if (u < acc) {
      pick = i;
      break;
    }
  }
  return { ...base, probs, action: E[pick], propensity: probs[pick], gated: null };
}

// the latest mood rating that still counts (same rule as the low-mood note: real entries, 36 hours)
export function recentMood(entries, now = Date.now()) {
  const list = Array.isArray(entries) ? entries : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (e && !e.demo && Number.isFinite(e.mood)) return now - e.createdAt < RECENT_MS ? e.mood : null;
  }
  return null;
}

// ---------- records (spec section 8) ----------
export function makeRecord({ surface, context, decision, now = Date.now(), id }) {
  const d = decision;
  return {
    v: SCHEMA,
    id: id || `${now.toString(36)}-${d.seed.toString(36)}`,
    t: new Date(now).toISOString(),
    surface,
    context: String(context ?? 'none'),
    eligible: d.eligible.slice(),
    probs: d.probs.slice(),
    greedy: d.greedy,
    action: d.action,
    propensity: d.propensity,
    gated: d.gated,
    eps: d.eps,
    kappa: d.kappa,
    gamma: d.gamma,
    n0: d.n0,
    propMethod: d.propMethod,
    mcDraws: d.mcDraws,
    policy: POLICY_VERSION,
    seed: d.seed,
    used: null, // the item the person actually opened, which may differ from the featured one
    rating: null, // 1 to 5 where the surface has that scale
    reward: null, // 1, 0, or null for missing; never turned into 0
    ratedAt: null,
    learned: false, // whether this session updated the learner
  };
}

const armId = (v) => (typeof v === 'string' && v && v.length <= 40 && /^[a-z0-9-]+$/i.test(v) ? v : null);
const prob = (v) => (Number.isFinite(v) && v >= 0 && v <= 1 ? v : null);
const isoTime = (v) => (typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : null);

// Cleans one decision record read from a backup; null when it cannot be used.
export function cleanDecision(r) {
  if (r === null || typeof r !== 'object' || Array.isArray(r)) return null;
  const t = isoTime(r.t);
  if (typeof r.id !== 'string' || !r.id || !t || !SURFACES.includes(r.surface)) return null;
  const eligible = Array.isArray(r.eligible) ? r.eligible.slice(0, 40).map(armId) : [];
  if (!eligible.length || eligible.includes(null) || new Set(eligible).size !== eligible.length) return null;
  const action = armId(r.action);
  const propensity = prob(r.propensity);
  if (!action || !eligible.includes(action) || propensity === null || propensity <= 0) return null;
  if (!Array.isArray(r.probs) || r.probs.length !== eligible.length || r.probs.some((p) => prob(p) === null)) return null;
  if (Math.abs(r.probs.reduce((a, b) => a + b, 0) - 1) > 1e-6 || Math.abs(r.probs[eligible.indexOf(action)] - propensity) > 1e-9) return null;
  const gated = GATES.includes(r.gated) ? r.gated : null;
  if (gated && (action !== eligible[0] || propensity !== 1)) return null;
  const used = armId(r.used);
  const reward = r.reward === 0 || r.reward === 1 ? r.reward : null;
  const rating = Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5 ? r.rating : null;
  if (rating !== null && reward !== rewardFromRating(rating)) return null;
  return {
    v: SCHEMA,
    id: r.id.slice(0, 80),
    t,
    surface: r.surface,
    context: typeof r.context === 'string' && /^[a-z0-9-]{1,30}$/i.test(r.context) ? r.context : 'none',
    eligible,
    probs: r.probs.slice(),
    greedy: eligible.includes(r.greedy) ? r.greedy : eligible[0],
    action,
    propensity,
    gated,
    eps: prob(r.eps) ?? EPS,
    kappa: prob(r.kappa) ?? KAPPA,
    gamma: prob(r.gamma) ?? GAMMA,
    n0: Number.isFinite(r.n0) && r.n0 >= 2 && r.n0 <= 4 ? r.n0 : N0,
    propMethod: r.propMethod === 'quad' ? 'quad' : 'mc',
    mcDraws: Number.isInteger(r.mcDraws) && r.mcDraws >= 0 && r.mcDraws <= 1e6 ? r.mcDraws : 0,
    policy: typeof r.policy === 'string' ? r.policy.slice(0, 20) : '',
    seed: Number.isInteger(r.seed) && r.seed >= 0 ? r.seed : 0,
    used,
    rating,
    reward,
    ratedAt: reward === null ? null : isoTime(r.ratedAt),
    learned: r.learned === true && reward !== null && !gated,
  };
}

// state: { v, ev: { 'surface|context': { armId: { s, f } } } }
export function cleanState(raw) {
  const out = { v: POLICY_VERSION, ev: {} };
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw) || raw.ev === null || typeof raw.ev !== 'object' || Array.isArray(raw.ev)) return out;
  for (const key of Object.keys(raw.ev).slice(0, 200)) {
    if (!/^(lens|track|small)\|[a-z0-9-]{1,30}$/i.test(key)) continue;
    const src = raw.ev[key];
    if (src === null || typeof src !== 'object' || Array.isArray(src)) continue;
    const ev = {};
    for (const arm of Object.keys(src).slice(0, 60)) {
      if (!armId(arm) || src[arm] === null || typeof src[arm] !== 'object') continue;
      const s = amount(src[arm].s);
      const f = amount(src[arm].f);
      if (s + f > 0) ev[arm] = { s, f };
    }
    // a hand-edited file cannot claim more evidence than discounting allows
    const total = evidenceTotal(ev);
    if (total > ESS_CAP) for (const arm of Object.keys(ev)) ev[arm] = { s: (ev[arm].s * ESS_CAP) / total, f: (ev[arm].f * ESS_CAP) / total };
    if (Object.keys(ev).length) out.ev[key] = ev;
  }
  return out;
}

export const contextKey = (surface, context) => `${surface}|${String(context ?? 'none')}`;

// ---------- CSV for off-policy evaluation ----------
function csvCell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(s)) s = "'" + s; // not a spreadsheet formula
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_COLUMNS = ['v', 'id', 't', 'surface', 'context', 'k', 'eligible', 'probs', 'greedy', 'action', 'propensity', 'gated', 'eps', 'kappa', 'gamma', 'n0', 'propMethod', 'mcDraws', 'policy', 'seed', 'used', 'rating', 'reward', 'ratedAt', 'learned'];

// one row per decision; eligible and probs are joined with "|" in the same (expert) order
export function decisionsCsv(log) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of log || []) {
    const row = { ...r, k: r.eligible.length, eligible: r.eligible.join('|'), probs: r.probs.join('|'), gated: r.gated || '', learned: r.learned ? 1 : 0 };
    lines.push(CSV_COLUMNS.map((c) => csvCell(row[c])).join(','));
  }
  return lines.join('\n');
}

// ---------- storage (settings keys policyOptIn, policyState, policyLog, policyRiskAt) ----------
// db needs getSetting(key, fallback) and setSetting(key, value). Writes are queued so two
// screens cannot overwrite each other's records. Everything stays on this device.
let queue = Promise.resolve();
const queued = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

export function createPolicyStore(db) {
  const getState = async () => cleanState(await db.getSetting('policyState', null).catch(() => null));
  const getLog = async () => {
    const raw = await db.getSetting('policyLog', []).catch(() => []);
    return Array.isArray(raw) ? raw : [];
  };
  return {
    // undefined: never asked; true or false: the person's answer. Off unless they said yes.
    optIn: () => db.getSetting('policyOptIn', undefined).catch(() => undefined),
    setOptIn: (v) => queued(() => db.setSetting('policyOptIn', v === true)),
    getState,
    getLog,
    // data counts of one context, for decide()
    evidence: async (surface, context) => (await getState()).ev[contextKey(surface, context)] || {},
    // Risk language was seen somewhere in the app: only the time is kept, for the 36-hour gate.
    noteRisk: (now = Date.now()) => queued(() => db.setSetting('policyRiskAt', now)).catch(() => {}),
    recentRisk: async (now = Date.now()) => {
      const at = await db.getSetting('policyRiskAt', 0).catch(() => 0);
      return Number.isFinite(at) && at > 0 && now - at < RECENT_MS && at <= now + 60000;
    },
    log: (record) =>
      queued(async () => {
        const log = await getLog();
        if (log.some((r) => r.id === record.id)) return; // the same decision is logged once
        log.push(record);
        await db.setSetting('policyLog', log.slice(-MAX_LOG));
      }),
    // which item the person actually opened
    setUsed: (id, used) =>
      queued(async () => {
        const log = await getLog();
        const r = log.find((x) => x.id === id);
        if (!r || r.reward !== null) return;
        r.used = used;
        await db.setSetting('policyLog', log);
      }),
    // Records the session's outcome once. The learner is updated (for the item that was used)
    // only when the decision was not gated and `allowLearning` is still true, that is, no risk
    // language or low mood turned up after the decision.
    rate: (id, { rating = null, reward = rewardFromRating(rating), allowLearning = true, now = Date.now() } = {}) =>
      queued(async () => {
        if (reward !== 0 && reward !== 1) return false; // missing stays missing
        const log = await getLog();
        const r = log.find((x) => x.id === id);
        if (!r || r.reward !== null || !r.used) return false;
        r.rating = Number.isInteger(rating) ? rating : null;
        r.reward = reward;
        r.ratedAt = new Date(now).toISOString();
        r.learned = allowLearning && !r.gated;
        if (r.learned) {
          const state = await getState();
          const key = contextKey(r.surface, r.context);
          state.ev[key] = updateEvidence(state.ev[key] || {}, r.used, reward);
          await db.setSetting('policyState', state);
        }
        await db.setSetting('policyLog', log);
        return r.learned;
      }),
    // "reset what it learned": the data counts and the decision log both go; the choice to
    // have it on or off stays
    reset: () =>
      queued(async () => {
        await db.setSetting('policyState', { v: POLICY_VERSION, ev: {} });
        await db.setSetting('policyLog', []);
      }),
    // for the JSON backup, and back again (records are cleaned; ones already here are kept)
    exportForBackup: async () => ({ policyLog: (await getLog()).map(cleanDecision).filter(Boolean), policyState: await getState() }),
    importFromBackup: (data) =>
      queued(async () => {
        if (data === null || typeof data !== 'object') return 0;
        const log = await getLog();
        const have = new Set(log.map((r) => r.id));
        let added = 0;
        for (const raw of Array.isArray(data.policyLog) ? data.policyLog.slice(-MAX_LOG) : []) {
          const r = cleanDecision(raw);
          if (!r || have.has(r.id)) continue;
          have.add(r.id);
          log.push(r);
          added++;
        }
        if (added) await db.setSetting('policyLog', log.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0)).slice(-MAX_LOG));
        // discounted counts from two devices cannot be merged meaningfully; a device that has
        // learned nothing takes the backup's, otherwise it keeps its own
        const mine = await getState();
        if (!Object.keys(mine.ev).length && data.policyState) {
          const theirs = cleanState(data.policyState);
          if (Object.keys(theirs.ev).length) await db.setSetting('policyState', theirs);
        }
        return added;
      }),
  };
}

// ---------- words shown to the person (zh-TW and en) ----------
export const POLICY_TEXT = {
  'zh-TW': {
    featured: '依你的評分，先給你看這個',
    trackTag: '依你的評分推薦',
    why: '為什麼推薦這個',
    whyBody: '這一項是依你自己在這個裝置上給過的評分挑的；有時也會刻意換一個讓你試試，這樣才知道其他的適不適合你。其餘的順序沒有變，還是照這類煩惱常用的做法排列。評分和紀錄都不會離開這個裝置。',
    whyBodyLocked: '這一項是這類煩惱最常用的做法，和原本的順序一樣。你最近的心情偏低、寫的內容比較沉重，或這是一件失落的事的時候，這裡不做任何嘗試，也不會拿這次的評分來調整推薦。',
    optInLine: '要不要讓這裡依你自己的評分，多推薦一個？只在這個裝置上計算，隨時可以關掉。',
    optInYes: '好，開啟',
    optInNo: '不用',
    panelTitle: '依我的評分推薦（預設關閉）',
    toggle: '依我的評分學習',
    panelBody: '開啟後，選角度的清單、睡前建議的那一段、心情低落時的第一件小事，會各多推薦一項。它只看你自己的評分，不看使用時間或次數。這是實驗功能，不保證推薦得比原本的順序好。',
    reset: '清除學到的內容',
    resetConfirm: '確定清除嗎？學到的內容和決策紀錄都會刪除，推薦會回到原本的順序。',
    resetDone: '已清除',
    exportCsv: '匯出決策紀錄（CSV）',
    exportEmpty: '還沒有決策紀錄。',
    logCount: (n) => `目前有 ${n} 筆決策紀錄，只存在這個裝置上。`,
    trackQ: '這段有幫助嗎？',
    trackYes: '有',
    trackNo: '還好',
    smallYes: '試過了，有幫助',
    smallNo: '試過了，沒有',
    thanks: '記下了，謝謝。',
  },
  en: {
    featured: 'From your ratings, try this one first',
    trackTag: 'Suggested from your ratings',
    why: 'Why this one?',
    whyBody: 'This one was picked from the ratings you gave on this device. Now and then it shows a different one on purpose, to find out whether others suit you too. The rest of the order has not changed: it still follows the approaches often used for this kind of worry. Your ratings and this record never leave this device.',
    whyBodyLocked: 'This is the approach most often used for this kind of worry, the same as the usual order. When your latest mood was low, when what you wrote was heavy, or when the worry is a loss, nothing is tried out here and this time is not used to adjust suggestions.',
    optInLine: 'Would you like one extra suggestion here, based on your own ratings? It is worked out on this device only, and you can turn it off at any time.',
    optInYes: 'Yes, turn it on',
    optInNo: 'No thanks',
    panelTitle: 'Suggestions from my ratings (off by default)',
    toggle: 'Learn from my ratings',
    panelBody: 'When this is on, the lens list, the suggested bedtime track, and the first small action on the low-mood note each feature one item. It uses only your own ratings, never time spent or how often you open the app. This is experimental and is not guaranteed to do better than the usual order.',
    reset: 'Reset what it learned',
    resetConfirm: 'Reset? What it learned and the decision log are both deleted, and suggestions go back to the usual order.',
    resetDone: 'Reset',
    exportCsv: 'Export decision log (CSV)',
    exportEmpty: 'No decisions logged yet.',
    logCount: (n) => `${n} decision${n === 1 ? '' : 's'} logged, on this device only.`,
    trackQ: 'Did this track help?',
    trackYes: 'Yes',
    trackNo: 'Not really',
    smallYes: 'Tried it, it helped',
    smallNo: 'Tried it, it did not',
    thanks: 'Noted, thank you.',
  },
};

export const policyText = (lang) => POLICY_TEXT[lang] || POLICY_TEXT.en;

// a fresh seed for one decision; crypto when there is one, so seeds are not guessable from time
export function newSeed() {
  try {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0];
  } catch (_) {
    return hashSeed(`${Date.now()}-${Math.random()}`);
  }
}
