# Licenses of lexica and tools considered for the language analysis feature

Checked on 2026-11-24. This is a working summary for design decisions, not legal advice.

Murmur is a free, public, non-commercial web app whose code is MIT licensed and whose files are served from a public GitHub repository. Putting a lexicon in the repository is redistribution, so a resource can only be bundled if its terms allow redistribution to the public. "Free for research" is not enough.

How to read the "Bundle" column:

- **yes**: an open license that permits redistribution was found on the official page.
- **yes, with conditions**: redistribution is permitted but the license adds duties (non-commercial, share-alike) that the MIT license of the app does not carry. The file must sit in its own folder with its own license notice.
- **no**: the terms prohibit redistribution, or access is by application or purchase only.
- **unclear**: no license statement was found. Without a license, default copyright applies, so treat as no until the authors give written permission.

The "Checked" column says how the license was confirmed: **page** means the official page was read in this session, **recalled** means it is written from prior knowledge and the official page could not be opened or did not state it. Recalled rows need a manual check before anyone relies on them.

## Summary table

| Resource | Language | License or terms | Bundle | Attribution or notice required | Checked |
|---|---|---|---|---|---|
| LIWC-22 (software and dictionary) | en | Proprietary EULA. "You may not share or redistribute the LIWC application or any of its components with anyone"; no reverse engineering or derivative works | no | n/a | page [1] |
| C-LIWC (Traditional Chinese LIWC, Huang et al. 2012) and other LIWC translations | zh-TW | Distributed through the LIWC dictionary repository to licensed LIWC users only; same EULA limits apply | no | n/a | page [1][2] for the EULA and repository; C-LIWC's own terms recalled |
| Receptiviti API | en | Commercial hosted API, proprietary. It would also send the user's text to a server, which Murmur does not do | no | n/a | recalled |
| DLATK (code) | n/a | GNU GPL v3 | no (not needed). The engine is Python and MySQL and cannot run in the browser. Copying its code into the app would put the app under GPL v3. Reimplementing its published methods from the papers is fine | Cite Schwartz et al. (2017) for the method | page [3] |
| WWBP lexica in github.com/wwbp/lexica: PERMA, Spanish PERMA, age and gender, affect and intensity, temporal orientation (prospection), plus `happiness` and `life_satisfaction` folders | en (es for Spanish PERMA) | README: "Unless specified in the lexica's subdirectory", all lexica are CC BY-NC-SA 3.0 Unported. The DLATK docs add that some lexica have more restrictive licenses than DLATK and each should be reviewed | yes, with conditions (non-commercial, share-alike, attribution). Check each subdirectory for an overriding notice before bundling | Name of the lexicon, the authors, link to wwbp.org/lexica, the CC BY-NC-SA 3.0 notice, a note of any changes (for example conversion to JSON), and the paper: Schwartz et al. (2016) for PERMA, Sap et al. (2014) for age and gender, Preoţiuc-Pietro et al. (2016) for affect and intensity, Schwartz et al. (2015) for temporal orientation | page [4][5][6]; the PERMA license file itself could not be opened, its CC BY-NC-SA 3.0 status is confirmed by the repo README and by a third-party package that bundles it [7] |
| WWBP Big Five personality models (Schwartz et al. 2013; Park et al. 2015) | en | Not offered as a downloadable lexicon on the WWBP lexica page. The page lists "refined lexica" as available by email to the authors | unclear (ask the authors) | n/a | page [4] |
| WWBP depression lexicon or model | en | Not listed on the WWBP lexica page or in the repo README | unclear. Not wanted in any case: see the safety section of DESIGN.md | n/a | page [4][5] |
| VADER (code and `vader_lexicon.txt`) | en | MIT | yes | MIT copyright notice in the file or in a NOTICE file; cite Hutto and Gilbert (2014) | page [8] |
| Empath | en | The PyPI index lists the license as "Other". The GitHub repository is recalled as MIT but this was not confirmed | unclear until the LICENSE file in the repository is read | Cite Fast, Chen and Bernstein (2016) | page [9] for PyPI; repository recalled |
| NRC Emotion Lexicon (EmoLex) | en, with machine translations | Free for non-commercial research. "Do not redistribute the data"; commercial use needs a paid license from NRC | no | If used at all, credit the authors and NRC on the About page | page [10][11] |
| NRC VAD Lexicon | en, with machine translations | Same NRC terms as EmoLex | no | Same | page [10][11] |
| SentiWordNet 3.0 | en | CC BY-SA 4.0. Built on Princeton WordNet 3.0, which has its own permissive license | yes, with conditions (share-alike, attribution). Low value here: it is sense-level, large, and needs word sense disambiguation | Name SentiWordNet and its authors, state the license, cite Baccianella, Esuli and Sebastiani (2010); keep the WordNet notice | page [12] |
| Moral Foundations Dictionary 2.0 | en | No license statement found on the pages that distribute or document it | unclear, treat as no | Cite Frimer et al. (2019) | page [13]; the OSF page did not render |
| CVAW, CVAP (Chinese EmoBank: valence and arousal words and phrases) | zh-TW | No license text found. Recalled as available on request for academic research | unclear, treat as no | Cite Yu et al. (2016) and Lee, Li and Yu (2022) | recalled; paper verified [14] |
| NTUSD (NTU Sentiment Dictionary) | zh-TW, zh-CN | No open license found. Recalled as obtained by request for academic use | no | Cite Ku and Chen (2007) | recalled |
| ANTUSD | zh-TW | The paper says it "can be freely obtained through application from NLPSA lab, Academia Sinica". Access by application, no redistribution license | no | Cite Wang and Ku (2016) | page [15] |
| DUTIR affective lexicon ontology (大連理工情感詞彙本體) | zh-CN | Terms page could not be found. Recalled as free for academic research with citation, no commercial use, obtained by request | no | Cite Xu et al. (2008) | recalled |
| HowNet and the HowNet sentiment word lists | zh-CN, en | HowNet is a proprietary knowledge base. The OpenHowNet page read here states no license for the data and only asks for citation | unclear, treat as no | Cite Dong and Dong (2006); Qi et al. (2019) for OpenHowNet | page [16] for OpenHowNet; HowNet's own terms recalled |
| "Open" Chinese LIWC-like lists on GitHub and elsewhere | zh | Usually copies or translations of C-LIWC or SC-LIWC uploaded without permission. A repository license does not make the content licensed | no | n/a | recalled |
| jieba (code and `dict.txt`) | zh | MIT | yes for the license. Not recommended for the bundle because the dictionary is several megabytes and is built mainly on Simplified Chinese text | MIT copyright notice | page [17] |
| `Intl.Segmenter` (built into browsers) | all | Part of the browser (ICU data, Unicode license). Nothing is redistributed by the app | yes (nothing to bundle) | none | recalled |
| CC-CEDICT (Chinese word list, possible source for a small segmentation word list) | zh-TW, zh-CN | CC BY-SA 4.0 | yes, with conditions (share-alike, attribution). Not needed for version 1 | Name CC-CEDICT, link to its page, state the license | recalled |

## What this means for the design

1. **English.** The only ready-made affect resource that is cleanly bundle-allowed under a permissive license is VADER (MIT). The WWBP lexica (PERMA, affect and intensity, temporal orientation, age and gender) may be bundled as separate CC BY-NC-SA 3.0 data files, because Murmur is non-commercial. They must stay in their own folder with a license file, and anyone who reuses Murmur commercially would have to remove them. The age and gender lexica should not be used at all for product reasons (guessing a user's age or gender is not reflection).
2. **Traditional Chinese.** No existing zh-TW psychological lexicon was found to be bundle-allowed. C-LIWC is closed, and CVAW, NTUSD, ANTUSD, DUTIR and HowNet are either by application, research-only, or have no license. The zh-TW categories therefore have to be written by hand for this project and released under the app's own license.
3. **Hand-authored categories are legally clean when done from linguistic knowledge.** Closed-class words (pronouns, negations, particles, tense and aspect markers, conjunctions) are facts of the language that any grammar lists. Writing these lists from grammars and the author's own knowledge, without opening LIWC or C-LIWC while doing it, copies nothing. DESIGN.md records the authoring rule.
4. **Tokenization.** `Intl.Segmenter` and a longest-match lookup against the app's own category lists need no third-party data.
5. **NRC lexica.** Many public apps bundle EmoLex, but the NRC terms say not to redistribute, so Murmur should not.

## Notice text to add if a conditional resource is bundled

Place in `js/langlab/third_party/<name>/LICENSE.txt` and repeat in the evidence report.

VADER:

> VADER Sentiment lexicon. Copyright (c) 2016 C.J. Hutto. MIT License. Hutto, C. J., & Gilbert, E. (2014). VADER: A parsimonious rule-based model for sentiment analysis of social media text. ICWSM-14.

(Copy the exact copyright line from the repository's LICENSE file when adding it; the year above is recalled.)

WWBP lexica:

> [Lexicon name] by the World Well-Being Project, University of Pennsylvania (wwbp.org/lexica). Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported (creativecommons.org/licenses/by-nc-sa/3.0/). Converted to JSON for this app; weights unchanged. [Paper citation for that lexicon.]

## Open items

- Read the `LICENSE` file of the Empath GitHub repository.
- Open each subdirectory of github.com/wwbp/lexica to confirm no overriding license notice, and read `ddpermav3_license.txt`.
- If zh-TW valence norms are wanted later, write to the CVAW authors (Yuan Ze University) and ask for written permission to bundle. Until then, do not use it.
- Ask the WWBP authors directly about the personality models; the owner works with this lab.

## Sources

1. LIWC End User License Agreement: https://liwc.app/help/eula
2. LIWC dictionary repository (login required): https://liwc.app/dictionaries
3. DLATK repository README: https://github.com/dlatk/dlatk/
4. WWBP lexica page: https://www.wwbp.org/lexica
5. WWBP lexica repository: https://github.com/wwbp/lexica
6. DLATK packaged datasets: https://dlatk.github.io/dlatk/datasets
7. Third-party npm package bundling PERMA v3 under CC BY-NC-SA 3.0: https://npmjs.com/package/wellbeing_analysis
8. VADER repository: https://github.com/cjhutto/vaderSentiment
9. Empath on PyPI index: https://libraries.io/pypi/empath
10. NRC lexicons, access and terms: https://saifmohammad.com/WebPages/AccessResource.htm
11. NRC lexicon README: https://www.saifmohammad.com/WebDocs/README-NRC-Lex.txt
12. SentiWordNet repository: https://github.com/aesuli/SentiWordNet
13. MFD in quanteda.dictionaries (no license statement): https://rdrr.io/github/kbenoit/quanteda.dictionaries/man/data_dictionary_MFD.html ; OSF project: https://osf.io/vw85e
14. Yu et al. (2016), CVAW paper: https://aclanthology.org/N16-1066/
15. Wang and Ku (2016), ANTUSD paper: https://aclanthology.org/L16-1428/
16. OpenHowNet repository mirror: https://github.com/koios-sh/OpenHowNet
17. jieba on libraries.io: https://libraries.io/pypi/jieba
