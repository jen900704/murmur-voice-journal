# Next plan (agreed 2026-11-28)

Three advisors (product and delight; trust, safety and clinical ethics; engineering, privacy and portfolio) each wrote a position, read the other two, and replied. This is where they ended up.

## Build order

1. **Today loop.** One composer (type or speak), live word marks, the nine-grid topic picker as a visible opening that takes one tap and can be skipped, rotating questions with a die and quote-back, and the picture card drawing itself. One shared motion system: transforms only, reduced motion respected, no celebration on heavy entries.
2. **Resource finder** (Taiwan and US). See below.
3. **Social design rewrite.** Rewrite docs/social-design.md, add a threat model page and a written go-live gate.
4. **Contact and comment filters** with a published evaluation: a bilingual adversarial set and a supportive set, recall and false-positive rate with Wilson intervals, and evasion recall reported honestly.
5. **Demo social layer** in js/social/, loaded by dynamic import behind a flag, on clearly labelled sample content: feed, 我也是, preset warm replies, comments and DMs. Includes the explainable ranker with a "why am I seeing this" panel and a preregistered simulation in lab/feed.
6. **Moderation and terms.** Moderation queue, report and block, written crisis protocol, rewritten PRIVACY.md and terms.
7. **Go-live gate.** After it passes: invite pairs and circles on Cloudflare Workers + D1, light answers and picture cards, and anything strangers can read held for review. Order is chronological live; the ranker stays in demo and lab.
8. **Real comments, then DMs.**

## Contact details

- Always blocked on public surfaces (posts, comments, first messages from strangers). Reasons: off-platform scams, sextortion and grooming; doxxing of third parties; scraping; legal load from storing contact data next to health-related text.
- No block inside invite pairs and closed circles, where people already know each other.
- In DMs: allowed after both people tap "exchange contact". The thread must be a few days old and not crisis-flagged, and a one-line reminder appears.
- Detection never fires on help lines (1925, 1995, 1980, 113, 988), dates or amounts. The person always sees why and can edit. Nothing is dropped silently.

## Resource finder rules

- Crisis lines are pinned above every result and shown before any place is typed.
- Ranking uses the typed place and the chosen kind of help only, never what the person wrote. Ranking from their text would look like assessment or triage.
- Wording says "listed" or "options to consider", not "recommended". It is a directory, not a referral; Murmur has not vetted anyone. Each entry shows its source, a last-checked date, and "call to confirm".
- Group homes and residential care: explain that entry usually goes through an agency or clinician, with eligibility rules. Never list DV shelter addresses, only the hotlines.
- DSS and 社會局: neutral description of what the office handles, no promised outcomes.
- The typed place is matched on the device against a bundled gazetteer and never uploaded. Regional data shards are fetched from the app's own site in coarse groups, and PRIVACY.md says so. Volatile or very large directories are linked out to official locators.
- Shards are rebuilt by a scheduled GitHub Action that validates the schema, checks links and flags stale records.
- Evaluation: a labelled bilingual query set (nDCG) plus a test that a crisis line is always at the top.

## Other agreed points

- Quote-back:
  - Never quote an entry that tripped the risk screen.
  - Any entry can be excluded.
  - There is a "not today" control, and quote-back is held back on low days.
  - It stays mechanical and labelled.
- No streaks and no pull notifications. Questions are finite.
- Any "answer to see others" reciprocity has a pass option that still unlocks.
- Code discipline:
  - New surfaces (js/social/, js/resources/) are dynamically imported.
  - No new code in app.js.
  - Retire something when adding something.
- Portfolio extras: a Chinese construct-validity retest for 語言鏡 and a quote-faithfulness report for the LLM personalisation.
