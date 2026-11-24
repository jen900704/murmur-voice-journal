// Pastel bedtime postcards, drawn procedurally so every night looks a little different.
// Original motifs only (sleepy moon, cloud, sprout, teacup, stars, bun, cat, lamp). Exported as PNG.

const PALETTES = [
  { bg: ['#fde2e4', '#e2ecf9'], ink: '#5b4a6b', soft: '#fff5f7', accent: '#f4a7b9', leaf: '#9cc9a8' },
  { bg: ['#e8f3e8', '#fdf3d7'], ink: '#4f5d4a', soft: '#fbfff8', accent: '#f2c57c', leaf: '#8fbf8f' },
  { bg: ['#e6e1fa', '#fde8d7'], ink: '#4d4a6e', soft: '#fbf9ff', accent: '#f6b8a0', leaf: '#a3c9b7' },
  { bg: ['#dff3f6', '#f1e4f7'], ink: '#3f5866', soft: '#f6fdff', accent: '#c7a6e3', leaf: '#93c7c0' },
  { bg: ['#fff1cf', '#f9dde6'], ink: '#6b4f4a', soft: '#fffaf0', accent: '#f19fb0', leaf: '#b5cf8f' },
  { bg: ['#e3f0ff', '#e9f7e4'], ink: '#3e5270', soft: '#f7fbff', accent: '#9fc3ef', leaf: '#9ccf9a' },
];

function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// Rough width of Latin text in ems at weight 600 (a CJK character is one em).
function ems(str) {
  let sum = 0;
  for (const ch of str) sum += /[MW@%mw]/.test(ch) ? 0.95 : /[A-Z0-9]/.test(ch) ? 0.7 : /[\s.,:;'|!iljtf]/.test(ch) ? 0.34 : 0.58;
  return sum;
}

// Simple line wrapping: CJK text by character count, other text by words and estimated width.
export function wrap(text, maxUnits) {
  const s = String(text || '').trim();
  if (!s) return [];
  const isCjk = /[　-鿿＀-￯]/.test(s);
  const lines = [];
  if (isCjk) {
    // even line lengths, so a line never ends with a single character on its own
    const chars = [...s];
    const n = Math.ceil(chars.length / maxUnits);
    const per = Math.ceil(chars.length / n);
    for (let i = 0; i < chars.length; i += per) lines.push(chars.slice(i, i + per).join(''));
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

// The text column is 240 wide and has room for 200 of height under the label.
// Font sizes to try, largest first; each comes with its line height.
const FIT = [
  { size: 24, lh: 34 },
  { size: 21, lh: 30 },
  { size: 18, lh: 26 },
  { size: 16, lh: 23 },
  { size: 14, lh: 20 },
];
const TEXT_W = 240;
const TEXT_H = 200;

// Pick the largest font at which the whole text fits the card (the kind-thing field allows
// 120 characters). Only when even the smallest does not fit is the text cut, with an ellipsis.
export function fitText(text) {
  let fit = null;
  for (const f of FIT) {
    const lines = wrap(text, Math.floor(TEXT_W / f.size));
    const maxLines = Math.floor((TEXT_H - f.size) / f.lh) + 1;
    fit = { ...f, lines, maxLines };
    if (lines.length <= maxLines) return fit;
  }
  const last = [...fit.lines[fit.maxLines - 1]];
  fit.lines = fit.lines.slice(0, fit.maxLines);
  fit.lines[fit.maxLines - 1] = last.slice(0, -1).join('').trimEnd() + '…';
  return fit;
}

const face = (cx, cy, r, ink, blush) => `
  <path d="M${cx - r * 0.42} ${cy} q${r * 0.14} ${r * 0.14} ${r * 0.28} 0" stroke="${ink}" stroke-width="${r * 0.07}" fill="none" stroke-linecap="round"/>
  <path d="M${cx + r * 0.14} ${cy} q${r * 0.14} ${r * 0.14} ${r * 0.28} 0" stroke="${ink}" stroke-width="${r * 0.07}" fill="none" stroke-linecap="round"/>
  <ellipse cx="${cx - r * 0.42}" cy="${cy + r * 0.22}" rx="${r * 0.12}" ry="${r * 0.07}" fill="${blush}" opacity=".7"/>
  <ellipse cx="${cx + r * 0.42}" cy="${cy + r * 0.22}" rx="${r * 0.12}" ry="${r * 0.07}" fill="${blush}" opacity=".7"/>`;

const MOTIFS = {
  moon: (p, x, y, r, uid = '') => `
    <mask id="${uid}crescent"><circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x + r * 0.55}" cy="${y - r * 0.35}" r="${r * 0.82}" fill="#000"/></mask>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${p.soft}" mask="url(#${uid}crescent)"/>
    ${face(x - r * 0.42, y + r * 0.28, r * 0.6, p.ink, p.accent)}
    <text x="${x + r * 0.75}" y="${y - r * 0.75}" font-size="${r * 0.35}" fill="${p.ink}" opacity=".6" font-family="sans-serif">z</text>
    <text x="${x + r * 1.0}" y="${y - r * 1.05}" font-size="${r * 0.25}" fill="${p.ink}" opacity=".5" font-family="sans-serif">z</text>`,
  cloud: (p, x, y, r) => `
    <g fill="${p.soft}">
      <circle cx="${x - r * 0.6}" cy="${y + r * 0.15}" r="${r * 0.55}"/>
      <circle cx="${x}" cy="${y - r * 0.15}" r="${r * 0.75}"/>
      <circle cx="${x + r * 0.65}" cy="${y + r * 0.15}" r="${r * 0.55}"/>
      <rect x="${x - r * 1.1}" y="${y + r * 0.1}" width="${r * 2.2}" height="${r * 0.6}" rx="${r * 0.3}"/>
    </g>
    ${face(x, y + r * 0.2, r * 0.8, p.ink, p.accent)}`,
  sprout: (p, x, y, r) => `
    <path d="M${x} ${y + r * 0.2} C ${x} ${y - r * 0.2}, ${x} ${y - r * 0.5}, ${x} ${y - r * 0.7}" stroke="${p.leaf}" stroke-width="${r * 0.09}" fill="none" stroke-linecap="round"/>
    <path d="M${x} ${y - r * 0.55} C ${x - r * 0.2} ${y - r * 1.1}, ${x - r * 0.9} ${y - r * 1.0}, ${x - r * 0.85} ${y - r * 0.55} C ${x - r * 0.5} ${y - r * 0.4}, ${x - r * 0.15} ${y - r * 0.45}, ${x} ${y - r * 0.55}Z" fill="${p.leaf}"/>
    <path d="M${x} ${y - r * 0.65} C ${x + r * 0.2} ${y - r * 1.2}, ${x + r * 0.9} ${y - r * 1.1}, ${x + r * 0.85} ${y - r * 0.65} C ${x + r * 0.5} ${y - r * 0.5}, ${x + r * 0.15} ${y - r * 0.55}, ${x} ${y - r * 0.65}Z" fill="${p.leaf}" opacity=".85"/>
    <path d="M${x - r * 0.75} ${y + r * 0.15} h${r * 1.5} l${-r * 0.18} ${r * 0.95} h${-r * 1.14}z" fill="${p.accent}"/>
    ${face(x, y + r * 0.55, r * 0.55, p.ink, p.soft)}`,
  teacup: (p, x, y, r) => `
    <path d="M${x - r * 0.25} ${y - r * 0.55} q${r * 0.12} ${-r * 0.2} 0 ${-r * 0.4} q${-r * 0.12} ${-r * 0.2} 0 ${-r * 0.4}" stroke="${p.ink}" stroke-width="${r * 0.05}" fill="none" opacity=".35" stroke-linecap="round"/>
    <path d="M${x + r * 0.2} ${y - r * 0.55} q${r * 0.12} ${-r * 0.2} 0 ${-r * 0.4} q${-r * 0.12} ${-r * 0.2} 0 ${-r * 0.4}" stroke="${p.ink}" stroke-width="${r * 0.05}" fill="none" opacity=".35" stroke-linecap="round"/>
    <path d="M${x - r * 0.9} ${y - r * 0.4} h${r * 1.8} c0 ${r * 0.9} ${-r * 0.45} ${r * 1.2} ${-r * 0.9} ${r * 1.2} s${-r * 0.9} ${-r * 0.3} ${-r * 0.9} ${-r * 1.2}z" fill="${p.soft}"/>
    <path d="M${x + r * 0.88} ${y - r * 0.15} c${r * 0.5} 0 ${r * 0.5} ${r * 0.55} 0 ${r * 0.55}" stroke="${p.soft}" stroke-width="${r * 0.14}" fill="none"/>
    <ellipse cx="${x}" cy="${y + r * 0.85}" rx="${r * 1.15}" ry="${r * 0.15}" fill="${p.accent}" opacity=".6"/>
    ${face(x, y + r * 0.15, r * 0.6, p.ink, p.accent)}`,
  stars: (p, x, y, r) => {
    const star = (cx, cy, s, o) => `<path d="M${cx} ${cy - s} L${cx + s * 0.3} ${cy - s * 0.3} L${cx + s} ${cy} L${cx + s * 0.3} ${cy + s * 0.3} L${cx} ${cy + s} L${cx - s * 0.3} ${cy + s * 0.3} L${cx - s} ${cy} L${cx - s * 0.3} ${cy - s * 0.3}Z" fill="${p.soft}" opacity="${o}"/>`;
    // the big star gets an outline so it shows on the palest backgrounds
    return `<g stroke="${p.accent}" stroke-width="${r * 0.05}" stroke-linejoin="round">${star(x, y, r * 0.8, 1)}</g>` + star(x + r * 0.95, y - r * 0.7, r * 0.35, 0.85).replace(p.soft, p.accent) + star(x - r * 0.9, y + r * 0.6, r * 0.3, 0.75).replace(p.soft, p.accent) + face(x, y + r * 0.05, r * 0.5, p.ink, p.accent);
  },
  // a steamed bun, a small nod to late-night snacks in Taiwan
  bun: (p, x, y, r) => `
    <ellipse cx="${x}" cy="${y + r * 0.75}" rx="${r * 1.1}" ry="${r * 0.14}" fill="${p.accent}" opacity=".45"/>
    <path d="M${x - r} ${y + r * 0.6} C ${x - r * 1.05} ${y - r * 0.2}, ${x - r * 0.45} ${y - r * 0.75}, ${x} ${y - r * 0.78} C ${x + r * 0.45} ${y - r * 0.75}, ${x + r * 1.05} ${y - r * 0.2}, ${x + r} ${y + r * 0.6} Z" fill="${p.soft}" stroke="${p.accent}" stroke-width="${r * 0.05}"/>
    <path d="M${x - r * 0.28} ${y - r * 0.55} q${r * 0.28} ${r * 0.18} ${r * 0.56} 0 M${x - r * 0.12} ${y - r * 0.72} q${r * 0.12} ${r * 0.22} ${r * 0.24} 0" stroke="${p.accent}" stroke-width="${r * 0.05}" fill="none" stroke-linecap="round"/>
    ${face(x, y + r * 0.1, r * 0.7, p.ink, p.accent)}`,
  // a cat curled up asleep
  cat: (p, x, y, r) => `
    <ellipse cx="${x + r * 0.2}" cy="${y + r * 0.35}" rx="${r * 1.05}" ry="${r * 0.55}" fill="${p.accent}"/>
    <path d="M${x + r * 1.15} ${y + r * 0.45} C ${x + r * 1.35} ${y + r * 0.95}, ${x + r * 0.4} ${y + r * 1.05}, ${x - r * 0.2} ${y + r * 0.85}" stroke="${p.accent}" stroke-width="${r * 0.2}" fill="none" stroke-linecap="round"/>
    <circle cx="${x - r * 0.55}" cy="${y + r * 0.15}" r="${r * 0.45}" fill="${p.accent}"/>
    <path d="M${x - r * 0.92} ${y - r * 0.05} l${r * 0.05} ${-r * 0.45} l${r * 0.3} ${r * 0.25}Z M${x - r * 0.5} ${y - r * 0.25} l${r * 0.25} ${-r * 0.38} l${r * 0.12} ${r * 0.42}Z" fill="${p.accent}"/>
    ${face(x - r * 0.55, y + r * 0.2, r * 0.42, p.ink, p.soft)}`,
  // a small night lamp, still glowing
  lamp: (p, x, y, r) => `
    <circle cx="${x}" cy="${y - r * 0.15}" r="${r * 1.05}" fill="${p.soft}" opacity=".7"/>
    <path d="M${x - r * 0.5} ${y - r * 0.6} h${r} l${r * 0.25} ${r * 0.65} h${-r * 1.5}z" fill="${p.accent}"/>
    <rect x="${x - r * 0.07}" y="${y + r * 0.05}" width="${r * 0.14}" height="${r * 0.55}" fill="${p.ink}" opacity=".55"/>
    <ellipse cx="${x}" cy="${y + r * 0.65}" rx="${r * 0.45}" ry="${r * 0.12}" fill="${p.ink}" opacity=".55"/>
    ${face(x, y - r * 0.25, r * 0.5, p.ink, p.soft)}`,
};

// Build the postcard SVG.
// line: the main text (usually the person's own "kind thing" or a closing line)
// label: a small heading above it; date: shown at the bottom
export function postcardSvg({ seed, line, label, date, brand = 'Murmur' }) {
  const r = rng(seed);
  // ids must be unique when several postcards are inline on one page
  const uid = 'pc' + Math.floor(r() * 1e9).toString(36);
  const p = PALETTES[Math.floor(r() * PALETTES.length)];
  const motifNames = Object.keys(MOTIFS);
  const motif = motifNames[Math.floor(r() * motifNames.length)];
  const W = 600;
  const H = 400;
  // soft background dots
  let dots = '';
  for (let i = 0; i < 26; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = 1.5 + r() * 3.5;
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="#fff" opacity="${(0.35 + r() * 0.4).toFixed(2)}"/>`;
  }
  const blobs = [0, 1, 2]
    .map(() => `<ellipse cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" rx="${(80 + r() * 120).toFixed(0)}" ry="${(60 + r() * 90).toFixed(0)}" fill="#fff" opacity=".22"/>`)
    .join('');
  const { lines, size, lh } = fitText(line);
  // the app's display stack (--display in css/style.css), so the card reads as part of the app
  const fontStack = `'Bricolage', ui-sans-serif, system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif`;
  // short text sits where it always did; a tall block starts just under the label instead
  const textY = Math.max(165 - ((lines.length - 1) * lh) / 2, (label ? 104 : 70) + size);
  const text = lines.map((l, i) => `<text x="300" y="${textY + i * lh}" font-size="${size}" font-weight="600" fill="${p.ink}" font-family="${fontStack}">${esc(l)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="${uid}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg[0]}"/><stop offset="1" stop-color="${p.bg[1]}"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="28" fill="url(#${uid}bg)"/>
  ${blobs}${dots}
  <g>${MOTIFS[motif](p, 150, 210, 78, uid)}</g>
  <rect x="268" y="40" width="300" height="320" rx="22" fill="#fff" opacity=".42"/>
  ${label ? `<text x="300" y="90" font-size="17" fill="${p.ink}" opacity=".75" font-family="${fontStack}">${esc(label)}</text>` : ''}
  ${text}
  <text x="300" y="330" font-size="16" fill="${p.ink}" opacity=".7" font-family="${fontStack}">${esc(date || '')}</text>
  <text x="548" y="330" font-size="14" fill="${p.ink}" opacity=".55" text-anchor="end" font-family="${fontStack}">${esc(brand)}</text>
</svg>`;
}

// Render the SVG to a PNG blob (2x for sharp sharing).
export async function postcardPng(svg, scale = 2) {
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
