"""The preregistered simulation and the OPE checks. Called by run_study.py."""
import numpy as np

from .catalog import TOPICS, eligible
from .env import WORLDS, WORLD_NAMES, UserEnv, population_quality, run_user, sigmoid
from .policies import POLICY_NAMES, MurmurPolicy, ThompsonSampling, make_policy
from . import ope

MASTER_SEED = 20261124
HORIZONS = (30, 60, 90)
N_USERS = 1000
Z_PRIMARY = 2.394   # 98.33% two-sided, Bonferroni over three horizons
Z_95 = 1.96
MIN_GAIN_PER_SESSION = 0.03


def simulate_chunk(args):
    """Simulate users lo..hi-1 of one world under every policy. Pure function of its arguments."""
    world_name, lo, hi, horizon, seed = args
    w_idx = WORLD_NAMES.index(world_name)
    world = WORLDS[world_name]
    quality = population_quality(world)
    n, P = hi - lo, len(POLICY_NAMES)
    cum_value = np.zeros((P, n, horizon))
    cum_outcome = np.zeros((P, n, horizon))
    cum_best = np.zeros((n, horizon))
    viol = np.zeros(P, dtype=int)
    gated = np.zeros(P)
    rated = np.zeros(P)
    for j, i in enumerate(range(lo, hi)):
        env = UserEnv(world, np.random.SeedSequence([seed, w_idx, i]), horizon, quality)
        for p, name in enumerate(POLICY_NAMES):
            rng = np.random.default_rng(np.random.SeedSequence([seed, w_idx, i, 1 + p]))
            r = run_user(env, make_policy(name), rng, track_best=(name == "expert"))
            cum_value[p, j] = np.cumsum(r["value"])
            cum_outcome[p, j] = np.cumsum(r["outcome"])
            viol[p] += r["violations"]
            gated[p] += r["gated"].sum()
            rated[p] += r["rated"].sum()
            if name == "expert":
                cum_best[j] = np.cumsum(r["best"])
    return world_name, lo, cum_value, cum_outcome, cum_best, viol, gated, rated


def wilson(k, n, z=Z_95):
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return c - h, c + h


def summarise_world(world_name, cum_value, cum_outcome, cum_best, viol, gated, rated):
    """Rows for study_summary.csv and gain_curves.csv from per-user cumulative arrays."""
    e = POLICY_NAMES.index("expert")
    n, T = cum_value.shape[1], cum_value.shape[2]
    rows, curves = [], []
    for p, name in enumerate(POLICY_NAMES):
        gain = cum_value[p] - cum_value[e]             # (n, T)
        gain_real = cum_outcome[p] - cum_outcome[e]
        mean_curve = gain.mean(axis=0)
        se_curve = gain.std(axis=0, ddof=1) / np.sqrt(n)
        for t in range(T):
            curves.append({"world": world_name, "policy": name, "session": t + 1,
                           "mean_cum_gain": mean_curve[t], "se": se_curve[t]})
        pos = mean_curve > 0
        breakeven = ""
        if name != "expert" and pos[-1]:
            last_bad = np.where(~pos)[0]
            breakeven = int(last_bad[-1] + 2) if len(last_bad) else 1
        primary = world_name == "heterogeneous" and name == "murmur"
        z = Z_PRIMARY if primary else Z_95
        for H in HORIZONS:
            g = gain[:, H - 1]
            m, se = g.mean(), g.std(ddof=1) / np.sqrt(n)
            k_pos, k_neg = int((g > 1e-12).sum()), int((g < -1e-12).sum())
            lo, hi = wilson(k_pos, n)
            gr = gain_real[:, H - 1]
            rows.append({
                "world": world_name, "policy": name, "horizon": H, "n_users": n,
                "mean_gain": m, "gain_ci_lo": m - z * se, "gain_ci_hi": m + z * se,
                "ci_level": 0.9833 if primary else 0.95,
                "mean_regret_vs_expert": -m, "sd_gain": g.std(ddof=1),
                "p_beat": k_pos / n, "p_beat_lo": lo, "p_beat_hi": hi, "p_worse": k_neg / n,
                "p_beat_realised": float((gr > 0).mean()), "p_worse_realised": float((gr < 0).mean()),
                "mean_value_per_session": cum_value[p][:, H - 1].mean() / H,
                "expert_value_per_session": cum_value[e][:, H - 1].mean() / H,
                "headroom_per_session": (cum_best[:, H - 1] - cum_value[e][:, H - 1]).mean() / H,
                "breakeven_session": breakeven,
                "rule3_beats_on_average": bool(name != "expert" and m - z * se > 0),
                "rule4_large_enough": bool(name != "expert" and m >= MIN_GAIN_PER_SESSION * H),
                "rule5_most_users_benefit": bool(name != "expert" and lo > 0.5),
                "worse_on_average": bool(name != "expert" and m + z * se < 0),
                "violations": int(viol[p]), "gated_share": gated[p] / (n * T),
                "rated_share": rated[p] / (n * T),
            })
    return rows, curves


# ---------------------------------------------------------------- OPE validation

def ope_problem():
    """Stationary contextual bandit from the heterogeneous world's population effects
    (lens surface, the five ungated topics)."""
    q = population_quality(WORLDS["heterogeneous"])
    topics = [t for t in TOPICS if t != "loss"]
    V = np.array([sigmoid(q[("lens", t)]) for t in topics])   # (5, 14) true mean reward
    C, K = V.shape
    logging = np.full((C, K), 0.5 / K)
    logging[:, 0] += 0.5
    target = np.full((C, K), 0.2 / K)
    target[:, 1] += 0.8
    ctx_p = np.full(C, 1.0 / C)
    truth = float(ctx_p @ np.sum(target * V, axis=1))
    return V, logging, target, ctx_p, truth


def ope_validation(reps=500, sizes=(90, 500, 2000)):
    V, logging, target, ctx_p, truth = ope_problem()
    C, K = V.shape
    rows = []
    for n in sizes:
        est = {k: np.empty(reps) for k in ("ips", "snips", "dr", "ips_mnar_complete_case",
                                           "snips_mnar_complete_case")}
        for seed in range(reps):
            rng = np.random.default_rng([seed, n])
            ctx = rng.choice(C, size=n, p=ctx_p)
            u = rng.random(n)
            act = np.minimum((np.cumsum(logging[ctx], axis=1) < u[:, None]).sum(axis=1), K - 1)
            rew = (rng.random(n) < V[ctx, act]).astype(float)
            prop = logging[ctx, act]
            tp = target[ctx, act]
            est["ips"][seed] = ope.ips(tp, prop, rew)
            est["snips"][seed] = ope.snips(tp, prop, rew)
            est["dr"][seed] = ope.doubly_robust(ctx, act, prop, rew, target[ctx], C, K)
            miss = rng.random(n) >= np.where(rew == 1, 0.75, 0.45)
            r2 = rew.copy()
            r2[miss] = np.nan
            tpc, pc, rc = ope.complete_cases(tp, prop, reward=r2)
            est["ips_mnar_complete_case"][seed] = ope.ips(tpc, pc, rc) if len(rc) else np.nan
            est["snips_mnar_complete_case"][seed] = ope.snips(tpc, pc, rc) if len(rc) else np.nan
        for k, v in est.items():
            sd = np.nanstd(v, ddof=1)
            bias = np.nanmean(v) - truth
            rows.append({"n": n, "estimator": k, "truth": truth, "mean": np.nanmean(v), "bias": bias,
                         "mc_se_bias": sd / np.sqrt(reps), "sd": sd,
                         "rmse": float(np.sqrt(np.nanmean((v - truth) ** 2))), "reps": reps})
    return rows


def ope_adaptive(reps=2000, sizes=(90, 500)):
    means = np.array([0.5, 0.5, 0.5])
    loggers = {
        "ts_floor_0.01": lambda: ThompsonSampling(gamma=1.0, floor=0.01, n0=3.0),
        "murmur": lambda: MurmurPolicy(),
    }
    rows = []
    for T in sizes:
        for lname, mk in loggers.items():
            res = ope.adaptive_coverage_check(mk, means, T, arm=1, reps=reps, seed=1000 + T)
            for est, d in res.items():
                rows.append({"logging_policy": lname, "T": T, "estimator": est, "truth": 0.5,
                             "coverage_95": d["coverage"], "bias": d["bias"], "sd": d["sd"],
                             "mc_se_coverage": float(np.sqrt(d["coverage"] * (1 - d["coverage"]) / reps)),
                             "reps": reps})
    return rows
