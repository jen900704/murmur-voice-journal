# Mandarin pitch pilot

**Exploratory, not preregistered.** The preregistered validation (`validation-results.md`) used English speech only. Mandarin matters for this app, and its lexical tones make F0 move faster than English intonation does, so this pilot asks one narrow question: does Murmur's pitch tracker still agree with Praat on recorded Mandarin? It is two clips from two speakers, which is enough to catch a gross failure and nothing more.

## Audio

| Clip | Source | Length | SHA-256 |
|---|---|---|---|
| zh_cosyvoice | `asset/zero_shot_prompt.wav` in FunAudioLLM/CosyVoice on GitHub (main branch, fetched 2026-11-24) | 3.5 s | `c7b31d6d…` |
| zh_f5 | `src/f5_tts/infer/examples/basic/basic_ref_zh.wav` in SWivid/F5-TTS on GitHub (main branch, fetched 2026-11-24) | 6.8 s | `96724a11…` |

Both are short recordings of a single speaker used as voice prompts by speech-synthesis projects. Full checksums are in `results/mandarin-pilot.json`. The audio is not redistributed here.

## Method

The same frame-level comparison as Part A of the preregistered validation (`tools/validate_human.py`): Praat autocorrelation pitch (70 to 500 Hz, 10 ms step) against Murmur's frame F0 inside Murmur's speech span. A gross error is a difference of more than 20%; the fine error is the median absolute difference in cents over the other frames. Run with `python3 -I tools/validate_mandarin.py <audio-dir> <out.json>`.

## Results

| Clip | Frames voiced in both | Frames Murmur alone calls voiced | Gross errors | Median fine error | Murmur / Praat on shared frames | Median F0 as reported, Murmur / Praat | Pitch movement (st), Murmur / Praat | Pitch range (st), Murmur / Praat |
|---|---|---|---|---|---|---|---|---|
| zh_cosyvoice | 102 | 39 | 0.0% | 10.8 cents | 1.001 | 278 / 262 Hz | 3.73 / 4.12 | 15.4 / 16.3 |
| zh_f5 | 355 | 21 | 0.3% | 25.6 cents | 1.001 | 256 / 246 Hz | 6.67 / 6.86 | 20.7 / 21.0 |
| Pooled | 457 | 60 | 0.2% | 21.6 cents | | | | |

## What this shows

- The tracker follows Mandarin tones without octave jumps: almost no gross errors, as on English.
- Frame-by-frame agreement is looser than on English (median 22 cents here against 4.6 cents in Part A), still well under a semitone (100 cents).
- On frames both call voiced, Murmur and Praat agree almost exactly (median ratio 1.001). Yet the median F0 Murmur reports is 4 to 6% higher than Praat's. The difference comes from voicing decisions: Murmur counts some frames as voiced that Praat does not (39 of 141 on the first clip), and those frames sit higher. This is the same voicing-coverage issue that missed its threshold in Part A. Because Murmur compares each person with their own past recordings, a steady difference like this does not change whether a day looks higher or lower than usual, but the Hz value should not be compared with Praat's or with other people's.
- Pitch movement and range were within half a semitone of Praat on both clips.

## Limits

Two clips, two speakers, both clean recordings of read or acted speech. No Taiwanese Mandarin speakers are known to be included. A real check needs everyday phone recordings from Taiwanese speakers, ideally the owner's own (see `self-study-protocol.md`).
