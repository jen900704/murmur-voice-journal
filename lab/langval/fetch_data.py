#!/usr/bin/env python3
"""Download the corpora at pinned commits and check SHA-256. Standard library only.

    python3 fetch_data.py            # GoEmotions and CPED into data/raw/
    python3 fetch_data.py --only goemotions

The files are not committed (see .gitignore). A 200-comment sample of GoEmotions is in
data/sample/ for the offline tests.
"""
import argparse
import hashlib
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data", "raw")

SOURCES = {
    "goemotions": {
        "repo": "google-research/google-research",
        "commit": "ee4298226f21649f45c0d0427f7c0f3f682d2a20",
        "license": "Apache-2.0 (LICENSE at the repository root)",
        "files": {
            "goemotions/data/train.tsv": "1c254a142be5c00e80d819b9ae1bbd36d94b2eeb8f4b1271846508d57e57d9c5",
            "goemotions/data/dev.tsv": "575489c079c9de1097062a01738f998590d6b7ead66dd1c9fd1d2ba01fd8bc62",
            "goemotions/data/test.tsv": "0587b2dd8b27b97352adbfc3fb083d46005c8946657fdc2b1ca8b1cc7f1f8be4",
            "goemotions/data/emotions.txt": "45c3ef86782d2a4d7fedcd6d8c111aa0d0e94720689bd164fac94fefb4495a89",
            "LICENSE": "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30",
        },
    },
    "cped": {
        "repo": "scutcyr/CPED",
        "commit": "1e4b81c28a123f22387e06664f37e5dc9322380f",
        "license": "Apache-2.0 (LICENSE at the repository root)",
        "files": {
            "data/CPED/train_split.csv": "7bce6a11f0bf0ac353d28e96f6cfa03ff5e83b95810647abb55d18ff7299e487",
            "data/CPED/valid_split.csv": "f434a04d21640bb38c849f3e9598c2b7b2fbdb49be6a7365b2ae016019bd389b",
            "data/CPED/test_split.csv": "a4bcde678438ba1f95224d8e772e40f1f1df7c72f348796b3fafd421c2443a53",
            "LICENSE": "c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4",
        },
    },
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(name):
    src = SOURCES[name]
    out_dir = os.path.join(RAW, name)
    os.makedirs(out_dir, exist_ok=True)
    ok = True
    for rel, want in src["files"].items():
        dest = os.path.join(out_dir, os.path.basename(rel))
        if not (os.path.exists(dest) and want and sha256(dest) == want):
            url = f"https://raw.githubusercontent.com/{src['repo']}/{src['commit']}/{rel}"
            print("fetching", url)
            with urllib.request.urlopen(url, timeout=120) as r, open(dest + ".part", "wb") as f:
                f.write(r.read())
            os.replace(dest + ".part", dest)
        got = sha256(dest)
        if want is None:
            print(f"  {name}/{os.path.basename(rel)} sha256 {got} (not pinned)")
        elif got != want:
            print(f"  CHECKSUM MISMATCH {dest}: {got} != {want}", file=sys.stderr)
            ok = False
        else:
            print(f"  ok {name}/{os.path.basename(rel)}")
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=sorted(SOURCES))
    a = ap.parse_args()
    names = [a.only] if a.only else sorted(SOURCES)
    good = all([fetch(n) for n in names])
    sys.exit(0 if good else 1)


if __name__ == "__main__":
    main()
