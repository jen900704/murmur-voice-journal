"""The preregistered analysis (PREREG.md sections 4 to 8) and the exploratory word reading (section 9)."""
import re
from collections import Counter, defaultdict

import numpy as np

from . import hypotheses as H
from .data import has_any, only, score_rows
from .metrics import Bootstrap, auc, bonferroni_level, interval, log_odds_z, point_biserial, wilson


def rate(arr, score):
    """Hits per 100 units for a category id, or the tone index (posemo minus negemo)."""
    w = arr["words"]
    if score == "tone":
        return 100 * (arr["counts"]["posemo"] - arr["counts"]["negemo"]) / w
    return 100 * arr["counts"][score] / w


def _share(mask_hit, mask_group):
    n = int(mask_group.sum())
    k = int((mask_hit & mask_group).sum())
    lo, hi = wilson(k, n)
    return {"k": k, "n": n, "share": k / n if n else float("nan"), "low": lo, "high": hi}


def _ci(samples, level):
    lo, hi = interval(samples, level)
    return [lo, hi]


def run_confirmatory(arr, confirm, valence, explore, family, neutral_label, use_vader, B=H.B_BOOT, seed=H.SEED):
    rows = arr["rows"]
    neutral = only(rows, neutral_label)
    adj = bonferroni_level(family, H.ALPHA)
    bs = Bootstrap(arr["clusters"], B=B, seed=seed)
    pending = []

    for h in confirm:
        x = rate(arr, h["score"])
        target = has_any(rows, h["target"])
        other = ~neutral & ~target
        opposite = has_any(rows, h["opposite"]) & ~target
        near = has_any(rows, h["near"]) & ~target if h["near"] else None
        k = h["id"]
        res = {"id": k, "score": h["score"], "label": h["label"], "target_labels": h["target"], "opposite_labels": h["opposite"],
               "near_labels": h["near"], "n_target": int(target.sum()), "n_neutral": int(neutral.sum()), "n_other": int(other.sum()),
               "n_opposite": int(opposite.sum()), "n_near": int(near.sum()) if near is not None else 0}
        res["auc"] = bs.add_auc(k + ":main", x, target, neutral)
        res["auc_specific"] = bs.add_auc(k + ":spec", x, target, other)
        res["auc_opposite"] = bs.add_auc(k + ":opp", x, opposite, neutral)
        if near is not None:
            res["auc_near"] = bs.add_auc(k + ":near", x, near, neutral)
        res["auc_count"] = auc(arr["counts"][h["score"]][target], arr["counts"][h["score"]][neutral])
        res["r"] = bs.add_r(k + ":r", x, target, neutral)
        hit = arr["counts"][h["score"]] > 0
        res["hit_target"] = _share(hit, target)
        res["hit_neutral"] = _share(hit, neutral)
        res["hit_other"] = _share(hit, other)
        res["zero_all"] = _share(~hit, np.ones(len(rows), dtype=bool))
        res["precision"] = _share(target, hit)  # of texts with a hit, the share carrying a target label
        res["base_rate"] = float(target.mean())
        if use_vader:
            v = h["vader_sign"] * arr["vader"]
            res["vader_auc"] = bs.add_auc(k + ":vmain", v, target, neutral)
            res["vader_auc_specific"] = bs.add_auc(k + ":vspec", v, target, other)
            res["vader_auc_opposite"] = bs.add_auc(k + ":vopp", v, opposite, neutral)
            if near is not None:
                res["vader_auc_near"] = bs.add_auc(k + ":vnear", v, near, neutral)
        pending.append(res)

    val = []
    for h in valence:
        x = rate(arr, h["score"])
        p = has_any(rows, h["positive"])
        n = has_any(rows, h["negative"])
        pos, neg = p & ~n, n & ~p
        k = h["id"]
        res = {"id": k, "score": h["score"], "label": h["label"], "n_positive": int(pos.sum()), "n_negative": int(neg.sum())}
        res["auc"] = bs.add_auc(k + ":main", x, pos, neg)
        res["r"] = bs.add_r(k + ":r", x, pos, neg)
        res["tie_share"] = float((x[pos | neg] == 0).mean())
        if use_vader:
            res["vader_auc"] = bs.add_auc(k + ":vmain", arr["vader"], pos, neg)
            res["vader_r"] = bs.add_r(k + ":vr", arr["vader"], pos, neg)
        val.append(res)

    exp = []
    for h in explore:
        x = rate(arr, h["score"])
        target = has_any(rows, h["target"])
        other = ~neutral & ~target
        k = "x:" + h["id"]
        res = {"id": h["id"], "score": h["score"], "label": h["label"], "target_labels": h["target"], "n_target": int(target.sum())}
        res["auc"] = bs.add_auc(k + ":main", x, target, neutral)
        res["auc_specific"] = bs.add_auc(k + ":spec", x, target, other)
        res["r"] = bs.add_r(k + ":r", x, target, neutral)
        hit = arr["counts"][h["score"]] > 0
        res["hit_target"] = _share(hit, target)
        res["hit_neutral"] = _share(hit, neutral)
        exp.append(res)

    boot = bs.run()

    for res in pending:
        k = res["id"]
        res["auc_ci95"] = _ci(boot[k + ":main"], 0.95)
        res["auc_ci_adj"] = _ci(boot[k + ":main"], adj)
        res["auc_specific_ci95"] = _ci(boot[k + ":spec"], 0.95)
        res["auc_opposite_ci95"] = _ci(boot[k + ":opp"], 0.95)
        d = boot[k + ":main"] - boot[k + ":opp"]
        res["diff_opposite"] = res["auc"] - res["auc_opposite"]
        res["diff_opposite_ci_adj"] = _ci(d, adj)
        if k + ":near" in boot:
            res["auc_near_ci95"] = _ci(boot[k + ":near"], 0.95)
            res["diff_near"] = res["auc"] - res["auc_near"]
            res["diff_near_ci95"] = _ci(boot[k + ":main"] - boot[k + ":near"], 0.95)
        res["r_ci95"] = _ci(boot[k + ":r"], 0.95)
        if use_vader:
            res["vader_auc_ci95"] = _ci(boot[k + ":vmain"], 0.95)
            res["vader_auc_specific_ci95"] = _ci(boot[k + ":vspec"], 0.95)
            res["diff_vader"] = res["auc"] - res["vader_auc"]
            res["diff_vader_ci95"] = _ci(boot[k + ":main"] - boot[k + ":vmain"], 0.95)
            res["diff_vader_specific"] = res["auc_specific"] - res["vader_auc_specific"]
            res["diff_vader_specific_ci95"] = _ci(boot[k + ":spec"] - boot[k + ":vspec"], 0.95)
        res["verdict"] = H.verdict(res["auc"], res["auc_ci_adj"][0], res["auc_specific"], res["auc_opposite"], res["diff_opposite_ci_adj"][0])
    for res in val:
        k = res["id"]
        res["auc_ci95"] = _ci(boot[k + ":main"], 0.95)
        res["auc_ci_adj"] = _ci(boot[k + ":main"], adj)
        res["r_ci95"] = _ci(boot[k + ":r"], 0.95)
        if use_vader:
            res["vader_auc_ci95"] = _ci(boot[k + ":vmain"], 0.95)
            res["vader_r_ci95"] = _ci(boot[k + ":vr"], 0.95)
            res["diff_vader"] = res["auc"] - res["vader_auc"]
            res["diff_vader_ci95"] = _ci(boot[k + ":main"] - boot[k + ":vmain"], 0.95)
        res["verdict"] = H.verdict_valence(res["auc"], res["auc_ci_adj"][0])
    for res in exp:
        k = "x:" + res["id"]
        res["auc_ci95"] = _ci(boot[k + ":main"], 0.95)
        res["auc_specific_ci95"] = _ci(boot[k + ":spec"], 0.95)
        res["r_ci95"] = _ci(boot[k + ":r"], 0.95)
    return {"adjusted_level": adj, "family": family, "B": B, "seed": seed, "n_analysed": len(rows), "n_neutral": int(neutral.sum()),
            "confirmatory": pending, "valence": val, "exploratory": exp}


def label_matrix(arr, scores, labels, neutral_label, use_vader):
    """Descriptive: AUC of each score for texts carrying a label against neutral texts. No intervals."""
    rows = arr["rows"]
    neutral = only(rows, neutral_label)
    out = {}
    for s in scores + (["vader"] if use_vader else []):
        x = arr["vader"] if s == "vader" else rate(arr, s)
        out[s] = {}
        for lab in labels:
            m = has_any(rows, [lab])
            out[s][lab] = auc(x[m], x[neutral])
    return out


# ---------- exploratory reading of words (PREREG.md section 9) ----------
EN_TOKEN = re.compile(r"[a-z]+(?:['’][a-z]+)*")
HAN_RUN = re.compile(r"[㐀-鿿豈-﫿]+")


def list_word_table(arr, scored, h, neutral_label, min_texts=10):
    """For each list word that fired: in how many texts, and how those texts were labeled."""
    rows = arr["rows"]
    target = has_any(rows, h["target"])
    neutral = only(rows, neutral_label)
    per = defaultdict(lambda: [0, 0, 0])
    for i, r in enumerate(rows):
        seen = {w.lower() for w, ids in scored[r["id"]].get("h", []) if h["score"] in ids}
        for w in seen:
            c = per[w]
            c[0] += 1
            c[1] += int(target[i])
            c[2] += int(neutral[i])
    base = float(target.mean())
    out = [{"word": w, "texts": c[0], "target": c[1], "neutral": c[2], "target_share": c[1] / c[0], "lift": (c[1] / c[0]) / base if base else float("nan")}
           for w, c in per.items() if c[0] >= min_texts]
    out.sort(key=lambda d: -d["texts"])
    return out


def _grams(text, lang):
    if lang == "en":
        return set(EN_TOKEN.findall(text.lower()))
    out = set()
    for run in HAN_RUN.findall(text):
        for n in (2, 3):
            for i in range(len(run) - n + 1):
                out.add(run[i:i + n])
    return out


def missing_word_table(arr, h, lang, top=40, min_target=8):
    """Words (English) or 2 and 3 character strings (Chinese) frequent in target texts and not on the list.

    The tokens here come from a plain regular expression, only to propose candidates; whether a
    candidate is already matched by the list is checked with the app's scorer.
    """
    rows = arr["rows"]
    target = has_any(rows, h["target"])
    nt, nr = int(target.sum()), int((~target).sum())
    ct, cr = Counter(), Counter()
    for i, r in enumerate(rows):
        (ct if target[i] else cr).update(_grams(r["text"], lang))
    cand = []
    for w, a in ct.items():
        if a < min_target:
            continue
        d, z = log_odds_z(a, nt, cr.get(w, 0), nr)
        cand.append({"word": w, "target": a, "rest": cr.get(w, 0), "target_share": a / (a + cr.get(w, 0)), "log_odds": d, "z": z})
    cand.sort(key=lambda d: -d["z"])
    cand = cand[: top * 4]
    if not cand:
        return []
    _, sc = score_rows([{"id": str(i), "text": c["word"]} for i, c in enumerate(cand)], hits=False)
    out = [c for i, c in enumerate(cand) if h["score"] not in sc[str(i)]["c"]]
    return out[:top]
