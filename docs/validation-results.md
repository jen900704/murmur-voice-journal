# Validation results, Part A: agreement with Praat on human speech

Protocol: [`validation-protocol.md`](validation-protocol.md), committed at `0b46392` before any of these recordings were analyzed. Code under test: feature version 2. Reproduce with:

```bash
tools/fetch-validation-audio.sh validation-audio
python3 -I tools/validate_human.py validation-audio validation-out
```

36 single-speaker clips were analyzed: jfk, lj, ldc, three LibriSpeech readers, and 30 digit sequences (6 speakers × 5). Speakers: 3 female, 9 male. The two-speaker conversation is reported separately. Every clip passed Murmur's speech checks, and none was flagged for clipping or noise.

## Summary against the preregistered thresholds

| Metric | Threshold | Result | Met? |
|---|---|---|---|
| Gross pitch error, pooled frames | at most 5% | 1.8% of 21,791 both-voiced frames (33 of 36 clips individually within 5%) | yes |
| Fine pitch error, pooled | at most 25 cents | median 4.6 cents | yes |
| Voicing disagreement, pooled | at most 10% | 13.8% (Murmur-only voiced 1.0%, Praat-only voiced 12.8%); 4 of 36 clips within 10% | **no** |
| Median F0 per clip | at most 0.5 st | 29 of 36 clips | **no** for 7 clips (largest: lj +1.59 st, theo +1.13 st, jfk +0.91 st) |
| Pitch SD per clip | at most 1 st | 29 of 36 clips | **no** for 7 clips |
| Pitch range per clip | at most 1 st | 24 of 36 clips | **no** for 12 clips |
| Syllable count | at most 15% | 18 of 33 clips with transcripts; median absolute error 14.6% | **no** for 15 clips |
| Pause count, digit sequences | at most 10% | 30 of 30 sequences (39 of 39 pauses in 29, 40 in 1) | yes |
| Voice regularity vs Praat HNR | reported only | Spearman ρ = .89 across 36 clips | (no threshold) |

The `lj` transcript contains "thereunder", which is not in CMUdict. It was counted by hand as 3 syllables, so the true count is 29, not the 26 the script printed, and Murmur's 28 is a 3% undercount.

## What the failures come from

**Voicing.** Murmur calls fewer frames voiced than Praat does. Almost all disagreement is frames Praat calls voiced and Murmur does not (12.8% of frames), not the reverse (1.0%). Murmur's YIN threshold of 0.15 is strict; Praat's voicing threshold of 0.45 is lenient.

**Median pitch.** The clips that miss the 0.5 semitone threshold miss it because of voicing, not pitch estimation. A diagnostic run after the main analysis restricted Praat to frames that both tools call voiced:

| Clip | Murmur median | Praat, both-voiced frames | Praat, all voiced frames | Praat-only frames, median |
|---|---|---|---|---|
| jfk | 249.9 Hz | 250.2 Hz | 237.1 Hz | 220.6 Hz |
| lj | 186.2 Hz | 185.7 Hz | 169.8 Hz | 157.4 Hz |
| fsdd_theo_0 | 138.1 Hz | 138.0 Hz | 130.2 Hz | 119.4 Hz |

On shared frames the two agree within 0.5 Hz. The frames only Praat includes are lower in pitch, consistent with quiet, falling, or creaky phrase endings. So Murmur's median pitch runs higher than Praat's for speakers with long low endings, by up to about 1.6 semitones here. Because Murmur compares each person only with themselves, a constant offset matters less than whether the offset is stable from day to day, which Part B looks at.

**Pitch SD and range.** Two different causes. For `fsdd_jackson` (one speaker with a low, partly creaky voice), Murmur makes octave errors on some sequences (gross pitch error up to 9.9%), which widens its range by up to 18 semitones. For `libri_m2` (a speaker near 80 Hz), Praat's extra voiced frames widen its SD (Praat SD 6.1 st over all its frames, 2.4 st over shared frames; Murmur 2.4 st). Pitch range is the least reliable of the three pitch summaries.

**Syllables.** Errors depend strongly on the speaker. For one digit speaker Murmur overcounts by 12 to 31%; for two others it undercounts by 23 to 56%. On sentences: jfk 23 of 28 (−18%), lj 28 of 29 (−3%), ldc 11 of 13 (−15%). Digits are a hard case for this method (single words with long vowels and few intensity dips), but the spread across speakers means speaking rate and articulation rate should be read as rough, person-specific indices, not as syllable counts.

**Pauses.** On the digit sequences, every inserted gap was found and almost nothing else was counted as a pause.

**Voice regularity.** Across clips it ranks clips much as Praat's HNR does (ρ = .89), though 30 of the 36 clips come from 6 speakers, so the clips are not independent.

**Conversation clip** (two speakers, reported separately): gross pitch error 2.8%, fine error 4.7 cents, voicing disagreement 11.7%. Per-speaker statistics are not meaningful for a mixed clip.

## What this means for the app

- Pitch estimates themselves agree closely with Praat. Median pitch is biased upward for some speakers because of conservative voicing, by a roughly constant amount per speaker.
- Pause detection worked well on clean, read material.
- Speaking rate, articulation rate, and pitch range did not meet their thresholds. They will be marked as lower-confidence in the app and the codebook.
- None of this says anything about how these features relate to mood.

## Post hoc follow-ups

Anything below this line was decided after seeing the results above and is labelled accordingly.

The voicing result suggests trying a more lenient YIN threshold. If that is done, it will be a new feature version, rerun on all of these clips, and reported here as a post hoc change made on the same data, with no held-out test.

### Post hoc: voicing threshold sweep (exploratory, same data)

After seeing the results above, the YIN threshold was varied on the same 36 clips. This is exploration on the evaluation data, with no held-out set, so it cannot justify a change by itself.

| YIN threshold | GPE | Fine error | Voicing disagreement | Median within 0.5 st | SD within 1 st | Range within 1 st | Syllables within 15% |
|---|---|---|---|---|---|---|---|
| 0.15 (preregistered, current) | 1.8% | 4.6 c | 13.8% | 29 / 36 | 29 / 36 | 24 / 36 | 17 / 33 |
| 0.20 | 2.6% | 4.9 c | 11.2% | 31 / 36 | 27 / 36 | 20 / 36 | 19 / 33 |
| 0.25 | 3.9% | 5.3 c | 9.6% | 31 / 36 | 26 / 36 | 21 / 36 | 23 / 33 |
| 0.30 | 5.9% | 5.7 c | 8.5% | 31 / 36 | 22 / 36 | 19 / 36 | 23 / 33 |

A more lenient threshold trades voicing coverage for more pitch errors: 0.25 is the only value that meets both pooled thresholds, but per-clip pitch SD and range get worse, mostly through octave errors on low voices. The feature code stays at the preregistered 0.15 for now. A change would need a separate set of recordings to confirm it, ideally the owner's own phone recordings across days.
