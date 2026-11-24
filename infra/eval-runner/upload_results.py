"""Copies an evaluation output folder to S3 under <prefix>/<UTC timestamp>/.

Usage: upload_results.py OUT_DIR BUCKET PREFIX EXIT_STATUS
Only files under OUT_DIR are read. A small status.json records the exit status of the run.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import boto3


def main() -> int:
    out_dir, bucket, prefix, status = Path(sys.argv[1]), sys.argv[2], sys.argv[3].strip("/"), int(sys.argv[4])
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
    base = f"{prefix}/{stamp}"
    s3 = boto3.client("s3")
    count = 0
    if out_dir.is_dir():
        for path in sorted(p for p in out_dir.rglob("*") if p.is_file() and not p.is_symlink()):
            s3.upload_file(str(path), bucket, f"{base}/{path.relative_to(out_dir).as_posix()}")
            count += 1
    body = json.dumps({"exit_status": status, "files": count, "finished_at": stamp}).encode()
    s3.put_object(Bucket=bucket, Key=f"{base}/status.json", Body=body, ContentType="application/json")
    print(f"eval-runner: uploaded {count} files to s3://{bucket}/{base}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
