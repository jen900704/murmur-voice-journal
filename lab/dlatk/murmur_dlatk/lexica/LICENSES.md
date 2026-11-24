# Lexica shipped with this pipeline

Only lexica whose license was checked and allows use, modification and redistribution are
included. Checked on 2026-11-24.

| File | Source | License | What was changed |
|---|---|---|---|
| `vader_valence.csv` | VADER sentiment lexicon, `vaderSentiment/vader_lexicon.txt` in https://github.com/cjhutto/vaderSentiment at commit `44fc044cd877310ee8278a0eadf34bcd50d41d06` (SHA-256 of the source file `ec636f884f36b5de6a4d681b2f61c08c2ec90eeb440472033f3307d0d6fa8bc9`). Hutto, C. J., & Gilbert, E. (2014). VADER: A parsimonious rule-based model for sentiment analysis of social media text. ICWSM. | MIT, copyright (c) 2016 C. J. Hutto. Full text in `VADER-LICENSE.txt`. | Converted to DLATK's sparse lexicon layout (term, category, weight). Terms are lowercased. A term with a positive mean rating goes to category POS, a negative one to NEG, and the weight is the absolute mean rating (0 to 4). The standard deviations and raw ratings are left out. Entries containing white space, entries ending in `*` (DLATK would read them as wildcards) and case duplicates with conflicting ratings were dropped: 7,482 of 7,520 lines are kept. |
| `murmur_basic.csv` | Written for this project. | MIT, the same as the repository. | Not applicable. |

Notes on what these are and are not:

- `vader_valence.csv` is used here as a plain weighted word list. VADER's own rules for
  negation, intensifiers, capital letters and punctuation are not applied, so "not happy"
  counts the word "happy" as positive. It is an English lexicon and scores Chinese text as
  zero.
- `murmur_basic.csv` is a short closed-class word list (first-person singular and plural
  pronouns, negations, and the Chinese characters 我, 不, 沒). It has not been validated
  against any psychological measure. Chinese is tokenized by character here, so ZH_WO also
  counts the 我 in 我們.

Lexica that are not included, following `docs/language-analysis/LICENSES.md` in this repository
(read on 2026-11-24), which is the place to check before adding another lexicon here:

- LIWC dictionaries: proprietary, no redistribution.
- NRC Emotion and VAD lexica (DLATK's `dlatk_lexica.db` holds `nrc_emot` and `nrc_sent`):
  that file records the NRC terms as non-commercial research use with no redistribution.
- WWBP lexica bundled in DLATK's `dlatk_lexica.db` (`dd_permaV3`, `dd_emnlp14_ageGender`,
  `dd_PastPreFut`, `dd_wassa16_affectInt`): that file records them as CC BY-NC-SA 3.0, which
  adds non-commercial and share-alike duties the MIT license of this repository does not
  carry. They are not used by default and not copied here. The age and gender lexicon is
  left out in any case, because guessing a person's age or gender is not the purpose.

A person who has checked that their own use fits a lexicon's terms can export it to a CSV
with the columns term, category, weight and pass it with `--lexicon`. The app's own
hand-written categories in `js/langlab/lexicon-en.js` and `lexicon-zh.js` (MIT) could be
exported the same way; that is not done here because those files were still changing.
