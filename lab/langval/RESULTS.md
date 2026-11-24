# Results: Murmur's emotion word categories against human emotion labels

Run on 2026-11-24 with the plan in `PREREG.md` (hashes in `PREREG.lock`, checked before the
run). App commit `d458fbb`, engine 1.0.0, `EN_VERSION` and `ZH_VERSION` 2026.11-2. The numbers
below are copied from `results/en_goemotions_train_tables.md` and
`results/zh_cped_train_tables.md`, which `run_analysis.py` writes; the full figures with
file hashes are in the two JSON files next to them.

Reading guide. AUC is the chance that a comment with the target label has a higher category
rate than a neutral comment. .50 is chance and 1.00 is perfect. Because one comment is about
13 words, most comments have a rate of zero, so the AUC is roughly one half plus half the gap
in hit rates. The adjusted interval is the one used for decisions (99.5% for English).

## 1. Verdicts

### English (GoEmotions, 43,396 Reddit comments, preregistered family of 10)

| Category | Target labels | AUC vs neutral (adjusted interval) | AUC vs other emotional | r | Target comments with no hit | Verdict |
|---|---|---|---|---|---|---|
| `posemo` positive emotion | 12 positive labels | .79 (.78 to .80) | .79 | .41 | 33.5% | **supported** |
| `negemo` negative emotion | 11 negative labels | .72 (.71 to .73) | .73 | .35 | 42.3% | **supported** |
| `anx` anxiety | fear, nervousness | .78 (.75 to .81) | .78 | .51 | 43.1% | **supported** |
| `anger` | anger, annoyance | .68 (.67 to .69) | .68 | .34 | 59.3% | **supported** |
| `sad` sadness | sadness, grief | .69 (.67 to .71) | .69 | .37 | 60.0% | **supported** |
| `grat` gratitude | gratitude | .93 (.92 to .94) | .93 | .66 | 13.7% | **supported** |
| `affil` love and closeness | love, caring | .76 (.75 to .77) | .76 | .45 | 42.7% | **supported** |
| `loss` loss and grief | grief (77 comments) | .81 (.73 to .89) | .81 | .29 | 36.4% | **supported**, with a caveat below |
| `apology` apology and regret | remorse | .94 (.93 to .96) | .94 | .64 | 10.6% | **supported** |
| `tone` (posemo minus negemo) | positive against negative comments | .87 (.86 to .88) | | .52 | | **supported** |

All ten English rows meet the preregistered rule. Every discriminant check passed: no
category separated its opposite set from neutral (all opposite AUCs between .49 and .50),
and no category picked up its same-valence neighbour by more than a trace (near AUCs .50 to
.51, except `apology` on sadness and grief at .56, which is "sorry for your loss").

What "supported" does and does not cover:

- It means the list fires where raters saw the matching emotion and stays quiet elsewhere,
  at a threshold that was set low on purpose (AUC .65). It does not mean the count measures
  how much of the emotion there is.
- **Coverage is the weak side.** `anger` and `sad` are silent in about 6 of 10 comments
  that raters labeled with that emotion. Only `grat` and `apology`, which rest on a few
  formula words (thanks, thank, sorry), reach most of their target comments.
- **Hit precision is uneven.** A comment with a `grat` hit carries the gratitude label
  87.9% of the time and one with a `posemo` hit a positive label 80.6% of the time. For
  `anger` it is 40.7%, for `sad` 29.9% and for `loss` 4.9%.
- **`loss` passes on a thin base.** It separates the 77 grief comments from neutral ones
  well (63.6% of them have a hit, against 2.3% of neutral comments). But of the 1,005
  comments with a `loss` hit only 4.9% are labeled grief, because lose, lost, losing, gone,
  dead and die are mostly about games, sports and misplaced things. With the wider target
  (grief or sadness, exploratory) the AUC drops to .54. Read `loss` as "supported for
  comments about a death, noisy everywhere else".
- **The categories within one group are not equally served.** From the descriptive label
  table: `affil` reaches love (AUC .87) and barely reaches caring (.55); `anger` does
  better on anger (.75) than on annoyance (.63).

### Chinese (CPED, 93,992 drama utterances converted to Traditional, family of 7)

| Category | Target labels | AUC vs neutral (adjusted interval) | Target utterances with a hit | Neutral utterances with a hit | Verdict |
|---|---|---|---|---|---|
| `posemo` | happy, grateful, relaxed, positive-other | .52 (.52 to .53) | 8.3% | 3.5% | **not supported** |
| `negemo` | 7 negative labels | .51 (.51 to .51) | 6.3% | 4.1% | **not supported** |
| `anx` | fear, worried | .50 (.50 to .51) | 1.7% | 0.8% | **not supported** |
| `anger` | anger | .51 (.51 to .51) | 2.6% | 1.1% | **not supported** |
| `sad` | sadness, depress | .50 (.50 to .50) | 0.7% | 0.4% | **not supported** |
| `grat` | grateful (204 utterances) | .80 (.73 to .87) | 59.8% | 0.5% | **supported** |
| `tone` | positive against negative | .54 (.54 to .55) | | | **not supported** |

Six of the seven Chinese rows fail, as the preregistration expected for this corpus. The
failure is one of coverage: between 94.9% and 99.6% of utterances have no hit at all in a
given category, so there is almost nothing to separate. The direction is right in every
row (target utterances have 1.5 to 2.4 times the hit rate of neutral ones) but the gaps are
a few points at most. **This says the Chinese lists are untested on text like Murmur's, not that
they are wrong.** Eight-character lines of mainland TV dialogue, in a dataset built from video, are
too far from Taiwanese journal entries to count for or against the lists. Chinese
validation stays open, and it needs Traditional Chinese first-person writing with human
labels, which I could not find under an open license.

## 2. VADER as a reference (English)

- **Positive against negative comments.** VADER compound does slightly better than Murmur's
  tone index: AUC .88 against .87 (difference -.01, 95% interval -.01 to -.01), and
  r = .63 against r = .52.
- **Emotional against neutral.** I expected VADER to match or beat every list here. It did
  for `anger`, `sad` and `affil` (list minus VADER: -.02, -.03, -.04). The lists were
  ahead for `posemo` (+.02), `negemo` (+.05), `anx` (+.05), and by a wide margin for
  `grat` (+.10), `loss` (+.15) and `apology` (+.33). So that expectation held in three of
  nine rows.
- **Telling one emotion from another.** This expectation held. VADER reacts the same way
  to any negative comment: with the sign set for anxiety, sadness or anger it separates
  the neighbouring emotion from neutral at .70 to .71, about as well as the target itself.
  The specific lists stay at .50 to .51 on the neighbour. That is the one thing the lists
  add over a general valence score, and on this corpus they do add it.
- In Table 5 the column "against other emotional" favours VADER for the negative lists.
  Most other emotional comments are positive, so any valence score looks good there. The
  near-label columns are the fair test of specificity.

## 3. Exploratory rows (no verdict)

`polite` tracks gratitude almost as well as `grat` (.92), which shows the two lists share
their strongest words. `insight` with realization (.63) and `tentat` with confusion (.61)
show a modest signal. `care` with caring (.57) and `reward` with joy and excitement (.57)
are small. `conflict`, `lonely`, `risk` and `achieve` are at .51 to .52 against the labels
I paired them with. Those pairings are loose (GoEmotions has no loneliness or conflict
label), so this is weak evidence about those lists either way.

## 4. Word-list suggestions (listed, NOT applied)

These come from reading the same 43,396 comments the verdicts came from, so they are
exploratory. If any are adopted, retest on the held-back `dev.tsv` and `test.tsv` before
claiming an improvement. No English category failed, so nothing here is required by the
decision rule. The items are ordered by how sure I am. "Share" is the share of comments
containing the word that carry the category's target label. The full word tables are at
the end of `results/en_goemotions_train_tables.md`.

### 4.1 Wildcards that match unrelated words (clear errors)

| Entry | Unintended matches seen | Where | Suggested replacement |
|---|---|---|---|
| `hug*` | huge: 104 comments, more than hug and hugs together (share 8% in `affil`) | `posemo`, `affil`, `social` | `hug hugs hugged hugging` |
| `yell*` | yellow: 23 comments, none labeled anger or annoyance | `anger`, `conflict`, `negemo` | `yell yells yelled yelling` |
| `heal*` | health (51), healthy (37), healthcare (20): topic words | `posemo`, `care` | `heal heals healed healing` |
| `shit*` | shitpost (10) | `negemo` | acceptable, or list the forms |
| `support*` | supporters, supporter (32, mostly sports and politics; share about 28%) | `posemo`, `care` | `support supports supported supporting supportive` |

### 4.2 Words that fire mostly off target (review)

| Category | Words (comments, share) | Note |
|---|---|---|
| `anger` | fight (93, 9%), fighting (46, 9%), attack (42, 2%), attacks (17, 0%), killed (69, 17%), kill (113, 23%), violent (22, 9%), scream and screaming (40, 13%), offense (18, 6%) | Topic words from games, sports and news. They are already in `conflict`; consider keeping them only there. `damn` (415, 29%) is as often admiration or surprise as anger. |
| `sad` | lose (105, 2%), losing (63, 8%), missed (102, 8%), missing (48, 10%), lost (158, 18%), alone (95, 11%), useless (22, 0%) | Mostly "lose a game" and "missed the shot". Consider phrase entries (`miss_you`, `miss_him`, `miss_her`; see 4.3) in place of bare miss, missed and missing, and leaving lose, losing and lost to `loss`. `disappoint*` shows a low share only because GoEmotions has a separate disappointment label; keep it. |
| `loss` | lose (121, 0%), losing (65, 0%), gone (88, 1%), lost (167, 2%), die (106, 2%), dying (32, 0%) | The death nouns work (died 21%, condolences 36%, loss 11%). The bare lose, losing, lost and gone carry most of the false hits. Phrase forms did not help in this corpus ("lost my", "lost his", "lost her", "lost their": 3 grief comments and 25 others), so the choice is between accepting the noise and dropping lose, losing and gone. |
| `affil` | close (137, 4%), welcome (138, 7%), miss (149, 7%), missed (103, 6%), friends (226, 9%), friend (268, 12%), married (53, 4%), dating (46, 7%), together (131, 9%) | `love` carries the list (1,836 comments, 78%). "You're welcome" is politeness (2 target comments and 27 others), "close" is mostly distance, and the friend and marriage words are topics that `friend` and `family` already count. Raters put "miss you" under sadness, not love (1 and 17). |
| `anx` | pressure (22, 0%), stress (12, 0%), desperate (24, 4%), desperately (14, 0%), insecure (19, 5%) | Do not drop on this evidence alone: GoEmotions has no stress label, so raters had nowhere to put these. Flag for the hit-precision study in DESIGN.md section 3. |
| `grat` | lucky (70, 7%), bless (49, 16%), blessed (14, 14%) | "Lucky shot" and "bless you". `thanks`, `thank` and `thankful` are at 80% to 97%. |
| `apology` | oops (16, 0%), excuse me (17, 12%), my bad (54, 13%), forgive (15, 20%) | Raters did not see remorse in these light formulas. `sorry` itself is at 56%: the rest is "sorry for your loss" and "sorry, but". |
| `negemo` | confused (81, 6%), confusing and confusion (28, 11%) | Raters put these under confusion, which GoEmotions treats as neither positive nor negative. |
| `posemo` | better (589, 59%), huge (101, 43%), calm (38, 39%), won and wins (89, 48%) | Minor, apart from `huge` (see 4.1). |

### 4.3 Words frequent in target comments and not on the list (consider adding)

Checked with the app's scorer: none of these is matched by the category today. Counts are
comments with the target label and comments without it.

| Category | Candidates |
|---|---|
| `posemo` | congrats (92 and 11), congratulations, hilarious (82 and 12), lmao (151 and 81), welcome (108 and 31), wish (328 and 64), interesting (171 and 88) |
| `negemo` | weird (140 and 133), creepy (49 and 21), ridiculous (45 and 31), bullshit (29 and 14), unfortunately (51 and 47), poor as in "poor guy" (86 and 91) |
| `anger` | `shut_up` (26 and 8), `how_dare` (31 and 7), sucks and suck (87 and 121, now only in `negemo`), bullshit (26 and 17), wtf (22 and 22), moron (16 and 15), dumbass (13 and 15), ridiculous (30 and 46) |
| `sad` | hurts (33 and 26), painful (27 and 15), `sorry_for_your_loss` (21 and 9), `miss_you`, `miss_him`, `miss_her`, `miss_them`, `miss_my` (17 and 10 together), rip (13 and 24), died (24 and 48), `so_sorry` (41 and 56) |
| `anx` | creepy (16 and 54), nightmare (10 and 19), dangerous (17 and 25), terrible and horrible (now only in `negemo`) |
| `affil`, for caring | `stay_safe` (16 and 2), `be_careful` (17 and 6), `don't_worry` (38 and 25), praying (11 and 10) |
| `loss` | rip (9 and 28). With 77 grief comments there is too little to judge additions; `sorry_for_your_loss` appears in 5 grief comments and 25 others, most of those labeled sadness or caring |
| `grat` | none needed; the misses are comments that thank without a thanking word |
| `apology` | guilty (8 and 17), weak |

### 4.4 Chinese (weak evidence, from TV dialogue)

1. **Guard words `很高`, `很難`, `太難`, `很快`, `很低` swallow the next emotion word.**
   Found while trying toy sentences, then confirmed with direct probes through the app's
   scorer. `我很高興`, `我很難過`, `太難過了`, `真的很難過`, `很難受`, `很快樂` and `很低落`
   produce no emotion hit at all, because forward longest-match cuts `很難` + `過` and
   `很高` + `興`. `我好難過`, `非常難過` and `有點難過` count correctly. In CPED this costs
   only a handful of utterances, since the lines are short. In journal writing `很難過` and
   `很高興` are everyday phrases, so this is likely the largest single source of missed
   Chinese emotion words. Options for the owner: drop the `很` + adjective and `太` +
   adjective pairs from `ZH_COMMON` when the adjective's first character begins a listed
   word, or add `很難過`, `很難受`, `很高興`, `很快樂`, `很低落`, `太難過`, `太高興` as
   entries. To reproduce:
   `echo '{"id":"a","text":"我很難過"}' | node lab/langval/score_texts.mjs --hits`
2. **Bare `幹` in `anger`.** It hit 553 utterances, nearly all `幹什麼` ("doing what"),
   and only 22% of them were labeled anger. `ZH_COMMON` guards `幹嘛` and `幹麻` but not
   `幹什麼`, `幹麼` or `幹啥`. Suggest adding those three to the guard list.
3. **Simplified text is undercounted.** On the original Simplified text the lists found
   a `posemo` word in 1.3% of utterances, against 3.8% after conversion, and the gap is
   as large or larger for the other categories (Table 8). `DESIGN.md` section 4 says Simplified forms are included for entries whose
   characters differ; in practice most are missing. Either add them or tell users that
   Simplified text is undercounted (the code comment in `tokenize.js` already says so).
4. Low-share entries: `希望` (143 utterances, 13% positive), `愛` (268, 18%, often
   `愛吃` "likes to eat" or part of a name), `成功` (59, 12%), `滿意` (48, 10%).
5. Frequent in target utterances and not matched: `太好了`, `真好`, `好看` (positive);
   `怎麼辦`, `萬一`, `沒事吧` (worry); `憑什麼`, `有病`, `廢話` (anger). These are
   spoken-drama phrases and may not suit journal text.

## 5. Deviations from the preregistration

- None in the confirmatory analysis: data, scores, groups, metrics, thresholds and
  family sizes are as planned, and the hashes in `PREREG.lock` matched at run time.
- Added after seeing the results, and therefore post hoc: the reading of which surface
  forms each wildcard matched (4.1), and the direct probes of Chinese phrases (4.4,
  item 1). The plan mentioned word reading in general terms but not these two checks.
- The plan did not say how candidate words would be tokenized. They were found with a
  plain regular expression (English) and with 2 and 3 character strings (Chinese), and
  each candidate was then checked against the list with the app's scorer.

## 6. Limits

- Reddit comments are not journal entries, and this is not the English that Murmur's
  users in Taiwan write. Swearing, sports talk and sarcasm are far more common here.
- The labels are what raters perceived in a comment, not what the writer felt. A label
  was kept when at least two raters agreed.
- The test was run at about 13 words per text. The app does not show emotion rates
  under 300 words. How these lists behave over a month of someone's entries was not
  tested.
- Separating labeled groups of comments is not person-level validity. Nothing here
  says that a person with a higher sadness-word rate is sadder.
- The suggestions in section 4 were found on the same comments as the verdicts.
- CPED: scripted mainland dialogue, script conversion by OpenCC, utterances of 8
  characters. `PREREG.md` says the annotators watched the video. I wrote that from memory
  of the paper; the repository README says only that the utterances come "with
  multi-modal context". Treat it as likely and unverified.
- The preregistration is self-attested: the repository had uncommitted work by others
  at the time, so the plan could not be committed before the run. `PREREG.lock` holds
  the hashes and the time.

## 7. Full tables

### English

Analysed 43,396 of 43,410 texts (14 not assigned to 'en' by the app's language detector, 0 with zero units). Mean length 12.9 words, median 12. Neutral texts: 12,813. Bootstrap: 10,000 resamples, seed 20261124. Adjusted interval level: 99.50%.

#### English, Table 1. Known groups: target against neutral

| Category | Target labels | n target | AUC | 95% interval | Adjusted interval | r | r 95% interval | AUC with raw count |
|---|---|---|---|---|---|---|---|---|
| `posemo` positive emotion | 12 labels | 17,409 | .79 | .79 to .79 | .78 to .80 | .41 | .40 to .42 | .78 |
| `negemo` negative emotion | 11 labels | 9,836 | .72 | .72 to .73 | .71 to .73 | .35 | .34 to .36 | .72 |
| `anx` anxiety (worry words) | fear, nervousness | 726 | .78 | .76 to .80 | .75 to .81 | .51 | .47 to .55 | .78 |
| `anger` anger | anger, annoyance | 3,767 | .68 | .67 to .69 | .67 to .69 | .34 | .33 to .36 | .68 |
| `sad` sadness | sadness, grief | 1,381 | .69 | .67 to .70 | .67 to .71 | .37 | .33 to .41 | .69 |
| `grat` gratitude | gratitude | 2,662 | .93 | .92 to .94 | .92 to .94 | .66 | .65 to .68 | .93 |
| `affil` love and closeness | love, caring | 3,132 | .76 | .75 to .77 | .75 to .77 | .45 | .43 to .47 | .76 |
| `loss` loss and grief | grief | 77 | .81 | .75 to .86 | .73 to .89 | .29 | .22 to .37 | .81 |
| `apology` apology and regret | remorse | 545 | .94 | .93 to .96 | .93 to .96 | .64 | .57 to .71 | .94 |

#### English, Table 2. Coverage and hit precision

| Category | Target texts with a hit | Neutral texts with a hit | Other emotional texts with a hit | All texts with zero hits | Of texts with a hit, share with a target label | Share of all texts with a target label |
|---|---|---|---|---|---|---|
| `posemo` | 66.5% (65.8% to 67.2%) | 11.0% (10.5% to 11.5%) | 10.5% | 66.9% | 80.6% (80.0% to 81.2%; 14,355 texts) | 40.1% |
| `negemo` | 57.7% (56.7% to 58.7%) | 14.9% (14.3% to 15.5%) | 13.4% | 76.1% | 54.7% (53.8% to 55.7%; 10,369 texts) | 22.7% |
| `anx` | 56.9% (53.3% to 60.4%) | 1.1% (1.0% to 1.3%) | 1.1% | 97.9% | 46.4% (43.2% to 49.7%; 890 texts) | 1.7% |
| `anger` | 40.7% (39.1% to 42.3%) | 5.7% (5.3% to 6.1%) | 5.6% | 91.3% | 40.7% (39.2% to 42.3%; 3,765 texts) | 8.7% |
| `sad` | 40.0% (37.5% to 42.7%) | 2.6% (2.3% to 2.9%) | 3.3% | 95.7% | 29.9% (27.9% to 32.0%; 1,849 texts) | 3.2% |
| `grat` | 86.3% (84.9% to 87.5%) | 0.4% (0.3% to 0.6%) | 0.9% | 94.0% | 87.9% (86.6% to 89.1%; 2,613 texts) | 6.1% |
| `affil` | 57.3% (55.6% to 59.0%) | 6.1% (5.7% to 6.6%) | 6.3% | 90.1% | 41.8% (40.3% to 43.2%; 4,298 texts) | 7.2% |
| `loss` | 63.6% (52.5% to 73.5%) | 2.3% (2.0% to 2.6%) | 2.2% | 97.7% | 4.9% (3.7% to 6.4%; 1,005 texts) | 0.2% |
| `apology` | 89.4% (86.5% to 91.7%) | 0.5% (0.4% to 0.6%) | 1.5% | 97.7% | 49.3% (46.2% to 52.5%; 987 texts) | 1.3% |

#### English, Table 3. Specificity, discriminant checks and verdict

| Category | AUC vs other emotional (95%) | Opposite labels | Opposite AUC vs neutral (95%) | Target minus opposite (adjusted) | Near labels | Near AUC vs neutral (95%) | Target minus near (95%) | Verdict |
|---|---|---|---|---|---|---|---|---|
| `posemo` | .79 (.79 to .80) | 11 labels | .50 (.49 to .50) | .29 (.29 to .30) |  |  |  | **supported** |
| `negemo` | .73 (.73 to .74) | 12 labels | .49 (.48 to .49) | .24 (.23 to .24) |  |  |  | **supported** |
| `anx` | .78 (.76 to .80) | joy | .50 (.50 to .50) | .28 (.26 to .31) | anger, annoyance | .50 (.50 to .50) | .28 (.26 to .30) | **supported** |
| `anger` | .68 (.67 to .69) | joy | .49 (.49 to .50) | .19 (.17 to .20) | sadness, grief | .51 (.50 to .52) | .17 (.16 to .18) | **supported** |
| `sad` | .69 (.67 to .70) | joy | .50 (.49 to .50) | .19 (.17 to .21) | anger, annoyance | .50 (.50 to .50) | .19 (.17 to .20) | **supported** |
| `grat` | .93 (.92 to .93) | anger, annoyance | .50 (.50 to .50) | .43 (.42 to .44) | joy | .50 (.50 to .51) | .43 (.42 to .43) | **supported** |
| `affil` | .76 (.75 to .77) | anger, annoyance | .49 (.49 to .50) | .27 (.25 to .28) | joy | .51 (.51 to .52) | .25 (.23 to .26) | **supported** |
| `loss` | .81 (.76 to .86) | joy | .50 (.49 to .50) | .31 (.23 to .39) | anger, annoyance | .50 (.50 to .50) | .31 (.25 to .36) | **supported** |
| `apology` | .94 (.93 to .95) | joy | .50 (.50 to .50) | .44 (.43 to .46) | sadness, grief | .56 (.55 to .57) | .38 (.37 to .40) | **supported** |

#### English, Table 4. Valence contrast: positive against negative texts

| Score | n positive | n negative | AUC | 95% interval | Adjusted interval | r | Texts with a score of exactly 0 | Verdict |
|---|---|---|---|---|---|---|---|---|
| `tone` | 16,588 | 9,015 | .87 | .87 to .87 | .86 to .88 | .52 (.51 to .52) | 37.5% | **supported** |
| VADER compound (reference) | | | .88 | .88 to .89 | | .63 (.63 to .64) | | no verdict |
| tone minus VADER | | | -.01 | -.01 to -.01 | | | | |

#### English, Table 5. VADER as a reference on the same comments

| Category | Category AUC vs neutral | VADER AUC vs neutral (95%) | Category minus VADER (95%) | Category AUC vs other emotional | VADER AUC vs other emotional (95%) | Category minus VADER (95%) | VADER: opposite vs neutral | VADER: near vs neutral |
|---|---|---|---|---|---|---|---|---|
| `posemo` | .79 | .77 (.76 to .77) | .02 (.02 to .03) | .79 | .84 (.84 to .84) | -.05 (-.05 to -.04) | .31 | n/a |
| `negemo` | .72 | .67 (.67 to .68) | .05 (.04 to .06) | .73 | .83 (.83 to .84) | -.10 (-.11 to -.09) | .22 | n/a |
| `anx` | .78 | .73 (.71 to .75) | .05 (.02 to .07) | .78 | .77 (.76 to .79) | .00 (-.02 to .03) | .16 | .70 |
| `anger` | .68 | .70 (.69 to .71) | -.02 (-.03 to -.01) | .68 | .78 (.77 to .79) | -.10 (-.11 to -.09) | .16 | .71 |
| `sad` | .69 | .71 (.70 to .73) | -.03 (-.05 to -.01) | .69 | .76 (.75 to .78) | -.08 (-.10 to -.06) | .16 | .70 |
| `grat` | .93 | .83 (.83 to .84) | .10 (.09 to .11) | .93 | .72 (.71 to .73) | .21 (.20 to .22) | .30 | .83 |
| `affil` | .76 | .79 (.78 to .80) | -.04 (-.05 to -.03) | .76 | .70 (.69 to .71) | .06 (.05 to .07) | .30 | .84 |
| `loss` | .81 | .66 (.59 to .72) | .15 (.08 to .22) | .81 | .71 (.66 to .76) | .10 (.04 to .16) | .16 | .70 |
| `apology` | .94 | .61 (.58 to .63) | .33 (.31 to .36) | .94 | .67 (.66 to .69) | .27 (.24 to .29) | .16 | .71 |

VADER is signed so that a higher value should go with the target (minus compound for the negative categories).

#### English, Table 6. Exploratory rows (no verdict)

| Category | Target labels | n target | AUC vs neutral (95%) | AUC vs other emotional (95%) | r (95%) | Target texts with a hit | Neutral texts with a hit |
|---|---|---|---|---|---|---|---|
| `care` care (moral theme) | caring | 1,087 | .57 (.56 to .58) | .57 (.56 to .58) | .18 (.15 to .21) | 17.4% | 3.1% |
| `conflict` conflict | anger, annoyance | 3,767 | .51 (.50 to .51) | .51 (.51 to .51) | .02 (.01 to .04) | 4.3% | 2.9% |
| `lonely` loneliness | sadness, grief | 1,381 | .51 (.50 to .51) | .51 (.51 to .51) | .04 (.02 to .07) | 3.0% | 1.1% |
| `risk` risk and caution | fear, nervousness | 726 | .52 (.51 to .53) | .52 (.51 to .53) | .08 (.05 to .12) | 5.4% | 1.5% |
| `insight` insight | realization | 1,110 | .63 (.62 to .65) | .63 (.62 to .65) | .14 (.12 to .16) | 43.6% | 17.0% |
| `tentat` hedging | confusion | 1,367 | .61 (.59 to .62) | .62 (.61 to .64) | .12 (.10 to .14) | 41.7% | 21.0% |
| `achieve` achievement | pride | 111 | .52 (.50 to .54) | .52 (.49 to .54) | .03 (.00 to .08) | 6.3% | 2.7% |
| `reward` reward | joy, excitement | 2,219 | .57 (.57 to .58) | .57 (.56 to .57) | .21 (.19 to .23) | 17.2% | 2.4% |
| `polite` politeness | gratitude | 2,662 | .92 (.92 to .93) | .91 (.90 to .92) | .64 (.62 to .66) | 85.8% | 1.5% |
| `loss` loss and grief (wider target) | grief, sadness | 1,381 | .54 (.53 to .55) | .54 (.53 to .55) | .13 (.10 to .16) | 10.4% | 2.3% |

#### English, Table 7. Descriptive: AUC against neutral for every label (no tests)

| Label (n) | `achieve` | `affil` | `anger` | `anx` | `apology` | `care` | `conflict` | `grat` | `insight` | `lonely` | `loss` | `negemo` | `polite` | `posemo` | `reward` | `risk` | `sad` | `tentat` | `tone` | `vader` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| admiration (4,130) | .51 | .52 | .50 | .50 | .50 | .50 | .49 | .54 | .48 | .50 | .49 | .48 | .53 | .83 | .51 | .50 | .50 | .45 | .81 | .83 |
| amusement (2,327) | .50 | .51 | .51 | .50 | .51 | .50 | .50 | .52 | .51 | .50 | .50 | .52 | .52 | .86 | .53 | .50 | .50 | .49 | .80 | .77 |
| anger (1,567) | .49 | .49 | .75 | .50 | .50 | .50 | .50 | .50 | .47 | .50 | .50 | .78 | .51 | .50 | .50 | .50 | .50 | .46 | .24 | .24 |
| annoyance (2,469) | .50 | .50 | .63 | .50 | .50 | .51 | .51 | .50 | .51 | .50 | .50 | .69 | .51 | .51 | .50 | .50 | .50 | .48 | .34 | .33 |
| approval (2,939) | .51 | .51 | .50 | .50 | .50 | .51 | .50 | .51 | .52 | .50 | .50 | .50 | .51 | .59 | .51 | .50 | .50 | .50 | .58 | .66 |
| caring (1,087) | .50 | .55 | .50 | .51 | .52 | .57 | .49 | .52 | .49 | .50 | .50 | .54 | .53 | .68 | .54 | .53 | .51 | .52 | .63 | .66 |
| confusion (1,367) | .50 | .50 | .50 | .50 | .50 | .50 | .49 | .51 | .61 | .50 | .50 | .54 | .51 | .52 | .50 | .49 | .50 | .61 | .48 | .47 |
| curiosity (2,191) | .50 | .50 | .50 | .50 | .51 | .50 | .50 | .51 | .53 | .50 | .50 | .51 | .52 | .53 | .50 | .50 | .50 | .52 | .52 | .53 |
| desire (641) | .51 | .53 | .50 | .50 | .50 | .51 | .50 | .51 | .49 | .50 | .51 | .52 | .52 | .63 | .52 | .50 | .51 | .53 | .60 | .70 |
| disappointment (1,269) | .51 | .52 | .52 | .51 | .51 | .51 | .50 | .50 | .51 | .51 | .52 | .72 | .51 | .52 | .50 | .50 | .60 | .49 | .31 | .32 |
| disapproval (2,019) | .51 | .50 | .52 | .50 | .50 | .51 | .51 | .50 | .52 | .50 | .50 | .56 | .51 | .51 | .50 | .50 | .50 | .50 | .46 | .41 |
| disgust (793) | .50 | .49 | .57 | .50 | .51 | .50 | .49 | .50 | .48 | .50 | .50 | .80 | .51 | .50 | .50 | .50 | .50 | .47 | .23 | .25 |
| embarrassment (303) | .50 | .49 | .52 | .50 | .54 | .49 | .50 | .50 | .51 | .51 | .50 | .78 | .52 | .51 | .50 | .50 | .51 | .50 | .26 | .33 |
| excitement (853) | .50 | .52 | .50 | .50 | .50 | .49 | .49 | .51 | .47 | .50 | .49 | .47 | .51 | .71 | .52 | .49 | .49 | .46 | .70 | .74 |
| fear (596) | .50 | .50 | .51 | .78 | .50 | .50 | .50 | .50 | .50 | .50 | .50 | .84 | .51 | .50 | .49 | .52 | .51 | .50 | .20 | .26 |
| gratitude (2,662) | .50 | .51 | .49 | .50 | .51 | .51 | .49 | .93 | .52 | .50 | .49 | .48 | .92 | .94 | .51 | .50 | .50 | .46 | .91 | .83 |
| grief (77) | .50 | .53 | .53 | .50 | .59 | .50 | .49 | .51 | .46 | .49 | .81 | .73 | .60 | .58 | .51 | .49 | .66 | .49 | .37 | .34 |
| joy (1,452) | .50 | .53 | .49 | .50 | .50 | .51 | .49 | .52 | .48 | .50 | .50 | .48 | .53 | .89 | .61 | .50 | .50 | .47 | .86 | .84 |
| love (2,086) | .50 | .87 | .50 | .50 | .50 | .50 | .50 | .51 | .47 | .50 | .49 | .49 | .51 | .89 | .50 | .49 | .50 | .45 | .85 | .86 |
| nervousness (164) | .49 | .48 | .51 | .81 | .50 | .50 | .50 | .50 | .50 | .50 | .51 | .81 | .50 | .50 | .49 | .51 | .52 | .49 | .22 | .28 |
| optimism (1,581) | .52 | .52 | .50 | .50 | .51 | .52 | .49 | .52 | .51 | .50 | .50 | .51 | .53 | .79 | .56 | .50 | .51 | .56 | .75 | .75 |
| pride (111) | .52 | .49 | .50 | .50 | .50 | .52 | .49 | .51 | .46 | .49 | .49 | .49 | .51 | .77 | .51 | .49 | .50 | .45 | .74 | .77 |
| realization (1,110) | .50 | .51 | .50 | .50 | .51 | .50 | .50 | .52 | .63 | .50 | .51 | .54 | .52 | .55 | .50 | .50 | .52 | .51 | .50 | .51 |
| relief (153) | .50 | .51 | .50 | .51 | .50 | .51 | .49 | .57 | .49 | .51 | .51 | .53 | .56 | .80 | .51 | .51 | .51 | .48 | .74 | .70 |
| remorse (545) | .50 | .50 | .50 | .50 | .94 | .50 | .50 | .51 | .52 | .50 | .51 | .89 | .90 | .54 | .50 | .50 | .55 | .49 | .19 | .39 |
| sadness (1,326) | .50 | .53 | .51 | .51 | .58 | .53 | .50 | .50 | .49 | .51 | .53 | .81 | .58 | .53 | .50 | .50 | .69 | .48 | .23 | .28 |
| surprise (1,060) | .50 | .49 | .50 | .50 | .50 | .50 | .49 | .51 | .54 | .50 | .50 | .50 | .50 | .52 | .50 | .50 | .50 | .53 | .52 | .59 |

For `vader` and `tone` a value under .50 means the label's texts score lower (more negative) than neutral ones.

### Chinese

Analysed 93,992 of 94,187 texts (195 not assigned to 'zh' by the app's language detector, 0 with zero units). Mean length 8.2 Han characters, median 8. Neutral texts: 31,683. Bootstrap: 10,000 resamples, seed 20261124. Adjusted interval level: 99.29%.

#### Chinese, Table 1. Known groups: target against neutral

| Category | Target labels | n target | AUC | 95% interval | Adjusted interval | r | r 95% interval | AUC with raw count |
|---|---|---|---|---|---|---|---|---|
| `posemo` positive emotion | happy, grateful, relaxed, positive-other | 15,135 | .52 | .52 to .53 | .52 to .53 | .10 | .09 to .11 | .52 |
| `negemo` negative emotion | 7 labels | 44,750 | .51 | .51 to .51 | .51 to .51 | .04 | .04 to .05 | .51 |
| `anx` anxiety (worry words) | fear, worried | 8,119 | .50 | .50 to .51 | .50 to .51 | .03 | .02 to .04 | .50 |
| `anger` anger | anger | 13,389 | .51 | .51 to .51 | .51 to .51 | .05 | .04 to .06 | .51 |
| `sad` sadness | sadness, depress | 12,026 | .50 | .50 to .50 | .50 to .50 | .02 | .01 to .03 | .50 |
| `grat` gratitude | grateful | 204 | .80 | .75 to .85 | .73 to .87 | .48 | .41 to .55 | .80 |

#### Chinese, Table 2. Coverage and hit precision

| Category | Target texts with a hit | Neutral texts with a hit | Other emotional texts with a hit | All texts with zero hits | Of texts with a hit, share with a target label | Share of all texts with a target label |
|---|---|---|---|---|---|---|
| `posemo` | 8.3% (7.8% to 8.7%) | 3.5% (3.3% to 3.8%) | 2.4% | 96.2% | 35.4% (33.9% to 37.0%; 3,527 texts) | 16.1% |
| `negemo` | 6.3% (6.1% to 6.5%) | 4.1% (3.9% to 4.3%) | 3.6% | 94.9% | 59.1% (57.7% to 60.5%; 4,754 texts) | 47.6% |
| `anx` | 1.7% (1.4% to 2.0%) | 0.8% (0.7% to 0.9%) | 0.8% | 99.1% | 16.6% (14.3% to 19.3%; 823 texts) | 8.6% |
| `anger` | 2.6% (2.3% to 2.9%) | 1.1% (1.0% to 1.2%) | 1.5% | 98.5% | 24.4% (22.2% to 26.7%; 1,413 texts) | 14.2% |
| `sad` | 0.7% (0.6% to 0.9%) | 0.4% (0.3% to 0.4%) | 0.4% | 99.6% | 19.7% (16.2% to 23.8%; 421 texts) | 12.8% |
| `grat` | 59.8% (53.0% to 66.3%) | 0.5% (0.5% to 0.6%) | 0.4% | 99.4% | 21.7% (18.5% to 25.3%; 561 texts) | 0.2% |

#### Chinese, Table 3. Specificity, discriminant checks and verdict

| Category | AUC vs other emotional (95%) | Opposite labels | Opposite AUC vs neutral (95%) | Target minus opposite (adjusted) | Near labels | Near AUC vs neutral (95%) | Target minus near (95%) | Verdict |
|---|---|---|---|---|---|---|---|---|
| `posemo` | .53 (.53 to .53) | 7 labels | .49 (.49 to .50) | .03 (.03 to .03) |  |  |  | **not supported** |
| `negemo` | .51 (.51 to .52) | happy, grateful, relaxed, positive-other | .50 (.49 to .50) | .01 (.01 to .02) |  |  |  | **not supported** |
| `anx` | .50 (.50 to .51) | happy | .50 (.50 to .50) | .01 (.00 to .01) | anger | .50 (.50 to .50) | .01 (.00 to .01) | **not supported** |
| `anger` | .51 (.50 to .51) | happy | .50 (.50 to .50) | .01 (.01 to .01) | sadness, depress | .50 (.50 to .50) | .00 (.00 to .01) | **not supported** |
| `sad` | .50 (.50 to .50) | happy | .50 (.50 to .50) | .00 (.00 to .00) | anger | .50 (.50 to .50) | .00 (.00 to .00) | **not supported** |
| `grat` | .80 (.75 to .85) | anger | .50 (.50 to .50) | .30 (.23 to .38) | happy | .51 (.50 to .51) | .29 (.24 to .35) | **supported** |

#### Chinese, Table 4. Valence contrast: positive against negative texts

| Score | n positive | n negative | AUC | 95% interval | Adjusted interval | r | Texts with a score of exactly 0 | Verdict |
|---|---|---|---|---|---|---|---|---|
| `tone` | 15,135 | 44,750 | .54 | .54 to .54 | .54 to .55 | .12 (.11 to .13) | 90.7% | **not supported** |

#### Chinese, Table 7. Descriptive: AUC against neutral for every label (no tests)

| Label (n) | `anger` | `anx` | `grat` | `negemo` | `posemo` | `sad` | `tone` |
|---|---|---|---|---|---|---|---|
| happy (3,534) | .50 | .50 | .51 | .49 | .54 | .50 | .54 |
| grateful (204) | .49 | .50 | .80 | .49 | .77 | .50 | .77 |
| relaxed (7,428) | .50 | .50 | .50 | .50 | .51 | .50 | .51 |
| positive-other (3,969) | .50 | .50 | .50 | .49 | .52 | .50 | .53 |
| anger (13,389) | .51 | .50 | .50 | .51 | .49 | .50 | .48 |
| sadness (2,217) | .50 | .50 | .50 | .52 | .50 | .51 | .48 |
| fear (1,979) | .51 | .50 | .50 | .51 | .49 | .50 | .48 |
| depress (9,809) | .50 | .50 | .50 | .51 | .50 | .50 | .49 |
| disgust (1,352) | .50 | .50 | .50 | .51 | .49 | .50 | .49 |
| worried (6,140) | .50 | .50 | .50 | .52 | .49 | .50 | .48 |
| negative-other (9,864) | .50 | .50 | .50 | .51 | .50 | .50 | .49 |
| astonished (2,424) | .51 | .50 | .50 | .51 | .49 | .50 | .48 |

For `vader` and `tone` a value under .50 means the label's texts score lower (more negative) than neutral ones.

#### Chinese, Table 8. Share of utterances with at least one hit, before and after script conversion

| Category | Original Simplified text | Converted to Traditional (analysed) |
|---|---|---|
| `posemo` | 1.3% | 3.8% |
| `negemo` | 2.1% | 5.1% |
| `anx` | 0.5% | 0.9% |
| `anger` | 0.4% | 1.5% |
| `sad` | 0.3% | 0.4% |
| `grat` | 0.1% | 0.6% |

