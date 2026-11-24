"""Small statistics helpers in pure Python: Spearman's rho with a p-value, Benjamini-Hochberg."""
import math


def ranks(values):
    """Average ranks (1-based), ties share the mean of their positions."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    out = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        for k in range(i, j + 1):
            out[order[k]] = (i + j) / 2.0 + 1.0
        i = j + 1
    return out


def pearson(x, y):
    n = len(x)
    mx, my = sum(x) / n, sum(y) / n
    sxx = sum((a - mx) ** 2 for a in x)
    syy = sum((b - my) ** 2 for b in y)
    if sxx <= 0 or syy <= 0:
        return None
    r = sum((a - mx) * (b - my) for a, b in zip(x, y)) / math.sqrt(sxx * syy)
    return max(-1.0, min(1.0, r))


def _betacf(a, b, x):
    tiny, qab, qap, qam = 1e-300, a + b, a + 1.0, a - 1.0
    c, d = 1.0, 1.0 - qab * x / qap
    d = 1.0 / (d if abs(d) > tiny else tiny)
    h = d
    for m in range(1, 400):
        m2 = 2 * m
        for aa in (m * (b - m) * x / ((qam + m2) * (a + m2)),
                   -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))):
            d = 1.0 + aa * d
            d = 1.0 / (d if abs(d) > tiny else tiny)
            c = 1.0 + aa / c
            c = c if abs(c) > tiny else tiny
            delta = d * c
            h *= delta
        if abs(delta - 1.0) < 1e-14:
            break
    return h


def betainc(a, b, x):
    """Regularized incomplete beta function I_x(a, b)."""
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    front = math.exp(math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log(1.0 - x))
    if x < (a + 1.0) / (a + b + 2.0):
        return front * _betacf(a, b, x) / a
    return 1.0 - front * _betacf(b, a, 1.0 - x) / b


def t_two_sided_p(t, df):
    return betainc(df / 2.0, 0.5, df / (df + t * t))


def spearman(x, y):
    """-> (rho, two-sided p from the t approximation, n), or (None, None, n) when either
    variable is constant or n < 3. The same approximation as scipy.stats.spearmanr."""
    n = len(x)
    if n < 3:
        return None, None, n
    r = pearson(ranks(x), ranks(y))
    if r is None:
        return None, None, n
    if abs(r) >= 1.0:
        return r, 0.0, n
    t = r * math.sqrt((n - 2) / (1.0 - r * r))
    return r, t_two_sided_p(t, n - 2), n


def spearman_ci(rho, n, z=1.959963984540054):
    """Approximate 95% interval: Fisher z with the Bonett and Wright (2000) variance,
    the same interval the Murmur app shows."""
    if rho is None or n < 4 or abs(rho) >= 1.0:
        return None, None
    se = math.sqrt((1.0 + rho * rho / 2.0) / (n - 3))
    zr = math.atanh(rho)
    return math.tanh(zr - z * se), math.tanh(zr + z * se)


def benjamini_hochberg(pvalues):
    """Adjusted p-values (Benjamini and Hochberg, 1995), in the input order.
    p_adj(i) = min over ranks k >= rank(i) of p(k) * m / k, capped at 1."""
    m = len(pvalues)
    order = sorted(range(m), key=lambda i: pvalues[i])
    out = [0.0] * m
    running = 1.0
    for rank in range(m, 0, -1):
        i = order[rank - 1]
        running = min(running, pvalues[i] * m / rank)
        out[i] = running
    return out
