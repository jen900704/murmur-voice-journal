# Murmur text analysis report

**SYNTHETIC EXAMPLE DATA.** The input was made up for demonstration. Nothing below describes a real person.

Engine: DLATK 1.4.1 (Schwartz et al., 2017) on SQLite, Python 3.13.18.

This is a description of one person's own text. It is not a clinical measure, and it cannot show what causes what.

## What went in

- 270 messages (entry_note: 120, lens_answer: 20, lens_concern: 10, night_kindness: 40, night_worry: 40, social:example_network: 40)
- 120 mood or energy ratings
- 20 weeks with text, of which 20 have at least 50 words and were analyzed (3968 words in total)
- 1095 distinct 1- to 3-grams, 347 left after keeping those that occur in at least 10 of the 20 weeks
- Note: DLATK draws word clouds only from n-grams that stay below .05 after correction. None did, so no word cloud was drawn.

## Most frequent words and phrases

Share of all n-grams of that length across the analyzed weeks (punctuation left out of this list).

- 1-grams: i (4.7%), and (4.5%), the (4.5%), a (2.0%), my (2.0%), to (1.9%), with (1.6%), am (1.2%), this (1.1%), about (1.1%)
- 2-grams: and i (1.9%), i am (1.2%), in the (0.9%), about the (0.8%), with my (0.8%), the deadline (0.6%), of the (0.6%), and the (0.5%), 今 天 (0.5%), going up (0.5%)
- 3-grams: and i am (0.6%), and the rent (0.6%), money this month (0.6%), month and the (0.6%), rent going up (0.6%), the rent going (0.6%), this month and (0.6%), 下 午 開 (0.4%), 以 後 洗 (0.4%), 午 開 會 (0.4%)

## Lexicon scores

Mean over the analyzed weeks of the weighted share of words in each category. Licenses: murmur_dlatk/lexica/LICENSES.md.

| Lexicon | Category | Mean score | Lowest week | Highest week |
|---|---|---|---|---|
| vader_valence | NEG | 0.0234 | 0.0000 | 0.0492 |
| vader_valence | POS | 0.0495 | 0.0079 | 0.1293 |
| murmur_basic | I_SG | 0.0684 | 0.0509 | 0.1011 |
| murmur_basic | NEGATION | 0.0136 | 0.0000 | 0.0264 |
| murmur_basic | WE | 0.0048 | 0.0000 | 0.0209 |
| murmur_basic | ZH_NEG | 0.0019 | 0.0000 | 0.0139 |
| murmur_basic | ZH_WO | 0.0019 | 0.0000 | 0.0139 |
| murmur_topics | TOPIC_1 | 0.0447 | 0.0120 | 0.0717 |
| murmur_topics | TOPIC_2 | 0.0375 | 0.0000 | 0.1367 |
| murmur_topics | TOPIC_3 | 0.0501 | 0.0000 | 0.1833 |
| murmur_topics | TOPIC_4 | 0.0373 | 0.0000 | 0.0855 |
| murmur_topics | TOPIC_5 | 0.0425 | 0.0000 | 0.1162 |

## Topics (LDA on this text only)

Topics from a small personal collection change a lot from run to run and with the number of topics. Read them as a rough sorting of words, nothing more.

- TOPIC_1: afternoon, morning, cleaned, desk, notes, sorted, then, long, after, walk
- TOPIC_2: 上, 告, 圖, 在, 報, 寫, 晚, 書, 煮, 館
- TOPIC_3: 開, 下, 以, 午, 回, 家, 後, 會, 服, 洗
- TOPIC_4: cooked, roommate, summer, talked, be, minutes, small, step, ten, would
- TOPIC_5: class, away, doing, family, far, bus, late, read, way, eggs

## Language and ratings

Spearman correlations between each feature's score in a week and that week's mean rating. p-values are corrected with the Benjamini-Hochberg procedure within each feature table and outcome.

| Feature table | Outcome | Weeks | Tests | Below .05 before correction | Below .05 after correction |
|---|---|---|---|---|---|
| ngrams_1to3 | mood | 20 | 347 | 5 | 0 |
| ngrams_1to3 | energy | 20 | 347 | 3 | 0 |
| lexicon_vader_valence | mood | 20 | 2 | 1 | 1 |
| lexicon_vader_valence | energy | 20 | 2 | 0 | 0 |
| lexicon_murmur_basic | mood | 20 | 5 | 0 | 0 |
| lexicon_murmur_basic | energy | 20 | 5 | 0 | 0 |
| lexicon_murmur_topics | mood | 20 | 5 | 0 | 0 |
| lexicon_murmur_topics | energy | 20 | 5 | 0 | 0 |

That is 718 tests in all. With this many, some uncorrected p-values fall below .05 by chance alone, so only the last column is worth attention, and even those are leads to be curious about.

Features below .05 after correction (at most 20 shown, full list in correlations.csv):

| Feature table | Outcome | Feature | rho | 95% interval | Corrected p | n |
|---|---|---|---|---|---|---|
| lexicon_vader_valence | mood | NEG | -.57 | -.81 to -.17 | .02 | 20 |

Things these numbers do not account for: neighbouring weeks resemble each other (a hard month affects several weeks in a row), which makes the intervals and p-values too optimistic; the ratings and the text were often written at the same moment; and a word that tracks mood for one person may mean nothing for another.


## Agreement between DLATK and the fallback engine

| Table | Rows in both | Only DLATK | Only fallback | Largest difference |
|---|---|---|---|---|
| 1gram | 2143 | 0 | 0 | 0.0e+00 |
| 2gram | 2936 | 0 | 0 | 0.0e+00 |
| 3gram | 2827 | 0 | 0 | 0.0e+00 |
| lexicon_vader_valence | 38 | 0 | 0 | 0.0e+00 |
| lexicon_murmur_basic | 60 | 0 | 0 | 0.0e+00 |
| lexicon_murmur_topics | 83 | 0 | 0 | 0.0e+00 |
| 1to3gram_filtered | 3925 | 0 | 0 | 0.0e+00 |
| correlations | 718 | 0 | 0 | rho 1.1e-16, p 2.3e-14, corrected p 2.3e-14 |

## Files

groups.csv, top_ngrams.csv, ngrams_filtered.csv, lexicon_scores.csv, correlations.csv (when computed), run_info.json (settings and versions), parity.json, dlatk_raw/ (DLATK's own output and the commands that were run), plots/top_ngrams.png, plots/lexicon_and_ratings_by_week.png, plots/lexicon_correlations_mood.png, plots/lexicon_correlations_energy.png.
The work/ folder holds the SQLite database with your text. Delete it when you are done.

Reference: Schwartz, H. A., Giorgi, S., Sap, M., Crutchley, P., Ungar, L., & Eichstaedt, J. (2017). DLATK: Differential Language Analysis ToolKit. EMNLP System Demonstrations.
