import { t, setLang, getLang, detectLang, STRINGS } from './i18n.js';
import { Recorder, decodeToMono16k, isSupported, TARGET_SR } from './recorder.js';
import { FEATURE_INFO, FEATURE_VERSION, median } from './features.js';
import { personalBaseline, baselineK, spearman, fmtR, mad, distinctCount } from './stats.js';
import { glyph, ringPath, lineChart } from './viz.js';
import * as db from './db.js';
import { createNightView, isEvening } from './night-view.js';
import { createExtras } from './extras.js';
import { checkRisk, helpList } from './safety.js';
import { MODELS as AI_MODELS } from './ai-models.js';
import { DAILY, promptOfDay } from './prompts.js';
import { breatheSheet } from './breathe.js';
import { cleanEntry, cleanNight, cleanSession } from './validate.js';
import { LENSES } from './lenses.js';
import { calmSheet } from './calm.js';

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
  storageDown: false, // storage did not answer at launch; nothing can be saved
  clockDay: '', // the date and evening state Today was last drawn for
  clockEvening: false,
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
// The entries a value is compared with. A real recording is only ever compared with real
// ones, and a demo entry only with demo ones; Trends shows demo data until real data exists.
function pool({ before, demo } = {}) {
  const useDemo = demo === undefined ? !hasReal() : demo;
  return state.entries.filter(
    (e) =>
      usable(e) &&
      !!e.demo === useDemo &&
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
      // stop the worker so it does not keep running next to the fallback below
      try {
        w.terminate();
      } catch (e) {
        /* already gone */
      }
      worker = false;
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
  // If the microphone is taken away (a call, another app, the phone locked), end here: a
  // silent tail would otherwise be measured as pauses.
  const rec = state.recorder;
  rec.onInterrupt(() => {
    if (state.recorder !== rec || state.phase !== 'recording') return;
    rec.elapsed() >= MIN_SECONDS ? stopRecording(true) : cancelRecording();
  });
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
  if (hint) hint.textContent = secs < MIN_SECONDS ? t('tooShortHint') : secs > MAX_SECONDS - 10 ? t('autoStopSoon', Math.ceil(MAX_SECONDS - secs)) : t('tapToStop');
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
    const msg = (err && err.message) || String(err);
    state.error = msg === 'short' ? t('tooShort') : t('analysisFailed') + msg;
  } finally {
    render();
  }
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
    // a silent check-in does not answer the day's prompt, so it neither stores nor uses it up
    prompt: p.silent ? '' : prompts[(state.askIndex ?? state.promptIndex) % prompts.length],
    lang: getLang(),
    mood: p.mood,
    energy: p.energy,
    note: p.note.trim(),
    features: p.features,
    featureVersion: p.silent ? 0 : FEATURE_VERSION,
    capture: p.capture || null,
    hasAudio: p.silent ? false : state.keepAudio,
    silent: p.silent || undefined,
  };
  // a silent check-in with nothing filled in is not worth keeping
  if (p.silent && entry.mood === null && entry.energy === null && !entry.note) {
    savePending.busy = false;
    state.pending = null;
    state.phase = 'idle';
    toast(t('silentEmpty'));
    return render();
  }
  let message = t('saved');
  try {
    try {
      await db.saveEntry(entry, entry.hasAudio ? p.blob : null);
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
  if (!p.silent) {
    state.askIndex = null;
    state.promptIndex = (state.promptIndex + 1) % prompts.length;
  }
  state.entries.push(entry);
  journalSearch.entrySaved(entry);
  db.requestPersistence();
  state.pending = null;
  state.phase = 'idle';
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
  const group = h('div', { class: 'scale', role: 'radiogroup', 'aria-label': t(name), 'data-roving': '1' });
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

// Radio groups get one tab stop and arrow keys, as the ARIA radio pattern expects.
// Groups that handle this themselves carry data-roving.
function enhanceRadios(root) {
  for (const g of root.querySelectorAll('[role="radiogroup"]:not([data-roving])')) {
    const radios = [...g.querySelectorAll('[role="radio"]')];
    if (!radios.length) continue;
    g.dataset.roving = '1';
    const current = radios.find((r) => r.getAttribute('aria-checked') === 'true') || radios[0];
    for (const r of radios) r.tabIndex = r === current ? 0 : -1;
    g.addEventListener('keydown', (e) => {
      const i = radios.indexOf(document.activeElement);
      if (i < 0) return;
      const n = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: radios.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      const target = radios[(n + radios.length) % radios.length];
      target.focus();
      // some chips toggle off when clicked again, so only click one that is not already chosen
      if (target.getAttribute('aria-checked') !== 'true') target.click();
    });
  }
}

function focusKey(key) {
  const n = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
  if (n) n.focus();
}

function baselineFor(key, value, before, demo = false) {
  const hist = pool({ before, demo }).map((e) => e.features[key]);
  return personalBaseline(hist, value, BASELINE_MIN);
}

function featureRow(key, features, before, demo = false) {
  const b = baselineFor(key, features[key], before, demo);
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
    const n = pool({ demo: false }).length;
    const early = n < BASELINE_MIN;
    const numbers = () => [
      h('div', { class: 'rows' }, ['f0MedianHz', 'f0SdSt', 'speechRate', 'pauseRatio', 'periodicityDb'].map((k) => featureRow(k, f))),
      early ? h('p', { class: 'muted small' }, t('needMoreForBaseline', BASELINE_MIN - n)) : h('p', { class: 'muted small' }, t('chanceNote')),
    ];
    const pick = (field) => (v, fromKey) => {
      p[field] = !fromKey && p[field] === v ? null : v;
      render();
    };
    add(wrap, 
      // a silent check-in has no voice to show: just the check-in itself
      p.silent ? h('h2', { tabindex: '-1', 'data-key': 'silent-title' }, t('silentTitle')) : null,
      p.silent ? h('p', { class: 'muted small' }, t('silentBody')) : null,
      p.silent ? null : h('div', { class: 'result-head' }, glyph(f, 200, { width: 120, label: t('shapeLabel') }), h('h2', {}, t('yourVoiceToday'))),
      p.silent ? null : qualityNote(f),
      // once there is a usual range the numbers say something, so they come first; before that they
      // are raw values, folded below the check-in so a tired first visit ends in two taps
      p.silent || early ? null : numbers(),
      h(
        'div',
        { class: 'checkin' },
        p.silent ? null : h('h3', {}, t('checkIn')),
        p.silent ? null : h('p', { class: 'muted small' }, t('checkInOptional')),
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
        { class: 'actions result-actions' },
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
      ),
      p.silent || !early ? null : h('details', { class: 'about-more result-numbers', open: p.numbersOpen ? '' : null, ontoggle: (e) => (p.numbersOpen = e.currentTarget.open) }, h('summary', { 'data-key': 'result-numbers' }, t('numbersTitle')), numbers())
    );
    return wrap;
  }

  const idle = state.phase === 'idle' || state.phase === 'error';
  if (idle && !state.welcomed && !state.entries.length) add(wrap, welcomeCard());
  const welcoming = idle && !state.welcomed && !state.entries.length;
  // in the evening the bedtime card comes first, and a low check-in adds a short note under it
  const evening = idle && isEvening() && !welcoming;
  // at the lowest rating the note, with help first, stays on top even in the evening
  const lowest = latestRated();
  const helpFirst = lowest && lowest.mood <= 1;
  if (evening && !helpFirst) add(wrap, nightView.card());
  // the low-mood card offers breathing, writing and (by day) the ritual itself; the row under
  // the record button then leaves those out, so each action appears once on the screen
  const lowCard = idle ? extras.lowMoodCard(lowest, { evening }) : null;
  if (lowCard) add(wrap, lowCard);
  if (evening && helpFirst) add(wrap, nightView.card());
  if (idle) add(wrap, iosInstallNote());
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
    // for nights when speaking aloud is not possible (family or roommates asleep nearby)
    add(
      wrap,
      h('button', { type: 'button', class: 'link center', 'data-key': 'silent-checkin', onclick: () => {
        state.pending = { silent: true, features: null, mood: null, energy: null, note: '' };
        state.phase = 'result';
        // choosing a way in counts as having seen the welcome
        state.welcomed = true;
        db.setSetting('welcomed', true).catch(() => {});
        render();
        window.scrollTo(0, 0);
        focusKey('silent-title');
      } }, t('silentLink'))
    );
    add(
      wrap,
      h(
        'div',
        { class: 'today-links' },
        lowCard ? null : h('button', { type: 'button', class: 'link', 'data-key': 'breathe-link', onclick: () => openSheet(breatheSheet({ h, getLang })) }, t('breatheLink')),
        h('button', { type: 'button', class: 'link', 'data-key': 'calm-link', onclick: openCalm }, t('calmLink')),
        lowCard ? null : h('button', { type: 'button', class: 'link', 'data-key': 'writing-link', onclick: openWriting }, t('writingLink')),
        lowCard || isEvening() ? null : h('button', { type: 'button', class: 'link night-link', 'data-key': 'night-link', onclick: () => nightView.begin() }, t('bedtimeLink'))
      )
    );
    // the demo offer is for a first visit only; it sits last and quiet, so "just your mood" stays the one text link
    if (!state.entries.length) {
      add(wrap, h('button', { type: 'button', class: 'link center demo-offer', onclick: loadDemo }, t('loadDemoShort')));
    }
    const recent = state.entries.filter(usable).slice(-7);
    if (recent.length) {
      add(wrap, 
        h(
          'div',
          { class: 'recent', role: 'list', 'aria-label': t('recentLabel') },
          recent.map((e) =>
            h(
              'div',
              { role: 'listitem' },
              h(
                'button',
                {
                  type: 'button',
                  class: 'recent-item',
                  'data-key': `recent-${e.id}`,
                  'aria-label': fmtDate(e.createdAt, { dateStyle: 'medium', timeStyle: 'short' }),
                  onclick: (ev) => openDetail(e.id, ev.currentTarget),
                },
                glyph(e.features, 60, { width: 40 })
              )
            )
          )
        )
      );
    }
  }
  return wrap;
}

// Safari on iPhone may clear a site's data after about a week without a visit; a home-screen
// app is kept. After a couple of real entries, say so once, with the steps.
function iosInstallNote() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  // shown early, before there is much to move, but not on top of the first-visit welcome
  if (!ios || standalone || state.installNoted || (!state.welcomed && !state.entries.length)) return null;
  const dismiss = () => {
    state.installNoted = true;
    db.setSetting('installNoted', true).catch(() => {});
    render();
  };
  return h('div', { class: 'demo-banner', role: 'note' }, h('span', {}, t('iosInstall')), h('button', { type: 'button', class: 'link', 'data-key': 'ios-install-ok', onclick: dismiss }, t('gotIt')));
}

// First visit only: three ways in, and what the app is not. Dismissed for good with one tap.
function welcomeCard() {
  const dismiss = () => {
    state.welcomed = true;
    db.setSetting('welcomed', true).catch(() => {});
  };
  const door = (key, title, body, onclick) => h('button', { type: 'button', class: 'welcome-door', 'data-key': key, onclick }, h('span', { class: 'welcome-door-title' }, title), h('span', { class: 'welcome-door-body' }, body));
  return h(
    'section',
    { class: 'welcome', 'aria-labelledby': 'welcome-title' },
    h('h2', { id: 'welcome-title' }, t('welcomeTitle')),
    h('p', {}, t('welcomeBody')),
    h(
      'div',
      { class: 'welcome-doors' },
      door('welcome-voice', t('welcomeVoice'), t('welcomeVoiceBody'), () => {
        dismiss();
        render();
        focusKey('rec');
      }),
      door('welcome-lens', t('welcomeLens'), t('welcomeLensBody'), () => {
        dismiss();
        location.hash = '#lens';
      }),
      door('welcome-night', t('welcomeNight'), t('welcomeNightBody'), () => {
        dismiss();
        nightView.begin();
      })
    ),
    h('p', { class: 'muted small' }, t('welcomeNote')),
    h('button', { type: 'button', class: 'link', 'data-key': 'welcome-close', onclick: () => { dismiss(); render(); window.scrollTo(0, 0); } }, t('welcomeClose'))
  );
}

function viewJournal() {
  const wrap = h('section', { class: 'view journal' });
  // search comes first; while a query is typed, its results replace the rest of the page
  journalSearch.view(wrap);
  // one compact field: the label stays for screen readers and doubles as the placeholder
  const searchInput = wrap.querySelector('#journal-search-input');
  const searchLabel = wrap.querySelector('label[for="journal-search-input"]');
  if (searchInput && searchLabel) searchInput.placeholder = searchLabel.textContent;
  add(wrap, backupNote(), extras.weekCard());
  add(wrap, extras.modeChips(state.journalMode, (m) => {
    state.journalMode = m;
    render();
  }));
  if (state.journalMode === 'nights') return add(wrap, extras.nightsSection());
  if (state.journalMode === 'jar') return add(wrap, extras.jarSection());
  if (state.journalMode === 'words') {
    // the language mirror and its word lists load on first use
    if (!languageView) {
      import('./language-view.js')
        .then(({ createLanguageView }) => {
          languageView = createLanguageView({ h, add, getLang, toast, openSheet });
          render();
        })
        .catch(() => toast(t('loadFailed')));
      return add(wrap, h('p', { class: 'muted', role: 'status' }, t('loading')));
    }
    return add(wrap, languageView.view());
  }
  const entries = state.entries.filter((e) => e.features && e.features.ok);
  if (!entries.length) {
    const silentOnly = state.entries.some((e) => e.silent);
    add(wrap, h('p', { class: 'empty' }, t(silentOnly ? 'journalEmptyVoice' : 'journalEmpty')), silentOnly ? null : h('button', { type: 'button', class: 'btn', onclick: loadDemo }, t('loadDemo')), silentSection());
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
              // the name is the date and time shown on the tile, so voice control can say what it sees
              onclick: (ev) => openDetail(e.id, ev.currentTarget),
            },
            glyph(e.features, 120, { width: '100%' }),
            h('span', { class: 'tile-date' }, fmtDate(e.createdAt, { month: 'numeric', day: 'numeric' })),
            ' ',
            h('span', { class: 'tile-time' }, fmtDate(e.createdAt, { hour: 'numeric', minute: '2-digit' }))
          )
        )
      )
    );
  }
  add(wrap, silentSection());
  return wrap;
}

// Check-ins saved without a recording, newest first, each removable on its own.
function silentSection() {
  const list = state.entries.filter((e) => e.silent).reverse();
  if (!list.length) return null;
  const rating = (label, v) => (Number.isFinite(v) ? `${label} ${v}/7` : null);
  return [
    h('h2', { class: 'month' }, t('silentEntries')),
    h(
      'ul',
      { class: 'plain-list silent-list' },
      list.map((e) =>
        h(
          'li',
          {},
          h('span', { class: 'muted small' }, fmtDate(e.createdAt, { dateStyle: 'medium', timeStyle: 'short' }), ' · ', [rating(t('mood'), e.mood), rating(t('energy'), e.energy)].filter(Boolean).join(' · ')),
          e.note ? h('span', {}, ' ', e.note) : null,
          ' ',
          h('button', { type: 'button', class: 'link small-link', 'data-key': `silent-del-${e.id}`, onclick: async () => {
            if (!confirm(t('confirmDelete'))) return;
            await db.deleteEntry(e.id);
            state.entries = state.entries.filter((x) => x.id !== e.id);
            journalSearch.entryDeleted(e.id);
            render();
          } }, t('deleteEntry'))
        )
      )
    ),
  ];
}

function openSheet(fn) {
  state.sheetFn = fn;
  state.detailId = null;
  const a = document.activeElement;
  state.detailOpener = a && a.dataset ? a.dataset.key || null : null;
  if (location.hash !== '#entry') location.hash = '#entry';
  renderSheet();
  $('#sheet').scrollTop = 0; // a new sheet starts at its top, not where the last one was left
}

function closeSheet() {
  if (location.hash === '#entry') history.back();
  else closeDetailUI();
}

function renderSheet() {
  const sheet = $('#sheet');
  if (!state.sheetFn) return;
  // a rerender inside the sheet keeps focus on the same control
  const a = document.activeElement;
  const keepKey = !sheet.hidden && a && sheet.contains(a) && a.dataset ? a.dataset.key : null;
  sheet.hidden = false;
  sheet.innerHTML = '';
  setBackgroundInert(true);
  const body = h('div', { class: 'sheet-body', role: 'dialog', 'aria-modal': 'true' }, h('button', { type: 'button', class: 'link back', onclick: closeSheet }, t('back')));
  add(body, state.sheetFn(renderSheet));
  // name the dialog after its first heading
  const head = body.querySelector('h2');
  if (head) {
    head.id = head.id || 'sheet-title';
    body.setAttribute('aria-labelledby', head.id);
  }
  sheet.appendChild(body);
  enhanceRadios(body);
  const again = keepKey && body.querySelector(`[data-key="${CSS.escape(keepKey)}"]`);
  (again || body.querySelector('.back')).focus();
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
    h('div', { class: 'rows' }, FEATURE_INFO.map((info) => featureRow(info.key, f, e.createdAt, !!e.demo))),
    h(
      'button',
      {
        type: 'button',
        class: 'btn danger',
        onclick: async () => {
          if (!confirm(t('confirmDelete'))) return;
          await db.deleteEntry(e.id);
          state.entries = state.entries.filter((x) => x.id !== e.id);
          journalSearch.entryDeleted(e.id);
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
    // with no usable recordings (not even demo ones) there is nothing to report
    if (entries.length) add(wrap, voiceReportBlock(!real));
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
  // a missing value stays missing (null * 1 would plot as 0)
  const scaleV = (v) => (Number.isFinite(v) ? v * (info.scale || 1) : null);
  const med = median(all);
  let spread = mad(all);
  if (!(spread > 0) && all.length > 1) {
    // same fallback as the daily comparison: SD when most values are identical
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    spread = Math.sqrt(all.reduce((a, b) => a + (b - mean) ** 2, 0) / (all.length - 1));
  }
  const kBand = baselineK(all.length);
  const band = all.length >= BASELINE_MIN && spread > 0 ? [scaleV(med - kBand * spread), scaleV(med + kBand * spread)] : null;
  const name = t('feat')[info.key][0];
  add(wrap, 
    h('h2', { class: 'metric-title' }, name),
    h('p', { class: 'conf-line' }, h('span', { class: `conf conf-${info.confidence}` }, t('confidence')[info.confidence])),
    h('p', { class: 'muted small' }, t('feat')[info.key][1], ' ', t('confidenceWhy')[info.key]),
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
    add(links, h('p', { class: 'small' }, t('linksPlain')), h('details', { class: 'lens-more' }, h('summary', {}, t('linksHow')), h('p', { class: 'muted small' }, t('linksIntro'))));
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
  add(wrap, links, voiceReportBlock(!real));
  return wrap;
}

// The voice evidence report: an HTML page and a JSON file made on the device from the same
// entries as this view. Notes go in only when the box is ticked; audio never does.
async function saveVoiceReport(kind, includeNotes) {
  let m;
  try {
    m = await import('./voice-report.js');
  } catch (_) {
    toast(t('loadFailed'));
    return;
  }
  const lang = getLang();
  const data = m.buildVoiceReportData(state.entries, { uiLang: lang, strings: { ...STRINGS.en, ...STRINGS[lang] }, includeNotes: includeNotes === true });
  const names = m.voiceReportFileNames(localDate(), data.synthetic);
  if (kind === 'json') saveFile(names.json, JSON.stringify(data, null, 2), 'application/json');
  else saveFile(names.html, m.buildVoiceReportHtml(data), 'text/html');
}

function voiceReportBlock(synthetic) {
  const notes = h('input', { type: 'checkbox', 'data-key': 'voice-report-notes' });
  return h(
    'div',
    { class: 'voice-report' },
    h('h2', {}, t('voiceReportTitle')),
    h('p', { class: 'small' }, t('voiceReportAbout')),
    synthetic ? h('p', { class: 'muted small', 'data-key': 'voice-report-demo' }, t('voiceReportDemo')) : null,
    h('label', { class: 'toggle' }, notes, h('span', {}, t('voiceReportNotes'))),
    h(
      'div',
      { class: 'voice-report-actions' },
      h('button', { type: 'button', class: 'btn', 'data-key': 'voice-report-html', onclick: () => saveVoiceReport('html', notes.checked) }, t('voiceReportHtml')),
      h('button', { type: 'button', class: 'btn ghost', 'data-key': 'voice-report-json', onclick: () => saveVoiceReport('json', notes.checked) }, t('voiceReportJson'))
    )
  );
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
  // iOS can take a while to hand the file over; revoking too early loses it
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 60000);
}

// On phones, the share sheet is the reliable way to keep a file (Save to Files, Drive, mail);
// a download link often does nothing in an iPhone Home Screen app. Returns false if cancelled.
async function saveFile(name, text, type) {
  const file = typeof File === 'function' ? new File([text], name, { type }) : null;
  if (file && matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (_) {
      return false;
    }
  }
  download(name, text, type);
  return true;
}

const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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
    if (!e.features) continue; // silent check-ins have no measurements to export as CSV rows
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
  saveFile(`murmur-${localDate()}.csv`, '﻿' + lines.join('\n'), 'text/csv');
}

async function exportJson() {
  const [nights, lensSessions, lensStats] = await Promise.all([db.listNights().catch(() => []), db.listLensSessions().catch(() => []), db.getSetting('lensStats', {}).catch(() => ({}))]);
  // the learner's decision log and state travel with the backup when the feature has been used
  const policy = await import('./policy.js').then((m) => m.createPolicyStore(db).exportForBackup()).catch(() => null);
  const data = { app: 'murmur', version: 1, exportedAt: new Date().toISOString(), entries: state.entries, nights, lensSessions, lensStats: cleanLensStats(lensStats) || {}, ...(policy || {}) };
  if (!(await saveFile(`murmur-backup-${localDate()}.json`, JSON.stringify(data), 'application/json'))) return false;
  state.lastBackup = Date.now();
  db.setSetting('lastBackup', state.lastBackup).catch(() => {});
  return true;
}

// Everything lives on this one phone, and Safari can clear it. After some real entries, and
// then once a month, a quiet note offers a backup. Dismissing it waits another month.
function backupNote() {
  const real = state.entries.filter((e) => !e.demo).length + (state.writtenCount || 0);
  const month = 30 * 24 * 3600 * 1000;
  if (real < 10 || Date.now() - (state.lastBackup || 0) < month) return null;
  const later = () => {
    state.lastBackup = Date.now();
    db.setSetting('lastBackup', state.lastBackup).catch(() => {});
    render();
  };
  return h(
    'div',
    { class: 'demo-banner', role: 'note' },
    h('span', {}, t('backupNote')),
    h('button', { type: 'button', class: 'link', 'data-key': 'backup-now', onclick: () => exportJson().then(render) }, t('backupNow')),
    h('button', { type: 'button', class: 'link', onclick: later }, t('backupLater'))
  );
}

// Which lenses were used and how they were rated ("which lens fits"). Only known lens ids
// and numbers in range are kept from a backup; anything else is dropped.
const MAX_LENS_USED = 100000;
const MAX_LENS_RATINGS = 500;
function cleanLensStats(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const { id } of LENSES) {
    const s = Object.prototype.hasOwnProperty.call(raw, id) ? raw[id] : null;
    if (s === null || typeof s !== 'object' || Array.isArray(s)) continue;
    const used = Number.isInteger(s.used) && s.used > 0 ? Math.min(s.used, MAX_LENS_USED) : 0;
    const ratings = (Array.isArray(s.ratings) ? s.ratings : []).filter((r) => Number.isInteger(r) && r >= 1 && r <= 5).slice(-MAX_LENS_RATINGS);
    if (used || ratings.length) out[id] = { used, ratings };
  }
  return Object.keys(out).length ? out : null;
}

// counts add up and ratings are joined, so a restore keeps what this device already has
async function mergeLensStats(incoming) {
  const mine = cleanLensStats(await db.getSetting('lensStats', {})) || {};
  for (const [id, s] of Object.entries(incoming)) {
    const m = mine[id] || { used: 0, ratings: [] };
    mine[id] = { used: Math.min(m.used + s.used, MAX_LENS_USED), ratings: [...m.ratings, ...s.ratings].slice(-MAX_LENS_RATINGS) };
  }
  await db.setSetting('lensStats', mine);
}

// An exercise in progress is never reset by an import: the lens view reads the imported
// sessions and stats once the exercise is over (see render).
let lensImport = null; // imported stats waiting for the exercise to end
let lensStale = false; // the lens view should read storage again
function settleLensImport() {
  if (!lensView || lensView.active()) return;
  if (lensImport) {
    const incoming = lensImport;
    lensImport = null;
    mergeLensStats(incoming)
      .catch(() => {})
      .then(() => {
        lensStale = true;
        render();
      });
    return;
  }
  if (lensStale) {
    lensStale = false;
    lensView.reload();
  }
}

function importedText(n, nights, sessions) {
  if (!nights && !sessions) return t('imported', n);
  const zh = getLang() !== 'en';
  const parts = [];
  if (n) parts.push(zh ? `聲音日記 ${n} 筆` : `${n} voice entr${n === 1 ? 'y' : 'ies'}`);
  if (nights) parts.push(zh ? `睡前紀錄 ${nights} 筆` : `${nights} bedtime note${nights === 1 ? '' : 's'}`);
  if (sessions) parts.push(zh ? `「換個角度看看」練習 ${sessions} 筆` : `${sessions} lens exercise${sessions === 1 ? '' : 's'}`);
  if (zh) return `已匯入${parts.join('、')}`;
  return `Imported ${parts.length > 2 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts.join(' and ')}`;
}

async function importJson(file) {
  try {
    if (file.size > 50 * 1024 * 1024) throw new Error('too big');
    const data = JSON.parse(await file.text());
    if (!data || data.app !== 'murmur' || !Array.isArray(data.entries)) throw new Error('bad');
    // every record is checked and trimmed first: one bad record must not break a screen
    const n = await db.importEntries(data.entries.map(cleanEntry).filter(Boolean));
    // bedtime notes and saved lens exercises come back too; ids keep a second import from duplicating them.
    // Like voice entries, only records this device did not have yet are counted.
    const putNew = async (records, have, save) => {
      const seen = new Set(have.map((r) => r.id));
      let added = 0;
      for (const r of records) {
        const ok = await save(r).then(
          () => true,
          () => false
        );
        if (ok && !seen.has(r.id)) added++;
        seen.add(r.id);
      }
      return added;
    };
    const nights = await putNew((Array.isArray(data.nights) ? data.nights : []).map(cleanNight).filter(Boolean), await db.listNights().catch(() => []), db.saveNight);
    const sessions = await putNew((Array.isArray(data.lensSessions) ? data.lensSessions : []).map(cleanSession).filter(Boolean), await db.listLensSessions().catch(() => []), db.saveLensSession);
    const stats = cleanLensStats(data.lensStats);
    if (data.policyLog || data.policyState) await import('./policy.js').then((m) => m.createPolicyStore(db).importFromBackup(data)).catch(() => {});
    if (lensView && lensView.active()) {
      // an exercise is in progress: leave it alone and bring the lens view up to date afterwards
      if (stats) lensImport = stats;
      lensStale = true;
    } else {
      if (stats) await mergeLensStats(stats).catch(() => {});
      if (lensView) lensView.reload();
    }
    await extras.loadNights();
    state.entries = await db.listEntries();
    toast(importedText(n, nights, sessions));
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
    onchange: (e) => {
      const file = e.target.files[0];
      // cleared every time, so picking the same file again (after a refusal, say) is noticed
      e.target.value = '';
      if (file) importJson(file);
    },
  });
  const hasDemo = state.entries.some((e) => e.demo);
  add(wrap, 
    h('h2', {}, t('aboutTitle')),
    h('p', {}, t('aboutBody')),
    // help lines near the top: the welcome card and other screens point here
    h('h2', {}, t('notMedicalTitle')),
    h('p', {}, t('notMedicalBody')),
    h('div', { class: 'help', id: 'help' }, h('p', { class: 'help-title' }, t('helpTitle')), helpList(h, getLang())),
    h('h2', {}, t('privacyTitle')),
    h('p', {}, t('privacyBody')),
    h('h3', { class: 'sub' }, t('storageTitle')),
    h('ul', { class: 'plain-list' }, t('storageNotes').map((s) => h('li', {}, s))),
    h(
      'details',
      { class: 'about-more' },
      h('summary', {}, h('h2', { class: 'inline' }, t('featuresTitle'))),
      h(
        'dl',
        { class: 'feature-list' },
        FEATURE_INFO.map((f) => [h('dt', {}, t('feat')[f.key][0], ' ', h('span', { class: `conf conf-${f.confidence}` }, t('confidence')[f.confidence])), h('dd', {}, t('feat')[f.key][1], ' ', h('span', { class: 'conf-why' }, t('confidenceWhy')[f.key]))])
      )
    ),
    // how the app is checked, for anyone curious; every link goes to the public repository
    h(
      'details',
      { class: 'about-more' },
      h('summary', {}, h('h2', { class: 'inline' }, t('testedTitle'))),
      h('ul', { class: 'plain-list' }, t('testedItems').map(([text, path]) => h('li', {}, h('a', { href: `https://github.com/jen900704/murmur-voice-journal/blob/main/${path}`, rel: 'noopener' }, text))))
    ),
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
              onchange: (e) => {
                state.aiModel = e.target.value;
                db.setSetting('aiModel', e.target.value);
              },
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
              onclick: () => {
                // the switch shows at once, also when the choice cannot be stored
                setLang(code);
                db.setSetting('lang', code).catch(() => {});
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
      h('button', { type: 'button', class: 'btn', onclick: exportCsv, disabled: !state.entries.some((e) => e.features) }, t('exportCsv')),
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
            // texts kept in the language mirror live in their own small database
            await import('./langlab/store.js').then((m) => m.clearLanguageData()).catch(() => {});
            state.entries = [];
            journalSearch.reset();
            state.aiKeySet = false;
            state.aiEnabled = false;
            lensImport = null;
            lensStale = false;
            if (lensView) {
              lensView.setAiEnabled(false);
              lensView.reload();
            }
            nightView.stopAll(true);
            state.welcomed = false;
            state.lastBackup = 0;
            try {
              for (const k of Object.keys(localStorage)) if (k.startsWith('murmur-')) localStorage.removeItem(k);
            } catch (_) {
              /* storage unavailable */
            }
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
function lensLoading() {
  loadLens().catch(() => {});
  return h('section', { class: 'view' }, h('p', { class: 'muted', role: 'status' }, t('loading')));
}
const TABS = ['today', 'journal', 'trends', 'lens', 'about'];
let lensView = null;
// the theory lens (and the AI conversation inside it) loads on first use
function loadLens() {
  if (!loadLens.p) {
    loadLens.p = import('./lens-view.js').then(({ createLensView }) => {
      lensView = createLensView({ h, add, getLang, rerender: render, toast, db, openGentle: () => extras.openGentle() });
      if (state.tab === 'lens') render();
      return lensView;
    });
    loadLens.p.catch(() => {
      loadLens.p = null;
      toast(t('loadFailed'));
    });
  }
  return loadLens.p;
}
function goLens(stage) {
  loadLens().then((lv) => {
    // coming from another tab starts fresh, so Back on the help page goes to the lens home
    lv.reset();
    lv.go(stage);
    if (location.hash !== '#lens') location.hash = '#lens';
  }, () => {});
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
  openBreathe: () => openCalm(),
  openWriting: () => openWriting(),
});
// "I'm panicking": breathing, then grounding, then self-compassion phrases (js/calm.js)
function openCalm() {
  openSheet(calmSheet({ h, getLang }));
}
// Writing by weight, with Pennebaker-style deep prompts and a closing (js/writing.js)
// loaded on first use, so the first visit stays light
async function openWriting() {
  const { writingSheet } = await import('./writing.js');
  openSheet(
    writingSheet({
      h,
      getLang,
      db,
      toast,
      onSaved: (entry) => {
        state.entries.push(entry);
        journalSearch.entrySaved(entry);
        render();
      },
      onUpdated: (entry) => journalSearch.entrySaved(entry),
    })
  );
}
// The language mirror: on-device analysis of the person's own writing (js/langlab)
let languageView = null;
// Search over the person's own writing. The index is held in memory only (js/search.js).
// js/search.js loads after the first screen (or when the Journal opens); until then the hooks
// are no-ops, which is safe because the index is built from IndexedDB when it first shows.
let searchImpl = null;
function loadSearch() {
  if (!loadSearch.p) {
    loadSearch.p = import('./search.js')
      .then(({ createJournalSearch }) => {
        searchImpl = createJournalSearch({
          h,
          getLang,
          db,
          getEntries: () => state.entries,
          openEntry: (id, opener) => openDetail(id, opener),
          openSheet,
          closeSheet,
        });
        if (state.tab === 'journal' && !state.sheetFn) render();
      })
      .catch(() => {});
  }
  return loadSearch.p;
}
const journalSearch = {
  view: (wrap) => (searchImpl ? searchImpl.view(wrap) : void loadSearch()),
  entrySaved: (entry) => searchImpl && searchImpl.entrySaved(entry),
  entryDeleted: (id) => searchImpl && searchImpl.entryDeleted(id),
  reset: () => searchImpl && searchImpl.reset(),
};
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

// shown on every page while this browser's storage does not answer
const STORAGE_DOWN = {
  'zh-TW': '這個裝置現在無法儲存，新的紀錄關掉後不會留下。請稍後重新整理再試一次。',
  en: 'Entries cannot be saved on this device right now, so new ones will be gone when you close the app. Please reload and try again later.',
};

// Today depends on the clock: the bedtime card comes in the evening and the prompt changes with
// the date. Returns true when either changed since the last look.
function clockChanged() {
  const day = localDate();
  const evening = isEvening();
  if (day === state.clockDay && evening === state.clockEvening) return false;
  if (state.clockDay && day !== state.clockDay) state.promptIndex = promptOfDay(getLang()).index;
  state.clockDay = day;
  state.clockEvening = evening;
  return true;
}

// An app left open is brought up to date only while nothing is going on: never while
// recording, with a sheet open, with text typed, or in the middle of a ritual or exercise.
function refreshWithClock() {
  if (document.visibilityState === 'hidden' || !isIdle()) return;
  if (state.storageDown) {
    // storage may answer again later; a reload then brings the saved entries back
    db.getSetting('lang', null).then(
      () => isIdle() && location.reload(),
      () => {}
    );
  }
  if (clockChanged()) render();
}

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
  settleLensImport();
  const views = { today: viewToday, journal: viewJournal, trends: viewTrends, lens: lensView ? lensView.view : lensLoading, about: viewAbout };
  const section = views[state.tab]();
  if (state.storageDown) section.prepend(h('p', { class: 'demo-banner', role: 'note', 'data-key': 'storage-down' }, STORAGE_DOWN[getLang()] || STORAGE_DOWN['zh-TW']));
  main.appendChild(section);
  // the bedtime ritual dims the whole screen, header and tabs included, whatever the system theme
  const night = state.tab === 'today' && nightView.active();
  document.documentElement.classList.toggle('night-mode', night);
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
          // tapping the tab you are on goes back to its top page, as phone apps do
          onclick: (e) => {
            if (state.tab !== tab) return;
            e.preventDefault();
            if (tab === 'lens' && lensView && !lensView.active()) lensView.reset();
            render();
            window.scrollTo(0, 0);
          },
          'aria-current': state.tab === tab ? 'page' : null,
        },
        h('span', { class: `tab-icon icon-${tab}`, 'aria-hidden': 'true' }),
        h('span', { class: 'tab-label' }, t('tab' + tab[0].toUpperCase() + tab.slice(1)))
      )
    );
  }
  enhanceRadios(main);
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
    if (state.tab === 'today' && nightView.busy()) nightView.stopAll();
    state.tab = tab;
    if (isIdle()) clockChanged();
    render();
    window.scrollTo(0, 0);
  } else if (TABS.includes(tab)) {
    render();
  }
}

async function init() {
  // read everything at once rather than one setting after another, so Today appears sooner
  const get = (k, d) => db.getSetting(k, d).catch(() => d);
  const [savedLang, keepAudio, welcomed, lastBackup, installNoted, aiEnabled, aiKey, aiModel, entries] = await Promise.all([
    get('lang', null),
    get('keepAudio', true),
    get('welcomed', false),
    get('lastBackup', 0),
    get('installNoted', false),
    get('aiEnabled', false),
    get('aiKey', ''),
    get('aiModel', AI_MODELS[0].id),
    db.listEntries().catch((e) => {
      if (e && e.message === 'blocked') setTimeout(() => toast(t('dbBlocked')), 300);
      // storage never answered: go on with what is in memory and say so on the page
      if (e && e.message === 'timeout') state.storageDown = true;
      return [];
    }),
  ]);
  setLang(savedLang || detectLang());
  state.keepAudio = keepAudio;
  state.welcomed = welcomed === true;
  state.lastBackup = lastBackup;
  state.installNoted = installNoted === true;
  state.aiEnabled = aiEnabled === true;
  state.aiKeySet = !!aiKey;
  state.aiModel = aiModel;
  state.entries = entries;
  // 換角度 sessions and nights hold the person's own words too, so they count toward the
  // backup note; read in the background and picked up on the next render
  Promise.all([db.listLensSessions(), db.listNights()])
    .then(([sessions, nights]) => (state.writtenCount = sessions.length + nights.length))
    .catch(() => {});
  state.promptIndex = promptOfDay(getLang()).index;
  clockChanged();
  const tab = location.hash.replace('#', '');
  state.tab = TABS.includes(tab) ? tab : 'today';
  if (tab === 'entry') history.replaceState(null, '', '#today');
  if (tab.startsWith('ask=')) {
    state.askIndex = parseAsk(tab);
    state.tab = 'today';
    history.replaceState(null, '', '#today');
  }
  window.addEventListener('hashchange', onHash);
  // leaving the app mid-recording ends the recording (iOS silences the microphone in the background)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return refreshWithClock();
    if (state.phase !== 'recording' || !state.recorder) return;
    state.recorder.elapsed() >= MIN_SECONDS ? stopRecording(true) : cancelRecording();
  });
  setInterval(refreshWithClock, 60 * 1000);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#sheet').hidden) {
      if (location.hash === '#entry') history.back();
      else closeDetailUI();
    }
  });
  render();
  // on localhost the worker is off unless a test asks for it (?sw), so development reloads stay fresh
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || new URLSearchParams(location.search).has('sw'))) setupUpdates();
  // search is not needed for the first screen; fetch it when the browser is idle
  (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => {
    loadSearch();
    loadLens().catch(() => {});
  });
}

// A new release waits until the app is reopened and idle, then reloads once, so a page never
// mixes files from two releases and nothing being typed or played is interrupted.
function isIdle() {
  const typed = [...document.querySelectorAll('textarea, input[type="text"], input[type="search"], input[type="password"]')].some((el) => el.value.trim());
  return state.phase === 'idle' && !nightView.busy() && !(lensView && lensView.active()) && $('#sheet').hidden && !typed;
}

async function setupUpdates() {
  let reg;
  try {
    reg = await navigator.serviceWorker.register('./sw.js');
  } catch (_) {
    return;
  }
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  let pending = false;
  const reloadIfIdle = () => {
    if (!pending || reloading || !isIdle()) return;
    reloading = true;
    location.reload();
  };
  // Another tab may have applied the update; this tab reloads only once it is idle too.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install: nothing to reload
    pending = true;
    reloadIfIdle();
  });
  const applyIfIdle = () => {
    if (reg.waiting && navigator.serviceWorker.controller && isIdle()) reg.waiting.postMessage('skip-waiting');
  };
  // a newly installed worker can be applied right away if the page is idle
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    if (w) w.addEventListener('statechange', () => w.state === 'installed' && applyIfIdle());
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    reloadIfIdle();
    reg.update().catch(() => {}).finally(applyIfIdle);
  });
  window.addEventListener('hashchange', () => setTimeout(reloadIfIdle, 0));
  applyIfIdle();
}

init();
