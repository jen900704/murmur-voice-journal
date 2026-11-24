// Daily writing prompts. Everyone gets the same prompt on the same calendar date, so two
// people can answer it separately and share their answers with each other.
// Prompts are light and reflective on purpose; none asks people to dig into pain at night.
// Share links carry only a prompt's index, so the two lists stay parallel; from here on, add
// new prompts at the end rather than replacing one in place.

export const DAILY = {
  'zh-TW': [
    '今天你注意到了什麼小事？',
    '今天的天氣怎麼樣？你喜歡嗎？',
    '最近有沒有什麼讓你嘴角動了一下？很小的也算。',
    '今天有沒有哪一刻，你停下來多看了一眼？',
    '說說今天吃到或喝到的一樣東西。',
    '今天聽到或看到的一句話是什麼？路上、店裡、網路上都算。',
    '接下來幾天，有沒有一件你不排斥的小事？沒有的話，照實說就好。',
    '現在身體哪裡最想休息一下？',
    '如果今天是一首歌，是快歌還是慢歌？',
    '說說今天看到的一個顏色。',
    '最近學到的一件小事是什麼？',
    '最近有沒有一句話，你到現在還記得？',
    '今天有沒有哪件事，比你想的容易一點？',
    '最近有什麼是等了一下才等到的？公車、外送、雨停都算。',
    '說說一個你喜歡待著的地方。',
    '最近有沒有一件事，你做了之後鬆了一口氣？',
    '今天有沒有哪個人、動物或東西，讓你覺得暖暖的？',
    '如果明天只做一件事，你想做什麼？',
    '有什麼東西，你用了很久還捨不得換？',
    '說說一條你最近常經過的路。',
    '今天身上穿的，哪一件最舒服？',
    '今天有什麼聲音，你到現在還記得？',
    '最近有沒有哪件事，讓你覺得「這樣也不錯」？',
    '你最近對什麼感到好奇？',
    '用三個詞形容今天。',
    '今天有沒有一件事，你決定先放著不管？',
    '最近有什麼小習慣，讓日子好過一點？',
    '說說一個你喜歡的氣味。',
    '現在的你，比較想休息，還是想動一動？',
    '最近有沒有一件小事，讓你心裡想說聲謝謝？對人、對店家、對天氣都可以。',
    '最近有沒有發現自己一件以前沒注意到的事？',
    '今天有沒有哪一小段，你想再多待一下？',
    '最近有沒有做一件對自己好一點的小事？沒有也沒關係。',
    '說說現在窗外的樣子。',
    '最近有沒有一首歌，一直在腦中轉？',
    '今天有沒有哪件事，你做得比平常慢一點、輕一點？',
    '一個你喜歡的放假早晨，會是什麼樣子？',
    '最近有沒有一個讓你覺得有趣的小發現？',
    '今天有沒有一件事，讓你想對自己說聲「辛苦了」？',
    '如果把今天寫成一張明信片，你會寫哪一句？',
  ],
  en: [
    'What small thing caught your attention today?',
    'What was the weather like today? Did you like it?',
    'Did anything almost make you smile lately? Small things count.',
    'Was there a moment today when you stopped to look at something?',
    'Talk about one thing you ate or drank today.',
    'What\'s one line you heard or read today? The street, a store, online, it all counts.',
    'Is there one small thing in the next few days you don\'t mind? If not, just say so.',
    'Which part of your body most wants a rest right now?',
    'If today were a song, would it be fast or slow?',
    'Talk about one color you saw today.',
    'What\'s one small thing you learned recently?',
    'Is there a line you heard recently that stuck with you?',
    'Was anything a little easier today than you expected?',
    'What\'s something you waited a bit for lately? A bus, a delivery, the rain to stop.',
    'Talk about a place you like to be.',
    'Is there something you did lately that was a relief to finish?',
    'Did any person, animal, or thing give you a warm feeling today?',
    'If you only did one thing tomorrow, what would you want it to be?',
    'What\'s something you\'ve had for a long time and still don\'t want to replace?',
    'Talk about a route you\'ve taken a lot lately.',
    'What\'s the most comfortable thing you wore today?',
    'What sound from today do you still remember?',
    'Did anything lately make you think, "this is actually okay"?',
    'What have you been curious about lately?',
    'Describe today in three words.',
    'Did you decide to leave anything alone for now today?',
    'What small habit has made your days a little easier lately?',
    'Describe a smell you like.',
    'Right now, would you rather rest or move a little?',
    'Is there a small thing lately you\'d like to say thanks for? A person, a store, the weather, anything.',
    'Have you noticed anything new about yourself lately?',
    'Was there a small part of today you\'d have stayed in a little longer?',
    'Did you do one small thing lately that was kind to yourself? It\'s fine if not.',
    'Describe what\'s outside your window right now.',
    'Has a song been stuck in your head lately?',
    'Did you do anything a little more slowly or gently than usual today?',
    'What would a morning off that you\'d enjoy look like?',
    'Did you come across anything small and interesting lately?',
    'Is there something today that makes you want to tell yourself, "that was a lot"?',
    'If today were a postcard, what one line would you write on it?',
  ],
};

// Day number of a local calendar date, so the prompt changes at local midnight.
export function dayNumber(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

export function promptOfDay(lang, date = new Date()) {
  const list = DAILY[lang] || DAILY.en;
  // a fixed shuffle so neighbouring days are not neighbouring prompts
  const i = (dayNumber(date) * 17 + 5) % list.length;
  return { index: i, text: list[i] };
}
