"""Metrics for the known-groups study: AUC, point-biserial r, Wilson and bootstrap intervals.

numpy only, except Bootstrap, which uses scipy.sparse to keep 10,000 resamples fast.
"""
import math

import numpy as np


def fmt(x, nd=2):
    """A number between -1 and 1 without the leading zero: .63, -.08, 1.00. None or nan gives 'n/a'."""
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return "n/a"
    s = f"{x:.{nd}f}"
    if float(s) == 0:
        s = s.lstrip("-")
    if s.startswith("0."):
        return s[1:]
    if s.startswith("-0."):
        return "-" + s[2:]
    return s


def pct(x, nd=1):
    """A share as a percentage string."""
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return "n/a"
    return f"{100 * x:.{nd}f}%"


def auc(pos, neg):
    """P(score of a random pos item > score of a random neg item) + half the ties. nan if a group is empty."""
    pos = np.asarray(pos, dtype=float)
    neg = np.asarray(neg, dtype=float)
    if len(pos) == 0 or len(neg) == 0:
        return float("nan")
    values, inv = np.unique(np.concatenate([pos, neg]), return_inverse=True)
    k = len(values)
    p = np.bincount(inv[: len(pos)], minlength=k).astype(float)
    n = np.bincount(inv[len(pos):], minlength=k).astype(float)
    return float(auc_from_counts(p, n))


def auc_from_counts(p, n):
    """AUC from counts per distinct score value, values in ascending order along the last axis.

    p, n: arrays (..., K) of (possibly weighted) counts of pos and neg items at each value.
    """
    p = np.asarray(p, dtype=float)
    n = np.asarray(n, dtype=float)
    below = np.cumsum(n, axis=-1) - n
    num = np.sum(p * (below + 0.5 * n), axis=-1)
    den = p.sum(axis=-1) * n.sum(axis=-1)
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(den > 0, num / den, np.nan)


def point_biserial(x, g):
    """Pearson r between a 0/1 group indicator g and a score x. nan if either has no variance."""
    x = np.asarray(x, dtype=float)
    g = np.asarray(g, dtype=float)
    if len(x) < 2 or x.std() == 0 or g.std() == 0:
        return float("nan")
    return float(np.corrcoef(x, g)[0, 1])


def wilson(k, n, z=1.959964):
    """Wilson score interval for k successes out of n. Returns (low, high); (nan, nan) for n = 0."""
    if n <= 0:
        return (float("nan"), float("nan"))
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def bonferroni_level(m, alpha=0.05):
    """Confidence level of each interval when m intervals share a family-wise error of alpha."""
    return 1 - alpha / m


def interval(samples, level=0.95):
    """Percentile interval of bootstrap samples, ignoring nan."""
    s = np.asarray(samples, dtype=float)
    s = s[np.isfinite(s)]
    if len(s) == 0:
        return (float("nan"), float("nan"))
    a = (1 - level) / 2
    lo, hi = np.quantile(s, [a, 1 - a])
    return (float(lo), float(hi))


class Bootstrap:
    """Cluster bootstrap that reuses the same resamples for every statistic, so differences are paired.

    clusters: for each observation, the id of its resampling unit (the observation itself when
    texts are independent, the dialogue for CPED). Whole units are drawn with replacement.
    """

    def __init__(self, clusters, B=10000, seed=1, chunk=250):
        _, self.cl = np.unique(np.asarray(clusters), return_inverse=True)
        self.C = int(self.cl.max()) + 1 if len(self.cl) else 0
        self.B = int(B)
        self.seed = seed
        self.chunk = int(chunk)
        self._auc = {}
        self._r = {}

    def add_auc(self, key, x, pos, neg):
        """Register AUC of x for the observations in boolean mask pos against those in neg."""
        from scipy import sparse

        x = np.asarray(x, dtype=float)
        pos = np.asarray(pos, dtype=bool)
        neg = np.asarray(neg, dtype=bool)
        both = pos | neg
        values, inv = np.unique(x[both], return_inverse=True)
        codes = np.full(len(x), -1)
        codes[both] = inv
        k = len(values)

        def mat(mask):
            return sparse.csr_matrix((np.ones(int(mask.sum())), (codes[mask], self.cl[mask])), shape=(k, self.C))

        self._auc[key] = (mat(pos), mat(neg))
        return auc(x[pos], x[neg])

    def add_r(self, key, x, pos, neg):
        """Register the point-biserial r between group (pos 1, neg 0) and x."""
        x = np.asarray(x, dtype=float)
        pos = np.asarray(pos, dtype=bool)
        neg = np.asarray(neg, dtype=bool)

        def per_cluster(mask, v):
            return np.bincount(self.cl[mask], weights=v[mask], minlength=self.C)

        one = np.ones(len(x))
        self._r[key] = np.stack([
            per_cluster(pos, one), per_cluster(neg, one), per_cluster(pos, x), per_cluster(neg, x),
            per_cluster(pos | neg, x * x),
        ])
        both = pos | neg
        return point_biserial(x[both], pos[both].astype(float))

    def run(self):
        """Returns {key: array of B bootstrap values} for everything registered."""
        rng = np.random.default_rng(self.seed)
        out = {k: np.empty(self.B) for k in list(self._auc) + list(self._r)}
        done = 0
        while done < self.B:
            b = min(self.chunk, self.B - done)
            idx = rng.integers(0, self.C, size=(b, self.C))
            idx += np.arange(b)[:, None] * self.C
            w = np.bincount(idx.ravel(), minlength=b * self.C).reshape(b, self.C).astype(float).T  # C x b
            for key, (mp, mn) in self._auc.items():
                out[key][done:done + b] = auc_from_counts((mp @ w).T, (mn @ w).T)
            for key, m in self._r.items():
                n1, n0, s1, s0, sxx = m @ w
                n = n1 + n0
                with np.errstate(invalid="ignore", divide="ignore"):
                    cov = s1 / n - (s1 + s0) / n * (n1 / n)
                    vx = sxx / n - ((s1 + s0) / n) ** 2
                    vg = (n1 / n) * (1 - n1 / n)
                    out[key][done:done + b] = np.where((vx > 0) & (vg > 0), cov / np.sqrt(vx * vg), np.nan)
            done += b
        return out


def log_odds_z(a, na, b, nb):
    """Smoothed log-odds ratio of a/na against b/nb and its z score (document counts, add one half)."""
    d = math.log((a + 0.5) / (na - a + 0.5)) - math.log((b + 0.5) / (nb - b + 0.5))
    se = math.sqrt(1 / (a + 0.5) + 1 / (na - a + 0.5) + 1 / (b + 0.5) + 1 / (nb - b + 0.5))
    return d, d / se
