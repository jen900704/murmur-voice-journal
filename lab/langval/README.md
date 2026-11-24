# langval: do the language mirror's emotion categories match human emotion labels?

A preregistered known-groups and convergent validity study of the hand-written emotion
categories in `js/langlab/lexicon-en.js` and `lexicon-zh.js`. The lists had never been
compared with human judgments. Here they are compared with two corpora in which people
labeled short texts with emotions.

- `PREREG.md`: the plan, written before any corpus text was scored.
- `RESULTS.md`: the tables, a verdict per category, and word-list suggestions that are
  listed and not applied.
- `RETEST.md`: a post-fix retest on held-out data. Three engine bugs found by the study
  (wildcards such as `hug*` matching huge, guard words swallowing 很難過 and 很高興, Simplified
  text undercounted) were fixed afterwards and checked on the dev splits. No verdict
  changed. The numbers in this README and in `RESULTS.md` are from before those fixes.

## Short version

English, on 43,396 Reddit comments from GoEmotions: all nine tested categories (positive
emotion, negative emotion, anxiety, anger, sadness, gratitude, love and closeness, loss
and grief, apology) and the tone index met the preregistered rule. Each list fires more
in comments that raters labeled with its emotion than in neutral comments (AUC .68 to
.94), and none picks up the opposite emotion. Gratitude and apology are strong because
they rest on a few formula words. Anger and sadness are the weakest and miss about 6 in
10 comments that raters labeled angry or sad. The loss list passes on only 77 grief
comments and is noisy elsewhere. VADER, used as a reference, tells positive from negative
slightly better than the tone index (r = .63 against r = .52) but cannot tell one
negative emotion from another, which the specific lists can.

Chinese, on 93,992 TV-drama utterances from CPED: only gratitude met the rule. The other
five categories and tone did not, because 95% to 99.6% of these 8-character lines contain
no list word at all. The corpus is a poor match for Murmur, so the Chinese lists remain
effectively untested. Reading the data did turn up two concrete problems in the Chinese
engine (`很難過` and `很高興` are not counted; bare `幹` fires on `幹什麼`). They are
described in `RESULTS.md` section 4.4.

## What this shows

- On short English social media comments, each tested list lines up with the emotion
  label it is named after, and not with the opposite one.
- How often each list is silent when raters saw the emotion (coverage), and how often a
  hit lands in a comment without the emotion (hit precision).
- Which list words and wildcards misfire most, for the owner to review.

## What this does not show

- **Reddit English is not Taiwanese journaling.** The comments are public, short,
  American-leaning, full of sports talk and swearing. Murmur's users write private
  entries, mostly in Traditional Chinese, sometimes in English as a second language.
  Nothing here was measured on text like theirs.
- **The labels are rater perceptions.** They record what readers thought a comment
  expressed, not what its writer felt. The GoEmotions raters were native English
  speakers from India reading Reddit; the CPED labels come from a dataset built on
  video scenes.
- **Category validity is not person-level validity.** A list that separates groups of
  labeled comments can still say nothing reliable about one person. The study does not
  test whether someone with a higher rate of sadness words is sadder, and the app must
  not suggest it.
- **Length.** One comment is about 13 words. The app shows emotion rates only from 300
  words up, and that setting was not tested.
- **Untested categories.** Pronouns, negation, time focus, work, body, family, friend
  and most of the moral and motive themes have no matching label in these corpora.
- **Chinese.** Still open. It needs human-labeled first-person writing in Traditional
  Chinese under an open license, and I found none on GitHub or PyPI.

The notice the app shows next to these scores ("written for this app and not validated
against human ratings") should stay for Chinese. For English it could at most become
"checked once against rater labels on Reddit comments; not validated for journal
writing or for individuals".

## Data and licenses

| Corpus | Source and commit | Files used | License |
|---|---|---|---|
| GoEmotions (Demszky et al., 2020) | `google-research/google-research` at `ee4298226f21649f45c0d0427f7c0f3f682d2a20`, folder `goemotions/data` | `train.tsv` for the analysis; `dev.tsv` and `test.tsv` fetched and held back; `emotions.txt` | Apache 2.0 (repository `LICENSE`; the folder has no license file of its own) |
| CPED (Chen et al., 2022) | `scutcyr/CPED` at `1e4b81c28a123f22387e06664f37e5dc9322380f`, folder `data/CPED` | `train_split.csv` for the analysis; `valid_split.csv` and `test_split.csv` held back | Apache 2.0 (repository `LICENSE`) |

`fetch_data.py` downloads these at the pinned commits and checks SHA-256. The corpora
are not committed (`.gitignore`). `data/sample/` holds the first 200 lines of the
GoEmotions training file with a notice, so the tests run offline. The CPED utterances are
lines from broadcast TV dramas; the Apache license is the dataset authors' grant, and
nothing from CPED is redistributed here beyond a few short phrases quoted in the results.

The held-back files are for retesting a revised list. The suggestions in `RESULTS.md`
were found on the same comments as the verdicts, so a change made because of them has to
be checked on comments that were not used.

## How it works

1. `score_texts.mjs` imports `../../js/langlab/score.js` and writes one JSON line per
   text with the app's own counts (word lists, tokenizer, negation rule and VADER port
   as shipped). There is no second implementation of the scorer.
2. `run_analysis.py` loads a corpus, pipes it through the scorer, and computes the
   preregistered metrics in Python: AUC with bootstrap intervals (10,000 resamples, by
   comment for GoEmotions and by dialogue for CPED), point-biserial r, coverage, hit
   precision, discriminant checks and the VADER reference.
3. The decision rule lives in `langval/hypotheses.py` and is unit-tested.

```
python3 lab/langval/fetch_data.py
python3 lab/langval/run_analysis.py            # about 6 minutes; writes lab/langval/results/
python3 -m unittest discover lab/langval/tests # no network needed
```

Requirements: node 18 or later, Python 3 with numpy and scipy, and
`opencc-python-reimplemented` for the Chinese part (`requirements.txt`).

## Files

| Path | What it is |
|---|---|
| `PREREG.md`, `PREREG.lock` | The plan and the hashes taken before the first scoring run |
| `RESULTS.md` | Verdicts, tables, suggestions, deviations, limits |
| `score_texts.mjs` | Node bridge to the app's scorer |
| `fetch_data.py` | Pinned download with checksums |
| `run_analysis.py` | End-to-end run |
| `langval/hypotheses.py` | Label mappings, thresholds, decision rule |
| `langval/metrics.py` | AUC, point-biserial r, Wilson and bootstrap intervals |
| `langval/analysis.py`, `data.py`, `tables.py` | Analysis, loaders, table rendering |
| `results/*.json`, `results/*_tables.md` | Full output, including the word tables |
| `data/sample/` | 200 GoEmotions comments for the offline tests, with notice |
| `tests/` | `unittest` tests of the metrics, the rule and the pipeline on toy data |
| `RETEST.md`, `run_retest.py`, `results/retest_*` | Post-fix retest on the held-back dev splits, before and after the engine fixes |
| `baseline_engine/` | The engine files as they were for `RESULTS.md`, used for the "before" column |
| `tools/build_zh_s2t.py` | Generates `js/langlab/zh-s2t.js` (Simplified to Traditional character data) with OpenCC |

## References

- Chen, Y., Fan, W., Xing, X., Pang, J., Huang, M., Han, W., Tie, Q., & Xu, X. (2022).
  CPED: A large-scale Chinese personalized and emotional dialogue dataset for
  conversational AI. arXiv:2205.14727. (Author list as I recall it from the paper; check
  before citing.)
- Demszky, D., Movshovitz-Attias, D., Ko, J., Cowen, A., Nemade, G., & Ravi, S. (2020).
  GoEmotions: A dataset of fine-grained emotions. Proceedings of ACL 2020.
- Hutto, C. J., & Gilbert, E. (2014). VADER: A parsimonious rule-based model for
  sentiment analysis of social media text. Proceedings of ICWSM 2014.
