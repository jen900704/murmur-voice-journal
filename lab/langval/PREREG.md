# Preregistration: do Murmur's emotion word categories line up with human emotion labels?

Written on 2026-11-24, after the scoring bridge (`score_texts.mjs`) was coded and tried on
five toy sentences that I typed myself, and before any corpus text was scored. The
machine-readable copy of this plan is `langval/hypotheses.py`. Both files are hashed in
`PREREG.lock` before the first scoring run. There is no external timestamp, so this is a
self-attested preregistration. Anything that departs from this file is listed under
"Deviations" in `RESULTS.md`.

What I had seen of the data when this was written: the first three lines of the GoEmotions
`train.tsv`, the number of comments per label in each GoEmotions split, the first two rows
of the CPED training file, the number of utterances per CPED emotion label in each split,
and the mean CPED utterance length (8.4 characters). No category score had been computed
for any corpus text.

## 1. Question

The hand-written categories in `js/langlab/lexicon-en.js` and `lexicon-zh.js` have never
been compared with human judgments. This study asks a narrow question about a set of
emotion categories: in short texts that human raters labeled with an emotion, does the
matching Murmur category count more words than in texts the raters labeled neutral
(known-groups and convergent validity), and does it stay quiet for emotions it should not
pick up (discriminant validity)?

This is a study of categories on texts. It says nothing about whether a category rate
tells you anything about a person.

## 2. Data

### English (primary): GoEmotions

Demszky et al. (2020). Reddit comments, each labeled by three or more raters with any of
27 emotions or neutral. Source: `google-research/google-research`, folder
`goemotions/data`, commit `ee4298226f21649f45c0d0427f7c0f3f682d2a20`, files `train.tsv`,
`dev.tsv`, `test.tsv`, `emotions.txt` (checksums in `fetch_data.py`). These are the
authors' filtered files: a label is kept when at least two raters chose it. License:
Apache 2.0, from the `LICENSE` file at the root of the repository at that commit. The
`goemotions` folder has no license file of its own.

- **Analysis set: `train.tsv` only (43,410 comments).** Verdicts come from this file.
- `dev.tsv` and `test.tsv` (10,853 comments) are not scored in this study. They are held
  back so that a revised word list can be retested on comments that played no part in
  the revision.

### Chinese (secondary): CPED

Chen et al. (2022). Utterances from 40 mainland Chinese TV dramas, each labeled by
annotators with one of 13 emotions. Source: `scutcyr/CPED`, commit
`1e4b81c28a123f22387e06664f37e5dc9322380f`, files under `data/CPED/`. License: Apache 2.0
(the repository `LICENSE`).

- **Analysis set: `train_split.csv` only (94,187 utterances, 26 shows).** The validation
  and test files are held back for the same reason as above.
- CPED is written in Simplified characters and Murmur's lists are Traditional, so each
  utterance is converted with OpenCC (`s2tw`, characters and Taiwan variants, no phrase
  substitution; package `opencc-python-reimplemented`) before scoring. Scores for the
  unconverted text are reported once, as a coverage figure only.
- This corpus is a poor match and the study says so in advance. The text is scripted
  drama dialogue in mainland Mandarin. The annotators watched the video, so a label can
  rest on voice and face with nothing in the words. The utterances average 8.4
  characters. I expect low coverage and I expect most categories not to reach
  "supported". The Chinese part is run because an openly licensed, human-labeled corpus
  is reachable, and a weak test reported honestly is better than none. It does not
  validate the lists for Taiwanese journaling whatever the result.

## 3. Scores

Every text is scored by the app's own engine, run in node through `score_texts.mjs`,
which imports `js/langlab/score.js` and reads back the per-item counts. Nothing in the
word lists, the tokenizer, the negation rule or the VADER port is re-implemented.

- Category score: hits per 100 units, where a unit is a word (English) or a Han
  character (Chinese). This is the rate the app shows. Negated emotion words are left
  out exactly as the app leaves them out.
- Tone: positive emotion rate minus negative emotion rate, the app's `tone` index.
- VADER reference (English only): the mean VADER compound score over the sentences of a
  text, from the app's port (`js/langlab/vader.js`) with `data/lexica/vader.json`. A
  text with no scorable sentence gets 0. There is no VADER for Chinese, so the Chinese
  part has no reference tool.
- A text is left out when the app's language detector does not assign it to the corpus
  language, or when it has zero units. The number left out is reported.
- Versions recorded with the results: app commit, engine version, `EN_VERSION`,
  `ZH_VERSION`, and SHA-256 of the scorer and lexicon files.

## 4. Groups

GoEmotions comments can carry several labels; CPED utterances carry one.

- **Target**: texts with at least one of the category's target labels.
- **Neutral**: texts whose only label is neutral. This is the main comparison group.
- **Other emotional**: texts that are not neutral and carry none of the target labels.
- **Opposite**: texts with at least one of the category's opposite labels and none of
  its target labels.
- **Near**: texts with a same-valence label that the category is not meant for, and
  none of the target labels.

## 5. Hypotheses

### English, confirmatory (family of 10)

For each row: the category rate is higher in target comments than in neutral comments.

| # | Murmur category | Target labels | Opposite labels (should not be picked up) | Near labels (reported) |
|---|---|---|---|---|
| E1 | `posemo` positive emotion | the 12 labels GoEmotions groups as positive | the 11 negative labels | |
| E2 | `negemo` negative emotion | the 11 labels GoEmotions groups as negative | the 12 positive labels | |
| E3 | `anx` anxiety | fear, nervousness | joy | anger, annoyance |
| E4 | `anger` | anger, annoyance | joy | sadness, grief |
| E5 | `sad` sadness | sadness, grief | joy | anger, annoyance |
| E6 | `grat` gratitude | gratitude | anger, annoyance | joy |
| E7 | `affil` love and closeness | love, caring | anger, annoyance | joy |
| E8 | `loss` loss and grief | grief | joy | anger, annoyance |
| E9 | `apology` apology and regret | remorse | joy | sadness, grief |
| E10 | `tone` (posemo minus negemo) | higher in positive-only than in negative-only comments | | |

The positive and negative label groups are the ones in the dataset's own
`sentiment_mapping.json`. For E10 a comment with both positive and negative labels is
left out.

E8 has a small target group (77 grief comments in the analysis set), so its interval
will be wide. The decision rule is not relaxed for it.

### English, exploratory (no verdict)

Looser matches, reported with plain 95% intervals and marked exploratory: `care` with
caring, `conflict` with anger and annoyance, `lonely` with sadness and grief, `risk`
with fear and nervousness, `insight` with realization, `tentat` with confusion,
`achieve` with pride, `reward` with joy and excitement, `polite` with gratitude, and
`loss` with the wider target grief or sadness.

A descriptive table of every tested category against every GoEmotions label (AUC
against neutral) is also given, with no tests attached.

Categories with no matching label in GoEmotions (pronouns, negation, time focus, work,
body, family, friend, the remaining moral and motive themes) are not tested here.

### Chinese, confirmatory (family of 7)

| # | Murmur category | CPED target labels | Opposite | Near |
|---|---|---|---|---|
| Z1 | `posemo` | happy, grateful, relaxed, positive-other | the 7 negative labels | |
| Z2 | `negemo` | anger, sadness, fear, depress, disgust, worried, negative-other | the 4 positive labels | |
| Z3 | `anx` | fear, worried | happy | anger |
| Z4 | `anger` | anger | happy | sadness, depress |
| Z5 | `sad` | sadness, depress | happy | anger |
| Z6 | `grat` | grateful | anger | happy |
| Z7 | `tone` | positive against negative utterances | | |

The label "astonished" is in neither valence group. CPED has no label for love, loss
or apology, so those Chinese lists stay untested.

## 6. Metrics

For each row, on target against neutral unless stated:

1. **AUC**: the probability that a randomly chosen target text has a higher category
   rate than a randomly chosen neutral text, ties counted as one half. Texts are short,
   so most rates are zero and the AUC is close to one half plus half the difference in
   hit rates. An AUC of .50 is chance.
2. **Intervals**: percentile bootstrap, 10,000 resamples, seed 20261124. GoEmotions is
   resampled by comment. CPED is resampled by dialogue, since utterances in one scene
   are not independent. The same resamples are used for every row, so differences
   between two AUCs are paired. Each AUC is reported with a 95% interval and with a
   family-adjusted interval (section 8).
3. **Point-biserial r** between group (target 1, neutral 0) and the rate, with a 95%
   bootstrap interval, written without a leading zero.
4. **Coverage**: the share of target texts with at least one hit, the share of neutral
   texts with at least one hit, and the share of all analysed texts with zero hits in
   the category, with Wilson 95% intervals (which treat texts as independent).
5. **Hit precision** (descriptive): of all analysed texts with at least one hit, the
   share that carry a target label, next to the share of all texts that do.
6. **Specificity**: AUC of target against other emotional texts.
7. **Discriminant**: AUC of the opposite set against neutral, and the paired difference
   between the target AUC and the opposite AUC. The near set is reported the same way
   with no threshold.
8. **VADER reference** (English): the same AUCs with signed VADER compound in place of
   the category rate (positive sign for E1, E6, E7; negative for E2 to E5, E8, E9;
   unsigned compound for E10), and the paired difference, category minus VADER. VADER
   gets no verdict. It is there to show what a general valence tool does on the same
   comments: I expect it to do as well as or better than the lists at telling emotional
   comments from neutral ones, and I expect it to be unable to tell one negative
   emotion from another, which is the job the specific lists claim to do.
9. **Sensitivity**: the main AUC recomputed with the raw hit count in place of the rate.

## 7. Decision rule

Fixed in `langval/hypotheses.py` (`verdict`), applied to the analysis set only.

**Supported**, when all of these hold:
- AUC against neutral is at least .65, and the lower bound of its family-adjusted
  interval is above .60;
- AUC against other emotional texts is at least .60;
- the opposite set is not picked up: its AUC against neutral is at most .55, and the
  family-adjusted interval for (target AUC minus opposite AUC) lies above 0.

**Weak**, when the category is not supported but its AUC against neutral is at least
.55 and the lower bound of the family-adjusted interval is above .50.

**Not supported** otherwise.

For tone (E10, Z7), which has no neutral group and no opposite set: supported at AUC
at least .65 with adjusted lower bound above .60, weak at AUC at least .55 with
adjusted lower bound above .50.

Why these numbers: with single short comments a word list cannot do much better than
its hit rate, so .65 corresponds to roughly a 30 point gap in hit rate between target
and neutral comments, and .55 to a 10 point gap. They are judgment calls made in
advance and they are modest on purpose. "Supported" means the category behaves as its
name says on this corpus. It does not mean the category measures the emotion.

## 8. Multiple comparisons

The confirmatory family is the 10 English rows; the Chinese rows are a separate family
of 7. Family-wise error is held at .05 by Bonferroni: decisions use intervals at level
1 minus .05/10 (99.5%) for English and 1 minus .05/7 (about 99.3%) for Chinese. The
ordinary 95% intervals are shown next to them. Exploratory rows and the descriptive
label table get 95% intervals and no decisions.

## 9. What happens after the verdicts (exploratory)

For every category that is weak or not supported, and briefly for the others, the
analysis set is read for causes:

- which list words produce most hits in neutral and off-target comments (words to
  review or drop);
- which words are frequent in target comments and absent from the list, ranked by a
  log-odds ratio against all other comments (words to consider adding).

The suggestions are written into `RESULTS.md` and **not applied**. The owner decides.
Since the suggestions come from the same comments as the verdicts, a revised list must
be retested on the held-back files before any claim is made for it.

## 10. Limits known in advance

- Reddit comments are not journal entries, and American-leaning Reddit English is not
  the English of Murmur's users in Taiwan.
- The labels are what raters perceived in a comment, not what the writer felt. The
  GoEmotions raters were native English speakers from India reading American Reddit.
- GoEmotions was built with a filter for offensive words and for comment length (at
  most 30 tokens), which changes how often swear words and long narratives appear.
- A category can separate labeled groups and still be a poor measure of a person.
  Group separation in a corpus is not person-level validity.
- One comment is about 13 words. The app does not show emotion rates under 300 words,
  so this study tests the lists at a text length the app itself refuses to interpret.
  That is a property of the available data.
