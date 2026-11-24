"""Off-policy evaluation for featured-item logs.

Notation: for logged session i, e_i is the logged propensity of the featured item, pi_i the
target policy's probability of that same item, w_i = pi_i / e_i, r_i the reward.

Point estimators: ips, snips, doubly_robust.

Inference. The usual standard error (sd of the scores / sqrt(n)) assumes the sessions are
independent and identically distributed. That holds for logs from a fixed logging policy. It
does not hold for logs collected by a bandit, because each propensity depends on earlier
rewards: the scores are then a martingale difference sequence whose variance changes over
time, the estimate is not asymptotically normal in general, and normal intervals can
under-cover (see `adaptive_coverage_check`, run by run_study.py). `adaptive_weighted`
implements the variance-stabilising weighting of Hadad et al. (2021, PNAS) for the value of
one arm, and of Zhan et al. (2021, KDD) in its contextual form (both cited from memory; check
the references before relying on them). It is validated here only on a non-contextual problem.
Confidence intervals for contextual policy values from adaptively collected Murmur logs are
OUT OF SCOPE for this module: use the point estimates as descriptions, not as tests.

Missing rewards are never treated as zero. Estimators take complete cases (see
`complete_cases`), which is biased when missingness depends on the outcome; run_study.py
reports the size of that bias in the simulator.
"""
import numpy as np


def complete_cases(*arrays, reward):
    """Drop sessions whose reward is missing (NaN). Returns the filtered arrays and reward."""
    keep = ~np.isnan(reward)
    return tuple(np.asarray(a)[keep] for a in arrays) + (np.asarray(reward)[keep],)


def _check(prop):
    prop = np.asarray(prop, dtype=float)
    if np.any(prop <= 0) or np.any(prop > 1 + 1e-12):
        raise ValueError("propensities must be in (0, 1]")
    return prop


def ips(target_prob, prop, reward):
    """Inverse propensity score estimate of the target policy's value."""
    w = np.asarray(target_prob, dtype=float) / _check(prop)
    return float(np.mean(w * reward))


def snips(target_prob, prop, reward):
    """Self-normalised IPS: biased in small samples, lower variance, stays inside [0, 1]."""
    w = np.asarray(target_prob, dtype=float) / _check(prop)
    return float(np.sum(w * reward) / np.sum(w)) if np.sum(w) > 0 else float("nan")


def fit_reward_table(ctx, act, reward, n_ctx, n_act, prior_mean=None, strength=2.0):
    """Simple reward model: smoothed mean reward per (context, item)."""
    if prior_mean is None:
        prior_mean = float(np.mean(reward)) if len(reward) else 0.5
    s = np.zeros((n_ctx, n_act))
    n = np.zeros((n_ctx, n_act))
    np.add.at(s, (ctx, act), reward)
    np.add.at(n, (ctx, act), 1.0)
    return (s + strength * prior_mean) / (n + strength)


def dr_scores(ctx, act, prop, reward, target_probs, qhat):
    """Doubly robust score per session. target_probs: (n, n_act); qhat: (n, n_act)."""
    i = np.arange(len(act))
    w = target_probs[i, act] / _check(prop)
    return np.sum(target_probs * qhat, axis=1) + w * (reward - qhat[i, act])


def doubly_robust(ctx, act, prop, reward, target_probs, n_ctx, n_act, folds=2):
    """Doubly robust estimate with a cross-fitted table reward model (fold = index mod folds)."""
    ctx, act = np.asarray(ctx), np.asarray(act)
    reward = np.asarray(reward, dtype=float)
    fold = np.arange(len(act)) % folds
    qhat = np.empty((len(act), n_act))
    for k in range(folds):
        tr, te = fold != k, fold == k
        table = fit_reward_table(ctx[tr], act[tr], reward[tr], n_ctx, n_act)
        qhat[te] = table[ctx[te]]
    return float(np.mean(dr_scores(ctx, act, prop, reward, target_probs, qhat)))


def normal_ci(scores, z=1.96):
    """Estimate and the usual i.i.d. interval. Not valid for adaptively collected logs."""
    est = float(np.mean(scores))
    se = float(np.std(scores, ddof=1) / np.sqrt(len(scores)))
    return est, est - z * se, est + z * se


def adaptive_weighted(scores, h, z=1.96):
    """Adaptively weighted estimate sum(h * score) / sum(h) with a studentised interval.

    scores must be built so that score_t uses only data before t for its reward model
    (see sequential_arm_scores). h_t must depend only on data before t. For the value of one
    arm, h_t = sqrt(e_t(arm)); for a policy pi in a contextual problem,
    h_t = 1 / sqrt(sum_a pi(a|x_t)^2 / e_t(a|x_t))  (stabilised_weights)."""
    scores, h = np.asarray(scores, dtype=float), np.asarray(h, dtype=float)
    est = float(np.sum(h * scores) / np.sum(h))
    se = float(np.sqrt(np.sum(h ** 2 * (scores - est) ** 2)) / np.sum(h))
    return est, est - z * se, est + z * se


def stabilised_weights(target_probs, logged_probs):
    """h_t = 1 / sqrt(sum_a pi(a|x_t)^2 / e_t(a|x_t)); items with pi = 0 contribute nothing."""
    tp, lp = np.asarray(target_probs, dtype=float), np.asarray(logged_probs, dtype=float)
    ratio = np.divide(tp ** 2, lp, out=np.zeros_like(tp), where=tp > 0)
    return 1.0 / np.sqrt(ratio.sum(axis=1))


def sequential_arm_scores(act, prop_arm, reward, arm, use_model=True):
    """Scores for the value of one arm from a bandit log, using only the past at each step.

    prop_arm[t] is the logged probability of `arm` at step t (whether or not it was chosen).
    With use_model the score is the doubly robust one with the running mean of the arm's past
    rewards as the model; without, it is the plain IPS score."""
    T = len(act)
    out = np.empty(T)
    s = n = 0.0
    for t in range(T):
        m = (s / n if n > 0 else 0.0) if use_model else 0.0
        hit = act[t] == arm
        out[t] = m + (reward[t] - m) / prop_arm[t] if hit else m
        if hit:
            s += reward[t]
            n += 1.0
    return out


def simulate_bandit_log(policy, means, T, rng):
    """Run a policy from murmur_rl.policies on a plain K-armed Bernoulli bandit (no gate, no
    context) and return actions, full probability vectors and rewards."""
    k = len(means)
    arms = tuple(f"a{i}" for i in range(k))
    act = np.empty(T, dtype=int)
    probs = np.empty((T, k))
    rew = np.empty(T)
    for t in range(T):
        p = policy.action_probs("toy", "toy", arms, rng)
        a = int(rng.choice(k, p=p))
        r = float(rng.random() < means[a])
        policy.update("toy", "toy", arms, arms[a], int(r))
        act[t], probs[t], rew[t] = a, p, r
    return act, probs, rew


def adaptive_coverage_check(make_policy, means, T, arm, reps, seed, z=1.96):
    """Coverage of three intervals for the value of one arm from adaptively collected logs:
    IPS with the usual interval, sequential DR with the usual interval, and adaptively
    weighted sequential DR. Returns a dict of coverage, mean estimate and sd per method."""
    truth = means[arm]
    names = ("ips_normal", "dr_normal", "dr_adaptive_weighted")
    est = {n: np.empty(reps) for n in names}
    cover = {n: np.zeros(reps, dtype=bool) for n in names}
    for r in range(reps):
        rng = np.random.default_rng([seed, r])
        act, probs, rew = simulate_bandit_log(make_policy(), means, T, rng)
        e = probs[:, arm]
        s_ips = sequential_arm_scores(act, e, rew, arm, use_model=False)
        s_dr = sequential_arm_scores(act, e, rew, arm, use_model=True)
        for n, res in (("ips_normal", normal_ci(s_ips, z)), ("dr_normal", normal_ci(s_dr, z)),
                       ("dr_adaptive_weighted", adaptive_weighted(s_dr, np.sqrt(e), z))):
            est[n][r] = res[0]
            cover[n][r] = res[1] <= truth <= res[2]
    return {n: {"coverage": float(cover[n].mean()), "mean": float(est[n].mean()),
                "bias": float(est[n].mean() - truth), "sd": float(est[n].std(ddof=1)),
                # share of replicates whose interval misses on each side
                } for n in names}
