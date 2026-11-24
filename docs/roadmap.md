# Roadmap

## Built

- Voice journal with on-device prosody, personal baseline, trends, and mood and energy check-ins
- Preregistered validation against Praat on human speech, and a robustness study (codecs, gain, AGC, noise, reverberation, telephone band, Chrome's own recording path)
- Confidence label for each feature, and a CSV codebook
- Theory lens: 14 counseling approaches, compare mode, lens cards, "which lens fits me"
- Bedtime ritual: set a worry down, one kind thing, a wind-down track in the style of nine approaches (including a psychoanalytic "murmur": letting images drift up without interpreting them; and a family systems track on handing back other people's worries), pastel postcard
- Kindness jar, low-mood card, daily prompt exchange by link, calendar reminder, goodnight card to one person
- First-visit welcome with three ways in; help lines by region (Taiwan, US, elsewhere)
- Gentle recommendations with content notes
- Experimental AI conversation for theory lenses (off by default, own API key)
- Safety net for risk language in every free-text field that is stored or shared, with help lines always reachable
- Unit tests, browser tests through a fake microphone, and a WCAG 2.1 AA audit of every screen, all in CI

## Needs the owner's review

- The recommendation list: Taiwan titles, years, and content notes (`data/recs.json`). Titles that were uncertain are left blank.
- The theory-lens questions and bedtime scripts, against how the approaches are taught in the program (`js/lenses.js`, `js/bedtime.js`). A faculty member or supervisor reading them before wider sharing would help. All of it, in Chinese with checkboxes, is in [`content-review.md`](content-review.md) (regenerate with `node tools/export-content.mjs`).
- Whether to mention the app to the program or site supervisor, since it carries a counseling student's name.

## Needs a decision

- Social features: which platform (if any), and who moderates. Requirements are in [`social-design.md`](social-design.md).
- Recording bedtime tracks in a real human voice instead of the phone's synthetic voice.

## Research next

- Collect the owner's own recordings following [`self-study-protocol.md`](self-study-protocol.md). This gives the real day-to-day spread that the "higher or lower than usual" messages depend on, and held-out data for the voicing-threshold question in `validation-results.md`.
- Recorded Mandarin speech for validation (all human-speech validation so far is English).

## Idea backlog

Ideas come in over time; each gets reshaped for safety and ease of use before it is built.

| Idea | Status | Notes |
|---|---|---|
| Theory-based bedtime audio ("murmurs" from each school) | built | Written in the spirit of each approach, never in a real person's voice |
| Pastel healing postcards | built | Procedural, original motifs |
| Recommendations: films, books, drama, musicals, opera, short films | built | Short animated films added; live short plays not included, since what is on stage changes too fast for a static list |
| Messaging and social connection | design only | Starts with invite-code pairs; see `social-design.md` |
| Goodnight card to one person | built | A fixed line the person picks, sent through the phone's share sheet; nothing written that night goes on it; no feed, counts, or receipts |
| Daily writing prompt and partner exchange | built | Exchange by link, no server |
| "One kind thing I did today", visible to people in a low mood | built privately | Shared version waits for the social design |
| AI counselor-style conversation | built, experimental | Psychoeducation framing; not counseling |
| Japanese interface | not started | |
