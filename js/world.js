// Mumu's hill: the small illustrated world behind the loud pages. One place seen at
// different hours and from different distances: a sky with its sun or moon, far hills with
// a little house, a nearer hill with a lamp, and the ground where Mumu sits.
//
// Still 圓方: every piece is a circle, a half circle or a square-cornered block in flat
// colour. What is new is depth: each picture is a stack of layers (sky, far, mid, near)
// and the back ones drift a few pixels as the page scrolls or the pointer moves.
//
// world(kind) returns the decorative element placed inside a .cblock (it replaces
// blockArt() from js/icons.js on those pages). Kinds: 'today' (follows the hour),
// 'lens', 'step-sun' | 'step-pink' | 'step-jade', 'night', 'nightcard'.
//
// Motion: transforms only, one requestAnimationFrame per frame, passive listeners, and
// none of it under prefers-reduced-motion. Twinkle and drift are CSS (css/style.css, "world").

const INK = '#151515';
const WHITE = '#FFFFFF';
const PAPER = '#F6F3EC';
const JADE = '#0E7C66';
const DEEP = '#0A6352'; // 玉 one step down, for a hill behind a hill
const RED = '#EA4B2D';
const SUN = '#F2B91D';
const PINK = '#F4A7B9';
const NAVY = '#12173A';
const DUSKY = '#1D2452'; // the night's far hill
const PITCH = '#0B0F29'; // the night's ground

const n = (v) => Math.round(v * 10) / 10;
const circ = (cx, cy, r, f, extra = '') => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${f}"${extra}/>`;
const box = (x, y, w, hgt, f, extra = '') => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(hgt)}" fill="${f}"${extra}/>`;
// a hill is the top of a big circle
const hill = (cx, top, r, f) => circ(cx, top + r, r, f);
const halfUp = (cx, cy, r, f) => `<path fill="${f}" d="M${n(cx - r)} ${n(cy)}a${r} ${r} 0 0 1 ${2 * r} 0z"/>`;

function cloud(x, y, s, f, drift = '') {
  return `<g transform="translate(${x} ${y})"><g class="w-drift${drift}"><g transform="scale(${s})" fill="${f}"><circle cx="14" cy="14" r="10"/><circle cx="31" cy="11" r="14"/><circle cx="48" cy="16" r="9"/><rect x="4" y="14" width="53" height="11" rx="5.5"/></g></g></g>`;
}

// a four-point glint; i staggers the twinkle
function spark(x, y, r, f, i = 0) {
  return `<path class="w-tw" style="--dl:${n((i * 0.83) % 4)}s" fill="${f}" transform="translate(${x} ${y})" d="M0 ${-r}Q0 0 ${r} 0Q0 0 0 ${r}Q0 0 ${-r} 0Q0 0 0 ${-r}z"/>`;
}
const dot = (x, y, r, f, i = 0) => circ(x, y, r, f, ` class="w-tw" style="--dl:${n((i * 1.37) % 4)}s"`);

function stars(list, f) {
  return list.map(([x, y, r], i) => (r >= 4 ? spark(x, y, r, i % 3 === 1 ? f : PAPER, i) : dot(x, y, r, i % 4 === 2 ? f : PAPER, i))).join('');
}

function tree(x, y, hgt, f, trunk = INK) {
  return box(x - 1.5, y - hgt * 0.5, 3, hgt * 0.5, trunk) + circ(x, y - hgt * 0.72, hgt * 0.36, f);
}

// the little house on the far hill: a block, a half-circle roof, one window
function house(x, y, lit, roof = RED) {
  return box(x - 10, y - 14, 20, 14, lit ? PAPER : WHITE) + halfUp(x, y - 14, 13, roof) + box(x - 3, y - 10, 6, 6, lit ? SUN : INK, lit ? ' class="w-tw" style="--dl:1.1s"' : '');
}

// two leaves, each the meeting of two quarter circles (the same leaf as Mumu's sprout)
function tuft(x, y, f, s = 1) {
  return `<g fill="${f}" transform="translate(${x} ${y}) scale(${s})"><path d="M0 0A9 9 0 0 1 -9 -9A9 9 0 0 1 0 0z"/><path d="M0 0A7 7 0 0 0 7 -7A7 7 0 0 0 0 0z"/></g>`;
}
const flower = (x, y, hgt, f, stem) => box(x - 1, y - hgt, 2, hgt, stem) + circ(x, y - hgt, 4, f);

function lamp(x, base, top, post, globe, lit) {
  return (
    box(x - 3, top, 6, base - top, post) +
    box(x - 9, base - 5, 18, 5, post) +
    box(x - 11, top - 4, 22, 5, post) +
    circ(x, top + 13, 12, globe, lit ? ' class="w-tw w-tw--slow"' : '') +
    box(x - 3, top + 1, 6, 3, post)
  );
}

// a string of lights along one sagging line from a to b (c pulls the sag)
function lights(a, c, b, count, wire, colours, lit) {
  const at = (t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  let out = `<path d="M${a[0]} ${a[1]}Q${c[0]} ${c[1]} ${b[0]} ${b[1]}" fill="none" stroke="${wire}" stroke-width="1.6"/>`;
  for (let i = 0; i < count; i++) {
    const [x, y] = at((i + 0.7) / (count + 0.4));
    const f = colours[i % colours.length];
    out += box(x - 1.5, y, 3, 4, wire) + circ(x, y + 8, 4.6, f, lit ? ` class="w-bulb" style="--dl:${n((i * 0.47) % 2.8)}s"` : '');
  }
  return out;
}

// ---------- the hours of Today ----------
export function timeOfDay(date = new Date()) {
  const hr = date.getHours();
  if (hr >= 5 && hr < 10) return 'dawn';
  if (hr >= 10 && hr < 17) return 'day';
  if (hr >= 17 && hr < 20) return 'dusk';
  return 'night';
}
// which colour block (and so which header text colour) each hour sits on
export const SKY = { dawn: 'pink', day: 'jade', dusk: 'sun', night: 'night' };

const HOURS = {
  dawn: { far: JADE, mid: SUN, near: INK, cloud: WHITE, wire: INK, bulbs: [WHITE, RED, JADE, SUN], globe: WHITE, tuft: JADE },
  day: { far: DEEP, mid: PINK, near: INK, cloud: WHITE, wire: INK, bulbs: [SUN, PINK, WHITE, RED], globe: WHITE, tuft: JADE },
  dusk: { far: PINK, mid: JADE, near: INK, cloud: WHITE, wire: INK, bulbs: [WHITE, RED, PINK, JADE], globe: WHITE, tuft: JADE },
  night: { far: DUSKY, mid: JADE, near: PITCH, cloud: DUSKY, wire: '#8E93B8', bulbs: [SUN, PINK, PAPER, RED], globe: SUN, tuft: JADE },
};

function today(tod) {
  const p = HOURS[tod] || HOURS.day;
  const night = tod === 'night';
  const lit = night || tod === 'dusk';
  const orb = {
    dawn: circ(268, 236, 56, RED),
    day: circ(268, 164, 56, SUN),
    dusk: circ(268, 222, 56, RED),
    night: circ(276, 138, 44, SUN) + circ(258, 124, 40, NAVY),
  }[tod];
  const skyBits = night
    ? stars([[36, 96, 2], [74, 132, 5], [128, 84, 1.6], [176, 110, 2.2], [212, 150, 1.6], [318, 92, 6], [352, 196, 2], [22, 176, 1.8], [150, 168, 4]], SUN)
    : spark(84, 100, 6, tod === 'day' ? SUN : WHITE, 0) + spark(196, 92, 4, WHITE, 2) + spark(346, 104, 5, tod === 'dusk' ? WHITE : tod === 'dawn' ? WHITE : PINK, 3);
  const clouds = cloud(18, 128, 0.9, p.cloud, '') + cloud(296, 84, 0.62, p.cloud, ' w-drift--b');
  return {
    h: 340,
    layers: [
      [0.3, orb + skyBits],
      [0.2, clouds],
      [0.12, hill(70, 214, 230, p.far) + hill(360, 232, 200, p.far) + tree(16, 226, 24, night || tod === 'dusk' ? JADE : tod === 'dawn' ? DEEP : JADE, night ? PITCH : INK)],
      [0.05, hill(300, 244, 260, p.mid) + house(228, 255, lit, tod === 'day' || night ? RED : INK) + tree(312, 250, 22, tod === 'day' ? JADE : tod === 'dawn' ? JADE : DEEP, night ? PITCH : INK) + lamp(350, 250, 128, night ? PITCH : INK, p.globe, lit) + lights([-10, 78], [176, 132], [350, 126], 9, p.wire, p.bulbs, lit)],
      [0, hill(96, 262, 300, p.near) + tuft(228, 281, p.tuft, 1) + flower(250, 286, 14, RED, p.tuft) + flower(262, 290, 9, night ? SUN : PINK, p.tuft) + tuft(22, 272, p.tuft, 0.8)],
    ],
  };
}

// 換角度 home: a 粉 morning with the 黃 sun coming up behind a 玉 hill
function lensHome() {
  return {
    h: 250,
    layers: [
      [0.3, circ(280, 178, 62, SUN) + spark(60, 96, 5, WHITE, 1) + spark(352, 88, 4, WHITE, 2)],
      [0.2, cloud(24, 112, 0.7, WHITE) + cloud(318, 132, 0.5, WHITE, ' w-drift--b')],
      [0.1, hill(330, 178, 190, JADE) + tree(356, 186, 26, DEEP) + tree(338, 184, 16, DEEP) + house(300, 181, false)],
      [0, hill(120, 206, 280, INK) + tuft(52, 214, JADE, 0.9) + flower(300, 232, 12, RED, JADE) + flower(312, 238, 8, SUN, JADE)],
    ],
  };
}

// A question's ticket: a hill and a low sun on the right, where Mumu listens.
function step(hue) {
  const c = {
    sun: { orb: RED, far: PINK, near: INK, glint: WHITE, leaf: JADE },
    pink: { orb: SUN, far: JADE, near: INK, glint: WHITE, leaf: JADE },
    jade: { orb: SUN, far: DEEP, near: INK, glint: SUN, leaf: PINK },
  }[hue] || {};
  return {
    h: 250,
    layers: [
      [0.3, circ(338, 150, 40, c.orb) + spark(214, 96, 5, c.glint, 0) + spark(250, 132, 3.5, c.glint, 2)],
      [0.12, hill(250, 176, 150, c.far)],
      [0, hill(300, 214, 190, c.near) + tuft(214, 232, c.leaf, 0.8) + flower(370, 228, 11, hue === 'sun' ? WHITE : RED, c.leaf)],
    ],
  };
}

// bedtime: the same hill at night. A crescent, stars, two strings of lights, the house lit.
function night(small) {
  if (small) {
    return {
      h: 150,
      layers: [
        [0.3, circ(336, 46, 30, SUN) + circ(324, 36, 27, NAVY) + stars([[30, 30, 1.8], [84, 54, 4], [150, 26, 1.6], [208, 60, 2], [262, 30, 5], [118, 92, 1.6]], SUN)],
        [0.12, hill(90, 104, 200, DUSKY) + house(56, 107, true)],
        [0, hill(290, 112, 220, JADE) + lights([-10, 14], [120, 64], [250, 20], 6, '#8E93B8', [SUN, PINK, PAPER, RED], true)],
      ],
    };
  }
  return {
    h: 320,
    layers: [
      [0.3, circ(312, 82, 46, SUN) + circ(293, 67, 42, NAVY) + stars([[28, 44, 2], [64, 96, 5], [112, 30, 1.6], [150, 76, 2.2], [198, 36, 4], [236, 104, 1.6], [362, 150, 2], [20, 150, 1.8], [96, 150, 1.6], [262, 160, 4], [372, 40, 1.8]], SUN)],
      [0.2, cloud(206, 132, 0.6, DUSKY, ' w-drift--b')],
      [0.12, hill(60, 196, 220, DUSKY) + hill(370, 214, 180, DUSKY) + house(76, 200, true) + tree(108, 204, 26, JADE, PITCH) + tree(40, 204, 18, DEEP, PITCH)],
      [0.05, hill(110, 236, 250, JADE) + lamp(46, 246, 132, PITCH, SUN, true) + lamp(352, 262, 148, PITCH, SUN, true) + lights([46, 130], [196, 196], [352, 146], 9, '#8E93B8', [SUN, PINK, PAPER, RED], true)],
      [0, hill(250, 252, 300, PITCH) + tuft(92, 272, JADE, 0.9) + flower(318, 268, 12, PINK, JADE) + flower(330, 274, 8, SUN, JADE)],
    ],
  };
}

const live = new Set(); // layers on the page that move
let raf = 0;
let px = 0; // pointer, -1 to 1 across the screen
let bound = false;
const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function frame() {
  raf = 0;
  const y = window.scrollY;
  for (const el of live) {
    if (!el.isConnected) {
      live.delete(el);
      continue;
    }
    const d = el._d;
    // sky things stay behind as the page moves up; a pointer nudges them sideways
    el.style.transform = `translate3d(${n(-px * d * 22)}px, ${n(Math.min(y, 420) * d)}px, 0)`;
  }
}
const ask = () => {
  if (!raf && live.size && !still()) raf = requestAnimationFrame(frame);
};

function bind() {
  if (bound || typeof window === 'undefined') return;
  bound = true;
  window.addEventListener('scroll', ask, { passive: true });
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      px = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      ask();
    },
    { passive: true }
  );
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (mq && mq.addEventListener) mq.addEventListener('change', () => {
    if (mq.matches) for (const el of live) el.style.transform = '';
    else ask();
  });
}

export function world(kind, { time = null } = {}) {
  const k = String(kind || 'today');
  const sc = k === 'today' ? today(time || timeOfDay()) : k === 'lens' ? lensHome() : k.startsWith('step-') ? step(k.slice(5)) : k === 'nightcard' ? night(true) : k === 'night' ? night(false) : today('day');
  const el = document.createElement('span');
  el.className = `cblock-art world world--${k}`;
  el.setAttribute('aria-hidden', 'true');
  for (const [d, body] of sc.layers) {
    const layer = document.createElement('span');
    layer.className = 'w-layer' + (body.includes('w-drift') ? ' w-layer--drift' : '');
    // the sky sits behind a ticket's frame; hills and ground come in front of it
    layer.style.zIndex = el.childElementCount ? '2' : '0';
    layer.innerHTML = `<svg viewBox="0 0 390 ${sc.h}" preserveAspectRatio="xMidYMax slice" focusable="false">${body}</svg>`;
    if (d) {
      layer._d = d;
      live.add(layer);
    }
    el.appendChild(layer);
  }
  bind();
  ask();
  return el;
}

// The small rule under a ticket's date: a line, a glint, a line.
export function ornament() {
  const el = document.createElement('span');
  el.className = 'orn';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i></i><svg viewBox="-8 -8 16 16" width="14" height="14" focusable="false"><path fill="currentColor" d="M0 -8Q0 0 8 0Q0 0 0 8Q0 0 -8 0Q0 0 0 -8z"/></svg><i></i>';
  return el;
}
