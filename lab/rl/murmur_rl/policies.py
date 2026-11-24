"""Policies. Each returns a probability vector over the eligible arms (already in expert order)
and is always called through safety.decide(), which applies the filter and the gate.

update(surface, context, eligible, used, reward) is called only for rated, ungated sessions.
"""
import numpy as np

N0 = 3.0
PRIOR_TOP = 0.60
PRIOR_STEP = 0.02
EPS = 0.20
KAPPA = 0.25
GAMMA = 0.98
MC_DRAWS = 1000

_NGRID = 300
_GRID = (np.arange(_NGRID) + 0.5) / _NGRID  # midpoint rule on (0, 1)
_LOGX, _LOG1MX = np.log(_GRID)[:, None], np.log1p(-_GRID)[:, None]


def prior_mean(k):
    return PRIOR_TOP - PRIOR_STEP * np.arange(k)


def ts_probs_mc(a, b, rng, draws=MC_DRAWS):
    """P(arm has the largest posterior draw), Monte Carlo. Ties go to the earlier arm."""
    x = rng.beta(a, b, size=(draws, len(a)))
    return np.bincount(np.argmax(x, axis=1), minlength=len(a)) / draws


def ts_probs_quad(a, b):
    """Same quantity by quadrature: integral of f_k(x) * prod_{j != k} F_j(x) dx on a
    300-point midpoint grid, with each density normalised on the grid. NumPy only."""
    logf = (a - 1) * _LOGX + (b - 1) * _LOG1MX
    f = np.exp(logf - logf.max(axis=0))
    f /= f.sum(axis=0)
    F = np.cumsum(f, axis=0) - 0.5 * f
    logF = np.log(np.maximum(F, 1e-300))
    w = (f * np.exp(logF.sum(axis=1, keepdims=True) - logF)).sum(axis=0)
    return w / w.sum()


class Policy:
    name = "policy"

    def action_probs(self, surface, context, eligible, rng):
        raise NotImplementedError

    def update(self, surface, context, eligible, used, reward):
        pass


class ExpertPolicy(Policy):
    """Always features the expert's first item."""
    name = "expert"

    def action_probs(self, surface, context, eligible, rng):
        p = np.zeros(len(eligible))
        p[0] = 1.0
        return p


class BetaTable(Policy):
    """Shared Beta-Bernoulli bookkeeping: expert-centred prior, optional discounting."""

    def __init__(self, gamma=1.0, n0=N0):
        if not 2.0 <= n0 <= 4.0:
            raise ValueError("prior pseudo-count must be between 2 and 4")
        self.gamma, self.n0 = gamma, n0
        self.s, self.f = {}, {}

    def _counts(self, surface, context, k):
        key = (surface, context)
        if key not in self.s:
            self.s[key], self.f[key] = np.zeros(k), np.zeros(k)
        return self.s[key], self.f[key]

    def posterior(self, surface, context, k):
        s, f = self._counts(surface, context, k)
        m = prior_mean(k)
        return self.n0 * m + s, self.n0 * (1 - m) + f

    def greedy(self, surface, context, k):
        a, b = self.posterior(surface, context, k)
        return int(np.argmax(a / (a + b)))  # argmax returns the first maximum: expert order

    def update(self, surface, context, eligible, used, reward):
        if reward is None:
            return  # missing stays missing
        s, f = self._counts(surface, context, len(eligible))
        s *= self.gamma
        f *= self.gamma
        i = eligible.index(used)
        s[i] += reward
        f[i] += 1 - reward

    def ess(self, surface, context, k):
        s, f = self._counts(surface, context, k)
        return float(s.sum() + f.sum())


class EpsilonGreedy(BetaTable):
    """Greedy on the posterior mean, uniform exploration with probability eps. Exact propensities."""
    name = "eps_greedy"

    def __init__(self, eps=0.10, gamma=1.0, n0=N0):
        super().__init__(gamma, n0)
        self.eps = eps

    def action_probs(self, surface, context, eligible, rng):
        k = len(eligible)
        p = np.full(k, self.eps / k)
        p[self.greedy(surface, context, k)] += 1 - self.eps
        return p


class ThompsonSampling(BetaTable):
    """Beta-Bernoulli Thompson sampling. The action is drawn from the returned vector, so the
    logged propensity is exact for the mechanism used; q_TS inside it is a numerical estimate.
    gamma < 1 gives discounted Thompson sampling. floor mixes in a uniform share."""
    name = "ts"

    def __init__(self, gamma=1.0, floor=0.0, method="auto", draws=MC_DRAWS, n0=N0):
        super().__init__(gamma, n0)
        self.floor, self.draws = floor, draws
        self.method = "quad" if method == "auto" else method

    def ts_probs(self, surface, context, k, rng):
        a, b = self.posterior(surface, context, k)
        return ts_probs_quad(a, b) if self.method == "quad" else ts_probs_mc(a, b, rng, self.draws)

    def action_probs(self, surface, context, eligible, rng):
        k = len(eligible)
        q = self.ts_probs(surface, context, k, rng)
        return (1 - self.floor) * q + self.floor / k


class MurmurPolicy(ThompsonSampling):
    """The policy in POLICY_SPEC section 5:
    pi = (1 - eps) * greedy + eps * ((1 - kappa) * q_TS + kappa * uniform)."""
    name = "murmur"

    def __init__(self, eps=EPS, kappa=KAPPA, gamma=GAMMA, method="auto", draws=MC_DRAWS, n0=N0):
        super().__init__(gamma=gamma, floor=0.0, method=method, draws=draws, n0=n0)
        self.eps, self.kappa = eps, kappa

    def action_probs(self, surface, context, eligible, rng):
        k = len(eligible)
        q = self.ts_probs(surface, context, k, rng)
        p = self.eps * ((1 - self.kappa) * q + self.kappa / k)
        p[self.greedy(surface, context, k)] += 1 - self.eps
        return p / p.sum()


class LinUCB(Policy):
    """Ridge regression on the residual from the expert prior mean, with features that share
    strength across contexts: [arm one-hot, context x arm one-hot] per surface. The UCB arm is
    featured with probability 1 - eps and a uniform arm otherwise, so propensities are exact."""
    name = "linucb"

    def __init__(self, alpha=0.5, eps=0.05, ridge=1.0, n_contexts=7):
        self.alpha, self.eps, self.ridge, self.nc = alpha, eps, ridge, n_contexts
        self.A_inv, self.bvec, self.ctx_ids, self.arm_ids = {}, {}, {}, {}

    def _model(self, surface):
        if surface not in self.A_inv:
            from .catalog import ARMS
            n = len(ARMS[surface])
            d = n + n * self.nc
            self.A_inv[surface] = np.eye(d) / self.ridge
            self.bvec[surface] = np.zeros(d)
            self.ctx_ids[surface] = {}
            self.arm_ids[surface] = {a: i for i, a in enumerate(ARMS[surface])}
        return self.A_inv[surface], self.bvec[surface]

    def _idx(self, surface, context, arm):
        ids = self.ctx_ids[surface]
        c = ids.setdefault(context, len(ids))
        n = len(self.arm_ids[surface])
        i = self.arm_ids[surface][arm]
        return i, n + c * n + i

    def scores(self, surface, context, eligible):
        A_inv, b = self._model(surface)
        theta = A_inv @ b
        out = np.empty(len(eligible))
        for r, arm in enumerate(eligible):
            i, j = self._idx(surface, context, arm)
            var = A_inv[i, i] + A_inv[j, j] + 2 * A_inv[i, j]
            out[r] = PRIOR_TOP - PRIOR_STEP * r + theta[i] + theta[j] + self.alpha * np.sqrt(max(var, 0.0))
        return out

    def action_probs(self, surface, context, eligible, rng):
        k = len(eligible)
        sc = self.scores(surface, context, eligible)
        # equal exploration bonus at t = 0, so the first choice is the expert's
        p = np.full(k, self.eps / k)
        p[int(np.argmax(sc))] += 1 - self.eps
        return p

    def update(self, surface, context, eligible, used, reward):
        if reward is None:
            return
        A_inv, b = self._model(surface)
        i, j = self._idx(surface, context, used)
        r = eligible.index(used)
        resid = reward - (PRIOR_TOP - PRIOR_STEP * r)
        u = A_inv[:, i] + A_inv[:, j]  # A_inv @ x for x with ones at i and j
        A_inv -= np.outer(u, u) / (1.0 + u[i] + u[j])  # Sherman-Morrison
        b[i] += resid
        b[j] += resid


def make_policy(name):
    """Fresh policy by study name."""
    if name == "expert":
        return ExpertPolicy()
    if name == "eps_greedy":
        return EpsilonGreedy(eps=0.10)
    if name == "ts":
        return ThompsonSampling(gamma=1.0, floor=0.0)
    if name == "ts_discounted":
        return ThompsonSampling(gamma=GAMMA, floor=0.0)
    if name == "murmur":
        return MurmurPolicy()
    if name == "linucb":
        return LinUCB()
    raise ValueError(name)


POLICY_NAMES = ["expert", "eps_greedy", "ts", "ts_discounted", "murmur", "linucb"]
