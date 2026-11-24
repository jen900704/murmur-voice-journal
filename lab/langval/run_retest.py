#!/usr/bin/env python3
"""Post-fix retest on held-back data. Not part of the preregistered study; see RETEST.md.

Scores one held-back split of each corpus twice, with the engine as it was when RESULTS.md was
written (baseline_engine/, hashes checked against PREREG.lock) and with the engine as it is now,
and runs the preregistered analysis (langval/analysis.py, langval/hypotheses.py, unchanged) on
both. Writes results/retest_<corpus>.json and results/retest_tables.md.

    python3 lab/langval/run_retest.py               # GoEmotions dev.tsv and CPED valid_split.csv
    python3 lab/langval/run_retest.py --only en --B 2000

GoEmotions test.tsv and CPED test_split.csv are not read: they stay held back.
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from collections import Counter

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from langval import hypotheses as H  # noqa: E402
from langval.analysis import rate, run_confirmatory  # noqa: E402
from langval.data import has_any, load_cped, load_goemotions, only, to_arrays  # noqa: E402
from langval.metrics import Bootstrap, fmt, interval, pct  # noqa: E402

RAW = os.path.join(HERE, "data", "raw")
RESULTS = os.path.join(HERE, "results")
APP = os.path.dirname(os.path.dirname(HERE))
BASE = os.path.join(HERE, "baseline_engine")
ENGINE_FILES = ["score.js", "tokenize.js", "lexicon-en.js", "lexicon-zh.js", "vader.js"]


def sha(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def locked_hashes():
    out = {}
    with open(os.path.join(HERE, "PREREG.lock"), encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            h, name = line.split()
            out[os.path.basename(name)] = h
    return out


def baseline_tree(tmp):
    """A copy of the app tree as far as score_texts.mjs needs it, with the pre-fix engine files."""
    lock = locked_hashes()
    for f in ENGINE_FILES:
        got = sha(os.path.join(BASE, "js", "langlab", f))
        if got != lock[f]:
            raise SystemExit(f"baseline_engine/{f} does not match PREREG.lock")
    for f in ["score_texts.mjs", "PREREG.md", "hypotheses.py"]:
        path = os.path.join(HERE, "langval" if f == "hypotheses.py" else "", f)
        if sha(path) != lock[f]:
            raise SystemExit(f"{f} has changed since PREREG.lock")
    os.makedirs(os.path.join(tmp, "js", "langlab"))
    os.makedirs(os.path.join(tmp, "data", "lexica"))
    os.makedirs(os.path.join(tmp, "lab", "langval"))
    for f in ENGINE_FILES:
        shutil.copy(os.path.join(BASE, "js", "langlab", f), os.path.join(tmp, "js", "langlab", f))
    shutil.copy(os.path.join(APP, "data", "lexica", "vader.json"), os.path.join(tmp, "data", "lexica", "vader.json"))
    shutil.copy(os.path.join(HERE, "score_texts.mjs"), os.path.join(tmp, "lab", "langval", "score_texts.mjs"))
    return os.path.join(tmp, "lab", "langval", "score_texts.mjs")


def score(rows, scorer):
    payload = "".join(json.dumps({"id": r["id"], "text": r["text"]}, ensure_ascii=False) + "\n" for r in rows)
    p = subprocess.run(["node", scorer, "--hits"], input=payload.encode("utf-8"), stdout=subprocess.PIPE, check=True)
    meta, out = None, {}
    for line in p.stdout.decode("utf-8").splitlines():
        o = json.loads(line)
        if "_meta" in o:
            meta = o["_meta"]
        else:
            out[o["id"]] = o
    return meta, out


def surface_changes(rows, old, new, cat_ids):
    """Which matched surface forms were counted fewer or more times after the fix, per category."""
    out = {}
    for c in cat_ids:
        a, b = Counter(), Counter()
        for r in rows:
            for w, ids in old[r["id"]].get("h", []):
                if c in ids:
                    a[w] += 1
            for w, ids in new[r["id"]].get("h", []):
                if c in ids:
                    b[w] += 1
        gone = sorted(((w, a[w] - b[w]) for w in a if a[w] > b[w]), key=lambda x: -x[1])
        came = sorted(((w, b[w] - a[w]) for w in b if b[w] > a[w]), key=lambda x: -x[1])
        out[c] = {"hits_old": sum(a.values()), "hits_new": sum(b.values()), "fewer": gone[:25], "more": came[:25]}
    return out


def paired(arr_old, arr_new, confirm, valence, neutral_label, B, seed):
    """New minus old AUC with a paired bootstrap. Needs the same texts in both arrays."""
    if [r["id"] for r in arr_old["rows"]] != [r["id"] for r in arr_new["rows"]]:
        return None
    rows = arr_old["rows"]
    neutral = only(rows, neutral_label)
    bs = Bootstrap(arr_old["clusters"], B=B, seed=seed)
    point = {}
    for h in confirm:
        t = has_any(rows, h["target"])
        point[h["id"]] = bs.add_auc(h["id"] + ":new", rate(arr_new, h["score"]), t, neutral) - bs.add_auc(h["id"] + ":old", rate(arr_old, h["score"]), t, neutral)
    for h in valence:
        p, n = has_any(rows, h["positive"]), has_any(rows, h["negative"])
        pos, neg = p & ~n, n & ~p
        point[h["id"]] = bs.add_auc(h["id"] + ":new", rate(arr_new, h["score"]), pos, neg) - bs.add_auc(h["id"] + ":old", rate(arr_old, h["score"]), pos, neg)
    boot = bs.run()
    return {k: {"diff": v, "ci95": list(interval(boot[k + ":new"] - boot[k + ":old"], 0.95))} for k, v in point.items()}


def retest(name, lang, rows, confirm, valence, family, neutral, use_vader, B, scorers):
    out = {"corpus": name, "lang": lang, "n_input": len(rows), "B": B, "seed": H.SEED, "run_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    arrs, scored = {}, {}
    for which, scorer in scorers.items():
        meta, sc = score(rows, scorer)
        arr = to_arrays(rows, sc, lang, meta["categories"])
        res = run_confirmatory(arr, confirm, valence, [], family, neutral, use_vader, B=B)
        res["scorer"] = meta
        res["n_other_language"] = arr["n_other_language"]
        res["n_zero_units"] = arr["n_zero_units"]
        out[which] = res
        arrs[which], scored[which] = arr, sc
        print(f"{name} {which}: n={res['n_analysed']}", file=sys.stderr)
    out["paired_new_minus_old"] = paired(arrs["old"], arrs["new"], confirm, valence, neutral, B, H.SEED)
    out["surfaces"] = surface_changes(rows, scored["old"], scored["new"], sorted({h["score"] for h in confirm}))
    out["texts_changed"] = sum(1 for r in rows if scored["old"][r["id"]]["c"] != scored["new"][r["id"]]["c"])
    return out, scored


def table(res):
    lines = []
    old = {r["id"]: r for r in res["old"]["confirmatory"] + res["old"]["valence"]}
    new = {r["id"]: r for r in res["new"]["confirmatory"] + res["new"]["valence"]}
    pr = res["paired_new_minus_old"] or {}
    lines.append(f"### {res['corpus']} ({res['old']['n_analysed']} texts before, {res['new']['n_analysed']} after; "
                 f"{res['texts_changed']} texts with a changed count in any category)\n")
    lines.append("| Category | n target | AUC before (adjusted) | AUC after (adjusted) | After minus before (95%) | AUC vs other emotional, before / after | r before / after | Target texts with a hit, before / after | Neutral texts with a hit, before / after | Hit precision, before / after | Verdict before | Verdict after |")
    lines.append("|---|---|---|---|---|---|---|---|---|---|---|---|")
    for k in old:
        o, n = old[k], new[k]
        d = pr.get(k)
        sg = lambda v: "0" if abs(v) < 0.0005 else f"{v:+.3f}".replace("0.", ".")
        dtxt = f"{sg(d['diff'])} ({sg(d['ci95'][0])} to {sg(d['ci95'][1])})" if d else ""
        a = lambda r: f"{fmt(r['auc'])} ({fmt(r['auc_ci_adj'][0])} to {fmt(r['auc_ci_adj'][1])})"
        if "hit_target" in o:
            cells = [f"{fmt(o['auc_specific'])} / {fmt(n['auc_specific'])}", f"{fmt(o['r'])} / {fmt(n['r'])}",
                     f"{pct(o['hit_target']['share'])} / {pct(n['hit_target']['share'])}",
                     f"{pct(o['hit_neutral']['share'])} / {pct(n['hit_neutral']['share'])}",
                     f"{pct(o['precision']['share'])} / {pct(n['precision']['share'])}"]
            nt = o["n_target"]
        else:
            cells = ["", f"{fmt(o['r'])} / {fmt(n['r'])}", "", "", ""]
            nt = f"{o['n_positive']} pos, {o['n_negative']} neg"
        lines.append(f"| `{k}` | {nt} | {a(o)} | {a(n)} | {dtxt} | " + " | ".join(cells) + f" | {o['verdict']} | {n['verdict']} |")
    lines.append("")
    lines.append("Matched forms counted fewer or more times after the fix (form, change in count):\n")
    for c, s in res["surfaces"].items():
        fewer = ", ".join(f"{w} -{k}" for w, k in s["fewer"][:12]) or "none"
        more = ", ".join(f"{w} +{k}" for w, k in s["more"][:12]) or "none"
        lines.append(f"- `{c}`: {s['hits_old']} hits before, {s['hits_new']} after. Fewer: {fewer}. More: {more}.")
    lines.append("")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["en", "zh"])
    ap.add_argument("--B", type=int, default=H.B_BOOT)
    a = ap.parse_args()
    os.makedirs(RESULTS, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="langval-baseline-")
    try:
        scorers = {"old": baseline_tree(tmp), "new": os.path.join(HERE, "score_texts.mjs")}
        prov = {"baseline_sha256": {f: sha(os.path.join(BASE, "js", "langlab", f)) for f in ENGINE_FILES},
                "current_sha256": {f: sha(os.path.join(APP, "js", "langlab", f)) for f in ENGINE_FILES + ["zh-s2t.js"]}}
        parts = []
        if a.only in (None, "en"):
            ge = os.path.join(RAW, "goemotions")
            rows = load_goemotions(os.path.join(ge, "dev.tsv"), os.path.join(ge, "emotions.txt"), prefix="ge-dev")
            res, _ = retest("en_goemotions_dev", "en", rows, H.EN_CONFIRMATORY, H.EN_VALENCE, H.EN_FAMILY, H.GE_NEUTRAL, True, a.B, scorers)
            res["provenance"] = prov
            with open(os.path.join(RESULTS, "retest_en_goemotions_dev.json"), "w", encoding="utf-8") as f:
                json.dump(res, f, ensure_ascii=False, indent=1)
            parts.append(table(res))
        if a.only in (None, "zh"):
            import opencc  # opencc-python-reimplemented

            cc = opencc.OpenCC("s2tw")
            path = os.path.join(RAW, "cped", "valid_split.csv")
            rows = load_cped(path, prefix="cped-valid", convert=cc.convert)
            res, conv_scored = retest("zh_cped_valid", "zh", rows, H.ZH_CONFIRMATORY, H.ZH_VALENCE, H.ZH_FAMILY, H.CPED_NEUTRAL, False, a.B, scorers)
            # the same utterances as written (Simplified), without OpenCC: what the app's own map does
            raw_rows = load_cped(path, prefix="cped-valid", convert=None)
            raw, raw_scored = retest("zh_cped_valid_unconverted", "zh", raw_rows, H.ZH_CONFIRMATORY, H.ZH_VALENCE, H.ZH_FAMILY,
                                     H.CPED_NEUTRAL, False, a.B, scorers)
            n = len(raw_rows)
            cov = {}
            for h in H.ZH_CONFIRMATORY:
                c = h["score"]
                share = lambda sc: sum(1 for r in raw_rows if sc[r["id"]]["c"].get(c, 0) > 0) / n
                cov[h["id"]] = {"simplified_old": share(raw_scored["old"]), "simplified_new": share(raw_scored["new"]),
                                "opencc_old": share(conv_scored["old"]), "opencc_new": share(conv_scored["new"])}
            res["unconverted"] = raw
            res["unconverted_hit_share"] = cov
            res["provenance"] = prov
            with open(os.path.join(RESULTS, "retest_zh_cped_valid.json"), "w", encoding="utf-8") as f:
                json.dump(res, f, ensure_ascii=False, indent=1)
            parts.append(table(res))
            parts.append(table(raw))
            parts.append("### Share of CPED validation utterances with at least one hit\n\n| Category | Simplified as written, before | Simplified as written, after | Converted with OpenCC first, before | Converted with OpenCC first, after |\n|---|---|---|---|---|\n"
                         + "\n".join(f"| `{k}` | {pct(v['simplified_old'])} | {pct(v['simplified_new'])} | {pct(v['opencc_old'])} | {pct(v['opencc_new'])} |" for k, v in cov.items()) + "\n")
        with open(os.path.join(RESULTS, "retest_tables.md"), "w", encoding="utf-8") as f:
            f.write("# Retest tables (written by run_retest.py)\n\n" + "\n".join(parts))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
