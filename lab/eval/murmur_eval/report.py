"""Builds summary.md for a run folder from the files the orchestrator wrote."""
from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

from .stats import fmt, wilson


def _read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _read_csv(path: Path) -> list[dict]:
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _prop(k: int, n: int) -> str:
    if n == 0:
        return "no cases"
    lo, hi = wilson(k, n)
    return f"{k}/{n} = {fmt(k / n)} [{fmt(lo)}, {fmt(hi)}]"


def _clip(text: str | None, n: int = 220) -> str:
    t = " ".join((text or "").split())
    return (t[: n - 1] + "…") if len(t) > n else t


def _table(header: list[str], rows: list[list]) -> list[str]:
    out = ["| " + " | ".join(header) + " |", "|" + "|".join("---" for _ in header) + "|"]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return out


def score_summary(rows: list[dict]) -> dict:
    """n scored, mean on the 0 to 2 scale, counts per score, and how many were 'does not apply'."""
    vals = [int(r["score"]) for r in rows if r["score"] != ""]
    na = sum(1 for r in rows if r["score"] == "")
    counts = {s: vals.count(s) for s in (0, 1, 2)}
    return {"n": len(vals), "na": na, "mean": (sum(vals) / len(vals)) if vals else float("nan"), "counts": counts}


def risk_layers(risk_rows: list[dict]) -> dict:
    """Counts for the three layers on the injected risk turns."""
    rows = [r for r in risk_rows if r["label"] == "risk"]
    sent = [r for r in rows if r["model_help_line"] != ""]  # the message reached the model
    return {
        "n": len(rows),
        "gate": sum(int(r["gate_flagged"]) for r in rows),
        "n_sent": len(sent),
        "model": sum(int(r["model_help_line"]) for r in sent),
        "model_or_no_reply": sum(int(r["model_help_line"]) or int(r["model_no_reply"]) for r in sent),
        "system": sum(int(r["app_help_shown"]) for r in rows),
    }


def build_report(run_dir: Path, max_examples: int = 12) -> str:
    run_dir = Path(run_dir)
    man = json.loads((run_dir / "run.json").read_text(encoding="utf-8"))
    results = _read_csv(run_dir / "results.csv")
    risk_rows = _read_csv(run_dir / "risk_turns.csv")
    transcripts = _read_jsonl(run_dir / "transcripts.jsonl")
    judgments = _read_jsonl(run_dir / "judgments.jsonl")
    labels = {(l["case_id"], l["replicate"]): l for l in _read_jsonl(run_dir / "labels.jsonl")}
    turns = {(t["case_id"], t["replicate"], tr["turn"]): tr for t in transcripts for tr in t["turns"]}
    mock = "mock" in (man["counselor"]["provider"], man["judge"]["provider"])
    L: list[str] = []
    L.append(f"# Evaluation run {man['run_id']}")
    L.append("")
    if mock:
        L += ["**This run used the MockProvider.** The replies and the judge scores come from fixed rules written to exercise the pipeline, "
              "including deliberate mistakes. The numbers below show that the harness works. They say nothing about any model or about the app.", ""]
    L += ["All conversations are scripted test cases. No real person took part. The scores describe replies to those scripts and nothing else.", ""]
    L.append("## Run record")
    L.append("")
    c, j = man["counselor"], man["judge"]
    L += _table(["", "provider", "model", "temperature", "seed applied"], [
        ["counselor", c["provider"], f"`{c['model']}`", "provider default (as in the app)" if c["temperature"] is None else c["temperature"], c["seed_applied"]],
        ["judge", j["provider"], f"`{j['model']}`", j["temperature"], j["seed_applied"]],
    ])
    L.append("")
    L.append(f"- Judge independence: `{man['judge_independence']}`")
    L.append(f"- Cases: {man['n_cases']} (file `{man['cases_file']}`, sha256 `{man['cases_sha256'][:12]}`), replicates: {man['replicates']}, seed: {man['seed']}")
    L.append("- App sources (sha256): " + ", ".join(f"`{k}` `{v[:12]}`" for k, v in sorted(man["app_sources_sha256"].items())))
    L.append("- Rubrics: " + ", ".join(f"`{k}` v{v['version']} `{v['sha256'][:12]}`" for k, v in man["rubrics"].items()))
    calls = man.get("calls", {})
    L.append("- Model calls: " + "; ".join(f"{role}: {s['calls']} calls, {s['cache_hits']} from cache, {s['retries']} retries, {s['errors']} failed" for role, s in calls.items()))
    failed = [x for x in judgments if x["failed"]]
    retried = [x for x in judgments if x["attempts"] > 1 and not x["failed"]]
    L.append(f"- Judge answers: {len(judgments)} in total, {len(retried)} needed a retry to pass the schema, {len(failed)} never passed and are excluded from scores")
    if man.get("case_errors"):
        L.append(f"- Cases that stopped with an error: {len(man['case_errors'])} ({', '.join(e['case_id'] for e in man['case_errors'])})")
    L.append("")

    # ---------------- risk ----------------
    L += ["## Risk turns", "",
          "A risk turn is a scripted message with risk wording. Three layers can catch it. The gate is the app's word list (`checkRisk`), which pauses and shows help lines before anything is sent. "
          "The model layer is the reply containing a help line (`hasHelpLine`), measured only when the script sent the message on after the pause. "
          "The system layer is the app showing help lines by any route on that turn. Intervals are Wilson 95% intervals.", ""]
    groups: list[tuple[str, list[dict]]] = [("all risk turns", risk_rows)]
    for d in ("direct", "indirect"):
        groups.append((d, [r for r in risk_rows if r["directness"] == d]))
    for lang in ("zh-TW", "en"):
        groups.append((lang, [r for r in risk_rows if r["lang"] == lang]))
    for cat in ("self", "others", "abuse", "other"):
        groups.append((f"category: {cat}", [r for r in risk_rows if r["category"] == cat]))
    rows = []
    for name, rr in groups:
        k = risk_layers(rr)
        rows.append([name, _prop(k["gate"], k["n"]), _prop(k["model"], k["n_sent"]), _prop(k["system"], k["n"])])
    L += _table(["group", "gate recall", "model recall (sent turns)", "system recall"], rows)
    L.append("")
    non_risk = [r for r in risk_rows if r["label"] != "risk"]
    look = [r for r in non_risk if r["label"] == "lookalike"]
    L.append(f"- Gate false alarms on turns without risk wording: {_prop(sum(int(r['gate_flagged']) for r in non_risk), len(non_risk))}")
    L.append(f"- Of those, on harmless look-alike turns (for example an idiom about dying of embarrassment): {_prop(sum(int(r['gate_flagged']) for r in look), len(look))}")
    sent_non_risk = [r for r in non_risk if r["model_help_line"] != ""]
    L.append(f"- Replies with a help line on turns without risk wording: {_prop(sum(int(r['model_help_line']) for r in sent_non_risk), len(sent_non_risk))}")
    L.append(f"- Replies held back by the app (risk wording in the reply and no help line): {sum(int(r['reply_held']) for r in risk_rows)}")
    L.append("")

    # ---------------- rubric scores ----------------
    judge_rows = [r for r in results if r["source"] == "judge"]
    L += ["## Judge scores by rubric item", "", "Scale 0 to 2. 'n/a' counts replies where the item did not apply. Share at 2 has a Wilson 95% interval.", ""]
    by_item = defaultdict(list)
    for r in judge_rows:
        by_item[(r["rubric"], r["item"])].append(r)
    rows = []
    for (rub, item), rr in by_item.items():
        s = score_summary(rr)
        rows.append([rub, item, s["n"], s["na"], fmt(s["mean"]), s["counts"][0], s["counts"][1], s["counts"][2], _prop(s["counts"][2], s["n"])])
    L += _table(["rubric", "item", "n", "n/a", "mean", "0", "1", "2", "share at 2"], rows)
    L.append("")

    L += ["## Judge scores by approach", "", "Mean score on the 0 to 2 scale over all applicable items of each rubric, with the number of item scores in brackets.", ""]
    rubs = list(man["rubrics"])
    by_lens = defaultdict(lambda: defaultdict(list))
    for r in judge_rows:
        by_lens[r["lens"]][r["rubric"]].append(r)
    rows = []
    for lens in sorted(by_lens):
        row = [lens]
        for rub in rubs:
            s = score_summary(by_lens[lens][rub])
            row.append(f"{fmt(s['mean'])} ({s['n']})" if s["n"] else "none")
        rows.append(row)
    L += _table(["approach"] + rubs, rows)
    L.append("")

    L += ["## Judge scores by language", ""]
    rows = []
    for lang in ("zh-TW", "en"):
        row = [lang]
        for rub in rubs:
            s = score_summary([r for r in judge_rows if r["lang"] == lang and r["rubric"] == rub])
            row.append(f"{fmt(s['mean'])} ({s['n']})" if s["n"] else "none")
        rows.append(row)
    L += _table(["language"] + rubs, rows)
    L.append("")

    adv = [r for r in judge_rows if r["turn_label"] == "adversarial" and r["rubric"] == "safety"]
    if adv:
        L += ["## Adversarial turns", "", "Safety items on the reply to the scripted adversarial message (asks for a diagnosis, for medication advice, for a therapist, or to drop the rules).", ""]
        by = defaultdict(list)
        for r in adv:
            by[r["item"]].append(r)
        L += _table(["item", "n", "n/a", "0", "1", "2"], [[i, (s := score_summary(rr))["n"], s["na"], s["counts"][0], s["counts"][1], s["counts"][2]] for i, rr in by.items()])
        L.append("")

    # ---------------- automatic checks ----------------
    auto = [r for r in results if r["source"] == "auto"]
    if auto:
        L += ["## Automatic checks", "", "Rule-based checks on each reply. They need no judge.", ""]
        by = defaultdict(list)
        for r in auto:
            if r["score"] != "":
                by[r["item"]].append(int(r["score"]))
        L += _table(["check", "passed"], [[k, _prop(sum(v), len(v))] for k, v in by.items()])
        L.append("")

    # ---------------- failures ----------------
    L += ["## Failure examples", ""]
    missed = [r for r in risk_rows if r["label"] == "risk" and r["model_help_line"] == "0" and r["model_no_reply"] == "0"]
    if missed:
        L += ["### Risk turns where the reply had no help line", ""]
        for r in missed[:max_examples]:
            t = turns.get((r["case_id"], int(r["replicate"]), int(r["turn"])), {})
            L.append(f"- `{r['case_id']}` turn {r['turn']} ({r['lang']}, {r['category']}, {r['directness']}; gate {'paused' if r['gate_flagged'] == '1' else 'did not pause'})")
            L.append(f"  - person: {_clip(t.get('user'))}")
            L.append(f"  - reply{' (held back by the app, so the person never saw it)' if r['reply_held'] == '1' else ''}: {_clip(t.get('assistant'))}")
        if len(missed) > max_examples:
            L.append(f"- and {len(missed) - max_examples} more in `risk_turns.csv`")
        L.append("")
    zeros = defaultdict(list)
    for jd in judgments:
        if jd["failed"]:
            continue
        for item, sc in jd["scores"].items():
            if sc == 0:
                zeros[(jd["rubric"], item)].append(jd)
    if zeros:
        L += ["### Replies scored 0 by a judge", "", "Up to two per item. The full list is in `results.csv`.", ""]
        shown = 0
        for (rub, item), jds in zeros.items():
            for jd in jds[:2]:
                if shown >= max_examples:
                    break
                t = turns.get((jd["case_id"], jd["replicate"], jd["turn"]), {})
                L.append(f"- `{rub}.{item}` in `{jd['case_id']}` turn {jd['turn']}")
                L.append(f"  - person: {_clip(t.get('user'))}")
                L.append(f"  - reply: {_clip(t.get('assistant'))}")
                shown += 1
        L.append("")
    if not missed and not zeros:
        L += ["None found in this run.", ""]
    L += ["## Files", "", "- `run.json`: models, temperatures, seeds, hashes of prompts, rubrics, cases and app sources",
          "- `transcripts.jsonl`: one conversation per line, with no case labels and no judge scores, for `annotate.html`",
          "- `labels.jsonl`: which turns were risk, adversarial or look-alike turns (kept apart so annotators stay blind)",
          "- `judgments.jsonl`: every judge answer with evidence quotes and retry counts",
          "- `results.csv`: one row per reply and rubric item; `risk_turns.csv`: one row per turn with the three risk layers", ""]
    _ = labels
    return "\n".join(L)


def write_report(run_dir: Path) -> Path:
    path = Path(run_dir) / "summary.md"
    path.write_text(build_report(run_dir), encoding="utf-8")
    return path
