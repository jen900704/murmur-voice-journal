// Records the silent demo walkthrough videos in docs/demo/ (demo-en.mp4, demo-zh.mp4 and a
// poster PNG for each). The captions are drawn by this script on top of the page; they are
// not part of the app.
//
// Needs Chrome, ffmpeg and python3. Run from the repository root:
//   node tools/record-demo.mjs            both languages
//   node tools/record-demo.mjs en         one language
// Options (environment):
//   CHROME_PATH   Chrome to use (default /usr/bin/google-chrome)
//   FAST=1        short pauses, for checking the script; the video is not for publishing
//   SHOTS=dir     also save a screenshot at every caption into dir
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'demo');
const PORT = 8811;
const BASE = `http://localhost:${PORT}/`;
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const FAST = process.env.FAST === '1';
const SHOTS = process.env.SHOTS || '';
const VIEW = { width: 390, height: 844 };
const SCALE = 2;

// What appears on screen. The lines follow docs/hackathon/genhacks-devpost.md.
const TEXT = {
  en: {
    locale: 'en-US',
    cap: {
      problem1: 'Most people who are stressed never see a counselor.',
      problem2: 'They still need something small that helps tonight.',
      speak: 'I speak for thirty seconds.',
      measure: "Murmur measures my voice on the phone. Nothing is uploaded.",
      compare: 'It compares me with my own usual range, not with anyone else.',
      mood: "If I can't talk out loud, I can just log my mood.",
      worry: 'This is a worry about my parents.',
      first: 'The app puts the approaches often used for family worries first.',
      questions: 'Family systems asks three questions, then shows a pattern and one small experiment.',
      misses: 'It also says what this approach might miss.',
      night: 'At night the screen turns dark and asks for less.',
      setDown: 'I set the worry down and write one kind thing I did for myself.',
      windDown: "A short wind-down plays in my phone's own voice.",
      postcard: 'I get a small postcard. There are no streaks.',
      calm: 'If I feel panicky, one button starts slow breathing.',
      mirror: 'The language mirror counts the words in my own writing, on the phone.',
      evidence: 'Each number opens to show the exact words it counted.',
      search: 'Search finds what I wrote before.',
      close1: 'It works offline, has no accounts, and keeps everything on the phone.',
      close2: 'This is Murmur.',
    },
    moodNote: 'Tired after work. The walk home helped a little.',
    concern: 'My parents keep asking me to move back home and work nearby.',
    answers: ['My older brother was asked the same thing', 'Mom worries out loud, Dad goes quiet, and I end up in the middle', 'I want to stay here for two more years'],
    nightWorry: 'Presentation tomorrow morning',
    nightKind: 'Bought the bread I like after work',
    query: 'work',
    // A made-up journal sample. It is not about any real person.
    sample: [
      'I woke up before the alarm today and I lay still for a while. I think the rain helped, because the street was quiet.',
      'I made tea and I wrote my list. We have a deadline on Friday, and I worry that my part is not ready, but maybe it is closer than I think.',
      'At lunch my friend and I walked to the park. We talked about her new place, and I felt lighter after that. I am grateful that she asks how I am.',
      'In the afternoon I was slow. I read the same page three times, and I felt a little sad for no clear reason. I did not push it away.',
      'I called my sister on the way home. She laughed at my story about the bus, and I laughed too. We said we would cook together next week.',
      'At home I cooked rice and eggs. I like simple food when I am tired. I watered the plant, and I noticed one new leaf.',
      'I still worry about Friday. I think I will ask my teammate for help tomorrow, because we work better together. Maybe that is the kind thing I can do for myself.',
      'Before bed I wrote this. I feel calm now, and I hope I sleep well. I know tomorrow will be busy, but I am not alone in it.',
      'I remember that last month felt harder than this. I was afraid then, and I am less afraid now. We got through it, and I learned that I can ask.',
      'So tonight I will close the laptop early. I will read a little, and I will let the day end.',
    ].join('\n\n'),
  },
  zh: {
    locale: 'zh-TW',
    cap: {
      problem1: '大多數有壓力的人，從來不會去找諮商師。',
      problem2: '但他們今晚還是需要一點小小的幫助。',
      speak: '我說三十秒的話。',
      measure: 'Murmur 在手機上分析我的聲音，不會上傳。',
      compare: '它只拿我和我自己平常的樣子比較，不和別人比。',
      mood: '如果不方便出聲，也可以只記心情。',
      worry: '這是一個關於爸媽的煩惱。',
      first: 'App 會把常用來看家庭煩惱的角度排在前面。',
      questions: '家族系統取向問三個問題，然後整理出一個模式和一個小練習。',
      misses: '它也會說這個角度可能忽略了什麼。',
      night: '晚上畫面會變暗，要做的事也變少。',
      setDown: '我把心事放下，寫一件今天對自己好的事。',
      windDown: '手機用自己的聲音唸一段睡前引導。',
      postcard: '最後收到一張小明信片，沒有連續天數的壓力。',
      calm: '覺得很慌的時候，按一個按鈕就開始慢慢呼吸。',
      mirror: '語言鏡在手機上數一數我自己寫的文字用了哪些詞。',
      evidence: '每個數字都可以點開，看到它算進去的是哪些字。',
      search: '搜尋可以找到我以前寫過的內容。',
      close1: '它可以離線使用，不用帳號，所有資料都留在手機上。',
      close2: '這是 Murmur。',
    },
    moodNote: '今天上班好累，走路回家有好一點。',
    concern: '爸媽一直催我搬回家，在家附近找工作。',
    answers: ['哥哥以前也被催過', '媽媽會一直唸，爸爸不說話，我常常夾在中間', '我想先留在這裡兩年'],
    nightWorry: '明天早上要報告',
    nightKind: '下班後去買了喜歡的麵包',
    query: '工作',
    // 虛構的日記範例，不是任何真實的人。
    sample: [
      '今天我比鬧鐘早醒，我躺了一下才起床。我覺得是下雨的關係，外面很安靜。',
      '我泡了茶，寫下今天要做的事。我們星期五要交報告，我擔心我的部分還沒準備好，可是也許比我想的還接近完成。',
      '中午我和朋友一起走去公園。我們聊到她的新家，聊完我覺得輕鬆很多。我很感謝她會問我最近好不好。',
      '下午我的速度很慢。同一頁我讀了三次，我有一點難過，也說不出原因。我沒有把這個感覺推開。',
      '回家路上我打電話給妹妹。她聽到我搭公車的事笑了，我也笑了。我們說好下星期一起煮飯。',
      '回到家我煮了飯和蛋。我累的時候喜歡吃簡單的東西。我幫盆栽澆水，發現它長了一片新葉子。',
      '我還是擔心星期五。我想明天請同事幫忙，因為我們一起做會比較順。也許這就是我今天可以對自己好的事。',
      '睡前我寫下這些。我現在覺得平靜，希望今晚睡得好。我知道明天會很忙，可是我不是一個人。',
      '我記得上個月比現在辛苦。那時候我很害怕，現在我沒有那麼怕了。我們一起撐過來了，我也學到我可以開口。',
      '所以今晚我會早一點關電腦。我會讀一點書，讓這一天慢慢結束。',
    ].join('\n\n'),
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} failed:\n${(r.stderr || '').slice(-2000)}`);
  return r.stdout;
}

async function startServer() {
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE)).ok) return server;
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  server.kill();
  throw new Error(`could not start the local server on port ${PORT}`);
}

async function recordOne(lang) {
  const T = TEXT[lang];
  const C = T.cap;
  const tmp = mkdtempSync(path.join(tmpdir(), 'murmur-demo-'));
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${path.join(ROOT, 'tests', 'fixtures', 'speech.wav')}`, '--hide-scrollbars'],
  });
  const ctx = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: SCALE,
    locale: T.locale,
    timezoneId: lang === 'zh' ? 'Asia/Taipei' : 'America/New_York',
    permissions: ['microphone'],
    colorScheme: 'light',
    serviceWorkers: 'block',
    recordVideo: { dir: tmp, size: { width: VIEW.width * SCALE, height: VIEW.height * SCALE } },
  });
  // Headless Chrome has no speech voices, and the app would then say that the track plays as
  // text. The video is silent, so a stand-in voice that makes no sound takes the place of the
  // phone's own voice: the app shows what it shows on a phone that has one.
  await ctx.addInitScript((voiceLang) => {
    const pending = new Set();
    const fake = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => [{ name: 'Device voice', lang: voiceLang, localService: true, default: true, voiceURI: 'device' }],
      speak(u) {
        const ms = Math.max(1200, (u.text || '').trim().length * (voiceLang === 'en-US' ? 75 : 260)) / (globalThis.__MURMUR_SPEED || 1);
        const id = setTimeout(() => {
          pending.delete(id);
          if (typeof u.onend === 'function') u.onend({});
        }, ms);
        pending.add(id);
      },
      cancel() {
        for (const id of pending) clearTimeout(id);
        pending.clear();
      },
      pause() {},
      resume() {},
      addEventListener() {},
      removeEventListener() {},
    };
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
        this.volume = 1;
      }
    };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  }, T.locale);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  const pause = (ms) => page.waitForTimeout(FAST ? Math.min(ms, 250) : ms);
  const key = (k) => page.locator(`[data-key="${k}"]`);
  let shot = 0;

  // The caption bar: a small fixed overlay, drawn here and nowhere in the app.
  async function caption(text) {
    await page.evaluate(
      ({ text, zh }) => {
        let bar = document.getElementById('demo-caption');
        if (!bar) {
          bar = document.createElement('div');
          bar.id = 'demo-caption';
          bar.setAttribute('aria-hidden', 'true');
          bar.style.cssText =
            'position:fixed;left:12px;right:12px;bottom:84px;z-index:2147483647;pointer-events:none;' +
            'padding:10px 14px;border-radius:12px;background:rgba(22,20,42,.92);color:#fff;' +
            'font:500 15px/1.4 system-ui,"Noto Sans CJK TC","Noto Sans TC",sans-serif;text-align:center;' +
            'box-shadow:0 4px 16px rgba(0,0,0,.25);transition:opacity .25s;opacity:0';
          document.documentElement.appendChild(bar);
        }
        bar.lang = zh ? 'zh-Hant-TW' : 'en';
        bar.textContent = text || '';
        bar.style.opacity = text ? '1' : '0';
      },
      { text, zh: lang === 'zh' }
    );
    if (SHOTS && text) {
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(SHOTS, `${lang}-${String(++shot).padStart(2, '0')}.png`) });
    }
  }
  // how long a caption stays: long enough to read
  const read = (text) => pause(Math.max(3200, lang === 'zh' ? text.length * 210 : text.length * 62));
  async function say(text) {
    await caption(text);
    await read(text);
  }
  async function type(selector, text) {
    await page.locator(selector).click();
    await page.locator(selector).pressSequentially(text, { delay: FAST ? 0 : lang === 'zh' ? 90 : 32 });
  }
  async function scrollBy(dy, steps = 24) {
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, dy / steps);
      await page.waitForTimeout(FAST ? 1 : 28);
    }
  }
  const top = () => page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // Daytime first. The clock runs on from here, so the recording timer still counts.
  await page.clock.install({ time: new Date(lang === 'zh' ? '2026-11-24T10:15:00+08:00' : '2026-11-24T10:15:00-05:00') });
  await page.goto(BASE);
  await page.locator('.prompt-text').waitFor();
  const closeWelcome = key('welcome-close');
  if (await closeWelcome.count()) await closeWelcome.click();
  await page.evaluate(() => document.fonts.ready);
  await pause(600);
  const lead = (Date.now() - t0) / 1000; // loading time, cut from the video

  // 1. Today
  await say(C.problem1);
  await page.screenshot({ path: path.join(OUT, `demo-${lang}-poster.png`) });
  await say(C.problem2);

  // 2. Voice journal: record through Chrome's fake microphone
  await caption(C.speak);
  await pause(1200);
  await page.click('.rec-btn');
  await page.waitForTimeout(4500);
  await caption(C.measure);
  await page.waitForTimeout(4500);
  await page.click('.rec-btn');
  await page.waitForSelector('.result-head, .error', { timeout: 30_000 });
  if (await page.locator('.error').count()) throw new Error('the recording was not analyzed: ' + (await page.locator('.error').textContent()));
  await pause(1500);
  await caption(C.compare);
  await key('result-numbers').click();
  await pause(1200);
  await scrollBy(420);
  await read(C.compare);
  await top();
  await pause(600);
  await key('mood-5').click();
  await pause(500);
  await key('energy-4').click().catch(() => {});
  await pause(700);
  await key('save').scrollIntoViewIfNeeded();
  await key('save').click();
  await page.locator('.rec-btn').waitFor();
  await pause(800);

  // 3. Just your mood
  await caption(C.mood);
  await key('silent-checkin').scrollIntoViewIfNeeded();
  await pause(1000);
  await key('silent-checkin').click();
  await pause(900);
  await key('mood-3').click();
  await pause(500);
  await key('energy-3').click().catch(() => {});
  await pause(500);
  await type('#note', T.moodNote);
  await pause(1300);
  await key('save').click();
  await key('silent-checkin').waitFor();
  await pause(700);

  // 4. Theory lens: a family worry through family systems
  await caption('');
  await page.locator('#tabs a[href="#lens"]').click();
  await key('lens-start').waitFor();
  await pause(1300);
  await key('lens-start').click();
  await caption(C.worry);
  await type('#lens-concern', T.concern);
  await pause(600);
  await key('topic-family').click();
  await pause(1500);
  await key('lens-concern-next').click();
  await pause(900);
  await page.getByRole('button', { name: lang === 'zh' ? /自己選/ : /Choose myself/ }).click();
  await key('pick-family-systems').waitFor();
  await say(C.first);
  await key('pick-family-systems').click();
  await page.locator('#lens-answer').waitFor();
  await caption(C.questions);
  await pause(1800);
  for (const a of T.answers) {
    if (await page.locator('.lens-summary').count()) break;
    await type('#lens-answer', a);
    await pause(700);
    await key('lens-next').click();
    await pause(900);
  }
  await page.locator('.lens-summary').waitFor();
  await pause(2200);
  await scrollBy(330);
  await pause(2400);
  await caption(C.misses);
  await scrollBy(300);
  await read(C.misses);
  await key('lens-save').scrollIntoViewIfNeeded();
  await pause(400);
  await key('lens-save').click();
  await pause(1300);

  // 5. Evening: 22:30 on the page's clock
  await caption('');
  await page.clock.setSystemTime(new Date(lang === 'zh' ? '2026-11-24T22:30:00+08:00' : '2026-11-24T22:30:00-05:00'));
  await page.locator('#tabs a[href="#today"]').click();
  await key('night-start').waitFor();
  await top();
  await say(C.night);
  await key('night-start').click();
  await page.locator('#night-worry').waitFor();
  await caption(C.setDown);
  await type('#night-worry', T.nightWorry);
  await pause(500);
  await key('night-theme-work').click();
  await pause(1100);
  await key('night-next').click();
  await page.locator('#night-kind').waitFor();
  await type('#night-kind', T.nightKind);
  await pause(1100);
  await key('night-next').click();
  await key('track-person-centered').waitFor();
  await pause(1800);
  await caption(C.windDown);
  await key('track-person-centered').click();
  await page.locator('.view.night.playing').waitFor();
  await pause(9000);
  // the track lasts a few minutes; run the page's clock ahead to its end
  await page.evaluate(() => (globalThis.__MURMUR_SPEED = 400));
  for (let i = 0; i < 40 && !(await page.locator('.postcard svg').count()); i++) await page.clock.runFor(20_000);
  await page.locator('.postcard svg').waitFor({ timeout: 30_000 });
  await page.evaluate(() => (globalThis.__MURMUR_SPEED = 1));
  await say(C.postcard);
  await pause(1200);
  await key('night-done').scrollIntoViewIfNeeded();
  await key('night-done').click();
  await page.locator('.rec-btn').waitFor();

  // 6. Calm now, briefly
  await caption(C.calm);
  await key('calm-link').scrollIntoViewIfNeeded();
  await pause(900);
  await key('calm-link').click();
  await key('calm-start').waitFor();
  await pause(1800);
  await key('calm-start').click();
  await pause(8500);
  await page.locator('#sheet .back').first().click();
  await pause(500);

  // 7. Language mirror: pasted sample text, one evidence panel
  await caption('');
  await page.locator('#tabs a[href="#journal"]').click();
  await key('jmode-words').waitFor();
  await key('jmode-words').scrollIntoViewIfNeeded();
  await pause(900);
  await key('jmode-words').click();
  await page.locator('#ll-text').waitFor();
  await caption(C.mirror);
  await page.locator('#ll-text').scrollIntoViewIfNeeded();
  await pause(900);
  await page.fill('#ll-text', T.sample);
  await pause(1800);
  await key('ll-analyze').scrollIntoViewIfNeeded();
  await key('ll-analyze').click();
  await key('score-i').waitFor();
  await key('ll-notice').scrollIntoViewIfNeeded().catch(() => {});
  await pause(2200);
  await scrollBy(260);
  await pause(1800);
  await caption(C.evidence);
  await key('score-i').click();
  await page.locator('#sheet mark.ll-hit').first().waitFor();
  await pause(2600);
  await page.locator('#sheet .ll-excerpt').first().scrollIntoViewIfNeeded();
  await pause(2800);
  await page.locator('#sheet .back').first().click();
  await pause(500);

  // 8. Journal search
  await caption(C.search);
  await key('jmode-voice').click().catch(() => {});
  await top();
  await pause(900);
  await type('[data-key="journal-search"]', T.query);
  await page.locator('.search-hit').first().waitFor();
  await pause(3800);

  // close
  await say(C.close1);
  await say(C.close2);
  await caption('');
  await pause(500);

  const total = (Date.now() - t0) / 1000;
  const video = page.video();
  await ctx.close();
  await browser.close();
  const webm = await video.path();

  // H.264, 30 fps, no audio track; the loading time at the start is cut
  const mp4 = path.join(OUT, `demo-${lang}.mp4`);
  const part = path.join(OUT, `demo-${lang}.part.mp4`);
  run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', lead.toFixed(2), '-i', webm, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-r', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', part]);
  run('mv', [part, mp4]);
  rmSync(tmp, { recursive: true, force: true });
  const seconds = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).trim());
  console.log(`${path.relative(ROOT, mp4)}  ${(statSync(mp4).size / 1e6).toFixed(2)} MB  ${seconds.toFixed(1)} s  (recorded ${total.toFixed(0)} s)`);
  if (errors.length) console.log(`page errors (${lang}):\n` + errors.join('\n'));
}

const langs = process.argv.slice(2).filter((a) => TEXT[a]);
mkdirSync(OUT, { recursive: true });
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const server = await startServer();
try {
  for (const lang of langs.length ? langs : ['en', 'zh']) await recordOne(lang);
} finally {
  server.kill();
}
