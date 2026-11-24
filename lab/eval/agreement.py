#!/usr/bin/env python3
"""Agreement between the LLM judges and human raters, and between human raters.

  python3 lab/eval/agreement.py --run lab/eval/runs/<run id> --human human_labels_R1.jsonl [human_labels_R2.jsonl]

Per rubric item it reports, for each human rater against the judge: percent agreement, Cohen's
kappa, linear-weighted kappa with a bootstrap 95% interval, and the confusion matrix. With two
or more human raters it also reports Krippendorff's alpha (ordinal) among the humans.

The bootstrap resamples whole scripted cases, not single replies, because replies in one
conversation are not independent. 'Does not apply' answers are analysed separately from the
0 to 2 scores: first whether rater and judge agree that an item applies, then, where both
scored it, how close the scores are.

One person coding the same replies twice gives intra-rater reliability only. Inter-rater
reliability needs a second trained rater.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from murmur_eval.stats import bootstrap_ci, cohen_kappa, confusion, fmt, krippendorff_alpha  # noqa: E402

CATS = [0, 1, 2]
MIN_N = 30  # below this the report says the estimate is too unstable to read


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]


def unit_key(d: dict) -> tuple:
    return (d["case_id"], int(d.get("replicate", 0)), int(d["turn"]))


def load_judge(run_dir: Path) -> tuple[dict, dict]:
    """{(rubric, item): {unit: score or None}} and {rubric: version}. Failed judge answers are left out."""
    scores: dict = defaultdict(dict)
    versions: dict = {}
    for j in read_jsonl(Path(run_dir) / "judgments.jsonl"):
        if j.get("failed"):
            continue
        versions[j["rubric"]] = j["rubric_version"]
        for item, s in j["scores"].items():
            scores[(j["rubric"], item)][unit_key(j)] = s
    return scores, versions


def load_human(paths: list[Path]) -> tuple[dict, dict]:
    """{rater: {(rubric, item): {unit: score or None}}} and {rubric: set of versions seen}."""
    out: dict = defaultdict(lambda: defaultdict(dict))
    versions: dict = defaultdict(set)
    for p in paths:
        for d in read_jsonl(p):
            out[d["rater"]][(d["rubric"], d["item"])][unit_key(d)] = d["score"]
            versions[d["rubric"]].add(d.get("rubric_version"))
    return out, versions


def pair_stats(a: dict, b: dict, n_boot: int = 2000, seed: int = 20261124) -> dict:
    """Agreement between two sets of scores {unit: 0|1|2|None} on the units both scored."""
    units = sorted(set(a) & set(b))
    both = [u for u in units if a[u] is not None and b[u] is not None]
    xa, xb = [a[u] for u in both], [b[u] for u in both]
    out = {"n_units": len(units), "n_scored_by_both": len(both)}
    # does the item apply at all?
    ap_a, ap_b = [int(a[u] is not None) for u in units], [int(b[u] is not None) for u in units]
    out["applies_agreement"] = (sum(x == y for x, y in zip(ap_a, ap_b)) / len(units)) if units else float("nan")
    out["applies_kappa"] = cohen_kappa(ap_a, ap_b, [0, 1])
    out["applies_confusion"] = confusion(ap_a, ap_b, [0, 1]) if units else [[0, 0], [0, 0]]
    out["percent_agreement"] = (sum(x == y for x, y in zip(xa, xb)) / len(both)) if both else float("nan")
    out["kappa"] = cohen_kappa(xa, xb, CATS)
    out["weighted_kappa"] = cohen_kappa(xa, xb, CATS, weights="linear")
    out["confusion"] = confusion(xa, xb, CATS)
    # cluster bootstrap: resample scripted cases, keep all their replies together
    by_case: dict = defaultdict(list)
    for i, u in enumerate(both):
        by_case[u[0]].append(i)
    cases = sorted(by_case)

    def resampled(which: str):
        def stat(idx: list[int]) -> float:
            rows = [i for c in idx for i in by_case[cases[c]]]
            return cohen_kappa([xa[i] for i in rows], [xb[i] for i in rows], CATS, weights=which)
        return stat

    out["n_cases"] = len(cases)
    out["kappa_ci"] = bootstrap_ci(len(cases), resampled(None), n_boot, seed)
    out["weighted_kappa_ci"] = bootstrap_ci(len(cases), resampled("linear"), n_boot, seed)
    return out


def alpha_stats(raters: list[dict], n_boot: int = 2000, seed: int = 20261124) -> dict:
    """Krippendorff's alpha (ordinal) among human raters on the 0 to 2 scores, with a cluster bootstrap."""
    units = sorted(set().union(*[set(r) for r in raters]))
    rows = [[r.get(u) for r in raters] for u in units]
    by_case: dict = defaultdict(list)
    for i, u in enumerate(units):
        by_case[u[0]].append(i)
    cases = sorted(by_case)
    usable = sum(1 for row in rows if sum(v is not None for v in row) >= 2)
    alpha = krippendorff_alpha(rows, "ordinal", CATS)
    ci = bootstrap_ci(len(cases), lambda idx: krippendorff_alpha([rows[i] for c in idx for i in by_case[cases[c]]], "ordinal", CATS), n_boot, seed)
    return {"alpha": alpha, "ci": ci, "n_units_with_two_ratings": usable, "n_raters": len(raters)}


def _ci(ci) -> str:
    return f"[{fmt(ci[0])}, {fmt(ci[1])}]"


def _matrix(m: list[list[int]], labels: list[str], row_name: str, col_name: str) -> list[str]:
    out = [f"| {row_name} \\ {col_name} | " + " | ".join(labels) + " |", "|---|" + "|".join("---" for _ in labels) + "|"]
    for lab, row in zip(labels, m):
        out.append(f"| **{lab}** | " + " | ".join(str(v) for v in row) + " |")
    return out


def build(run_dir: Path, human_paths: list[Path], n_boot: int = 2000, seed: int = 20261124) -> tuple[str, dict]:
    judge, jver = load_judge(run_dir)
    human, hver = load_human(human_paths)
    raters = sorted(human)
    L = ["# Judge and human agreement", "", f"Run: `{Path(run_dir).name}`. Human raters: {', '.join(raters) or 'none'}. Bootstrap: {n_boot} resamples of scripted cases, seed {seed}.", ""]
    for rub, versions in sorted(hver.items()):
        if rub in jver and versions != {jver[rub]}:
            L += [f"**Warning:** human labels for `{rub}` were made with rubric version(s) {sorted(str(v) for v in versions)}, the judge used {jver[rub]}. These scores are not comparable.", ""]
    if len(raters) < 2:
        L += ["Only one human rater is present. If that rater also wrote the rubrics or the cases, read the numbers below as a check of the judge against one person's reading. "
              "Inter-rater reliability needs a second trained rater.", ""]
    L += [f"Estimates on fewer than {MIN_N} replies are marked 'few'. Their intervals are wide and should not be read as evidence either way. "
          "'n/a' for a kappa means it is undefined, which happens when both raters used a single category.", ""]
    data: dict = {"run": Path(run_dir).name, "raters": raters, "n_boot": n_boot, "seed": seed, "judge_vs_human": [], "human_vs_human": []}
    items = sorted(set(judge) | {k for r in human.values() for k in r})
    L += ["## Judge against each human rater", ""]
    L += ["| rubric | item | rater | n | agree | kappa | 95% CI | weighted kappa | 95% CI | applies: agree | applies: kappa | note |", "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    details = []
    for key in items:
        for r in raters:
            if key not in human[r] or key not in judge:
                continue
            s = pair_stats(human[r][key], judge[key], n_boot, seed)
            data["judge_vs_human"].append({"rubric": key[0], "item": key[1], "rater": r, **s})
            note = "few" if s["n_scored_by_both"] < MIN_N else ""
            L.append(f"| {key[0]} | {key[1]} | {r} | {s['n_scored_by_both']} | {fmt(s['percent_agreement'])} | {fmt(s['kappa'])} | {_ci(s['kappa_ci'])} | "
                     f"{fmt(s['weighted_kappa'])} | {_ci(s['weighted_kappa_ci'])} | {fmt(s['applies_agreement'])} | {fmt(s['applies_kappa'])} | {note} |")
            details.append((key, r, s))
    L.append("")
    if len(raters) >= 2:
        L += ["## Among human raters", "", "| rubric | item | raters | units with two or more ratings | Krippendorff's alpha (ordinal) | 95% CI | note |", "|---|---|---|---|---|---|---|"]
        for key in items:
            rs = [human[r][key] for r in raters if key in human[r]]
            if len(rs) < 2:
                continue
            a = alpha_stats(rs, n_boot, seed)
            data["human_vs_human"].append({"rubric": key[0], "item": key[1], **a})
            L.append(f"| {key[0]} | {key[1]} | {a['n_raters']} | {a['n_units_with_two_ratings']} | {fmt(a['alpha'])} | {_ci(a['ci'])} | {'few' if a['n_units_with_two_ratings'] < MIN_N else ''} |")
        L.append("")
    L += ["## Confusion matrices", "", "Rows are the human rater, columns are the judge. Counts of replies.", ""]
    for key, r, s in details:
        L += [f"### {key[0]}.{key[1]}, rater {r}", ""] + _matrix(s["confusion"], ["0", "1", "2"], "human", "judge") + [""]
        if s["n_units"] != s["n_scored_by_both"]:
            L += ["Does the item apply?", ""] + _matrix(s["applies_confusion"], ["n/a", "applies"], "human", "judge") + [""]
    return "\n".join(L), data


def _jsonable(o):
    if isinstance(o, float) and math.isnan(o):
        return None
    if isinstance(o, dict):
        return {k: _jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_jsonable(v) for v in o]
    return o


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--run", type=Path, required=True, help="run folder with judgments.jsonl")
    p.add_argument("--human", type=Path, nargs="+", required=True, help="label files downloaded from annotate.html")
    p.add_argument("--out", type=Path, default=None, help="folder for agreement.md and agreement.json (default: the run folder)")
    p.add_argument("--boot", type=int, default=2000)
    p.add_argument("--seed", type=int, default=20261124)
    a = p.parse_args(argv)
    md, data = build(a.run, a.human, a.boot, a.seed)
    out = a.out or a.run
    out.mkdir(parents=True, exist_ok=True)
    (out / "agreement.md").write_text(md + "\n", encoding="utf-8")
    (out / "agreement.json").write_text(json.dumps(_jsonable(data), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(out / "agreement.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
