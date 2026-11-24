// Daily writing prompts. Everyone gets the same prompt on the same calendar date, so two
// people can answer it separately and share their answers with each other.
// Prompts are light and reflective on purpose; none asks people to dig into pain at night.

export const DAILY = {
  'zh-TW': [
    '今天有什麼小事讓你注意到了？',
    '今天的天氣，像你心裡的哪一種感覺？',
    '最近一次笑出來，是因為什麼？',
    '今天有沒有一個讓你停下來的瞬間？',
    '說說今天吃到的一樣東西。',
    '今天和誰說過話？聊了什麼？',
    '最近有什麼在期待的事？',
    '今天的身體，想對你說什麼？',
    '如果今天是一首歌，會是什麼節奏？',
    '描述一個你今天看到的顏色。',
    '最近學到的一件小事是什麼？',
    '有沒有一句最近聽到、還記得的話？',
    '今天有什麼比你預期的容易一點？',
    '你最近在等待什麼？',
    '說說一個你喜歡待著的地方。',
    '最近有沒有一件事，你做了之後鬆了一口氣？',
    '今天有沒有誰讓你想到，就覺得溫暖？',
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
    '有沒有一個人，你想謝謝他但還沒說？',
    '最近有什麼新的發現，關於你自己？',
    '如果今天可以重來一小段，你會選哪一段？',
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
    'What made you laugh most recently?',
    'Was there a moment today that made you pause?',
    'Describe one thing you ate today.',
    'Who did you talk with today, and about what?',
    'What are you looking forward to?',
    'What would your body say about today?',
    'If today were a song, what would its rhythm be?',
    'Describe one color you saw today.',
    'What is one small thing you learned recently?',
    'Is there a sentence you heard recently that stayed with you?',
    'What was a little easier today than you expected?',
    'What are you waiting for these days?',
    'Describe a place you like to spend time.',
    'What did you do recently that brought relief afterwards?',
    'Who did you think of today with warmth?',
    'If you could do only one thing tomorrow, what would it be?',
    'What have you owned for a long time and still do not want to replace?',
    'Describe a route you have walked a lot lately.',
    'What did you wear today that felt comfortable?',
    'What sound stayed with you today?',
    'What recently made you think, "this is not bad"?',
    'What are you curious about lately?',
    'Describe today in three words.',
    'Is there something you decided to leave alone today?',
    'What small habit makes your days a little easier?',
    'Describe a smell you like.',
    'Today, do you need rest more, or movement?',
    'Is there someone you want to thank but have not yet?',
    'What have you noticed about yourself recently?',
    'If you could redo one small part of today, which part?',
    'How have you been looking after yourself lately?',
    'Describe what is outside your window right now.',
    'Is there a song stuck in your head lately?',
    'What did you do a little more gently than usual today?',
    'What would a weekend morning you love look like?',
    'What small, interesting thing did you notice recently?',
    'Is there something today you want to say "that was hard work" to yourself about?',
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
