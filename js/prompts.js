// Daily writing prompts. Everyone gets the same prompt on the same calendar date, so two
// people can answer it separately and share their answers with each other.
// Prompts are light and reflective on purpose; none asks people to dig into pain at night.

export const DAILY = {
  'zh-TW': [
    '今天你注意到了什麼小事？',
    '今天的天氣，像你心裡的哪一種感覺？',
    '最近有什麼讓你嘴角動了一下？很小的也算。',
    '今天有沒有一個讓你停下來的瞬間？',
    '說說今天吃到的一樣東西。',
    '今天聽到或讀到哪一句話？路上、店裡、網路上的都算。',
    '接下來幾天，有沒有一件小小的、還不討厭的事？沒有也可以照實說。',
    '今天的身體，想對你說什麼？',
    '如果今天是一首歌，會是什麼節奏？',
    '描述一個你今天看到的顏色。',
    '最近學到的一件小事是什麼？',
    '有沒有一句最近聽到、還記得的話？',
    '今天有什麼比你預期的容易一點？',
    '最近有什麼是等了一下才等到的？公車、外送、雨停都算。',
    '說說一個你喜歡待著的地方。',
    '最近有沒有一件事，你做了之後鬆了一口氣？',
    '今天有沒有什麼人、動物或東西，讓你想到就覺得暖暖的？',
    '如果明天只做一件事，你想做什麼？',
    '最近有什麼東西，你用了很久還捨不得換？',
    '說說一個你最近常走的路。',
    '今天穿了什麼讓你覺得舒服？',
    '今天有什麼聲音，讓你印象深刻？',
    '最近哪一件事，讓你覺得「這樣也不錯」？',
    '你最近對什麼感到好奇？',
    '用三個詞形容今天。',
    '今天有沒有一件事，你決定先放著不管？',
    '最近有什麼小習慣，讓日子好過一點？',
    '說說一個你喜歡的氣味。',
    '今天的你，比較需要休息還是需要動一動？',
    '最近有沒有一件小事，讓你心裡想說聲謝謝？對人、對店家、對天氣都可以。',
    '最近有什麼新的發現，關於你自己？',
    '今天哪一小段，你想再多待一下？',
    '你最近怎麼照顧自己？',
    '描述窗外此刻的樣子。',
    '最近有沒有一首歌一直在腦中？',
    '今天有什麼事，你做得比平常更溫柔？',
    '一個你很喜歡的週末早晨，會是什麼樣子？',
    '最近有沒有一個讓你覺得有趣的小發現？',
    '有沒有一件事，你今天想對自己說「辛苦了」？',
    '如果把今天寄成一張明信片，你會寫什麼？',
  ],
  en: [
    'What small thing caught your attention today?',
    'If today\'s weather were a feeling, which one would it be?',
    'What made you almost smile lately? Small things count.',
    'Was there a moment today that made you pause?',
    'Describe one thing you ate today.',
    'What is one sentence you heard or read today? On the street, in a store, or online all count.',
    'Is there one small thing in the next few days that you are not dreading? If not, it is okay to say so.',
    'What would your body say about today?',
    'If today were a song, what would its rhythm be?',
    'Describe one color you saw today.',
    'What is one small thing you learned recently?',
    'Is there a sentence you heard recently that stayed with you?',
    'What was a little easier today than you expected?',
    'What did you have to wait a bit for recently? A bus, a delivery, the rain letting up.',
    'Describe a place you like to spend time.',
    'What did you do recently that was a relief to have done?',
    'Did any person, animal or thing give you a warm feeling today?',
    'If you could do only one thing tomorrow, what would it be?',
    'What have you owned for a long time and still do not want to replace?',
    'Describe a route you have walked a lot lately.',
    'What did you wear today that felt comfortable?',
    'What sound stayed with you today?',
    'What recently made you think, "this is actually okay"?',
    'What are you curious about lately?',
    'Describe today in three words.',
    'Is there something you decided to leave alone today?',
    'What small habit makes your days a little easier?',
    'Describe a smell you like.',
    'Today, do you need rest more, or movement?',
    'Is there a small thing lately you felt like saying thank you for? To a person, a store, or the weather.',
    'What have you noticed about yourself recently?',
    'Which small part of today would you like to stay in a little longer?',
    'How have you been taking care of yourself lately?',
    'Describe what is outside your window right now.',
    'Is there a song stuck in your head lately?',
    'What did you do a little more gently than usual today?',
    'What would a weekend morning you love look like?',
    'What small, interesting thing did you notice recently?',
    'Is there something from today you want to give yourself credit for getting through?',
    'If today were a postcard, what would you write on it?',
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
