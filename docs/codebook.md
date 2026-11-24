# Codebook for the CSV export

One row per voice entry, in the order recorded. Empty cells mean the value was not available (for example no check-in, or an unvoiced recording). Feature values come from feature version 2 (`js/features.js`). Rows with a different `featureVersion` were computed by different code and should not be pooled.

Confidence summarizes [`validation-results.md`](validation-results.md) (agreement with Praat on 36 human clips) and [`robustness-results.md`](robustness-results.md) (sensitivity to recording conditions). "Condition-sensitive" means it should be compared only between recordings made in similar, quiet settings.

| Column | Meaning | Unit | Confidence |
|---|---|---|---|
| `id` | Random identifier for the entry | | |
| `datetime` | When it was saved, ISO 8601 in UTC | | |
| `demo` | 1 for built-in synthetic demo entries, else 0. Exclude demo rows from any analysis. | | |
| `mood` | Self-rated mood, 1 (very low) to 7 (very good); empty if skipped | | |
| `energy` | Self-rated energy, 1 (exhausted) to 7 (full of energy); empty if skipped | | |
| `note` | The optional one-line note. Text starting with `=`, `+`, `-`, or `@` is prefixed with `'` so spreadsheets do not run it as a formula. | | |
| `prompt` | The prompt shown when recording | | |
| `f0MedianHz` | Median fundamental frequency over voiced frames (YIN) | Hz | Higher. Agrees with Praat on shared frames; can run high by a stable amount for speakers with long, low phrase endings. Robust to codecs, gain, and automatic gain control. |
| `f0SdSt` | Standard deviation of F0 in semitones | st | Medium. Sensitive to telephone band-limiting and octave errors on low voices. |
| `f0RangeSt` | 95th minus 5th percentile of F0 | st | Lower. Inflated by a few pitch errors. |
| `speechRate` | Syllable nuclei per second, first to last speech frame | 1/s | Lower. Syllable estimates vary by speaker; condition-sensitive. |
| `articulationRate` | Syllable nuclei per second of span minus pauses | 1/s | Lower. As above. |
| `pauseRatio` | Pause time divided by the span from first to last speech frame (0 to 1) | fraction | Medium. Accurate on clean speech; condition-sensitive. |
| `meanPauseS` | Mean length of pauses of 250 ms or more | s | Medium. As above. |
| `intensitySdDb` | Standard deviation of frame intensity over speech frames | dB | Lower. Sensitive to noise and automatic gain control. |
| `periodicityDb` | Median of 10·log10((1 − a)/a), a = YIN aperiodicity, over all speech frames | dB | Medium. Spearman ρ = .89 with Praat HNR across clips; lowered by noise and reverberation. |
| `durationS` | Length of the recording | s | |
| `speechS` | Time classified as speech | s | |
| `spanS` | Time from first to last speech frame | s | |
| `pauseCount` | Number of pauses of 250 ms or more inside the span | count | |
| `syllables` | Number of syllable nuclei detected | count | Lower (see speechRate). |
| `voicedFraction` | Voiced frames divided by speech frames | fraction | |
| `clipFraction` | Share of samples at or above 0.99 full scale | fraction | |
| `snrDb` | Median speech-frame energy minus the noise floor (5th percentile of frame energy). Runs 2 to 4 dB above the true SNR in testing. | dB | |
| `qualityFlags` | `clipping` (over 1% clipped samples) and/or `noisy` (snrDb under 15 dB, when at least 10% of the frames are not speech). Flagged entries are kept but left out of baselines, trends, and correlations in the app. | | |
| `mimeType` | Container and codec the browser recorded | | |
| `autoGainControl`, `noiseSuppression`, `echoCancellation` | Whether the browser reported these as on; the app asks for them off, and browsers do not always comply | true/false/empty | |
| `featureVersion` | Version of the feature code | | |

Theory-lens exercises and bedtime-ritual notes are not part of this export.
