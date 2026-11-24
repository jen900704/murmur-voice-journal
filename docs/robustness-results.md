# Validation results, Part B: robustness to recording conditions

Protocol: [`validation-protocol.md`](validation-protocol.md), Part B, committed before analysis. Code: feature version 2. Reproduce with `python3 -I tools/robustness.py validation-audio validation-out` after running Part A. Full numbers: [`results/robustness-v2.json`](results/robustness-v2.json).

Eleven clips (jfk, lj, three LibriSpeech readers, and the first digit sequence of each of six speakers) were analyzed clean and under 21 conditions. The Chrome recording path (condition 2 in the protocol) was not run in this pass; it is listed under "not done" below.

## A problem with the preregistered reference spread

The protocol used the spread across each digit speaker's five sequences as the yardstick. For pitch and voice-quality features this works. For the timing features it does not: the sequences were built with identical 400 ms gaps, so pause ratio, average pause, and speaking rate barely vary between them (average pause did not vary at all). Dividing by an almost-zero spread makes every shift look enormous. The robust/caution/sensitive bands below are therefore reported only for pitch, loudness movement, and voice regularity; timing features are reported in their own units.

## Conditions most likely on a real phone

Median shift from the clean recording, in each feature's own units (typical clean values in brackets).

| Condition | Median pitch (138 Hz) | Pitch movement (2.8 st) | Pitch range (7.1 st) | Loudness movement (8.4 dB) | Voice regularity (7.5 dB) | Pause time (47%) | Articulation rate (3.2 /s) |
|---|---|---|---|---|---|---|---|
| Opus 64 kbit/s | 0 | 0 | 0 | 0 | 0 | 0 | −0.01 |
| AAC 128 kbit/s | −0.1 Hz | 0 | 0 | +0.01 | 0 | 0 | 0 |
| Gain −6 dB | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Gain +6 dB | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Simulated automatic gain control | 0 | 0 | 0 | 0 (but see bands) | 0 | 0 | 0 |
| White noise, 20 dB SNR | +0.6 Hz | 0 | +0.02 | −2.8 | +0.9 | +8.5 points | +0.64 |
| Speech-shaped noise, 20 dB SNR | +0.6 Hz | −0.02 | 0 | −2.7 | +0.9 | +7.3 points | +0.56 |

Bands (median absolute shift divided by the reference spread; under 0.25 robust, 0.25 to 0.5 caution, over 0.5 sensitive), for the features where the reference is meaningful:

| Feature | Codecs ≥ 64 kbit/s | Gain ±6 dB | Automatic gain control | Noise at 20 dB SNR |
|---|---|---|---|---|
| Median pitch | robust | robust | robust | caution |
| Pitch movement | robust | robust | robust | robust |
| Pitch range | robust | robust | robust | robust |
| Loudness movement | robust | robust | **sensitive** (0.61) | **sensitive** |
| Voice regularity | robust | robust | robust | **sensitive** |

## Harsher conditions

- **Opus at 24 kbit/s** moved loudness movement (0.81) and articulation rate; everything else stayed put.
- **+12 dB gain** clipped 4 of 11 clips, and the app flagged all 4 as clipped.
- **Noise.** Pitch held up to 15 dB SNR (median shift under 1 reference spread) and drifted at 10 dB (+3.9 Hz). Loudness movement, voice regularity, pause time, and articulation rate changed noticeably even at 30 dB.
- **Reverberation** (simulated, RT60 0.3 and 0.6 s) shifted most features, and 3 and 5 of 11 clips were rejected as "no speech".
- **Telephone band-limiting** (300 to 3400 Hz) badly distorted pitch movement and range (range +11.5 semitones, from octave errors once the fundamental is filtered out) and lowered voice regularity.

## The app's own checks

- **SNR estimate against true added SNR.** Median estimate 29.8, 21.7, 17.8, and 13.8 dB for true 30, 20, 15, and 10 dB (white noise). It runs 2 to 4 dB high, so the 15 dB "noisy" flag effectively fires around 12 dB true SNR: 1 of 11 clips at 15 dB, 10 of 11 at 10 dB.
- **False "higher or lower than usual" messages.** With codecs, ±6 dB gain, or automatic gain control alone, the share of clips where a condition by itself would cross the app's cut-off was 0% for every pitch feature and voice regularity. Simulated automatic gain control would trip loudness movement for 18% of clips. Noise at 20 dB would trip loudness movement for every clip and voice regularity for 27%.

## Split-half reliability

Each LibriSpeech clip (14 to 17 s) was split into halves of about 7 s. Median pitch differed between halves by about 1.8 reference spreads (roughly 4 Hz), pitch movement by 0.33, pitch range by 0.46, and voice regularity by 1.16. Seven seconds is too short for a stable median pitch; the app's 30-second suggestion is reasonable, and 5-second recordings should be treated as rough.

## What changes in the app

- Each feature now carries a plain-language confidence note in the app and the codebook, based on Parts A and B together.
- Loudness movement, voice regularity, and the timing features are described as comparable only between recordings made in similar, quiet conditions.
- The noise flag threshold is not changed: changing it based on these results would be a post hoc decision, and the right threshold depends on real phone recordings.

## Not done

- The Chrome recording path (fake microphone into the app's MediaRecorder and browser decoding).
- Repeated recordings of real people across days, which is the denominator that actually matters for "higher or lower than usual". Until that exists, every ratio above uses a proxy.
