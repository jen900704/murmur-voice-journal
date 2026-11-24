#!/usr/bin/env python3
"""Run the preregistered study (PREREG.md) and write lab/rl/results/ and lab/rl/RESULTS.md.

    python3 lab/rl/run_study.py            # full study, a few minutes on two cores
    python3 lab/rl/run_study.py --quick    # 60 users per world, fewer replicates; smoke test,
                                           # writes to results/quick/ and no RESULTS.md

Same seed, same numbers: every user and replicate has its own seed, so the result does not
depend on the number of worker processes.
"""
import argparse
import csv
import os
import sys
import time
from multiprocessing import Pool

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from murmur_rl import study  # noqa: E402
from murmur_rl.env import WORLD_NAMES  # noqa: E402
from murmur_rl.policies import POLICY_NAMES  # noqa: E402

LEARNED = [p for p in POLICY_NAMES if p != "expert"]
COLORS = dict(zip(LEARNED, ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"]))
INK, MUTED, GRID, SURFACE = "#1f1f1e", "#6b6a64", "#e4e3de", "#fcfcfb"


def write_csv(path, rows):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        for r in rows:
            w.writerow({k: (f"{v:.6g}" if isinstance(v, (float, np.floating)) else v) for k, v in r.items()})


def _adaptive_task(args):
    reps, T = args
    return study.ope_adaptive(reps=reps, sizes=(T,))


def run(n_users, ope_reps, adaptive_reps, workers, chunk=50):
    tasks = [(w, lo, min(lo + chunk, n_users), 90, study.MASTER_SEED)
             for w in WORLD_NAMES for lo in range(0, n_users, chunk)]
    parts = {w: [] for w in WORLD_NAMES}
    with Pool(workers) as pool:
        adaptive_async = pool.map_async(_adaptive_task, [(adaptive_reps, T) for T in (90, 500)])
        for res in pool.imap_unordered(study.simulate_chunk, tasks):
            parts[res[0]].append(res)
        adaptive = [r for part in adaptive_async.get() for r in part]
    summary, curves = [], []
    for w in WORLD_NAMES:
        ps = sorted(parts[w], key=lambda r: r[1])  # order by first user index: deterministic
        cv = np.concatenate([p[2] for p in ps], axis=1)
        co = np.concatenate([p[3] for p in ps], axis=1)
        cb = np.concatenate([p[4] for p in ps], axis=0)
        rows, cur = study.summarise_world(w, cv, co, cb, sum(p[5] for p in ps),
                                          sum(p[6] for p in ps), sum(p[7] for p in ps))
        summary += rows
        curves += cur
    return summary, curves, study.ope_validation(reps=ope_reps), adaptive


def figures(out, summary, curves):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception:
        return []
    plt.rcParams.update({"font.size": 9, "axes.edgecolor": GRID, "axes.labelcolor": MUTED,
                         "xtick.color": MUTED, "ytick.color": MUTED, "text.color": INK,
                         "figure.facecolor": SURFACE, "axes.facecolor": SURFACE,
                         "savefig.facecolor": SURFACE})
    made = []
    # 1. cumulative gain curves, one panel per world (shared y axis)
    fig, axes = plt.subplots(1, 4, figsize=(13, 4.0), sharey=True)
    panel_ends = []
    for ax, w in zip(axes, WORLD_NAMES):
        ends = []
        for p in LEARNED:
            c = [r for r in curves if r["world"] == w and r["policy"] == p]
            x = np.array([r["session"] for r in c])
            y = np.array([r["mean_cum_gain"] for r in c])
            se = np.array([r["se"] for r in c])
            ax.fill_between(x, y - 1.96 * se, y + 1.96 * se, color=COLORS[p], alpha=0.12, linewidth=0)
            ax.plot(x, y, color=COLORS[p], linewidth=2, label=p)
            ends.append((y[-1], p))
        ax.axhline(0, color=MUTED, linewidth=1)
        for h in (30, 60):
            ax.axvline(h, color=GRID, linewidth=1, zorder=0)
        # direct labels at the line ends, nudged apart
        ends.sort()
        panel_ends.append((ax, ends))
        ax.set_xlim(1, 125)
        ax.set_xticks([1, 30, 60, 90])
        ax.set_title(w, loc="left", fontsize=10)
        ax.set_xlabel("session")
        ax.grid(axis="y", color=GRID, linewidth=0.6)
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
    # direct labels at the line ends: spread to a minimum gap, then re-centred on the lines
    ylo, yhi = axes[0].get_ylim()
    gap = 0.05 * (yhi - ylo)
    for ax, ends in panel_ends:
        pos = []
        for yv, _ in ends:
            pos.append(yv if not pos else max(yv, pos[-1] + gap))
        shift = np.mean([e[0] for e in ends]) - np.mean(pos)
        for (yv, p), yy in zip(ends, pos):
            ax.plot([90.5, 93.5], [yv, yy + shift], color=COLORS[p], linewidth=0.8)
            ax.text(94.5, yy + shift, p, color=INK, fontsize=7.5, va="center")
    axes[0].set_ylim(ylo, yhi)
    axes[0].set_ylabel("mean cumulative gain over expert order\n(expected helpful sessions)")
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, frameon=False, fontsize=8, ncol=5, loc="upper right",
               bbox_to_anchor=(0.995, 0.93))
    fig.suptitle("Learned policies against the expert order, simulated users (band: 95% interval of the mean)",
                 x=0.01, ha="left", fontsize=10.5)
    fig.tight_layout(rect=(0, 0, 1, 0.88))
    path = os.path.join(out, "gain_curves.png")
    fig.savefig(path, dpi=150)
    plt.close(fig)
    made.append(path)

    # 2. share of users better / worse off under the primary policy
    fig, axes = plt.subplots(1, 4, figsize=(13, 3.6), sharey=True)
    for ax, w in zip(axes, WORLD_NAMES):
        rs = [r for r in summary if r["world"] == w and r["policy"] == "murmur"]
        x = np.arange(len(rs))
        better = [r["p_beat"] for r in rs]
        worse = [r["p_worse"] for r in rs]
        ax.bar(x - 0.2, better, width=0.36, color="#2a78d6", label="better off than under expert order")
        ax.bar(x + 0.2, worse, width=0.36, color="#eb6834", label="worse off")
        for xi, b, wv in zip(x, better, worse):
            ax.text(xi - 0.2, b + 0.015, f"{b:.2f}".lstrip("0"), ha="center", fontsize=8, color=INK)
            ax.text(xi + 0.2, wv + 0.015, f"{wv:.2f}".lstrip("0"), ha="center", fontsize=8, color=INK)
        ax.axhline(0.5, color=MUTED, linewidth=1, linestyle=(0, (3, 3)))
        ax.set_xticks(x)
        ax.set_xticklabels([f"{r['horizon']} sessions" for r in rs])
        ax.set_ylim(0, 1.08)
        ax.set_yticks([0, 0.25, 0.5, 0.75, 1.0])
        ax.set_title(w, loc="left", fontsize=10)
        ax.grid(axis="y", color=GRID, linewidth=0.6)
        ax.set_axisbelow(True)
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
    axes[0].set_ylabel("share of simulated users")
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, frameon=False, fontsize=8, ncol=2, loc="upper right",
               bbox_to_anchor=(0.995, 0.92))
    fig.suptitle("Policy `murmur`: share of users with higher or lower expected helpfulness than under the expert order",
                 x=0.01, ha="left", fontsize=10.5)
    fig.tight_layout(rect=(0, 0, 1, 0.86))
    path = os.path.join(out, "share_better_worse.png")
    fig.savefig(path, dpi=150)
    plt.close(fig)
    made.append(path)
    return made


def f2(x):
    return f"{x:+.2f}"


def p2(x):
    s = f"{x:.2f}"
    return s[1:] if s.startswith("0") else s


def results_md(summary, opeval, adaptive, figs, n_users, elapsed):
    def row(w, p, H):
        return next(r for r in summary if r["world"] == w and r["policy"] == p and r["horizon"] == H)

    L = []
    A = L.append
    A("# Results: learned featured-item policy against the expert order")
    A("")
    A("Generated by `run_study.py` from the preregistered design in `PREREG.md`. Every number comes "
      "from synthetic users whose parameters are assumptions. None of it is evidence about real people.")
    A("")
    viol = sum(r["violations"] for r in summary if r["horizon"] == 90)
    null_fail = [r for r in summary if r["world"] == "null" and r["rule3_beats_on_average"]]
    A("## Checks that gate everything else")
    A("")
    A(f"- **Safety-filter violations: {viol}** across {len(WORLD_NAMES)} worlds, {len(POLICY_NAMES)} policies, "
      f"{n_users} users and 90 sessions each ({len(WORLD_NAMES) * len(POLICY_NAMES) * n_users * 90:,} decisions). "
      + ("Rule 1 is met." if viol == 0 else "**Rule 1 FAILED. Nothing below should be interpreted.**"))
    A("- **Negative control (null world):** "
      + ("no learned policy shows a gain interval above zero at any horizon. Rule 2 is met."
         if not null_fail else
         "**Rule 2 FAILED** for " + ", ".join(f"{r['policy']} at {r['horizon']}" for r in null_fail)
         + ". Nothing below should be interpreted."))
    g = row("heterogeneous", "murmur", 90)
    A(f"- About {p2(g['gated_share'])} of sessions were gated (low mood, risk, or the loss topic) and "
      f"showed the expert's first item. About {p2(g['rated_share'])} of sessions were rated.")
    A("")
    A("## Main finding (primary policy `murmur`, primary world `heterogeneous`)")
    A("")
    prim = [row("heterogeneous", "murmur", H) for H in study.HORIZONS]
    answer = next((r["horizon"] for r in prim if r["rule3_beats_on_average"] and r["rule5_most_users_benefit"]), None)
    if answer is None:
        A("**Under the primary assumptions the learned policy does not beat the expert order within 90 "
          "interactions by the preregistered rule** (rule 6: the mean gain interval above zero and most "
          "users better off, at the same horizon).")
    else:
        big = row("heterogeneous", "murmur", answer)["rule4_large_enough"]
        A(f"**Under the primary assumptions the learned policy beats the expert order from {answer} "
          f"interactions by the preregistered rule** (rules 3 and 5). The gain at that horizon is "
          + ("at least" if big else "smaller than") + " the preregistered smallest gain that matters (rule 4).")
    A("")
    A("| Horizon | Mean gain (98.33% interval) | Regret vs expert | Rule 3: beats on average | Rule 4: at least .03 per session | Share of users better off (95% interval) | Share worse off | Rule 5: most users benefit |")
    A("|---|---|---|---|---|---|---|---|")
    for r in prim:
        A(f"| {r['horizon']} | {f2(r['mean_gain'])} ({f2(r['gain_ci_lo'])} to {f2(r['gain_ci_hi'])}) | "
          f"{f2(r['mean_regret_vs_expert'])} | {'yes' if r['rule3_beats_on_average'] else 'no'}"
          f"{' (worse)' if r['worse_on_average'] else ''} | "
          f"{'yes' if r['rule4_large_enough'] else 'no'} (needs {f2(study.MIN_GAIN_PER_SESSION * r['horizon'])}) | "
          f"{p2(r['p_beat'])} ({p2(r['p_beat_lo'])} to {p2(r['p_beat_hi'])}) | {p2(r['p_worse'])} | "
          f"{'yes' if r['rule5_most_users_benefit'] else 'no'} |")
    A("")
    A("Gain is in expected helpful sessions, summed over the horizon, learned policy minus expert order, "
      "for the same simulated user on the same days. Regret is the same number with the sign flipped.")
    r90 = prim[-1]
    A("")
    A(f"For scale: the expert order's expected helpfulness per session in this world is "
      f"{p2(r90['expert_value_per_session'])}, and a policy that knew each user's best item every day would add "
      f"{p2(r90['headroom_per_session'])} per session ({f2(r90['headroom_per_session'] * 90)} over 90 sessions). "
      f"The learned policy captured {f2(r90['mean_gain'])} of that. "
      f"Counting realised helpful sessions instead of expected ones (what a person would actually live through), "
      f"{p2(r90['p_beat_realised'])} of users had more helpful sessions than under the expert order at 90 and "
      f"{p2(r90['p_worse_realised'])} had fewer, so one person could not tell the difference from their own experience.")
    be = r90["breakeven_session"]
    A("")
    A("Break-even (descriptive): " + (f"the mean cumulative gain stays above zero from session {be} on."
                                       if be != "" else "the mean cumulative gain is not above zero at session 90."))
    A("")
    A("## All worlds and policies at each horizon")
    A("")
    A("Intervals here are 95% and exploratory, except the primary rows above.")
    for w in WORLD_NAMES:
        A("")
        A(f"### `{w}`")
        A("")
        A("| Policy | Gain at 30 | Gain at 60 | Gain at 90 (interval) | Better off at 90 | Worse off at 90 | Break-even session |")
        A("|---|---|---|---|---|---|---|")
        for p in LEARNED:
            a, b, c = (row(w, p, H) for H in study.HORIZONS)
            A(f"| `{p}` | {f2(a['mean_gain'])} | {f2(b['mean_gain'])} | {f2(c['mean_gain'])} "
              f"({f2(c['gain_ci_lo'])} to {f2(c['gain_ci_hi'])}) | {p2(c['p_beat'])} | {p2(c['p_worse'])} | "
              f"{c['breakeven_session'] if c['breakeven_session'] != '' else 'none'} |")
        c = row(w, "murmur", 90)
        A("")
        A(f"Expert order: {p2(c['expert_value_per_session'])} expected helpfulness per session. "
          f"Headroom to the best item each day: {p2(c['headroom_per_session'])} per session.")
    A("")
    A("## Off-policy evaluation check")
    A("")
    A(f"Known target value {opeval[0]['truth']:.4f}; logs from a different, fixed logging policy; "
      f"{opeval[0]['reps']} replicates per sample size.")
    A("")
    A("| n | Estimator | Bias | MC s.e. of bias | SD | RMSE |")
    A("|---|---|---|---|---|---|")
    for r in opeval:
        A(f"| {r['n']} | `{r['estimator']}` | {r['bias']:+.4f} | {r['mc_se_bias']:.4f} | {r['sd']:.4f} | {r['rmse']:.4f} |")
    A("")
    ips_ok = all(abs(r["bias"]) <= 2 * r["mc_se_bias"] for r in opeval if r["estimator"] == "ips")
    A("IPS bias is " + ("within two Monte Carlo standard errors of zero at every n, as expected."
                        if ips_ok else "NOT within two Monte Carlo standard errors of zero at every n; see the table.")
      + " The `mnar_complete_case` rows analyse only rated sessions when helpful sessions are rated more often "
        "(.75 against .45): the bias does not shrink with n, because it comes from the missingness and not from "
        "the estimator. Values estimated from real ratings will be too high in the same way.")
    A("")
    A("### Adaptively collected logs and confidence intervals")
    A("")
    A("Three equal arms (true value .5), target: the value of arm 1. Nominal coverage is .95.")
    A("")
    A("| Logging policy | T | Estimator and interval | Coverage | Bias | SD |")
    A("|---|---|---|---|---|---|")
    for r in adaptive:
        A(f"| `{r['logging_policy']}` | {r['T']} | `{r['estimator']}` | {p2(r['coverage_95'])} | {r['bias']:+.3f} | {r['sd']:.3f} |")
    A("")
    def cov(est, T):
        v = [r["coverage_95"] for r in adaptive if r["estimator"] == est and r["T"] == T]
        return f"{p2(min(v))} to {p2(max(v))}" if min(v) != max(v) else p2(v[0])

    Ts = sorted({r["T"] for r in adaptive})
    short, long_ = Ts[0], Ts[-1]
    aw_short = min(r["coverage_95"] for r in adaptive if r["estimator"] == "dr_adaptive_weighted" and r["T"] == short)
    A(f"At T = {short}, about the length of one person's log, the usual IPS interval covers the truth "
      f"{cov('ips_normal', short)} of the time and the usual doubly robust interval {cov('dr_normal', short)}, "
      f"against a nominal .95 (Monte Carlo error about .005 to .008). At T = {long_} the figures are "
      f"{cov('ips_normal', long_)} and {cov('dr_normal', long_)}. The point estimates are close to unbiased; it is "
      "the intervals that are too narrow. Propensities here depend on earlier rewards, so the scores are not "
      "independent draws with one variance, which is what the usual interval assumes. This check cannot separate "
      "that from the plain small-sample problem of a few heavily weighted observations.")
    A("")
    A(f"The adaptively weighted estimator has the smallest spread, but at T = {short} its coverage is "
      f"{cov('dr_adaptive_weighted', short)}"
      + (", so it does not restore nominal coverage at this length either" if aw_short < 0.94 else "")
      + ", and it carries a small downward bias. It was checked only on this non-contextual problem. "
        "**Confidence intervals from one person's adaptively collected log should not be reported.** "
        "Intervals for contextual policy values from such logs are out of scope for this module.")
    A("")
    A("## What this does and does not show")
    A("")
    A("- It shows how these policies behave against the expert order when users are built as `murmur_rl/env.py` "
      "builds them. The size of person-to-person differences, the drift, the follow rate and the rating model are "
      "assumptions. Different assumptions give different answers; the `strong` and `misspecified` worlds show how far.")
    A("- It does not show that personalisation helps or fails to help real people, and it does not justify turning "
      "exploration on for anyone but the owner.")
    A("- The safety result is a property of this code under these inputs. The in-app policy needs its own tests "
      "against `POLICY_SPEC.md` section 10.")
    A("")
    A("## Deviations from the preregistration")
    A("")
    A("DEVIATIONS_PLACEHOLDER")
    A("")
    A("## Files")
    A("")
    A("- `results/study_summary.csv`: one row per world, policy and horizon.")
    A("- `results/gain_curves.csv`: mean cumulative gain at every session.")
    A("- `results/ope_validation.csv`, `results/ope_adaptive.csv`: the two tables above.")
    for f in figs:
        A(f"- `results/{os.path.basename(f)}`")
    A("")
    A(f"Run: {n_users} users per world, master seed {study.MASTER_SEED}."
      + (f" This run took about {elapsed / 60:.0f} minutes." if elapsed else ""))
    return "\n".join(L) + "\n"


def write_results(summary, opeval, adaptive, figs, n_users, elapsed):
    """RESULTS.md; the deviations section is read from DEVIATIONS.md if that file exists."""
    md = results_md(summary, opeval, adaptive, figs, n_users, elapsed)
    dev_path = os.path.join(HERE, "DEVIATIONS.md")
    dev = "None."
    if os.path.exists(dev_path):
        with open(dev_path) as f:
            dev = f.read().strip()
    with open(os.path.join(HERE, "RESULTS.md"), "w") as f:
        f.write(md.replace("DEVIATIONS_PLACEHOLDER", dev))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 1)
    ap.add_argument("--from-csv", action="store_true",
                    help="rewrite the figures and RESULTS.md from the CSV files without re-simulating")
    a = ap.parse_args()
    t0 = time.time()
    out = os.path.join(HERE, "results", "quick") if a.quick else os.path.join(HERE, "results")
    os.makedirs(out, exist_ok=True)
    if a.from_csv:
        def conv(v):
            if v in ("True", "False"):
                return v == "True"
            for cast in (int, float):
                try:
                    return cast(v)
                except ValueError:
                    pass
            return v

        def load(name):
            with open(os.path.join(out, name), newline="") as f:
                return [{k: conv(v) for k, v in r.items()} for r in csv.DictReader(f)]
        summary = load("study_summary.csv")
        figs = figures(out, summary, load("gain_curves.csv"))
        if not a.quick:
            write_results(summary, load("ope_validation.csv"), load("ope_adaptive.csv"), figs,
                          summary[0]["n_users"], None)
        print("rewrote figures" + ("" if a.quick else " and RESULTS.md") + " from the CSV files")
        return 0
    n_users, ope_reps, ad_reps = (60, 50, 100) if a.quick else (study.N_USERS, 500, 2000)
    summary, curves, opeval, adaptive = run(n_users, ope_reps, ad_reps, a.workers)
    write_csv(os.path.join(out, "study_summary.csv"), summary)
    write_csv(os.path.join(out, "gain_curves.csv"), curves)
    write_csv(os.path.join(out, "ope_validation.csv"), opeval)
    write_csv(os.path.join(out, "ope_adaptive.csv"), adaptive)
    figs = figures(out, summary, curves)
    elapsed = time.time() - t0
    if not a.quick:
        write_results(summary, opeval, adaptive, figs, n_users, elapsed)
    viol = sum(r["violations"] for r in summary if r["horizon"] == 90)
    print(f"done in {elapsed:.0f}s; wrote {out}; safety violations: {viol}")
    return 1 if viol else 0


if __name__ == "__main__":
    sys.exit(main())
