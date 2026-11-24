import { t, setLang, getLang, detectLang, STRINGS } from './i18n.js';
import { Recorder, decodeToMono16k, isSupported, TARGET_SR } from './recorder.js';
import { FEATURE_INFO, FEATURE_VERSION, median } from './features.js';
import { personalBaseline, baselineK, spearman, fmtR, mad, distinctCount } from './stats.js';
import { glyph, ringPath, lineChart } from './viz.js';
import * as db from './db.js';
import { createLensView } from './lens-view.js';
import { createNightView, isEvening } from './night-view.js';
import { createExtras } from './extras.js';
import { checkRisk } from './safety.js';
import { MODELS as AI_MODELS } from './ai-chat.js';
import { DAILY, promptOfDay } from './prompts.js';

const MIN_SECONDS = 5;
const MAX_SECONDS = 90;
const BASELINE_MIN = 10;
const LINKS_MIN = 20;
const MIN_DISTINCT = 5; // distinct feature values needed for a correlation
const MIN_DISTINCT_RATINGS = 3;
const RING_SIZE = 260;

const state = {
  tab: 'today',
  phase: 'idle',
  promptIndex: 0,
  recorder: null,
  maxTimer: null,
  levels: new Array(72).fill(0),
  pending: null, // { features, blob, mood, energy, note, capture }
  error: '',
  entries: [],
  keepAudio: true,
  metric: 'f0MedianHz',
  detailId: null,
  detailOpener: null,
  detailUrl: null,
  sheetFn: null,
  journalMode: 'voice',
  askIndex: null,
};

const $ = (sel, root = document) => root.querySelector(sel);

function h(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    n.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}

// Element.append prints null as text; skip empty children instead.
function add(parent, ...kids) {
  parent.append(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
  return parent;
}

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function fmtFeature(key, v) {
  const info = FEATURE_INFO.find((f) => f.key === key);
  if (!Number.isFinite(v) || !info) return '–';
  const val = v * (info.scale || 1);
  const unit = (t('units') || {})[info.unit] ?? info.unit;
  return `${val.toFixed(info.digits)} ${unit}`.replace(' %', '%');
}

function fmtDate(ts, opts) {
  return new Intl.DateTimeFormat(getLang(), opts).format(new Date(ts));
}

function toast(msg) {
  const tEl = $('#toast');
  tEl.textContent = msg;
  tEl.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => tEl.classList.remove('show'), 2800);
}

// ---------- which entries are compared with which ----------
// Demo entries are used only while there are no real ones. Entries from an older
// feature version, or with recording-quality problems, are not pooled.
function usable(e) {
  return e.features && e.features.ok && e.featureVersion === FEATURE_VERSION;
}
function hasReal() {
  return state.entries.some((e) => !e.demo && usable(e));
}
function pool({ before } = {}) {
  const real = hasReal();
  return state.entries.filter(
    (e) =>
      usable(e) &&
      (real ? !e.demo : true) &&
      !(e.features.quality && e.features.quality.flags && e.features.quality.flags.length) &&
      (before === undefined || e.createdAt < before)
  );
}

// ---------- analysis ----------
let worker = null;
function getWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  } catch (_) {
    worker = false;
  }
  return worker;
}

async function runAnalysis(samples) {
  const w = getWorker();
  if (w) {
    try {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 20000);
        w.onmessage = (ev) => {
          clearTimeout(timer);
          ev.data.ok ? resolve(ev.data.features) : reject(new Error(ev.data.error));
        };
        w.onerror = (e) => {
          clearTimeout(timer);
          reject(e);
        };
        w.postMessage({ samples, sampleRate: TARGET_SR });
      });
    } catch (_) {
      worker = false; // fall back to the main thread below
    }
  }
  const { analyze } = await import('./features.js');
  await new Promise((r) => setTimeout(r, 30));
  return analyze(samples, TARGET_SR);
}

// ---------- recording flow ----------
async function startRecording() {
  if (state.phase === 'recording' || state.phase === 'analyzing' || startRecording.busy) return;
  if (!isSupported()) {
    state.phase = 'error';
    state.error = t('micUnsupported');
    return render();
  }
  startRecording.busy = true;
  state.recorder = new Recorder();
  try {
    await state.recorder.start();
  } catch (err) {
    startRecording.busy = false;
    state.recorder.cleanup();
    state.recorder = null;
    state.phase = 'error';
    const name = err && err.name;
    state.error =
      name === 'NotAllowedError' || name === 'SecurityError'
        ? t('micDenied')
        : name === 'NotFoundError' || name === 'OverconstrainedError'
        ? t('micMissing')
        : name === 'NotReadableError'
        ? t('micBusy')
        : t('micFailed') + (err && err.message ? ` (${err.message})` : '');
    return render();
  }
  startRecording.busy = false;
  // the person may have left this screen while the permission prompt was open
  if (state.tab !== 'today' || (state.phase !== 'idle' && state.phase !== 'error')) {
    state.recorder.cancel();
    state.recorder = null;
    return;
  }
  state.levels.fill(0);
  state.phase = 'recording';
  // The time limit runs on a timer, not on animation frames, which pause in background tabs.
  state.maxTimer = setTimeout(() => stopRecording(true), MAX_SECONDS * 1000);
  render();
  tick();
}

function tick() {
  if (state.phase !== 'recording' || !state.recorder) return;
  const lvl = state.recorder.level();
  state.levels.push(lvl);
  state.levels.shift();
  const ring = $('#ring-path');
  if (ring) ring.setAttribute('d', ringPath(state.levels, RING_SIZE));
  const secs = state.recorder.elapsed();
  const timer = $('#timer');
  if (timer) timer.textContent = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
  const hint = $('#rec-hint');
  if (hint) hint.textContent = secs < MIN_SECONDS ? t('tooShortHint') : t('tapToStop');
  requestAnimationFrame(tick);
}

async function stopRecording(force = false) {
  if (state.phase !== 'recording' || !state.recorder) return;
  const secs = state.recorder.elapsed();
  if (!force && secs < MIN_SECONDS) {
    toast(t('tooShortHint'));
    return;
  }
  clearTimeout(state.maxTimer);
  const rec = state.recorder;
  state.recorder = null;
  state.phase = 'analyzing';
  render();
  const capture = rec.settings;
  const blob = await rec.stop();
  try {
    if (!blob) throw new Error('empty');
    const samples = await decodeToMono16k(blob);
    if (samples.length < MIN_SECONDS * TARGET_SR * 0.9) throw new Error('short');
    const features = await runAnalysis(samples);
    if (!features.ok) {
      state.phase = 'error';
      state.error = features.reason === 'too_short' ? t('tooShort') : t('noSpeech');
    } else {
      state.pending = { features, blob, mood: null, energy: null, note: '', capture };
      state.phase = 'result';
    }
  } catch (err) {
    state.phase = 'error';
    state.error = err.message === 'short' ? t('tooShort') : t('analysisFailed') + (err.message || err);
  }
  render();
}

function cancelRecording() {
  clearTimeout(state.maxTimer);
  if (state.recorder) state.recorder.cancel();
  state.recorder = null;
  state.phase = 'idle';
  render();
}

async function savePending() {
  if (state.phase !== 'result' || !state.pending || savePending.busy) return;
  savePending.busy = true;
  const p = state.pending;
  const prompts = DAILY[getLang()] || DAILY.en;
  // a note that suggests risk is kept (it is the person's own journal), and help is shown
  const noteRisk = checkRisk(p.note).risk;
  const entry = {
    id: uid(),
    createdAt: Date.now(),
    prompt: prompts[(state.askIndex ?? state.promptIndex) % prompts.length],
    lang: getLang(),
    mood: p.mood,
    energy: p.energy,
    note: p.note.trim(),
    features: p.features,
    featureVersion: FEATURE_VERSION,
    capture: p.capture || null,
    hasAudio: state.keepAudio,
  };
  let message = t('saved');
  try {
    try {
      await db.saveEntry(entry, state.keepAudio ? p.blob : null);
    } catch (err) {
      if (!state.keepAudio) throw err;
      // most often storage is full: keep the measurements without the audio
      entry.hasAudio = false;
      await db.saveEntry(entry, null);
      message = t('savedWithoutAudio');
    }
  } catch (_) {
    savePending.busy = false;
    toast(t('saveFailed'));
    return;
  }
  savePending.busy = false;
  state.askIndex = null;
  state.entries.push(entry);
  db.requestPersistence();
  state.pending = null;
  state.phase = 'idle';
  state.promptIndex = (state.promptIndex + 1) % prompts.length;
  toast(message);
  render();
  if (noteRisk) extras.showHelp();
}

// ---------- demo data ----------
async function loadDemo() {
  try {
    const res = await fetch('./demo/demo-data.json');
    const data = await res.json();
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const entries = data.entries.map((e) => ({
      ...e,
      createdAt: midnight.getTime() - e.dayOffset * 86400000 + Math.round(e.hour * 3600000),
      demo: true,
      hasAudio: false,
    }));
    await db.importEntries(entries);
    state.entries = await db.listEntries();
    if (location.hash !== '#trends') location.hash = '#trends';
    else render();
  } catch (_) {
    toast(t('demoFailed'));
  }
}

async function clearDemo() {
  for (const e of state.entries.filter((x) => x.demo)) await db.deleteEntry(e.id);
  state.entries = await db.listEntries();
  toast(t('demoCleared'));
  render();
}

function demoBanner() {
  if (!state.entries.some((e) => e.demo)) return null;
  return h(
    'div',
    { class: 'demo-banner', role: 'note' },
    h('span', {}, t(hasReal() ? 'demoBannerMixed' : 'demoBanner')),
    h('button', { type: 'button', class: 'link', onclick: clearDemo }, t('clearDemo'))
  );
}

// ---------- views ----------
function scale7(name, value, lowLabel, highLabel, onPick) {
  const group = h('div', { class: 'scale', role: 'radiogroup', 'aria-label': t(name) });
  for (let i = 1; i <= 7; i++) {
    const checked = value === i;
    group.appendChild(
      h('button', {
        type: 'button',
        role: 'radio',
        'aria-checked': checked ? 'true' : 'false',
        'aria-label': `${t(name)} ${i}/7`,
        tabindex: checked || (value === null && i === 4) ? '0' : '-1',
        'data-key': `${name}-${i}`,
        class: 'scale-dot' + (checked ? ' on' : ''),
        onclick: () => onPick(i, false),
        onkeydown: (e) => {
          const next = { ArrowRight: i + 1, ArrowUp: i + 1, ArrowLeft: i - 1, ArrowDown: i - 1, Home: 1, End: 7 }[e.key];
          if (next >= 1 && next <= 7) {
            e.preventDefault();
            onPick(next, true);
            focusKey(`${name}-${next}`);
          }
        },
      })
    );
  }
  return h(
    'div',
    { class: 'scale-row' },
    h('div', { class: 'scale-name', 'aria-hidden': 'true' }, t(name)),
    group,
    h('div', { class: 'scale-ends', 'aria-hidden': 'true' }, h('span', {}, lowLabel), h('span', {}, highLabel))
  );
}

function focusKey(key) {
  const n = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
  if (n) n.focus();
}

function baselineFor(key, value, before) {
  const hist = pool({ before }).map((e) => e.features[key]);
  return personalBaseline(hist, value, BASELINE_MIN);
}

function featureRow(key, features, before) {
  const b = baselineFor(key, features[key], before);
  return h(
    'div',
    { class: 'row' },
    h('div', { class: 'row-name' }, t('feat')[key][0]),
    h('div', { class: 'row-val' }, fmtFeature(key, features[key])),
    b ? h('div', { class: `row-band band-${b.band}` }, t(b.band)) : null
  );
}

function qualityNote(features) {
  const flags = (features.quality && features.quality.flags) || [];
  if (!flags.length) return null;
  return h('p', { class: 'quality-note', role: 'note' }, flags.map((f) => t('quality_' + f)).join(' '), ' ', t('qualityExcluded'));
}

function latestMood() {
  for (let i = state.entries.length - 1; i >= 0; i--) {
    const e = state.entries[i];
    if (!e.demo && Number.isFinite(e.mood)) return Date.now() - e.createdAt < 36 * 3600 * 1000 ? e.mood : null;
  }
  return null;
}

function latestRated() {
  for (let i = state.entries.length - 1; i >= 0; i--) if (!state.entries[i].demo && Number.isFinite(state.entries[i].mood)) return state.entries[i];
  return null;
}

function viewToday() {
  if (nightView.active()) return nightView.view();
  const prompts = DAILY[getLang()] || DAILY.en;
  const promptIdx = (state.askIndex ?? state.promptIndex) % prompts.length;
  const prompt = prompts[promptIdx];
  const wrap = h('section', { class: 'view today' });

  if (state.phase === 'result' && state.pending) {
    const p = state.pending;
    const f = p.features;
    const n = pool().length;
    const pick = (field) => (v, fromKey) => {
      p[field] = !fromKey && p[field] === v ? null : v;
      render();
    };
    add(wrap, 
      h('div', { class: 'result-head' }, glyph(f, 200, { width: 168, label: t('shapeLabel') }), h('h2', {}, t('yourVoiceToday'))),
      qualityNote(f),
      h('div', { class: 'rows' }, ['f0MedianHz', 'f0SdSt', 'speechRate', 'pauseRatio', 'periodicityDb'].map((k) => featureRow(k, f))),
      n < BASELINE_MIN ? h('p', { class: 'muted small' }, t('needMoreForBaseline', BASELINE_MIN - n)) : null,
      h(
        'div',
        { class: 'checkin' },
        h('h3', {}, t('checkIn')),
        h('p', { class: 'muted small' }, t('checkInOptional')),
        scale7('mood', p.mood, t('moodLow'), t('moodHigh'), pick('mood')),
        scale7('energy', p.energy, t('energyLow'), t('energyHigh'), pick('energy')),
        h('label', { class: 'note-label', for: 'note' }, t('note')),
        h('input', {
          id: 'note',
          type: 'text',
          maxlength: '140',
          value: p.note,
          'data-key': 'note',
          oninput: (e) => (p.note = e.target.value),
        })
      ),
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn primary', type: 'button', 'data-key': 'save', onclick: savePending }, t('save')),
        h(
          'button',
          {
            class: 'btn ghost',
            type: 'button',
            onclick: () => {
              state.pending = null;
              state.phase = 'idle';
              render();
            },
          },
          t('discard')
        )
      )
    );
    return wrap;
  }

  const idle = state.phase === 'idle' || state.phase === 'error';
  if (idle) add(wrap, extras.lowMoodCard(latestRated()));
  if (idle && isEvening()) add(wrap, nightView.card());
  add(wrap, 
    h(
      'div',
      { class: 'prompt' },
      h('div', { class: 'prompt-label' }, t('promptLabel')),
      h('p', { class: 'prompt-text' }, prompt),
      state.phase === 'idle' || state.phase === 'error'
        ? h(
            'button',
            {
              type: 'button',
              class: 'link',
              'data-key': 'new-prompt',
              onclick: () => {
                state.askIndex = null;
                state.promptIndex = (state.promptIndex + 1) % prompts.length;
                render();
              },
            },
            t('newPrompt')
          )
        : null,
      state.phase === 'idle' || state.phase === 'error' ? extras.exchangeBox(prompt, promptIdx, state.askIndex !== null) : null
    )
  );

  const recording = state.phase === 'recording';
  const analyzing = state.phase === 'analyzing';
  const stage = h('div', { class: 'stage' + (recording ? ' is-recording' : '') + (analyzing ? ' is-analyzing' : '') });
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${RING_SIZE} ${RING_SIZE}`);
  svg.setAttribute('class', 'ring');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('id', 'ring-path');
  path.setAttribute('d', ringPath(state.levels.map(() => 0), RING_SIZE));
  svg.appendChild(path);
  stage.appendChild(svg);
  stage.appendChild(
    h(
      'button',
      {
        type: 'button',
        class: 'rec-btn',
        'data-key': 'rec',
        disabled: analyzing,
        'aria-label': recording ? t('tapToStop') : t('tapToRecord'),
        onclick: () => (recording ? stopRecording() : startRecording()),
      },
      h('span', { class: 'rec-icon' })
    )
  );
  wrap.appendChild(stage);

  if (recording) {
    add(wrap, 
      h('div', { class: 'timer', id: 'timer', 'aria-live': 'off' }, '0:00'),
      h('p', { class: 'hint', id: 'rec-hint' }, t('tooShortHint')),
      h('button', { type: 'button', class: 'link center', onclick: cancelRecording }, t('discard'))
    );
  } else if (analyzing) {
    add(wrap, h('p', { class: 'hint', role: 'status' }, t('analyzing')));
  } else {
    if (state.phase === 'error') add(wrap, h('p', { class: 'error', role: 'alert' }, state.error));
    add(wrap, h('p', { class: 'hint' }, t('tapToRecord')));
    if (!state.entries.length) {
      add(wrap, h('button', { type: 'button', class: 'link center', onclick: loadDemo }, t('loadDemoShort')));
    }
    if (!isEvening()) add(wrap, h('button', { type: 'button', class: 'link center night-link', 'data-key': 'night-link', onclick: () => nightView.begin() }, t('bedtimeLink')));
    const recent = state.entries.filter(usable).slice(-7);
    if (recent.length) {
      add(wrap, 
        h(
          'div',
          { class: 'recent', role: 'list', 'aria-label': t('recentLabel') },
          recent.map((e) =>
            h(
              'button',
              {
                type: 'button',
                role: 'listitem',
                class: 'recent-item',
                'data-key': `recent-${e.id}`,
                'aria-label': fmtDate(e.createdAt, { dateStyle: 'medium', timeStyle: 'short' }),
                onclick: (ev) => openDetail(e.id, ev.currentTarget),
              },
              glyph(e.features, 60, { width: 40 })
            )
          )
        )
      );
    }
  }
  return wrap;
}

function viewJournal() {
  const wrap = h('section', { class: 'view journal' });
  add(wrap, extras.modeChips(state.journalMode, (m) => {
    state.journalMode = m;
    render();
  }));
  if (state.journalMode === 'nights') return add(wrap, extras.nightsSection());
  if (state.journalMode === 'jar') return add(wrap, extras.jarSection());
  const entries = state.entries.filter((e) => e.features && e.features.ok);
  if (!entries.length) {
    add(wrap, h('p', { class: 'empty' }, t('journalEmpty')), h('button', { type: 'button', class: 'btn', onclick: loadDemo }, t('loadDemo')));
    return wrap;
  }
  add(wrap, demoBanner(), h('p', { class: 'muted' }, t('entries', entries.length)));
  const byMonth = new Map();
  for (const e of [...entries].reverse()) {
    const k = fmtDate(e.createdAt, { year: 'numeric', month: 'long' });
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(e);
  }
  for (const [month, list] of byMonth) {
    add(wrap, 
      h('h2', { class: 'month' }, month),
      h(
        'div',
        { class: 'grid' },
        list.map((e) =>
          h(
            'button',
            {
              type: 'button',
              class: 'tile' + (e.demo ? ' is-demo' : ''),
              'data-key': `tile-${e.id}`,
              'aria-label': fmtDate(e.createdAt, { dateStyle: 'long', timeStyle: 'short' }),
              onclick: (ev) => openDetail(e.id, ev.currentTarget),
            },
            glyph(e.features, 120, { width: '100%' }),
            h('span', { class: 'tile-date', 'aria-hidden': 'true' }, fmtDate(e.createdAt, { month: 'numeric', day: 'numeric' })),
            h('span', { class: 'tile-time', 'aria-hidden': 'true' }, fmtDate(e.createdAt, { hour: 'numeric', minute: '2-digit' }))
          )
        )
      )
    );
  }
  return wrap;
}

function openSheet(fn) {
  state.sheetFn = fn;
  state.detailId = null;
  const a = document.activeElement;
  state.detailOpener = a && a.dataset ? a.dataset.key || null : null;
  if (location.hash !== '#entry') location.hash = '#entry';
  renderSheet();
}

function closeSheet() {
  if (location.hash === '#entry') history.back();
  else closeDetailUI();
}

function renderSheet() {
  const sheet = $('#sheet');
  if (!state.sheetFn) return;
  sheet.hidden = false;
  sheet.innerHTML = '';
  setBackgroundInert(true);
  const body = h('div', { class: 'sheet-body', role: 'dialog', 'aria-modal': 'true' }, h('button', { type: 'button', class: 'link back', onclick: closeSheet }, t('back')));
  add(body, state.sheetFn(renderSheet));
  sheet.appendChild(body);
  body.querySelector('.back').focus();
  sheet.onkeydown = null;
}

function openDetail(id, opener) {
  state.sheetFn = null;
  state.detailId = id;
  state.detailOpener = opener && opener.dataset ? opener.dataset.key || null : null;
  location.hash = '#entry';
  renderDetail();
}

function setBackgroundInert(on) {
  for (const sel of ['#main', '#tabs', '.brand']) {
    const n = $(sel);
    if (!n) continue;
    if (on) n.setAttribute('inert', '');
    else n.removeAttribute('inert');
  }
}

function closeDetailUI() {
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  state.sheetFn = null;
  sheet.hidden = true;
  sheet.innerHTML = '';
  setBackgroundInert(false);
  if (state.detailUrl) {
    URL.revokeObjectURL(state.detailUrl);
    state.detailUrl = null;
  }
  if (state.detailOpener) focusKey(state.detailOpener);
}

async function renderDetail() {
  const sheet = $('#sheet');
  const e = state.entries.find((x) => x.id === state.detailId);
  if (!e) {
    closeDetailUI();
    return;
  }
  sheet.hidden = false;
  sheet.innerHTML = '';
  setBackgroundInert(true);
  const close = () => {
    if (location.hash === '#entry') history.back();
    else closeDetailUI();
  };
  const f = e.features;
  const audioSlot = h('div', { class: 'audio-slot' });
  const title = fmtDate(e.createdAt, { month: 'long', day: 'numeric', weekday: 'short' });
  const body = h(
    'div',
    { class: 'sheet-body', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'detail-title' },
    h('button', { type: 'button', class: 'link back', onclick: close }, t('back')),
    h(
      'div',
      { class: 'detail-head' },
      glyph(f, 200, { width: 150, label: t('shapeLabel') }),
      h('div', {}, h('h2', { id: 'detail-title' }, title), h('p', { class: 'muted' }, fmtDate(e.createdAt, { year: 'numeric', hour: 'numeric', minute: '2-digit' })))
    ),
    e.demo ? h('p', { class: 'demo-banner' }, t('demoEntry')) : null,
    qualityNote(f),
    e.prompt ? h('p', { class: 'detail-prompt' }, e.prompt) : null,
    e.note ? h('blockquote', { class: 'detail-note' }, e.note) : null,
    e.mood || e.energy
      ? h('p', { class: 'muted' }, [e.mood ? `${t('mood')} ${e.mood}/7` : null, e.energy ? `${t('energy')} ${e.energy}/7` : null].filter(Boolean).join('　'))
      : null,
    audioSlot,
    h('div', { class: 'rows' }, FEATURE_INFO.map((info) => featureRow(info.key, f, e.createdAt))),
    h(
      'button',
      {
        type: 'button',
        class: 'btn danger',
        onclick: async () => {
          if (!confirm(t('confirmDelete'))) return;
          await db.deleteEntry(e.id);
          state.entries = state.entries.filter((x) => x.id !== e.id);
          state.detailOpener = null;
          close();
          render();
        },
      },
      t('deleteEntry')
    )
  );
  sheet.appendChild(body);
  body.querySelector('.back').focus();
  // keep keyboard focus inside the dialog
  sheet.onkeydown = (ev) => {
    if (ev.key !== 'Tab') return;
    const items = [...body.querySelectorAll('button, audio, a[href], input')].filter((n) => !n.disabled);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  };
  if (e.hasAudio) {
    const blob = await db.getAudio(e.id).catch(() => null);
    if (blob && !sheet.hidden && state.detailId === e.id) {
      state.detailUrl = URL.createObjectURL(blob);
      audioSlot.appendChild(h('audio', { controls: true, src: state.detailUrl, preload: 'metadata', 'aria-label': t('play') }));
      return;
    }
  }
  audioSlot.appendChild(h('p', { class: 'muted small' }, t('noAudio')));
}

function viewTrends() {
  const wrap = h('section', { class: 'view trends' });
  const entries = pool();
  const real = hasReal();
  const flagged = state.entries.filter((e) => usable(e) && (real ? !e.demo : true) && e.features.quality && e.features.quality.flags && e.features.quality.flags.length).length;
  const flaggedNote = flagged ? h('p', { class: 'muted small' }, t('flaggedLeftOut', flagged)) : null;
  if (entries.length < 3) {
    add(wrap, demoBanner(), h('p', { class: 'empty' }, t('trendsEmpty')), flaggedNote, state.entries.length ? null : h('button', { type: 'button', class: 'btn', onclick: loadDemo }, t('loadDemo')));
    return wrap;
  }
  add(wrap, demoBanner());
  const info = FEATURE_INFO.find((f) => f.key === state.metric) || FEATURE_INFO[0];
  const chips = h('div', { class: 'chips', role: 'tablist', 'aria-label': t('metricPicker') });
  FEATURE_INFO.forEach((f, idx) => {
    const on = f.key === info.key;
    chips.appendChild(
      h(
        'button',
        {
          type: 'button',
          role: 'tab',
          'aria-selected': on ? 'true' : 'false',
          tabindex: on ? '0' : '-1',
          'data-key': `chip-${f.key}`,
          class: 'chip' + (on ? ' on' : ''),
          onclick: () => {
            state.metric = f.key;
            render();
          },
          onkeydown: (e) => {
            const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
            if (!d) return;
            e.preventDefault();
            const nextKey = FEATURE_INFO[(idx + d + FEATURE_INFO.length) % FEATURE_INFO.length].key;
            state.metric = nextKey;
            render();
            focusKey(`chip-${nextKey}`);
          },
        },
        t('feat')[f.key][0]
      )
    );
  });
  add(wrap, chips);

  const recent = entries.slice(-30);
  const all = entries.map((e) => e.features[info.key]).filter(Number.isFinite);
  const scaleV = (v) => v * (info.scale || 1);
  const med = median(all);
  const spread = mad(all);
  const kBand = baselineK(all.length);
  const band = all.length >= BASELINE_MIN && spread > 0 ? [scaleV(med - kBand * spread), scaleV(med + kBand * spread)] : null;
  const name = t('feat')[info.key][0];
  add(wrap, 
    h('h2', { class: 'metric-title' }, name),
    h('p', { class: 'muted small' }, t('feat')[info.key][1], ' ', h('span', { class: `conf conf-${info.confidence}` }, t('confidence')[info.confidence]), ' ', t('confidenceWhy')[info.key]),
    h(
      'div',
      { class: 'chart-wrap' },
      lineChart({
        values: recent.map((e) => scaleV(e.features[info.key])),
        times: recent.map((e) => e.createdAt),
        labels: [fmtDate(recent[0].createdAt, { month: 'numeric', day: 'numeric' }), fmtDate(recent[recent.length - 1].createdAt, { month: 'numeric', day: 'numeric' })],
        band,
        format: (v) => v.toFixed(info.digits),
        selfReport: recent.map((e) => e.mood),
        minSpan: info.minSpan * (info.scale || 1),
        label: t('chartLabel', name, recent.length, fmtFeature(info.key, recent[recent.length - 1].features[info.key])),
      })
    ),
    h(
      'p',
      { class: 'legend small muted' },
      h('span', {}, t('lastN', recent.length)),
      band ? h('span', { class: 'legend-band' }, t('usualRange')) : null,
      recent.some((e) => Number.isFinite(e.mood)) ? h('span', { class: 'legend-mood' }, t('moodMarks')) : null
    ),
    flaggedNote
  );

  // links between voice and self-report
  const rated = entries.filter((e) => Number.isFinite(e.mood) && Number.isFinite(e.energy));
  const links = h('div', { class: 'links' }, h('h2', {}, t('links')));
  const moods = rated.map((e) => e.mood);
  const energies = rated.map((e) => e.energy);
  if (rated.length < LINKS_MIN) {
    add(links, h('p', { class: 'muted' }, t('linksNeedMore', LINKS_MIN, rated.length)));
  } else {
    add(links, h('p', { class: 'muted small' }, t('linksIntro')));
    const table = h('table', { class: 'links-table' });
    add(table, 
      h(
        'thead',
        {},
        h('tr', {}, h('th', { scope: 'col' }, h('span', { class: 'sr-only' }, t('featureCol'))), h('th', { scope: 'col' }, t('withMood')), h('th', { scope: 'col' }, t('withEnergy')))
      )
    );
    const tbody = h('tbody');
    const none = { r: NaN, lo: NaN, hi: NaN };
    const moodOk = distinctCount(moods) >= MIN_DISTINCT_RATINGS;
    const energyOk = distinctCount(energies) >= MIN_DISTINCT_RATINGS;
    for (const f of FEATURE_INFO) {
      const xs = rated.map((e) => e.features[f.key]);
      const featOk = distinctCount(xs) >= MIN_DISTINCT;
      const m = featOk && moodOk ? spearman(xs, moods) : none;
      const en = featOk && energyOk ? spearman(xs, energies) : none;
      const cell = (r, ratingOk) => {
        if (!Number.isFinite(r.r)) {
          return h('td', { class: 'na' }, h('span', { class: 'r' }, '–'), h('span', { class: 'ci' }, t(!featOk ? 'tooLittleVariation' : ratingOk ? 'tooLittleVariation' : 'ratingsTooSimilar')));
        }
        const spansZero = r.lo <= 0 && r.hi >= 0;
        return h('td', { class: spansZero ? 'weak' : '' }, h('span', { class: 'r' }, fmtR(r.r)), h('span', { class: 'ci' }, `[${fmtR(r.lo)}, ${fmtR(r.hi)}]`));
      };
      add(tbody, h('tr', {}, h('th', { scope: 'row' }, t('feat')[f.key][0]), cell(m, moodOk), cell(en, energyOk)));
    }
    add(table, tbody);
    add(links, table, h('p', { class: 'muted small' }, `n = ${rated.length}`, getLang() === 'en' ? '. ' : '。', t('linksCaveat')));
  }
  add(wrap, links);
  return wrap;
}

// A daily calendar reminder for the bedtime ritual. There is no server for notifications,
// so the person adds a recurring event to their own calendar.
function reminderIcs(time) {
  const [hh, mm] = time.split(':').map((v) => String(Number(v)).padStart(2, '0'));
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const url = `${location.origin}${location.pathname}#today`;
  const esc = (x) => x.replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Murmur//Bedtime reminder//EN',
    'BEGIN:VEVENT',
    `UID:murmur-bedtime-${stamp}@murmur`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${ymd}T${hh}${mm}00`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${esc(t('reminderTitle'))}`,
    `DESCRIPTION:${esc(t('reminderBody') + ' ' + url)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(t('reminderTitle'))}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // keep spreadsheets from treating text as a formula
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv() {
  const keys = FEATURE_INFO.map((f) => f.key).concat(['durationS', 'speechS', 'spanS', 'pauseCount', 'syllables', 'voicedFraction']);
  const head = ['id', 'datetime', 'demo', 'mood', 'energy', 'note', 'prompt', ...keys, 'clipFraction', 'snrDb', 'qualityFlags', 'mimeType', 'autoGainControl', 'noiseSuppression', 'echoCancellation', 'featureVersion'];
  const lines = [head.join(',')];
  for (const e of state.entries) {
    const q = e.features.quality || {};
    const c = e.capture || {};
    lines.push(
      [
        e.id,
        new Date(e.createdAt).toISOString(),
        e.demo ? 1 : 0,
        e.mood,
        e.energy,
        e.note,
        e.prompt,
        ...keys.map((k) => e.features[k]),
        q.clipFraction,
        q.snrDb,
        (q.flags || []).join(' '),
        c.mimeType,
        c.autoGainControl,
        c.noiseSuppression,
        c.echoCancellation,
        e.featureVersion,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  download(`murmur-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + lines.join('\n'), 'text/csv');
}

async function exportJson() {
  const [nights, lensSessions] = await Promise.all([db.listNights().catch(() => []), db.listLensSessions().catch(() => [])]);
  const data = { app: 'murmur', version: 1, exportedAt: new Date().toISOString(), entries: state.entries, nights, lensSessions };
  download(`murmur-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data), 'application/json');
}

async function importJson(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== 'murmur' || !Array.isArray(data.entries)) throw new Error('bad');
    const n = await db.importEntries(data.entries.map((e) => ({ ...e, hasAudio: false })));
    state.entries = await db.listEntries();
    toast(t('imported', n));
    render();
  } catch (_) {
    toast(t('importFailed'));
  }
}

function viewAbout() {
  const wrap = h('section', { class: 'view about' });
  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: (e) => e.target.files[0] && importJson(e.target.files[0]),
  });
  const hasDemo = state.entries.some((e) => e.demo);
  add(wrap, 
    h('h2', {}, t('aboutTitle')),
    h('p', {}, t('aboutBody')),
    h('h2', {}, t('featuresTitle')),
    h(
      'dl',
      { class: 'feature-list' },
      FEATURE_INFO.map((f) => [h('dt', {}, t('feat')[f.key][0], ' ', h('span', { class: `conf conf-${f.confidence}` }, t('confidence')[f.confidence])), h('dd', {}, t('feat')[f.key][1], ' ', h('span', { class: 'conf-why' }, t('confidenceWhy')[f.key]))])
    ),
    h('h2', {}, t('privacyTitle')),
    h('p', {}, t('privacyBody')),
    h('h3', { class: 'sub' }, t('storageTitle')),
    h('ul', { class: 'plain-list' }, t('storageNotes').map((s) => h('li', {}, s))),
    h('h2', {}, t('notMedicalTitle')),
    h('p', {}, t('notMedicalBody')),
    h('div', { class: 'help' }, h('p', { class: 'help-title' }, t('helpTitle')), t('helpLines').map((line) => h('span', {}, line))),
    h('h2', {}, t('experimentalTitle')),
    h('p', { class: 'small' }, t('aiAbout')),
    h(
      'label',
      { class: 'toggle' },
      h('input', {
        type: 'checkbox',
        checked: state.aiEnabled,
        'data-key': 'ai-enabled',
        onchange: async (e) => {
          state.aiEnabled = e.target.checked;
          await db.setSetting('aiEnabled', state.aiEnabled);
          if (lensView) lensView.setAiEnabled(state.aiEnabled);
          render();
        },
      }),
      h('span', {}, t('aiEnable'))
    ),
    state.aiEnabled
      ? h(
          'div',
          { class: 'ai-settings' },
          h('label', { for: 'ai-key' }, t('aiKeyLabel')),
          h('input', {
            id: 'ai-key',
            type: 'password',
            spellcheck: 'false',
            autocomplete: 'new-password',
            placeholder: state.aiKeySet ? t('aiKeySaved') : 'sk-ant-…',
            onchange: async (e) => {
              const v = e.target.value.trim();
              if (!v) return;
              await db.setSetting('aiKey', v);
              state.aiKeySet = true;
              e.target.value = '';
              toast(t('aiKeyStored'));
              render();
            },
          }),
          h('label', { for: 'ai-model' }, t('aiModelLabel')),
          h(
            'select',
            {
              id: 'ai-model',
              onchange: (e) => db.setSetting('aiModel', e.target.value),
            },
            AI_MODELS.map((m) => h('option', { value: m.id, selected: m.id === state.aiModel ? 'selected' : null }, m.label))
          ),
          state.aiKeySet
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'btn danger small-btn',
                  onclick: async () => {
                    await db.setSetting('aiKey', '');
                    state.aiKeySet = false;
                    render();
                  },
                },
                t('aiKeyClear')
              )
            : null
        )
      : null,
    h('h2', {}, t('settingsTitle')),
    h(
      'div',
      { class: 'reminder' },
      h('label', { for: 'reminder-time' }, t('reminderLabel')),
      h('input', { id: 'reminder-time', type: 'time', value: state.reminderTime || '22:30', onchange: (e) => (state.reminderTime = e.target.value) }),
      h('button', { type: 'button', class: 'btn', 'data-key': 'reminder-ics', onclick: () => download('murmur-bedtime.ics', reminderIcs(state.reminderTime || '22:30'), 'text/calendar') }, t('reminderAdd'))
    ),
    h('p', { class: 'muted small' }, t('reminderHelp')),
    h(
      'label',
      { class: 'toggle' },
      h('input', {
        type: 'checkbox',
        checked: state.keepAudio,
        'data-key': 'keep-audio',
        onchange: async (e) => {
          state.keepAudio = e.target.checked;
          await db.setSetting('keepAudio', state.keepAudio);
        },
      }),
      h('span', {}, t('keepAudio'))
    ),
    h(
      'div',
      { class: 'lang' },
      h('span', { id: 'lang-label' }, t('language')),
      h(
        'div',
        { class: 'seg', role: 'group', 'aria-labelledby': 'lang-label' },
        [
          ['zh-TW', '中文'],
          ['en', 'English'],
        ].map(([code, label]) =>
          h(
            'button',
            {
              type: 'button',
              class: 'seg-btn' + (getLang() === code ? ' on' : ''),
              'aria-pressed': getLang() === code ? 'true' : 'false',
              'data-key': `lang-${code}`,
              lang: code,
              onclick: async () => {
                setLang(code);
                await db.setSetting('lang', code);
                render();
              },
            },
            label
          )
        )
      )
    ),
    h(
      'div',
      { class: 'data-actions' },
      h('button', { type: 'button', class: 'btn', onclick: exportCsv, disabled: !state.entries.length }, t('exportCsv')),
      h('button', { type: 'button', class: 'btn', onclick: exportJson }, t('exportJson')),
      h('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, t('importJson')),
      fileInput,
      hasDemo
        ? h('button', { type: 'button', class: 'btn', onclick: clearDemo }, t('clearDemo'))
        : hasReal()
        ? null
        : h('button', { type: 'button', class: 'btn', onclick: loadDemo }, t('loadDemo')),
      h(
        'button',
        {
          type: 'button',
          class: 'btn danger',
          onclick: async () => {
            if (!confirm(t('confirmDeleteAll'))) return;
            await db.clearAll();
            state.entries = [];
            state.aiKeySet = false;
            state.aiEnabled = false;
            if (lensView) lensView.setAiEnabled(false);
            await extras.loadNights();
            toast(t('deletedAll'));
            render();
          },
        },
        t('deleteAll')
      )
    ),
    h('p', { class: 'muted small' }, t('installHint')),
    h('p', { class: 'muted small' }, h('a', { href: 'https://github.com/jen900704/murmur-voice-journal', rel: 'noopener' }, t('sourceCode')), getLang() === 'en' ? '. ' : '。', t('methodsNote'))
  );
  return wrap;
}

// ---------- shell ----------
const TABS = ['today', 'journal', 'trends', 'lens', 'about'];
let lensView = null;
function goLens(stage) {
  if (!lensView) render();
  lensView.go(stage);
  if (location.hash !== '#lens') location.hash = '#lens';
}
const extras = createExtras({
  h,
  add,
  getLang,
  render: () => render(),
  toast,
  db,
  getState: () => state,
  openSheet,
  closeSheet,
  goLens,
  startRitual: () => nightView.begin(),
});
const nightView = createNightView({
  h,
  add,
  getLang,
  rerender: () => render(),
  toast,
  db,
  onExit: () => {
    extras.loadNights().then(() => render());
  },
  latestMood,
  openGentle: () => extras.openGentle(),
});

function render() {
  // keep keyboard focus on the same control across re-renders
  const active = document.activeElement;
  const focusedKey = active && active.dataset ? active.dataset.key : null;

  document.title = t('appName');
  $('#brand-name').textContent = t('appName');
  $('#brand-tag').textContent = t('tagline');
  $('.skip').textContent = t('skip');
  const main = $('#main');
  main.innerHTML = '';
  if (!lensView) lensView = createLensView({ h, add, getLang, rerender: render, toast, db, openGentle: () => extras.openGentle() });
  const views = { today: viewToday, journal: viewJournal, trends: viewTrends, lens: lensView.view, about: viewAbout };
  main.appendChild(views[state.tab]());
  const nav = $('#tabs');
  nav.setAttribute('aria-label', t('sections'));
  nav.innerHTML = '';
  for (const tab of TABS) {
    nav.appendChild(
      h(
        'a',
        {
          href: `#${tab}`,
          class: 'tab' + (state.tab === tab ? ' on' : ''),
          'aria-current': state.tab === tab ? 'page' : null,
        },
        h('span', { class: `tab-icon icon-${tab}`, 'aria-hidden': 'true' }),
        h('span', { class: 'tab-label' }, t('tab' + tab[0].toUpperCase() + tab.slice(1)))
      )
    );
  }
  if (focusedKey) focusKey(focusedKey);
}

// A shared prompt link carries only the prompt's number, never free text.
function parseAsk(tab) {
  const n = Number.parseInt(tab.slice(4), 10);
  const len = (DAILY[getLang()] || DAILY.en).length;
  return Number.isInteger(n) && n >= 0 && n < len ? n : null;
}

function onHash() {
  const tab = location.hash.replace('#', '');
  if (tab.startsWith('ask=')) {
    state.askIndex = parseAsk(tab);
    history.replaceState(null, '', '#today');
    state.tab = 'today';
    render();
    return;
  }
  if (tab === 'entry') {
    // reached with the Forward button after closing a detail view
    if ($('#sheet').hidden) {
      if (state.sheetFn) renderSheet();
      else if (state.detailId && state.entries.some((e) => e.id === state.detailId)) renderDetail();
      else history.replaceState(null, '', '#' + state.tab);
    }
    return;
  }
  closeDetailUI();
  if (TABS.includes(tab) && tab !== state.tab) {
    if (state.phase === 'recording') cancelRecording();
    if (state.tab === 'today' && nightView.active()) nightView.stopAll();
    state.tab = tab;
    render();
    window.scrollTo(0, 0);
  } else if (TABS.includes(tab)) {
    render();
  }
}

async function init() {
  const savedLang = await db.getSetting('lang', null).catch(() => null);
  setLang(savedLang || detectLang());
  state.keepAudio = await db.getSetting('keepAudio', true).catch(() => true);
  state.aiEnabled = (await db.getSetting('aiEnabled', false).catch(() => false)) === true;
  state.aiKeySet = !!(await db.getSetting('aiKey', '').catch(() => ''));
  state.aiModel = await db.getSetting('aiModel', AI_MODELS[0].id).catch(() => AI_MODELS[0].id);
  state.entries = await db.listEntries().catch((e) => {
    if (e && e.message === 'blocked') setTimeout(() => toast(t('dbBlocked')), 300);
    return [];
  });
  state.promptIndex = promptOfDay(getLang()).index;
  const tab = location.hash.replace('#', '');
  state.tab = TABS.includes(tab) ? tab : 'today';
  if (tab === 'entry') history.replaceState(null, '', '#today');
  if (tab.startsWith('ask=')) {
    state.askIndex = parseAsk(tab);
    state.tab = 'today';
    history.replaceState(null, '', '#today');
  }
  window.addEventListener('hashchange', onHash);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#sheet').hidden) {
      if (location.hash === '#entry') history.back();
      else closeDetailUI();
    }
  });
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
