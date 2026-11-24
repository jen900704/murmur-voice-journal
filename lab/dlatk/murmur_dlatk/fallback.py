"""Pure-Python engine: the same feature definitions DLATK uses, with no dependencies.

For a group g (one week or month) and an n-gram w of length n:
    value(g, w)      = number of times w occurs in g's messages
    group_norm(g, w) = value(g, w) / total number of n-grams of length n in g
For a weighted lexicon category c:
    value(g, c)      = summed count of g's words that are in c
    group_norm(g, c) = sum over those words of weight(w, c) * group_norm(g, w)
A lexicon term ending in * matches any word that starts with it, if the word has at least
three characters before the star (DLATK's rule).
"""
from collections import Counter, OrderedDict

from . import stats
from .textprep import ngrams, tokenize


def ngram_table(grouped_texts, n):
    """grouped_texts: period -> list of normalized message strings.
    -> period -> {feat: (value, group_norm)}"""
    out = OrderedDict()
    for g, texts in grouped_texts.items():
        counts = Counter()
        for text in texts:
            counts.update(ngrams(tokenize(text), n))
        total = sum(counts.values())
        if total:
            out[g] = {f: (v, v / total) for f, v in counts.items()}
    return out


def word_counts(onegram):
    return {g: sum(v for v, _ in feats.values()) for g, feats in onegram.items()}


def combine(tables):
    """Union of 1-, 2- and 3-gram tables. Norms keep their own denominators, as in DLATK."""
    out = OrderedDict()
    for t in tables:
        for g, feats in t.items():
            out.setdefault(g, {}).update(feats)
    return out


def occurrence_filter(table, groups, p_occ):
    """Keep features present in at least round(p_occ * number of groups) of the given groups."""
    groups = [g for g in groups if g in table]
    threshold = int(round(p_occ * len(groups))) if p_occ < 1 else int(p_occ)
    seen = Counter()
    for g in groups:
        seen.update(table[g].keys())
    keep = {f for f, c in seen.items() if c >= threshold}
    return OrderedDict((g, {f: v for f, v in table[g].items() if f in keep}) for g in groups), threshold


def lexicon_table(onegram, lexicon_rows):
    """-> period -> {category: (value, group_norm)}"""
    weights, wild = {}, False
    for term, cat, weight in lexicon_rows:
        weights.setdefault(term, {})[cat] = weight
        wild = wild or term.endswith("*")
    out = OrderedDict()
    for g, feats in onegram.items():
        val, norm = Counter(), Counter()
        for feat, (value, gn) in feats.items():
            cats = dict(weights.get(feat, {}))
            if wild:
                for end in range(3, len(feat) + 1):
                    for c, w in weights.get(feat[:end] + "*", {}).items():
                        cats[c] = max(cats.get(c, w), w)
            for c, w in cats.items():
                val[c] += value
                norm[c] += w * gn
        out[g] = {c: (val[c], norm[c]) for c in val}
    return out


def correlate(table, outcomes, groups, outcome_names=("mood", "energy")):
    """Spearman correlation of every feature with every outcome over the given groups.
    A feature missing from a group counts as 0 there. BH correction is applied per outcome
    across all features of this table; a feature that is constant over the groups has no
    correlation and enters the correction with p = 1, as in DLATK. -> list of dict rows, and {outcome: n_groups}."""
    feats = sorted({f for g in groups for f in table.get(g, {})})
    rows, used = [], {}
    for name in outcome_names:
        gs = [g for g in groups if outcomes.get(g, {}).get(name) is not None]
        used[name] = len(gs)
        y = [outcomes[g][name] for g in gs]
        block, undefined = [], 0
        for f in feats:
            x = [table.get(g, {}).get(f, (0, 0.0))[1] for g in gs]
            rho, p, n = stats.spearman(x, y)
            if rho is None:
                undefined += 1      # constant feature: no correlation, but it was a test
                continue
            lo, hi = stats.spearman_ci(rho, n)
            freq = sum(table.get(g, {}).get(f, (0, 0.0))[0] for g in gs)
            block.append({"feature": f, "outcome": name, "rho": rho, "p": p, "n": n,
                          "ci_low": lo, "ci_high": hi, "freq": freq})
        adjusted = stats.benjamini_hochberg([r["p"] for r in block] + [1.0] * undefined)
        for row, adj in zip(block, adjusted):
            row["p_bh"] = adj
        rows.extend(block)
    return rows, used
