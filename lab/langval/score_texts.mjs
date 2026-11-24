#!/usr/bin/env node
// Scores texts with the app's own engine (js/langlab/score.js) and writes one JSON line per text.
// The word lists, tokenizer, negation rule and VADER port are the app's: nothing is re-implemented here.
//
//   node score_texts.mjs [--hits] < texts.jsonl > scores.jsonl
//
// Input lines:  {"id": "...", "text": "..."}
// Output lines: {"id", "lang", "words", "c": {category: hits, ...}, "vsum", "vn", "h"?: [[surface, [ids]], ...]}
//   lang   what the app's detectLanguage() says ('en', 'zh' or 'other'); 'other' and empty texts are not scored
//   words  the app's denominator: words for English, Han characters for Chinese
//   c      hits per category after the app's negation rule; zero counts are left out
//   vsum, vn  sum of VADER compound over sentences and the number of sentences scored (English only)
//   h      with --hits: the matched surface forms and the categories each one counted for
// The first output line is a header: {"_meta": {engine, en, zh, vader, categories}}.
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { analyze, CATEGORY_IDS, ENGINE_VERSION } from '../../js/langlab/score.js';
import { detectLanguage } from '../../js/langlab/tokenize.js';
import { EN_VERSION } from '../../js/langlab/lexicon-en.js';
import { ZH_VERSION } from '../../js/langlab/lexicon-zh.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const withHits = process.argv.includes('--hits');
const vaderPath = path.join(here, '..', '..', 'data', 'lexica', 'vader.json');
let vader = null;
try {
  vader = JSON.parse(readFileSync(vaderPath, 'utf8'));
} catch {
  vader = null; // VADER scores are then left out, as in the app
}
const data = vader ? { vader } : {};
const BATCH = 2000; // at 20 or more items the engine keeps one unit per item, which is what we read back
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
out({ _meta: { engine: ENGINE_VERSION, en: EN_VERSION, zh: ZH_VERSION, vader: !!vader, categories: CATEGORY_IDS } });

function flush(batch) {
  if (!batch.length) return;
  const rows = new Map();
  const items = [];
  for (const b of batch) {
    const text = String(b.text ?? '');
    const lang = text.trim() ? detectLanguage(text) : 'other';
    rows.set(b.id, { id: b.id, lang, words: 0, c: {}, vsum: 0, vn: 0 });
    if (lang !== 'other') items.push({ text, source: b.id });
  }
  // B: 1 keeps the engine's own bootstrap (not used here) cheap; it does not touch the counts
  const res = items.length ? analyze(items, data, { B: 1, maxHits: withHits ? 5e6 : 0 }) : { byLang: {} };
  for (const lang of Object.keys(res.byLang)) {
    const r = res.byLang[lang];
    r.items.forEach((it, ii) => {
      const row = rows.get(it.source);
      row.words = r.perItem.words[ii];
      for (const id of CATEGORY_IDS) {
        const n = r.perItem.counts[id][ii];
        if (n) row.c[id] = n;
      }
      row.vsum = Math.round(r.perItem.vSum[ii] * 1e4) / 1e4;
      row.vn = r.perItem.vN[ii];
      if (withHits) {
        row.h = r.hits[ii].filter((h) => h.ids.some((id) => CATEGORY_IDS.includes(id))).map((h) => [h.w, h.ids.filter((id) => CATEGORY_IDS.includes(id))]);
      }
    });
  }
  for (const b of batch) out(rows.get(b.id));
}

let batch = [];
const seen = new Set();
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  const o = JSON.parse(line);
  if (seen.has(o.id)) throw new Error('duplicate id: ' + o.id);
  seen.add(o.id);
  batch.push(o);
  if (batch.length >= BATCH) {
    flush(batch);
    batch = [];
  }
}
flush(batch);
