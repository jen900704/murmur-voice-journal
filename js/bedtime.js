// Bedtime tracks: short wind-down scripts in the spirit of counseling theories that suit
// the end of the day. Written for Murmur; not therapy, and not the words of any real person.
// Disputing and analysis are left out of bedtime on purpose: they are better done in
// daylight, in the lens exercise. The one psychoanalytic track ('drift') interprets nothing,
// puts its way out before its invitation, and is never picked at random.
//
// A script is a list of [sentence, pause in seconds after it].
// {theme} is replaced with a short phrase for what the person set down tonight.

export const THEMES = ['work', 'relationship', 'family', 'health', 'future', 'unsure'];

const THEME_TEXT = {
  'zh-TW': { work: '工作或學業的事', relationship: '關係裡的事', family: '家裡的事', health: '身體的事', future: '對以後的擔心', unsure: '那件說不太清楚的事', none: '今天的事' },
  en: { work: 'the thing about work or school', relationship: 'the thing about a relationship', family: 'the thing about family', health: 'the thing about your body', future: 'the worry about what comes next', unsure: 'the thing that is hard to name', none: 'today' },
};

const OPEN = {
  'zh-TW': [
    ['現在，讓自己找一個舒服的姿勢。', 3],
    ['如果你願意，可以閉上眼睛，或讓目光輕輕落在前面。', 3],
    ['吸一口氣，慢慢吐出來。', 6],
    ['再一次。吸氣，然後吐氣。', 7],
    ['如果過程中你覺得更緊繃，隨時可以停下來，睜開眼睛。', 3],
  ],
  en: [
    ['Find a position that feels comfortable.', 3],
    ['If you like, close your eyes, or let your gaze rest softly ahead of you.', 3],
    ['Breathe in, and slowly breathe out.', 6],
    ['Once more. In, and out.', 7],
    ['If you feel more tense at any point, you can stop and open your eyes.', 3],
  ],
};

// Used when nothing was set down tonight.
const SET_DOWN_GENERIC = {
  'zh-TW': [['如果今天有什麼放不下的事，可以想像把它放在床邊的桌上。明天早上它還會在那裡。', 6]],
  en: [['If anything from today is still with you, imagine placing it on the table beside your bed. It will still be there in the morning.', 6]],
};

const SET_DOWN = {
  'zh-TW': [
    ['今天你寫下了{theme}。', 2],
    ['它是真的，也值得被好好處理。只是不是現在。', 3],
    ['想像把它放在床邊的桌上。明天早上它還會在那裡，你可以到時候再決定怎麼做。', 6],
  ],
  en: [
    ['Tonight you set down {theme}.', 2],
    ['It is real, and it deserves attention. Just not right now.', 3],
    ['Imagine placing it on the table beside your bed. It will still be there in the morning, and you can decide what to do with it then.', 6],
  ],
};

const CLOSE = {
  'zh-TW': [
    ['今晚就到這裡。', 3],
    ['不用做得很好，也不用想清楚什麼。', 3],
    ['讓呼吸自己來，讓身體慢慢變重。', 8],
    ['晚安。', 2],
  ],
  en: [
    ['That is enough for tonight.', 3],
    ['You do not need to do this well, or figure anything out.', 3],
    ['Let your breath come by itself, and let your body grow heavy.', 8],
    ['Good night.', 2],
  ],
};

export const TRACKS = [
  {
    id: 'person-centered',
    lens: 'person-centered',
    zh: {
      name: '溫和地陪自己',
      style: '個人中心取向風格',
      core: [
        ['不管你今天感覺到什麼，都可以先讓它在這裡。', 4],
        ['不需要說服自己不該有這種感覺。', 4],
        ['如果有一個很懂你的人坐在旁邊，他不會急著給建議，只是陪著，聽你說今天有多累。', 6],
        ['你可以用同樣的方式，陪自己一下。', 5],
        ['把一隻手輕輕放在胸口或肚子上，感覺它跟著呼吸起伏。', 8],
        ['這一刻，你不需要變成任何別的樣子。', 8],
      ],
    },
    en: {
      name: 'Keeping yourself company',
      style: 'in the spirit of person-centered therapy',
      core: [
        ['Whatever you felt today can stay here for now.', 4],
        ['There is no need to convince yourself you should feel differently.', 4],
        ['If someone who really understood you were sitting nearby, they would not rush to give advice. They would just stay, and listen to how tiring today was.', 6],
        ['You can keep yourself company in the same way.', 5],
        ['Rest one hand on your chest or your belly, and feel it rise and fall with your breath.', 8],
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
        ['水面上漂著幾片葉子。', 4],
        ['每當一個想法出現，不管是擔心、計畫，還是一句對自己的批評，就把它放在一片葉子上。', 6],
        ['看著它順著水流，慢慢漂走。', 8],
        ['不用推它，也不用留住它。', 6],
        ['如果發現自己跟著某個想法走遠了，沒關係，這很正常。注意到了，就回到小溪旁邊。', 10],
        ['葉子會一直來，水也會一直流。', 8],
      ],
    },
    en: {
      name: 'Letting thoughts float by',
      style: 'in the spirit of mindfulness and acceptance',
      core: [
        ['Imagine sitting beside a small stream, the water moving slowly.', 5],
        ['A few leaves are floating on the surface.', 4],
        ['Each time a thought appears, a worry, a plan, or something critical about yourself, place it on a leaf.', 6],
        ['Watch it drift away with the water.', 8],
        ['No need to push it, and no need to hold on to it.', 6],
        ['If you notice you have followed a thought somewhere, that is fine. It happens. Just come back to the stream.', 10],
        ['The leaves keep coming, and the water keeps moving.', 8],
      ],
    },
  },
  {
    id: 'existential',
    lens: 'existential',
    zh: {
      name: '今天的一個小時刻',
      style: '存在取向風格',
      core: [
        ['今天你做了一些選擇。有些是你想要的，有些只是當下能做的。', 5],
        ['兩種都算數。', 4],
        ['今天有沒有一個小小的時刻，你覺得比較像自己？如果想不到，也沒關係。', 8],
        ['也許是一句話、一杯熱的東西，或一段安靜的路。', 6],
        ['那個時刻透露了你在乎什麼。', 6],
        ['明天你還可以再選一次。今晚，你只需要休息。', 8],
      ],
    },
    en: {
      name: 'A small moment from today',
      style: 'in the spirit of existential therapy',
      core: [
        ['Today you made some choices. Some were what you wanted; some were simply what you could manage.', 5],
        ['Both count.', 4],
        ['Was there a small moment today when you felt more like yourself? If nothing comes to mind, that is fine.', 8],
        ['Maybe a sentence, a warm drink, or a quiet stretch of walking.', 6],
        ['That moment says something about what you care about.', 6],
        ['Tomorrow you can choose again. Tonight, you only need to rest.', 8],
      ],
    },
  },
  {
    id: 'narrative',
    lens: 'narrative',
    zh: {
      name: '讓煩惱在門外等',
      style: '敘事治療風格',
      core: [
        ['想像那件讓你在意的事，是今天來拜訪的一位客人。', 5],
        ['它有自己的聲音，也有它想說的話。', 4],
        ['現在很晚了，你可以客氣地請它到門外的椅子上坐著。', 5],
        ['門不用鎖。它明天還可以再來，你們到時候再談。', 6],
        ['它是你今天的一部分，但不是你的全部。', 6],
        ['屋子裡還有別的東西：你今天的努力、你在乎的人，還有現在這張床。', 8],
        ['讓這些陪你睡。', 8],
      ],
    },
    en: {
      name: 'The worry waits outside',
      style: 'in the spirit of narrative therapy',
      core: [
        ['Imagine the thing on your mind as a visitor who came by today.', 5],
        ['It has its own voice, and things it wants to say.', 4],
        ['It is late now. You can politely ask it to sit on a chair outside the door.', 5],
        ['No need to lock the door. It can come back tomorrow, and you can talk then.', 6],
        ['It is part of your day, but not the whole of you.', 6],
        ['There are other things in the room: the effort you made today, the people you care about, and this bed.', 8],
        ['Let those keep you company as you sleep.', 8],
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
        ['回想今天，有沒有一件事雖然很小，但還算順利？想不到也沒關係。', 6],
        ['也許是好好吃了一餐、回了一則訊息，或撐過了一段難熬的時間。', 6],
        ['不管那是什麼，它是你做到的。', 6],
        ['不用回答得很完整，只要讓那個畫面停留一下。', 8],
        ['這些你已經會做的事，明天也還在。', 6],
        ['今晚，讓身體休息，把力氣留給明天。', 8],
      ],
    },
    en: {
      name: 'What went okay today',
      style: 'in the spirit of solution-focused therapy',
      core: [
        ['Think back over today. Was there one thing, however small, that went reasonably well? If nothing comes to mind, that is fine.', 6],
        ['Maybe eating a proper meal, answering a message, or getting through a hard stretch of time.', 6],
        ['Whatever it was, you were the one who did it.', 6],
        ['You do not need a full answer. Just let that picture stay for a moment.', 8],
        ['The things you already know how to do will still be there tomorrow.', 6],
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
        ['先說好：如果浮上來的畫面讓你不舒服，就睜開眼睛，看看房間裡的三樣東西，感覺身體貼著床的地方。今晚到這裡就好。', 8],
        ['今晚不用分析什麼。讓今天的畫面，自己慢慢浮上來。', 6],
        ['也許是一張臉、一句話、一個房間。出現什麼都可以，不需要有道理。', 8],
        ['如果某個畫面帶著一點感覺，可以看它一下，再讓它過去。不用追問為什麼。', 8],
        ['心裡想要的，和心裡擔心的，常常同時存在。今晚兩個都可以先放著。', 8],
        ['有些感覺，可能不是今天才有的。今晚不用弄清楚。', 8],
        ['睡著以後，心會用它自己的方式整理今天。你不用幫它。', 8],
        ['如果明天醒來還記得一點夢，可以寫下來看看。忘了也沒關係。', 10],
      ],
    },
    en: {
      name: 'Letting images drift up',
      style: 'in the spirit of psychoanalytic therapy',
      note: 'Lets pictures surface on their own. On a heavy night, another track is a better pick.',
      core: [
        ['First, a way out: if a picture that comes up feels bad, open your eyes, look at three things in the room, and feel where your body meets the bed. That is enough for tonight.', 8],
        ['Tonight there is nothing to analyze. Let pictures from today drift up on their own.', 6],
        ['Maybe a face, a sentence, a room. Whatever comes is fine; it does not have to make sense.', 8],
        ['If a picture carries a little feeling, you can look at it for a moment, then let it pass. No need to ask why.', 8],
        ['What part of you wants and what part of you fears often sit side by side. Tonight both can wait.', 8],
        ['Some feelings may not have started today. Tonight you do not need to work them out.', 8],
        ['Once you are asleep, your mind will sort the day in its own way. You do not have to help it.', 8],
        ['If you wake remembering a bit of a dream, you could write it down. If you forget, that is fine too.', 10],
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
        ['身邊的人的情緒，有時會像天氣一樣，飄到你身上。', 7],
        ['試著在心裡分成兩堆：哪些是你的，哪些是別人的。分不清楚也沒關係。', 9],
        ['別人的那一堆，今晚先不用替他們拿著。這不是不在乎，你們的關係還在；只是今晚，每個人先拿著自己的那一份。', 9],
        ['你的那一堆，也不用今晚處理完。', 7],
        ['你可以關心他們，同時也照顧你自己。兩件事可以一起存在。', 8],
        ['現在，這裡有你，和你躺著的這張床。', 10],
      ],
    },
    en: {
      name: "Setting down others' loads for tonight",
      style: 'in the spirit of family systems therapy',
      core: [
        ['Today you may have worried quite a lot on behalf of other people.', 6],
        ["Other people's feelings can drift onto you, like weather.", 7],
        ["Try sorting them into two piles: what is yours, and what is theirs. If you can't tell, that is fine.", 9],
        ["Tonight you do not need to carry their pile for them. That is not the same as not caring, and the relationship is still there; just for tonight, each person holds their own share.", 9],
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
      style: '行為治療的漸進式放鬆',
      core: [
        ['如果身體有受傷或疼痛的地方，那裡只要放鬆就好，不用用力。', 3],
        ['我們從腳開始。輕輕把腳趾往下彎，停一下，然後放開。', 6],
        ['感覺一下，緊和鬆有什麼不同。', 4],
        ['換小腿和大腿。稍微用力，停一下，然後放鬆。', 7],
        ['肩膀往耳朵的方向聳起來，停一下，讓它們落下。', 7],
        ['最後是臉。輕輕皺起眉頭和眼睛，然後鬆開。', 7],
        ['接下來數呼吸。吐氣時數一，下一次吐氣數二，數到五，再從一開始。', 12],
        ['如果數亂了，就從一重新開始。這也是練習的一部分。', 12],
      ],
    },
    en: {
      name: 'Relaxing the body',
      style: 'progressive relaxation from behavior therapy',
      core: [
        ['If any part of your body is injured or sore, just let that part relax without tensing it.', 3],
        ['Start with your feet. Gently curl your toes, hold for a moment, and let go.', 6],
        ['Notice the difference between tense and relaxed.', 4],
        ['Now your calves and thighs. Tense them a little, hold, and relax.', 7],
        ['Lift your shoulders toward your ears, hold for a moment, and let them drop.', 7],
        ['Last, your face. Gently scrunch your brow and eyes, then soften.', 7],
        ['Now count your breaths. Count one as you breathe out, two on the next breath out, up to five, then start again at one.', 12],
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
        ['今天你做的某些事，可能讓別人好過了一點點，即使你沒有看到。', 6],
        ['也許只是一句謝謝，或好好聽一個人說完話。', 6],
        ['今天你花的力氣，不管結果怎樣，都是真的。', 6],
        ['你不需要很完美，也一樣屬於這裡。', 6],
        ['明天，也許可以再為別人或自己做一件小事。', 6],
        ['現在，讓今天先結束。', 8],
      ],
    },
    en: {
      name: 'A little encouragement',
      style: 'in the spirit of Adlerian therapy',
      core: [
        ['Something you did today may have made someone\'s day a little easier, even if you did not see it.', 6],
        ['Maybe just a thank-you, or listening to someone all the way through.', 6],
        ['The effort you put in today was real, whatever came of it.', 6],
        ['You do not have to be perfect to belong here.', 6],
        ['Tomorrow, maybe one more small thing for someone else, or for yourself.', 6],
        ['For now, let today end.', 8],
      ],
    },
  },
];

export function trackById(id) {
  return TRACKS.find((t) => t.id === id);
}

// The full script for a track, theme filled in.
export function buildScript(trackId, theme, lang) {
  const l = lang === 'en' ? 'en' : 'zh-TW';
  const t = trackById(trackId)[l === 'en' ? 'en' : 'zh'];
  const setDown = theme && THEME_TEXT[l][theme] ? SET_DOWN[l] : SET_DOWN_GENERIC[l];
  const themeText = THEME_TEXT[l][theme] || '';
  return [...OPEN[l], ...setDown, ...t.core, ...CLOSE[l]].map(([s, p]) => [s.replace('{theme}', themeText), p]);
}

export function scriptSeconds(script, charsPerSecond) {
  return script.reduce((sum, [s, p]) => sum + s.length / charsPerSecond + p, 0);
}

// ---------- player ----------
// Speaks one sentence at a time with pauses between, using the device's own voices.
// When no voice is available, the same script plays as on-screen read-along text.
export function pickVoice(lang, preferredName) {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  if (preferredName) {
    const v = voices.find((x) => x.name === preferredName);
    if (v) return v;
  }
  const want = lang === 'en' ? /^en/i : /^(zh[-_](TW|Hant)|cmn[-_]Hant)/i;
  // Mandarin only as a fallback: Cantonese voices (zh-HK, yue) would read the script in another language
  const fallback = lang === 'en' ? /^en/i : /^(zh|cmn)(?![-_](HK|MO))/i;
  const ok = (v) => !/yue|HK|MO/i.test(v.lang);
  return (
    voices.find((v) => want.test(v.lang) && ok(v) && /premium|enhanced|natural/i.test(v.name)) ||
    voices.find((v) => want.test(v.lang) && ok(v)) ||
    voices.find((v) => fallback.test(v.lang) && ok(v)) ||
    null
  );
}

export function voicesFor(lang) {
  if (typeof speechSynthesis === 'undefined') return [];
  const re = lang === 'en' ? /^en/i : /^(zh|cmn)/i;
  return speechSynthesis.getVoices().filter((v) => re.test(v.lang) && !/yue|HK|MO/i.test(v.lang));
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
