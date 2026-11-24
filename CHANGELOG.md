# Changelog

## 2026-11-24

The first public version, built and reviewed over one night. Each area below went through several independent reviews (code, clinical wording, cultural fit for Taiwan and the US, Taiwan Mandarin copy, and screenshot walkthroughs on a phone-sized screen), and the fixes that could be tested were given tests.

### Added

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
- Recording cannot hang, ends cleanly when the microphone is lost or the app is hidden, and decodes on older Safari.
- Backups are checked record by record on import; a damaged file cannot break a screen.
- The service worker serves one release at a time, fetches past the CDN cache, applies updates only when the app is idle, and the cache name is a hash of the app files checked by a unit test.
- 261 unit checks and 70+ browser tests, including an offline test and a WCAG 2.1 AA audit of 19 screens (Chinese in light mode, English in dark mode).
