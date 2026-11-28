// One icon family for the whole app (圓方, circle and square): 24 x 24. Each icon is one solid
// mass in the current text colour (class m), built from circles, blocks and straight cuts.
// Details inside the mass are knocked out in the ground colour (k is a 2 px square-capped
// line, kf a fill; the ground comes from --ic-ground, the page colour by default). Details
// outside the mass are 2.2 px square-capped lines in the text colour (o). Exactly one accent
// dot (d): 黃 by default, set by --ic-dot. Nothing else in the interface draws icons, and no
// emoji is used as an icon, so every symbol matches. Mumu (js/mascot.js) and the card scenes
// (js/scene.js) are illustrations, not icons.

const P = {
  // tools
  breathe: '<path class="o" d="M20.5 12a8.5 8.5 0 1 1-17 0a8.5 8.5 0 1 1 17 0"/><circle class="m" cx="12" cy="12" r="4.8"/><circle class="d" cx="12" cy="12" r="1.9"/>',
  calm: '<rect class="m" x="3" y="6.5" width="18" height="11" rx="5.5"/><path class="k" d="M7 12q1.25-3 2.5 0t2.5 0t2.5 0t2.5 0"/><circle class="d" cx="19.5" cy="4" r="1.9"/>',
  write: '<path class="m" d="M4.5 19.5L6 14.5l9-9L18.5 9l-9 9z"/><path class="k" d="M13 7.5l3.5 3.5"/><path class="o" d="M12.5 19.5H16"/><circle class="d" cx="19.6" cy="19.5" r="1.8"/>',
  moon: '<path class="m" d="M14.5 4A8.5 8.5 0 1 0 20 15.5A7 7 0 0 1 14.5 4z"/><circle class="d" cx="19" cy="6" r="2"/>',
  mic: '<rect class="m" x="9" y="3" width="6" height="11" rx="3"/><path class="o" d="M6 11a6 6 0 0 0 12 0M12 17v4"/><circle class="d" cx="12" cy="7" r="1.6"/>',
  lens: '<circle class="m" cx="9" cy="12" r="6"/><path class="o" d="M21 12a6 6 0 1 1-12 0a6 6 0 1 1 12 0"/><circle class="d" cx="17.5" cy="12" r="2"/>',
  // kinds of worry
  work: '<rect class="m" x="3.5" y="8" width="17" height="12" rx="2"/><path class="o" d="M9 8V5h6v3"/><path class="k" d="M3.5 13.5h17"/><circle class="d" cx="12" cy="13.5" r="1.9"/>',
  relationship: '<path class="m" d="M12 20s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/><circle class="d" cx="12" cy="12" r="1.9"/>',
  family: '<path class="m" d="M3.5 11.5L12 4l8.5 7.5V20h-17z"/><rect class="kf" x="10" y="14" width="4" height="6"/><circle class="d" cx="12" cy="10" r="1.7"/>',
  self: '<path class="o" d="M12 20v-7M7.5 20h9"/><path class="m" d="M12 12c0-4-3-6.5-7-6.5 0 4 3 6.5 7 6.5zM12 14c0-3.5 3-6 7-6 0 3.5-3 6-7 6z"/><circle class="d" cx="18.5" cy="17.5" r="1.7"/>',
  loss: '<path class="m" d="M6 18C6 10 11 5 19 5c0 8-5 13-13 13z"/><path class="k" d="M7 17l6-6"/><path class="o" d="M4 20l1.5-1.5"/><circle class="d" cx="18.5" cy="18.5" r="1.8"/>',
  other: '<path class="m" d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z"/><path class="k" d="M8 10.5h.01M16 10.5h.01"/><circle class="d" cx="12" cy="10.5" r="1.7"/>',
  // lens home
  deck: '<path class="o" d="M4.5 7.5v10A2.5 2.5 0 0 0 7 20h8"/><rect class="m" x="7.5" y="3.5" width="11" height="14" rx="2"/><circle class="d" cx="13" cy="8.5" r="1.9"/>',
  compass: '<circle class="m" cx="12" cy="12" r="8.5"/><path class="kf" d="M15.8 8.2l-2.2 5.4-5.4 2.2 2.2-5.4z"/><circle class="d" cx="12" cy="12" r="1.5"/>',
  bookmark: '<path class="m" d="M6.5 3.5h11v17L12 16.5l-5.5 4z"/><circle class="d" cx="12" cy="9" r="1.9"/>',
  gentle: '<path class="m" d="M3.5 5.5h7.5a2 2 0 0 1 1 .3 2 2 0 0 1 1-.3h7.5V18.5h-7.5a2 2 0 0 0-1 .3 2 2 0 0 0-1-.3H3.5z"/><path class="k" d="M12 7v10"/><circle class="d" cx="16.5" cy="10" r="1.7"/>',
  // heaviness, light to heavy
  sun: '<path class="o" d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/><circle class="m" cx="12" cy="12" r="4.6"/><circle class="d" cx="12" cy="12" r="1.8"/>',
  partly: '<circle class="d" cx="8.5" cy="8.5" r="4.2"/><path class="m" d="M8 19.5a3.5 3.5 0 0 1 .4-7 5 5 0 0 1 9.4 1.4A3 3 0 0 1 17.5 19.5z"/>',
  cloud: '<path class="m" d="M7 18a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.4 1.6A3.3 3.3 0 0 1 17.5 18z"/><circle class="d" cx="18.5" cy="6.5" r="1.8"/>',
  rain: '<path class="m" d="M7 14.5a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.4 1.6A3.3 3.3 0 0 1 17.5 14.5z"/><path class="o" d="M8.5 17.5l-1 3M16.5 17.5l-1 3"/><circle class="d" cx="12" cy="19" r="1.7"/>',
  storm: '<path class="m" d="M7 14.5a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.4 1.6A3.3 3.3 0 0 1 17.5 14.5z"/><path class="o" d="M7.5 17.5l-.8 2.5M17.5 17.5l-.8 2.5"/><path class="d" d="M13.2 13.5l-3.4 4.3h2.4l-1.4 3.7 4.4-5h-2.5l1.5-3z"/>',
  // rating faces, 1 to 5
  face1: '<circle class="m" cx="12" cy="12" r="8.5"/><path class="k" d="M9 9.5h.01M15 9.5h.01"/><path class="k" d="M9 15.5h6"/><circle class="d" cx="17.2" cy="13.6" r="1.6"/>',
  face2: '<circle class="m" cx="12" cy="12" r="8.5"/><path class="k" d="M9 9.5h.01M15 9.5h.01"/><path class="k" d="M9.5 15a3.5 3.5 0 0 0 5 0"/><circle class="d" cx="17.2" cy="13.6" r="1.6"/>',
  face3: '<circle class="m" cx="12" cy="12" r="8.5"/><path class="k" d="M9 9.5h.01M15 9.5h.01"/><path class="k" d="M8.5 14a4.5 4.5 0 0 0 7 0"/><circle class="d" cx="17.2" cy="13.6" r="1.6"/>',
  face4: '<circle class="m" cx="12" cy="12" r="8.5"/><path class="k" d="M8 10.5q1-1.5 2 0M14 10.5q1-1.5 2 0"/><path class="kf" d="M8 13.5h8a4 4 0 0 1-8 0z"/><circle class="d" cx="12" cy="15.3" r="1.5"/>',
  face5: '<circle class="m" cx="11.5" cy="12.5" r="8.5"/><path class="k" d="M7.5 11q1-1.5 2 0M13.5 11q1-1.5 2 0"/><path class="kf" d="M7 13.5h9a4.5 4.5 0 0 1-9 0z"/><path class="d" d="M20 1.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>',
  // the language mirror: a round glass with one line of words in it
  mirror: '<circle class="m" cx="10.5" cy="10.5" r="7.5"/><path class="k" d="M7 10.5h7"/><path class="o" d="M16.5 16.5l4 4"/><circle class="d" cx="19.5" cy="5" r="1.9"/>',
  // small utility
  lock: '<path class="o" d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><rect class="m" x="5.5" y="10.5" width="13" height="10" rx="2"/><circle class="d" cx="12" cy="15.5" r="1.9"/>',
  close: '<path class="o" d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  arrow: '<path class="o" d="M5 12h13M12.5 6l6 6-6 6"/>',
  help: '<circle class="m" cx="12" cy="12" r="8.5"/><path class="k" d="M15.5 12a3.5 3.5 0 1 1-7 0a3.5 3.5 0 1 1 7 0M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5"/><circle class="d" cx="12" cy="12" r="1.6"/>',
  card: '<rect class="m" x="3.5" y="5.5" width="17" height="13" rx="2"/><path class="k" d="M7.5 18.5V13a3 3 0 0 1 6 0v5.5"/><circle class="d" cx="16.5" cy="10" r="1.8"/>',
  // tab bar
  today: '<circle class="m" cx="12" cy="10.5" r="5.5"/><path class="o" d="M3.5 19.5h17"/><circle class="d" cx="12" cy="10.5" r="1.9"/>',
  journal: '<rect class="m" x="5" y="3.5" width="14" height="17" rx="2"/><path class="k" d="M9 8.5h6M9 12.5h4"/><circle class="d" cx="15" cy="16.5" r="1.8"/>',
  trends: '<path class="m" d="M3 20l6-8 4 3.5 6.5-8V20z"/><circle class="d" cx="19.5" cy="5" r="2.1"/>',
  about: '<circle class="m" cx="12" cy="12" r="8.5"/><path class="k" d="M12 11.5v5"/><circle class="d" cx="12" cy="7.8" r="1.7"/>',
};

export const ICON_NAMES = Object.keys(P);

export function iconSvg(name, size = 24) {
  return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${P[name] || P.other}</svg>`;
}

// <span class="icon"> holding the SVG; label makes it an image for screen readers.
export function icon(name, { size = 24, label = '' } = {}) {
  const el = document.createElement('span');
  el.className = `icon icon-${name}`;
  if (label) {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
  } else el.setAttribute('aria-hidden', 'true');
  el.innerHTML = iconSvg(name, size);
  return el;
}

// The solid mass alone as a CSS mask, for the few places drawn from CSS. A mask has one
// colour, so knock-outs and the accent dot are left out.
export function iconDataUri(name) {
  const body = ((P[name] || '').match(/<[a-z]+ class="m"[^>]*\/>/g) || []).join('').replace(/ class="m"/g, '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black'>${body.replace(/"/g, "'")}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`;
}

// Colour-block pictures (圓方): a block bleeds to the screen edges in one spot colour and
// holds two to four pieces, each a circle, a half or quarter circle, or a square. The block
// itself is a <div class="cblock cblock--jade|sun|pink|night"> styled in css/style.css; this
// returns the decorative <svg> placed inside it. Drawn on a 390-wide box and cropped to fit.
const ART = {
  // Today: 黃 sun, an ink quarter circle, a 粉 half circle and a 朱 block on 玉
  today: [330, '<circle fill="#F2B91D" cx="322" cy="200" r="92"/><path fill="#151515" d="M0 330V236A94 94 0 0 1 94 330z"/><path fill="#F4A7B9" d="M214 330a66 66 0 0 1 132 0z"/><rect fill="#EA4B2D" x="346" y="264" width="44" height="66"/>'],
  // 換角度 home: a 黃 half circle, an ink circle and a 玉 block on 粉
  lens: [240, '<path fill="#F2B91D" d="M150 240a110 110 0 0 1 220 0z"/><circle fill="#151515" cx="44" cy="212" r="52"/><rect fill="#0E7C66" x="350" y="150" width="40" height="90"/>'],
  // a question: a quarter circle and a small block; colours follow the block
  'step-sun': [250, '<path fill="#F4A7B9" d="M390 250H250A140 140 0 0 1 390 110z"/><rect fill="#EA4B2D" x="170" y="206" width="56" height="44"/>'],
  'step-pink': [250, '<path fill="#F2B91D" d="M390 250H250A140 140 0 0 1 390 110z"/><rect fill="#151515" x="170" y="206" width="56" height="44"/>'],
  'step-jade': [250, '<path fill="#F2B91D" d="M390 250H250A140 140 0 0 1 390 110z"/><rect fill="#F4A7B9" x="170" y="206" width="56" height="44"/>'],
  // bedtime: a crescent from two circles; a 玉 quarter, a 朱 half circle and a 粉 block below
  night: [330, '<circle fill="#F2B91D" cx="300" cy="120" r="84"/><circle fill="#12173A" cx="268" cy="96" r="74"/><rect fill="#F2B91D" x="120" y="150" width="8" height="8"/><circle fill="#F4A7B9" cx="60" cy="176" r="5"/><path fill="#0E7C66" d="M0 330v-80a80 80 0 0 1 80 80z"/><path fill="#EA4B2D" d="M90 330a105 105 0 0 1 210 0z"/><rect fill="#F4A7B9" x="320" y="276" width="70" height="54"/>'],
  // the evening card on Today: a small crescent and a 朱 half circle
  nightcard: [150, '<circle fill="#F2B91D" cx="330" cy="50" r="40"/><circle fill="#12173A" cx="314" cy="38" r="35"/><path fill="#EA4B2D" d="M250 150a70 70 0 0 1 140 0z"/>'],
};

export function blockArt(kind) {
  const [hgt, body] = ART[kind] || ART.today;
  const el = document.createElement('span');
  el.className = 'cblock-art';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg viewBox="0 0 390 ${hgt}" preserveAspectRatio="xMidYMax slice" focusable="false">${body}</svg>`;
  return el;
}
