#!/usr/bin/env python3
"""Runs the preregistered study end to end and writes results/.

    python3 fetch_data.py
    python3 run_analysis.py                 # English (GoEmotions) and Chinese (CPED)
    python3 run_analysis.py --only en --B 2000

Needs node (the app's scorer is run through it), numpy and scipy; the Chinese part also needs
opencc-python-reimplemented. Only the train split of each corpus is scored (PREREG.md section 2).
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from langval import hypotheses as H  # noqa: E402
from langval import tables  # noqa: E402
from langval.analysis import label_matrix, list_word_table, missing_word_table, run_confirmatory  # noqa: E402
from langval.data import load_cped, load_goemotions, score_cached, to_arrays  # noqa: E402

RAW = os.path.join(HERE, "data", "raw")
SCORED = os.path.join(HERE, "data", "scored")
RESULTS = os.path.join(HERE, "results")
APP = os.path.dirname(os.path.dirname(HERE))


def sha(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def provenance(meta):
    files = ["js/langlab/score.js", "js/langlab/lexicon-en.js", "js/langlab/lexicon-zh.js", "js/langlab/tokenize.js",
             "js/langlab/vader.js", "data/lexica/vader.json"]
    try:
        commit = subprocess.run(["git", "-C", APP, "rev-parse", "HEAD"], stdout=subprocess.PIPE, check=True).stdout.decode().strip()
    except Exception:
        commit = None
    return {"app_commit": commit, "scorer": meta, "sha256": {f: sha(os.path.join(APP, f)) for f in files},
            "prereg_sha256": {f: sha(os.path.join(HERE, f)) for f in ["PREREG.md", "langval/hypotheses.py", "score_texts.mjs"]},
            "run_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}


def study(name, lang, rows, confirm, valence, explore, family, neutral, labels, use_vader, B, extra=None):
    meta, scored = score_cached(rows, os.path.join(SCORED, name + ".jsonl"))
    arr = to_arrays(rows, scored, lang, meta["categories"])
    t = time.time()
    res = run_confirmatory(arr, confirm, valence, explore, family, neutral, use_vader, B=B)
    print(f"{name}: bootstrap done in {time.time() - t:.0f}s", file=sys.stderr)
    res.update({"corpus": name, "lang": lang, "n_input": arr["n_input"], "n_other_language": arr["n_other_language"],
                "n_zero_units": arr["n_zero_units"], "mean_units": float(arr["words"].mean()),
                "median_units": float(sorted(arr["words"])[len(arr["words"]) // 2]), "provenance": provenance(meta)})
    scores = sorted({h["score"] for h in confirm + explore} | {"tone"})
    res["label_matrix"] = label_matrix(arr, scores, labels, neutral, use_vader)
    res["label_n"] = {lab: sum(1 for r in arr["rows"] if lab in r["labels"]) for lab in labels}
    res["words"] = {h["id"]: {"list_words": list_word_table(arr, scored, h, neutral),
                              "missing": missing_word_table(arr, h, lang)} for h in confirm}
    if extra:
        res.update(extra(arr, meta))
    os.makedirs(RESULTS, exist_ok=True)
    with open(os.path.join(RESULTS, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    with open(os.path.join(RESULTS, name + "_tables.md"), "w", encoding="utf-8") as f:
        f.write(tables.render(res))
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["en", "zh"])
    ap.add_argument("--B", type=int, default=H.B_BOOT)
    a = ap.parse_args()

    if a.only in (None, "en"):
        ge = os.path.join(RAW, "goemotions")
        rows = load_goemotions(os.path.join(ge, "train.tsv"), os.path.join(ge, "emotions.txt"), prefix="ge-train")
        labels = [x.strip() for x in open(os.path.join(ge, "emotions.txt"), encoding="utf-8") if x.strip()]
        study("en_goemotions_train", "en", rows, H.EN_CONFIRMATORY, H.EN_VALENCE, H.EN_EXPLORATORY, H.EN_FAMILY,
              H.GE_NEUTRAL, labels, True, a.B)

    if a.only in (None, "zh"):
        import opencc  # opencc-python-reimplemented

        cc = opencc.OpenCC("s2tw")
        path = os.path.join(RAW, "cped", "train_split.csv")
        rows = load_cped(path, prefix="cped-train", convert=cc.convert)
        raw_rows = load_cped(path, prefix="cped-train-raw")
        labels = H.CPED_POSITIVE + H.CPED_NEGATIVE + ["astonished", H.CPED_NEUTRAL]

        def unconverted(arr, meta):
            # coverage only: how much the Traditional lists find in the original Simplified text
            _, sc = score_cached(raw_rows, os.path.join(SCORED, "zh_cped_train_unconverted.jsonl"), hits=False)
            n = len(raw_rows)
            out = {}
            for h in H.ZH_CONFIRMATORY:
                out[h["id"]] = sum(1 for r in raw_rows if sc[r["id"]]["c"].get(h["score"], 0) > 0) / n
            conv = {h["id"]: float((arr["counts"][h["score"]] > 0).mean()) for h in H.ZH_CONFIRMATORY}
            return {"unconverted_hit_share": out, "converted_hit_share": conv,
                    "unconverted_lang_zh": sum(1 for r in raw_rows if sc[r["id"]]["lang"] == "zh") / n}

        study("zh_cped_train", "zh", rows, H.ZH_CONFIRMATORY, H.ZH_VALENCE, [], H.ZH_FAMILY, H.CPED_NEUTRAL, labels, False,
              a.B, extra=unconverted)


if __name__ == "__main__":
    main()
