// The evidence report: one self-contained HTML page (inline styles, no scripts) and one JSON
// file with the same content. Both are made on the device. They hold the method, the word
// lists and their versions and licenses, every score with its interval and the words that
// produced it, the limits, and the references. They do not hold the text itself.

import { allScores, categoryWords, CI_LEVEL, MIN_HITS_FOR_RATE, ENGINE_VERSION } from './score.js';
import { scoreMeta, REFERENCES, NOTICE } from './meta.js';

const T = {
  en: {
    title: 'Language mirror: evidence report',
    made: 'Made on this device by Murmur',
    notAssessment: 'This report describes which words were used. It is not an assessment of a person, and it holds no clinical term, personality score, risk level, or comparison with other people.',
    summary: 'Summary',
    method: 'Method',
    versions: 'Word lists, versions and licenses',
    input: 'What was analyzed',
    results: 'Results',
    hits: 'Words that counted',
    lists: 'Category definitions and full word lists',
    limits: 'Limits',
    refs: 'References',
    card: 'Intended use',
    lang: { zh: 'Chinese text', en: 'English text' },
    unit: { zh: 'Chinese characters', en: 'words' },
    cols: ['Category', 'Tier', 'Hits', 'Units', 'Rate per 100', `${Math.round(CI_LEVEL * 100)}% interval`, 'Interval method', 'Without top 3 words'],
    tooShort: 'not enough text yet',
    countOnly: (c, n) => `${c} in ${n} (too few hits for a rate)`,
    negated: 'Left out because a negation came just before',
    none: 'none',
    ciMethod: { 'bootstrap-items': 'bootstrap over items', 'bootstrap-sentences': 'bootstrap over sentences', wilson: 'Wilson (approximate, too narrow)' },
    methodText: (a) => [
      'English text is split into lowercase words; contractions such as "don\'t" stay whole. Chinese text is cut by longest match over Murmur\'s own word lists, falling back to single characters. Links, e-mail addresses, @mentions and #hashtags are not scored.',
      'A category rate is hits divided by units, times 100. Units are words for English and Chinese characters for Chinese. Rates in the two languages are never pooled or compared.',
      `Each rate has a ${Math.round(a.settings.ciLevel * 100)}% interval. With ${a.settings.minUnitsForBootstrap} or more items, items are resampled with replacement (percentile bootstrap, seeded); with fewer items but ${a.settings.minUnitsForBootstrap} or more sentences, sentences are resampled; otherwise a Wilson interval is given, which treats words as independent and is too narrow.`,
      'The interval covers chance variation in what was written. It does not cover missed words, wrong matches, or the gap between a word count and a state of mind.',
      `A rate is shown only above a minimum amount of text (tier A: ${a.settings.minWords.A} units; tiers B and C: ${a.settings.minWords.B}; Chinese characters are divided by ${a.settings.zhCharsPerUnit}) and with at least ${a.settings.minHitsForRate} hits.`,
      'Feeling words within three words after a negation are not counted; they are listed apart.',
      '"Without top 3 words" is the same rate recomputed with the three most frequent contributing words removed from the text.',
    ],
    limitsList: [
      'The category lists were written for this app and have not been validated against human ratings.',
      'These are not LIWC or C-LIWC scores and cannot be compared with published LIWC values.',
      'Counts ignore context, irony, quotation and who is being talked about.',
      'Published links between word categories and psychological traits are small and hold for groups, not for one person.',
      'Indices here are plain sums and differences of category rates. None of them is a published score, and none can tell whether a statement is true.',
      'Moral themes are shown only as themes in the text. Nothing here infers political or religious views.',
      'Topic, audience and platform change word rates more than most personal differences do.',
      'Chinese often drops the subject and does not mark tense, so pronoun and time rates run low. English words inside Chinese text are not scored. The lists are Traditional Chinese; Simplified text is undercounted.',
      'The interval does not include measurement error.',
    ],
    cardText: [
      'Intended use: private reflection by the person who wrote the text.',
      'Not for: assessing other people, hiring, clinical decisions, or any legal use.',
      'Who wrote the lists: the Murmur project, from grammar references and native knowledge, without consulting LIWC dictionaries.',
      'Evaluation status: no precision or reliability study has been run yet.',
    ],
    seed: 'seed',
    resamples: 'resamples',
    items: 'items',
    sentences: 'sentences',
    hash: 'SHA-256 of the analyzed text',
    files: 'Files',
    skipped: 'Items in another language (not scored)',
    engine: 'Engine version',
    generated: 'Generated',
  },
  zh: {
    title: '語言鏡：分析依據報告',
    made: '由 Murmur 在這個裝置上產生',
    notAssessment: '這份報告描述的是用了哪些詞，不是對一個人的評估。報告裡沒有臨床名詞、人格分數、風險等級，也不和其他人比較。',
    summary: '摘要',
    method: '方法',
    versions: '詞表、版本與授權',
    input: '分析了什麼',
    results: '結果',
    hits: '計入的詞',
    lists: '類別定義與完整詞表',
    limits: '限制',
    refs: '參考文獻',
    card: '適用範圍',
    lang: { zh: '中文文字', en: '英文文字' },
    unit: { zh: '中文字', en: '英文單字' },
    cols: ['類別', '層級', '次數', '單位數', '每 100 單位', `${Math.round(CI_LEVEL * 100)}% 區間`, '區間算法', '拿掉前三個詞之後'],
    tooShort: '文字還不夠',
    countOnly: (c, n) => `${n} 個單位中出現 ${c} 次（次數太少，不算比率）`,
    negated: '因為前面有否定詞而沒有計入',
    none: '無',
    ciMethod: { 'bootstrap-items': '以每則文字重抽', 'bootstrap-sentences': '以句子重抽', wilson: 'Wilson（近似，偏窄）' },
    methodText: (a) => [
      '英文先轉成小寫再切成單字，縮寫（don\'t）保持完整。中文用 Murmur 自己的詞表做最長匹配斷詞，對不到的部分以單字計。網址、電子郵件、@提及和 #主題標籤不計分。',
      '類別比率是「次數除以單位數，再乘以 100」。英文的單位是單字，中文的單位是中文字。兩種語言的比率不會合併，也不互相比較。',
      `每個比率都附 ${Math.round(a.settings.ciLevel * 100)}% 區間。有 ${a.settings.minUnitsForBootstrap} 則以上時，以每則文字為單位重複抽樣（百分位數 bootstrap，固定種子）；則數不夠但有 ${a.settings.minUnitsForBootstrap} 句以上時，以句子重抽；再少就用 Wilson 區間，它把每個字當成獨立的，所以偏窄。`,
      '區間反映的是「剛好寫了什麼」造成的隨機變動，不包含漏算、誤算，也不包含字數和心理狀態之間的落差。',
      `文字量超過門檻才顯示比率（A 層 ${a.settings.minWords.A} 個單位；B、C 層 ${a.settings.minWords.B} 個；中文字數除以 ${a.settings.zhCharsPerUnit}），而且至少要出現 ${a.settings.minHitsForRate} 次。`,
      '感受的詞如果前面三個詞以內有否定詞，不計入，另外列出。',
      '「拿掉前三個詞之後」是把出現最多的三個詞從文字中移除後，重新算出的比率。',
    ],
    limitsList: [
      '這些詞表是為這個 app 寫的，還沒有和人工評分比對驗證過。',
      '這不是 LIWC 或中文 LIWC 的分數，不能和已發表的 LIWC 數值比較。',
      '計數不看上下文、反話、引用，也不管談的是誰。',
      '研究中詞類和心理特質的關聯都很小，而且是群體層次的結果，不適用於個人。',
      '這裡的指數只是幾個類別比率的加減，不是任何已發表的分數，也無法判斷一段話是真是假。',
      '道德主題只當成文字裡的主題呈現，不會用來推測政治或宗教立場。',
      '主題、對象和平台對用詞的影響，比多數個人差異還大。',
      '中文常省略主詞，也沒有時態，所以代名詞和時間詞的比率偏低。中文裡夾的英文不計分。詞表是繁體中文，簡體文字會被低估。',
      '區間不包含測量誤差。',
    ],
    cardText: [
      '適用：寫下這些文字的人自己私下回顧。',
      '不適用：評估別人、徵才、臨床決定，或任何法律用途。',
      '詞表作者：Murmur 專案，依語法參考資料和母語知識撰寫，沒有參照 LIWC 詞典。',
      '評估狀態：還沒有做過精確度或信度研究。',
    ],
    seed: '種子',
    resamples: '重抽次數',
    items: '則',
    sentences: '句',
    hash: '分析文字的 SHA-256',
    files: '檔案',
    skipped: '其他語言的項目（沒有計分）',
    engine: '引擎版本',
    generated: '產生時間',
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// numbers without a leading zero below one, as the app's reports do for proportions
export function fmt(x, d = 2) {
  if (!Number.isFinite(x)) return '';
  return x.toFixed(d);
}
const fmtCi = (ci, d = 2) => (ci ? `${fmt(ci[0], d)} \u2013 ${fmt(ci[1], d)}` : '');

export async function sha256Hex(text) {
  try {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (_) {
    return null;
  }
}

// analysis: the result of analyze(). meta: { uiLang, files: [{ name, size, kind, items }], generatedAt, hash }
export function buildReportData(analysis, meta = {}) {
  const ui = meta.uiLang === 'en' ? 'en' : 'zh';
  const t = T[ui];
  const languages = {};
  for (const lang of analysis.langs) {
    const R = analysis.byLang[lang];
    languages[lang] = {
      unit: t.unit[lang],
      units: R.words,
      items: R.nItems,
      sentences: R.nSentences,
      intervalMethod: R.ciMethod,
      seed: R.seed,
      resamples: R.B,
      scores: allScores(R).map((s) => {
        const m = scoreMeta(s.id, ui);
        return {
          id: s.id,
          label: m.label,
          tier: s.tier || 'C',
          kind: s.kind,
          hits: s.count ?? null,
          units: s.words,
          shown: !s.enough ? 'not-enough-text' : s.kind === 'pct' || s.kind === 'empath' ? (s.count >= MIN_HITS_FOR_RATE ? 'rate' : 'count') : 'rate',
          value: s.value,
          interval: s.ci,
          intervalLevel: CI_LEVEL,
          intervalMethod: s.ciMethod,
          minUnits: s.minWords,
          contributors: s.contributors,
          negated: s.negated || [],
          withoutTop3: s.counterfactual,
          classes: s.classes,
          sentenceShares: s.shares,
          definition: m.definition,
          limits: m.limits,
          motivatedBy: m.cite,
          wordList: s.kind === 'pct' || s.kind === 'index' ? categoryWords(lang, s.id) : null,
        };
      }),
    };
  }
  return {
    title: t.title,
    generatedAt: meta.generatedAt || new Date().toISOString(),
    engine: ENGINE_VERSION,
    notice: NOTICE[ui],
    statement: t.notAssessment,
    input: { files: meta.files || [], textSha256: meta.hash || null, skippedOtherLanguage: analysis.skipped.otherLanguage },
    settings: analysis.settings,
    lexica: analysis.lexica,
    method: t.methodText(analysis),
    languages,
    limits: t.limitsList,
    intendedUse: t.cardText,
    references: REFERENCES,
  };
}

export function buildReportHtml(data, uiLang) {
  const ui = uiLang === 'en' ? 'en' : 'zh';
  const t = T[ui];
  const out = [];
  const p = (s) => out.push(`<p>${esc(s)}</p>`);
  const h2 = (s) => out.push(`<h2>${esc(s)}</h2>`);
  const ul = (list) => out.push(`<ul>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`);
  out.push(`<!doctype html><html lang="${ui === 'en' ? 'en' : 'zh-Hant-TW'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(t.title)}</title><style>
body{font:16px/1.6 system-ui,-apple-system,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;color:#24213b;background:#fff;max-width:60rem;margin:0 auto;padding:1.5rem}
h1{font-size:1.5rem;margin:0 0 .25rem}h2{font-size:1.2rem;margin:2rem 0 .5rem;border-bottom:1px solid #dcd9e8;padding-bottom:.25rem}h3{font-size:1.05rem;margin:1.25rem 0 .25rem}
table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{border:1px solid #dcd9e8;padding:.3rem .5rem;text-align:left;vertical-align:top}th{background:#f1f0f6}
td.n{text-align:right;font-variant-numeric:tabular-nums}.muted{color:#55516e}.box{border:1px solid #dcd9e8;border-radius:8px;padding:.5rem .9rem;margin:.6rem 0;background:#f8f7fc}
.words{font-size:.9rem;word-break:break-word}code{font-size:.85em;word-break:break-all}@media print{body{padding:0}h2{break-after:avoid}table{break-inside:auto}}
</style></head><body>`);
  out.push(`<h1>${esc(t.title)}</h1><p class="muted">${esc(t.made)} · ${esc(t.generated)}: ${esc(data.generatedAt)} · ${esc(t.engine)}: ${esc(data.engine)}</p>`);
  out.push(`<div class="box"><p><strong>${esc(data.notice)}</strong></p><p>${esc(data.statement)}</p></div>`);

  h2(t.input);
  const inputLines = [];
  for (const [lang, L] of Object.entries(data.languages)) inputLines.push(`${t.lang[lang]}: ${L.items} ${t.items}, ${L.sentences} ${t.sentences}, ${L.units} ${L.unit}`);
  if (data.input.skippedOtherLanguage) inputLines.push(`${t.skipped}: ${data.input.skippedOtherLanguage}`);
  if (data.input.files.length) inputLines.push(`${t.files}: ${data.input.files.map((f) => `${f.name} (${f.kind}, ${f.items} ${t.items})`).join('; ')}`);
  ul(inputLines);
  if (data.input.textSha256) out.push(`<p class="muted">${esc(t.hash)}: <code>${esc(data.input.textSha256)}</code></p>`);

  h2(t.method);
  ul(data.method);

  h2(t.versions);
  out.push(`<table><thead><tr><th>Name</th><th>Version</th><th>License</th><th>Source</th><th>Note</th></tr></thead><tbody>${data.lexica
    .map((l) => `<tr><td>${esc(l.name)}</td><td>${esc(l.version)}</td><td>${esc(l.license)}${l.copyright ? '<br>' + esc(l.copyright) : ''}</td><td>${esc(l.source || '')}</td><td>${esc([l.attribution, l.note].filter(Boolean).join(' '))}</td></tr>`)
    .join('')}</tbody></table>`);

  h2(t.results);
  for (const [lang, L] of Object.entries(data.languages)) {
    out.push(`<h3>${esc(t.lang[lang])}</h3><p class="muted">${L.units} ${esc(L.unit)} · ${esc(t.ciMethod[L.intervalMethod] || '')} · ${esc(t.seed)} ${L.seed} · ${esc(t.resamples)} ${L.resamples}</p>`);
    out.push(`<table><thead><tr>${t.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>`);
    for (const s of L.scores) {
      const d = s.kind === 'sentiment' ? 3 : 2;
      let rate = fmt(s.value, d);
      let ci = fmtCi(s.interval, d);
      if (s.shown === 'not-enough-text') {
        rate = t.tooShort;
        ci = '';
      } else if (s.shown === 'count') {
        rate = t.countOnly(s.hits, s.units);
        ci = '';
      }
      const cf = s.shown === 'rate' && s.withoutTop3 ? `${fmt(s.withoutTop3.value, d)} (${s.withoutTop3.words.join(', ')})` : '';
      out.push(`<tr><td>${esc(s.label)}</td><td>${esc(s.tier)}</td><td class="n">${s.hits ?? ''}</td><td class="n">${s.units}</td><td class="n">${esc(rate)}</td><td class="n">${esc(ci)}</td><td>${esc(ci ? t.ciMethod[s.intervalMethod] || '' : '')}</td><td>${esc(cf)}</td></tr>`);
    }
    out.push('</tbody></table>');
  }

  h2(t.hits);
  for (const [lang, L] of Object.entries(data.languages)) {
    out.push(`<h3>${esc(t.lang[lang])}</h3>`);
    for (const s of L.scores) {
      if (!s.contributors.length) continue;
      const words = s.contributors.map((c) => (s.kind === 'sentiment' ? `${c.word} ×${c.count} (${c.sum > 0 ? '+' : ''}${c.sum})` : s.kind === 'index' ? `${c.word} ×${c.count} (${c.points > 0 ? '+' : ''}${fmt(c.points)})` : `${c.word} ×${c.count}`)).join(', ');
      out.push(`<p class="words"><strong>${esc(s.label)}</strong>: ${esc(words)}</p>`);
      if (s.negated.length) out.push(`<p class="words muted">${esc(t.negated)}: ${esc(s.negated.map((c) => `${c.word} ×${c.count}`).join(', '))}</p>`);
    }
  }

  h2(t.lists);
  for (const [lang, L] of Object.entries(data.languages)) {
    out.push(`<h3>${esc(t.lang[lang])}</h3>`);
    for (const s of L.scores) {
      out.push(`<div class="box"><p><strong>${esc(s.label)}</strong> <span class="muted">(${esc(s.id)})</span></p><p>${esc(s.definition)}</p><p class="muted">${esc(s.limits)}</p>${s.motivatedBy ? `<p class="muted">${esc(s.motivatedBy)}</p>` : ''}${s.wordList ? `<p class="words">${esc(s.wordList.join(s.kind === 'index' ? ' | ' : ' '))}</p>` : ''}</div>`);
    }
  }

  h2(t.limits);
  ul(data.limits);
  h2(t.card);
  ul(data.intendedUse);
  h2(t.refs);
  ul(data.references);
  out.push('</body></html>');
  return out.join('\n');
}
