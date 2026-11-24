# Validation protocol (written before any analysis)

This protocol was committed before Murmur was run on any of the recordings listed below. The git history of this file is the timestamp. Every result will be reported, including results that miss a threshold. If anything in the feature code is changed after seeing results, the change gets a new feature version, all analyses are rerun, and the results are labelled post hoc. With this few recordings there is no separate development and test set, so any such change will be stated as having been made on the same data.

Code under test: commit `feb61ed`, feature version 2 (`js/features.js`).

## What this can and cannot show

It can show how closely Murmur agrees with Praat on recorded human speech, how well it counts syllables and pauses against transcripts, and how much each feature moves under recording conditions that a phone or browser might introduce.

It cannot show accuracy in an absolute sense: Praat is a reference tool, not ground truth, and no laryngograph signal is available. Syllable counts come from the CMU Pronouncing Dictionary applied to transcripts, not from hand annotation. Nothing here bears on whether any feature relates to mood or mental health, which remains untested. The recordings are mostly read English; results may not carry over to spontaneous speech, Mandarin, phones, or ordinary rooms.

## Recordings

Audio is not committed to this repository. `tools/fetch-validation-audio.sh` fetches it from the pinned commits below.

| ID | Source (repository @ commit) | Speaker | Style | Length | License | Transcript |
|---|---|---|---|---|---|---|
| jfk | openai/whisper `tests/jfk.flac` @ 86098128 | male | 1961 broadcast, read | 11 s | public domain (US government work) | yes |
| lj | speechbrain/speechbrain `tests/samples/TTS/LJ050-0131.wav` @ c0241278 | female | audiobook | 7.7 s | public domain (LJ Speech) | yes, from NVIDIA/tacotron2 file lists |
| ldc | mozilla/DeepSpeech `data/smoke_test/LDC93S1.wav` @ 6913ae81 | female | read sentence | 2.9 s | LDC free sample | yes |
| libri_f | librosa/data `audio/198-209-0000.ogg` @ 5285c94e | female (Heather Barnett) | audiobook | 13.9 s | CC BY 4.0 (LibriSpeech) | no |
| libri_m1 | librosa/data `audio/3436-172162-0000.ogg` @ 5285c94e | male (Anders Lankford) | audiobook | 16.7 s | CC BY 4.0 (LibriSpeech) | no |
| libri_m2 | librosa/data `audio/5703-47212-0000.ogg` @ 5285c94e | male (Garth Comira) | audiobook | 14.8 s | CC BY 4.0 (LibriSpeech) | no |
| conv | pyannote/pyannote-audio `tutorials/assets/sample.wav` @ c2b12c5a | two speakers | spontaneous conversation | 30 s | repository MIT; recording provenance not documented | no |
| fsdd_* | Jakobovski/free-spoken-digit-dataset @ 26eb9aaf | 6 males, 4 non-US accents | isolated digits | see below | CC BY-SA 4.0 | yes (digit labels) |

The `ldc` clip is under 5 s, shorter than the app accepts, so it is used for frame-level pitch agreement only. The `conv` clip mixes two voices, so its per-clip pitch summaries are reported separately and not counted against the thresholds.

**Digit sequences.** For each of the 6 FSDD speakers, 5 sequences are built. Sequence s (s = 0 to 4) uses, for each digit 0 to 9, the four recordings with index 4s, 4s + 1, 4s + 2, and 4s + 3, ordered by digit and then by index, joined with 400 ms of digital silence. Each sequence therefore has 40 spoken digits and 39 inserted gaps. FSDD audio is 8 kHz and is upsampled to 16 kHz.

## Processing

Every file is decoded with FFmpeg to 16 kHz mono 32-bit float. Murmur's `analyze()` and Praat (Parselmouth) both run on exactly these samples.

Praat settings: `to_pitch_ac(time_step=0.01, pitch_floor=70, pitch_ceiling=500)` with every other parameter at its default (very accurate off, 15 candidates, silence threshold 0.03, voicing threshold 0.45, octave cost 0.01, octave-jump cost 0.35, voiced/unvoiced cost 0.14). Praat HNR: `to_harmonicity_cc(time_step=0.01, minimum_pitch=70)`, mean over frames above −199 dB.

Frame alignment: Murmur frame f is placed at 0.010 f + 0.010 s, the centre of its 20 ms pitch window. Each Murmur frame is matched to the nearest Praat frame; pairs more than 5 ms apart are dropped. For Murmur, "voiced" means voiced after all of its post-processing (isolated-frame removal and octave filter).

## Part A: agreement with Praat and with transcripts

| Metric | Definition | Threshold |
|---|---|---|
| Gross pitch error (GPE) | Share of frames voiced in both where the two F0 values differ by more than 20% | at most 5% |
| Fine pitch error | Median absolute difference in cents over both-voiced frames without gross error | at most 25 cents |
| Voicing disagreement | Share of all frames inside Murmur's speech span where one tool says voiced and the other does not; Murmur-only and Praat-only reported separately | at most 10% |
| Median F0 per clip | Murmur's `f0MedianHz` against the median of Praat's voiced frames, in semitones | at most 0.5 st |
| Pitch SD and range per clip | `f0SdSt` and `f0RangeSt` against the same statistics computed from Praat's voiced frames | at most 1 st |
| Syllable count | Relative error of `syllables` against the CMUdict syllable count of the transcript (first pronunciation; words missing from CMUdict counted by hand and listed) | at most 15% |
| Pause count (digit sequences) | Detected pauses against the 39 inserted gaps | at most 10% relative error |

GPE, fine error, and voicing disagreement are judged on frames pooled across the single-speaker clips (jfk, lj, ldc, libri_*, and all fsdd sequences), and also reported per clip. Per-clip summaries are judged clip by clip and reported as the number of clips within threshold. Voice regularity (`periodicityDb`) is compared with Praat HNR across clips by Spearman correlation, reported without a threshold because the number of clips is small.

## Part B: robustness to recording conditions

Clips: jfk, lj, libri_f, libri_m1, libri_m2, and the first sequence of each FSDD speaker.

Conditions, each applied to the 16 kHz signal (or to the original file for codecs):

1. Codecs through FFmpeg: Opus at 24, 64, and 128 kbit/s; AAC at 64 and 128 kbit/s. These are FFmpeg's encoders, not Apple's or Chrome's.
2. Chrome's own recording path: the clip played into Chrome's fake microphone, recorded by the app's `MediaRecorder` code, decoded by the browser, analyzed by the app (jfk, lj, libri_* only).
3. Gain: −12, −6, +6 dB (with clipping allowed, which is what a phone would do), and +12 dB.
4. Simulated automatic gain control: FFmpeg `dynaudnorm` with default settings.
5. Additive noise: white noise and speech-shaped noise (noise filtered to the long-term spectrum of the clip) at 30, 20, 15, and 10 dB SNR.
6. Simulated reverberation: exponentially decaying noise impulse responses with RT60 of 0.3 s and 0.6 s, labelled as simulated.
7. Band-limiting: 300 Hz to 3.4 kHz band-pass (narrowband telephone).

**Reference spread.** There are no repeated recordings of one person across days. As a stand-in, each feature's spread is the median, over the 6 FSDD speakers, of the scaled MAD (MAD × 1.4826) across that speaker's 5 digit sequences. This spread comes from one session per speaker, so it probably understates day-to-day variation, which makes the ratios below pessimistic.

**Reporting.** For each feature and condition: the median signed shift and median absolute shift in the feature's own units, and the median absolute shift divided by the reference spread. Bands fixed in advance:

- under 0.25: robust to this condition
- 0.25 to 0.5: use with caution
- over 0.5: sensitive to this condition

Also reported: the share of clips where the condition alone moves a feature by more than 3.02 reference spreads (the app's cut-off at 10 earlier recordings), that is, where the condition alone would produce a "higher or lower than usual" message; the share of clips the app would flag as noisy or clipped; and Murmur's SNR estimate against the true added SNR.

**Split-half reliability.** For clips of at least 14 s (libri_*), each feature is computed on the first and second halves separately. The absolute difference divided by the reference spread is reported, as an indication of whether 7 s of speech is enough for each feature.

## How results will be used

Features that fail Part A thresholds, or that fall in the "sensitive" band for common conditions (codecs at 64 kbit/s and above, ±6 dB gain, simulated automatic gain control, 20 dB SNR), will be marked as low-confidence in the app and README. Results go in `docs/validation-results.md`, with the scripts that produce them in `tools/`.
