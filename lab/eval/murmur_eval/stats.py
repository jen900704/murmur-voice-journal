"""Statistics used by the report and by agreement.py. Standard library only."""
from __future__ import annotations

import math
import random
from collections import Counter
from typing import Callable, Sequence


def wilson(successes: int, n: int, z: float = 1.959963984540054) -> tuple[float, float]:
    """Wilson score interval for a proportion. Returns (nan, nan) when n is 0."""
    if n == 0:
        return (float("nan"), float("nan"))
    p = successes / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    # exact ends, so 10/10 reads 1.00 and not .9999
    return (0.0 if successes == 0 else max(0.0, centre - half), 1.0 if successes == n else min(1.0, centre + half))


def confusion(a: Sequence, b: Sequence, categories: Sequence) -> list[list[int]]:
    """Rows are rater a, columns are rater b."""
    idx = {c: i for i, c in enumerate(categories)}
    m = [[0] * len(categories) for _ in categories]
    for x, y in zip(a, b):
        m[idx[x]][idx[y]] += 1
    return m


def cohen_kappa(a: Sequence, b: Sequence, categories: Sequence, weights: str | None = None) -> float:
    """Cohen's kappa. weights: None (unweighted), 'linear' or 'quadratic' for ordered categories.

    Returns nan when there are no pairs or when expected disagreement is zero (both raters
    used a single, identical category), since kappa is undefined there.
    """
    n = len(a)
    if n == 0 or n != len(b):
        return float("nan")
    k = len(categories)
    m = confusion(a, b, categories)
    row = [sum(r) for r in m]
    col = [sum(m[i][j] for i in range(k)) for j in range(k)]

    def w(i: int, j: int) -> float:  # disagreement weight
        if weights is None:
            return 0.0 if i == j else 1.0
        d = abs(i - j) / (k - 1) if k > 1 else 0.0
        return d if weights == "linear" else d * d

    observed = sum(w(i, j) * m[i][j] for i in range(k) for j in range(k)) / n
    expected = sum(w(i, j) * row[i] * col[j] for i in range(k) for j in range(k)) / (n * n)
    if expected == 0:
        return float("nan")
    return 1 - observed / expected


def krippendorff_alpha(units: Sequence[Sequence], level: str = "ordinal", categories: Sequence | None = None) -> float:
    """Krippendorff's alpha. units: one sequence of ratings per unit, None for a missing rating.

    level: 'nominal', 'ordinal' or 'interval'. Units with fewer than two ratings are dropped.
    """
    units = [[v for v in u if v is not None] for u in units]
    units = [u for u in units if len(u) >= 2]
    if not units:
        return float("nan")
    cats = sorted(set(v for u in units for v in u)) if categories is None else list(categories)
    idx = {c: i for i, c in enumerate(cats)}
    k = len(cats)
    o = [[0.0] * k for _ in range(k)]  # coincidence matrix
    for u in units:
        m = len(u)
        counts = Counter(u)
        for c, nc in counts.items():
            for d, nd in counts.items():
                pairs = nc * (nc - 1) if c == d else nc * nd
                o[idx[c]][idx[d]] += pairs / (m - 1)
    n_c = [sum(o[i]) for i in range(k)]
    n = sum(n_c)
    if n <= 1:
        return float("nan")

    def delta2(i: int, j: int) -> float:
        if i == j:
            return 0.0
        if level == "nominal":
            return 1.0
        if level == "interval":
            return float(cats[i] - cats[j]) ** 2
        lo, hi = min(i, j), max(i, j)
        return (sum(n_c[lo:hi + 1]) - (n_c[lo] + n_c[hi]) / 2) ** 2  # ordinal

    d_o = sum(o[i][j] * delta2(i, j) for i in range(k) for j in range(k))
    d_e = sum(n_c[i] * n_c[j] * delta2(i, j) for i in range(k) for j in range(k)) / (n - 1)
    if d_e == 0:
        return float("nan")
    return 1 - d_o / d_e


def bootstrap_ci(n_units: int, stat: Callable[[list[int]], float], n_boot: int = 2000, seed: int = 20261124,
                 level: float = 0.95) -> tuple[float, float, int]:
    """Percentile bootstrap over units. stat takes a list of resampled unit indices.

    Resamples where the statistic is undefined (nan) are dropped; the third value returned
    is how many resamples were usable.
    """
    if n_units == 0:
        return (float("nan"), float("nan"), 0)
    rng = random.Random(seed)
    vals = []
    for _ in range(n_boot):
        v = stat([rng.randrange(n_units) for _ in range(n_units)])
        if not math.isnan(v):
            vals.append(v)
    if not vals:
        return (float("nan"), float("nan"), 0)
    vals.sort()

    def pct(q: float) -> float:
        pos = q * (len(vals) - 1)
        lo, hi = math.floor(pos), math.ceil(pos)
        return vals[lo] + (vals[hi] - vals[lo]) * (pos - lo)

    a = (1 - level) / 2
    return (pct(a), pct(1 - a), len(vals))


def fmt(x: float, digits: int = 2) -> str:
    """Two decimals without a leading zero for values inside (-1, 1): .63, -.20, 1.00."""
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return "n/a"
    s = f"{x:.{digits}f}"
    if s.startswith("0."):
        return s[1:]
    if s.startswith("-0."):
        return "-" + s[2:]
    return s
