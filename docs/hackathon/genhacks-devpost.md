# GenHacks submission draft (Healthcare & Environmental track)

Deadline: December 26, 2026, 5:00 PM ET. Needed: this project page, a demo video under 3 minutes (YouTube or Vimeo, embedding on), the public GitHub link, the track, and all team members added on Devpost.

Before submitting, check two things in the rules tab: that graduate students count as students, and how they treat a project started on November 23 (inside the November 1 to December 26 window).

Everything below is a draft for Jen to edit into her own words.

---

## Name

Murmur 低語日記

## Tagline

A private voice journal and bedtime ritual that runs entirely on your phone.

## Inspiration

Most people who are stressed or low never reach a diagnosis or a counselor. They still deserve something better than an app that tells them to cheer up. I am training as a clinical mental health counselor and I also studied computer science, so I wanted to build the kind of support I would want for my clients between sessions, and for the people who never come in at all: small, honest, private, and not tiring to use.

## What it does

- **Voice journal.** Speak for about 30 seconds. Murmur measures pitch, pitch movement, speaking rate, pauses and voice regularity on the device, and compares them with your own usual range, never with other people.
- **Just your mood.** On nights when you cannot speak aloud, log mood, energy and one line without recording.
- **Theory lens (換個角度看看).** Write down a worry and look at it through one of 14 counseling approaches from Corey's textbook. Each asks three or four questions in its own style, then shows what it noticed, a small experiment, and what that approach might miss.
- **Bedtime ritual.** Set the worry down, note one kind thing you did for yourself, and listen to a three to five minute wind-down in the spirit of a counseling approach, read by the phone's own voice. You get a pastel postcard. No streaks.
- **A low-mood note.** After a low check-in, a few of your own kind things come back, with one small action, a breathing pacer and where to find someone to talk to. Nothing from other users, so there is nothing to compare against.
- **Language mirror.** Paste your own writing or import your own Instagram, Facebook, X, Threads or Reddit export, and see transparent language analysis on the device: every number shows the exact words behind it, an interval, what it cannot tell you, and a downloadable evidence report. The English categories were checked against 43,396 human-labeled comments (GoEmotions, AUC .68 to .94).
- **Too much right now / Write it out.** One button into breathing, grounding and self-compassion phrases; writing prompts by weight with Pennebaker-style deep writing.
- **Search and grounded AI.** Search everything you wrote, on the device. The optional AI conversation retrieves only from vetted lens content and cites it.
- **Safety.** Risk language anywhere pauses the flow and shows help lines for Taiwan, the US or elsewhere. A multi-agent evaluation found seven kinds of warning signs the screen missed; they are fixed.

## How we built it

Vanilla JavaScript and Web APIs, no framework and no server for the app. Audio is analyzed in a Web Worker (YIN pitch tracking, intensity-peak syllable rate). Entries live in IndexedDB; a service worker makes it work offline. Search is BM25 over mixed Chinese and English. An opt-in Thompson-sampling bandit chooses one featured item with logged propensities, and never explores near risk or low mood.

Around the app: a multi-agent evaluation harness (scripted users, the app's real code in Node, rubric judges on Anthropic or AWS Bedrock, judge-human agreement), a preregistered bandit simulation with off-policy evaluation, a DLATK pipeline, a construct-validity study of the language categories, a read-only MCP server for the vetted content, and Terraform for an AWS evaluation runner. Tests: unit, Playwright in Chromium and WebKit, an accessibility audit of 31 screens in two themes, robustness, and lab tests, all in CI.

## Challenges

- Writing counseling content that is honest about its limits: self-help, not therapy, and only techniques that are safe to try alone.
- Catching risk language in Chinese and English without lookbehind regex (older iPhone Safari cannot parse it).
- Making a bedtime screen calm for a tired person: fewer choices, dark colors, nothing to keep up with.

## Accomplishments

- Nothing leaves the device, and there are no accounts.
- Every screen passes an automated accessibility audit in both languages.
- The 14 approaches and 9 bedtime tracks were reviewed for accuracy and for cultural fit in Taiwan and the US.

## What we learned

The most useful features were the ones that removed steps: a silent check-in, a shorter evening screen, a pick list ordered by the kind of worry.

## What's next

Testing with real users in Taiwan and the US, recorded Mandarin speech to validate the voice features, and a careful design for connecting with one trusted person without feeds or counts.

## Built with

javascript, web-audio-api, indexeddb, service-worker, web-speech-api, python, dlatk, aws, terraform, amazon-bedrock, anthropic, mcp, playwright, axe-core, github-actions, github-pages

## Links

- Live app: https://jen900704.github.io/murmur-voice-journal/
- Code: https://github.com/jen900704/murmur-voice-journal

---

# Demo video script (under 3 minutes)

Each English line is followed by its Chinese translation. Read quietly and plainly.

**0:00 Problem (20 s)**

Most people who are stressed never see a counselor.
大多數有壓力的人，從來不會去找諮商師。

They still need something small that helps tonight.
但他們今晚還是需要一點小小的幫助。

**0:20 Voice journal (35 s)** *(screen: tap record, speak, result)*

I speak for thirty seconds.
我說三十秒的話。

Murmur measures my voice on the phone. Nothing is uploaded.
Murmur 在手機上分析我的聲音，不會上傳。

It compares me with my own usual range, not with anyone else.
它只拿我和我自己平常的樣子比較，不和別人比。

If I can't talk out loud, I can just log my mood.
如果不方便出聲，也可以只記心情。

**0:55 Theory lens (45 s)** *(screen: write a worry, pick family, family systems, summary)*

This is a worry about my parents.
這是一個關於爸媽的煩惱。

The app puts the approaches often used for family worries first.
App 會把常用來看家庭煩惱的角度排在前面。

Family systems asks three questions, then shows a pattern and one small experiment.
家族系統取向問三個問題，然後整理出一個模式和一個小練習。

It also says what this approach might miss.
它也會說這個角度可能忽略了什麼。

**1:40 Bedtime (45 s)** *(screen: evening Today, ritual, track playing, postcard)*

At night the screen turns dark and asks for less.
晚上畫面會變暗，要做的事也變少。

I set the worry down and write one kind thing I did for myself.
我把心事放下，寫一件今天對自己好的事。

A short wind-down plays in my phone's own voice.
手機用自己的聲音唸一段睡前引導。

I get a small postcard. There are no streaks.
最後收到一張小明信片，沒有連續天數的壓力。

**2:25 Safety and close (25 s)**

If someone writes something that sounds like risk, the app pauses and shows help lines.
如果寫下的內容聽起來有危險，App 會停下來，顯示求助專線。

It works offline, has no accounts, and keeps everything on the phone.
它可以離線使用，不用帳號，所有資料都留在手機上。

This is Murmur.
這是 Murmur。
