// Theory lenses: short, self-guided exercises in the style of major counseling theories.
// Written in our own words as psychoeducation. Chapter numbers follow Corey, G.,
// Theory and Practice of Counseling and Psychotherapy (10th ed.). Only techniques that
// are reasonable to try alone are included; techniques that need a therapist present
// (for example empty chair, exposure, dream interpretation) are deliberately left out.
//
// Step text can quote earlier answers with {1}, {2}, {3}.
// A step with `scale: true` asks for a 0 to 10 rating instead of text.
// A step with `rewrite` shows the previous answer transformed, before its question.

export const TOPICS = ['work', 'relationship', 'family', 'self', 'loss', 'other'];

export const LENSES = [
  {
    id: 'psychoanalytic',
    chapter: 4,
    people: 'Sigmund Freud; later object relations and self psychology',
    peopleZh: 'Sigmund Freud；以及後來的客體關係與自體心理學',
    excludeTopics: [],
    zh: {
      name: '精神分析取向',
      idea: '現在的反應，常常帶著過去關係的影子。我們心裡會有互相拉扯的願望和擔心，也會用各種方式保護自己，不去碰太痛的感覺。',
      steps: [
        { q: '這種感覺熟悉嗎？以前大概什麼時候也有過？寫個大概就好。如果想到的事很痛，先停在這裡，改天或有人陪著時再看。', why: '這個取向會注意，現在的反應是不是在重複某個過去的模式。' },
        { q: '在這件事裡，一部分的你想要什麼？另一部分的你又在擔心什麼？', why: '它認為內心常同時有想靠近和想保護自己的力量。' },
        { q: '這種感覺出現時，你通常怎麼讓自己好過一點？例如轉移注意、變得很理性、怪自己或怪別人。', why: '這些保護方式（防衛）不是壞事，它們曾經幫過你，但有時也讓人看不清楚。' },
      ],
      noticed: '關於這種感覺以前什麼時候有過，你寫到：「{1}」。心裡想要的和擔心的：「{2}」。它出現時，你讓自己好過一點的方式：「{3}」。這個取向會好奇：這個保護方式以前幫過你什麼，現在是不是還需要用同樣的方式。',
      experiment: '這週，在這個模式出現的那一刻，只是把它記下來（時間、在誰身邊、你做了什麼），先不急著改變。',
      concepts: ['潛意識', '防衛機制', '重複的關係模式'],
      misses: '比較少直接處理眼前能做的事和環境因素。真正的精神分析工作需要長期的治療關係，這裡只借用它的提問方式。',
    },
    en: {
      name: 'Psychoanalytic',
      idea: 'Present reactions often carry the shape of earlier relationships. We hold wishes and fears that pull against each other, and we protect ourselves from feeling what hurts too much.',
      steps: [
        { q: 'Does this feeling seem familiar? Roughly when have you felt it before? A rough answer is enough. If what comes up is painful, stop here and come back another day, or with someone you trust.', why: 'This approach looks for ways a present reaction may repeat an older pattern.' },
        { q: 'In this situation, what does one part of you want, and what is another part afraid of?', why: 'It assumes we often hold a wish to move closer and a wish to stay safe at the same time.' },
        { q: 'When this feeling shows up, how do you usually make it more bearable? For example: distracting yourself, getting very rational, blaming yourself or someone else.', why: 'These protections (defenses) are not bad; they once helped. Sometimes they also keep us from seeing clearly.' },
      ],
      noticed: 'About when you have felt this before, you wrote: "{1}". What one part of you wants and another part fears: "{2}". How you make it more bearable when it shows up: "{3}". This approach would be curious about what that way of protecting yourself once did for you, and whether you still need it in the same way.',
      experiment: 'This week, when the pattern shows up, just note it (when, who was there, what you did). No need to change it yet.',
      concepts: ['the unconscious', 'defense mechanisms', 'repeating relational patterns'],
      misses: 'It says less about practical next steps and outside circumstances. Real psychoanalytic work happens over a long therapeutic relationship; this only borrows its questions.',
    },
  },
  {
    id: 'adlerian',
    chapter: 5,
    people: 'Alfred Adler; Rudolf Dreikurs',
    excludeTopics: ['loss'],
    zh: {
      name: '阿德勒學派',
      idea: '行為背後有目標，人最深的需要之一是歸屬與貢獻。我們會帶著一套自己的「私人邏輯」看世界，而鼓勵比批評更能帶來改變。',
      steps: [
        { q: '如果這個困擾明天就不見了，你的生活會有什麼不同？你會開始做什麼？', why: '阿德勒學派用這個問題看見你想要的生活，以及在這個困擾底下，你真正想靠近的是什麼。' },
        { q: '在這件事裡，你心裡有沒有一句「我必須……才……」？例如「我必須做到最好，才會被接納」。', why: '阿德勒把這種句子叫做私人邏輯：很少被說出口，卻影響很多選擇。' },
        { q: '有沒有一件小事，你可以「彷彿」已經是不被這個困擾綁住的自己，去做做看？', why: '「彷彿」練習讓人先在行動上試穿新的自己，不用等到感覺準備好。' },
      ],
      noticed: '如果這個困擾不見了，你想像的生活是：「{1}」。你心裡的那句話：「{2}」。阿德勒學派把這類句子叫做私人邏輯，也會問：在這件事底下，你想要的是不是歸屬、被看重、能有所貢獻？如果是環境或別人讓你受傷，那不代表是你哪裡做錯了。',
      experiment: '你想到的小事：「{3}」。選一天，彷彿你已經是那個自己，去做做看。結束後記下別人的反應，和你自己的感覺。',
      concepts: ['私人邏輯', '社會興趣', '鼓勵', '彷彿技術'],
      misses: '比較少處理身體、創傷和環境的壓力。太強調個人選擇時，可能忽略你無法掌控的部分。',
    },
    en: {
      name: 'Adlerian',
      idea: 'Behavior has a purpose, and one of our deepest needs is to belong and contribute. We see the world through a private logic, and encouragement changes more than criticism does.',
      steps: [
        { q: 'If this worry were gone tomorrow, what would be different in your life? What would you start doing?', why: 'Adlerians use this question to see the life you want, and what you are reaching for underneath this worry.' },
        { q: 'Is there an "I must ... in order to ..." sentence inside this? For example, "I have to be the best to be accepted."', why: 'Adler called this private logic: rarely said out loud, but it steers a lot of choices.' },
        { q: 'Is there one small thing you could do "as if" you were already the version of you who is not held back by this?', why: 'Acting "as if" lets you try on a new way of being before you feel ready.' },
      ],
      noticed: 'With this worry gone, the life you pictured: "{1}". The sentence inside it: "{2}". Adlerians call a sentence like this private logic, and would ask whether, underneath this, you are reaching for belonging, being valued, or contributing. If your surroundings or other people are hurting you, that does not mean you did something wrong.',
      experiment: 'The small thing you came up with: "{3}". Pick one day and try it, as if you were already that person. Afterward, note how others responded and how you felt.',
      concepts: ['private logic', 'social interest', 'encouragement', 'acting as if'],
      misses: 'It says less about the body, trauma, and outside pressures. Stressing personal choice can overlook what you cannot control.',
    },
  },
  {
    id: 'existential',
    chapter: 6,
    people: 'Viktor Frankl; Rollo May; Irvin Yalom',
    excludeTopics: ['loss'],
    zh: {
      name: '存在主義取向',
      idea: '焦慮是活著的一部分，不只是症狀。即使處境有限，我們仍然在選擇自己要如何回應，而意義常常藏在我們在乎的事情裡。',
      steps: [
        { q: '這個煩惱透露了你在乎什麼？如果你一點都不在乎，它還會困擾你嗎？', why: '存在主義取向常從困擾裡找出背後的價值。' },
        { q: '在這個處境裡，哪些是你沒辦法選的？（有些人會說那是命或緣分，用你習慣的說法就好。）哪些即使很小，仍然是你可以選的？', why: 'Yalom 和 May 都談自由與責任：這個取向承認限制，也提醒我們仍有回應的自由。' },
        { q: '如果朝你真正在乎的方向走一小步，那一步會是什麼？', why: '意義不只用想的，也是在選擇和行動裡活出來的。' },
      ],
      noticed: '關於這個煩惱透露你在乎什麼，你寫到：「{1}」。沒辦法選的和還能選的，你是這樣分的：「{2}」。存在主義取向會說：焦慮也可能是在提醒你，這件事對你很重要。',
      experiment: '你想走的一小步：「{3}」。這週試試看，做完後問自己：這一步有沒有比較像我想成為的人？',
      concepts: ['自由與責任', '意義', '真誠', '存在焦慮'],
      misses: '比較抽象，需要具體技巧的人可能覺得不夠實際。不適合在急性危機或很深的失落中自己使用。',
    },
    en: {
      name: 'Existential',
      idea: 'Anxiety is part of being alive, not only a symptom. Even within limits we choose how to respond, and meaning often lives in what we care about.',
      steps: [
        { q: 'What does this worry reveal that you care about? If you did not care at all, would it still bother you?', why: 'Existential approaches look for the value underneath a worry.' },
        { q: 'In this situation, what can you not choose? (Some people call it fate, luck, or God\'s will; use whatever words fit for you.) And what, however small, can you still choose?', why: 'Yalom and May both write about freedom and responsibility: real limits exist, and so does the freedom to respond.' },
        { q: 'If you took one small step in the direction you care about, what would it be?', why: 'Meaning is lived through choices and actions, not only thought about.' },
      ],
      noticed: 'On what this worry says you care about, you wrote: "{1}". You sorted what you can and cannot choose like this: "{2}". An existential view would say the anxiety may also be telling you this matters.',
      experiment: 'The small step you named: "{3}". Try it this week. Afterward ask: was that step closer to who I want to be?',
      concepts: ['freedom and responsibility', 'meaning', 'authenticity', 'existential anxiety'],
      misses: 'It is abstract, and can feel impractical if you want concrete skills. It is not a good fit for working through an acute crisis or a deep loss on your own.',
    },
  },
  {
    id: 'person-centered',
    chapter: 7,
    people: 'Carl Rogers',
    excludeTopics: [],
    zh: {
      name: '個人中心取向',
      idea: '每個人都有往成長方向走的力量。當一個人被真誠、準確、不評價地理解時，他通常最知道自己需要什麼。',
      steps: [
        { q: '用幾個詞說說你現在的感受，不用合理，也不用解釋。', why: '這個取向從你的經驗出發，不從別人的標準出發。' },
        { q: '這些感受裡，哪一個是你最少讓別人看見的？', why: '它在意的是你內在經驗和你表現出來的樣子之間的距離。' },
        { q: '如果有一個真正懂你、不評價你的人在旁邊，你希望他明白你什麼？你現在需要什麼？', why: 'Rogers 認為，被真誠、不帶條件地接納、準確地理解，是改變開始的地方。' },
      ],
      noticed: '你現在的感受：「{1}」。最少讓別人看見的：「{2}」。你希望被明白的：「{3}」。這個取向相信，你自己最知道方向在哪裡。',
      experiment: '如果身邊有讓你安心的人，可以只說一句「我最近其實有點……」，也可以先說「你聽我講就好」。現在沒有這樣的人，就錄一段話給自己聽，也算數。',
      concepts: ['同理', '無條件正向關懷', '真誠一致', '實現傾向'],
      misses: '提供的方向和技巧較少，需要結構或具體方法時可能不夠。也要誠實說：這只是軟體，給不了真正的關係，而這個取向認為關係本身才是療癒的核心。',
    },
    en: {
      name: 'Person-centered',
      idea: 'People have a built-in tendency to grow. When someone is understood genuinely, accurately, and without judgment, they usually know best what they need.',
      steps: [
        { q: 'Name a few words for how you feel right now. They do not have to make sense or be explained.', why: 'This approach starts from your experience, not from someone else\'s standards.' },
        { q: 'Which of those feelings do you show other people the least?', why: 'It pays attention to the gap between what you feel inside and what you show.' },
        { q: 'If someone who truly understood you, without judging, were here, what would you want them to understand? What do you need right now?', why: 'For Rogers, change begins when a person is met with genuineness, unconditional acceptance, and accurate understanding.' },
      ],
      noticed: 'How you feel right now: "{1}". The feeling you show least: "{2}". What you want understood: "{3}". This approach trusts that you know best where you need to go.',
      experiment: 'If there is someone you feel safe with, say one sentence: "Lately I have actually been feeling a bit ...", and you can start with "Just listen, you do not have to fix it". If there is no one like that right now, record a few words for yourself; that counts too.',
      concepts: ['empathy', 'unconditional positive regard', 'congruence', 'actualizing tendency'],
      misses: 'It offers little structure or technique, which may not be enough when you need concrete skills. And honestly: this is software and cannot offer a relationship, which this approach sees as the heart of change.',
    },
  },
  {
    id: 'gestalt',
    chapter: 8,
    people: 'Fritz and Laura Perls',
    excludeTopics: ['loss'],
    zh: {
      name: '完形取向',
      idea: '改變從此時此刻的覺察開始。注意你身體正在做什麼、你正在怎麼說話，比解釋「為什麼」更能讓人接觸到自己。',
      steps: [
        { q: '先停一下。想到這件事時，你身體哪裡最有感覺？是什麼樣的感覺？', why: '完形取向從當下、從身體開始，而不是從分析開始。' },
        { q: '寫一句關於這件事的「我必須……」或「我不得不……」。', why: '我們說話的方式，常常反映我們怎麼看待自己的處境。' },
        { rewrite: true, q: '把它讀成「我選擇……」，讀起來有什麼不同？照實寫就好，也可以寫「不是我選的」。', why: '換成「我選擇」能讓人看見哪些部分是自己的，哪些其實不是。如果這件事是別人加在你身上的，它就不是你的選擇；也可能是「這是我的責任，我願意扛」，或「我不想，但放不下」。兩種答案都有意義。' },
      ],
      noticed: '想到這件事時，你身體的感覺是：「{1}」。你寫下「{2}」，改成「我選擇」之後，你注意到：「{3}」。完形取向在意的不是答案，而是你此刻更清楚地接觸到自己。',
      experiment: '這週每天一次，停下來問自己：「我現在正在做什麼？身體有什麼感覺？」只要注意，不用改變。',
      concepts: ['此時此刻', '覺察', '「我」的語言', '接觸'],
      misses: '比較少處理長期模式和環境因素。更深入的完形練習（例如空椅法）需要在諮商中有人陪著做，不適合自己一個人做。',
    },
    en: {
      name: 'Gestalt',
      idea: 'Change starts with awareness in the here and now. Noticing what your body is doing and how you are speaking brings you closer to yourself than explaining why.',
      steps: [
        { q: 'Pause for a moment. Where in your body do you feel this most when you think about it? What is the sensation like?', why: 'Gestalt starts from the present and the body, not from analysis.' },
        { q: 'Write one sentence about this that begins "I have to ..." or "I must ...".', why: 'How we phrase things often shows how we see our situation.' },
        { rewrite: true, q: 'Now read it as "I choose ...". What is different? Write it as it is, or simply "I did not choose this".', why: 'Saying "I choose" can show which parts are yours and which are not. If this is being done to you, it is not your choice; it might also be "this is my responsibility and I am willing to carry it", or "I do not want to, but I cannot let it go". Either answer tells you something.' },
      ],
      noticed: 'When you think about it, your body feels: "{1}". You wrote "{2}", and reading it as "I choose" you noticed: "{3}". Gestalt cares less about the answer than about being in clearer contact with yourself right now.',
      experiment: 'Once a day this week, stop and ask: "What am I doing right now? What do I feel in my body?" Just notice. You do not need to change anything.',
      concepts: ['here and now', 'awareness', '"I" language', 'contact'],
      misses: 'It says less about long-term patterns and circumstances. Deeper Gestalt exercises (such as the empty chair) need a therapist present and are not meant to be done alone.',
    },
  },
  {
    id: 'behavioral',
    chapter: 9,
    people: 'B. F. Skinner; Joseph Wolpe; Albert Bandura; Arnold Lazarus',
    excludeTopics: ['loss'],
    zh: {
      name: '行為治療',
      idea: '行為是在情境中被學會、被維持的。看清楚「之前發生什麼、做了什麼、之後發生什麼」，就能設計小而具體的改變，並且用結果來檢驗。',
      steps: [
        { q: '最近一次這個困擾出現時，前面發生了什麼？（時間、地點、和誰、在做什麼）', why: '行為取向先看觸發的情境（A，前因）。' },
        { q: '那時你做了什麼？做完之後，短時間內發生了什麼？你感覺怎樣？', why: '行為（B）和它帶來的結果（C）會決定這個行為會不會一再出現。' },
        { q: '下次遇到同樣的情境，有沒有一個小到幾乎不可能失敗的不同做法？', why: '改變從小而具體、可以觀察的步驟開始。' },
      ],
      noticed: '那次之前發生的事：「{1}」。你做了什麼、之後怎麼樣：「{2}」。短期讓人好過的做法，有時長期反而讓困擾留下來。你想試的新做法：「{3}」。',
      experiment: '幫這個新做法（「{3}」）在行事曆上排一個時間。做之前和做之後各用 0 到 10 記一下心情，一週後比較看看。',
      concepts: ['前因、行為、後果（ABC）', '增強', '行為實驗', '活動安排'],
      misses: '比較少探索意義和情緒的內在經驗。比較嚴重的焦慮或創傷（例如需要逐步暴露時）可以和心理師或醫師一起規劃，不要自己硬撐。',
    },
    en: {
      name: 'Behavior therapy',
      idea: 'Behavior is learned and maintained in context. Seeing clearly what came before, what you did, and what followed lets you design small, concrete changes and test them by their results.',
      steps: [
        { q: 'The last time this worry showed up, what was happening just before? (Time, place, who was there, what you were doing.)', why: 'A behavioral approach starts with the trigger (A, antecedent).' },
        { q: 'What did you do then? What happened right after, and how did you feel?', why: 'The behavior (B) and its consequences (C) decide whether it keeps happening.' },
        { q: 'Next time the same situation comes up, is there a different response so small it would be almost impossible to fail?', why: 'Change starts with small, concrete, observable steps.' },
      ],
      noticed: 'What was happening just before: "{1}". What you did and what followed: "{2}". What brings relief in the short term sometimes keeps a problem going. The new response you want to try: "{3}".',
      experiment: 'Put that new response ("{3}") on your calendar. Rate your mood 0 to 10 before and after, and compare after a week.',
      concepts: ['antecedent, behavior, consequence (ABC)', 'reinforcement', 'behavioral experiment', 'activity scheduling'],
      misses: 'It explores meaning and inner experience less. More serious anxiety or trauma (for example when gradual exposure is needed) is best planned with a therapist or doctor, not pushed through alone.',
    },
  },
  {
    id: 'acceptance',
    chapter: 9,
    people: 'Jon Kabat-Zinn; Marsha Linehan; Steven Hayes',
    excludeTopics: [],
    zh: {
      name: '正念與接納取向',
      idea: '和難受的想法、感受對抗，常常讓它們更大。練習不帶評價地注意它們，和它們保持一點距離，然後仍然朝自己在乎的方向前進。這裡的正念不是正向思考，也不需要任何宗教信仰。',
      steps: [
        { q: '花三個呼吸的時間，注意現在的感受，不去改變它。然後寫下：這個困擾最常對你說的一句話是什麼？', why: '正念從不評價地注意開始。' },
        { rewrite: 'defuse', q: '把那句話讀成：「我注意到我有一個想法：……」。這樣看它，你和它的距離有沒有變化？', why: '接納與承諾治療（ACT，Hayes）把這叫做認知脫鉤：想法還在，但你不一定要照它說的做。' },
        { q: '就算這個想法和感受還在，今天你仍然想朝什麼重要的方向做一點點？', why: '接納不是放棄，而是把力氣留給你在乎的事。' },
      ],
      noticed: '這個困擾最常說的話：「{1}」。把它看成「一個想法」時，你注意到：「{2}」。即使它還在，你仍想朝這個方向做一點點：「{3}」。',
      experiment: '這週每次那句話出現，就在心裡加上「我注意到我有一個想法：……」，再朝你寫的方向（「{3}」）做一件小事。',
      concepts: ['正念', '接納', '認知脫鉤', '價值導向的行動'],
      misses: '接納不等於忍受不合理或不安全的處境。當問題出在環境或關係裡時，只改變自己和想法的關係是不夠的。',
    },
    en: {
      name: 'Mindfulness and acceptance',
      idea: 'Fighting difficult thoughts and feelings often makes them bigger. Notice them without judgment, hold them a little more lightly, and keep moving toward what matters to you. Mindfulness here is not positive thinking, and it needs no religious belief.',
      steps: [
        { q: 'Take three breaths and notice what you feel, without changing it. Then write: what is the sentence this worry says to you most often?', why: 'Mindfulness starts with noticing without judgment.' },
        { rewrite: 'defuse', q: 'Read it as: "I notice I am having the thought that ...". Does the distance between you and the thought change?', why: 'Acceptance and commitment therapy (ACT, Hayes) calls this defusion: the thought is still there, but you do not have to do what it says.' },
        { q: 'Even with this thought and feeling still here, what small step toward something important do you want to take today?', why: 'Acceptance is not giving up; it frees energy for what you care about.' },
      ],
      noticed: 'What the worry says most often: "{1}". Seeing it as "a thought", you noticed: "{2}". Even with it here, the step you still want to take: "{3}".',
      experiment: 'Each time that sentence shows up this week, add "I notice I am having the thought that ..." in your head, then do one small thing in the direction you named ("{3}").',
      concepts: ['mindfulness', 'acceptance', 'defusion', 'values-based action'],
      misses: 'Acceptance does not mean tolerating situations that are unfair or unsafe. When the problem lies in your environment or a relationship, changing how you hold your thoughts is not enough.',
    },
  },
  {
    id: 'rebt',
    chapter: 10,
    people: 'Albert Ellis',
    excludeTopics: ['loss'],
    zh: {
      name: '理情行為治療（REBT）',
      idea: '讓我們困擾的，常常不只是事件本身，而是我們對事件的信念，特別是那些絕對的「應該」和「必須」。',
      steps: [
        { q: '發生了什麼事？只寫事實，像攝影機拍到的那樣。（A，觸發事件）', why: '這是 Ellis 的 ABC 模式：REBT 先把事件和我們對事件的解讀分開。' },
        { q: '關於這件事，你心裡有沒有一個「應該」或「必須」？例如「他應該要……」「我必須……」。（B，信念）', why: '它認為絕對化的要求，常讓合理的失望變成難以承受的痛苦。' },
        { q: '帶著這個信念，你的感受和反應是什麼？（C，結果）', why: 'REBT 認為感受主要來自 B，而不只是 A。' },
        { q: '只看「一定要、不然就完了」那部分。改成「我很希望……，做不到也不代表我很糟」，感受有什麼不同？（D 駁斥，E 新的效果）', why: '有些「應該」是你真心看重的責任，不用拿掉。這是溫和版本的駁斥：不是否認你想要的，而是放下「一定要」。Ellis 把駁斥之後出現的新感受和新想法叫做 E（效果）。' },
      ],
      noticed: '事件（A）：「{1}」。你帶著的信念（B）：「{2}」。帶來的感受和反應（C）：「{3}」。把「一定要」換成「很希望」之後，你注意到：「{4}」。',
      experiment: '這週每次發現自己說「應該」或「必須」，就試著在心裡改成「我很希望……」，看看感受有沒有不同。',
      concepts: ['ABC 模式', '非理性信念', '偏好與要求', '駁斥'],
      misses: '有時太直接。有些「應該」反映的是真實的不公平，問題不只在想法；這時更需要的是改變處境或找到支持。',
    },
    en: {
      name: 'Rational emotive behavior therapy (REBT)',
      idea: 'What upsets us is often less the event itself than our beliefs about it, especially absolute "shoulds" and "musts".',
      steps: [
        { q: 'What happened? Only the facts, as a camera would have recorded them. (A, the activating event)', why: 'This is Ellis\'s ABC model: REBT first separates the event from our interpretation of it.' },
        { q: 'Is there a "should" or "must" in your mind about it? For example, "He should have ...", "I must ...". (B, the belief)', why: 'It holds that absolute demands turn reasonable disappointment into unbearable distress.' },
        { q: 'Holding that belief, how did you feel and react? (C, the consequence)', why: 'REBT holds that feelings come mainly from B, not only from A.' },
        { q: 'Take just the "it has to happen, or it is all over" part. If it became "I would really like ..., and if not, I am not a failure", how would the feeling change? (D, disputing; E, effect)', why: 'Some "shoulds" are duties you truly value; keep those. This is a gentle form of disputing: not denying what you want, just dropping "it has to be". Ellis called the new feeling and outlook that follow disputing E, the effect.' },
      ],
      noticed: 'The event (A): "{1}". The belief you carried (B): "{2}". How you felt and reacted (C): "{3}". Holding it as a preference rather than a demand, you noticed: "{4}".',
      experiment: 'Whenever you catch yourself saying "should" or "must" this week, try turning it into "I would really like ...", and notice whether the feeling shifts.',
      concepts: ['the ABC model', 'irrational beliefs', 'preferences versus demands', 'disputing'],
      misses: 'It can be blunt. Some "shoulds" point to real unfairness, and then the problem is not only in your thinking; changing the situation or finding support matters more.',
    },
  },
  {
    id: 'cognitive',
    chapter: 10,
    people: 'Aaron T. Beck; Judith Beck; Donald Meichenbaum',
    excludeTopics: ['loss'],
    zh: {
      name: '認知治療',
      idea: '我們的感受深受自動冒出來的想法影響。把想法當成可以檢驗的假設，而不是事實，常能找到更平衡的看法。',
      steps: [
        { q: '這件事發生時，你腦中第一個冒出來的想法是什麼？', why: 'Beck 把這種想法叫做「自動化思考」，認知治療從抓住它開始。' },
        { q: '有什麼證據支持這個想法？又有什麼證據不太符合它？', why: '把想法當成假設，看看兩邊的證據。' },
        { q: '如果是你在乎的人（朋友、家人、學弟妹都可以）遇到一樣的事、有一樣的想法，你會對他說什麼？', why: '我們對朋友通常比對自己公平，這能幫你找到更平衡的看法。' },
      ],
      noticed: '自動冒出來的想法：「{1}」。你列出的證據：「{2}」。你會對在乎的人說的話：「{3}」。這句話也許也適用在你自己身上，可以當成一個比較平衡的看法。',
      experiment: '準備三句可以對自己說的話：事前（「我知道這會有點難，我可以一步一步來」）、當下、事後各一句。這是 Meichenbaum 的因應自我對話。',
      concepts: ['自動化思考', '認知扭曲', '證據檢驗', '平衡的想法', '因應自我對話'],
      misses: '不是所有的難受都來自認知扭曲（Beck 指的是想法偏離事實的習慣，例如非黑即白）。有時你的想法是準確的，問題在處境本身；這時要做的不是改想法，而是處理處境。',
    },
    en: {
      name: 'Cognitive therapy',
      idea: 'How we feel is shaped by thoughts that pop up automatically. Treating a thought as a hypothesis to test, not a fact, often leads to a more balanced view.',
      steps: [
        { q: 'When this happened, what was the first thought that popped into your head?', why: 'Beck called these automatic thoughts, and cognitive therapy starts by catching one.' },
        { q: 'What evidence supports that thought? What evidence does not quite fit it?', why: 'Treat the thought as a hypothesis and look at both sides.' },
        { q: 'If someone you care about (a friend, a family member, a coworker) had the same experience and the same thought, what would you tell them?', why: 'We are usually fairer to friends than to ourselves, which helps find a balanced view.' },
      ],
      noticed: 'The automatic thought: "{1}". The evidence you listed: "{2}". What you would tell someone you care about: "{3}". That may apply to you too, as a more balanced view.',
      experiment: 'Prepare three things to say to yourself: one for before ("I know this will be a little hard, and I can take it one step at a time"), one for during, one for after. These are Meichenbaum\'s coping self-statements.',
      concepts: ['automatic thoughts', 'cognitive distortions', 'examining evidence', 'balanced thoughts', 'coping self-statements'],
      misses: 'Not all distress comes from cognitive distortions (Beck\'s term for habits of thought that drift from the facts, such as all-or-nothing thinking). Sometimes your thought is accurate and the problem is the situation itself; then the work is changing the situation, not the thought.',
    },
  },
  {
    id: 'reality',
    chapter: 11,
    people: 'William Glasser; Robert Wubbolding',
    excludeTopics: ['loss'],
    zh: {
      name: '現實治療與選擇理論',
      idea: '我們都在努力滿足生存、愛與歸屬、權力（成就感）、自由和樂趣這五種需求。與其停在過去，不如看清楚：我想要什麼、我正在做什麼、這有沒有用、接下來的計畫是什麼。',
      steps: [
        { q: '在這件事裡，你真正想要的是什麼？（W，想要）', why: '現實治療從釐清你想要什麼開始。這四題是 Wubbolding 依 Glasser 的選擇理論整理出的 WDEP。' },
        { q: '你現在實際上在做什麼？請寫具體的行為，不是感覺。（D，行動）', why: '它把焦點放在你能掌握的行動上。' },
        { q: '你現在做的事，有讓你更接近想要的嗎？（E，評估）', why: '自我評估是這個取向的核心：由你判斷，不是由別人評價。' },
        { q: '一個簡單、今天或明天就能做、靠你自己就能完成的計畫是什麼？（P，計畫）', why: '好的計畫要小、具體、立刻可做，而且不依賴別人先改變。' },
      ],
      noticed: '你想要的（W）：「{1}」。你正在做的（D）：「{2}」。你的評估（E）：「{3}」。你的計畫（P）：「{4}」。',
      experiment: '照你的計畫做做看：「{4}」。如果沒做到，不用責怪自己，回來把計畫改得更小一點。',
      concepts: ['WDEP', '五種基本需求', '自我評估', '可控制的行動'],
      misses: '強調可控制的選擇，可能低估創傷、病痛和社會結構的壓力。它不是在說你的痛苦是你「選」的。',
    },
    en: {
      name: 'Reality therapy and choice theory',
      idea: 'We are all trying to meet five basic needs: survival, love and belonging, power (a sense of achievement), freedom, and fun. Rather than dwelling on the past, look clearly at what you want, what you are doing, whether it works, and what your plan is.',
      steps: [
        { q: 'In this situation, what do you really want? (W, wants)', why: 'Reality therapy starts by clarifying what you want. These four questions follow WDEP, which Wubbolding built on Glasser\'s choice theory.' },
        { q: 'What are you actually doing right now? Write specific actions, not feelings. (D, doing)', why: 'It focuses on the actions you have control over.' },
        { q: 'Is what you are doing getting you closer to what you want? (E, evaluation)', why: 'Self-evaluation is the core: you are the one who decides, not anyone else.' },
        { q: 'What is a simple plan you can carry out yourself, today or tomorrow? (P, plan)', why: 'Good plans are small, specific, immediate, and do not depend on someone else changing first.' },
      ],
      noticed: 'What you want (W): "{1}". What you are doing (D): "{2}". Your evaluation (E): "{3}". Your plan (P): "{4}".',
      experiment: 'Try your plan: "{4}". If it does not happen, do not blame yourself; come back and make the plan smaller.',
      concepts: ['WDEP', 'five basic needs', 'self-evaluation', 'controllable action'],
      misses: 'Its focus on controllable choices can understate trauma, illness, and structural pressure. It does not mean your pain is something you "chose".',
    },
  },
  {
    id: 'feminist',
    chapter: 12,
    people: 'Jean Baker Miller; Carolyn Zerbe Enns; Laura Brown',
    excludeTopics: [],
    zh: {
      name: '女性主義治療',
      idea: '個人的困擾，常常和社會角色、性別期待和權力關係有關。分清楚哪些是你的，哪些是別人或社會給的，本身就有力量。',
      steps: [
        { q: '有沒有哪些「應該」是別人或社會給的？例如身為女兒、媳婦、長子長女「就應該……」。哪些你也認同？哪些不太同意，卻一直照著做？', why: '女性主義治療會做性別角色分析：看見那些被視為理所當然的期待（職場上「員工就應該……」也算），再分清楚哪些是你自己也要的。' },
        { q: '在這件事裡，通常誰說了算？（例如長輩、主管、負擔家計的人）你說的話有多少份量？這怎麼影響你？', why: '它也會做權力分析，因為困擾常和不平等的位置有關。' },
        { q: '哪些部分是你可以處理的？哪些其實不是你一個人的責任？', why: '分清楚個人和結構，可以減少不必要的自責。' },
      ],
      noticed: '關於別人或社會給的「應該」，你寫到：「{1}」。關於誰說了算，你看見的是：「{2}」。能處理的，和不是你一個人責任的部分，你是這樣分的：「{3}」。',
      experiment: '把「不是我一個人的責任」那部分寫下來，這週和一個能理解的人聊聊，看看別人是不是也背著類似的期待。',
      concepts: ['個人即政治', '性別角色分析', '權力分析', '賦權'],
      misses: '個人內在的情緒處理談得比較少。分析結構不代表一定要正面衝突，你的安全永遠優先。',
    },
    en: {
      name: 'Feminist therapy',
      idea: 'Personal distress is often tied to social roles, gender expectations, and power. Sorting out what is yours from what was handed to you is powerful in itself.',
      steps: [
        { q: 'Are there "shoulds" here that came from other people or society? For example, as a daughter, a mother, the oldest child, or the "strong one," you "should ...". Which do you share, and which do you follow without really agreeing?', why: 'Feminist therapy uses gender-role analysis to make taken-for-granted expectations visible (workplace ones count too), and to sort out which of them you also want for yourself.' },
        { q: 'In this situation, who usually has the final say (a parent, a boss, whoever earns the money)? How much weight do your words carry? How does that affect you?', why: 'It also uses power analysis, since distress is often tied to unequal positions.' },
        { q: 'Which parts can you handle? Which parts are not yours alone to carry?', why: 'Separating the personal from the structural can reduce unnecessary self-blame.' },
      ],
      noticed: 'About the "shoulds" handed to you, you wrote: "{1}". About who has the say, you noticed: "{2}". What you can handle, and what is not yours alone: "{3}".',
      experiment: 'Write down the part that is not yours alone. This week, talk about it with someone who might understand, and see whether they carry similar expectations.',
      concepts: ['the personal is political', 'gender-role analysis', 'power analysis', 'empowerment'],
      misses: 'It says less about working with inner emotions. Analyzing structures does not mean you must confront anyone; your safety always comes first.',
    },
  },
  {
    id: 'solution-focused',
    chapter: 13,
    people: 'Steve de Shazer; Insoo Kim Berg',
    excludeTopics: ['loss'],
    zh: {
      name: '焦點解決取向',
      idea: '與其深入分析問題，不如找出已經有用的部分。每個人都有資源，也都有困擾比較小的時刻。',
      steps: [
        { scale: true, q: '從 0 到 10，10 代表這件事處理得讓你很滿意，你現在在幾分？', why: '這是 de Shazer 和 Berg 的評量問句，讓抽象的感覺變得可以討論。' },
        { q: '為什麼是 {1} 分，而不是更低？你做了什麼，讓它沒有更糟？', qZero: '在 0 分的時候，你是怎麼撐到現在的？', why: '這是評量問句的追問，作用和因應問句一樣：先看見你已經在做的努力。' },
        { q: '最近有沒有哪一刻，這個困擾比較小，或沒有出現？那時有什麼不同？想不到也沒關係，很小的一次也算。', why: '這是例外問句：答案常常藏在例外裡。' },
      ],
      noticed: '你現在在 {1} 分。關於你怎麼撐住，你寫到：「{2}」。困擾比較小的那一刻：「{3}」。焦點解決取向會在這些地方，找你已經在做、而且有用的事。',
      experiment: '往上一分會是什麼樣子？這週找一個小跡象。困擾比較小的那一刻（「{3}」）裡如果有什麼有用的，就多做一點。',
      concepts: ['評量問句', '例外問句', '因應問句', '奇蹟問句', '資源'],
      misses: '專注在未來和資源，有時會讓人覺得自己的痛苦沒有被好好聽見。如果你需要先被理解，個人中心取向可能更適合。',
    },
    en: {
      name: 'Solution-focused',
      idea: 'Rather than analyzing the problem in depth, find what already works. Everyone has resources and moments when the problem is smaller.',
      steps: [
        { scale: true, q: 'On a scale from 0 to 10, where 10 means you are satisfied with how this is going, where are you now?', why: 'This is a scaling question from de Shazer and Berg. It makes a vague feeling something you can talk about.' },
        { q: 'What keeps it at {1} rather than lower? What have you been doing that keeps it from being worse?', qZero: 'A 0 means things are really hard right now. How have you managed to keep going?', why: 'This follow-up to the scaling question works like a coping question: it notices efforts you are already making.' },
        { q: 'Recently, was there a moment when this worry was smaller or absent? What was different then? If nothing comes, that is fine; a very small moment counts.', why: 'This is an exception question: the answer often hides in the exceptions.' },
      ],
      noticed: 'You are at {1}. On what keeps you going, you wrote: "{2}". The moment the worry was smaller: "{3}". A solution-focused view would look in these places for things you already do that help.',
      experiment: 'What would one point higher look like? Look for one small sign this week. If something helped in the moment you described ("{3}"), do a little more of it.',
      concepts: ['scaling questions', 'exception questions', 'coping questions', 'the miracle question', 'resources'],
      misses: 'Its focus on the future and on resources can leave you feeling your pain was not fully heard. If you need to be understood first, the person-centered lens may fit better.',
    },
  },
  {
    id: 'narrative',
    chapter: 13,
    people: 'Michael White; David Epston',
    excludeTopics: ['loss'],
    zh: {
      name: '敘事治療',
      idea: '人不是問題，問題才是問題。我們活在自己和別人說的故事裡，而故事是可以被重新說的。',
      steps: [
        { q: '如果這個困擾是一個角色，你會給它取什麼名字？', why: 'White 和 Epston 的敘事治療會把問題外化：把它和「你這個人」分開。' },
        { q: '「{1}」通常怎麼影響你？它叫你做什麼、相信什麼？', why: '看清楚問題的影響，就能開始看見你和它的關係。' },
        { q: '有沒有一次，你沒有照「{1}」說的做？很小的一次也算，例如晚了五分鐘才照做。那一次透露了你是怎樣的人？想不到也沒關係。', why: '這是「獨特結果」：主流故事之外，關於你的另一個故事。' },
      ],
      noticed: '你把它叫做「{1}」。你說它對你的影響是：「{2}」。但有一次，你沒有照它說的做：「{3}」。那可能是另一個故事的開頭。',
      experiment: '這週每當「{1}」出現，就記下它說了什麼，以及你有沒有哪一次沒聽它的。',
      concepts: ['外化', '主流故事', '獨特結果', '重寫故事'],
      misses: '重寫故事需要時間，通常也需要見證的人。外化不適合用在自己對別人造成的傷害上，那需要的是負起責任。',
    },
    en: {
      name: 'Narrative therapy',
      idea: 'The person is not the problem; the problem is the problem. We live inside stories told by ourselves and others, and stories can be retold.',
      steps: [
        { q: 'If this worry were a character, what would you name it?', why: 'White and Epston\'s narrative therapy externalizes the problem, separating it from who you are.' },
        { q: 'How does "{1}" usually affect you? What does it tell you to do or believe?', why: 'Mapping the problem\'s influence makes your relationship with it visible.' },
        { q: 'Was there a time you did not do what "{1}" told you? A small one counts, like waiting five minutes before doing what it said. What does that say about you as a person? If nothing comes, that is fine.', why: 'This is a "unique outcome": another story about you, outside the dominant one.' },
      ],
      noticed: 'You named it "{1}". How it affects you, in your words: "{2}". But once, you did not follow it: "{3}". That may be the start of another story.',
      experiment: 'Each time "{1}" shows up this week, note what it said, and any time you did not listen to it.',
      concepts: ['externalizing', 'dominant story', 'unique outcomes', 're-authoring'],
      misses: 'Retelling a story takes time and usually people to witness it. Externalizing is not for harm you have done to others; that calls for taking responsibility.',
    },
  },
  {
    id: 'family-systems',
    chapter: 14,
    people: 'Murray Bowen; Virginia Satir; Salvador Minuchin',
    excludeTopics: [],
    zh: {
      name: '家族系統取向',
      idea: '一個人的困擾，常常是一整個關係系統的一部分。看見模式在家人之間怎麼流動、怎麼傳下來，能讓人少一點自責，多一點選擇。',
      steps: [
        { q: '家人或身邊重要的人裡，有誰也有過類似的事或擔心？想到誰就寫誰。這只給你自己看，不是在說家人的不是；太沉重就寫「先跳過」。', why: '家族系統取向會像畫家系圖一樣，看模式怎麼在世代之間傳遞。' },
        { q: '壓力大的時候，你們家的人通常怎麼反應？有沒有人常常被夾在中間？', why: '兩個人關係緊張時，常會把第三個人拉進來。Bowen 把這叫做三角關係。' },
        { q: '先不用說出口。在這件事上，你自己的想法是什麼？寫一句以「我」開頭的話，寫給自己看就好。', why: 'Bowen 稱之為自我分化：既保持連結，也保有自己。' },
      ],
      noticed: '你寫到的家人或重要的人：「{1}」。壓力來時，家裡的反應：「{2}」。你自己的想法是：「{3}」。看見模式，是為了少一點自責，不是要怪誰。',
      experiment: '這週觀察一次家裡的壓力模式，注意自己在裡面的位置。要不要說、對誰說、用什麼方式（當面、傳訊息、請家裡比較好講話的人轉達），都由你決定。不說，也不代表你沒有立場。',
      concepts: ['家系圖', '三角關係', '自我分化', '多世代傳遞歷程'],
      misses: '個人的生理和心理因素談得比較少。直接和家人攤牌或斷絕關係，一個人做會很辛苦，這類決定值得和心理師一起想。如果家裡不安全，你的安全優先，可以打 113 保護專線。',
    },
    en: {
      name: 'Family systems',
      idea: 'A person\'s distress is often part of a wider relationship system. Seeing how patterns move between family members and across generations can bring less self-blame and more choice.',
      steps: [
        { q: 'Who in your family, or close to you, has been through something similar or has a similar worry? Write whatever comes. This is only for you, not a criticism of your family; if it is too heavy, write "skip for now".', why: 'Family systems work traces patterns across generations, like drawing a genogram.' },
        { q: 'When stress is high, how do people in your family usually react? Is someone often caught in the middle?', why: 'When two people are tense, they often pull in a third. Bowen called this a triangle (triangulation).' },
        { q: 'No need to say it to anyone. What is your own view on this? Write one sentence beginning with "I", just for you.', why: 'Bowen called this differentiation of self: staying connected while staying yourself.' },
      ],
      noticed: 'The people you wrote about: "{1}". How your family reacts under stress: "{2}". What you yourself think: "{3}". The point of seeing a pattern is to blame yourself less, not to blame anyone else.',
      experiment: 'This week, watch for the stress pattern once and notice where you stand in it. Whether to say anything, to whom, and how (in person, by text, through a family member who is easier to talk to) is up to you. Staying quiet does not mean you do not have a view.',
      concepts: ['genogram', 'triangulation', 'differentiation of self', 'multigenerational transmission process'],
      misses: 'It says less about individual biological and psychological factors. A big confrontation or cutting off contact is hard to do alone; decisions like that are worth thinking through with a therapist. If home is not safe, your safety comes first.',
    },
  },
];

export function lensById(id) {
  return LENSES.find((l) => l.id === id);
}

export function lensesForTopic(topic) {
  return LENSES.filter((l) => !l.excludeTopics.includes(topic));
}

// Approaches often reached for with each kind of worry, listed first on the pick screen. A
// reading aid, not a recommendation: every suitable lens stays one tap away.
export const TOPIC_COMMON = {
  work: ['cognitive', 'rebt', 'solution-focused', 'behavioral', 'acceptance'],
  relationship: ['person-centered', 'adlerian', 'family-systems', 'feminist', 'narrative'],
  family: ['family-systems', 'adlerian', 'feminist', 'narrative', 'person-centered'],
  self: ['person-centered', 'existential', 'cognitive', 'narrative', 'acceptance'],
  loss: ['person-centered', 'acceptance', 'family-systems', 'psychoanalytic'],
};

// Shorten an answer for quoting back.
export function quote(text, max = 60) {
  const s = String(text || '').trim().replace(/\s+/g, ' ');
  if (s.length <= max) return s;
  // cut at a word boundary for space-separated text; Chinese can be cut anywhere
  let cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  if (sp > max * 0.6) cut = cut.slice(0, sp);
  return cut + '…';
}

// Answers that mean "nothing to say here" (the answer hint invites them). They are never quoted
// back as if they were content: "you wrote 'not sure'" reads like being graded.
const NON_ANSWER = /^(不知道|不曉得|不確定|不清楚|不知|想不到|沒想法|先跳過|跳過|略過|先不寫|i\s*don'?t\s*know|idk|dunno|not\s*sure|no\s*idea|skip|skip\s*for\s*now|pass)$/i;
export function isNonAnswer(text) {
  const s = String(text ?? '').trim().replace(/[\s。.!！?？~～…、,，「」"'“”]+$/g, '').replace(/^[「"“]+/, '');
  return !s || NON_ANSWER.test(s);
}

// Fill {1}, {2}, ... with earlier answers. A blank or "not sure" answer becomes an ellipsis,
// with the quotation marks around it dropped.
// Inside a question (opts.inQuestion) answers are cut shorter, and a blank one reads as "it".
export function fill(template, answers, opts = {}) {
  const zh = /[\u4e00-\u9fff]/.test(template);
  return template.replace(/([「"“]?)\{(\d)\}([」"”]?)/g, (_, open, i, close) => {
    const a = answers[Number(i) - 1];
    if (isNonAnswer(a)) return opts.inQuestion ? (zh ? '它' : 'it') : zh ? '……' : '…';
    // one trailing full stop is dropped so a quoted answer does not end in 「。」。 or ".".
    const q = quote(a, opts.inQuestion ? (zh ? 16 : 32) : 60);
    return open + (open || close ? q.replace(/([^.。])[.。]$/, '$1') : q) + close;
  });
}

// The transformed sentence shown before a `rewrite` step.
export function rewriteText(kind, previous, lang) {
  if (isNonAnswer(previous)) return lang === 'en' ? 'You left the last one open. This one can stay open too.' : '上一題你先留白了，這一題也可以留白。';
  const p = quote(previous, 120);
  if (kind === 'defuse') return lang === 'en' ? `I notice I am having the thought that "${p}".` : `我注意到我有一個想法：「${p}」。`;
  // "I have to / I must" -> "I choose"
  if (lang === 'en') {
    const m = p.match(/^\s*i\s+(?:have to|must|need to|should|have got to)\s+(.*)$/i);
    return m ? `I choose to ${m[1]}` : `"${p}" (read any "I have to" part as "I choose"; if it is not yours to choose, leave it)`;
  }
  const m = p.match(/^\s*我(?:必須|不得不|一定要|應該|得(?![了到過知獎病罪]))\s*(.*)$/);
  return m ? `我選擇${m[1]}` : `「${p}」（覺得「不得不」的部分，試著讀成「我選擇……」；不是你能選的就不用改）`;
}
