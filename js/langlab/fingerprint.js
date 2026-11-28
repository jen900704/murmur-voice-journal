// The word fingerprint (用字指紋): a still poster in 圓方 blocks, drawn only from counts and from
// the counted words themselves (never from free text). Returns an SVG string; every piece of
// text in it is escaped.
import { FAMILIES, FAMILY_TEXT, topWords, topFamily } from './clues.js';

export const FP_W = 360;
export const FP_H = 450;
const PAPER = '#F6F3EC';
const INK = '#151515';
const MUTED = '#5C5A55';
const C = { sun: '#F2B91D', pink: '#F4A7B9', jade: '#0E7C66', red: '#EA4B2D' };
const HERO = { self: C.sun, others: C.pink, feel: C.jade, absolute: INK, should: C.red, maybe: C.sun, time: C.pink };
const FONT = "system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', 'Noto Sans CJK TC', 'Microsoft JhengHei', sans-serif";

export const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// the same seven marks as the playground, as bars
function bar(fam, x, y, len) {
  const hgt = 18;
  if (fam === 'self') return `<rect x="${x}" y="${y}" width="${len}" height="${hgt}" fill="${C.sun}"/>`;
  if (fam === 'others') return `<rect x="${x}" y="${y}" width="${len}" height="${hgt}" fill="${C.pink}"/>`;
  if (fam === 'absolute') return `<rect x="${x}" y="${y}" width="${len}" height="${hgt}" fill="${INK}"/>`;
  if (fam === 'feel') return `<rect x="${x}" y="${y}" width="${Math.max(hgt, len)}" height="${hgt}" rx="9" fill="${C.jade}"/>`;
  if (fam === 'should') return `<rect x="${x}" y="${y + hgt - 6}" width="${len}" height="6" fill="${C.red}"/>`;
  if (fam === 'maybe') return `<rect x="${x}" y="${y + hgt - 3}" width="${len}" height="3" fill="${INK}"/>`;
  return `<rect x="${x + 1.25}" y="${y + 1.25}" width="${Math.max(hgt, len) - 2.5}" height="${hgt - 2.5}" rx="7.75" fill="none" stroke="${INK}" stroke-width="2.5"/>`;
}

export function fingerprintSvg({ counts, words, uiLang = 'zh-TW', date = '', title, topLabel, foot }) {
  const zh = uiLang !== 'en';
  const F = FAMILY_TEXT[zh ? 'zh' : 'en'];
  const top = topFamily(counts);
  const max = Math.max(1, ...FAMILIES.map((f) => counts[f]));
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FP_W} ${FP_H}" width="${FP_W}" height="${FP_H}" font-family="${FONT}">`];
  out.push(`<rect width="${FP_W}" height="${FP_H}" fill="${PAPER}"/>`);
  // one big circle cut by the corner, a quarter circle and a small block
  out.push(`<circle cx="300" cy="84" r="100" fill="${HERO[top] || C.sun}"/>`);
  out.push(`<path d="M360 196v-56a56 56 0 0 0-56 56z" fill="${top === 'absolute' ? C.sun : INK}"/>`);
  out.push(`<rect x="0" y="${FP_H - 40}" width="40" height="40" fill="${top === 'should' ? C.jade : C.red}"/>`);
  out.push(`<text x="24" y="56" font-size="30" font-weight="900" fill="${INK}">${esc(title)}</text>`);
  if (top) {
    const tops = topWords(words[top], 3).map(([w, n]) => `${w} ×${n}`).join(zh ? '、' : ', ');
    out.push(`<text x="24" y="104" font-size="13" font-weight="700" letter-spacing="1.3" fill="${MUTED}">${esc(topLabel)}</text>`);
    out.push(`<text x="24" y="${zh ? 160 : 148}" font-size="${zh ? 56 : 34}" font-weight="900" fill="${INK}">${esc(F[top].name)}</text>`);
    out.push(`<text x="24" y="186" font-size="14" fill="${INK}">${esc(tops)}</text>`);
  }
  let y = 218;
  for (const f of FAMILIES) {
    const n = counts[f];
    const len = n ? Math.max(8, Math.round((176 * n) / max)) : 0;
    out.push(`<text x="24" y="${y + 14}" font-size="14" font-weight="900" fill="${INK}">${esc(F[f].name)}</text>`);
    if (n) out.push(bar(f, 112, y, len));
    out.push(`<text x="${112 + (n ? Math.max(18, len) + 10 : 0)}" y="${y + 15}" font-size="15" font-weight="800" fill="${n ? INK : MUTED}">${n}</text>`);
    y += 28;
  }
  out.push(`<text x="52" y="${FP_H - 15}" font-size="11" font-weight="600" fill="${MUTED}">${esc(['Murmur', date, foot].filter(Boolean).join(' · '))}</text>`);
  out.push('</svg>');
  return out.join('');
}
