# Roadmap

## Built

- Voice journal with on-device prosody, personal baseline, trends, and mood and energy check-ins
- Preregistered validation against Praat on human speech, and a robustness study (codecs, gain, AGC, noise, reverberation, telephone band, Chrome's own recording path)
- Confidence label for each feature, and a CSV codebook
- Theory lens: 14 counseling approaches, compare mode, lens cards, "which lens fits me"
- Bedtime ritual: set a worry down, one kind thing, a wind-down track in the style of nine approaches (including a psychoanalytic "murmur": letting images drift up without interpreting them; and a family systems track on handing back other people's worries), pastel postcard
- Kindness jar, low-mood card, daily prompt exchange by link, calendar reminder, goodnight card to one person
- First-visit welcome with three ways in; help lines by region (Taiwan, US, elsewhere)
- Breathe for a minute (4 in, 6 out); small general actions on the low-mood card; monthly backup reminder
- Gentle recommendations with content notes
- Experimental AI conversation for theory lenses (off by default, own API key)
- Safety net for risk language in every free-text field that is stored or shared, with help lines always reachable
- Unit tests, browser tests through a fake microphone, an offline test through the service worker, and a WCAG 2.1 AA audit of every screen, all in CI
- Releases: `npm run prepare-release` regenerates the content review file and the cache name (a hash of the app files); unit tests fail if either is stale

## Needs the owner's review

- The recommendation list: Taiwan titles, years, and content notes (`data/recs.json`). Titles that were uncertain are left blank.
- The theory-lens questions and bedtime scripts, against how the approaches are taught in the program (`js/lenses.js`, `js/bedtime.js`). A faculty member or supervisor reading them before wider sharing would help. All of it, in Chinese with checkboxes, is in [`content-review.md`](content-review.md) (regenerate with `node tools/export-content.mjs`). A one-page English brief for a supervisor is [`reviewer-brief.md`](reviewer-brief.md).
- Whether to mention the app to the program or site supervisor, since it carries a counseling student's name.
- Chinese terms to check against the Taiwan edition of Corey before changing them (a reviewer suggested these but could not check the book): REBT's A as 觸發事件 versus 促發事件 or 緣起事件; the coping self-talk experiment in the cognitive lens, which is Meichenbaum's 認知行為矯正 rather than Beck; 真誠 in the existential lens, which collides with Rogers' 真誠一致 (perhaps 活得真實); reality therapy's 權力 (perhaps 權力（成就感）); and 前因 versus 前事 in behavioral ABC.

## Needs a decision

- Social features: which platform (if any), and who moderates. Requirements are in [`social-design.md`](social-design.md).
- Recording bedtime tracks in a real human voice instead of the phone's synthetic voice.

## Research next

- Collect the owner's own recordings following [`self-study-protocol.md`](self-study-protocol.md). This gives the real day-to-day spread that the "higher or lower than usual" messages depend on, and held-out data for the voicing-threshold question in `validation-results.md`.
- Recorded Mandarin speech for validation. An exploratory two-clip pilot is in [`mandarin-pilot.md`](mandarin-pilot.md); a real check needs everyday phone recordings from Taiwanese speakers.

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
| Japanese interface | not started | Needs Japanese crisis patterns in the safety net and verified Japanese help lines before anything else |
