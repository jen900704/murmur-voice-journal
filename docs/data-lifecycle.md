# Data over time, and donating it to research

Murmur keeps everything on the person's device. That is simple on day one and harder by day 40, when a person may have dozens of recordings, worries, answers and nights stored in one browser. This page sets out what happens to that data over time, and how a person could one day choose to give some of it to research.

## After about 40 days

What is there by then: roughly 40 voice records (numbers, plus audio only if the person kept it), a few dozen 換角度 sessions with their own words, nights, kind things, and language-mirror texts.

Risks at this point are about losing it, not about who sees it:

- **Browser storage can be cleared.** Safari on iPhone may clear a site's storage after 7 days without a visit unless the app was added to the home screen. Murmur asks the browser to keep its storage (persistent storage); adding it to the home screen avoids the 7-day rule.
- **No copy exists elsewhere.** There is no server, so a lost phone means lost entries.

Design, in order of what is built first:

1. **Backup reminder** (built): after 10 real records (voice entries, 換角度 sessions and nights together), and then once a month without a backup, a quiet line on Today offers one. Dismissing it waits another month. No notification, no badge.
2. **Keep or tidy** (planned): a setting with three choices. Keep everything (default). Keep numbers and summaries, delete written text older than 90 days. Ask me each month. Nothing is deleted without the person choosing it.
3. **Monthly look back** (planned): a short page made on the device from the past month: which approaches were tried, heaviness before and after, which worry kinds came up, the words that came up most in the language mirror. The person can save it as a card or a file.

## Donating data to research

People sometimes want what they recorded to help research. Murmur does not collect anything, so donation has to be something the person does on purpose, with the package built and checked on their own device. This follows the data donation approach used in social science, where people request or export their own data, review it locally, and choose what to hand over (Boeschoten et al., 2022, *Computational Communication Research*; the open-source Port software from Eyra processes the data in the participant's browser before anything is shared).

What exists now: `js/donation.js` builds a donation package on the device and describes it for a preview. It is tested (`tests/donation.test.mjs`) and is not wired to any screen or endpoint.

- **By default, numbers only.** Voice features (not audio, not the pitch contour), mood and energy, which approach was tried, ratings, heaviness before and after, worry kinds, bedtime tracks.
- **No dates or ids.** Times become days since the first record; record ids are dropped; demo data is excluded.
- **Text is a separate choice.** Worries, answers, notes and kind things are added only if the person turns that on. E-mail addresses, links, @handles and long digit runs are masked, and the preview says plainly that names and places can still be in the text.

What would have to exist before any donation is switched on:

1. A study with ethics approval (an IRB in the US under the Common Rule; in Taiwan, review under the Human Subjects Research Act 人體研究法), a named principal investigator, and a consent form that says what is collected, why, who can see it, how long it is kept, and how to withdraw.
2. A consent screen in the app that shows that form, then the preview of the exact package, field by field.
3. A withdrawal code given to the person, so their package can be found and deleted later.
4. A transfer the person starts (a file they send, or an upload they press), never in the background.
5. Health-related text treated as sensitive personal data (Taiwan's Personal Data Protection Act 個人資料保護法 gives medical and health information special protection), so text stays off by default and is kept separately from the numbers.

Until then the app has no donation button. The package builder exists so the design can be reviewed and tested now.
