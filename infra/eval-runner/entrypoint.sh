#!/bin/sh
# Runs the evaluation command, then copies the output folder to S3.
# Environment (all set by the task definition):
#   EVAL_OUTPUT_DIR       folder the harness writes to (default lab/eval/runs)
#   EVAL_TIMEOUT_SECONDS  hard stop for the run, so a stuck job cannot keep spending
#   RESULTS_BUCKET        S3 bucket for results; if empty, nothing is uploaded
#   RESULTS_PREFIX        key prefix inside the bucket (default runs)
set -u

OUT_DIR="${EVAL_OUTPUT_DIR:-lab/eval/runs}"
LIMIT="${EVAL_TIMEOUT_SECONDS:-3600}"

timeout "$LIMIT" "$@"
status=$?
if [ "$status" -eq 124 ]; then
  echo "eval-runner: stopped after ${LIMIT}s" >&2
fi

if [ -n "${RESULTS_BUCKET:-}" ]; then
  python3 /usr/local/bin/upload_results.py "$OUT_DIR" "$RESULTS_BUCKET" "${RESULTS_PREFIX:-runs}" "$status" || {
    echo "eval-runner: upload failed" >&2
    [ "$status" -eq 0 ] && status=70
  }
fi

exit "$status"
