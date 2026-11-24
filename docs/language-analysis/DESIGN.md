# Language analysis ("language mirror"): design

Status: design brief, 2026-11-24. Companion files: `LICENSES.md` (what may be bundled) and `LITERATURE.md` (references, with verification status). Citations here use author and year; the full references are in `LITERATURE.md`.

Sections 1 to 4 and 7 are the parts the engine in `js/langlab/` depends on most. Section 16 lists concrete notes on the lexicon files that already exist.

## 1. What the feature is, and what it is not

A person pastes or imports their own writing and sees counts of a small number of word categories, where every number can be traced to the exact words that produced it. The purpose is reflection ("I write 'should' a lot when I write about work") and not assessment.

It is:

- a transparent word counter with documented categories, intervals around every rate, and a downloadable evidence report;
- compared only with the person's own writing by default.

It is not:

- a personality test, a mood detector, or a screen for any condition;
- LIWC, C-LIWC or DLATK, and it does not reproduce their scores. Scores are not comparable with published LIWC values because the word lists differ.

Two facts from the literature set the tone for everything below. First, the links between single word categories and psychological traits are small at the group level. The best-studied one, first-person singular pronouns and depression, is about r = .10 to .13 (Tackman et al., 2019; Edwards & Holtzman, 2017). Second, counts of emotion words are weak indicators of felt emotion, both between and within persons (Kross et al., 2019; Sun et al., 2020; Jaidka et al., 2020). So the app reports what was written, and is careful about what that means.

## 2. Architecture

Everything runs on the device, in plain ES modules, with no build step and no runtime dependencies, as in the rest of Murmur. Analysis runs in a Web Worker so that a large archive does not freeze the page.

```
js/langlab/
  lexicon-en.js      hand-authored English categories + function-word classes   (exists)
  lexicon-zh.js      hand-authored zh-TW categories + ZH_COMMON guard list       (exists)
  normalize.js       Unicode NFKC, case, URL/mention/hashtag/emoji handling, script detection
  tokenize.js        English tokenizer; Chinese longest-match segmenter over the lexicon trie
  count.js           per-document category counts and hit positions
  score.js           rates, intervals (bootstrap / Wilson), minimum-length gates, baselines
  explain.js         word contributions, highlights, counterfactual recomputation
  series.js          time binning with adaptive bin width
  importers/         one small parser per format (section 12), plus zip.js and csv.js
  report.js          evidence report (HTML + JSON)
  safety-bridge.js   calls checkRisk() from js/safety.js on imported text (section 14)
  third_party/       only if a conditional resource is bundled; each with its own LICENSE.txt
```

Data flow: file or pasted text → importer → list of documents `{ id, text, t (ms, UTC), source, kind }` → normalize → tokenize → count → score → explain and report.

Core rules:

1. **One scoring model, and it is a count.** A category rate is `hits / units × 100`. Nothing is learned, weighted or standardized in version 1, so the explanation is the model.
2. **Deterministic.** The same text, lexicon version and engine version give the same numbers in every browser. This rules out using `Intl.Segmenter` for anything that feeds a score (section 4). The bootstrap uses a seeded generator (reuse `mulberry32` and `hashSeed` from `js/policy.js`), and the seed is printed in the report.
3. **Versioned.** `EN_VERSION`, `ZH_VERSION` and an engine version go into every stored result and report. A stored result is never silently recomputed with a newer lexicon; it is marked as computed with an older version, and the user can recompute.
4. **Raw imported text is not stored by default.** After analysis the app keeps per-document counts, token totals and timestamps. Keeping the text (needed for highlights later) is an explicit choice. Pasted journal notes that are already Murmur entries stay where they are.
5. **Languages are scored separately.** A document is assigned to `zh`, `en` or `mixed` by the share of Han characters among letters and Han characters. Mixed documents are counted in both lexica with their own denominators and are flagged; rates across languages are never pooled or compared.

## 3. Categories: what to include, and how strong the evidence is

The tiers below govern display. Tier A is shown by default. Tier B is shown with a "less precise" note. Tier C is shown only after the person opens it, with the validity caveat next to the number.

| Tier | Categories | Why this tier |
|---|---|---|
| A. Closed-class words | first-person singular, first-person plural, second person, negation; in English also articles, prepositions, auxiliary verbs, conjunctions, impersonal pronouns | Small, countable, nearly complete lists. High precision of the count. Function-word use is stable within a person across time and topic (Pennebaker & King, 1999). Group-level links exist but are small (Tackman et al., 2019; Kacewicz et al., 2014). |
| B. Semi-open stance and reasoning words | tentative (hedges), certainty, causation, insight; time adverbs and time nouns (past, present, future focus) | Lists are longer and some words are ambiguous, so precision is moderate. Used widely in expressive-writing research (Tausczik & Pennebaker, 2010). In Chinese, time focus is weaker because there is no tense (below). |
| C. Open-class content words | positive and negative affect words, anxiety, anger, sadness, social, family, friend, work, body | Lists can never be complete, sarcasm and negation flip meaning, and topic drives the count. Word-count affect measures over-identify emotion and agree weakly with self-reported emotion: in Bantum and Owen (2009) only about a third of the words LIWC flagged as emotional were judged emotional by raters (positive predictive value .31), and neither Kross et al. (2019) nor Sun et al. (2020) found that emotion-word counts tracked self-reported feelings. Present as "words you used about...", not as "your emotions". |

Notes on specific categories:

- **First-person singular.** The most studied marker. The pooled correlation with depression is small (r = .13 in the meta-analysis of Edwards & Holtzman, 2017; r = .10 in the multi-lab synthesis of Tackman et al., 2019, who also show it reflects general negative emotionality more than depression specifically). In the app the copy for this category must not mention depression. A neutral gloss such as "writing from your own point of view" is enough.
- **We.** English "we" is ambiguous between inclusive and exclusive uses. Chinese 我們 is too, and 咱們 is rare in Taiwan. Report the count and do not interpret closeness.
- **Negation.** High precision in English. In Chinese, 不 and 沒 are inside many non-negating words (不錯, 不過, 沒關係, 差不多), so the guard list matters (section 4).
- **Certainty and tentative.** Useful for reflection because people recognise the pattern ("I hedge a lot"). Shown as two separate rates, not a ratio.
- **Cognitive process.** An umbrella of causation, insight, certainty, tentative and discrepancy. Because it is a union, its hits overlap with the subcategories; the report must say so and must count each token once in the umbrella.
- **Social.** Very topic-dependent. Tier C.
- **Affect.** Tier C. Negation handling: mark an affect hit as "negated" when a negation word appears within the three preceding tokens in the same clause, and report negated hits separately (not flipped). This is a display aid, not a sentiment model.
- **Time focus.** In English this is mostly verb tense and auxiliaries, which a word list captures reasonably. Chinese marks time with adverbs and nouns (昨天, 以前, 剛才, 明天, 將來, 打算) and aspect particles (了, 過, 著, 正在). The particles are ambiguous (了 marks completion or change of state, not past time; 會 is future, ability or habit; 要 is want, need or future). For zh-TW, count only time adverbs and nouns, leave aspect particles out of the score, and label the category Tier B with a note that Chinese often leaves time unmarked.
- **Analytic thinking (categorical-dynamic index).** Pennebaker et al. (2014) derived an index from eight function-word categories in admissions essays: CDI = 30 + articles + prepositions − personal pronouns − impersonal pronouns − auxiliary verbs − conjunctions − adverbs − negations, each as a percentage of words. Higher values went with somewhat higher college grades across four years; the association is a group-level one in a sample of more than 25,000 students. For English, compute this raw index from the app's own function-word classes and call it "categorical vs. narrative style (experimental)". Do not convert it to a percentile: the LIWC "Analytic" score is a proprietary standardized transform, and our lists differ. For zh-TW, **do not compute it in version 1**. Chinese has no articles, the mapping of the other classes is not established, and no validation of the index for Chinese was found. It is a candidate for a preregistered validation study, not a feature.

### Transparency rule for authoring the lists

To build the categories without copying LIWC or C-LIWC:

1. Write each category definition first, in one or two sentences, with inclusion and exclusion rules (for example: "negation: words whose function is to deny a predicate; exclude lexicalised words that contain 不 but do not negate").
2. Fill closed-class categories from reference grammars and the author's native knowledge. Fill semi-open and open categories from the definition, then extend by reading keyword-in-context lines from open text, never by consulting a LIWC dictionary. Do not open LIWC, C-LIWC, SC-LIWC or copies of them during authoring.
3. Keep a provenance line per category in the lexicon file: who wrote it, when, from which sources, and what review it has had.
4. Publish the lists in full in the repository and in the evidence report. Anyone can see why a word counted.
5. Use the app's own category labels in the interface ("I-words", "hedging words"). Internal keys may stay short, but the report should say plainly that these are Murmur's lists and not LIWC variables, since several keys (`negate`, `tentat`, `cogproc`, `posemo`) match LIWC's variable names.
6. State the validation status honestly on every screen that shows a score: "These lists were written for this app and have not been validated against human ratings."

A cheap first validation that fits the owner's standards, to preregister before the lists are tuned further: draw 200 hits per category from the owner's own or consented text, have two raters judge each hit in context as correct or not, and report precision with a Wilson interval and inter-rater agreement per category. Categories under a prespecified precision (for example .80 for Tier A, .70 for Tier B) are fixed or moved down a tier. Recall can be estimated on a smaller hand-annotated sample.

## 4. Chinese tokenization in the browser

Options considered:

| Option | Download | Determinism | Notes |
|---|---|---|---|
| jieba compiled to WebAssembly or ported to JS | several MB (dictionary) | yes | MIT, but heavy for an offline PWA, and its dictionary is tuned to Simplified Chinese |
| `Intl.Segmenter('zh-Hant', { granularity: 'word' })` | none | **no** | Built into current browsers. Results depend on the browser's ICU version and differ between engines, so two devices can give different counts for the same text |
| Longest-match over the app's own word lists, with a guard list | a few KB | yes | Only finds words that are in the lists, which is all a dictionary count needs |
| Character n-grams | none | yes | No word boundaries at all; too many false hits (不 in 不錯) |

**Recommendation: forward longest-match over a trie built from all category entries plus the guard list (`ZH_COMMON`), falling back to single characters.** This is what `lexicon-zh.js` already describes. Details that matter:

- **The guard list is part of the measurement.** It holds frequent words that contain a category character but do not belong (不錯, 不過, 差不多, 沒關係, 天氣, 我行我素). It should be built from evidence: run the lexicon over open Traditional Chinese text, list the most frequent contexts of every single-character and two-character entry, and add the false ones. Record the guard list version in the report.
- **Forward longest-match errors.** Classic failures come from overlapping words (for example 我想起來 can be cut 我 / 想起 / 來 or 我 / 想 / 起來). Keep the entries short and prefer adding the longer competing word to the guard list over adding rules.
- **Denominator.** Use **Han characters** as the unit for Chinese: rate = hits per 100 Han characters. This needs no segmentation and is the same on every device. Do not call it "percent of words". For readers who want a word-based figure, the report may also give an approximate rate using an estimated word count (Han characters divided by a fixed constant, stated in the report as an approximation), or a count from `Intl.Segmenter` labelled as browser-dependent. Neither feeds a score.
- **Script variants.** Lists include Traditional forms, and Simplified forms for every entry whose characters differ, as `js/safety.js` already does. No conversion table is downloaded.
- **Normalisation.** NFKC (full-width to half-width), strip URLs, @mentions and the `#` of hashtags, keep emoji as separate non-word tokens (counted, not scored), collapse repeated characters beyond three (好好好好好).
- **Taiwan usage.** Add common written Taiwanese Hokkien and colloquial forms where the category is closed (阮, 咱, 毋, 袂, 無), tagged with a `variety` field so that they can be reviewed separately. Bopomofo and romanised particles are left unscored.
- **Pro-drop.** Mandarin often omits the subject, so first-person rates are lower than in English and depend on genre. This is another reason Chinese and English rates are never compared, and another reason to use the person's own baseline.
- **English inside Chinese text.** Latin-script runs are tokenized with the English tokenizer and counted against the English lexicon with their own denominator.

English tokenization: lower-case, split on Unicode letter boundaries, keep apostrophes inside words, expand nothing (list contractions such as "don't" and "i'm" as entries instead), and match `stem*` wildcard entries by prefix through the same trie.

## 5. Minimum text length

Rates from short texts are unstable for a simple reason: a category at 5% of words in a 100-word text is 5 hits, and one hit more or less moves the rate by a fifth.

What the literature uses:

- Open-vocabulary work on social media required at least 1,000 words per person (Schwartz et al., 2013; Park et al., 2015), and Kern et al. (2016) discuss minimums of that order for person-level estimates.
- Eichstaedt et al. (2018) used a lower threshold of 500 words per person.
- These thresholds are recalled from the papers' method sections; the abstracts do not state them. Check before quoting them in the app.
- LIWC documentation advises caution with texts under roughly 50 to 100 words. This is recalled from the LIWC materials and should be checked in the LIWC-22 manual (Boyd et al., 2022) before it is quoted in the app.

The approximate standard error of a rate p from n units, if words were independent, is sqrt(p(1 − p)/n). Words are not independent (people repeat themselves within a text), so real uncertainty is larger and the app uses a bootstrap over documents instead (section 9). The table is only for setting gates.

| True rate | n = 100 | n = 500 | n = 1,000 | n = 2,000 |
|---|---|---|---|---|
| 5% (common, e.g. English I-words) | ±4.3 | ±1.9 | ±1.4 | ±1.0 |
| 2% (e.g. negation) | ±2.7 | ±1.2 | ±0.9 | ±0.6 |
| 0.5% (rare, e.g. anxiety words) | ±1.4 | ±0.6 | ±0.4 | ±0.3 |

(Half-width of a 95% interval in percentage points, 1.96 × SE.)

Gates for version 1 (units are words in English and Han characters ÷ 1.5 in Chinese, used only for gating):

| Units in the selection | What is shown |
|---|---|
| under 50 | highlights only; no rates |
| 50 to 299 | Tier A rates with intervals and a "short text" note |
| 300 to 999 | Tier A and B rates; Tier C on request |
| 1,000 and over | all tiers; time series allowed if bins also pass their gate |
| each time-series bin | at least 300 units, otherwise bins are merged (section 11) |

A second gate applies per category: do not show a rate as a number when the expected hit count is under 5; show the raw count instead ("3 of 240 words").

## 6. Personality-related results

**Recommendation: do not output personality scores.** Offer, at most, an opt-in "what research has found" panel that describes group-level findings next to the person's own counts, with the effect sizes shown.

Reasons:

1. No bundle-allowed personality model exists (`LICENSES.md`). The WWBP personality models are not published as redistributable lexica.
2. Even the strongest published models are too imprecise for one person. Park et al. (2015) trained on 66,732 Facebook users with thousands of language features and tested on 4,824 others; their language-based scores correlated with self-reported Big Five scores at roughly r = .35 to .45 depending on the trait (these values are recalled from the paper's results and should be checked against it before they are quoted in the app). With r = .40, the 95% prediction interval for one person's true standardized score is about ±1.8 SD around the estimate, which covers most of the population range. A hand-authored count of 20 categories would be far below that.
3. Single categories relate to traits at about |r| = .05 to .20 in large samples (Yarkoni, 2010, N = 694 bloggers; Schwartz et al., 2013; range recalled from the papers' tables). A correlation of .10 means the category explains about 1% of the differences between people.
4. A personality label from an app carries more authority than it has earned, and people tend to accept such feedback as accurate regardless of its validity.

If the panel is built, each card follows one template:

> **In studies of groups**, people who use more [category] tend to score slightly [higher/lower] on [trait]. Size of the link: r = [value] ([study], N = [n]). That is [x]% of the differences between people. **It cannot tell where one person stands.** Your rate of [category] in this text: [rate] (95% interval [lo] to [hi]).

Rules: show r without a leading zero and always with r² in plain words; never compute or show a trait estimate, percentile or type; only cite findings that were replicated or come from samples over 500; state the population studied (mostly English-speaking, United States, Facebook users or bloggers, 2007 to 2015) and that nothing comparable is established for Traditional Chinese.

## 7. Reference norms

A norm is only meaningful if it was computed with the same word lists, the same tokenizer and a similar kind of text. That rules out quoting LIWC's published norms, which belong to LIWC's dictionary.

**Recommendation: within-person baselines are the default and the only comparison in version 1.**

- Baseline unit: one document for journal notes, one time bin for imported archives.
- Rule: once there are at least 10 units that each pass the length gate, show the person's median and usual range, using the same robust rule as the voice features (`personalBaseline` in `js/stats.js`). Before that, show the rate and interval with no comparison.
- Compare like with like: a baseline is kept per source and language (journal notes in zh, posts on one platform in en), because genre shifts word rates more than most psychological differences do.

Optional later: a "typical range in open text of this kind" computed by a script in `tools/` with the app's own engine, bundling only the resulting summary numbers (median, quartiles, corpus name, corpus version, lexicon version). Candidate corpora, with licences as recalled (to be checked before use):

| Language | Corpus | Genre | Licence (recalled) | Fit |
|---|---|---|---|---|
| en | Universal Dependencies English Web Treebank | blogs, email, reviews, forum answers | CC BY-SA 4.0 | closest open match to personal writing, but small (about 250,000 words) |
| en | Blog Authorship Corpus (Schler et al., 2006) | personal blogs, 2004 | free for non-commercial research; redistribution of the texts unclear | good genre fit and it ships with DLATK; aggregate statistics only |
| en | Project Gutenberg, Wikipedia | fiction, encyclopedic | public domain; CC BY-SA | poor genre fit |
| zh-TW | Universal Dependencies Chinese GSD (Traditional) and PUD | Wikipedia, news | CC BY-SA 4.0 | open, but formal text; poor match for diaries and posts |
| zh-TW | Academia Sinica Balanced Corpus | mixed | licensed, not open | cannot be used |
| zh-TW | PTT or Dcard posts | forum posts | no open licence; collecting them raises terms-of-service and consent problems | do not use |

There is no open corpus of personal Traditional Chinese writing with a licence that fits. So zh-TW has no reference range in version 1, and the interface says "compared with your own writing" in both languages. If an English reference range is added, it is drawn as a grey band labelled with the corpus and year, never as a percentile or a score.

## 8. Explainability

The audience is the person who wrote the text, not a model developer. Following Doshi-Velez and Kim (2017), the right evaluation for this audience is with real people on the real task (human-grounded at minimum), and the explanation should answer the questions people actually ask. In Liao et al.'s (2020) question bank those are mainly: "Why did I get this number?" (Why), "What would change it?" (What if, How to be that), "What data did it use?" (Data), "How accurate is it?" (Performance) and "What does this output mean?" (Output). Jacovi and Goldberg (2020) separate **faithfulness** (does the explanation reflect how the system actually computed the result) from **plausibility** (does it sound convincing), and warn that the two come apart. Miller (2019) adds that people prefer explanations that are contrastive and selective.

Because the model is a transparent count, explanations can be exact, which is the position Rudin (2019) argues for: use an interpretable model where one is adequate, in place of explaining an opaque one afterwards. Post-hoc methods built for opaque models, LIME (Ribeiro et al., 2016) and SHAP (Lundberg & Lee, 2017), are not needed, but they clarify the design space: for a linear model with independent features, the SHAP value of feature i is its weight times the difference between its value and its average, which here reduces to the word-contribution view.

| Design | What the person sees | Faithfulness | Comprehensibility | Risks |
|---|---|---|---|---|
| 1. Word contributions with in-text highlights | Their text with each hit highlighted by category; a table "these words made up this rate: 我 ×41, 我的 ×12" | Exact. The highlighted words are the complete cause of the number | High. Answers "Why" and "What data" directly. Needs a legend and a limit of two or three categories shown at once | Seeing painful passages again; over-reading a single word; clutter when many categories overlap |
| 2. Counterfactual "without these words" | A toggle or tap on a word: "without 應該 (9 uses) the rate falls from 2.1 to 1.3"; or "with this paragraph left out" | Exact, by recomputation. No approximation is needed because the model is cheap | High, and contrastive. Answers "What if" | May read as advice to avoid a word; needs wording that it is a what-if about the number, not a suggestion about writing |
| 3. Additive decomposition against a baseline | A bar that splits "this month vs. your usual" into the words and documents that account for the difference | Exact for a count (rates are sums). Depends on the chosen baseline, which must be shown | Medium. Waterfall charts are harder to read than highlights; good for the time series | The baseline looks like a norm; small differences look meaningful unless intervals are drawn |
| 4. LLM narrative with citations | A paragraph that summarises the pattern and cites papers | Low. A generated narrative is a plausible account, not the computation. Language models can give confident explanations that do not reflect the real basis of an output (Turpin et al., 2023), and citations can be wrong | Highest fluency, which is the problem: plausibility without faithfulness (Jacovi & Goldberg, 2020) | Needs a network call, which breaks the on-device promise; drift into clinical-sounding interpretation; fabricated references; text leaves the device |
| 5. Example-based | "Sentences where this showed up most", chosen by a fixed rule (highest hit density, then most recent) | Faithful if the selection rule is deterministic and stated; shows instances, not the whole basis | High. People reason well from their own sentences | Selection can mislead (three vivid sentences out of 4,000); painful content resurfaces; the others named in a sentence are shown |
| 6. Local surrogate (LIME-style) | Weights from a sampled local model | Approximate and varies between runs | Medium | Adds error to explain a model that is already exact. Not applicable |

**Recommendation.**

- **Primary: design 1, word contributions with highlights**, including the "top words" table per category. It is exact, it works offline, and it is the evidence the report is built on.
- **Secondary: design 2, the counterfactual recomputation.** It is also exact, costs almost nothing, and gives the contrastive "what if" view. It also teaches the limits of the method: people see how few words move a number.
- Use design 3 only inside the time series view ("what accounts for the change between two periods"), with intervals.
- Use design 5 as a secondary list under the highlights, with the selection rule stated and a count of how many sentences were not shown.
- **Do not use design 4 in version 1.** If the existing opt-in AI conversation is ever connected to this feature, the narrative must be generated only from the computed table, be labelled as an AI summary and not the analysis, and never be included in the evidence report.

The fixed wording for static interpretation (the short text under each category) is written by hand, reviewed like the rest of the app's content (`docs/content-review.md`), and each sentence carries a citation key. That gives "narrative with citations" without a generator.

Evaluation plan (preregister before release): with 8 to 12 users, test forward simulation ("which words do you think counted?") and counterfactual simulation ("will the number go up or down if this sentence is removed?") for designs 1 and 2, and record misreadings (for example, reading a rate as a diagnosis). These are the human-grounded tests of Doshi-Velez and Kim (2017).

## 9. Uncertainty

Every rate is shown with a 95% interval.

- **Twenty or more documents:** percentile bootstrap over documents (resample documents with replacement, recompute hits ÷ units), 1,000 resamples, seeded. This respects the fact that words cluster within documents.
- **Fewer than 20 documents but 20 or more sentences:** bootstrap over sentences.
- **Otherwise:** Wilson score interval on hits and units, labelled "approximate (treats words as independent; the real interval is wider)".

The interval covers sampling variation in what the person happened to write. It does not cover measurement error (missed words, false hits) or the gap between a word count and a psychological state. The report says so in one sentence.

Display: a dot with a horizontal bar, the numbers in text ("4.2 per 100 words, 95% interval 3.6 to 4.9"), and no colour that implies good or bad. For charts, follow the app's existing conventions in `js/viz.js`.

## 10. The evidence report

Two files, generated on the device: a self-contained HTML page that prints cleanly to PDF, and a JSON file with the same content. Sections:

1. **Summary.** What was analysed (source, date range, number of documents, units per language), in two or three plain sentences. The statement that this is a description of word use, not an assessment.
2. **Method.** Tokenizer rules, denominators (words for English, Han characters for Chinese), how categories are matched, the interval method and seed.
3. **Versions.** App version, engine version, `EN_VERSION`, `ZH_VERSION`, guard list version, date and time of analysis, browser user agent family.
4. **Input record.** File names and sizes, importer used, counts of items read, items excluded and why (reposts, items with no text, other people's text, duplicates), and a SHA-256 hash of the analysed text so that the person can show that a report belongs to a given text without sharing the text.
5. **Results table.** Per language and category: tier, hits, units, rate, 95% interval, interval method, and the person's own baseline if one exists.
6. **Hits.** Per category, every matched word type with its count, sorted by count. Negated affect hits listed separately. Overlaps between categories stated.
7. **Excerpts (off by default).** Highlighted sentences. Off by default because reports get shared and excerpts can contain other people.
8. **Time series**, if run: bin table with units, rate and interval per bin, the bin-merging rule, and known breaks (section 11).
9. **Category definitions and full word lists** for the categories reported, with provenance lines.
10. **Limits.** A fixed list: lists are unvalidated; counts ignore context, irony and quotation; small group-level effect sizes; genre and platform effects; code-switching; Chinese pro-drop; the interval excludes measurement error.
11. **Research panel**, if the person opened it: the cards shown, with effect sizes.
12. **Citations.** Full references for everything cited, and licence notices for any bundled third-party resource.
13. **Model card and datasheet block.** A short structured section after Mitchell et al. (2019) and Gebru et al. (2021): intended use, out-of-scope use (assessment of others, hiring, clinical decisions, forensic use), who wrote the lists, how, known gaps, and evaluation status.

The report never contains a clinical term as a result, a personality score, a risk level, or a comparison with other people.

## 11. Time series over imported posts

- **Bins.** Start with calendar months in the person's local time zone. If a bin has fewer than 300 units, merge with neighbours (quarter, half-year, year) until every bin passes; state the final bin width. Never interpolate empty periods; show gaps as gaps.
- **Display.** Rate per bin with its interval as a band, the person's median as a line and their usual range shaded, as in the voice trends.
- **No automatic trend claims.** With 20 categories and dozens of bins, some will look like trends by chance. Version 1 shows the series and lets the person compare two periods they pick; the comparison shows the difference in rates with a bootstrap interval for the difference and the decomposition of section 8. If a trend test is added later, prespecify one test and one family of categories and correct for multiple comparisons.
- **Breaks to annotate.** Changes in the platform (Twitter's limit rose from 140 to 280 characters in November 2017), changes in the person's mix of post types (replies vs. original posts), language switches, long gaps, and the boundary between sources. Each source gets its own series; do not splice platforms.
- **What a change means.** A change in word rates can come from topic, audience, platform or life events. The interface offers the dates and the top contributing words and leaves the reading to the person.
- **Link with the rest of Murmur.** Do not correlate language rates with mood check-ins or voice features in version 1. That is a separate analysis with its own multiple-comparison problem.

## 12. Import formats and how to parse them in the browser

General approach:

- The person chooses a file with `<input type="file">`, or drops it. Nothing is uploaded.
- Accept either the single relevant file from an export or the whole `.zip`. Read zips without a library: parse the end-of-central-directory record and central directory with `DataView`, then inflate the needed entries with `new DecompressionStream('deflate-raw')` (Chrome 103, Safari 16.4, Firefox 113 and later). If that API is missing or the archive uses ZIP64 or is larger than about 1 GB, ask the person to unzip and choose the file. Only entries whose paths match the patterns below are read; media files are never opened.
- Every importer returns `{ docs: [{ id, text, t, source, kind }], skipped: { reason: count }, warnings: [] }`.
- Keep only text the person wrote. Drop reposts, quoted text, shared links without commentary, and all direct messages (they contain other people's words).
- Run importers in the worker. Stream large files with `file.stream()` and `TextDecoder` where the format allows.

**The file layouts below are written from documentation and from memory of real exports. Platforms rename folders often. Each importer must detect the structure by shape and fail with a clear message, and each must be tested against a current real export before release. Items marked (check) are the least certain.**

### X / Twitter archive

- Path: `data/tweets.js` (older archives: `data/tweet.js`); large accounts also have `data/tweets-part1.js` and so on. Long posts are in `data/note-tweet.js` (check).
- Structure: JavaScript, not JSON. The file starts with an assignment and then a JSON array:

```
window.YTD.tweets.part0 = [
  { "tweet": {
      "id_str": "1234567890",
      "created_at": "Wed Oct 10 20:19:24 +0000 2018",
      "full_text": "...",
      "lang": "zh",
      "in_reply_to_status_id_str": "...",
      "entities": { "urls": [...], "user_mentions": [...], "hashtags": [...] }
  } },
  ...
]
```

- Parse: take the substring from the first `[` and `JSON.parse` it. Never `eval`. Date: `new Date(created_at)` parses this format in current browsers, but parse it by hand (month name table) to be safe.
- Filter: drop items whose `full_text` starts with `RT @` (reposts). Mark replies (`in_reply_to_status_id_str` present) as `kind: 'reply'` and strip the leading @mentions. Remove `t.co` links. Decode HTML entities (`&amp;`, `&lt;`, `&gt;`).

### Instagram (Accounts Center → Download your information → JSON)

- Paths: `your_instagram_activity/content/posts_1.json` (older exports: `content/posts_1.json`), and `your_instagram_activity/comments/post_comments_1.json` (check).
- Structure of posts: an array of objects. The caption is in `title`, either on the post or on its first media item:

```
[ { "media": [ { "uri": "media/posts/....jpg", "creation_timestamp": 1650000000, "title": "caption" } ],
    "title": "caption when the post has several media",
    "creation_timestamp": 1650000000 }, ... ]
```

- Comments (check): `{ "comments_media_comments": [ { "string_map_data": { "Comment": { "value": "..." }, "Time": { "timestamp": 1650000000 } } } ] }`, or a bare array in some versions.
- **Encoding trap.** Meta's JSON exports write non-ASCII text as UTF-8 bytes each escaped as `\u00XX`, so after `JSON.parse` Chinese text looks like `æ\u0088\u0091`. Repair every string: `new TextDecoder('utf-8').decode(Uint8Array.from(s, c => c.charCodeAt(0)))`, applied only when all code units are below 256, and keep the original if decoding fails. Without this step no Chinese text will match anything.
- Timestamps are Unix seconds.
- If the person chose the HTML format, tell them to request JSON; do not parse the HTML.

### Threads

- Delivered inside the Instagram export. Path: `your_instagram_activity/threads/threads_and_replies.json` (check).
- Structure (check): `{ "text_post_app_text_posts": [ { "media": [ { "title": "post text", "creation_timestamp": 1700000000 } ] } ] }`. Same encoding repair as Instagram.

### Facebook (Download your information → JSON)

- Paths: `your_facebook_activity/posts/your_posts__check_ins__photos_and_videos_1.json` (older: `posts/your_posts_1.json`), and `your_facebook_activity/comments_and_reactions/comments.json` (check).
- Structure of posts: an array:

```
[ { "timestamp": 1500000000,
    "data": [ { "post": "the text" } ],
    "title": "Name updated her status.",
    "attachments": [...] }, ... ]
```

- Comments: `{ "comments_v2": [ { "timestamp": ..., "data": [ { "comment": { "timestamp": ..., "comment": "the text", "author": "Name" } } ], "title": "..." } ] }`.
- Take `data[].post` and `data[].comment.comment` only. Ignore `title` (it is generated by Facebook and names other people) and attachments (shared content written by others). Same encoding repair as Instagram. Skip items with no `post` text.

### Bluesky

- Export: Settings → Account → Export my data gives a `.car` file (a content-addressed archive of the account's repository). The same file is served by `com.atproto.sync.getRepo`, but the app does not fetch it; the person downloads it and chooses the file.
- Structure: a CAR v1 file is a varint-length-prefixed header (DAG-CBOR, with `roots` and `version`) followed by blocks, each a varint length, a CID, and the block bytes. Record blocks are DAG-CBOR maps. Posts have `$type: "app.bsky.feed.post"` with `text`, `createdAt` (ISO 8601), optional `langs`, `reply` and `embed`.
- Parse: a small hand-written reader is enough: unsigned varint, CIDv1 (version, codec, multihash code, digest length, digest), and a CBOR decoder limited to the types DAG-CBOR allows (integers, byte and text strings, arrays, maps, tag 42 for links, booleans, null, floats). Decode every block, keep maps whose `$type` is `app.bsky.feed.post`, and ignore the tree nodes and commit. Walking the tree is not needed for reading text. About 200 lines, no dependency.
- Reposts are separate records (`app.bsky.feed.repost`) and carry no text, so they drop out. For quote posts keep the person's own `text` and ignore the embed. Mark records with `reply` as replies.

### Reddit (data request)

- Requested at reddit.com/settings/data-request; delivered as a zip of CSV files. Relevant files: `posts.csv` and `comments.csv`.
- Columns (check): `posts.csv`: `id, permalink, date, ip, subreddit, gildings, title, url, body`. `comments.csv`: `id, permalink, date, ip, subreddit, gildings, link, parent, body, media`. Dates look like `2021-03-04 12:34:56 UTC`.
- Parse: a proper CSV state machine (quoted fields, doubled quotes, line breaks inside quotes); do not split on commas or newlines. Find columns by header name. Text is `title` plus `body` for posts and `body` for comments.
- **Discard the `ip` column at parse time** and never store or display it. Skip `[deleted]` and `[removed]`. Strip Markdown quote lines (starting with `>`), since those are other people's words.

### Plain text, CSV, JSON

- **.txt**: decode as UTF-8 (detect a UTF-16 byte-order mark; offer Big5 through `TextDecoder('big5')` when UTF-8 decoding yields replacement characters, since older Taiwanese text files are often Big5). One document per file, or split on blank lines or on lines that look like dates, at the person's choice.
- **.csv**: same CSV parser; the person picks the text column and, optionally, a date column. Show the first five rows as a preview.
- **.json**: accept an array of strings, or an array of objects where the person picks the text and date fields (offer the likely ones: `text`, `content`, `body`, `note`, `date`, `created_at`, `timestamp`). Also accept Murmur's own backup, so journal notes can be analysed without re-export.
- **Paste**: one document, timestamp optional.

Date handling for all formats: store UTC milliseconds; bin in the device's local time zone; reject dates before 2004 or in the future as parse errors; when no date exists, the time series is disabled for that source.

## 13. Why the app does not fetch from a URL

1. **It does not work from a browser.** Social platforms do not send the CORS headers that would let a page on another origin read their responses, so a static site cannot fetch a profile. The only workaround is a proxy server, which would mean the person's content passes through a server and Murmur stops being on-device.
2. **Login walls.** Most platforms show little or nothing of a profile without a session. Getting past that means asking for credentials or session cookies, which the app must never do.
3. **Terms of service.** Automated collection is prohibited by the terms of the major platforms, and rendered pages change without notice, so a scraper is fragile as well.
4. **It would let people profile others.** A URL box accepts anyone's profile. The feature is for reflection on one's own writing; analysing a partner, a classmate or a client without their knowledge is exactly the harm that the ethics literature on inferring mental states from social media warns about (Chancellor et al., 2019). The official export requires the account holder to log in and request their own data, which is a natural consent check.
5. **Completeness and provenance.** An official export is complete, dated, and comes from the platform. Scraped pages are partial and mix in other people's replies.

The import screen should also say in one line that the tool is for the person's own writing, and paste and file import should not offer any "analyse someone else" framing.

## 14. Safety

- **Risk language in imported text surfaces help.** Run `checkRisk()` from `js/safety.js` on every imported document, in the worker. If any document matches, show the app's existing help panel (`resourcesFor`, `helpList`) once, above the results, with neutral wording: "Some of what you imported mentions wanting to die or hurting yourself. If any of that is true for you now, these lines are open." Then let the person continue. Do not block the analysis, do not count or chart the matches, do not list which posts matched unless the person asks, and do not put anything about it in the evidence report. Old posts may describe a time that has passed, so the wording should not assume a present crisis. The check is a coarse net with misses and false matches, as the comments in `safety.js` say; the help link stays visible on the page in any case.
- **No clinical labels and no depression scores.** No category is named after a condition. No output combines categories into a "risk", "wellbeing" or "mental health" number. The research panel does not include cards about depression or other diagnoses. The published links are too small to say anything about one person (section 1), prediction models perform modestly even with rich data (Eichstaedt et al., 2018, reported an AUC of about .69), and a wrong label in either direction can do harm (Chancellor et al., 2019).
- **Affect words are described, not interpreted.** "Words about sadness: 14" and never "you were sad".
- **Painful material.** Importing years of posts can bring up hard periods. Excerpts are collapsed by default in the time series, and the breathing exercise and help link are reachable from the results page.
- **Other people.** Imported text is stripped of others' words where the format allows. Excerpts are off by default in the report. The interface never offers analysis by named person.
- **Privacy.** No network requests are made by this feature. Imported text stays in memory unless the person chooses to keep it. Deleting an import deletes its derived counts. The service worker cache name must change when `js/langlab/` files are added (the existing unit test checks this).
- **Framing.** A fixed line under every results page: "This counts words. It does not measure who you are or how you are doing."

## 15. Preregistration and release gates

In keeping with how the voice features were validated (`docs/validation-protocol.md`), write the plan before tuning:

1. Precision study per category (section 3), with thresholds fixed in advance and a rule for what happens when a category fails (fix once and retest on fresh text, or demote, or remove).
2. Test-retest stability of Tier A rates within a person across random halves of their text at the gate sizes of section 5; if the split-half correlation at 300 units is below a prespecified value, raise the gate.
3. Explanation study (section 8).
4. Importer tests against real, current exports from each platform, with fixtures containing only synthetic text in the same structure.
5. A kill rule for the English analytic index: if it does not separate clearly different genres in open text (for example encyclopedic vs. personal narrative) in the expected direction, remove it.

## 16. Notes on the existing lexicon files (for the engine author)

Read on 2026-11-24 at `ZH_VERSION` and `EN_VERSION` `2026.11-1`.

- The longest-match plus `ZH_COMMON` approach matches section 4. Use Han characters as the reported denominator (section 4), not the number of longest-match tokens, since the token count changes whenever the lists change.
- 想 in `insight` is very ambiguous (think, want, miss: 我想你, 我想吃). Either remove the bare character and keep the compounds (想到, 想法, 想通, 想清楚), or expect low precision and place `insight` in Tier B with that note.
- 不知道 and 不曉得 are in both `negate` and `tentat`. Overlap is acceptable if the report lists it; decide deliberately and note it in the provenance line.
- Bare 不 and 沒 in `negate` depend entirely on the guard list. Build the guard list from frequency evidence (section 4) and add tests with 不錯, 不過, 差不多, 不好意思, 沒關係, 對不起, 了不起, 不但, 不僅, 不管, 不如.
- 會, 要, 了, 過, 在: keep out of the time-focus lists (section 3).
- 本人 in `i` also means "in person" or "the person himself" (他本人). Consider removing it.
- `cogproc` and `social` are unions. Count each token once in the union and state the overlap in the report.
- Category keys match LIWC variable names. Keep them as internal keys if convenient, but use Murmur's own labels in the interface and add the sentence from section 3, rule 5, to the report.
- `ANALYTIC_WEIGHTS` and `ANALYTIC_CONSTANT` implement the published formula of Pennebaker et al. (2014). Keep it English-only, raw, and labelled experimental (section 3).
- Each category object can carry `tier`, `definition` and `provenance` fields so that the interface and the report read them from one place.
