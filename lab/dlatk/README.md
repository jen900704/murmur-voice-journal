# Murmur text exports in DLATK

This folder holds a small research pipeline that takes the text a person exported from
Murmur 低語日記 and runs a differential language analysis on it with DLATK, on that
person's own computer. It is separate from the app: nothing here is loaded by the web page.

It is meant for two kinds of use:

- a person who wants to look at their own writing with a research tool;
- a researcher working with text that participants exported and handed over with consent.

## What DLATK is

DLATK, the Differential Language Analysis ToolKit, is an open-source Python package from the
World Well-Being Project and the Human Language Analysis Lab. It stores messages in a
database table, extracts language features for each group of messages (words and phrases,
lexicon categories, topics), and relates those features to outcomes with correlation or
regression, with correction for multiple comparisons.

> Schwartz, H. A., Giorgi, S., Sap, M., Crutchley, P., Ungar, L., & Eichstaedt, J. (2017).
> DLATK: Differential Language Analysis ToolKit. *EMNLP System Demonstrations*.

DLATK is licensed under GPL v3. This pipeline does not contain or import DLATK code. It
calls `dlatkInterface.py` as a separate program, so the files in this folder stay under the
repository's MIT license. DLATK was built for many people and many messages per person.
Here the groups are one person's weeks or months, which is a much smaller setting than the
one it was designed for. The section on limits below says what follows from that.

## Quick start

No installation is needed for the fallback engine. It uses only the Python standard
library and was tested with Python 3.13. Run from this folder:

```bash
cd lab/dlatk
python3 -m murmur_dlatk.run --input examples/synthetic-export.json --out results/ --engine fallback
```

With DLATK:

```bash
python3 -m venv ~/dlatk-venv
~/dlatk-venv/bin/pip install -r requirements-dlatk.txt
python3 -m murmur_dlatk.run --input export.json --out results/ \
    --dlatk-interface ~/dlatk-venv/bin/dlatkInterface.py
```

`export.json` is the file from About > Export backup in the app. Then open
`results/report.md`.

Without `--engine`, DLATK is used when `dlatkInterface.py` is found (through
`--dlatk-interface`, the `MURMUR_DLATK_INTERFACE` environment variable, or the PATH) and
the fallback otherwise, with a message saying which one ran. `--engine dlatk` stops with
installation instructions when DLATK is missing.

Useful options (`--help` lists all of them):

| Option | Meaning | Default |
|---|---|---|
| `--posts FILE` | social posts as a JSON list of `{text, timestamp, source}` | none |
| `--group week` or `month` | the unit of analysis | week |
| `--sources a,b` | which text to use: `entry_note`, `night_worry`, `night_kindness`, `lens_concern`, `lens_answer`, `social` | all |
| `--utc-offset H` | hours added to UTC before cutting weeks and months (8 for Taipei) | 0 |
| `--min-words N` | a period needs this many tokens to be analyzed | 50 |
| `--min-groups N` | correlations need this many periods with both text and ratings | 12 |
| `--p-occ P` | keep n-grams that occur in at least this share of periods | 0.5 |
| `--lexicon FILE` | an extra lexicon CSV (`term,category,weight`) | none |
| `--topics auto`, `on`, `off` | LDA topics from this text only | auto |
| `--include-demo` | keep the app's synthetic demo entries | left out |

Optional packages for the interpreter that runs `murmur_dlatk.run`: matplotlib for the
charts, scikit-learn for topics. Without them those steps are skipped and the report says so.

## Installing DLATK: what worked

Checked on 2026-11-24 with Python 3.13.18 on Linux.

- `pip install dlatk` installs version 1.3.15, which pins old versions of NumPy and pandas
  that have no build for Python 3.13. Installed without its dependencies, it fails at
  start-up on Python 3.13 (it imports `SafeConfigParser`, which Python removed in 3.12).
- The GitHub repository works. The version in its `setup.py` is 1.4.1. The commit used here
  is `bf01561c59e6d53480976c4ca7f93b679110d867` (2026-10-26).
- Two additions were needed: NumPy 2.2 instead of the newest NumPy (DLATK imports
  `numpy.linalg.linalg`, which later NumPy versions no longer have), and the pure-Python
  package PyMySQL (DLATK imports a MySQL driver at start-up even for SQLite; no MySQL
  server or client library is involved).
- `requirements-dlatk.txt` pins the exact versions that were installed and run. Each run
  writes the versions it found to `run_info.json`.
- SQLite is selected with `-e sqlite`. DLATK then expects databases under `~/sqlite_data/`,
  but an absolute path to `-d` and `--lexicondb` works, so everything stays in
  `results/work/`.
- DLATK's own topic estimation (PyMallet) does not install on Python 3.12 or later. Topics
  are therefore estimated with scikit-learn and passed to DLATK as a weighted lexicon,
  which is the form DLATK itself uses to score topics.

## What the pipeline does

1. **Reads the export.** Journal notes, bedtime worries and kind things, the concern and
   written answers of saved lens exercises, and optional social posts become one row each.
   The app's synthetic demo entries are left out unless asked for. Mood and energy ratings
   (1 to 7) are read from the entries, including silent check-ins.
2. **Prepares the text.** Unicode NFKC, HTML entities decoded, URLs and e-mail addresses
   replaced with `<url>` and `<email>`, line breaks turned into spaces. Chinese, Japanese
   and Korean characters are separated by spaces, so that n-grams over Chinese are
   character n-grams (DLATK's default tokenizer would otherwise treat a whole clause as
   one word).
3. **Builds the DLATK message table** `msgs` in `results/work/murmur.db` with the columns
   `message_id, user_id, week_id, month_id, created_time, source, message`, and an
   `outcomes` table with the mean mood and energy rating of each week or month. Weeks are
   ISO weeks (Monday to Sunday), for example `2026-W40`.
4. **Extracts features per week or month.**
   - 1-, 2- and 3-grams with counts and relative frequencies (`--add_ngrams -n 1 2 3`,
     combined into one table). The relative frequency of an n-gram is its count divided by
     the number of n-grams of that length in the period. N-grams do not cross messages.
   - The n-grams kept for analysis are those that occur in at least half of the periods
     (`--feat_occ_filter --set_p_occ 0.5`).
   - Lexicon scores (`--add_lex_table --weighted_lexicon`): for each category, the sum of
     weight times relative frequency over the words in that category.
   - Topics, only when there are at least 200 messages and scikit-learn is installed.
5. **Relates features to ratings**, only when at least 12 periods have both enough text and
   ratings: Spearman correlation between a feature's score in a period and that period's
   mean rating (`--correlate --spearman`), with Benjamini-Hochberg correction
   (`--p_correction BH`) applied within each feature table and outcome. DLATK is run once
   without correction and once with it, so both p-values are in `correlations.csv`.
6. **Writes tables, a report and charts.**

The fallback engine computes steps 4 and 5 in pure Python with the same definitions. When
DLATK is used, the fallback is run as well and the two are compared in `parity.json`. On
the synthetic example the n-gram tables, lexicon scores and filtered table are identical
row for row, and the correlations agree to 13 decimal places.

## Output

| File | Content |
|---|---|
| `report.md` | summary in words, with the cautions next to the numbers |
| `groups.csv` | per period: messages, words, whether analyzed, mean ratings |
| `top_ngrams.csv` | the 30 most frequent 1-, 2- and 3-grams overall |
| `ngrams_filtered.csv` | DLATK feature table layout: `group_id, feat, value, group_norm` |
| `lexicon_scores.csv` | lexicon and topic scores per period |
| `correlations.csv` | `rho`, uncorrected `p`, corrected `p_bh`, `n`, 95% interval, per feature and outcome |
| `topics.csv` | top words per topic, when topics were estimated |
| `run_info.json` | engine, versions, settings, counts, skipped steps and why, SHA-256 of the input |
| `parity.json` | agreement between DLATK and the fallback (DLATK runs only) |
| `dlatk_raw/` | DLATK's own output files and `commands.log` with every command that was run |
| `plots/` | bar chart of frequent n-grams, lexicon scores and ratings over time, correlation intervals |
| `work/` | the SQLite databases, which contain the text. Delete when done |

Word clouds: DLATK draws them from n-grams that stay below .05 after correction. When none
does, no word cloud is drawn and the report says so. The pipeline does not draw a word
cloud from uncorrected results.

The interval in `correlations.csv` is DLATK's when DLATK ran. In the fallback it is the
Fisher z interval with the Bonett and Wright (2000) variance, the same one the app uses.

## Example

`examples/synthetic-export.json` and `examples/synthetic-posts.json` are synthetic. Every
sentence was written for the example and assembled by `examples/make_synthetic.py` with a
fixed seed; no real person's text is involved. A relation between wording and the mood
rating was built in on purpose (low weeks use more words such as "tired" and "worried"),
as in the app's own demo data. Do not import the file into the app.

`examples/output/` is the result of

```bash
python3 -m murmur_dlatk.run --input examples/synthetic-export.json \
    --posts examples/synthetic-posts.json --out examples/output \
    --dlatk-interface ~/dlatk-venv/bin/dlatkInterface.py --engine dlatk
```

with real DLATK (versions in `examples/output/run_info.json`), minus the `work/` folder.
In it, 718 correlations were tested. Before correction, 9 were below .05. After
correction one was: the VADER negative-word score and weekly mood, rho = -.57. That is the
relation that was planted, and it is the only thing the example shows. The topic words in
`topics.csv` depend on the scikit-learn version and may differ on another machine; the
other tables do not.

## How this relates to the analysis inside the app

The app has an on-device language feature (`js/langlab/`, design in
`docs/language-analysis/DESIGN.md`). The two are built for different purposes and their
numbers are not interchangeable.

| | In the app (`js/langlab/`) | This pipeline |
|---|---|---|
| Where it runs | in the browser | Python on the same computer |
| Purpose | reflection: counts of a few documented word categories, each traceable to the words behind it | research-style exploration: every frequent word and phrase, lexicon scores, relation to ratings |
| Vocabulary | closed: Murmur's own hand-written English and zh-TW categories | open: all 1- to 3-grams, plus lexica |
| Score | hits per 100 words, or per 100 Han characters in Chinese | DLATK `group_norm`: count divided by the number of tokens in the period, times the lexicon weight |
| Chinese | longest match against the app's word lists with a guard list (不錯 is not a negation) | one token per character, no guard list |
| Lexica | Murmur's own lists; VADER for English sentiment | VADER as a plain weighted list (no negation rules), a short closed-class list, any CSV you pass |
| Time | adaptive bins | fixed weeks or months |
| Ratings | not related to text | Spearman correlation with BH correction |
| Uncertainty | bootstrap or Wilson interval around each rate | interval around each correlation; none around a single period's rate |

What they share: the same text, the `{text, timestamp, source}` shape for imported posts,
separate handling of Chinese and English, comparison only with the person's own writing,
and the refusal to turn word counts into statements about a person. The app's categories
could be exported to a lexicon CSV and passed with `--lexicon` so that both use the same
lists. That has not been done here.

## How much data is needed

For the rates. A relative frequency from a short text moves a lot when one word is added
or removed. If words were independent, a category at 5% of words would have a 95% margin
of about ±4.3 percentage points in 100 words, ±1.9 in 500 and ±1.4 in 1,000. Words are not
independent, so the real margins are wider. The default floor of 50 words per period only
removes the emptiest periods. It does not make a 60-word week a stable estimate. Rare
categories and 3-grams need far more text than common words.

For the correlations. The number that matters is the count of periods, not the count of
words. The approximate 95% interval around a correlation of zero is:

| Periods with text and ratings | Interval around rho = 0 |
|---|---|
| 12 (the default floor) | ±.57 |
| 20 | ±.44 |
| 30 | ±.36 |
| 52 (a year of weeks) | ±.27 |
| 100 | ±.20 |

So with 12 to 20 weeks only very large correlations can be told apart from zero, and a
real association of moderate size will usually not survive correction. The floor of 12
exists so that the pipeline does not print numbers from a handful of points. It is not a
claim that 12 is enough. About half a year of weekly data with several notes a week is a
more reasonable starting point, and a year is better. Grouping by month needs years.

For topics. LDA on a few hundred short messages gives topics that change with the random
seed and the number of topics. The default threshold of 200 messages is a floor for
running it at all. The topics are a rough sorting of words and nothing more.

## What can and cannot be concluded

- **It is one person.** Everything is within-person. A result says how this person's
  wording moved together with this person's ratings in this period of their life. It says
  nothing about other people, and published between-person findings (for example on
  pronouns) do not transfer to a single person's weeks.
- **It is descriptive.** A correlation does not show that the wording reflects the mood,
  causes it, or follows from it. Notes and ratings are often written in the same minute,
  about the same events. A week about exams contains the word "exam" and may also be a
  low week.
- **Many comparisons are made.** A typical run tests several hundred n-grams against each
  rating. Some uncorrected p-values fall below .05 by chance. Read `p_bh`, and note that
  the correction is done within each feature table and outcome, not across all of them:
  with two outcomes and several tables the chance of at least one false lead is higher
  than the corrected values suggest.
- **Weeks are not independent.** A hard month colours several weeks in a row. The p-values
  and intervals assume independent periods, so they are too optimistic by an amount this
  pipeline does not estimate.
- **Which features are tested depends on the data.** The occurrence filter and the word
  floor are fixed before the correlations are computed, but they are settings. Changing
  them after seeing the results and reporting the best run would be a form of selection.
  `run_info.json` records the settings of each run.
- **Lexicon scores are word counts.** "Not happy" counts "happy" as positive. A higher
  negative-word score means more words from that list were written. It is not a measure of
  how the person felt.
- **No clinical inference.** Nothing here screens for, detects or measures depression,
  anxiety, risk or any other condition, and no output should be read or presented that
  way. The app's risk-language check and help lines are not part of this pipeline. A
  researcher handling other people's exports needs their own protocol for what to do when
  the text itself is worrying.
- **Ratings are means of a few points.** A weekly mood value is the mean of the ratings
  given that week, sometimes of one rating.

A sensible use of a result is as a question to bring back to one's own experience ("the
weeks where I wrote more about sleep were lower; does that fit?"), not as a finding.

## Privacy

- Everything runs on the computer where the command is typed. Nothing is uploaded. As a
  check, the full DLATK run on the example was repeated with networking switched off
  (`unshare -n`) and produced identical tables.
- `pip install` needs the network once, to fetch DLATK. The analysis does not.
- `results/work/` contains the full text in an unencrypted SQLite file, and the other
  tables contain words and phrases from it. Treat the results folder like the backup
  itself. `.gitignore` in this folder keeps `work/` and `results/` out of commits.
- URLs and e-mail addresses are replaced before analysis. Names, places and anything else
  written in the text are not removed.
- DLATK prints its parameters, including folder paths, at the top of its output files. The
  pipeline replaces the local paths with `<work>` and `<out>` in `dlatk_raw/`.
- For research use: a Murmur backup also contains ratings and voice measurements. Collect
  only what the consent covers, and consider asking participants to run the pipeline
  themselves and share only the tables they choose.

## Lexica and licenses

Only lexica whose license was checked and allows redistribution are shipped:
the VADER lexicon (MIT) as a weighted list, and a short closed-class list written for this
project. Details, what was changed, and what was left out and why are in
`murmur_dlatk/lexica/LICENSES.md`, which follows `docs/language-analysis/LICENSES.md`.
LIWC, the NRC lexica and the lexica bundled inside DLATK are not used.

## Known differences and limits

- The fallback tokenizer was written independently and is meant to match DLATK's on
  ordinary prose. On the synthetic example the two agree on every row. Text with phone
  numbers, HTML tags or unusual emoticons may be split differently; `parity.json` shows
  the agreement on your own data whenever DLATK runs.
- DLATK's tokenizer reads "8pm" as the emoticon "8p" followed by "m". The fallback does
  the same, to stay comparable.
- Chinese is tokenized by character. Word-level analysis of Chinese would need a
  segmenter; DLATK's own option for that relies on the Stanford segmenter, which was not
  set up here.
- Weeks and months are cut in UTC unless `--utc-offset` is given.
- Tested on Linux with Python 3.13 only.

## Tests

```bash
python3 -m unittest discover lab/dlatk/tests      # from the repository root
```

29 tests, no network and no DLATK needed: export parsing, week and month grouping, n-gram
counts and lexicon scores against values worked out by hand, the occurrence filter,
Benjamini-Hochberg against a worked example, Spearman against SciPy's values, the SQLite
layout DLATK needs, reading DLATK's correlation file, the error messages, and a check that
the fallback reproduces the n-gram and lexicon tables of the committed DLATK example.

## Files

```
murmur_dlatk/run.py            command-line runner and report
murmur_dlatk/export.py         reads the backup and social posts
murmur_dlatk/textprep.py       text normalization and the fallback tokenizer
murmur_dlatk/grouping.py       weeks, months, mean ratings
murmur_dlatk/fallback.py       pure-Python features and correlations
murmur_dlatk/stats.py          Spearman, p-values, Benjamini-Hochberg
murmur_dlatk/dlatk_engine.py   SQLite tables and the DLATK commands
murmur_dlatk/topics.py         optional LDA on the person's own text
murmur_dlatk/plots.py          optional charts
murmur_dlatk/lexica/           lexica and their licenses
examples/                      synthetic input, its generator, and example output
requirements-dlatk.txt         the DLATK environment that was tested
tests/                         unit tests
```

## References

- Schwartz, H. A., Giorgi, S., Sap, M., Crutchley, P., Ungar, L., & Eichstaedt, J. (2017).
  DLATK: Differential Language Analysis ToolKit. *EMNLP System Demonstrations*.
- Benjamini, Y., & Hochberg, Y. (1995). Controlling the false discovery rate: A practical
  and powerful approach to multiple testing. *Journal of the Royal Statistical Society:
  Series B, 57*(1), 289-300.
- Bonett, D. G., & Wright, T. A. (2000). Sample size requirements for estimating Pearson,
  Kendall and Spearman correlations. *Psychometrika, 65*(1), 23-28.
- Hutto, C. J., & Gilbert, E. (2014). VADER: A parsimonious rule-based model for sentiment
  analysis of social media text. *ICWSM*.
