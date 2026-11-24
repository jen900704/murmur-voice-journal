# Pre-fix engine snapshot

The five engine files exactly as they were when the study in `RESULTS.md` was run (their
SHA-256 values are the ones in `PREREG.lock`). `run_retest.py` checks those hashes and then
scores the held-back split with this copy, so the "before" column of `RETEST.md` can be
reproduced after the app's own files have changed. Not used by the app. Do not edit.
