// Bedtime tracks: short wind-down scripts in the spirit of counseling theories that suit
// the end of the day. Written for Murmur; not therapy, and not the words of any real person.
// Disputing and analysis are left out of bedtime on purpose: they are better done in
// daylight, in the lens exercise. The one psychoanalytic track ('drift') interprets nothing,
// puts its way out before its invitation, and is never picked at random.
//
// A script is a list of [sentence, pause in seconds after it].
// One line near the start names tonight's kinds of worry (themeLine), when any were chosen.

export const THEMES = ['work', 'relationship', 'family', 'health', 'future', 'unsure'];

// A gentle suggestion for each kind of worry; the person can still pick any track.
export const THEME_TRACK = { work: 'solution-focused', relationship: 'person-centered', family: 'family-systems', health: 'relaxation', future: 'acceptance', unsure: 'person-centered' };

// How each kind of worry is said aloud. `one` stands in a full clause ("今晚心上有…" /
// "Tonight, … is on your mind"); `short` is for the line that names three.
const THEME_TEXT = {
  'zh-TW': {
    work: { one: '工作或學業的事', short: '工作或學業的' },
    relationship: { one: '關係裡的事', short: '關係裡的' },
    family: { one: '家裡的事', short: '家裡的' },
    health: { one: '身體的事', short: '身體的' },
    future: { one: '對以後的擔心', short: '以後的' },
  },
  en: {
    work: { one: 'work or school' },
    relationship: { one: 'a relationship' },
    family: { one: 'family' },
    health: { one: 'your health' },
    future: { one: 'what comes next' },
  },
};

// The themes a script may name: known ones, in the order chosen, each once. 'unsure' names
// nothing, so it is dropped; an old single `theme` string is read as a list of one.
export function namedThemes(themes) {
  const list = Array.isArray(themes) ? themes : themes ? [themes] : [];
  return [...new Set(list)].filter((tm) => tm !== 'unsure' && THEMES.includes(tm));
}

// One short spoken line for what is on the person's mind tonight. Written out per count so it
// reads as a sentence and not as a filled-in list; past three, the kinds are not named at all.
export function themeLine(themes, lang) {
  const l = lang === 'en' ? 'en' : 'zh-TW';
  const names = namedThemes(themes).map((tm) => THEME_TEXT[l][tm]);
  const [a, b, c] = names;
  if (!names.length) return '';
  if (l === 'en') {
    if (names.length === 1) return `Tonight, ${a.one} is on your mind.`;
    if (names.length === 2) return `Tonight, ${a.one} is on your mind, and ${b.one} too.`;
    if (names.length === 3) return `Tonight there is more than one thing on your mind. ${a.one[0].toUpperCase()}${a.one.slice(1)}, ${b.one}, and ${c.one}.`;
    return 'Tonight there is a lot on your mind.';
  }
  if (names.length === 1) return `今晚心上有${a.one}。`;
  if (names.length === 2) return `今晚心上有${a.one}，也有${b.one}。`;
  if (names.length === 3) return `今晚心上不只一件事。有${a.short}，有${b.short}，也有${c.short}。`;
  return '今晚，心上放了好幾件事。';
}

const OPEN = {
  'zh-TW': [
    ['現在，讓自己找一個舒服的姿勢。', 4],
    ['如果你願意，可以閉上眼睛，或者讓視線輕輕停在前面。', 4],
    ['吸一口氣，再慢慢吐出來。', 6],
    ['再一次。吸氣，然後吐氣。', 7],
    ['過程中，如果覺得更緊繃，隨時可以停下來，睜開眼睛。', 4],
  ],
  en: [
    ['Find a position that feels comfortable.', 4],
    ['If you like, close your eyes, or let your gaze rest softly in front of you.', 4],
    ['Breathe in, and slowly breathe out.', 6],
    ['Once more. In, and out.', 7],
    ['If you feel more tense at any point, you can stop and open your eyes.', 4],
  ],
};

// Used when nothing was set down tonight.
const SET_DOWN_GENERIC = {
  'zh-TW': [
    ['如果今天有什麼事，心裡放不下，可以想像把它放在床邊的桌上。', 5],
    ['明天早上，它還會在那裡。', 6],
  ],
  en: [
    ['If anything from today is still with you, imagine placing it on the table beside your bed.', 5],
    ['It will still be there in the morning.', 6],
  ],
};

// After the line from themeLine(): one kind of worry, or several.
const SET_DOWN = {
  'zh-TW': [
    ['它是真的，也值得好好處理。只是，不用現在。', 4],
    ['想像把它放在床邊的桌上。', 5],
    ['明天早上，它還會在那裡。到時候，再決定怎麼做。', 6],
  ],
  en: [
    ['It is real, and it deserves attention. Just not right now.', 4],
    ['Imagine placing it on the table beside your bed.', 5],
    ['It will still be there in the morning. You can decide what to do with it then.', 6],
  ],
};
const SET_DOWN_MANY = {
  'zh-TW': [
    ['這些都是真的，也都值得好好處理。只是，不用現在。', 4],
    ['想像把它們一件一件，放在床邊的桌上。', 6],
    ['明天早上，它們還會在那裡。到時候，再決定怎麼做。', 6],
  ],
  en: [
    ['They are real, and they deserve attention. Just not right now.', 4],
    ['Imagine placing them, one at a time, on the table beside your bed.', 6],
    ['They will still be there in the morning. You can decide what to do with them then.', 6],
  ],
};

const CLOSE = {
  'zh-TW': [
    ['今晚就到這裡。', 3],
    ['不用做得很好，也不用想清楚什麼。', 4],
    ['讓呼吸自己來。', 6],
    ['讓身體慢慢沉下去。', 8],
    ['晚安。', 2],
  ],
  en: [
    ['That is enough for tonight.', 3],
    ['You do not need to do this well, or figure anything out.', 4],
    ['Let your breath come on its own.', 6],
    ['Let your body grow heavy.', 8],
    ['Good night.', 2],
  ],
};

export const TRACKS = [
  {
    id: 'person-centered',
    lens: 'person-centered',
    zh: {
      name: '溫柔地陪自己',
      style: '個人中心取向風格',
      core: [
        ['不管你今天感覺到什麼，都可以先讓它在這裡。', 5],
        ['不用告訴自己，不可以有這種感覺。', 5],
        ['想像有一個很懂你的人，坐在旁邊。', 4],
        ['他不急著給建議。只是陪著，聽你說今天有多累。', 7],
        ['你可以用同樣的方式，陪自己一下。', 6],
        ['把一隻手，輕輕放在胸口，或是肚子上。', 4],
        ['感覺它跟著呼吸，一起一伏。', 9],
        ['這一刻，你不用變成別的樣子。', 8],
      ],
    },
    en: {
      name: 'Keeping yourself company',
      style: 'in the spirit of the person-centered approach',
      core: [
        ['Whatever you felt today can stay here for now.', 5],
        ['You do not have to talk yourself out of feeling this way.', 5],
        ['Imagine someone who really understands you, sitting nearby.', 4],
        ['They are in no hurry to give advice. They just stay, and listen to how tiring today was.', 7],
        ['You can keep yourself company in the same way.', 6],
        ['Rest one hand on your chest, or on your belly.', 4],
        ['Feel it rise and fall with your breath.', 9],
        ['Right now, you do not need to be anything other than this.', 8],
      ],
    },
  },
  {
    id: 'acceptance',
    lens: 'acceptance',
    zh: {
      name: '看著想法漂走',
      style: '正念與接納取向風格',
      core: [
        ['想像你坐在一條小溪旁邊，水慢慢地流。', 5],
        ['水面上，漂著幾片葉子。', 5],
        ['每當一個想法出現，就把它放在一片葉子上。', 6],
        ['不管是擔心、計畫，還是對自己的一句批評，都一樣。', 5],
        ['看著它順著水流，慢慢漂走。', 9],
        ['不用推它，也不用留住它。', 7],
        ['如果發現自己跟著某個想法走遠了，沒關係，這很常見。', 4],
        ['注意到了，就回到小溪旁邊。', 10],
        ['葉子會一直來，水也會一直流。', 9],
      ],
    },
    en: {
      name: 'Letting thoughts float by',
      style: 'in the spirit of mindfulness and acceptance',
      core: [
        ['Imagine sitting beside a small stream, the water moving slowly.', 5],
        ['A few leaves are floating on the surface.', 5],
        ['Each time a thought appears, place it on a leaf.', 6],
        ['A worry, a plan, something critical about yourself. Any thought at all.', 5],
        ['Watch it drift away with the water.', 9],
        ['No need to push it, and no need to hold on to it.', 7],
        ['If you notice you have followed a thought somewhere, that is fine. It happens.', 4],
        ['Just come back to the stream.', 10],
        ['The leaves keep coming, and the water keeps moving.', 9],
      ],
    },
  },
  {
    id: 'existential',
    lens: 'existential',
    zh: {
      name: '今天的一個小時刻',
      style: '存在主義取向風格',
      core: [
        ['今天，你做了一些選擇。', 3],
        ['有些是你想要的，有些只是當下能做的。', 5],
        ['兩種都算。', 5],
        ['今天有沒有一個小小的時刻，你覺得比較像自己？', 8],
        ['如果想不到，也沒關係。', 4],
        ['也許是一句話、一杯熱茶，或是一段安靜的路。', 7],
        ['那個時刻裡，有你在乎的東西。', 7],
        ['明天，可以再選一次。今晚，只需要休息。', 8],
      ],
    },
    en: {
      name: 'A small moment from today',
      style: 'in the spirit of the existential approach',
      core: [
        ['Today you made some choices.', 3],
        ['Some were what you wanted. Some were simply what you could manage.', 5],
        ['Both count.', 5],
        ['Was there a small moment today when you felt more like yourself?', 8],
        ['If nothing comes to mind, that is fine.', 4],
        ['Maybe something someone said, a warm drink, or a quiet walk.', 7],
        ['That moment says something about what you care about.', 7],
        ['Tomorrow you can choose again. Tonight, you only need to rest.', 8],
      ],
    },
  },
  {
    id: 'narrative',
    lens: 'narrative',
    zh: {
      name: '讓煩惱先放在門外',
      style: '敘事取向風格',
      many: { 0: '想像今晚心上的這幾件事，都裝在一個包包裡。你今天一路都帶著它。' },
      core: [
        ['想像那件讓你在意的事，是一個包包。你今天一路都帶著它。', 5],
        ['它有重量，裡面也裝著它想提醒你的事。', 5],
        ['現在很晚了。把它放在房門外的椅子上。', 6],
        ['它不會不見。明天出門的時候，再決定要不要拿起來。', 7],
        ['它是你今天的一部分，但不是全部的你。', 7],
        ['房間裡，還有別的東西。', 3],
        ['有你今天花的力氣，有你喜歡的小東西，還有現在這張床。', 8],
        ['今晚，讓這些陪著你。', 8],
      ],
    },
    en: {
      name: 'Setting the worry outside the door',
      style: 'in the spirit of the narrative approach',
      many: { 0: 'Imagine the things on your mind packed into one bag you have carried around all day.' },
      core: [
        ['Imagine the thing on your mind as a bag you have carried around all day.', 5],
        ['It has some weight, and it holds things it wants you to remember.', 5],
        ['It is late now. Set it on a chair outside your door.', 6],
        ['It will not disappear. Tomorrow, on your way out, you can decide whether to pick it up.', 7],
        ['It is part of your day, but not the whole of you.', 7],
        ['There are other things in the room.', 3],
        ['The effort you made today. Small things you like. And this bed.', 8],
        ['Let those keep you company tonight.', 8],
      ],
    },
  },
  {
    id: 'solution-focused',
    lens: 'solution-focused',
    zh: {
      name: '今天還可以的事',
      style: '焦點解決取向風格',
      core: [
        ['回想一下今天。有沒有一件小事，還算順利？', 7],
        ['想不到，也沒關係。', 4],
        ['也許是好好吃了一餐、回了一則訊息，或是撐過一段不容易的時間。', 7],
        ['不管那是什麼，那是你自己做到的。', 6],
        ['不用想得很完整。只要讓那個畫面，停留一下。', 9],
        ['這些你已經會做的事，明天也都在。', 7],
        ['今晚，讓身體休息，把力氣留給明天。', 8],
      ],
    },
    en: {
      name: 'What went okay today',
      style: 'in the spirit of the solution-focused approach',
      core: [
        ['Think back over today. Was there one thing, however small, that went okay?', 7],
        ['If nothing comes to mind, that is fine.', 4],
        ['Maybe eating a real meal, answering a message, or getting through a hard stretch of the day.', 7],
        ['Whatever it was, you were the one who did it.', 6],
        ['You do not need a full answer. Just let that picture stay for a moment.', 9],
        ['The things you already know how to do will still be there tomorrow.', 7],
        ['Tonight, let your body rest, and save your strength for tomorrow.', 8],
      ],
    },
  },
  {
    // "a murmur from Freud": free association turned into a bedtime practice, without interpreting
    id: 'drift',
    lens: 'psychoanalytic',
    zh: {
      name: '讓畫面自己浮現',
      style: '精神分析取向風格',
      note: '會讓畫面自己浮上來。今晚心情很重的話，選別段比較好。',
      core: [
        ['先說一件事。如果浮上來的畫面讓你不舒服，就睜開眼睛。', 4],
        ['看看房間裡的三樣東西，感覺身體貼著床的地方。', 5],
        ['那樣的話，今晚到這裡就好。', 6],
        ['今晚不用分析什麼。讓今天的畫面，自己慢慢浮上來。', 7],
        ['也許是路上看到的東西、吃的一餐，或是聽到的一句話。', 6],
        ['出現什麼都可以，不需要有道理。', 8],
        ['如果某個畫面帶著一點感覺，可以看它一下，再讓它過去。', 5],
        ['不用追問為什麼。', 8],
        ['心裡想要的，和心裡擔心的，常常同時都在。', 5],
        ['今晚，兩個都可以先放著。', 8],
        ['如果有比較舊的感覺，也跟著浮上來，知道它在就好。', 5],
        ['今晚不用去找它從哪裡來。', 8],
        ['入睡以後，心會用自己的方式，整理今天。你不用幫它。', 8],
        ['明天醒來，如果還記得一點夢，可以寫下來。忘記了，也沒關係。', 8],
      ],
    },
    en: {
      name: 'Letting images drift up',
      style: 'in the spirit of the psychoanalytic approach',
      note: 'Lets pictures surface on their own. On a heavy night, another track is a better pick.',
      core: [
        ['First, a way out. If a picture that comes up is upsetting, open your eyes.', 4],
        ['Look at three things in the room, and feel where your body meets the bed.', 5],
        ['If that happens, that is enough for tonight.', 6],
        ['Tonight there is nothing to analyze. Let pictures from today drift up on their own.', 7],
        ['Maybe something you saw on the way, a meal, or a sentence you heard.', 6],
        ['Whatever comes is fine. It does not have to make sense.', 8],
        ['If a picture carries a little feeling, you can look at it for a moment, then let it pass.', 5],
        ['No need to ask why.', 8],
        ['What part of you wants, and what part of you fears, often sit side by side.', 5],
        ['Tonight, both can wait.', 8],
        ['If an older feeling comes up too, just know it is there.', 5],
        ['Tonight you do not need to look for where it came from.', 8],
        ['Once you are asleep, your mind sorts the day in its own way. You do not have to help it.', 8],
        ['If you wake up remembering a bit of a dream, you could write it down. If you forget, that is fine too.', 8],
      ],
    },
  },
  {
    // Bowen's differentiation of self, as a bedtime practice: holding one's own share, not everyone's
    id: 'family-systems',
    lens: 'family-systems',
    zh: {
      name: '今晚先放下別人的擔子',
      style: '家族系統取向風格',
      core: [
        ['今天，你可能替別人擔心了不少。', 6],
        ['身邊的人有情緒的時候，那些情緒有時會像天氣一樣，飄到你身上。', 7],
        ['試著在心裡分成兩堆。一堆是你的，一堆是別人的。', 8],
        ['分不清楚，也沒關係。', 5],
        ['別人的那一堆，今晚先不用替他們拿著。', 6],
        ['這不代表你不在乎。你們的關係，還在。', 6],
        ['只是今晚，每個人先拿著自己的那一份。', 7],
        ['如果你正在照顧一個需要你的人，今晚放下的，只是擔心，不是他。', 9],
        ['你自己的那一堆，也不用今晚處理完。', 7],
        ['你可以關心他們，同時也照顧自己。兩件事可以一起在。', 8],
        ['現在，這裡有你，和你躺著的這張床。', 10],
      ],
    },
    en: {
      name: "Setting down other people's worries for tonight",
      style: 'in the spirit of the family systems approach',
      core: [
        ['Today you may have worried quite a lot on behalf of other people.', 6],
        ["Other people's feelings can drift onto you, like weather.", 7],
        ['Try sorting them into two piles. What is yours, and what is theirs.', 8],
        ['If you cannot tell, that is fine.', 5],
        ['Tonight you do not need to carry their pile for them.', 6],
        ['That is not the same as not caring. The relationship is still there.', 6],
        ['Just for tonight, each person holds their own share.', 7],
        ['If you are caring for someone who needs you, what you set down tonight is the worry, not the person.', 9],
        ['Your own pile does not need to be sorted out tonight either.', 7],
        ['You can care about them and look after yourself at the same time.', 8],
        ['Now there is you, and the bed you are lying in.', 10],
      ],
    },
  },
  {
    id: 'relaxation',
    lens: 'behavioral',
    zh: {
      name: '放鬆身體',
      style: '行為取向的漸進式放鬆',
      core: [
        ['如果身體有受傷或疼痛的地方，那裡就不用出力，讓它休息就好。', 4],
        ['我們從腳開始。輕輕把腳趾往下彎。', 3],
        ['然後放開。', 6],
        ['感覺一下，緊和鬆，有什麼不同。', 7],
        ['換小腿和大腿。稍微用一點力。', 3],
        ['然後放鬆。', 7],
        ['把肩膀往耳朵的方向抬高。', 3],
        ['然後，讓肩膀落下來。', 7],
        ['最後是臉。輕輕皺起眉頭，閉緊眼睛。', 3],
        ['然後鬆開。', 7],
        ['接下來，跟著呼吸，在心裡默念數字。', 4],
        ['吐氣的時候，心裡念，一。下一次吐氣，念，二。', 8],
        ['一直到五，再回到一。', 12],
        ['如果忘記念到哪裡，就回到一。這也是練習的一部分。', 12],
      ],
    },
    en: {
      name: 'Relaxing the body',
      style: 'progressive relaxation from the behavioral approach',
      core: [
        ['If any part of your body is injured or sore, skip the tensing there and just let it rest.', 4],
        ['Start with your feet. Gently curl your toes.', 3],
        ['And let go.', 6],
        ['Notice the difference between tense and relaxed.', 7],
        ['Now your calves and thighs. Tense them a little.', 3],
        ['And relax.', 7],
        ['Lift your shoulders toward your ears.', 3],
        ['And let them drop.', 7],
        ['Last, your face. Gently scrunch your brow and your eyes.', 3],
        ['Then soften.', 7],
        ['Now count your breaths, silently.', 4],
        ['As you breathe out, count one. On the next breath out, two.', 8],
        ['Keep going up to five, then start again at one.', 12],
        ['If you lose count, start again at one. That is part of the practice too.', 12],
      ],
    },
  },
  {
    id: 'adlerian',
    lens: 'adlerian',
    zh: {
      name: '一點鼓勵',
      style: '阿德勒學派風格',
      core: [
        ['今天你做的某些事，可能讓別人好過了一點點，即使你沒有看到。', 7],
        ['也許只是一句謝謝，或是好好聽一個人把話說完。', 6],
        ['如果今天沒有和誰說到話，能把自己好好帶到晚上，也算一件。', 7],
        ['今天你花的力氣，不管結果怎麼樣，都是真的。', 7],
        ['你不用很完美，也一樣有你的位置。', 7],
        ['明天，也許可以再為別人，或是為自己，做一件小事。', 7],
        ['現在，讓今天先結束。', 8],
      ],
    },
    en: {
      name: 'A little encouragement',
      style: 'in the spirit of the Adlerian approach',
      core: [
        ["Something you did today may have made someone's day a little easier, even if you did not see it.", 7],
        ['Maybe just a thank you, or listening to someone all the way through.', 6],
        ['If you did not talk with anyone today, getting yourself through to tonight counts too.', 7],
        ['The effort you put in today was real, whatever came of it.', 7],
        ['You do not have to be perfect to belong.', 7],
        ['Tomorrow, maybe one more small thing for someone else, or for yourself.', 7],
        ['For now, let today end.', 8],
      ],
    },
  },
];

export function trackById(id) {
  return TRACKS.find((t) => t.id === id);
}

// The full script for a track. `themes` is tonight's kinds of worry in the order chosen (an old
// single theme string works too). A track may give `many`: core lines, by index, to use instead
// when more than one kind was named.
export function buildScript(trackId, themes, lang) {
  const l = lang === 'en' ? 'en' : 'zh-TW';
  const t = trackById(trackId)[l === 'en' ? 'en' : 'zh'];
  const n = namedThemes(themes).length;
  const setDown = n ? [[themeLine(themes, l), 3], ...(n > 1 ? SET_DOWN_MANY : SET_DOWN)[l]] : SET_DOWN_GENERIC[l];
  const core = n > 1 && t.many ? t.core.map(([s, p], i) => [t.many[i] || s, p]) : t.core;
  return [...OPEN[l], ...setDown, ...core, ...CLOSE[l]];
}

export function scriptSeconds(script, charsPerSecond) {
  return script.reduce((sum, [s, p]) => sum + s.length / charsPerSecond + p, 0);
}

// ---------- player ----------
// Speaks one sentence at a time with pauses between, using the device's own voices.
// When no voice is available, the same script plays as on-screen read-along text.
export function pickVoice(lang, preferredName) {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices().filter((v) => v.localService !== false); // on-device only
  const want = lang === 'en' ? /^en/i : /^(zh[-_](TW|Hant)|cmn[-_]Hant)/i;
  // Mandarin only as a fallback: Cantonese voices (zh-HK, yue) would read the script in another language
  const fallback = lang === 'en' ? /^en/i : /^(zh|cmn)(?![-_](HK|MO))/i;
  if (preferredName) {
    // a saved choice counts only if it speaks this language (the setting may be from the other one)
    const v = voices.find((x) => x.name === preferredName && fallback.test(x.lang));
    if (v) return v;
  }
  const ok = (v) => !/yue|HK|MO/i.test(v.lang);
  return (
    voices.find((v) => want.test(v.lang) && ok(v) && /premium|enhanced/i.test(v.name)) ||
    voices.find((v) => want.test(v.lang) && ok(v)) ||
    voices.find((v) => fallback.test(v.lang) && ok(v)) ||
    null
  );
}

export function voicesFor(lang) {
  if (typeof speechSynthesis === 'undefined') return [];
  const re = lang === 'en' ? /^en/i : /^(zh|cmn)/i;
  // only voices that run on the device: online voices (Chrome's "Google" voices, Edge's
  // "Natural" voices) would send the script, which mentions tonight's worry, to a server
  return speechSynthesis.getVoices().filter((v) => re.test(v.lang) && !/yue|HK|MO/i.test(v.lang) && v.localService !== false);
}

// iOS Safari only allows speech that starts inside a user gesture. Call this synchronously
// from the tap handler, before any await, so later utterances are allowed.
export function unlockSpeech() {
  try {
    if (typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch (_) {
    /* ignore */
  }
}

// Voices load asynchronously in Chrome and Android: getVoices() is empty at first.
export function voicesReady(timeoutMs = 1500) {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      speechSynthesis.removeEventListener('voiceschanged', done);
      resolve(speechSynthesis.getVoices());
    };
    speechSynthesis.addEventListener('voiceschanged', done);
    setTimeout(done, timeoutMs);
  });
}

// Automated tests set globalThis.__MURMUR_SPEED to run tracks quickly.
const speed = () => (typeof globalThis !== 'undefined' && globalThis.__MURMUR_SPEED) || 1;

export class BedtimePlayer {
  constructor({ script, lang, voice, speak = true, onLine, onEnd }) {
    this.script = script;
    this.lang = lang;
    this.voice = voice;
    this.speak = speak && !!voice && typeof speechSynthesis !== 'undefined' && speed() === 1;
    this.onLine = onLine;
    this.onEnd = onEnd;
    this.i = 0;
    this.timer = null;
    this.stopped = false;
    this.paused = false;
    this.wakeLock = null;
    this.gen = 0; // bumped on every pause/stop so stale callbacks are ignored
  }

  async lock() {
    try {
      if ('wakeLock' in navigator && !this.wakeLock) {
        const lock = await navigator.wakeLock.request('screen');
        if (this.stopped) lock.release().catch(() => {});
        else {
          this.wakeLock = lock;
          lock.addEventListener('release', () => {
            if (this.wakeLock === lock) this.wakeLock = null;
          });
        }
      }
    } catch (_) {
      /* not available */
    }
  }

  async start() {
    // the browser drops the wake lock when the page is hidden; take it again on return
    // When the phone locks, speech stops but timers would keep going and the person would come
    // back to a finished track. Pause on hide; resume (and take the wake lock again) on return.
    this.onVisible = () => {
      if (this.stopped) return;
      if (document.visibilityState === 'hidden') {
        if (!this.paused) {
          this.autoPaused = true;
          this.pause();
        }
      } else {
        this.lock();
        if (this.autoPaused) {
          this.autoPaused = false;
          this.resume();
        }
      }
    };
    document.addEventListener('visibilitychange', this.onVisible);
    await this.lock();
    if (!this.stopped) this.next();
  }

  next() {
    if (this.stopped || this.paused) return;
    if (this.i >= this.script.length) return this.finish();
    const [text, pause] = this.script[this.i];
    this.onLine && this.onLine(this.i, text);
    const gen = this.gen;
    let fired = false;
    const after = () => {
      if (fired || this.stopped || this.paused || gen !== this.gen) return;
      fired = true;
      clearTimeout(this.watchdog);
      this.i++;
      this.timer = setTimeout(() => this.next(), (pause * 1000) / speed());
    };
    if (this.speak) {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = this.voice;
      u.lang = this.voice.lang;
      u.rate = 0.82;
      u.pitch = 0.95;
      u.onend = after;
      u.onerror = (ev) => {
        if (ev && (ev.error === 'interrupted' || ev.error === 'canceled')) return after();
        if (fired || this.stopped || this.paused || gen !== this.gen) return;
        // the voice failed: carry on as read-along instead of racing through the lines
        fired = true;
        clearTimeout(this.watchdog);
        this.speak = false;
        this.next();
      };
      this.utterance = u; // keep a reference: some browsers drop onend for collected utterances
      speechSynthesis.speak(u);
      // some Android browsers never fire onend; move on after a generous estimate
      clearTimeout(this.watchdog);
      this.watchdog = setTimeout(after, (4 + text.length / (this.lang === 'en' ? 8 : 2.5)) * 1000);
    } else {
      // read-along: give time to read the line, then pause
      const readSeconds = Math.max(2.5, text.length / (this.lang === 'en' ? 14 : 4.5));
      this.timer = setTimeout(after, (readSeconds * 1000) / speed());
    }
  }

  pause() {
    this.paused = true;
    this.gen++;
    clearTimeout(this.timer);
    clearTimeout(this.watchdog);
    if (this.speak) speechSynthesis.cancel();
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.next();
  }

  stop() {
    this.stopped = true;
    this.gen++;
    clearTimeout(this.timer);
    clearTimeout(this.watchdog);
    if (this.speak) speechSynthesis.cancel();
    this.release();
  }

  finish() {
    this.release();
    this.onEnd && this.onEnd();
  }

  release() {
    if (this.onVisible) {
      document.removeEventListener('visibilitychange', this.onVisible);
      this.onVisible = null;
    }
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }
}
