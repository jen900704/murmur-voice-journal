// Bedtime postcards, drawn procedurally so every night looks a little different: a flat
// print in two spot inks on paper (or on night paper), with the same layout as the scene card.
import { readScene, sceneSvg, printCard, print } from './scene.js';

// Original motifs only (sleepy moon, cloud, sprout, teacup, stars, bun, cat, lamp). Exported as PNG.
const { PAPER, NIGHT, AO, MOMO, EGG, MOSS, tint, circ, box, half, line, fillWith, OBJ, PAL_CREATURE, G, ARCH, words, n } = print;

const PALETTES = [
  { a: AO, b: EGG, c: MOSS, sky: tint(AO, 0.13) },
  { a: MOMO, b: EGG, c: '#FF6A3D', sky: tint(MOMO, 0.12) },
  { a: MOSS, b: EGG, c: '#5E8F2E', sky: tint(MOSS, 0.12) },
  { a: AO, b: MOMO, c: '#5B3B9E', sky: tint(MOMO, 0.1) },
  { paper: NIGHT, ink: PAPER, a: MOSS, b: EGG, c: '#8AB84A', sky: '#20264A' },
  { paper: NIGHT, ink: PAPER, a: MOMO, b: EGG, c: '#FF6A3D', sky: '#20264A' },
].map((x) => ({ paper: PAPER, ink: '#1B1F3B', ...x }));

function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Rough width of Latin text in ems at weight 600 (a CJK character is one em).
function ems(str) {
  let sum = 0;
  for (const ch of str) sum += /[MW@%mw]/.test(ch) ? 0.95 : /[A-Z0-9]/.test(ch) ? 0.7 : /[\s.,:;'|!iljtf]/.test(ch) ? 0.34 : 0.58;
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

// The text column is 228 wide and has room for 280 of height from the first baseline down.
// Font sizes to try, largest first; each comes with its line height.
const FIT = [
  { size: 28, lh: 40 },
  { size: 24, lh: 34 },
  { size: 21, lh: 30 },
  { size: 18, lh: 26 },
  { size: 16, lh: 23 },
  { size: 14, lh: 20 },
];
const TEXT_W = 228;
const TEXT_H = 280;

// Pick the largest font at which the whole text fits the card (the kind-thing field allows
// 120 characters). Only when even the smallest does not fit is the text cut, with an ellipsis.
export function fitText(text) {
  let fit = null;
  const at = (f) => {
    const lines = wrap(text, Math.floor(TEXT_W / f.size));
    return { ...f, lines, maxLines: Math.floor((TEXT_H - f.size) / f.lh) + 1 };
  };
  for (let i = 0; i < FIT.length; i++) {
    fit = at(FIT[i]);
    if (fit.lines.length > fit.maxLines) continue;
    // one size down is fine when it saves a line, as long as the type stays large
    const next = FIT[i + 1] && FIT[i + 1].size >= 21 ? at(FIT[i + 1]) : null;
    return next && next.lines.length < fit.lines.length ? next : fit;
  }
  const last = [...fit.lines[fit.maxLines - 1]];
  fit.lines = fit.lines.slice(0, fit.maxLines);
  fit.lines[fit.maxLines - 1] = last.slice(0, -1).join('').trimEnd() + '…';
  return fit;
}

const sleepyEyes = (p, x, y, s) => line(p, `M${n(x - s * 1.3)} ${n(y)} q${n(s * 0.3)} ${n(s * 0.3)} ${n(s * 0.6)} 0 M${n(x + s * 0.7)} ${n(y)} q${n(s * 0.3)} ${n(s * 0.3)} ${n(s * 0.6)} 0`, Math.max(1.6, s * 0.2));
const star4 = (x, y, k) => `<path d="M${n(x)} ${n(y - k)} L${n(x + k * 0.28)} ${n(y - k * 0.28)} L${n(x + k)} ${n(y)} L${n(x + k * 0.28)} ${n(y + k * 0.28)} L${n(x)} ${n(y + k)} L${n(x - k * 0.28)} ${n(y + k * 0.28)} L${n(x - k)} ${n(y)} L${n(x - k * 0.28)} ${n(y - k * 0.28)}Z"/>`;
const ink = (p) => (p.paper === NIGHT ? { ...p, ink: '#1B1F3B' } : p);

// Each motif returns { parts (for the print), front (drawn over it) } around the ground line.
const MOTIFS = {
  moon: (p) => ({
    parts: [{ b: circ(150, 190, 70), k: fillWith(p.sky, circ(186, 160, 60)) }],
    front: sleepyEyes(ink(p), 112, 218, 8) + `<g fill="${p.ink}" font-family="sans-serif"><text x="212" y="236" font-size="20">z</text><text x="230" y="216" font-size="14">z</text></g>`,
  }),
  cloud: (p) => ({ parts: [], front: PAL_CREATURE.cloudlet(p, 148, 352, 64) }),
  sprout: (p) => ({ parts: [], front: PAL_CREATURE.sprout(p, 148, 352, 58) }),
  teacup: (p) => {
    const t = OBJ.tea(p, 148, G, 104);
    return { parts: [t], front: sleepyEyes(ink(p), 148, G - 38, 9) };
  },
  stars: (p) => ({
    parts: [{ b: star4(148, 196, 62) + star4(226, 122, 18) + star4(70, 140, 14) }],
    front: sleepyEyes(ink(p), 148, 200, 7),
  }),
  bun: (p) => ({ parts: [], front: PAL_CREATURE.bun(p, 148, 352, 62) }),
  cat: (p) => ({ parts: [], front: PAL_CREATURE.cat(p, 148, 352, 60) }),
  lamp: (p) => ({ parts: [], front: PAL_CREATURE.lamp(p, 148, 352, 104) }),
};

// Build the postcard SVG.
// line: the main text (usually the person's own "kind thing" or a closing line)
// label: a small heading beside it; date: shown at the bottom
export function postcardSvg({ seed, line: text, label, date, brand = 'Murmur' }) {
  const r = rng(seed);
  // ids must be unique when several postcards are inline on one page
  const uid = 'pc' + Math.floor(r() * 1e9).toString(36);
  const p = PALETTES[Math.floor(r() * PALETTES.length)];
  const motifNames = Object.keys(MOTIFS);
  const motif = motifNames[Math.floor(r() * motifNames.length)];
  const m = MOTIFS[motif](p);
  const L = ARCH.x;
  // the land, a small moon unless the moon is the picture, and a few stars
  const land = { a: box(L - 4, G, ARCH.w + 8, ARCH.b - G + 4) + half(L + 54, G, 64) };
  const sky = { b: '', k: '' };
  if (motif !== 'moon') {
    sky.b += circ(222, 92, 20);
    sky.k += fillWith(p.sky, circ(231, 85, 17));
  }
  for (let i = 0; i < 5; i++) sky.b += circ(52 + r() * 150, 70 + r() * 90, 1.6 + r() * 1.6);
  return printCard(p, {
    uid,
    passes: [[land, sky, ...m.parts]],
    front: m.front,
    // the postcard sits beside its own text in the app, so it is not announced as a picture
    img: false,
    words: words(p, { line: text, label, caption: 'good night', date, brand, fitText }),
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
