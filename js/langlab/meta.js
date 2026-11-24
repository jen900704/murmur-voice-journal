// Labels, definitions and limits for every score, in Taiwan Mandarin and US English.
// These are Murmur's own names. The short internal ids (negate, tentat, posemo ...) are only
// keys; they are not LIWC variables and the numbers cannot be compared with LIWC output.

const M = {
  i: {
    en: ['I-words', 'Words that point at the writer: I, me, my, mine, myself.', 'It shows how often you wrote from your own point of view. It does not say why, and it is not a sign of any trait or state in one person.'],
    zh: ['「我」的詞', '指向寫作者自己的詞：我、我自己。', '只看得出你多常從自己的角度寫。看不出原因，也不代表任何個人特質或狀態。中文常省略主詞，所以數字會偏低。'],
  },
  we: {
    en: ['We-words', 'We, us, our, ours, ourselves.', '"We" can include or leave out the reader, and can mean a couple, a team or a country. The count cannot tell which, or how close you feel to anyone.'],
    zh: ['「我們」的詞', '我們、咱們這類詞。', '「我們」可能包含或不包含對方，也可能指情侶、團隊或整個社會。數字分不出是哪一種，也看不出親近程度。'],
  },
  you: {
    en: ['You-words', 'You, your, yours, yourself.', '"You" may be one person, a group, or people in general ("you never know"). The count cannot tell them apart.'],
    zh: ['「你」的詞', '你、妳、您、你們。', '「你」可能是某個人、一群人，或泛指任何人。數字分不出來。'],
  },
  negate: {
    en: ['Negation words', 'Words that deny or refuse: no, not, never, and forms such as "don\'t".', 'A negation can sit in a cheerful sentence ("not bad at all"). The count says nothing about mood.'],
    zh: ['否定詞', '表示否定或拒絕的詞：不、沒、沒有、不要、別。', '否定詞也會出現在開心的句子裡（「不會啦」）。像「不錯」「不過」這類詞已經排除，但仍可能有漏掉或誤算的。數字和心情無關。'],
  },
  certain: {
    en: ['Certainty words', 'Words that state something firmly: always, never, definitely, must.', 'Firm wording is a way of writing. It does not show that you are right, or that you felt sure.'],
    zh: ['肯定語氣的詞', '把話說得很確定的詞：一定、絕對、總是、根本。', '語氣肯定是一種寫法，不代表事情真的如此，也不代表你心裡很確定。'],
  },
  tentat: {
    en: ['Hedging words', 'Words that leave room for doubt: maybe, perhaps, might, seems, kind of.', 'Hedging can be politeness, care with facts, or habit. The count cannot tell which.'],
    zh: ['保留語氣的詞', '留有餘地的詞：也許、可能、好像、應該、不一定。', '語帶保留可能是客氣、謹慎，或只是習慣。數字分不出來。'],
  },
  cogproc: {
    en: ['Reasoning words (all)', 'All cause, insight, certainty and hedging words together, plus words of contrast and need such as but, although, should. A word is counted once here even if it is in several of those lists.', 'This is a total of several lists, so it overlaps with them. More of these words does not mean better thinking.'],
    zh: ['推理相關的詞（總和）', '因果、想法、肯定、保留語氣這幾類的總和，再加上轉折和需要的詞（但是、雖然、應該）。同一個詞在這裡只算一次。', '這是幾個類別的加總，所以和它們重疊。這類詞多不代表想得比較好。'],
  },
  cause: {
    en: ['Cause words', 'Words that link a cause and a result: because, since, therefore, reason, why.', 'It shows that you wrote about reasons. It cannot check whether the reasons hold.'],
    zh: ['因果詞', '把原因和結果連起來的詞：因為、所以、導致、原因、為什麼。', '只看得出你寫到了原因。原因對不對，數字看不出來。'],
  },
  insight: {
    en: ['Insight words', 'Words about thinking and understanding: think, know, realize, understand, notice.', '"I think" is often just a polite opener. The count cannot tell reflection from habit.'],
    zh: ['想法與領悟的詞', '和思考、理解有關的詞：覺得、知道、發現、明白、了解。單獨的「想」因為意思太多（想要、想念），沒有列入。', '「我覺得」常常只是開場白。數字分不出是真的在反思還是口頭習慣。'],
  },
  social: {
    en: ['Words about people', 'You-words and we-words, family and friend words, other people (he, she, they, people) and words for being in touch (talk, tell, meet, share).', 'It depends mostly on the topic. Writing about people is not the same as having support or being close to them.'],
    zh: ['提到人的詞', '「你」「我們」的詞、家人和朋友的詞、其他人（他、她、大家、別人），以及和人互動的詞（聊天、告訴、見面、分享）。', '這主要看你寫的主題。寫到人，不等於有人支持你，也不等於關係親近。'],
  },
  family: {
    en: ['Family words', 'Mother, dad, sister, cousin, husband and similar words.', 'It counts mentions. It cannot tell whether the mention was warm, hard, or neutral.'],
    zh: ['家人相關的詞', '媽媽、爸爸、姊姊、阿嬤、老公這類詞。', '只算提到的次數。看不出提到時是溫暖、辛苦，還是只是敘述。'],
  },
  friend: {
    en: ['Friend words', 'Friend, buddy, roommate, classmate, partner and similar words.', 'It counts mentions, not how many friends you have or how those ties are going.'],
    zh: ['朋友相關的詞', '朋友、同學、室友、同事、伴侶這類詞。', '只算提到的次數，不代表朋友多少，也看不出關係好不好。'],
  },
  work: {
    en: ['Work and school words', 'Job, boss, deadline, class, exam, thesis and similar words.', 'It shows the topic, not how the work is going or how you feel about it.'],
    zh: ['工作與學業的詞', '工作、老闆、加班、上課、考試、論文這類詞。', '只看得出主題，看不出工作順不順，也看不出你的感受。'],
  },
  body: {
    en: ['Body words', 'Body parts, sleep, eating, tiredness, pain and illness.', 'It is not a health measure. "Heart" in "heart of the matter" still counts.'],
    zh: ['身體相關的詞', '身體部位、睡眠、吃喝、疲累、疼痛和生病。', '這不是健康指標。像「頭」「手」這種容易誤算的單字沒有列入，所以也會漏算。'],
  },
  posemo: {
    en: ['Positive feeling words', 'Words such as happy, love, great, thanks, calm. A word that comes within three words after a negation ("not happy") is left out and listed apart.', 'Studies find that counts of feeling words match poorly with how people say they feel. Irony, quotes and politeness all count the same. These are words you used, not your emotions.'],
    zh: ['正向感受的詞', '開心、喜歡、謝謝、放鬆、不錯這類詞。前面三個詞以內有否定詞時（「沒有很開心」）不計入，另外列出。', '研究發現，感受詞的數量和人自己說的感受對不太上。反話、引用、客套話都一樣會被算進去。這是你用過的詞，不是你的情緒。'],
  },
  negemo: {
    en: ['Negative feeling words (all)', 'All worry, anger and sadness words together, plus general ones such as bad, hurt, sorry, awful. Negated ones ("not sad") are left out and listed apart.', 'Studies find that counts of feeling words match poorly with how people say they feel. Writing about a hard thing is often part of working through it. These are words you used, not your emotions.'],
    zh: ['負向感受的詞（總和）', '擔心、生氣、難過三類的總和，再加上一般的負向詞（糟糕、痛苦、抱歉、不好）。被否定的（「不難過」）不計入，另外列出。', '研究發現，感受詞的數量和人自己說的感受對不太上。把難受的事寫下來，常常正是在整理它。這是你用過的詞，不是你的情緒。'],
  },
  anx: {
    en: ['Worry words', 'Worried, nervous, afraid, stress, panic and similar words.', 'This is a word count and not a measure of anxiety. "No stress" and "exam stress" both contain the word.'],
    zh: ['擔心的詞', '擔心、緊張、害怕、壓力、焦慮這類詞。', '這是詞的數量，不是焦慮程度的測量。'],
  },
  anger: {
    en: ['Anger words', 'Angry, hate, annoyed, furious, swear words and similar.', 'Swearing among friends and real anger look the same to a word list.'],
    zh: ['生氣的詞', '生氣、討厭、不爽、火大、髒話這類詞。', '朋友間的玩笑髒話和真的生氣，對詞表來說是一樣的。'],
  },
  sad: {
    en: ['Sadness words', 'Sad, cry, lonely, miss, loss and similar words.', 'This is a word count. It is not a measure of sadness and says nothing about any condition.'],
    zh: ['難過的詞', '難過、哭、寂寞、想念、失落這類詞。', '這是詞的數量，不是難過程度的測量，也不能說明任何狀況。'],
  },
  focuspast: {
    en: ['Past-time words', 'Past forms of common verbs (was, had, went, said) and words such as yesterday, ago, last year.', 'Only the listed verb forms count, so many past-tense verbs are missed.'],
    zh: ['過去時間的詞', '昨天、以前、曾經、已經、小時候這類時間詞。', '中文沒有時態，很多句子不標時間。「了」「過」意思不固定，沒有列入，所以這個數字只是粗略的。'],
  },
  focuspresent: {
    en: ['Present-time words', 'Present forms of common verbs (am, is, have, think) and words such as now, today.', 'English uses the present tense for general statements too, so this is not only about "right now".'],
    zh: ['現在時間的詞', '現在、今天、最近、正在、目前這類時間詞。', '中文沒有時態，很多句子不標時間，所以這個數字只是粗略的。'],
  },
  focusfuture: {
    en: ['Future-time words', 'Will, going to, tomorrow, soon, plan and similar words.', 'A plan, a fear and a promise about the future all count the same.'],
    zh: ['未來時間的詞', '明天、以後、將來、打算、計畫這類詞。', '「會」「要」意思太多，沒有列入。計畫、擔心和承諾在這裡算起來都一樣。'],
  },
  analytic: {
    en: [
      'Categorical vs. narrative style (experimental)',
      'An index from eight kinds of small words: 30 + articles + prepositions - personal pronouns - impersonal pronouns - auxiliary verbs - conjunctions - common adverbs - negations, each as a percent of words. Higher means more noun-heavy, formal writing; lower means more story-like, personal writing.',
      'This is an adaptation of the categorical-dynamic index of Pennebaker and colleagues (2014), computed with Murmur\'s own word lists. It is not the LIWC "Analytic" score and cannot be compared with it. The original finding is about groups of students, not one person. English only.',
    ],
    zh: [
      '條列式或敘事式的寫法（實驗性）',
      '用八類英文小詞算出的指數：30 + 冠詞 + 介系詞 - 人稱代名詞 - 非人稱代名詞 - 助動詞 - 連接詞 - 常見副詞 - 否定詞（各以占全部字數的百分比計）。數字高表示名詞多、偏正式；數字低表示偏敘事、偏個人。',
      '這是依 Pennebaker 等人（2014）的 categorical-dynamic index 改寫的版本，用的是 Murmur 自己的詞表，不是 LIWC 的「Analytic」分數，兩者不能互相比較。原始研究談的是一群學生，不是個人。只適用英文；中文沒有冠詞，這個指數沒有中文版。',
    ],
  },
  vader: {
    en: [
      'Sentiment of sentences (VADER)',
      'Each English sentence gets a score from -1 (negative) to +1 (positive) from the VADER word list and its rules for negation, emphasis and "but". Shown here: the average over your sentences.',
      'VADER was built for short social media text. It misses irony and context, and a sentence about a hard thing is not the same as feeling bad. This is the tone of the wording, not your mood. English only.',
    ],
    zh: [
      '句子的語氣（VADER）',
      '每個英文句子依 VADER 詞表和它的規則（否定、加強語氣、but）得到 -1（負向）到 +1（正向）的分數。這裡顯示的是所有句子的平均。',
      'VADER 是為短的社群貼文設計的，看不懂反話和上下文。寫到難受的事不等於心情不好。這是用詞的語氣，不是你的心情。只適用英文。',
    ],
  },
  empath: {
    en: ['Topic words (Empath)', 'Share of your words that are in this Empath topic list. The lists were generated by a computer model from fiction and then checked by people.', 'Topic lists are broad and words can sit in many topics. This shows what kinds of words appear, not what the text is about. English only.'],
    zh: ['主題詞（Empath）', '你的字裡有多少落在這個 Empath 主題詞表中。這些詞表是電腦模型從小說文本產生，再由人檢查過的。', '主題詞表很寬，一個詞可以屬於很多主題。這只表示出現了哪類詞，不代表文章在談什麼。只適用英文。'],
  },
};

// second set. The third item is the "what this cannot tell you" line; the fourth names the
// work that motivated the category (full references are in REFERENCES below).
Object.assign(M, {
  other: {
    en: ['Other-people pronouns', 'He, she, they and their forms.', 'It shows that you wrote about other people. It cannot tell who they are or how you relate to them.'],
    zh: ['指別人的詞', '他、她、他們、別人、對方這類詞。', '只看得出你寫到了別人。看不出是誰，也看不出你和他們的關係。'],
  },
  excl: {
    en: ['Exception words', 'Words that set something apart: but, except, without, although, unless.', 'These mark distinctions in the wording. They do not show that the thinking behind it is more or less careful.', 'Tausczik & Pennebaker (2010)'],
    zh: ['轉折與例外的詞', '把事情區分開來的詞：但是、可是、除了、雖然、除非。', '這些詞標出文字裡的區分。看不出背後想得仔不仔細。', 'Tausczik & Pennebaker (2010)'],
  },
  selfother: {
    en: ['Self-focus vs. other-focus', 'I-words minus other-people pronouns, in points per 100. Above zero: more about yourself; below zero: more about others.', 'A diary is about its writer and a story about a friend is not. This follows the topic and says nothing about being self-centered or caring.', 'Tausczik & Pennebaker (2010)'],
    zh: ['寫自己或寫別人', '「我」的詞減去指別人的詞（每 100 單位的點數）。大於零表示寫自己比較多，小於零表示寫別人比較多。', '日記本來就是寫自己，講朋友的事就不是。這個數字跟著主題走，看不出自我中心或體貼。', 'Tausczik & Pennebaker (2010)'],
  },
  status: {
    en: ['We-and-you vs. I pattern', 'We-words plus you-words minus I-words, in points per 100. In studies of small groups and letters, people in the higher position used fewer I-words and more we- and you-words.', 'The finding is about relative position inside one exchange, measured across groups. It is not a trait, and it cannot say how confident or influential one writer is. Private notes are full of "I" by nature.', 'Kacewicz et al. (2014)'],
    zh: ['「我們、你」相對於「我」', '「我們」的詞加「你」的詞，減去「我」的詞（每 100 單位的點數）。在小團體和書信的研究裡，位置較高的一方用較少的「我」、較多的「我們」和「你」。', '那是群體層次、同一段互動裡相對位置的結果，不是個人特質，也看不出一個人有沒有自信或影響力。私人筆記本來就充滿「我」。', 'Kacewicz et al. (2014)'],
  },
  tone: {
    en: ['Feeling-word balance', 'Positive feeling words minus negative feeling words, in points per 100. Available for the time view in both languages.', 'It is the balance of two word counts, with all their limits. It is the tone of the wording and not a mood reading.', 'Kross et al. (2019); Sun et al. (2020)'],
    zh: ['正負向用詞的差', '正向感受的詞減去負向感受的詞（每 100 單位的點數）。中英文都可以在「隨時間的變化」裡看。', '這是兩種詞數相減，兩邊的限制都還在。它是用詞的語氣，不是心情的讀數。', 'Kross et al. (2019); Sun et al. (2020)'],
  },
  authentic: {
    en: ['Personal, qualified writing style', 'I-words plus exception words (but, except) minus negative feeling words, in points per 100. One study found this pattern more often in first-hand, personal accounts.', 'This is a writing style and nothing more. Language analysis cannot tell whether a statement is true, and this number says nothing about any person or any sentence.', 'Newman et al. (2003)'],
    zh: ['個人化、有保留的寫法', '「我」的詞加轉折與例外的詞（但是、除了），減去負向感受的詞（每 100 單位的點數）。有研究發現，親身經歷的敘述比較常出現這種寫法。', '這只是一種寫作風格。語言分析無法判斷一段話是真是假，這個數字不能說明任何人或任何一句話。', 'Newman et al. (2003)'],
  },
  affil: {
    en: ['Closeness words', 'Love, miss, together, care, friend and similar words.', 'Words of closeness also appear when closeness is missing ("I miss her"). The count cannot tell how your ties are going.', 'Baumeister & Leary (1995)'],
    zh: ['親近與愛的詞', '愛、想念、陪伴、一起、在乎這類詞。', '親近的詞也會在缺少親近的時候出現（「好想念她」）。數字看不出關係現在如何。', 'Baumeister & Leary (1995)'],
  },
  conflict: {
    en: ['Conflict words', 'Argue, fight, blame, betray, breakup and similar words.', 'Writing about a disagreement is not the same as being in one, and a film plot counts like a real quarrel.', 'Tausczik & Pennebaker (2010)'],
    zh: ['衝突的詞', '吵架、責怪、冷戰、背叛、分手這類詞。', '寫到爭執不等於正在爭執，電影劇情和真的吵架算起來是一樣的。', 'Tausczik & Pennebaker (2010)'],
  },
  lonely: {
    en: ['Being-alone words', 'Lonely, alone, left out, isolated and similar words.', '"Alone" can be peaceful or painful. This is a word count and not a measure of loneliness.', 'Baumeister & Leary (1995)'],
    zh: ['獨自一人的詞', '孤單、寂寞、一個人、被排擠、落單這類詞。', '「一個人」可以是自在，也可以是難受。這是詞的數量，不是孤單程度的測量。', 'Baumeister & Leary (1995)'],
  },
  belong: {
    en: ['Belonging words', 'Belong, accepted, community, member, home and similar words.', 'It shows that the theme came up. It cannot tell whether you feel that you belong.', 'Baumeister & Leary (1995)'],
    zh: ['歸屬的詞', '歸屬、被接納、融入、自己人、團隊這類詞。', '只看得出這個主題出現過。看不出你覺得自己有沒有歸屬。', 'Baumeister & Leary (1995)'],
  },
  grat: {
    en: ['Thanks words', 'Thank, grateful, appreciate, lucky and similar words.', '"Thanks" at the end of a message is a habit of politeness. The count cannot tell felt gratitude from routine.', 'Emmons & McCullough (2003)'],
    zh: ['感謝的詞', '謝謝、感恩、多虧、珍惜這類詞。', '訊息結尾的「謝謝」常是禮貌習慣。數字分不出是真心感謝還是慣用語。', 'Emmons & McCullough (2003)'],
  },
  apology: {
    en: ['Apology words', 'Sorry, apologize, forgive, my fault and similar words.', '"Sorry" is often plain politeness. The count says nothing about guilt or about who was at fault.', 'Brown & Levinson (1987)'],
    zh: ['道歉的詞', '對不起、抱歉、不好意思、原諒這類詞。', '「不好意思」多半只是客氣。數字看不出愧疚，也看不出誰對誰錯。', 'Brown & Levinson (1987)'],
  },
  compare: {
    en: ['Comparison words', 'Phrases that set you beside others: better than, compared to, jealous, keep up, good enough.', 'Comparing is an ordinary part of thinking. The count cannot tell whether a comparison helped or hurt.', 'Festinger (1954)'],
    zh: ['和別人比較的詞', '把自己和別人放在一起看的詞：比不上、不如、羨慕、跟不上、不夠好。', '比較是很平常的思考方式。數字看不出這些比較對你是幫助還是負擔。', 'Festinger (1954)'],
  },
  request: {
    en: ['Requests and directives', 'Please, must, should, have to, can you, make sure and similar words.', 'A to-do note to yourself and an order to someone else count the same. This is not a measure of being demanding.', 'Brown & Levinson (1987)'],
    zh: ['請求與要求的詞', '請、拜託、必須、應該、可不可以、記得這類詞。', '寫給自己的提醒和對別人的要求算起來一樣。這不是在測量一個人強不強勢。', 'Brown & Levinson (1987)'],
  },
  polite: {
    en: ['Politeness markers', 'Please, thank you, sorry, excuse me, kindly and similar words.', 'Politeness words follow the setting and the reader. The count cannot tell warmth from formality.', 'Brown & Levinson (1987)'],
    zh: ['禮貌用語', '請、謝謝、不好意思、麻煩您、辛苦了這類詞。', '禮貌用語跟著場合和對象走。數字分不出是溫暖還是客套。', 'Brown & Levinson (1987)'],
  },
  loss: {
    en: ['Loss and grief words', 'Loss, died, funeral, grief, goodbye, passed away and similar words.', 'It shows that loss was written about. It cannot tell where you are with it, and there is no right amount of these words. "Lost my keys" counts too.', 'Stroebe & Schut (1999); Pennebaker et al. (1997)'],
    zh: ['失落與哀悼的詞', '失去、過世、告別式、懷念、捨不得這類詞。', '只看得出你寫到了失去。看不出你現在走到哪裡，這類詞也沒有所謂「該有多少」。', 'Stroebe & Schut (1999); Pennebaker et al. (1997)'],
  },
  achieve: {
    en: ['Achievement words', 'Goal, succeed, win, effort, improve, fail and similar words.', 'It shows that striving was a topic. It cannot tell how driven you are or how things went.', 'Schultheiss (2013)'],
    zh: ['成就與努力的詞', '目標、成功、努力、進步、失敗這類詞。', '只看得出「努力」是主題之一。看不出你多有企圖心，也看不出結果如何。', 'Schultheiss (2013)'],
  },
  reward: {
    en: ['Reward words', 'Prize, bonus, gift, treat, enjoy, worth it and similar words.', 'It counts mentions of good things gained. It is not a measure of what moves you.', 'Schultheiss (2013)'],
    zh: ['獎賞與收穫的詞', '獎勵、禮物、賺到、值得、小確幸這類詞。', '只算提到「得到好東西」的次數，不是在測量什麼能推動你。', 'Schultheiss (2013)'],
  },
  risk: {
    en: ['Risk and caution words', 'Risk, danger, careful, safe, avoid, protect and similar words.', 'A careful plan and a real danger look the same to a word list.', 'Schultheiss (2013)'],
    zh: ['風險與謹慎的詞', '危險、風險、小心、安全、避免、保護這類詞。', '一份謹慎的計畫和真正的危險，對詞表來說是一樣的。', 'Schultheiss (2013)'],
  },
  care: {
    en: ['Care and harm theme', 'Care, kind, help, protect, hurt, suffer, cruel and similar words.', 'It shows a theme in this text. It says nothing about your values, and nothing about your views on any public question.', 'Graham et al. (2013)'],
    zh: ['關懷與傷害的主題', '關心、照顧、幫助、保護、傷害、受苦這類詞。', '只表示這段文字裡出現了這個主題。看不出你的價值觀，也和你對公共議題的看法無關。', 'Graham et al. (2013)'],
  },
  fair: {
    en: ['Fairness theme', 'Fair, unfair, equal, justice, rights, deserve, bias and similar words.', 'It shows a theme in this text. It says nothing about your values, and nothing about your views on any public question.', 'Graham et al. (2013)'],
    zh: ['公平的主題', '公平、不公平、平等、正義、權利、偏心這類詞。', '只表示這段文字裡出現了這個主題。看不出你的價值觀，也和你對公共議題的看法無關。', 'Graham et al. (2013)'],
  },
  loyal: {
    en: ['Loyalty theme', 'Loyal, betray, faithful, united, team, promise and similar words.', 'It shows a theme in this text. It says nothing about your values, and nothing about your views on any public question.', 'Graham et al. (2013)'],
    zh: ['忠誠的主題', '忠誠、背叛、義氣、團結、承諾這類詞。', '只表示這段文字裡出現了這個主題。看不出你的價值觀，也和你對公共議題的看法無關。', 'Graham et al. (2013)'],
  },
  authority: {
    en: ['Authority and respect theme', 'Rule, obey, respect, duty, tradition, permission, rebel and similar words.', 'It shows a theme in this text. It says nothing about your values, and nothing about your views on any public question.', 'Graham et al. (2013)'],
    zh: ['權威與尊重的主題', '規定、服從、尊重、長輩、責任、孝順、叛逆這類詞。', '只表示這段文字裡出現了這個主題。看不出你的價值觀，也和你對公共議題的看法無關。', 'Graham et al. (2013)'],
  },
  sanct: {
    en: ['Purity and sacredness theme', 'Pure, sacred, clean, dirty, faith, pray, soul and similar words.', 'It shows a theme in this text. "Clean the kitchen" counts too. It says nothing about your beliefs or your views on any public question.', 'Graham et al. (2013)'],
    zh: ['純淨與神聖的主題', '乾淨、骯髒、神聖、信仰、祈禱、靈魂這類詞。', '只表示這段文字裡出現了這個主題，「房間很髒」也會算進去。看不出你的信仰，也和你對公共議題的看法無關。', 'Graham et al. (2013)'],
  },
});
M.cogproc.en[3] = M.cogproc.zh[3] = 'Tausczik & Pennebaker (2010)';
M.analytic.en[3] = M.analytic.zh[3] = 'Pennebaker et al. (2014)';
M.vader.en[3] = M.vader.zh[3] = 'Hutto & Gilbert (2014)';
M.posemo.en[3] = M.posemo.zh[3] = M.negemo.en[3] = M.negemo.zh[3] = 'Bantum & Owen (2009); Kross et al. (2019)';

export const NOTICE = {
  en: 'This is language analysis for self-reflection, not a professional assessment or diagnosis, and it cannot judge personality, mental state, or whether someone is lying.',
  zh: '這是自我探索用的語言分析，不是專業評估或診斷，也不能判斷一個人的人格、心理狀態或是否說謊。',
};

// Shown when some of the text looks like Simplified Chinese (analyze().simplifiedItems > 0).
export const SIMPLIFIED_NOTE = {
  en: 'Some of the text looks like Simplified Chinese. The categories were written for Traditional Chinese (Taiwan usage). Simplified characters are converted one by one before matching, so wording that differs from Taiwan usage is still missed.',
  zh: '有些文字看起來是簡體中文。這些類別是照繁體中文（台灣用語）寫的。簡體字會先逐字轉成繁體再比對，所以和台灣用語不同的說法還是會漏掉。',
};

const GROUP_NOTES = {
  en: {
    core: 'Small, closed sets of words. These counts are the most exact ones here.',
    thinking: 'Reasoning words, certainty next to hedging, and time words. Certainty and hedging are two separate rates, not a ratio.',
    feelings: 'Lists like these can never be complete and are the easiest to miscount. Studies find that counts of feeling words match poorly with how people say they feel. Read them as "words you used".',
    social: 'Themes about people and ties. They follow the topic of the text more than anything about you.',
    power: 'A pronoun pattern from research on position in a conversation, with hedging, firm wording, requests and politeness next to it. These describe wording in this text, not rank or character.',
    loss: 'Words about loss, with past-time words and sadness words beside them. There is no right amount of any of these. Writing about a loss is often part of living with it.',
    drives: 'Themes of striving, reward, caution and belonging as they appear in the wording.',
    moral: 'Five themes of moral language, shown only as themes in your own writing. Nothing here is used to guess political or religious views, and nothing can.',
    style: 'Two writing-style indices built from small words. They describe the style of this text. They cannot tell whether anything is true.',
    topics: 'What the text is about, by two simple topic lists.',
  },
  zh: {
    core: '數量少、範圍固定的詞。這裡的數字是最準確的一組。',
    thinking: '推理的詞、肯定與保留語氣，以及時間詞。肯定和保留是兩個各自的比率，不會合成一個比值。',
    feelings: '這類詞表永遠列不完，也最容易誤算。研究發現，感受詞的數量和人自己說的感受對不太上。請當成「你用過的詞」來看。',
    social: '和人、關係有關的主題。它們主要跟著文字的題材走，不太能說明你這個人。',
    power: '一種來自「對話中位置」研究的代名詞用法，旁邊列出保留語氣、肯定語氣、請求和禮貌用語。這些描述的是這段文字的用詞，不是地位或性格。',
    loss: '和失去有關的詞，旁邊列出過去時間的詞和難過的詞。這些詞沒有所謂「該有多少」。把失去寫下來，常常是和它共處的一部分。',
    drives: '努力、獎賞、謹慎和歸屬這幾個主題在用詞裡出現的情形。',
    moral: '道德語言的五個主題，只當成你自己文字裡的主題來呈現。這裡不會、也無法用它們去猜測政治或宗教立場。',
    style: '兩個用小詞算出的寫作風格指數。它們描述這段文字的風格，無法判斷任何內容是真是假。',
    topics: '用兩個簡單的主題詞表看文字在談什麼。',
  },
};
export function groupNote(id, uiLang) {
  return GROUP_NOTES[key(uiLang)][id] || '';
}

const GROUP_LABELS = {
  en: { core: 'Pronouns and negation', thinking: 'Thinking style', feelings: 'Feeling words and tone', social: 'People and relationships', power: 'Position and politeness', loss: 'Loss and grief', drives: 'Drives and motives', moral: 'Moral themes', style: 'Writing style', topics: 'Topics', empath: 'Topic words (Empath)' },
  zh: { core: '代名詞與否定', thinking: '思考的方式', feelings: '感受的詞與語氣', social: '人與關係', power: '位置與禮貌', loss: '失落與哀悼', drives: '動機', moral: '道德主題', style: '寫作風格', topics: '主題', empath: '主題詞（Empath）' },
};

const key = (lang) => (lang === 'en' ? 'en' : 'zh');

export function scoreMeta(id, uiLang) {
  const base = id.startsWith('empath:') ? 'empath' : id;
  const m = M[base] ? M[base][key(uiLang)] : [id, '', ''];
  let label = m[0];
  if (base === 'empath') label = `${id.slice(7).replace(/_/g, ' ')}`;
  return { label, definition: m[1], limits: m[2], cite: m[3] || '' };
}

export function groupLabel(id, uiLang) {
  return GROUP_LABELS[key(uiLang)][id] || id;
}

export const REFERENCES = [
  'Baumeister, R. F., & Leary, M. R. (1995). The need to belong: Desire for interpersonal attachments as a fundamental human motivation. Psychological Bulletin, 117(3), 497-529.',
  'Brown, P., & Levinson, S. C. (1987). Politeness: Some universals in language usage. Cambridge University Press.',
  'Bantum, E. O., & Owen, J. E. (2009). Evaluating the validity of computerized content analysis programs for identification of emotional expression in cancer narratives. Psychological Assessment, 21(1), 79-88. https://doi.org/10.1037/a0014643',
  'Efron, B., & Tibshirani, R. J. (1993). An introduction to the bootstrap. Chapman & Hall.',
  'Emmons, R. A., & McCullough, M. E. (2003). Counting blessings versus burdens: An experimental investigation of gratitude and subjective well-being in daily life. Journal of Personality and Social Psychology, 84(2), 377-389.',
  'Festinger, L. (1954). A theory of social comparison processes. Human Relations, 7(2), 117-140.',
  'Graham, J., Haidt, J., Koleva, S., Motyl, M., Iyer, R., Wojcik, S. P., & Ditto, P. H. (2013). Moral foundations theory: The pragmatic validity of moral pluralism. Advances in Experimental Social Psychology, 47, 55-130.',
  'Hutto, C. J., & Gilbert, E. (2014). VADER: A parsimonious rule-based model for sentiment analysis of social media text. Proceedings of the International AAAI Conference on Web and Social Media, 8(1), 216-225. https://doi.org/10.1609/icwsm.v8i1.14550',
  'Kacewicz, E., Pennebaker, J. W., Davis, M., Jeon, M., & Graesser, A. C. (2014). Pronoun use reflects standings in social hierarchies. Journal of Language and Social Psychology, 33(2), 125-143.',
  'Kross, E., Verduyn, P., Boyer, M., Drake, B., Gainsburg, I., Vickers, B., Ybarra, O., & Jonides, J. (2019). Does counting emotion words on online social networks provide a window into people\'s subjective experience of emotion? A case study on Facebook. Emotion, 19(1), 97-107. https://doi.org/10.1037/emo0000416',
  'Newman, M. L., Pennebaker, J. W., Berry, D. S., & Richards, J. M. (2003). Lying words: Predicting deception from linguistic styles. Personality and Social Psychology Bulletin, 29(5), 665-675. (Cited for the word pattern only. This app does not and cannot assess truthfulness.)',
  'Pennebaker, J. W., Mayne, T. J., & Francis, M. E. (1997). Linguistic predictors of adaptive bereavement. Journal of Personality and Social Psychology, 72(4), 863-871.',
  'Pennebaker, J. W., Chung, C. K., Frazee, J., Lavergne, G. M., & Beaver, D. I. (2014). When small words foretell academic success: The case of college admissions essays. PLoS ONE, 9(12), e115844. https://doi.org/10.1371/journal.pone.0115844',
  'Schultheiss, O. C. (2013). Are implicit motives revealed in mere words? Testing the marker-word hypothesis with computer-based text analysis. Frontiers in Psychology, 4, 748.',
  'Stroebe, M., & Schut, H. (1999). The dual process model of coping with bereavement: Rationale and description. Death Studies, 23(3), 197-224.',
  'Sun, J., Schwartz, H. A., Son, Y., Kern, M. L., & Vazire, S. (2020). The language of well-being: Tracking fluctuations in emotion experience through everyday speech. Journal of Personality and Social Psychology, 118(2), 364-387. https://doi.org/10.1037/pspp0000244',
  'Tausczik, Y. R., & Pennebaker, J. W. (2010). The psychological meaning of words: LIWC and computerized text analysis methods. Journal of Language and Social Psychology, 29(1), 24-54. https://doi.org/10.1177/0261927X09351676',
  'Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. Journal of the American Statistical Association, 22(158), 209-212.',
];

// ---------- "what stood out": plain observations on the results page ----------
// One short noun phrase per category, used in the sentence templates below. Plain words only:
// nothing here evaluates (good, bad, healthy), names a condition, or gives advice.
// The sums of other categories (cogproc, negemo, social) have no phrase and are never chosen,
// so one word is not reported twice under two names.
export const OBS_AGGREGATES = ['cogproc', 'negemo', 'social'];
const OBS_PHRASE = {
  negate: { zh: '「不」「沒有」這類否定的詞', en: 'words like "no" and "not"' },
  certain: { zh: '把話說得很確定的詞', en: 'words that state things firmly' },
  tentat: { zh: '「也許」「可能」這類留有餘地的詞', en: 'words like "maybe" and "perhaps"' },
  cause: { zh: '想到原因和理由的詞', en: 'words about causes and reasons' },
  insight: { zh: '「覺得」「知道」「發現」這類想法的詞', en: 'words like "think", "know" and "realize"' },
  excl: { zh: '「但是」「雖然」這類轉折的詞', en: 'words like "but" and "although"' },
  family: { zh: '提到家人的詞', en: 'words about family' },
  friend: { zh: '提到朋友的詞', en: 'words about friends' },
  work: { zh: '工作和學業的詞', en: 'words about work and school' },
  body: { zh: '身體、睡眠和吃喝的詞', en: 'words about the body, sleep and eating' },
  posemo: { zh: '「開心」「喜歡」這類正向感受的詞', en: 'words like "happy" and "love"' },
  anx: { zh: '「擔心」「緊張」這類詞', en: 'words like "worried" and "nervous"' },
  anger: { zh: '「生氣」「討厭」這類詞', en: 'words like "angry" and "annoyed"' },
  sad: { zh: '「難過」「想念」這類詞', en: 'words like "sad" and "miss"' },
  focuspast: { zh: '講過去的時間詞', en: 'words about the past' },
  focuspresent: { zh: '講現在的時間詞', en: 'words about the present' },
  focusfuture: { zh: '講未來的時間詞', en: 'words about the future' },
  affil: { zh: '「愛」「一起」「陪伴」這類親近的詞', en: 'words like "love", "together" and "care"' },
  conflict: { zh: '「吵架」「責怪」這類衝突的詞', en: 'words like "argue" and "blame"' },
  lonely: { zh: '「一個人」「孤單」這類詞', en: 'words like "alone" and "lonely"' },
  belong: { zh: '講歸屬和融入的詞', en: 'words about belonging' },
  grat: { zh: '感謝的詞', en: 'words of thanks' },
  apology: { zh: '道歉的詞', en: 'words of apology' },
  compare: { zh: '把自己和別人放在一起比的詞', en: 'words that set you beside other people' },
  request: { zh: '「請」「應該」「必須」這類請求和要求的詞', en: 'words like "please", "should" and "must"' },
  polite: { zh: '禮貌用語', en: 'politeness words' },
  loss: { zh: '講失去和告別的詞', en: 'words about loss and goodbyes' },
  achieve: { zh: '講目標和努力的詞', en: 'words about goals and effort' },
  reward: { zh: '講收穫和獎賞的詞', en: 'words about rewards and gains' },
  risk: { zh: '講風險和小心的詞', en: 'words about risk and caution' },
  care: { zh: '講關心和傷害的詞', en: 'words about care and harm' },
  fair: { zh: '講公平的詞', en: 'words about fairness' },
  loyal: { zh: '講忠誠和承諾的詞', en: 'words about loyalty and promises' },
  authority: { zh: '講規定和尊重的詞', en: 'words about rules and respect' },
  sanct: { zh: '講純淨和神聖的詞', en: 'words about purity and the sacred' },
};
// Pronouns read better as a sentence about who the text is about. {n} is the rate.
const OBS_PRONOUN = {
  i: { zh: ['你常寫到自己', '「我」的詞'], en: ['You write about yourself often', 'I-words'] },
  we: { zh: ['你常寫到「我們」', '「我們」的詞'], en: ['You write about "we" often', 'we-words'] },
  you: { zh: ['你常對著「你」說話', '「你」的詞'], en: ['You often address "you"', 'you-words'] },
  other: { zh: ['你常寫到別人', '指別人的詞'], en: ['You write about other people often', 'words for other people'] },
};
// Rates are per 100 Chinese characters for Chinese text and per 100 words for English text.
const OBS_UNIT = {
  zh: { zh: '每 100 字', en: '每 100 個英文單字' },
  en: { zh: 'per 100 Chinese characters', en: 'per 100 words' },
};
// The sentence templates. `counts`: no baseline, so the categories with the most hits.
// `higher` / `lower`: against the person's own earlier kept texts.
export const OBS_TEMPLATES = {
  zh: {
    title: '比較明顯的地方',
    pronoun: (lead, name, unit, n) => `${lead}（${unit}約 ${n} 個${name}）。`,
    counts: (phrase, unit, n) => `這段文字裡，${phrase}比較多（${unit}約 ${n} 個）。`,
    higher: (phrase, unit, n, was) => `和你之前留下的文字比，這次${phrase}比較多（${unit}約 ${n} 個，之前約 ${was} 個）。`,
    lower: (phrase, unit, n, was) => `和你之前留下的文字比，這次${phrase}比較少（${unit}約 ${n} 個，之前約 ${was} 個）。`,
    basis: {
      baseline: '這幾項是和你自己之前留下的文字差得最多的，不和其他人比較。',
      counts: '這幾類只是出現次數最多的，沒有和任何人或任何標準比較。',
      countsAfterBaseline: '和你之前留下的文字比，沒有哪一類明顯不同，所以這裡列的只是出現次數最多的幾類。',
    },
    none: '文字還不夠，還說不出哪裡比較明顯。',
  },
  en: {
    title: 'What stood out',
    pronoun: (lead, name, unit, n) => `${lead} (about ${n} ${name} ${unit}).`,
    counts: (phrase, unit, n) => `In this text, ${phrase} are among the most frequent (about ${n} ${unit}).`,
    higher: (phrase, unit, n, was) => `Compared with your earlier kept texts, there are more ${phrase} this time (about ${n} ${unit}; earlier about ${was}).`,
    lower: (phrase, unit, n, was) => `Compared with your earlier kept texts, there are fewer ${phrase} this time (about ${n} ${unit}; earlier about ${was}).`,
    basis: {
      baseline: 'These are the categories furthest from your own earlier kept texts. Nothing is compared with other people.',
      counts: 'These are simply the categories with the most hits. They are not compared with anyone or with any standard.',
      countsAfterBaseline: 'No category differs clearly from your earlier kept texts, so these are simply the categories with the most hits.',
    },
    none: 'There is not enough text yet to say what stands out.',
  },
};

const obsRate = (v) => (v < 0.95 ? v.toFixed(2) : v.toFixed(1));

// Chooses up to three observations. `res` is one language's result from analyze(); `cmp` is
// compare(res, earlier) or null.
//  - Only categories that pass their minimum length AND have enough hits for a rate
//    (rateShown) can be chosen: never a "not enough text" row, never an index or a sentiment
//    score, never an Empath topic.
//  - With a baseline: the categories whose interval does not overlap the earlier one, ordered
//    by the gap between the two intervals relative to the two rates (within-person only).
//  - docs/language-analysis/DESIGN.md section 7 lists no typical ranges (version 1 has no
//    reference norms), so there is no "relative to typical" step.
//  - Otherwise: the three categories with the most hits, and `mode` says so.
// Returns { mode: 'baseline' | 'counts' | 'none', hadBaseline, items: [{ id, kind, value, earlier, count }] }.
export function chooseObservations(res, cmp, max = 3) {
  const ok = (res && res.scores ? res.scores : []).filter((s) => s.kind === 'pct' && s.enough && s.rateShown && !OBS_AGGREGATES.includes(s.id) && (OBS_PHRASE[s.id] || OBS_PRONOUN[s.id]));
  const hadBaseline = !!cmp && Object.keys(cmp).length > 0;
  const far = [];
  for (const s of ok) {
    const c = cmp && cmp[s.id];
    if (!c || (c.verdict !== 'higher' && c.verdict !== 'lower') || !s.ci || !c.earlierCi) continue;
    const gap = c.verdict === 'higher' ? s.ci[0] - c.earlierCi[1] : c.earlierCi[0] - s.ci[1];
    far.push({ id: s.id, kind: c.verdict, value: s.value, earlier: c.earlier, count: s.count, distance: gap / Math.max(0.1, (s.value + c.earlier) / 2) });
  }
  if (far.length) {
    far.sort((a, b) => b.distance - a.distance || (a.id < b.id ? -1 : 1));
    return { mode: 'baseline', hadBaseline, items: far.slice(0, max) };
  }
  const top = ok
    .slice()
    .sort((a, b) => b.count - a.count || (a.id < b.id ? -1 : 1))
    .slice(0, max)
    .map((s) => ({ id: s.id, kind: 'counts', value: s.value, earlier: null, count: s.count }));
  return { mode: top.length ? 'counts' : 'none', hadBaseline, items: top };
}

// One observation as a sentence. textLang is the language of the analysed text ('zh' | 'en').
export function observationText(item, uiLang, textLang) {
  const k = key(uiLang);
  const T = OBS_TEMPLATES[k];
  const unit = OBS_UNIT[k][textLang === 'en' ? 'en' : 'zh'];
  const n = obsRate(item.value);
  const pro = OBS_PRONOUN[item.id];
  if (pro && item.kind === 'counts') return T.pronoun(pro[k][0], pro[k][1], unit, n);
  const phrase = pro ? pro[k][1] : OBS_PHRASE[item.id][k];
  if (item.kind === 'counts') return T.counts(phrase, unit, n);
  return T[item.kind](phrase, unit, n, obsRate(item.earlier));
}

// ---------- validation status ----------
// Numbers copied from lab/langval/RESULTS.md (section 1, preregistered run on the GoEmotions
// training split and on CPED) and confirmed on held-back data in lab/langval/RETEST.md
// (sections 2 and 3; no verdict changed). AUC = chance that a comment with the matching human
// label has a higher category rate than a neutral comment; .50 is chance, 1.00 is perfect.
// "Supported" there means the list fires where raters saw the emotion. It does not mean the
// count measures how much of the emotion there is. Update these when the lab reruns.
export const VALIDATION = {
  en: {
    corpus: 'GoEmotions',
    auc: { posemo: 0.79, negemo: 0.72, anx: 0.78, anger: 0.68, sad: 0.69, grat: 0.93, affil: 0.76, loss: 0.81, apology: 0.94, tone: 0.87, vader: 0.88 }, // vader: RESULTS.md section 2, positive against negative comments
    // RESULTS.md: only 77 grief comments, and 4.9% of comments with a hit carry the label
    thin: ['loss'],
  },
  zh: {
    corpus: 'CPED',
    // RESULTS.md: the only supported Chinese row, on 204 lines of TV dialogue. The other six
    // rows (.50 to .54) are "untested on text like Murmur's", so they are shown as not validated.
    auc: { grat: 0.8 },
    thin: ['grat'],
  },
};
const VALID_TEXT = {
  zh: {
    en: (auc) => `和人工情緒標註比對過（英文）：AUC ${auc}。.50 等於亂猜，1.00 是完全分得開。`,
    enThin: '用來比對的留言很少，而且這個詞表在其他話題上常誤算。',
    enNone: '這一類還沒有和人工標註比對過。',
    zhGrat: (auc) => `和人工情緒標註比對過（中文，只用了少量電視劇對白）：AUC ${auc}。.50 等於亂猜，1.00 是完全分得開。`,
    zhNone: '中文還沒驗證',
  },
  en: {
    en: (auc) => `Checked against human emotion labels (English): AUC ${auc}. .50 is chance and 1.00 is perfect.`,
    enThin: 'The check rests on very few comments, and this list often miscounts on other topics.',
    enNone: 'This category has not been checked against human labels yet.',
    zhGrat: (auc) => `Checked against human emotion labels (Chinese, on a small set of TV dialogue only): AUC ${auc}. .50 is chance and 1.00 is perfect.`,
    zhNone: 'Not yet validated for Chinese',
  },
};
// The line shown next to a category name in the evidence view.
// Returns { checked: boolean, text } for the language of the analysed text.
export function validationNote(id, textLang, uiLang) {
  const T = VALID_TEXT[key(uiLang)];
  const v = VALIDATION[textLang === 'en' ? 'en' : 'zh'];
  const auc = v.auc[id];
  const shown = auc === undefined ? '' : auc.toFixed(2).replace(/^0/, '');
  if (textLang === 'en') {
    if (auc === undefined) return { checked: false, text: T.enNone };
    return { checked: true, auc, text: T.en(shown) + (v.thin.includes(id) ? ' ' + T.enThin : '') };
  }
  if (auc === undefined) return { checked: false, text: T.zhNone };
  return { checked: true, auc, text: T.zhGrat(shown) };
}
