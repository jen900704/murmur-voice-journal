// Mumu (姆姆), Murmur's small companion: a round cloud-mochi with a sprout on its head, drawn
// flat: one paper-white body with an even ink outline, a 青苔 sprout, ink dot eyes, 桃 cheeks,
// and a solid spot-ink copy of the body printed a little down and to the right behind it.
// An original character drawn for Murmur. It never speaks for the person and never judges;
// it only reacts: idle, listening while they type, thinking while something loads, happy when
// something is done, sleepy at night.
//
// mascotSvg(state) returns an SVG string; mascot(state, { size, label }) returns a <span>
// that can be switched with setMascot(el, state). All motion lives in css/style.css under
// "Mumu", inside prefers-reduced-motion, so the character stays still for people who ask.

const BODY = 'M18 70 C 10 70, 8 56, 17 51 C 14 36, 30 24, 42 29 C 48 19, 66 19, 71 30 C 84 26, 96 38, 90 51 C 99 56, 96 71, 86 71 C 80 84, 26 84, 18 70 Z';

export const MASCOT_STATES = ['idle', 'listen', 'think', 'happy', 'sleepy'];

export function mascotSvg(state = 'idle') {
  const s = MASCOT_STATES.includes(state) ? state : 'idle';
  // eyes per state
  const eyes = {
    idle: '<g class="mumu-eyes"><circle cx="41" cy="54" r="3.4"/><circle cx="63" cy="54" r="3.4"/></g>',
    listen: '<g class="mumu-eyes"><circle cx="43" cy="52" r="3.9"/><circle cx="65" cy="52" r="3.9"/></g>',
    think: '<g class="mumu-eyes"><path d="M37 54 q4 -3 8 0" /><path d="M59 54 q4 -3 8 0" /></g>',
    happy: '<g class="mumu-eyes"><path d="M37 55 q4 -6 8 0" /><path d="M59 55 q4 -6 8 0" /></g>',
    sleepy: '<g class="mumu-eyes"><path d="M37 55 q4 3 8 0" /><path d="M59 55 q4 3 8 0" /></g>',
  }[s];
  const mouth = {
    idle: '<path class="mumu-mouth" d="M49 61 q3 3 6 0"/>',
    listen: '<ellipse class="mumu-mouth-o" cx="52" cy="62" rx="2.4" ry="2"/>',
    think: '<path class="mumu-mouth" d="M49 62 h6"/>',
    happy: '<path class="mumu-mouth-open" d="M47 60 q5 7 10 0 z"/>',
    sleepy: '<path class="mumu-mouth" d="M50 62 q2 1.5 4 0"/>',
  }[s];
  const extra = {
    idle: '',
    listen: '',
    think: '<g class="mumu-dots"><circle cx="86" cy="22" r="3"/><circle cx="95" cy="15" r="3.6"/><circle cx="105" cy="8" r="4.2"/></g>',
    happy: '<g class="mumu-sparks"><circle cx="12" cy="29" r="4.5"/><path d="M88 18 a5 5 0 0 1 10 0z"/><circle cx="99" cy="56" r="3"/></g>',
    sleepy: '<g class="mumu-z"><text x="80" y="26">z</text><text x="90" y="14">z</text></g>',
  }[s];
  return `<svg class="mumu-svg" viewBox="0 0 112 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <g class="mumu-body-g">
    <path class="mumu-block" transform="translate(4 4)" d="${BODY}"/>
    <g class="mumu-sprout"><path d="M52 24 v-9" /><path class="mumu-leaf" d="M52 17 c-3 -9 -12 -9 -13 -3 c4 3 9 4 13 3z"/><path class="mumu-leaf" d="M52 15 c3 -9 13 -10 14 -4 c-4 3 -10 5 -14 4z"/></g>
    <path class="mumu-body" d="${BODY}"/>
    <circle class="mumu-cheek" cx="33" cy="63" r="4"/>
    <circle class="mumu-cheek" cx="71" cy="63" r="4"/>
    ${eyes}
    ${mouth}
    <path class="mumu-arm mumu-arm-l" d="M22 66 q-7 2 -8 -4" />
    <path class="mumu-arm mumu-arm-r" d="M82 66 q7 2 8 -4" />
  </g>
  ${extra}
</svg>`;
}

export function mascot(state = 'idle', { size = 72, label = '' } = {}) {
  const el = document.createElement('span');
  el.className = `mumu mumu--${state}`;
  el.style.setProperty('--mumu-size', `${size}px`);
  if (label) {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
  } else el.setAttribute('aria-hidden', 'true');
  el.dataset.state = state;
  el.innerHTML = mascotSvg(state);
  return el;
}

export function setMascot(el, state) {
  if (!el || el.dataset.state === state) return;
  el.dataset.state = state;
  el.className = `mumu mumu--${state}`;
  el.innerHTML = mascotSvg(state);
}

// Which state fits the hour: sleepy late at night, otherwise idle.
export function restingState(date = new Date()) {
  const h = date.getHours();
  return h >= 23 || h < 5 ? 'sleepy' : 'idle';
}
