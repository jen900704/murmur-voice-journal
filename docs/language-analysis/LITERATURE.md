# Literature for the language analysis feature

Compiled 2026-11-24. 30 key references (sections A to F) and 7 supporting ones (section G), each with what it shows and its limits for this app.

## How each reference was checked

- **[PubMed]**: matched in PubMed by journal, year, volume and first page; title, authors and DOI taken from the PubMed record. End pages and issue numbers are recalled.
- **[Publisher page]**: the title was found on the publisher's, proceedings' or an institutional repository page through web search in this session. Volume and page numbers are recalled unless a DOI is given.
- **[Title only]**: web search returned the exact title in a bibliography or secondary page, but no publisher record was opened. Details are recalled.
- **[Not verified]**: could not be checked in this session.

A DOI is printed only when it appeared in a database record or search result during this session. Where no DOI was seen, a stable URL is given or the DOI is left out. The Scite and Crossref checks that were planned could not be run (no access from this environment), so verification rests on PubMed and web search.

Summaries describe the papers as the author of this file knows them; numbers quoted from abstracts were read in this session, and other numbers are marked as recalled.

## A. LIWC: history, method and validity


1. Tausczik, Y. R., & Pennebaker, J. W. (2010). The psychological meaning of words: LIWC and computerized text analysis methods. *Journal of Language and Social Psychology, 29*(1), 24–54. https://doi.org/10.1177/0261927X09351676 **[Publisher page]**
   Reviews what LIWC categories have been linked to (attention, emotion, status, thinking styles) and argues that function words carry psychological information. It is a narrative review by the tool's authors, and the effects it gathers are group-level and mostly small.

2. Boyd, R. L., Ashokkumar, A., Seraj, S., & Pennebaker, J. W. (2022). *The development and psychometric properties of LIWC-22*. University of Texas at Austin. https://www.liwc.app **[Publisher page]**
   The manual for the current dictionary: how categories were built, internal consistency, and norms from a large multi-genre corpus. The dictionary and norms are proprietary, and the norms apply only to LIWC's own word lists, so they cannot serve as baselines here.

3. Pennebaker, J. W. (2011). *The secret life of pronouns: What our words say about us*. Bloomsbury Press. **[Publisher page]** (ISBN 978-1-60819-480-3 seen in a trade listing)
   An accessible account of two decades of function-word research. It is a trade book, so it presents findings more confidently than the later multi-lab estimates support.

4. Pennebaker, J. W., & King, L. A. (1999). Linguistic styles: Language use as an individual difference. *Journal of Personality and Social Psychology, 77*(6), 1296–1312. https://doi.org/10.1037//0022-3514.77.6.1296 **[PubMed]**
   Shows that word-category use is reliable within a person across time and writing topics, and relates modestly to personality and health measures. The authors themselves describe the effect sizes as modest; samples were students, inpatients and academics writing in English.

5. Pennebaker, J. W., Chung, C. K., Frazee, J., Lavergne, G. M., & Beaver, D. I. (2014). When small words foretell academic success: The case of college admissions essays. *PLoS ONE, 9*(12), e115844. https://doi.org/10.1371/journal.pone.0115844 **[PubMed]**
   Derives the categorical-dynamic index from eight function-word categories in over 50,000 admissions essays and links it to college grades. One genre, one university, English only; the index has no established equivalent for Chinese.

6. Bantum, E. O., & Owen, J. E. (2009). Evaluating the validity of computerized content analysis programs for identification of emotional expression in cancer narratives. *Psychological Assessment, 21*(1), 79–88. https://doi.org/10.1037/a0014643 **[PubMed]**
   Compares LIWC with human coding of emotional expression: sensitivity was .88 but positive predictive value only .31, meaning most flagged words were not judged emotional by raters. A small sample (63 women in an online cancer support intervention), but it is the clearest warning that emotion-word counts over-identify emotion.

7. Kross, E., Verduyn, P., Boyer, M., Drake, B., Gainsburg, I., Vickers, B., Ybarra, O., & Jonides, J. (2019). Does counting emotion words on online social networks provide a window into people's subjective experience of emotion? A case study on Facebook. *Emotion, 19*(1), 97–107. https://doi.org/10.1037/emo0000416 **[PubMed]**
   In four experience-sampling studies, emotion words in Facebook posts neither predicted nor were predicted by how people said they felt; human judges' ratings of the posts did better. Young adults and one platform, but it is direct evidence against reading affect counts as feelings.

8. Sun, J., Schwartz, H. A., Son, Y., Kern, M. L., & Vazire, S. (2020). The language of well-being: Tracking fluctuations in emotion experience through everyday speech. *Journal of Personality and Social Psychology, 118*(2), 364–387. https://doi.org/10.1037/pspp0000244 **[PubMed]**
   Within persons (185 participants, 1,579 observations), LIWC emotion scores from recorded everyday speech were not significantly associated with self-reported momentary emotion. Speech, not writing, and one week per person.

## B. Open-vocabulary analysis and DLATK


9. Schwartz, H. A., Eichstaedt, J. C., Kern, M. L., Dziurzynski, L., Ramones, S. M., Agrawal, M., Shah, A., Kosinski, M., Stillwell, D., Seligman, M. E. P., & Ungar, L. H. (2013). Personality, gender, and age in the language of social media: The open-vocabulary approach. *PLoS ONE, 8*(9), e73791. https://doi.org/10.1371/journal.pone.0073791 **[PubMed]**
    Analyses 700 million words, phrases and topics from 75,000 Facebook volunteers and shows that data-driven features distinguish people by personality, gender and age better than fixed categories. Volunteers of one app on one platform around 2009 to 2011; correlations between single features and traits are small.

10. Park, G., Schwartz, H. A., Eichstaedt, J. C., Kern, M. L., Kosinski, M., Stillwell, D. J., Ungar, L. H., & Seligman, M. E. P. (2015). Automatic personality assessment through social media language. *Journal of Personality and Social Psychology, 108*(6), 934–952. https://doi.org/10.1037/pspp0000020 **[PubMed]**
    Trains a personality model on 66,732 Facebook users and tests it on 4,824 others; language-based scores agreed with self-reports and informant reports and were stable over six months. Convergence with self-report was moderate (roughly r = .35 to .45 by trait, recalled), which is useful for group research and too imprecise for telling one person about themselves.

11. Kern, M. L., Park, G., Eichstaedt, J. C., Schwartz, H. A., Sap, M., Smith, L. K., & Ungar, L. H. (2016). Gaining insights from social media language: Methodologies and challenges. *Psychological Methods, 21*(4), 507–525. https://doi.org/10.1037/met0000091 **[PubMed]**
    A methods guide for psychologists: how to get, clean and quantify social media language, how to interpret effects, and the ethical issues. It is guidance from one research group, written for group-level research with large samples.

12. Schwartz, H. A., Giorgi, S., Sap, M., Crutchley, P., Ungar, L., & Eichstaedt, J. (2017). DLATK: Differential Language Analysis ToolKit. In *Proceedings of the 2017 Conference on Empirical Methods in Natural Language Processing: System Demonstrations* (pp. 55–60). Association for Computational Linguistics. https://aclanthology.org/D17-2010/ **[Publisher page]**
    Describes the open-source Python toolkit for feature extraction, correlation with outcomes, and prediction. It is a system description without new validity evidence, and the toolkit needs Python and MySQL, so it cannot run in a browser.

13. Eichstaedt, J. C., Kern, M. L., Yaden, D. B., Schwartz, H. A., Giorgi, S., Park, G., Hagan, C. A., Tobolsky, V. A., Smith, L. K., Buffone, A., Iwry, J., Seligman, M. E. P., & Ungar, L. H. (2021). Closed- and open-vocabulary approaches to text analysis: A review, quantitative comparison, and recommendations. *Psychological Methods, 26*(4), 398–427. https://doi.org/10.1037/met0000349 **[PubMed]**
    Compares LIWC, the General Inquirer, DICTION, LDA topics and differential language analysis on 65,896 Facebook users, and lists common errors in interpreting dictionary results (ambiguous words, a few frequent words driving a category). Same Facebook dataset as the earlier papers.

14. Jaidka, K., Giorgi, S., Schwartz, H. A., Kern, M. L., Ungar, L. H., & Eichstaedt, J. C. (2020). Estimating geographic subjective well-being from Twitter: A comparison of dictionary and data-driven language methods. *Proceedings of the National Academy of Sciences, 117*(19), 10165–10171. https://doi.org/10.1073/pnas.1906364117 **[PubMed]**
    Word-level dictionary methods gave inconsistent county-level well-being estimates, and removing as few as three very frequent words changed the results notably. County-level analysis in the United States, not individuals, but it shows how fragile dictionary scores are to a handful of words.

15. Yarkoni, T. (2010). Personality in 100,000 words: A large-scale analysis of personality and word use among bloggers. *Journal of Research in Personality, 44*(3), 363–373. https://doi.org/10.1016/j.jrp.2010.04.001 **[PubMed]**
    Correlates LIWC categories and single words with Big Five scores in 694 bloggers and replicates earlier category-level findings. Category correlations are mostly below .2 in absolute value (recalled), with English-language bloggers who volunteered.

## C. Depression and pronouns


16. Rude, S. S., Gortner, E.-M., & Pennebaker, J. W. (2004). Language use of depressed and depression-vulnerable college students. *Cognition and Emotion, 18*(8), 1121–1133. **[Title only]**
    Currently depressed students used "I" more often in essays than never-depressed students. An early, small, single-site study with students; later syntheses put the effect much lower.

17. Edwards, T., & Holtzman, N. S. (2017). A meta-analysis of correlations between depression and first person singular pronoun use. *Journal of Research in Personality, 68*, 63–68. **[Publisher page]** (record found through Consensus; abstract read)
    Pools 21 correlations (N = 3,758), including unpublished ones: r = .13, 95% CI [.10, .16], not moderated by gender or publication status. The authors call it a small correlation; it explains under 2% of variance.

18. Tackman, A. M., Sbarra, D. A., Carey, A. L., Donnellan, M. B., Horn, A. B., Holtzman, N. S., Edwards, T. S., Pennebaker, J. W., & Mehl, M. R. (2019). Depression, negative emotionality, and self-referential language: A multi-lab, multi-measure, and multi-language-task research synthesis. *Journal of Personality and Social Psychology, 116*(5), 817–834. https://doi.org/10.1037/pspp0000187 **[PubMed]**
    A preregistered pooled analysis of 4,754 participants from six labs in two countries: depression and I-talk correlate at r = .10, 95% CI [.07, .13], and the link largely reflects general negative emotionality, not depression specifically. English and German samples; nothing on Chinese, where subjects are often dropped.

19. Eichstaedt, J. C., Smith, R. J., Merchant, R. M., Ungar, L. H., Crutchley, P., Preoţiuc-Pietro, D., Asch, D. A., & Schwartz, H. A. (2018). Facebook language predicts depression in medical records. *Proceedings of the National Academy of Sciences, 115*(44), 11203–11208. https://doi.org/10.1073/pnas.1802331115 **[PubMed]**
    Among 683 consenting emergency department patients (114 with a recorded depression diagnosis), Facebook language before the diagnosis predicted it with AUC = .69. One urban hospital, a diagnosis-in-records criterion, and an accuracy that the authors call fair; not a basis for telling an individual anything.

## D. Chinese resources


20. Huang, C.-L., Chung, C. K., Hui, N., Lin, Y.-C., Seih, Y.-T., Lam, B. C. P., Chen, W.-C., Bond, M. H., & Pennebaker, J. W. (2012). 中文版「語文探索與字詞計算」詞典之建立 [The development of the Chinese Linguistic Inquiry and Word Count dictionary]. *中華心理學刊 (Chinese Journal of Psychology), 54*(2), 185–201. **[Publisher page]** (journal listing with these pages found; the author list and the Chinese title are recalled)
    Describes the Traditional Chinese adaptation of LIWC2007, including categories added for Chinese, and its equivalence with the English version on translated texts. The dictionary is licensed, not open, and equivalence on translated texts is not evidence of validity in natural Taiwanese writing.

21. Yu, L.-C., Lee, L.-H., Hao, S., Wang, J., He, Y., Hu, J., Lai, K. R., & Zhang, X. (2016). Building Chinese affective resources in valence-arousal dimensions. In *Proceedings of the 2016 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies* (pp. 540–545). Association for Computational Linguistics. https://doi.org/10.18653/v1/N16-1066 **[Publisher page]**
    Introduces CVAW (valence and arousal ratings for Traditional Chinese words) and a rated sentence set. Ratings are for words out of context, and the resource has no open redistribution licence that could be found.

## E. Ethics


22. Chancellor, S., Birnbaum, M. L., Caine, E. D., Silenzio, V. M. B., & De Choudhury, M. (2019). A taxonomy of ethical tensions in inferring mental health states from social media. In *Proceedings of the Conference on Fairness, Accountability, and Transparency (FAT\* '19)* (pp. 79–88). Association for Computing Machinery. **[Publisher page]** (page numbers recalled)
    Maps the ethical problems of predicting mental health from social media: consent and participation, validity of the constructs, and what happens to people after a prediction. It is a conceptual analysis; it gives reasons, not rules, and those reasons support this app's limits (own data only, no inference of conditions).

## F. Explainable AI


23. Doshi-Velez, F., & Kim, B. (2017). *Towards a rigorous science of interpretable machine learning*. arXiv. https://arxiv.org/abs/1702.08608 **[Publisher page]**
    Distinguishes application-grounded, human-grounded and functionally-grounded evaluation of interpretability and argues that the evaluation must match the audience and task. A position paper (preprint), with no empirical test of its own.

24. Ribeiro, M. T., Singh, S., & Guestrin, C. (2016). "Why should I trust you?": Explaining the predictions of any classifier. In *Proceedings of the 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining* (pp. 1135–1144). Association for Computing Machinery. https://arxiv.org/abs/1602.04938 **[Publisher page]**
    Introduces LIME: explain one prediction of any model by fitting a simple model to perturbed samples around it. The explanation is an approximation that varies with sampling settings, and it is unnecessary when the model is already a transparent count.

25. Lundberg, S. M., & Lee, S.-I. (2017). A unified approach to interpreting model predictions. In *Advances in Neural Information Processing Systems 30* (pp. 4765–4774). https://arxiv.org/abs/1705.07874 **[Publisher page]**
    Introduces SHAP, additive feature attributions based on Shapley values, with consistency properties. Attributions depend on the chosen baseline and on assumptions about feature independence; for a linear count they reduce to the word contributions the app already shows.

26. Liao, Q. V., Gruen, D., & Miller, S. (2020). Questioning the AI: Informing design practices for explainable AI user experiences. In *Proceedings of the 2020 CHI Conference on Human Factors in Computing Systems* (pp. 1–15). Association for Computing Machinery. https://doi.org/10.1145/3313831.3376590 **[Publisher page]**
    Builds a bank of questions users ask of AI systems (why, why not, what if, how to be that, data, performance, output) from interviews with 20 design practitioners. The interviewees were designers at one company, not end users in a wellbeing setting.

27. Jacovi, A., & Goldberg, Y. (2020). Towards faithfully interpretable NLP systems: How should we define and evaluate faithfulness? In *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics* (pp. 4198–4205). Association for Computational Linguistics. https://aclanthology.org/2020.acl-main.386/ **[Publisher page]**
    Separates faithfulness (the explanation reflects the model's actual reasoning) from plausibility (it convinces people) and argues faithfulness should be treated as a matter of degree. A conceptual paper; it offers no ready metric.

28. Rudin, C. (2019). Stop explaining black box machine learning models for high stakes decisions and use interpretable models instead. *Nature Machine Intelligence, 1*(5), 206–215. https://doi.org/10.1038/s42256-019-0048-x **[PubMed]**
    Argues that post-hoc explanations of opaque models can mislead and that inherently interpretable models should be preferred where they are adequate. A perspective piece about high-stakes decisions; its argument is the reason this design uses a plain count.

29. Mitchell, M., Wu, S., Zaldivar, A., Barnes, P., Vasserman, L., Hutchinson, B., Spitzer, E., Raji, I. D., & Gebru, T. (2019). Model cards for model reporting. In *Proceedings of the Conference on Fairness, Accountability, and Transparency (FAT\* '19)* (pp. 220–229). Association for Computing Machinery. https://arxiv.org/abs/1810.03993 **[Publisher page]**
    Proposes a short standard document for a model: intended use, out-of-scope use, evaluation, and caveats. A documentation proposal; it does not make a system valid, only honest about what was checked.

30. Gebru, T., Morgenstern, J., Vecchione, B., Vaughan, J. W., Wallach, H., Daumé III, H., & Crawford, K. (2021). Datasheets for datasets. *Communications of the ACM, 64*(12), 86–92. https://arxiv.org/abs/1803.09010 **[Publisher page]**
    Proposes a set of questions every dataset should answer (motivation, composition, collection, uses). Applied here to the hand-authored word lists: who wrote them, from what, and what they have not been tested on.

## G. Supporting references

Also cited in DESIGN.md or LICENSES.md, outside the thirty key papers above.

S1. Kacewicz, E., Pennebaker, J. W., Davis, M., Jeon, M., & Graesser, A. C. (2014). Pronoun use reflects standings in social hierarchies. *Journal of Language and Social Psychology, 33*(2), 125–143. **[Title only]**
   Across five studies, higher-status people used fewer "I" words and more "we" and "you" words. The settings were small groups and correspondence; the finding is about relative status inside an interaction, not a trait of a person.

S2. Schwartz, H. A., Sap, M., Kern, M. L., Eichstaedt, J. C., Kapelner, A., Agrawal, M., Blanco, E., Dziurzynski, L., Park, G., Stillwell, D., Kosinski, M., Seligman, M. E. P., & Ungar, L. H. (2016). Predicting individual well-being through the language of social media. *Pacific Symposium on Biocomputing, 21*, 516–527. **[PubMed]** (no DOI in the PubMed record)
    Builds message-level and user-level models of well-being components (the source of the PERMA lexicon) from crowd-rated posts. Ratings of posts by strangers are not the writer's own well-being, and the lexicon is CC BY-NC-SA.

S3. Lee, L.-H., Li, J.-H., & Yu, L.-C. (2022). Chinese EmoBank: Building valence-arousal resources for dimensional sentiment analysis. *ACM Transactions on Asian and Low-Resource Language Information Processing, 21*(4), Article 65. https://doi.org/10.1145/3489141 **[Publisher page]** (article number recalled)
    Extends CVAW to words, phrases, sentences and texts. Same licensing limit as CVAW.

S4. Wang, S.-M., & Ku, L.-W. (2016). ANTUSD: A large Chinese sentiment dictionary. In *Proceedings of the Tenth International Conference on Language Resources and Evaluation (LREC'16)* (pp. 2697–2702). European Language Resources Association. https://aclanthology.org/L16-1428/ **[Publisher page]**
    Collects sentiment annotations for a large Traditional Chinese word list from several annotation projects. Available by application to the lab, so it cannot be bundled.

S5. Miller, T. (2019). Explanation in artificial intelligence: Insights from the social sciences. *Artificial Intelligence, 267*, 1–38. https://arxiv.org/abs/1706.07269 **[Publisher page]**
    Reviews research on how people explain: explanations are contrastive, selected, and social. A review of other fields, so the design implications are inferences that still need testing with users.

S6. Turpin, M., Michael, J., Perez, E., & Bowman, S. R. (2023). Language models don't always say what they think: Unfaithful explanations in chain-of-thought prompting. In *Advances in Neural Information Processing Systems 36*. https://arxiv.org/abs/2305.04388 **[Publisher page]**
    Shows that language models' stated reasoning can omit the factor that actually drove an answer. The experiments use specific models and biasing prompts, but the point holds for the design: a fluent narrative is not evidence of how a number was computed.

S7. Hutto, C. J., & Gilbert, E. (2014). VADER: A parsimonious rule-based model for sentiment analysis of social media text. *Proceedings of the International AAAI Conference on Web and Social Media, 8*(1), 216–225. https://doi.org/10.1609/icwsm.v8i1.14550 **[Publisher page]**
    A human-rated English valence lexicon with rules for negation, intensifiers and punctuation, validated against human ratings of short social media texts. English only, and it measures the sentiment of the text as readers see it, not how the writer felt.

## References that could not be fully verified

- **Kacewicz et al. (2014)** and **Rude et al. (2004)**: the exact titles were found in search results, but no publisher record was opened and no DOI was confirmed. Volume and page numbers are recalled.
- **Edwards & Holtzman (2017)**: title, journal, year and abstract were confirmed; the volume and pages are recalled and the DOI was not confirmed, so it is omitted.
- **Huang et al. (2012)**: an Airiti Library listing for *Chinese Journal of Psychology* 54(2), pages 185 to 201, was found; the full author list and the Chinese title are recalled and should be checked against the journal.
- **Chancellor et al. (2019)**: title and venue confirmed; pages recalled; DOI not confirmed.
- **Park et al. (2015)** effect sizes by trait, the minimum word counts used in Schwartz et al. (2013), Park et al. (2015) and Eichstaedt et al. (2018), and the range of category correlations in Yarkoni (2010) are recalled from the papers and were not re-read in this session.
- DOIs for Mitchell et al. (2019), Gebru et al. (2021), Ribeiro et al. (2016), Miller (2019), Jacovi and Goldberg (2020) and Schwartz et al. (2017) were not confirmed, so arXiv or ACL Anthology links are given in their place.

## Cited in LICENSES.md or DESIGN.md but not checked in this session

These are named only as the citation each resource asks for, or as a pointer. Find and verify the full reference before it goes into the app or the evidence report.

- Sap et al. (2014), age and gender lexica, EMNLP.
- Preoţiuc-Pietro et al. (2016), affect and intensity lexicon.
- Schwartz et al. (2015), temporal orientation lexicon.
- Fast, Chen, & Bernstein (2016), Empath, CHI (a Crossref record and an arXiv entry, 1602.06979, appeared in search results).
- Baccianella, Esuli, & Sebastiani (2010), SentiWordNet 3.0, LREC.
- Frimer et al. (2019), Moral Foundations Dictionary 2.0.
- Ku & Chen (2007), NTUSD.
- Xu et al. (2008), DUTIR affective lexicon ontology.
- Dong & Dong (2006), HowNet; Qi et al. (2019), OpenHowNet (arXiv 1901.09957 appeared in search results).
- Schler et al. (2006), Blog Authorship Corpus.
- Universal Dependencies treebanks (English Web Treebank; Chinese GSD and PUD).
