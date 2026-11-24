# Self-study protocol: day-to-day variation on a real phone

Everything Murmur says about "higher or lower than usual" depends on how much a person's own voice varies from day to day. The validation so far used other people's recordings and a proxy for that spread. This protocol collects the missing data from one person (the owner), on her own phone, and should be written down and committed before the data are looked at, like the earlier protocol.

## Recordings

- **Daily, 14 days or more.** Once a day, at a similar time, in a similar quiet room, holding the phone at a similar distance. Read the same short passage (for example the first paragraph of "The North Wind and the Sun" in English, and a fixed Mandarin paragraph of similar length), then answer the daily prompt freely for about 30 seconds. That gives three recordings a day: read English, read Mandarin, spontaneous.
- **Check-ins.** Mood and energy on the 1 to 7 scales after each spontaneous recording, as in the app.
- **Condition checks, on 2 or 3 of those days.** One extra read-English recording each in a noisier room, on a laptop microphone, and with the phone further away.

## What to compute

1. **Day-to-day spread per feature** for each recording type: scaled MAD across days. This replaces the digit-sequence proxy in `robustness-results.md`, and the robustness ratios can then be recomputed with a real denominator.
2. **Test-retest reliability** of the read passages: intraclass correlation across days, per feature.
3. **Read versus spontaneous.** Whether spontaneous speech is too variable for the baseline to be useful, which would argue for a short read passage in the app.
4. **Condition effects** relative to the day-to-day spread, from the condition-check days.
5. **Held-out check of the voicing threshold.** Compare YIN thresholds 0.15 and 0.25 on these recordings against Praat, which answers the open question in `validation-results.md` without reusing the evaluation clips.
6. **Mood and energy**: describe only. Fourteen days from one person is far too little for any claim about voice and mood, and the write-up should say so.

## Privacy

These are the owner's own recordings. Keep the audio off GitHub; commit only the computed features and the analysis code, if she chooses to.
