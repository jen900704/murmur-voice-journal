"""Synthetic users for the featured-item problem. Nothing here is fitted to real data.

One interaction is one session (about one a day). In a session the person has a surface
(lens or bedtime track) and a context (worry topic or theme); the policy features one item;
the person uses the featured item with probability `follow`, otherwise picks from the list
by their own taste and list position; the session is helpful with a probability that depends
on the person, the context, the item, time, habituation and novelty; a rating is left with a
probability that depends on whether the session helped (missing not at random).

All exogenous randomness for a user (parameters, contexts, mood, drift, and the uniform
numbers that resolve follow / choice / outcome / rating) is drawn up front from the user's
seed, so every policy meets the same user on the same days (common random numbers).
"""
from dataclasses import dataclass, replace

import numpy as np

from .catalog import ARMS, CONTEXTS, SURFACES, eligible
from .safety import State, decide, audit

RANK_BONUS = (0.5, 0.4, 0.3, 0.2, 0.1)  # logit bonus for expert ranks 0..4 (lens); tracks: rank 0 only


@dataclass(frozen=True)
class World:
    name: str
    sigma_user: float = 0.6     # sd of person x item effect (logit), shared across contexts
    sigma_ctx: float = 0.3      # sd of person x context x item effect (logit), static
    sigma_base: float = 0.5     # sd of person intercept (logit)
    rho: float = 0.99           # daily autocorrelation of the person x item effect (1 = no drift)
    expert_strength: float = 1.0  # multiplies RANK_BONUS
    expert_noise: float = 0.0   # sd of population item effects unrelated to the expert order
    habituation: float = 0.15   # logit penalty per unit of recent-use trace
    hab_decay: float = 0.7      # daily decay of the recent-use trace
    novelty: float = 0.2        # logit bonus the first time an item is used
    follow: float = 0.7         # probability the featured item is the one used
    taste_beta: float = 1.0     # how strongly own taste drives the choice when not following
    rate_if_helpful: float = 0.75
    rate_if_not: float = 0.45
    low_mood_start: float = 0.06
    low_mood_stay: float = 0.60
    low_mood_effect: float = -0.5
    risk_rate: float = 0.01
    p_lens: float = 0.6
    sigma_tod: float = 0.0      # unobserved time-of-day x item interaction (misspecification)
    changepoint: bool = False   # person x item effects redrawn once, on a day in 20..70


WORLDS = {
    "null": World("null", sigma_user=0.0, sigma_ctx=0.0, sigma_base=0.0, rho=1.0,
                  habituation=0.0, novelty=0.0),
    "heterogeneous": World("heterogeneous"),
    "strong": World("strong", sigma_user=1.2, sigma_ctx=0.6),
    "misspecified": World("misspecified", expert_strength=0.3, expert_noise=0.4, sigma_tod=0.5,
                          changepoint=True, follow=0.5, rate_if_helpful=0.85, rate_if_not=0.30),
}
WORLD_NAMES = ["null", "heterogeneous", "strong", "misspecified"]


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def population_quality(world, world_seed=7):
    """Population logit effect of each (surface, context, item). Fixed for a world."""
    rng = np.random.default_rng([world_seed, sum(map(ord, world.name))])
    q = {}
    for s in SURFACES:
        for c in CONTEXTS[s]:
            E = eligible(s, c)
            v = np.zeros(len(E))
            if s == "lens" and c != "other":
                n = min(len(RANK_BONUS), len(E))
                v[:n] = RANK_BONUS[:n]
            elif s == "track" and c != "none":
                v[0] = RANK_BONUS[0]
            v = world.expert_strength * v
            noise = rng.normal(0.0, 1.0, len(E))  # always drawn, so worlds differ only by scale
            q[(s, c)] = v + world.expert_noise * noise
    return q


class UserEnv:
    """One synthetic person over `horizon` sessions."""

    def __init__(self, world, seed_seq, horizon=90, quality=None):
        self.world, self.T = world, horizon
        w = world
        rng = np.random.default_rng(seed_seq)
        self.q = quality if quality is not None else population_quality(w)
        self.base = rng.normal(0.0, 1.0) * w.sigma_base
        # person x item effects with drift, per surface: array (T, n_items)
        self.u = {}
        for s in SURFACES:
            n = len(ARMS[s])
            z0 = rng.normal(0.0, 1.0, n)
            eps = rng.normal(0.0, 1.0, (horizon, n))
            z1 = rng.normal(0.0, 1.0, n)
            cp = int(rng.integers(20, 71))
            path = np.empty((horizon, n))
            cur = z0
            for t in range(horizon):
                if t > 0:
                    cur = w.rho * cur + np.sqrt(max(1 - w.rho ** 2, 0.0)) * eps[t]
                if w.changepoint and t == cp:
                    cur = z1
                path[t] = cur
            self.u[s] = w.sigma_user * path
        self.v = {(s, c): w.sigma_ctx * rng.normal(0.0, 1.0, len(ARMS[s]))
                  for s in SURFACES for c in CONTEXTS[s]}
        self.tod_w = {s: w.sigma_tod * rng.normal(0.0, 1.0, len(ARMS[s])) for s in SURFACES}
        self.ctx_p = {s: rng.dirichlet(np.ones(len(CONTEXTS[s]))) for s in SURFACES}
        # exogenous day-level sequences
        self.surface = np.where(rng.random(horizon) < w.p_lens, "lens", "track")
        self.context = [CONTEXTS[s][int(rng.choice(len(CONTEXTS[s]), p=self.ctx_p[s]))]
                        for s in self.surface]
        self.evening = np.where(rng.random(horizon) < 0.5, 1.0, -1.0)
        um = rng.random(horizon)
        low = np.zeros(horizon, dtype=bool)
        prev = False
        for t in range(horizon):
            prev = um[t] < (w.low_mood_stay if prev else w.low_mood_start)
            low[t] = prev
        self.low_mood = low
        self.risk = rng.random(horizon) < w.risk_rate
        self.unif = rng.random((horizon, 4))  # follow, choice, outcome, rating
        self.arm_index = {s: {a: i for i, a in enumerate(ARMS[s])} for s in SURFACES}
        self.elig_idx = {(s, c): np.array([self.arm_index[s][a] for a in eligible(s, c)])
                         for s in SURFACES for c in CONTEXTS[s]}

    # ---- per-run endogenous state ----
    def fresh_state(self):
        return {s: {"trace": np.zeros(len(ARMS[s])), "used": np.zeros(len(ARMS[s]), dtype=bool)}
                for s in SURFACES}

    def state(self, t, opted_in=True):
        return State(str(self.surface[t]), self.context[t], bool(self.low_mood[t]), bool(self.risk[t]),
                     opted_in)

    def helpful_probs(self, t, endo):
        """P(session helpful | item used) for each eligible item, and own-taste scores."""
        s, c, w = str(self.surface[t]), self.context[t], self.world
        idx = self.elig_idx[(s, c)]
        taste = self.u[s][t, idx] + self.v[(s, c)][idx] + self.evening[t] * self.tod_w[s][idx]
        logit = (self.base + self.q[(s, c)] + taste
                 - w.habituation * endo[s]["trace"][idx]
                 + w.novelty * (~endo[s]["used"][idx])
                 + (w.low_mood_effect if self.low_mood[t] else 0.0))
        return sigmoid(logit), taste

    def choice_probs(self, taste, featured_idx):
        """Distribution of the item used when the person does not follow the featured one."""
        k = len(taste)
        order = np.concatenate(([featured_idx], np.delete(np.arange(k), featured_idx)))
        pos = np.empty(k)
        pos[order] = np.arange(k)
        wgt = np.exp(self.world.taste_beta * (taste - taste.max())) / (1.0 + pos)
        return wgt / wgt.sum()

    def session_value(self, p, taste, featured_idx):
        """Expected helpfulness of the session if this item is featured."""
        f = self.world.follow
        return f * p[featured_idx] + (1 - f) * float(self.choice_probs(taste, featured_idx) @ p)

    def best_value(self, p, taste):
        return max(self.session_value(p, taste, i) for i in range(len(p)))

    def step(self, t, endo, featured_idx):
        """Resolve one session. Returns (used_idx, outcome, reward_or_None, rating_or_None, value)."""
        s, w = str(self.surface[t]), self.world
        p, taste = self.helpful_probs(t, endo)
        value = self.session_value(p, taste, featured_idx)
        uf, uc, uy, ur = self.unif[t]
        if uf < w.follow:
            used = featured_idx
        else:
            cp = np.cumsum(self.choice_probs(taste, featured_idx))
            used = min(int(np.searchsorted(cp, uc, side="right")), len(p) - 1)
        y = int(uy < p[used])
        rated = ur < (w.rate_if_helpful if y else w.rate_if_not)
        reward = y if rated else None
        rating = None
        if rated:  # 4 or 5 if helpful, 1 to 3 otherwise; the value within the band is not modelled
            rating = (4 + int(uc > 0.5)) if y else (1 + int(uc * 3))
        g = self.elig_idx[(s, self.context[t])][used]
        for ss in SURFACES:
            endo[ss]["trace"] *= w.hab_decay
        endo[s]["trace"][g] += 1.0
        endo[s]["used"][g] = True
        return used, y, reward, rating, value


def run_user(env, policy, policy_rng, log=False, track_best=False):
    """Run one policy on one user. Returns per-step arrays and (optionally) a decision log."""
    T = env.T
    value = np.zeros(T)
    best = np.zeros(T) if track_best else None
    outcome = np.zeros(T, dtype=int)
    rated = np.zeros(T, dtype=bool)
    gated = np.zeros(T, dtype=bool)
    violations = 0
    records = []
    endo = env.fresh_state()
    for t in range(T):
        st = env.state(t)
        d = decide(policy, st, policy_rng)
        violations += len(audit(d, st))
        if track_best:
            p, taste = env.helpful_probs(t, endo)
            best[t] = env.best_value(p, taste)
        used, y, reward, rating, v = env.step(t, endo, d.action_index)
        value[t], outcome[t], rated[t], gated[t] = v, y, reward is not None, d.gated is not None
        if d.gated is None and reward is not None:
            policy.update(d.surface, d.context, d.eligible, d.eligible[used], reward)
        if log:
            records.append({"t": t, "surface": d.surface, "context": d.context, "eligible": d.eligible,
                            "probs": d.probs, "action": d.action, "action_index": d.action_index,
                            "propensity": d.propensity, "gated": d.gated, "used": d.eligible[used],
                            "rating": rating, "reward": reward, "outcome": y})
    out = {"value": value, "outcome": outcome, "rated": rated, "gated": gated, "violations": violations}
    if track_best:
        out["best"] = best
    if log:
        out["log"] = records
    return out
