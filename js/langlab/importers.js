// Readers for pasted text, plain files, and the official data exports of several services.
// Everything is parsed in the browser. Each reader returns items of { text, timestamp, source }
// where timestamp is milliseconds since 1970 or null.

const MAX_ITEMS = 50000;
const MAX_TEXT = 20000;

// Meta (Facebook, Instagram, Threads) exports write UTF-8 bytes as if each byte were one
// character, so 我 arrives as three odd characters. If a string is made only of such byte-sized
// characters and decodes cleanly as UTF-8, decode it; otherwise leave it alone.
export function fixMojibake(s) {
  if (typeof s !== 'string' || !/[\u0080-ÿ]/.test(s)) return s;
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 0xff) return s;
    bytes[i] = c;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (_) {
    return s;
  }
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
// Dates before 2004 or in the future are treated as unreadable (no date).
const MIN_TIME = Date.UTC(2004, 0, 1);
export function parseTime(v) {
  const t = rawTime(v);
  return t !== null && t >= MIN_TIME && t <= Date.now() + 864e5 ? t : null;
}
function rawTime(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ms = v < 1e11 ? v * 1000 : v;
    return ms > 0 && ms < 4.1e12 ? ms : null;
  }
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (/^\d{9,13}$/.test(s)) return rawTime(Number(s));
  // X/Twitter: "Wed Oct 10 20:19:24 +0000 2018"
  let m = /^[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4}) (\d{4})$/.exec(s);
  if (m && MONTHS[m[1].toLowerCase()] !== undefined) {
    const off = (m[6][0] === '-' ? -1 : 1) * (Number(m[6].slice(1, 3)) * 60 + Number(m[6].slice(3)));
    return Date.UTC(Number(m[7]), MONTHS[m[1].toLowerCase()], Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])) - off * 60000;
  }
  // Reddit: "2023-01-15 12:34:56 UTC"
  m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(UTC|Z)?$/.exec(s);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = Date.parse(s);
  return Number.isFinite(t) && t > 0 ? t : null;
}

function item(text, timestamp, source) {
  if (typeof text !== 'string') return null;
  const t = text.replace(/\u0000/g, '').trim().slice(0, MAX_TEXT);
  if (!t) return null;
  return { text: t, timestamp: parseTime(timestamp), source };
}

// ---------- CSV ----------
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

const TEXT_COLS = ['body', 'text', 'full_text', 'content', 'message', 'comment', 'post', 'tweet', 'selftext', 'note', '內容', '文字', '內文'];
const TIME_COLS = ['date', 'created_at', 'createdat', 'timestamp', 'time', 'created', 'created_utc', 'datetime', '日期', '時間'];

export function parseCsvFile(text, name = '') {
  const rows = parseCSV(text);
  if (!rows.length) return { kind: 'csv', items: [] };
  const head = rows[0].map((x) => x.trim().toLowerCase());
  const col = (names) => {
    for (const n of names) {
      const i = head.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };
  const base = name.toLowerCase().split('/').pop();
  // Reddit data request: posts.csv (title, body), comments.csv (body); both have permalink and subreddit
  if (head.includes('permalink') && head.includes('subreddit') && head.includes('body')) {
    const b = head.indexOf('body');
    const t = head.indexOf('title');
    const d = head.indexOf('date');
    const items = [];
    for (const r of rows.slice(1)) {
      // lines starting with > quote someone else; the ip column is never read
      const body = (r[b] || '').replace(/^[ \t]*>.*$/gm, '').trim();
      if (/^\[(?:deleted|removed)\]$/i.test(body)) continue;
      const text = t !== -1 ? [r[t], body].filter(Boolean).join('\n') : body;
      const it = item(text, d !== -1 ? r[d] : null, 'reddit');
      if (it) items.push(it);
    }
    return { kind: t !== -1 || /post/.test(base) ? 'reddit-posts' : 'reddit-comments', items };
  }
  const tc = col(TEXT_COLS);
  const dc = col(TIME_COLS);
  const items = [];
  if (tc !== -1) {
    for (const r of rows.slice(1)) {
      const it = item(r[tc] || '', dc !== -1 ? r[dc] : null, 'csv');
      if (it) items.push(it);
    }
  } else {
    // no recognizable header: take the longest cell of each row
    for (const r of rows) {
      const longest = r.reduce((a, b) => (b.length > a.length ? b : a), '');
      const it = item(longest, null, 'csv');
      if (it) items.push(it);
    }
  }
  return { kind: 'csv', items };
}

// ---------- JSON exports ----------
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function metaSource(name, fallback) {
  const n = name.toLowerCase();
  if (/threads|text_post_app/.test(n)) return 'threads';
  if (/instagram/.test(n)) return 'instagram';
  if (/facebook/.test(n)) return 'facebook';
  return fallback;
}

function igMediaPosts(arr, source) {
  const out = [];
  for (const p of arr) {
    if (!plain(p)) continue;
    const media = Array.isArray(p.media) ? p.media : [];
    const text = typeof p.title === 'string' && p.title ? p.title : media.map((m) => (plain(m) && typeof m.title === 'string' ? m.title : '')).find(Boolean) || '';
    const ts = p.creation_timestamp ?? (media[0] && media[0].creation_timestamp);
    const it = item(fixMojibake(text), ts, source);
    if (it) out.push(it);
  }
  return out;
}

function igStringMapComments(arr, source) {
  const out = [];
  for (const c of arr) {
    const smd = plain(c) && plain(c.string_map_data) ? c.string_map_data : null;
    if (!smd) continue;
    let text = '';
    let ts = null;
    for (const [k, v] of Object.entries(smd)) {
      if (!plain(v)) continue;
      const key = fixMojibake(k).toLowerCase();
      if (key === 'comment' || key === '留言' || key === 'text') text = v.value || '';
      if (v.timestamp && ts === null) ts = v.timestamp;
      if (key === 'time' || key === '時間') ts = v.timestamp ?? ts;
    }
    const it = item(fixMojibake(text), ts, source);
    if (it) out.push(it);
  }
  return out;
}

function fbPosts(arr) {
  const out = [];
  for (const p of arr) {
    if (!plain(p)) continue;
    const data = Array.isArray(p.data) ? p.data : [];
    const text = data.map((d) => (plain(d) && typeof d.post === 'string' ? d.post : '')).find(Boolean) || '';
    const it = item(fixMojibake(text), p.timestamp, 'facebook');
    if (it) out.push(it);
  }
  return out;
}

function fbComments(arr) {
  const out = [];
  for (const c of arr) {
    if (!plain(c)) continue;
    for (const d of Array.isArray(c.data) ? c.data : []) {
      const cm = plain(d) && plain(d.comment) ? d.comment : null;
      if (!cm) continue;
      const it = item(fixMojibake(cm.comment), cm.timestamp ?? c.timestamp, 'facebook');
      if (it) out.push(it);
    }
  }
  return out;
}

function tweets(arr) {
  const out = [];
  for (const row of arr) {
    const tw = plain(row) ? (plain(row.tweet) ? row.tweet : row) : null;
    if (!tw) continue;
    const text = tw.full_text ?? tw.text;
    if (typeof text !== 'string' || /^RT @/.test(text)) continue; // a retweet is someone else's words
    const it = item(text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), tw.created_at, 'x');
    if (it) out.push(it);
  }
  return out;
}

function bskyRecords(arr) {
  const out = [];
  for (const r of arr) {
    const v = plain(r) ? (plain(r.value) ? r.value : r) : null;
    if (!v || typeof v.text !== 'string') continue;
    if (v.$type && v.$type !== 'app.bsky.feed.post') continue;
    const it = item(v.text, v.createdAt, 'bluesky');
    if (it) out.push(it);
  }
  return out;
}

function generic(v, out, depth = 0) {
  if (depth > 6 || out.length >= MAX_ITEMS) return;
  if (typeof v === 'string') {
    const it = item(fixMojibake(v), null, 'json');
    if (it) out.push(it);
  } else if (Array.isArray(v)) {
    for (const x of v) generic(x, out, depth + 1);
  } else if (plain(v)) {
    const key = TEXT_COLS.find((k) => typeof v[k] === 'string' && v[k].trim());
    if (key) {
      const tk = Object.keys(v).find((k) => TIME_COLS.includes(k.toLowerCase()) || k === 'createdAt' || k === 'creation_timestamp');
      const it = item(fixMojibake(v[key]), tk ? v[tk] : null, 'json');
      if (it) out.push(it);
    } else {
      for (const x of Object.values(v)) if (x && typeof x === 'object') generic(x, out, depth + 1);
    }
  }
}

export function parseJsonValue(v, name = '') {
  const n = name.toLowerCase();
  if (plain(v)) {
    if (Array.isArray(v.text_post_app_text_posts)) return { kind: 'threads-posts', items: igMediaPosts(v.text_post_app_text_posts, 'threads') };
    if (Array.isArray(v.comments_v2)) return { kind: 'facebook-comments', items: fbComments(v.comments_v2) };
    if (Array.isArray(v.records)) {
      const items = bskyRecords(v.records);
      if (items.length) return { kind: 'bluesky-records', items };
    }
    const ck = Object.keys(v).find((k) => /^comments_|_comments$/.test(k) && Array.isArray(v[k]));
    if (ck) return { kind: 'instagram-comments', items: igStringMapComments(v[ck], metaSource(n, 'instagram')) };
    const pk = Object.keys(v).find((k) => /posts?$/.test(k) && Array.isArray(v[k]));
    if (pk) return parseJsonValue(v[pk], name);
  }
  if (Array.isArray(v) && v.length) {
    const first = v.find(plain);
    if (first) {
      if (plain(first.tweet) || typeof first.full_text === 'string') return { kind: 'x-tweets', items: tweets(v) };
      if (plain(first.string_map_data)) return { kind: 'instagram-comments', items: igStringMapComments(v, metaSource(n, 'instagram')) };
      if (Array.isArray(first.media) || 'creation_timestamp' in first) {
        const src = metaSource(n, 'instagram');
        return { kind: `${src}-posts`, items: igMediaPosts(v, src) };
      }
      if ('timestamp' in first && (Array.isArray(first.data) || 'title' in first)) {
        const viaComment = v.some((p) => plain(p) && Array.isArray(p.data) && p.data.some((d) => plain(d) && plain(d.comment)));
        return viaComment ? { kind: 'facebook-comments', items: fbComments(v) } : { kind: 'facebook-posts', items: fbPosts(v) };
      }
      if ((plain(first.value) && typeof first.value.text === 'string') || first.$type === 'app.bsky.feed.post') return { kind: 'bluesky-records', items: bskyRecords(v) };
    }
  }
  const items = [];
  generic(v, items);
  return { kind: 'json', items };
}

// data/tweets.js: "window.YTD.tweets.part0 = [ ... ]"
export function parseTwitterJs(text) {
  const s = String(text).replace(/^﻿/, '');
  const m = /^\s*window\.YTD\.([A-Za-z_]+)\.part\d+\s*=\s*/.exec(s);
  const body = m ? s.slice(m[0].length) : s.slice(Math.max(0, s.indexOf('[')));
  const arr = JSON.parse(body);
  return { kind: 'x-tweets', part: m ? m[1] : null, items: Array.isArray(arr) ? tweets(arr) : [] };
}

export function parsePlain(text, name = '') {
  let s = String(text).replace(/^﻿/, '');
  if (/\.md$/i.test(name)) {
    // keep the words, drop the most common markup
    s = s
      .replace(/^```[\s\S]*?^```/gm, ' ')
      .replace(/!\[[^\]\n]{0,500}\]\([^)\n]{0,2000}\)/g, ' ')
      .replace(/\[([^\]\n]{0,500})\]\([^)\n]{0,2000}\)/g, '$1')
      .replace(/^[ \t]*(?:#{1,6}|>|[-*+]|\d+\.)[ \t]+/gm, '')
      .replace(/[*_`~]{1,3}/g, '');
  }
  const it = item(s.slice(0, 2000000).length > MAX_TEXT ? null : s, null, 'file');
  if (it) return { kind: 'text', items: [it] };
  // a long file: one item per paragraph, so the pieces stay under the size limit
  const items = [];
  for (const para of s.split(/\n\s*\n/)) {
    for (let i = 0; i < para.length; i += MAX_TEXT) {
      const p = item(para.slice(i, i + MAX_TEXT), null, 'file');
      if (p) items.push(p);
    }
  }
  return { kind: 'text', items };
}

// ---------- Bluesky repository (CAR file) ----------
// A CAR file is a list of blocks; each record block is DAG-CBOR. The posts are read by
// scanning every block for app.bsky.feed.post records; the tree that indexes them is not needed.
function cborDecoder(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 0;
  const td = new TextDecoder();
  function arg(info) {
    if (info < 24) return info;
    if (info === 24) return view.getUint8(p++);
    if (info === 25) {
      p += 2;
      return view.getUint16(p - 2);
    }
    if (info === 26) {
      p += 4;
      return view.getUint32(p - 4);
    }
    if (info === 27) {
      p += 8;
      return Number(view.getBigUint64(p - 8));
    }
    throw new Error('cbor');
  }
  function read(depth = 0) {
    if (depth > 32 || p >= bytes.length) throw new Error('cbor');
    const b = bytes[p++];
    const major = b >> 5;
    const info = b & 31;
    if (major === 7) {
      if (info === 20) return false;
      if (info === 21) return true;
      if (info === 22 || info === 23) return null;
      if (info === 25) {
        p += 2;
        return 0;
      }
      if (info === 26) {
        p += 4;
        return view.getFloat32(p - 4);
      }
      if (info === 27) {
        p += 8;
        return view.getFloat64(p - 8);
      }
      throw new Error('cbor');
    }
    const n = arg(info);
    if (major === 0) return n;
    if (major === 1) return -1 - n;
    if (major === 2) {
      p += n;
      return bytes.subarray(p - n, p);
    }
    if (major === 3) {
      p += n;
      return td.decode(bytes.subarray(p - n, p));
    }
    if (major === 4) {
      const a = [];
      for (let i = 0; i < n; i++) a.push(read(depth + 1));
      return a;
    }
    if (major === 5) {
      const o = {};
      for (let i = 0; i < n; i++) {
        const k = read(depth + 1);
        const v = read(depth + 1);
        if (typeof k === 'string' && k !== '__proto__') o[k] = v;
      }
      return o;
    }
    if (major === 6) return read(depth + 1); // tag (a link): keep what is inside
    throw new Error('cbor');
  }
  return { read, pos: () => p };
}

export function parseCar(bytes) {
  let p = 0;
  const varint = () => {
    let x = 0;
    let shift = 0;
    for (;;) {
      if (p >= bytes.length) throw new Error('car');
      const b = bytes[p++];
      x += (b & 0x7f) * 2 ** shift;
      if (!(b & 0x80)) return x;
      shift += 7;
      if (shift > 49) throw new Error('car');
    }
  };
  const headerLen = varint();
  p += headerLen;
  const items = [];
  while (p < bytes.length && items.length < MAX_ITEMS) {
    const len = varint();
    const end = p + len;
    if (len <= 0 || end > bytes.length) break;
    // content id: version 1, codec, then hash code, hash length, hash
    if (bytes[p] === 0x12 && bytes[p + 1] === 0x20) p += 34;
    else {
      varint();
      const codec = varint();
      varint();
      const hl = varint();
      p += hl;
      if (codec !== 0x71) {
        p = end;
        continue;
      }
    }
    try {
      const v = cborDecoder(bytes.subarray(p, end)).read();
      if (plain(v) && v.$type === 'app.bsky.feed.post' && typeof v.text === 'string') {
        const it = item(v.text, v.createdAt, 'bluesky');
        if (it) items.push(it);
      }
    } catch (_) {
      /* not a record this reader understands */
    }
    p = end;
  }
  return { kind: 'bluesky-car', items };
}

// ---------- one file ----------
// name: file name or path inside an archive. content: string, or Uint8Array for .car
export function parseFile(name, content) {
  const lower = String(name).toLowerCase();
  if (lower.endsWith('.car')) return parseCar(content instanceof Uint8Array ? content : new TextEncoder().encode(String(content)));
  const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
  if (lower.endsWith('.js') || /^\s*window\.YTD\./.test(text)) return parseTwitterJs(text);
  if (lower.endsWith('.json')) return parseJsonValue(JSON.parse(text.replace(/^﻿/, '')), lower);
  if (lower.endsWith('.csv')) return parseCsvFile(text, lower);
  return parsePlain(text, lower);
}

// Which files inside an export archive hold the person's own posts and comments.
export function wantedInArchive(path) {
  const p = path.toLowerCase();
  if (!/\.(json|js|csv|car)$/.test(p)) return false;
  if (/(^|\/)(messages|inbox|ads_|ads\/|ads_information|logged_information|security|login|device|preferences|connections|followers|following|personal_information)/.test(p)) return false;
  const base = p.split('/').pop();
  if (/^(tweets|tweet|note-tweet|community-tweet)(-part\d+)?\.js$/.test(base)) return true;
  if (/^(posts|comments)\.csv$/.test(base)) return true;
  if (/\.car$/.test(base)) return true;
  if (/\.json$/.test(base)) return /post|comment|threads_and_replies|repl|records/.test(base) && !/liked|likes|saved|story_|polls|reactions/.test(base);
  return false;
}

export function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = it.text.replace(/\s+/g, ' ').trim() + '|' + (it.timestamp ? Math.floor(it.timestamp / 60000) : '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

export function sortByTime(items) {
  return items
    .map((it, i) => [it, i])
    .sort((a, b) => (a[0].timestamp ?? Infinity) - (b[0].timestamp ?? Infinity) || a[1] - b[1])
    .map((x) => x[0]);
}

export const LIMITS = { MAX_ITEMS, MAX_TEXT };
