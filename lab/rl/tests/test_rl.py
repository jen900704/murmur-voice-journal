"""Unit tests for lab/rl. Run from the repository root:

    python3 -m unittest discover lab/rl/tests
"""
import os
import re
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from murmur_rl import catalog, ope, study  # noqa: E402
from murmur_rl.env import WORLDS, UserEnv, population_quality, run_user  # noqa: E402
from murmur_rl.policies import (EPS, GAMMA, KAPPA, POLICY_NAMES, EpsilonGreedy, ExpertPolicy,  # noqa: E402
                                MurmurPolicy, ThompsonSampling, make_policy, ts_probs_mc, ts_probs_quad)
from murmur_rl.safety import State, audit, decide, gate_reason  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ALL_CONTEXTS = [(s, c) for s in catalog.SURFACES for c in catalog.CONTEXTS[s]]


def trained(policy, rng, n=200):
    """Feed a policy random rated sessions in every context so its posteriors are not the prior."""
    for _ in range(n):
        s, c = ALL_CONTEXTS[int(rng.integers(len(ALL_CONTEXTS)))]
        E = catalog.eligible(s, c)
        policy.update(s, c, E, E[int(rng.integers(len(E)))], int(rng.random() < 0.5))
    return policy


class CatalogTests(unittest.TestCase):
    def test_sizes(self):
        self.assertEqual(len(catalog.LENSES), 14)
        self.assertEqual(len(catalog.TRACKS), 9)
        self.assertEqual(len(catalog.eligible("lens", "loss")), 5)
        self.assertEqual(len(catalog.eligible("lens", "work")), 14)

    def test_expert_order_starts_with_topic_common(self):
        for topic, first in catalog.TOPIC_COMMON.items():
            self.assertEqual(list(catalog.eligible("lens", topic)[:len(first)]), first)
        for theme, track in catalog.THEME_TRACK.items():
            self.assertEqual(catalog.eligible("track", theme)[0], track)
        self.assertEqual(list(catalog.eligible("lens", "other")), catalog.LENSES)

    def test_matches_javascript_sources(self):
        lenses_js = os.path.join(REPO, "js", "lenses.js")
        bedtime_js = os.path.join(REPO, "js", "bedtime.js")
        if not (os.path.exists(lenses_js) and os.path.exists(bedtime_js)):
            self.skipTest("JavaScript sources not present")
        with open(lenses_js, encoding="utf-8") as fh:
            src = fh.read()
        body = src[src.index("export const LENSES"):src.index("export function lensesForTopic")]
        ids = re.findall(r"^\s{4}id: '([a-z-]+)'", body, flags=re.M)
        excl = re.findall(r"excludeTopics: \[([^\]]*)\]", body)
        self.assertEqual(ids, catalog.LENSES)
        self.assertEqual({i for i, e in zip(ids, excl) if "'loss'" in e}, catalog.LOSS_EXCLUDED)
        self.assertTrue(all(e.strip() in ("", "'loss'") for e in excl), "a new exclusion was added in js")
        block = src[src.index("export const TOPIC_COMMON"):]
        block = block[:block.index("};")]
        common = {k: re.findall(r"'([a-z-]+)'", v) for k, v in re.findall(r"(\w+): \[([^\]]*)\]", block)}
        self.assertEqual(common, catalog.TOPIC_COMMON)
        topics = re.search(r"export const TOPICS = \[([^\]]*)\]", src).group(1)
        self.assertEqual(re.findall(r"'([a-z-]+)'", topics), catalog.TOPICS)
        with open(bedtime_js, encoding="utf-8") as fh:
            b = fh.read()
        tb = b[b.index("export const TRACKS"):b.index("export function trackById")]
        self.assertEqual(re.findall(r"^\s{4}id: '([a-z-]+)'", tb, flags=re.M), catalog.TRACKS)
        tt = re.search(r"export const THEME_TRACK = \{([^}]*)\}", b).group(1)
        self.assertEqual(dict(re.findall(r"(\w+): '([a-z-]+)'", tt)), catalog.THEME_TRACK)
        themes = re.search(r"export const THEMES = \[([^\]]*)\]", b).group(1)
        self.assertEqual(re.findall(r"'([a-z-]+)'", themes) + ["none"], catalog.THEMES)


class PropensityTests(unittest.TestCase):
    def test_probabilities_sum_to_one_for_every_policy_and_context(self):
        rng = np.random.default_rng(1)
        for name in POLICY_NAMES:
            for fresh in (True, False):
                pol = make_policy(name) if fresh else trained(make_policy(name), rng)
                for s, c in ALL_CONTEXTS:
                    d = decide(pol, State(s, c), rng)
                    self.assertAlmostEqual(sum(d.probs), 1.0, places=9)
                    self.assertEqual(len(d.probs), len(catalog.eligible(s, c)))
                    self.assertTrue(all(p >= 0 for p in d.probs))
                    self.assertAlmostEqual(d.propensity, d.probs[d.action_index], places=12)

    def test_logged_propensities_match_empirical_frequencies(self):
        rng = np.random.default_rng(2)
        n = 40000
        for name in ("murmur", "ts", "eps_greedy", "linucb"):
            pol = trained(make_policy(name), rng, 300)
            st = State("lens", "work")
            first = decide(pol, st, rng)
            counts = np.zeros(len(first.eligible))
            for _ in range(n):
                d = decide(pol, st, rng)          # no updates, so the vector does not change
                self.assertEqual(d.probs, first.probs)
                counts[d.action_index] += 1
            p = np.array(first.probs)
            se = np.sqrt(p * (1 - p) / n)
            self.assertTrue(np.all(np.abs(counts / n - p) <= 4.5 * se + 1e-9), name)

    def test_quadrature_matches_monte_carlo(self):
        rng = np.random.default_rng(3)
        for _ in range(5):
            k = int(rng.integers(3, 15))
            a, b = 1 + 10 * rng.random(k), 1 + 10 * rng.random(k)
            q, m = ts_probs_quad(a, b), ts_probs_mc(a, b, rng, 200000)
            self.assertAlmostEqual(q.sum(), 1.0, places=12)
            self.assertLess(np.abs(q - m).max(), 0.006)

    def test_monte_carlo_method_propensities_are_exact_for_the_mechanism(self):
        # with method="mc" the vector is itself random, but the action is drawn from it
        rng = np.random.default_rng(4)
        pol = trained(MurmurPolicy(method="mc", draws=200), rng)
        hits = total = 0.0
        for _ in range(4000):
            d = decide(pol, State("track", "work"), rng)
            hits += d.action_index == 0
            total += d.probs[0]
        self.assertLess(abs(hits - total), 4.5 * np.sqrt(4000 * 0.25))

    def test_propensity_floor_and_baseline_at_start(self):
        rng = np.random.default_rng(5)
        for s, c in ALL_CONTEXTS:
            E = catalog.eligible(s, c)
            pol = MurmurPolicy()
            p = pol.action_probs(s, c, E, rng)
            self.assertEqual(pol.greedy(s, c, len(E)), 0)           # greedy = expert first at t = 0
            self.assertGreaterEqual(p[0], 1 - EPS)
            self.assertGreaterEqual(p.min(), EPS * KAPPA / len(E) - 1e-12)
            for name in ("eps_greedy", "linucb"):
                self.assertEqual(int(np.argmax(make_policy(name).action_probs(s, c, E, rng))), 0)

    def test_prior_pseudo_count_is_bounded(self):
        with self.assertRaises(ValueError):
            MurmurPolicy(n0=10)
        a, b = MurmurPolicy().posterior("lens", "work", 14)
        self.assertTrue(np.allclose(a + b, 3.0))
        self.assertTrue(np.all(np.diff(a / (a + b)) < 0))           # centred on the expert order


class SafetyTests(unittest.TestCase):
    class Hostile:
        """A policy that tries to feature anything but the first item, with a strong preference."""
        def action_probs(self, surface, context, eligible, rng):
            p = np.zeros(len(eligible))
            p[-1] = 1.0
            return p

        def update(self, *a):
            raise AssertionError("update must not be called by decide")

    def test_excluded_arm_never_featured(self):
        rng = np.random.default_rng(6)
        ok = set(catalog.allowed("lens", "loss"))
        for name in POLICY_NAMES:
            pol = trained(make_policy(name), rng)
            for _ in range(300):
                for st in (State("lens", "loss"), State("lens", "loss", opted_in=True, low_mood=True)):
                    d = decide(pol, st, rng)
                    self.assertIn(d.action, ok)
                    self.assertEqual(audit(d, st), [])
        # even with the loss gate bypassed, the eligible set alone keeps excluded lenses out
        E = catalog.eligible("lens", "loss")
        self.assertTrue(set(E).isdisjoint(catalog.LOSS_EXCLUDED))
        for name in POLICY_NAMES:
            p = trained(make_policy(name), rng).action_probs("lens", "loss", E, rng)
            self.assertEqual(len(p), len(E))

    def test_no_exploration_in_gated_states(self):
        rng = np.random.default_rng(7)
        gated_states = [State(s, c, low_mood=True) for s, c in ALL_CONTEXTS]
        gated_states += [State(s, c, risk=True) for s, c in ALL_CONTEXTS]
        gated_states += [State(s, c, opted_in=False) for s, c in ALL_CONTEXTS]
        gated_states += [State("lens", "loss")]
        for pol in [self.Hostile()] + [trained(make_policy(n), rng) for n in POLICY_NAMES]:
            for st in gated_states:
                for _ in range(20):
                    d = decide(pol, st, rng)
                    self.assertEqual(d.action, catalog.eligible(st.surface, st.context)[0])
                    self.assertEqual(d.propensity, 1.0)
                    self.assertIsNotNone(d.gated)
                    self.assertEqual(audit(d, st), [])

    def test_gated_decisions_use_no_randomness(self):
        a, b = np.random.default_rng(8), np.random.default_rng(8)
        decide(MurmurPolicy(), State("lens", "work", low_mood=True), a)
        self.assertEqual(a.random(), b.random())

    def test_gate_reason_order(self):
        self.assertEqual(gate_reason(State("lens", "loss", low_mood=True, risk=True, opted_in=False)), "opt-out")
        self.assertEqual(gate_reason(State("lens", "loss", low_mood=True, risk=True)), "risk")
        self.assertEqual(gate_reason(State("lens", "loss", low_mood=True)), "low-mood")
        self.assertEqual(gate_reason(State("lens", "loss")), "loss")
        self.assertIsNone(gate_reason(State("lens", "work")))
        self.assertIsNone(gate_reason(State("track", "none")))

    def test_audit_catches_violations(self):
        st = State("lens", "work", low_mood=True)
        d = decide(self.Hostile(), State("lens", "work"), np.random.default_rng(0))
        self.assertIn("explored-in-gated-state", audit(d, st))      # an ungated decision in a gated state

    def test_invalid_probability_vector_is_rejected(self):
        class Bad:
            def action_probs(self, s, c, E, rng):
                return np.ones(len(E))
        with self.assertRaises(ValueError):
            decide(Bad(), State("lens", "work"), np.random.default_rng(0))

    def test_simulation_has_no_violations_and_gated_sessions_do_not_teach(self):
        world = WORLDS["heterogeneous"]
        q = population_quality(world)
        for i in range(5):
            env = UserEnv(world, np.random.SeedSequence([99, i]), 60, q)
            for name in POLICY_NAMES:
                pol = make_policy(name)
                r = run_user(env, pol, np.random.default_rng([99, i, 1]), log=True)
                self.assertEqual(r["violations"], 0)
                for rec in r["log"]:
                    if env.low_mood[rec["t"]] or env.risk[rec["t"]] or rec["context"] == "loss":
                        self.assertIsNotNone(rec["gated"])
                        self.assertEqual(rec["action_index"], 0)
                if hasattr(pol, "s"):
                    self.assertNotIn(("lens", "loss"), pol.s)       # loss never reaches the learner


class LearningTests(unittest.TestCase):
    def test_missing_rating_changes_nothing(self):
        for name in ("murmur", "ts", "eps_greedy", "linucb"):
            pol = trained(make_policy(name), np.random.default_rng(9))
            E = catalog.eligible("lens", "work")
            before = pol.action_probs("lens", "work", E, np.random.default_rng(0)).copy()
            pol.update("lens", "work", E, E[2], None)
            after = pol.action_probs("lens", "work", E, np.random.default_rng(0))
            self.assertTrue(np.array_equal(before, after), name)

    def test_discounting_caps_effective_sample_size(self):
        pol = MurmurPolicy()
        E = catalog.eligible("lens", "work")
        rng = np.random.default_rng(10)
        for _ in range(3000):
            pol.update("lens", "work", E, E[int(rng.integers(len(E)))], int(rng.random() < 0.5))
            self.assertLessEqual(pol.ess("lens", "work", len(E)), 1 / (1 - GAMMA) + 1e-9)
        self.assertGreater(pol.ess("lens", "work", len(E)), 49.9)
        undisc = ThompsonSampling(gamma=1.0)
        for _ in range(100):
            undisc.update("lens", "work", E, E[0], 1)
        self.assertAlmostEqual(undisc.ess("lens", "work", len(E)), 100.0)

    def test_update_goes_to_the_item_used_and_learning_moves_the_greedy_item(self):
        pol = MurmurPolicy()
        E = catalog.eligible("lens", "work")
        for _ in range(8):
            pol.update("lens", "work", E, E[5], 1)
        self.assertEqual(pol.greedy("lens", "work", len(E)), 5)
        self.assertEqual(pol.greedy("lens", "family", 14), 0)       # other contexts untouched


class OpeTests(unittest.TestCase):
    def test_ips_unbiased_on_toy_problem(self):
        means = np.array([0.2, 0.5, 0.8])
        logging = np.array([0.6, 0.3, 0.1])
        target = np.array([0.1, 0.2, 0.7])
        truth = float(target @ means)
        reps, n = 4000, 200
        est = np.empty(reps)
        sn = np.empty(reps)
        naive = np.empty(reps)
        rng = np.random.default_rng(11)
        for r in range(reps):
            a = rng.choice(3, size=n, p=logging)
            y = (rng.random(n) < means[a]).astype(float)
            est[r] = ope.ips(target[a], logging[a], y)
            sn[r] = ope.snips(target[a], logging[a], y)
            naive[r] = y.mean()
        se = est.std(ddof=1) / np.sqrt(reps)
        self.assertLess(abs(est.mean() - truth), 3.5 * se)
        self.assertLess(abs(sn.mean() - truth), 0.01)
        self.assertGreater(abs(naive.mean() - truth), 0.2)          # the uncorrected mean is far off

    def test_dr_recovers_value_and_handles_exact_model(self):
        V, logging, target, ctx_p, truth = study.ope_problem()
        C, K = V.shape
        rng = np.random.default_rng(12)
        est = []
        for _ in range(300):
            n = 500
            ctx = rng.choice(C, size=n, p=ctx_p)
            act = np.array([rng.choice(K, p=logging[c]) for c in ctx])
            rew = (rng.random(n) < V[ctx, act]).astype(float)
            est.append(ope.doubly_robust(ctx, act, logging[ctx, act], rew, target[ctx], C, K))
        self.assertLess(abs(np.mean(est) - truth), 0.02)
        # with the true reward model and noiseless rewards the DR score is exact
        ctx = np.array([0, 1, 2])
        act = np.array([1, 1, 3])
        sc = ope.dr_scores(ctx, act, logging[ctx, act], V[ctx, act], target[ctx], V[ctx])
        self.assertTrue(np.allclose(sc, np.sum(target[ctx] * V[ctx], axis=1)))

    def test_missing_rewards_are_dropped_not_zeroed(self):
        tp, pr = np.array([0.5, 0.5, 0.5]), np.array([0.5, 0.5, 0.5])
        r = np.array([1.0, np.nan, 1.0])
        tpc, prc, rc = ope.complete_cases(tp, pr, reward=r)
        self.assertEqual(len(rc), 2)
        self.assertEqual(ope.ips(tpc, prc, rc), 1.0)

    def test_propensity_must_be_positive(self):
        with self.assertRaises(ValueError):
            ope.ips(np.array([0.5]), np.array([0.0]), np.array([1.0]))

    def test_adaptive_weighted_reduces_to_mean_for_constant_weights(self):
        s = np.array([0.1, 0.4, 0.9, 0.3])
        est, lo, hi = ope.adaptive_weighted(s, np.ones(4))
        self.assertAlmostEqual(est, s.mean())
        self.assertTrue(lo < est < hi)
        tp = np.array([[0.0, 1.0, 0.0]])
        self.assertAlmostEqual(ope.stabilised_weights(tp, np.array([[0.5, 0.25, 0.25]]))[0], 0.5)


class DeterminismTests(unittest.TestCase):
    def test_same_seed_same_run(self):
        a = study.simulate_chunk(("misspecified", 3, 6, 40, 123))
        b = study.simulate_chunk(("misspecified", 3, 6, 40, 123))
        for x, y in zip(a[2:], b[2:]):
            self.assertTrue(np.array_equal(x, y))
        c = study.simulate_chunk(("misspecified", 3, 6, 40, 124))
        self.assertFalse(np.array_equal(a[2], c[2]))

    def test_chunking_does_not_change_users(self):
        whole = study.simulate_chunk(("heterogeneous", 0, 4, 30, 5))
        part = study.simulate_chunk(("heterogeneous", 2, 4, 30, 5))
        self.assertTrue(np.array_equal(whole[2][:, 2:], part[2]))

    def test_policies_meet_the_same_user(self):
        world = WORLDS["strong"]
        env = UserEnv(world, np.random.SeedSequence([1, 2]), 30)
        env2 = UserEnv(world, np.random.SeedSequence([1, 2]), 30)
        self.assertEqual(env.context, env2.context)
        self.assertTrue(np.array_equal(env.unif, env2.unif))
        r1 = run_user(env, ExpertPolicy(), np.random.default_rng(0))
        run_user(env, EpsilonGreedy(), np.random.default_rng(0))    # another policy in between
        r2 = run_user(env, ExpertPolicy(), np.random.default_rng(5))
        self.assertTrue(np.array_equal(r1["value"], r2["value"]))   # expert ignores its rng

    def test_null_world_expert_is_optimal_and_users_identical(self):
        world = WORLDS["null"]
        env = UserEnv(world, np.random.SeedSequence([3]), 40)
        r = run_user(env, ExpertPolicy(), np.random.default_rng(0), track_best=True)
        self.assertTrue(np.allclose(r["best"], r["value"]))
        self.assertEqual(env.base, 0.0)
        self.assertTrue(all(np.all(v == 0) for v in env.u.values()))

    def test_ope_validation_is_deterministic(self):
        a = study.ope_validation(reps=5, sizes=(90,))
        b = study.ope_validation(reps=5, sizes=(90,))
        self.assertEqual(a, b)


if __name__ == "__main__":
    unittest.main()
