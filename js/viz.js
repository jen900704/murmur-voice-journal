// SVG drawing: voice-shape glyphs, the live recording ring, and trend charts.
const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, children = []) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  for (const c of children) n.appendChild(c);
  return n;
}

// Closed Catmull-Rom spline through points, as an SVG path.
function closedSpline(pts) {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d + 'Z';
}

// A voice shape: the pitch contour wrapped around a circle.
// Radius follows pitch (in semitones from this entry's median); loudness thickens the outline.
export function glyph(features, size = 120, opts = {}) {
  const c = size / 2;
  const base = size * 0.3;
  const amp = size * 0.032; // px per semitone
  const contour = (features && features.contour) || [];
  const svg = el('svg', {
    viewBox: `0 0 ${size} ${size}`,
    width: opts.width || size,
    height: opts.width || size,
    class: 'glyph',
    // without a label the shape is decoration inside a labelled control, so keep it out of the tree
    ...(opts.label ? { role: 'img', 'aria-label': opts.label } : { 'aria-hidden': 'true' }),
  });
  if (!contour.length) {
    svg.appendChild(el('circle', { cx: c, cy: c, r: base, class: 'glyph-shape' }));
    return svg;
  }
  const med = features.f0MedianHz || 150;
  // fill unvoiced gaps by interpolating between voiced neighbours
  const st = contour.map((p) => (p.f0 ? 12 * Math.log2(p.f0 / med) : null));
  const filled = st.slice();
  for (let i = 0; i < filled.length; i++) {
    if (filled[i] !== null) continue;
    let a = i - 1;
    while (a >= 0 && st[a] === null) a--;
    let b = i + 1;
    while (b < st.length && st[b] === null) b++;
    const va = a >= 0 ? st[a] : 0;
    const vb = b < st.length ? st[b] : 0;
    const w = b - a > 0 ? (i - a) / (b - a) : 0.5;
    filled[i] = (a >= 0 || b < st.length ? va + (vb - va) * w : 0) * 0.6; // gaps pulled toward the centre line
  }
  const maxE = Math.max(1, ...contour.map((p) => p.e || 0));
  // circular smoothing so the outline reads as a shape, not noise
  const n = filled.length;
  const smooth = filled.map((_, i) => {
    let acc = 0;
    let wsum = 0;
    for (let k = -2; k <= 2; k++) {
      const w = 3 - Math.abs(k);
      acc += filled[(i + k + n) % n] * w;
      wsum += w;
    }
    return acc / wsum;
  });
  const pts = smooth.map((s, i) => {
    const ang = (i / filled.length) * Math.PI * 2 - Math.PI / 2;
    const r = base + Math.max(-8, Math.min(8, s)) * amp + ((contour[i].e || 0) / maxE) * size * 0.05;
    return [c + r * Math.cos(ang), c + r * Math.sin(ang)];
  });
  svg.appendChild(el('path', { d: closedSpline(pts), class: 'glyph-shape' }));
  svg.appendChild(el('circle', { cx: c, cy: c, r: size * 0.025, class: 'glyph-dot' }));
  return svg;
}

// Live ring drawn around the record button from recent levels.
export function ringPath(levels, size) {
  const c = size / 2;
  const base = size * 0.36;
  const n = levels.length;
  if (n < 3) return '';
  const pts = levels.map((v, i) => {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = base + v * size * 0.11;
    return [c + r * Math.cos(ang), c + r * Math.sin(ang)];
  });
  return closedSpline(pts);
}

// Trend chart: points over entries, with the personal usual band.
export function lineChart({ values, times, labels, band, width = 340, height = 180, format = (v) => v, selfReport, minSpan = 0, label = '' }) {
  const padL = 40;
  const padR = 10;
  const padT = 12;
  const padB = 26;
  const W = width - padL - padR;
  const H = height - padT - padB;
  const finite = values.filter(Number.isFinite);
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-label': label });
  if (!finite.length) return svg;
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (band) {
    lo = Math.min(lo, band[0]);
    hi = Math.max(hi, band[1]);
  }
  // never stretch tiny differences across the whole chart
  const span = Math.max(hi - lo, minSpan, 1e-6);
  const mid = (hi + lo) / 2;
  if (hi - lo < span) {
    hi = mid + span / 2;
    lo = mid - span / 2;
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const n = values.length;
  // x follows real time when timestamps are given, so gaps between recordings show
  const t0 = times ? times[0] : 0;
  const t1 = times ? times[n - 1] : n - 1;
  const x = (i) => {
    if (n === 1 || t1 === t0) return padL + W / 2;
    const tv = times ? times[i] : i;
    return padL + ((tv - t0) / (t1 - t0)) * W;
  };
  const y = (v) => padT + H - ((v - lo) / (hi - lo)) * H;

  if (band) {
    svg.appendChild(el('rect', { x: padL, y: y(band[1]), width: W, height: Math.max(0, y(band[0]) - y(band[1])), class: 'chart-band' }));
  }
  // axis labels
  for (const v of [hi - pad, lo + pad]) {
    const tEl = el('text', { x: padL - 6, y: y(v) + 4, class: 'chart-axis', 'text-anchor': 'end' });
    tEl.textContent = format(v);
    svg.appendChild(tEl);
  }
  if (labels.length) {
    const a = el('text', { x: padL, y: height - 6, class: 'chart-axis' });
    a.textContent = labels[0];
    svg.appendChild(a);
    if (labels.length > 1) {
      const b = el('text', { x: padL + W, y: height - 6, class: 'chart-axis', 'text-anchor': 'end' });
      b.textContent = labels[labels.length - 1];
      svg.appendChild(b);
    }
  }
  // self-report as small marks along the bottom (mood 1..7 mapped to opacity)
  if (selfReport) {
    selfReport.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      svg.appendChild(el('rect', { x: x(i) - 3, y: padT + H + 2, width: 6, height: 5, rx: 1.5, class: 'chart-sr', 'fill-opacity': (0.15 + (v - 1) / 6 * 0.85).toFixed(2) }));
    });
  }
  // line
  let d = '';
  values.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  svg.appendChild(el('path', { d, class: 'chart-line' }));
  values.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    svg.appendChild(el('circle', { cx: x(i), cy: y(v), r: i === n - 1 ? 4 : 2.5, class: i === n - 1 ? 'chart-pt last' : 'chart-pt' }));
  });
  return svg;
}
