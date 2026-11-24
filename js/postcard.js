// Bedtime postcards, drawn procedurally so every night looks a little different: a 丙 poster
// of circles, half-circles and blocks on a night ground, with the same layout as the scene card.
import { readScene, sceneSvg, printCard, print } from './scene.js';

// Original motifs only (moon, cloud, sprout, teacup, stars, bun, cat, lamp). Exported as PNG.
const { INK, WHITE, JADE, RED, SUN, PINK, NAVY, circ, box, half, cloudShape, crescent, thing, mumu, FRIEND, PANEL, words } = print;

// ground, the half-circle Mumu sleeps on, the quarter circle at the left, the block at the
// right, and the second colour of the small things
const PALETTES = [
  { ground: NAVY, hill: RED, side: JADE, block: PINK, acc: SUN },
  { ground: NAVY, hill: JADE, side: PINK, block: RED, acc: SUN },
  { ground: NAVY, hill: PINK, side: RED, block: JADE, acc: SUN },
  { ground: NAVY, hill: RED, side: PINK, block: JADE, acc: SUN },
  { ground: JADE, hill: INK, side: PINK, block: RED, acc: SUN },
].map((x) => ({ ...x, cell: x.side, night: true }));

function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Rough width of Latin text in ems at the card's heavy weight (a CJK character is one em).
function ems(str) {
  let sum = 0;
  for (const ch of str) sum += /[MW@%mw]/.test(ch) ? 0.98 : /[A-Z0-9]/.test(ch) ? 0.7 : /[\s.,:;'|!iljtf]/.test(ch) ? 0.36 : 0.6;
  return sum;
}

// Simple line wrapping: CJK text by character count, other text by words and estimated width.
const NO_START = '，。、；：？！）」』〉》,.;:?!)';

export function wrap(text, maxUnits) {
  const s = String(text || '').trim();
  if (!s) return [];
  const isCjk = /[　-鿿＀-￯]/.test(s);
  const lines = [];
  if (isCjk) {
    // short sentences that each fit a line are packed whole, so a line ends where a
    // clause ends
    const clauses = s.match(/[^，。、；：？！,.;:?!]+[，。、；：？！,.;:?!]*/g) || [s];
    if (clauses.length > 1 && clauses.length <= 4 && clauses.every((c) => [...c.trim()].length <= maxUnits)) {
      let cur = '';
      for (const c of clauses.map((x) => x.trim())) {
        if (cur && [...cur].length + [...c].length > maxUnits) {
          lines.push(cur);
          cur = c;
        } else cur += c;
      }
      if (cur) lines.push(cur);
      return lines;
    }
    // even line lengths, so a line never ends with a single character on its own
    const chars = [...s];
    const n = Math.ceil(chars.length / maxUnits);
    const per = Math.ceil(chars.length / n);
    for (let i = 0; i < chars.length; i += per) lines.push(chars.slice(i, i + per).join(''));
    // a comma or full stop never starts a line: it stays at the end of the line before
    for (let i = 1; i < lines.length; i++) {
      while (lines[i] && NO_START.includes(lines[i][0])) {
        lines[i - 1] += lines[i][0];
        lines[i] = lines[i].slice(1);
      }
    }
    if (lines.length > 1 && !lines[lines.length - 1]) lines.pop();
  } else {
    // by estimated width, so a line of capitals does not run off the card
    const cut = (w) => {
      let i = 0;
      for (let sum = 0; i < w.length && (sum += ems(w[i])) <= maxUnits; i++);
      return Math.max(1, i);
    };
    let line = '';
    for (let w of s.split(/\s+/)) {
      // a word wider than a whole line (a pasted link) is cut into line-sized pieces
      while (ems(w) > maxUnits) {
        if (line) lines.push(line);
        line = '';
        const n = cut(w);
        lines.push(w.slice(0, n));
        w = w.slice(n);
      }
      if (!w) continue;
      if (ems((line + ' ' + w).trim()) > maxUnits) {
        lines.push(line);
        line = w;
      } else line = (line + ' ' + w).trim();
    }
    if (line) lines.push(line);
  }
  return lines;
}

// The white panel gives the line PANEL.w of width and 250 of height from the first baseline
// down. Font sizes to try, largest first; each comes with its line height and the most lines
// that still look right at that size (the largest is a title: two lines).
const FIT = [
  { size: 44, lh: 56, most: 2 },
  { size: 38, lh: 49, most: 3 },
  { size: 32, lh: 42, most: 4 },
  { size: 27, lh: 36, most: 6 },
  { size: 23, lh: 31, most: 7 },
  { size: 20, lh: 27, most: 9 },
  { size: 17, lh: 24, most: 10 },
  { size: 15, lh: 21, most: 12 },
];
const TEXT_W = PANEL.w;
const TEXT_H = 250;

// Pick the largest font at which the whole text fits the card (the kind-thing field allows
// 120 characters). Only when even the smallest does not fit is the text cut, with an ellipsis.
export function fitText(text) {
  let fit = null;
  for (const f of FIT) {
    const units = Math.floor(TEXT_W / f.size);
    let lines = wrap(text, units);
    // a comma kept at the end of a full line would hang over the edge: wrap one shorter
    if (lines.some((l) => /[　-鿿＀-￯]/.test(l) && [...l].length > units)) lines = wrap(text, units - 1);
    fit = { size: f.size, lh: f.lh, lines, maxLines: Math.min(f.most, Math.floor((TEXT_H - f.size) / f.lh) + 1) };
    if (lines.length <= fit.maxLines) return fit;
  }
  const last = [...fit.lines[fit.maxLines - 1]];
  fit.lines = fit.lines.slice(0, fit.maxLines);
  fit.lines[fit.maxLines - 1] = last.slice(0, -1).join('').trimEnd() + '…';
  return fit;
}

// What changes from night to night: the size of the moon, and one small thing on the block
// beside Mumu. Each motif returns { moon: [x, y, r], sky, item } in picture units (160 x 240).
const small = [120, 50, 34];
const MOTIFS = {
  moon: () => ({ moon: [112, 66, 44] }),
  stars: () => ({ moon: small, sky: box(22, 30, 12, 12, SUN) + circ(66, 60, 7, PINK) + circ(40, 96, 5, WHITE) + box(96, 92, 8, 8, PINK) + circ(134, 112, 4, SUN) }),
  cloud: () => ({ moon: small, sky: cloudShape(46, 104, 44, WHITE) }),
  teacup: (p) => ({ moon: small, item: thing('tea', p, 142, 204, 32) }),
  sprout: (p) => ({ moon: small, item: thing('plant', p, 142, 204, 34) }),
  bun: () => ({ moon: small, item: half(142, 204, 15, 'up', WHITE) + box(135, 196, 5, 2.2, INK) + box(144, 196, 5, 2.2, INK) + circ(132, 200.5, 2.4, RED) + circ(152, 200.5, 2.4, RED) }),
  cat: (p) => ({ moon: small, item: `<g transform="translate(142 204) scale(.56)">${FRIEND.cat(p)}</g>` }),
  lamp: (p) => ({ moon: small, item: `<g transform="translate(142 204) scale(.74)">${FRIEND.lamp(p)}</g>` }),
};

// Build the postcard SVG.
// line: the main text (usually the person's own "kind thing" or a closing line)
// label: a small heading under it; date: shown at the bottom
export function postcardSvg({ seed, line: text, label, date, brand = 'Murmur' }) {
  const r = rng(seed);
  // ids must be unique when several postcards are inline on one page
  const uid = 'pc' + Math.floor(r() * 1e9).toString(36);
  const p = PALETTES[Math.floor(r() * PALETTES.length)];
  const motifNames = Object.keys(MOTIFS);
  const motif = motifNames[Math.floor(r() * motifNames.length)];
  const m = MOTIFS[motif](p);
  const [mx, my, mr] = m.moon;
  // a few small dots and squares in the sky, away from the moon
  let dots = '';
  if (!m.sky) {
    const marks = [(x, y) => circ(x, y, 3.4, PINK), (x, y) => box(x - 3.2, y - 3.2, 6.5, 6.5, SUN), (x, y) => circ(x, y, 2.6, WHITE)];
    marks.forEach((draw, i) => (dots += draw(16 + i * 22 + r() * 14, 96 + ((i * 37) % 50) + r() * 14)));
  }
  const tall = !!m.item;
  const art =
    crescent(mx, my, mr, SUN, p.ground) + (m.sky || '') + dots +
    `<path d="M0 240 V208 A32 32 0 0 1 32 240Z" fill="${p.side}"/>` +
    half(78, 240, 46, 'up', p.hill) +
    box(124, tall ? 204 : 212, 36, 36, p.block) +
    (m.item || '') +
    // Mumu asleep on the half-circle, her sprout in yellow against the night
    `<g transform="translate(37 151) scale(.66)">${mumu('sleepy', SUN)}</g>`;
  return printCard(p, {
    uid,
    art,
    // the postcard sits beside its own text in the app, so it is not announced as a picture
    img: false,
    words: words(p, { line: text, label, date, brand, fitText }),
  });
}

// Render the SVG to a PNG blob (2x for sharp sharing).
export async function postcardPng(svg, scale = 2) {
  // a still image: drop the card's animation so the picture is drawn in its final state
  svg = String(svg).replace(/<style>[\s\S]*?<\/style>/g, '');
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 600 * scale;
    canvas.height = 400 * scale;
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Share through the phone's share sheet when possible; otherwise download.
export async function sharePng(pngBlob, filename, text) {
  const file = new File([pngBlob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(pngBlob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
  return 'downloaded';
}

// A card whose picture follows what the person wrote. When their words name something
// the scene can draw (tea, a cat, an exam, the sea), the card shows that scene; otherwise
// it falls back to the pastel postcard, with a motif picked from the words when possible.
// texts: the person's own words to draw from (default: the line on the card).
export function cardSvg({ seed, line, label, date, brand = 'Murmur', texts = null, topics = [], lensId = null, shift = null, animate = false }) {
  const scene = readScene({ texts: texts || [line], topics, lensId, shift });
  if (!scene.calm && (scene.objects.length || scene.companion === 'cat' || scene.companion === 'dog' || lensId)) {
    return sceneSvg(scene, { seed, line, label, date, brand, animate, fitText });
  }
  return postcardSvg({ seed, line, label, date, brand });
}
