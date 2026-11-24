// Mumu (姆姆), Murmur's small companion: a cloud-mochi with a sprout on its head. An original
// character drawn for Murmur. It never speaks for the person and never judges; it only
// reacts: idle, listening while they type, thinking while something loads, happy when
// something is done, sleepy at night.
//
// Two drawings of the same character (圓方, circle and square):
//   solid  a white body built from three circles and a rounded block, two big 朱 cheeks,
//          ink eyes, a two-leaf sprout. It needs a colour behind it, so it is used only on
//          colour blocks (Today, the question header, the summary's 黃 circle, bedtime).
//   line   one even ink line with a single 朱 dot on the right cheek. Used on plain paper
//          (the worry screens, journal, about, sheets), where it stays quiet beside writing.
// Never both on one screen. mascot(state, { variant }) picks one; the default is 'line'.
//
// mascotSvg(state, variant) returns an SVG string; mascot() returns a <span> that can be
// switched with setMascot(el, state), which keeps the variant. All motion lives in
// css/style.css under "Mumu", inside prefers-reduced-motion, so the character stays still
// for people who ask.

const LINE_BODY = 'M24 80 C6 80 6 58 20 54 C16 38 34 28 46 36 C52 20 78 20 82 38 C96 30 112 44 102 58 C116 62 114 80 96 80 Q60 86 24 80 Z';

export const MASCOT_STATES = ['idle', 'listen', 'think', 'happy', 'sleepy'];
export const MASCOT_VARIANTS = ['line', 'solid'];

const SPROUT_ROT = { idle: 0, listen: 14, think: -8, happy: 6, sleepy: -38 };

function solidSvg(s) {
  const face = {
    idle: '<g class="mumu-eyes"><circle cx="49" cy="60" r="4"/><circle cx="73" cy="60" r="4"/></g><path class="mm-ink" d="M56 67 a5 5 0 0 0 10 0z"/>',
    listen: '<g class="mumu-eyes"><circle cx="49" cy="60" r="5"/><circle cx="73" cy="60" r="5"/></g><circle class="mm-ink" cx="61" cy="69" r="3"/>',
    think: '<g class="mumu-eyes"><circle cx="52" cy="57" r="4"/><circle cx="76" cy="57" r="4"/></g><rect class="mm-ink" x="57" y="68" width="9" height="3"/>',
    happy: '<g class="mumu-eyes"><path d="M44 62 a5 5 0 0 1 10 0z"/><path d="M68 62 a5 5 0 0 1 10 0z"/></g><path class="mm-ink" d="M54 66 a7 7 0 0 0 14 0z"/>',
    sleepy: '<g class="mumu-eyes"><rect x="44" y="59" width="10" height="3"/><rect x="68" y="59" width="10" height="3"/></g><circle class="mm-ink" cx="61" cy="69" r="2"/>',
  }[s];
  const extra = {
    idle: '',
    listen: '<g class="mumu-arcs"><path class="mm-arc-a" d="M108 30 A14 14 0 0 1 108 58"/><path class="mm-arc-b" d="M114 22 A22 22 0 0 1 114 66"/></g>',
    think: '<g class="mumu-dots"><rect class="mm-on" x="97" y="24" width="5" height="5"/><rect class="mm-pink" x="104" y="12" width="8" height="8"/><rect class="mm-sun" x="110" y="-8" width="12" height="12"/></g>',
    happy: '<g class="mumu-sparks"><path class="mm-sun" d="M108 2 L112 12 L122 16 L112 20 L108 30 L104 20 L94 16 L104 12Z"/><circle class="mm-pink" cx="12" cy="32" r="5"/></g>',
    sleepy: '<g class="mumu-z"><path class="mm-sun" d="M116 4 A12 12 0 1 0 122 24 A9.5 9.5 0 0 1 116 4Z"/></g>',
  }[s];
  return `<svg class="mumu-svg" viewBox="0 -12 124 104" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <g class="mumu-body-g">
    <g class="mumu-sprout" transform="rotate(${SPROUT_ROT[s]} 62 20)"><path class="mumu-leaf" d="M62 20 A15 15 0 0 1 47 5 A15 15 0 0 1 62 20Z"/><path class="mumu-leaf" d="M62 20 A12 12 0 0 0 74 8 A12 12 0 0 0 62 20Z"/></g>
    <g class="mm-body"><circle cx="36" cy="54" r="20"/><circle cx="61" cy="43" r="24"/><circle cx="88" cy="56" r="19"/><rect x="16" y="54" width="91" height="29" rx="14.5"/></g>
    <circle class="mm-cheek" cx="38" cy="69" r="6"/><circle class="mm-cheek" cx="84" cy="69" r="6"/>
    ${face}
  </g>
  ${extra}
</svg>`;
}

function lineSvg(s) {
  const face = {
    idle: '<g class="mumu-eyes"><circle cx="48" cy="60" r="2.2"/><circle cx="72" cy="60" r="2.2"/></g><path class="mm-stroke" d="M56 66 q4 4 8 0"/>',
    listen: '<g class="mumu-eyes"><circle cx="48" cy="59" r="3"/><circle cx="72" cy="59" r="3"/></g><ellipse class="mm-ink" cx="60" cy="68" rx="2.2" ry="2.6"/>',
    think: '<g class="mumu-eyes"><circle cx="51" cy="57" r="2.2"/><circle cx="75" cy="57" r="2.2"/></g><path class="mm-stroke" d="M57 68 h7"/>',
    happy: '<g class="mumu-eyes mm-stroke"><path d="M43.5 61.5 q4.5 -6.5 9 0"/><path d="M67.5 61.5 q4.5 -6.5 9 0"/></g><path class="mm-ink mm-stroke" d="M54.5 65.5 q5.5 8 11 0 z"/>',
    sleepy: '<g class="mumu-eyes mm-stroke"><path d="M43.5 59 q4.5 4.5 9 0"/><path d="M67.5 59 q4.5 4.5 9 0"/></g><path class="mm-stroke" d="M58 67.5 h4"/>',
  }[s];
  const extra = {
    idle: '',
    listen: '<g class="mumu-arcs mm-stroke"><path d="M110 36 q6 8 0 16"/><path d="M116 31 q9 13 0 26"/></g>',
    think: '<g class="mumu-dots"><circle class="mm-ink" cx="100" cy="27" r="1.6"/><circle class="mm-ink" cx="108" cy="17" r="2.2"/><circle class="mm-stroke" cx="116" cy="5" r="4.5"/></g>',
    happy: '<g class="mumu-sparks mm-stroke"><path d="M108 10 v12 M102 16 h12"/><path d="M12 30 v8 M8 34 h8"/></g>',
    sleepy: '<g class="mumu-z mm-stroke"><path d="M101 23 h8 l-8 8 h8"/><path d="M113 8 h5 l-5 5 h5"/></g>',
  }[s];
  return `<svg class="mumu-svg" viewBox="0 -12 124 104" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <g class="mumu-body-g">
    <g class="mumu-sprout mm-stroke" transform="rotate(${SPROUT_ROT[s]} 63 25)"><path d="M63 26 Q62 19 64 12"/><path class="mumu-leaf" d="M64 13 C56 15 49 11 47 4 C55 1 62 5 64 13Z"/><path class="mumu-leaf" d="M64 12 C70 13 77 9 79 2 C72 0 65 4 64 12Z"/></g>
    <path class="mm-body mm-stroke" d="${LINE_BODY}"/>
    ${face}
    <circle class="mm-cheek" cx="82" cy="68" r="3.2"/>
  </g>
  ${extra}
</svg>`;
}

export function mascotSvg(state = 'idle', variant = 'line') {
  const s = MASCOT_STATES.includes(state) ? state : 'idle';
  return variant === 'solid' ? solidSvg(s) : lineSvg(s);
}

export function mascot(state = 'idle', { size = 72, label = '', variant = 'line' } = {}) {
  const el = document.createElement('span');
  const v = MASCOT_VARIANTS.includes(variant) ? variant : 'line';
  el.className = `mumu mumu--${state} mumu-v-${v}`;
  el.style.setProperty('--mumu-size', `${size}px`);
  if (label) {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
  } else el.setAttribute('aria-hidden', 'true');
  el.dataset.state = state;
  el.dataset.variant = v;
  el.innerHTML = mascotSvg(state, v);
  return el;
}

export function setMascot(el, state) {
  if (!el || el.dataset.state === state) return;
  const v = el.dataset.variant === 'solid' ? 'solid' : 'line';
  el.dataset.state = state;
  el.className = `mumu mumu--${state} mumu-v-${v}`;
  el.innerHTML = mascotSvg(state, v);
}

// Which state fits the hour: sleepy late at night, otherwise idle.
export function restingState(date = new Date()) {
  const h = date.getHours();
  return h >= 23 || h < 5 ? 'sleepy' : 'idle';
}
