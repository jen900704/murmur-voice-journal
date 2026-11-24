// One icon family for the whole app: 24 x 24, one even 1.75 px line in the current text
// colour, printed over one flat spot-ink shape (the "duo" layer) that sits 1.5 px down and
// to the right, like a riso print slightly out of register. The spot colour comes from the
// CSS variable --ink-spot (蛋黃 by default; a context can set 桃 or 青苔). Nothing else in
// the interface draws icons, and no emoji is used as an icon, so every symbol matches.
// Mumu (js/mascot.js) and the card scenes (js/scene.js) are illustrations, not icons.

const P = {
  // tools
  breathe: '<circle class="duo" cx="9" cy="14" r="5"/><circle cx="9" cy="14" r="5"/><circle cx="16.5" cy="7.5" r="3"/><circle cx="18.5" cy="15.5" r="1.6"/>',
  calm: '<path class="duo" d="M3 15c3 0 3-2.5 6-2.5s3 2.5 6 2.5 3-2.5 6-2.5V20H3z"/><path d="M3 15c3 0 3-2.5 6-2.5s3 2.5 6 2.5 3-2.5 6-2.5"/><path d="M3 9.5c3 0 3-2.5 6-2.5s3 2.5 6 2.5 3-2.5 6-2.5"/>',
  write: '<path class="duo" d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  moon: '<path class="duo" d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/><path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>',
  mic: '<rect class="duo" x="8.5" y="3" width="7" height="11" rx="3.5"/><rect x="8.5" y="3" width="7" height="11" rx="3.5"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  lens: '<circle class="duo" cx="12" cy="12" r="4.5"/><ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(120 12 12)"/><circle class="duo solid" cx="12" cy="12" r="1.6"/>',
  // kinds of worry
  work: '<rect class="duo" x="3.5" y="7.5" width="17" height="12" rx="2.5"/><rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 12.5h17"/>',
  relationship: '<path class="duo" d="M12 20s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/><path d="M12 20s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>',
  family: '<path class="duo" d="M4.5 11L12 4.5l7.5 6.5V20h-15z"/><path d="M4.5 11L12 4.5l7.5 6.5V20h-15zM10 20v-5h4v5"/>',
  self: '<path d="M12 20v-8"/><path class="duo" d="M12 12c0-4 -3-6.5-7-6.5 0 4 3 6.5 7 6.5zM12 14c0-3.5 3-6 7-6 0 3.5-3 6-7 6z"/><path d="M12 12c0-4 -3-6.5-7-6.5 0 4 3 6.5 7 6.5zM12 14c0-3.5 3-6 7-6 0 3.5-3 6-7 6z"/><path d="M7.5 20h9"/>',
  loss: '<path class="duo" d="M6 18C6 10 11 5 19 5c0 8-5 13-13 13z"/><path d="M6 18C6 10 11 5 19 5c0 8-5 13-13 13zM6 18l7-7M4 20l2-2"/>',
  other: '<path class="duo" d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z"/><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/>',
  // lens home
  deck: '<rect class="duo" x="7" y="4" width="11" height="15" rx="2"/><rect x="7" y="4" width="11" height="15" rx="2"/><path d="M4.5 7.5v10A2.5 2.5 0 0 0 7 20h8"/>',
  compass: '<circle class="duo" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  bookmark: '<path class="duo" d="M6.5 4h11v16l-5.5-4-5.5 4z"/><path d="M6.5 4h11v16l-5.5-4-5.5 4z"/>',
  gentle: '<path class="duo" d="M4 5.5h7a2 2 0 0 1 1 .3 2 2 0 0 1 1-.3h7V18h-7a2 2 0 0 0-1 .3 2 2 0 0 0-1-.3H4z"/><path d="M4 5.5h7a2 2 0 0 1 1 .3 2 2 0 0 1 1-.3h7V18h-7a2 2 0 0 0-1 .3 2 2 0 0 0-1-.3H4zM12 6v12"/>',
  // heaviness, light to heavy
  sun: '<circle class="duo" cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  partly: '<circle cx="9" cy="9" r="3.2"/><path d="M9 3v1.3M3 9h1.3M4.8 4.8l.9.9M13.2 4.8l-.9.9"/><path class="duo" d="M8 19a3.5 3.5 0 0 1 .4-7 5 5 0 0 1 9.4 1.4A3 3 0 0 1 17.5 19z"/><path d="M8 19a3.5 3.5 0 0 1 .4-7 5 5 0 0 1 9.4 1.4A3 3 0 0 1 17.5 19z"/>',
  cloud: '<path class="duo" d="M7 18a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.4 1.6A3.3 3.3 0 0 1 17.5 18z"/><path d="M7 18a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.4 1.6A3.3 3.3 0 0 1 17.5 18z"/>',
  rain: '<path class="duo" d="M7 14.5a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.4 1.6A3.3 3.3 0 0 1 17.5 14.5z"/><path d="M7 14.5a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.4 1.6A3.3 3.3 0 0 1 17.5 14.5zM9 17.5l-1 2.5M13 17.5l-1 2.5M17 17.5l-1 2.5"/>',
  storm: '<path class="duo" d="M7 14a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.4 1.6A3.3 3.3 0 0 1 17.5 14z"/><path d="M7 14a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.4 1.6A3.3 3.3 0 0 1 17.5 14zM12.5 14l-2 3.5h3l-2 3.5M7.5 17l-.8 2M17 17l-.8 2"/>',
  // rating faces, 1 to 5
  face1: '<circle class="duo" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M9 10h.01M15 10h.01M9 15.5h6"/>',
  face2: '<circle class="duo" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0"/>',
  face3: '<circle class="duo" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M9 10h.01M15 10h.01M8.5 14a4.5 4.5 0 0 0 7 0"/>',
  face4: '<circle class="duo" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M8 10.5q1-1.5 2 0M14 10.5q1-1.5 2 0M8 13.5h8a4 4 0 0 1-8 0z"/>',
  face5: '<circle class="duo" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M8 10.5q1-1.5 2 0M14 10.5q1-1.5 2 0M7.5 13h9a4.5 4.5 0 0 1-9 0z"/><path d="M19.5 4.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
  // small utility
  lock: '<rect class="duo" x="5.5" y="10.5" width="13" height="9.5" rx="2.5"/><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  // tab bar
  today: '<rect class="duo" x="8.5" y="3" width="7" height="11" rx="3.5"/><rect x="8.5" y="3" width="7" height="11" rx="3.5"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  journal: '<rect class="duo" x="4" y="4" width="16" height="16" rx="3"/><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 12.5h8M8 16h5"/>',
  trends: '<path class="duo" d="M3.5 17l5-6 4 4 4-7 4 5v3.5h-17z"/><path d="M3.5 17l5-6 4 4 4-7 4 5"/><path d="M3.5 20.5h17"/>',
  about: '<circle class="duo" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
};

export const ICON_NAMES = Object.keys(P);

export function iconSvg(name, size = 24) {
  const body = (P[name] || P.other).replace(/ class="duo"/g, ' class="duo" transform="translate(1.5 1.5)"');
  return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${body}</svg>`;
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

// The line drawing alone as a CSS mask, for places drawn from CSS (the tab bar). A mask has
// one colour, so the spot-ink layer is left out; solid dots stay.
export function iconDataUri(name) {
  const body = (P[name] || '').replace(/<[a-z]+ class="duo"[^>]*\/>/g, '').replace(/ class="duo solid"/g, " fill='black' stroke='none'");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'>${body.replace(/"/g, "'")}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`;
}
