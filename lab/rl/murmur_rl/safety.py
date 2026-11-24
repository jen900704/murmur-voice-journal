"""Safety filter and gate (POLICY_SPEC section 3). Every policy is called through decide()."""
from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np

from .catalog import eligible, allowed

GATE_REASONS = ("opt-out", "risk", "low-mood", "loss")


@dataclass(frozen=True)
class State:
    surface: str
    context: str
    low_mood: bool = False
    risk: bool = False
    opted_in: bool = True


@dataclass(frozen=True)
class Decision:
    surface: str
    context: str
    eligible: Tuple[str, ...]
    probs: Tuple[float, ...]
    action: str
    action_index: int
    propensity: float
    gated: Optional[str]


def gate_reason(state):
    """First applicable reason for not exploring, or None."""
    if not state.opted_in:
        return "opt-out"
    if state.risk:
        return "risk"
    if state.low_mood:
        return "low-mood"
    if state.surface == "lens" and state.context == "loss":
        return "loss"
    return None


def sample_index(probs, u):
    """Inverse-CDF draw with one uniform number; never returns a zero-probability index."""
    c = np.cumsum(probs)
    i = int(np.searchsorted(c, u * c[-1], side="right"))
    i = min(i, len(probs) - 1)
    while probs[i] <= 0.0:  # only reachable through floating point at the edges
        i -= 1
    return i


def decide(policy, state, rng):
    """Filter, gate, then (only if ungated) ask the policy for probabilities and sample.

    The policy only ever sees the eligible arms, so it cannot give weight to an excluded one.
    Gated decisions use no random numbers.
    """
    E = eligible(state.surface, state.context)
    reason = gate_reason(state)
    if reason is not None:
        probs = (1.0,) + (0.0,) * (len(E) - 1)
        return Decision(state.surface, state.context, E, probs, E[0], 0, 1.0, reason)
    p = np.asarray(policy.action_probs(state.surface, state.context, E, rng), dtype=float)
    if p.shape != (len(E),) or np.any(p < 0) or not np.isfinite(p).all() or abs(p.sum() - 1.0) > 1e-9:
        raise ValueError("policy returned an invalid probability vector")
    i = sample_index(p, rng.random())
    return Decision(state.surface, state.context, E, tuple(p.tolist()), E[i], i, float(p[i]), None)


def audit(decision, state):
    """Independent check used by the study and the tests. Returns a list of violations."""
    out = []
    ok = set(allowed(state.surface, state.context))
    if decision.action not in ok:
        out.append("excluded-arm-featured")
    if any(p > 0 and a not in ok for a, p in zip(decision.eligible, decision.probs)):
        out.append("excluded-arm-has-probability")
    if set(decision.eligible) != ok:
        out.append("eligible-set-mismatch")
    must_gate = (not state.opted_in) or state.risk or state.low_mood or (
        state.surface == "lens" and state.context == "loss")
    if must_gate:
        if decision.gated is None:
            out.append("explored-in-gated-state")
        if decision.action != decision.eligible[0] or decision.propensity != 1.0:
            out.append("gated-not-expert-first")
    elif decision.gated is not None:
        out.append("gated-without-reason")
    if abs(sum(decision.probs) - 1.0) > 1e-9:
        out.append("probs-do-not-sum-to-one")
    return out
