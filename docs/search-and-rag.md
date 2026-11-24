# Search and retrieval

Murmur has two small retrieval features. Both run in the browser, use the same engine (`js/search.js`), and have no dependencies.

1. **Journal search** looks through what the person wrote: notes on voice entries, silent check-in notes, bedtime worries (only when they chose to keep them), kind things, and saved lens exercises (the worry and the answers).
2. **Retrieval for the AI conversation** (`js/rag.js`) picks a few passages of the app's own lens text and adds them to the system prompt. It never reads the journal.

## Design

**Tokens.** Text is normalized character by character with NFKC (full-width letters and digits, ligatures, half-width kana), lowercased, and Latin accents are removed. Each normalized character remembers its position in the original text, so matches can be marked in the text exactly as it was written. Punctuation, spaces and emoji separate tokens and are dropped.

- Latin words get light stemming: plurals, `-ing`, `-ed`, a final `e`, and a short list of irregular forms (slept, felt, thought). "worries", "worried" and "worrying" become one term.
- Digit runs are tokens.
- Chinese, Japanese and Korean text is indexed as single characters plus every pair of neighbouring characters. There is no word list. Pairs carry most of the meaning; single characters let a one-character query such as 累 work.

**Query.** The query is cut at 200 characters and 64 tokens. Filler words (the, my, 的, 了) and single characters taken out of a longer Chinese query are weak: they can change the order but cannot bring an item into the results on their own. A synonym table of 26 groups (工作 / 上班 / work / job, 爸媽 / 父母 / parents, mom / mother / 媽媽) adds the other members of a group at weight .6. Chinese and English share groups because people here write in both. While a word is still being typed, the last English word also matches words that start with it, at weight .5.

**Index.** An inverted index in memory: term to item to weighted count. It is built from IndexedDB when the Journal is opened. Each later visit to the Journal reads storage again and changes only the items that differ, and the app's own save and delete of an entry update it at once. The index is never written anywhere and is gone when the page closes. The query is kept in memory only: not in storage and not in the address.

**Snippets.** A window of up to 96 characters is cut around the matches, without cutting an English word or a character in half. The snippet is a list of plain and matched pieces of the original text. The app puts each piece in a text node (matched pieces inside `<mark>`), so nothing the person wrote is parsed as markup.

**Interface.** A labelled search field at the top of the Journal, inside a `search` landmark. The number of results is announced through a polite status region, 120 ms after typing stops. Arrow keys move between the field and the results, Enter on the field goes to the first result, Escape clears. While a query is typed, the results replace the rest of the Journal. A voice entry opens its usual detail view; other items open in a sheet with their full text.

## Ranking formula

For a query q and an item d:

```
tf(t, d)   = sum over fields f of  w_f * count of t in field f
len(d)     = sum over fields f of  w_f * number of tokens in field f
idf(t)     = ln(1 + (N - n_t + 0.5) / (n_t + 0.5))
bm25(q, d) = sum over query terms t of
             q_t * idf(t) * tf(t, d) * (k1 + 1) / (tf(t, d) + k1 * (1 - b + b * len(d) / avglen))
score      = bm25 * (1 + 0.5 * phrase) * (1 + 0.03 * 0.5 ^ (age in days / 60))
```

- N is the number of items, n_t the number that contain t.
- k1 = 1.2 and b = 0.4.
- Field weights w_f in the journal: main text 2 (the note, worry, kind thing, or the lens worry), lens answers 1, lens name 0.5.
- q_t is 1 for a typed term, .6 for a synonym, .5 for a word-start match, .25 for a single character from a longer Chinese query, and .1 for filler.
- phrase is 1 when the whole query appears in the item as written (whole words in English, at least two words or two Chinese characters), else 0.
- The last factor is recency. It is at most 3 percent, so it only orders items whose scores are nearly equal. Ties after that go to the newer item.

## Evaluation

`node tests/search-eval.mjs` runs 20 labeled queries. The built-in demo data holds voice measurements only and has no text, so the script adds a made-up demo journal in the shapes the app stores: 20 check-in notes, 8 nights and 7 lens exercises, 42 searchable items in Chinese and English. Each query lists the items a person would want back, graded 2 (what they are looking for) or 1 (related).

| Setting | MRR | nDCG@5 |
|---|---|---|
| As shipped | .950 | .846 |
| No synonyms | .800 | .649 |
| No phrase boost | .950 | .846 |
| No recency | .950 | .846 |
| All fields weighted equally | .950 | .849 |

What these numbers do and do not show:

- The queries and labels were written by the same person who wrote the engine, on 42 short items. They are a regression check, not a measure of how well search works for real journals. The script fails if MRR drops below .85 or nDCG@5 below .80.
- Synonyms account for most of the quality on this set. One query, 睡不好, returns nothing, because no item contains those characters and the synonym table does not list it. Lexical search misses paraphrases like this. Its misses are left in the numbers and were not patched afterwards.
- k1 and b hardly matter here. A grid over k1 from 0.6 to 2.0 and b from 0 to 1 (`--grid`) moves nDCG@5 only between .843 and .849 and leaves MRR unchanged, because journal items are short and a term rarely repeats. k1 = 1.2 is the usual value; b = 0.4 keeps length normalization mild, so a one-line check-in does not automatically outrank a longer lens exercise. The phrase boost, recency and field weights make no measurable difference on this set either; they are covered by unit tests of their intended behaviour, not by this evaluation.
- Not handled: Simplified and Traditional characters are not matched to each other, there is no typo tolerance, and Chinese is not segmented into words, so a pair of characters that spans two words can produce a weak false match.

Unit tests are in `tests/search.test.mjs` (tokenizer cases in both languages, BM25 scores against values worked by hand, synonyms, snippets and escaping, empty and very long queries, index upkeep, and the retrieval rules below). Browser tests are in `tests/e2e/search.spec.mjs`.

## Retrieval for the AI conversation

The AI conversation is experimental and off by default. Before each call to the model:

1. The source is the app's reviewed lens content only, cut into 87 passages with ids. 86 come from the 14 lenses: for each lens its idea (`cognitive.idea`), its key concepts (`cognitive.concepts`), what it may miss (`cognitive.misses`) and each question with the reason for asking it (`cognitive.why1`). One more holds the help lines for the person's region (`help.tw`).
2. The person's latest message is the query. Only passages of the current lens are ranked, with the same BM25. The top 3 are kept. When fewer than 3 match, the lens's idea, concepts and limits fill the rest.
3. The help-line passage is offered only when the message asks where to find a person to talk to (求助, 專線, 心理師, hotline, therapist). Risk language is handled earlier, by the existing pause, before anything is sent.
4. The passages are appended to the system prompt inside `<murmur_reference>`, each line starting with its id. The model is told to stay within them and the lens rules when it explains theory, to put the id in square brackets after a sentence that uses a passage, and that the existing rules, including when to stop and give help lines, come first.
5. In the reply, ids are removed from what is shown. Under the reply a line reads "Based on: lens name · concept names", taken from the passages the reply cited, or from all three when it cited none. The safety checks on a reply run on the full text before the ids are removed, and every earlier safety behaviour is unchanged.

Retrieval makes it more likely that the model's theory statements match the app's reviewed text. It does not guarantee it: the model can still say things that are in no passage, and a cited id shows what the model pointed to, not that the sentence is faithful to it.

## Privacy

- Journal search runs entirely on the device. No request is made, the index and the query are held in memory only, and no new database, store or setting is created. A browser test checks this.
- `js/rag.js` does not import storage and is never passed journal data. The only text of the person it sees is the message they are about to send, which goes to the model in any case; it is used to choose passages and is not copied into the system prompt.
- What the AI conversation sends is otherwise unchanged: the conversation, and the worry and answers of that one exercise. Voice entries, check-in notes, bedtime notes and other saved exercises are not sent. A browser test saves a check-in note first and checks that no part of the request contains it, and that the retrieved block is made only of the app's own passages.
