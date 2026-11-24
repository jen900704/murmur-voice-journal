# Changelog

## 2026-11-24

The first public version, built and reviewed over one night. Each area below went through several independent reviews (code, clinical wording, cultural fit for Taiwan and the US, Taiwan Mandarin copy, and screenshot walkthroughs on a phone-sized screen), and the fixes that could be tested were given tests.

### Added

- Language mirror: on-device analysis of the person's own writing and of their own social media exports, with word-level evidence, intervals, limits and a downloadable evidence report (js/langlab, js/language-view.js). Literature, licenses and design in docs/language-analysis.
- "When it gets too much": breathing, grounding and self-compassion phrases in one flow (js/calm.js).
- "Write it out": writing by weight with Pennebaker-style deep prompts and a closing (js/writing.js); the low-mood note's small action now follows the latest energy rating.
- Risk screen also catches past tense in English ("I wanted to die").

- Copy pass on interface text and daily prompts (same names for the same features everywhere; prompts that work on a bad day and assume no family closeness, money or job). Inside a lens question, an earlier answer is cut short, and a blank one reads as "it".

- Content passes: theory-lens summaries reframed so any answer reads naturally, long questions shortened, attributions checked against Corey (for example WDEP credited to Wubbolding building on Glasser); bedtime scripts split into shorter spoken lines with more pause time and fewer characters a speech voice may misread; recommendations fact-checked (Taiwan titles, creators, years, runtimes) with content notes added. Titles without a confirmed Taiwan release name show the original title.

- Theory lens: the pick list is compact rows, with the lenses often used for the chosen kind of worry first. Answers like "not sure" are never quoted back in summaries; when most were left open, the summary says so plainly. The note on finding someone to talk to sits under the buttons, and is no longer repeated inside two lenses. Several lines reworded (Gestalt body sentence and the long "I choose" question, the family-systems first question, the rating scale's low end).

- Until there are enough recordings for a usual range, the result screen shows the voice shape and the check-in first, with the raw numbers folded under "See the numbers".

- Evening Today is calmer: the bedtime card comes first; after a low check-in, a short note follows with one kind thing, one small action, breathing and help. The whole bedtime ritual uses the dark palette, header and tabs included.

- Silent check-in: mood, energy and a note without recording, for nights when speaking aloud is not possible. Listed in the journal, kept out of voice trends.
- Voice journal with on-device prosody, a personal baseline, trends and mood and energy check-ins; preregistered validation against Praat on English speech, a robustness study, and an exploratory Mandarin pilot.
- "Look at it from another angle" (換個角度看看): 14 counseling approaches from Corey's text as short self-reflection exercises, with compare, draw-a-card, a card deck and "which approach fits me".
- Bedtime ritual with nine wind-down tracks (including a psychoanalytic "letting images drift up" and a family systems track), a suggested track for each kind of worry, "Just listen", and a pastel postcard.
- Goodnight card to one person, prompt exchange by link, kindness jar, low-mood card with small general actions, a one-minute breathing pacer, and recommendations ordered for the time of day and the latest check-in.
- First-visit welcome, help lines by region on every lens and ritual step and under About, a monthly backup reminder, and a one-time note on iPhone about keeping data with a Home Screen app.
- Experimental AI conversation for the reflection exercises (off by default, own API key).
- Docs for review: `docs/content-review.md` (every question and script, in Chinese), `docs/reviewer-brief.md` (one page for a supervisor), social design notes, roadmap, self-study protocol.

### Safety
- Risk language pauses the lens exercise, the bedtime ritual and the AI chat with help lines (a voice note is saved first, then help is shown); nothing is deleted and a false alarm can be dismissed. Tested on about 210 Chinese and English phrases, with no regex features that older iPhones cannot parse.
- AI replies that mention risk without help lines are held back; help lines must be a number next to a word like call or 專線.
- Bedtime speech skips voices the browser reports as online.

### Reliability

- From a robustness hunt (47 browser checks): long unbroken text wraps; failed saves in private mode say so; a hanging IndexedDB no longer leaves a blank page; Today refreshes at 20:00 and at midnight when idle; "done for tonight" uses the same 4 pm window everywhere; postcards fit 120 characters; import counts duplicates, nights and saved exercises correctly, keeps a lens exercise in progress, clears the file picker, and now includes lens ratings; focus returns after closing a postcard and after Done. The phone's Back button now goes one step back inside the ritual and a lens exercise (js/flow-history.js), with one history entry per flow.
- Recording cannot hang, ends cleanly when the microphone is lost or the app is hidden, and decodes on older Safari.
- Backups are checked record by record on import; a damaged file cannot break a screen.
- The service worker serves one release at a time, fetches past the CDN cache, applies updates only when the app is idle, and the cache name is a hash of the app files checked by a unit test.
- 374 unit checks and 205 browser tests in Chromium (most also run in WebKit in CI), plus lab tests, including an offline test and a WCAG 2.1 AA audit of 31 screens (Chinese in light mode, English in dark mode).
