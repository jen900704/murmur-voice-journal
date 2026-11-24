"""Unit tests for the metrics on toy data. No network, no node. Run from the repository root:

    python3 -m unittest discover lab/langval/tests
"""
import math
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langval import hypotheses as H  # noqa: E402
from langval.metrics import (Bootstrap, auc, auc_from_counts, bonferroni_level, fmt, interval, log_odds_z, pct,  # noqa: E402
                             point_biserial, wilson)


class TestAuc(unittest.TestCase):
    def test_perfect_and_reversed(self):
        self.assertEqual(auc([3, 4, 5], [0, 1, 2]), 1.0)
        self.assertEqual(auc([0, 1, 2], [3, 4, 5]), 0.0)

    def test_all_ties_is_half(self):
        self.assertEqual(auc([0, 0, 0], [0, 0]), 0.5)

    def test_hand_example(self):
        # pos {0, 2}, neg {0, 1}: pairs (0,0) tie .5, (0,1) 0, (2,0) 1, (2,1) 1 -> 2.5 / 4
        self.assertAlmostEqual(auc([0, 2], [0, 1]), 0.625)

    def test_mostly_zero_scores_follow_hit_rates(self):
        # binary score: AUC = .5 + (hit rate pos - hit rate neg) / 2
        pos = [1] * 40 + [0] * 60
        neg = [1] * 10 + [0] * 90
        self.assertAlmostEqual(auc(pos, neg), 0.5 + (0.40 - 0.10) / 2)

    def test_empty_group_is_nan(self):
        self.assertTrue(math.isnan(auc([], [1, 2])))

    def test_matches_brute_force(self):
        rng = np.random.default_rng(3)
        p = rng.integers(0, 5, 60)
        n = rng.integers(0, 4, 80)
        brute = np.mean([(a > b) + 0.5 * (a == b) for a in p for b in n])
        self.assertAlmostEqual(auc(p, n), brute)

    def test_from_counts(self):
        # values 0, 1, 2; pos counts 1, 0, 1; neg counts 1, 1, 0 -> same as the hand example
        self.assertAlmostEqual(float(auc_from_counts([1, 0, 1], [1, 1, 0])), 0.625)
        both = auc_from_counts(np.array([[1, 0, 1], [0, 0, 2]]), np.array([[1, 1, 0], [2, 0, 0]]))
        self.assertAlmostEqual(both[0], 0.625)
        self.assertAlmostEqual(both[1], 1.0)


class TestCorrelationAndIntervals(unittest.TestCase):
    def test_point_biserial_equals_pearson(self):
        x = np.array([0.0, 1.0, 2.0, 3.0, 4.0, 5.0])
        g = np.array([0, 0, 0, 1, 1, 1])
        self.assertAlmostEqual(point_biserial(x, g), 0.8783100657, places=6)

    def test_point_biserial_no_variance(self):
        self.assertTrue(math.isnan(point_biserial([1, 1, 1], [0, 1, 0])))

    def test_wilson(self):
        lo, hi = wilson(5, 10)
        self.assertAlmostEqual(lo, 0.2366, places=3)
        self.assertAlmostEqual(hi, 0.7634, places=3)
        lo, hi = wilson(0, 20)
        self.assertEqual(lo, 0.0)
        self.assertAlmostEqual(hi, 0.1611, places=3)
        self.assertTrue(math.isnan(wilson(0, 0)[0]))

    def test_bonferroni_level(self):
        self.assertAlmostEqual(bonferroni_level(10), 0.995)
        self.assertAlmostEqual(bonferroni_level(1), 0.95)

    def test_interval_ignores_nan(self):
        lo, hi = interval([float("nan")] + list(range(101)), 0.90)
        self.assertAlmostEqual(lo, 5.0)
        self.assertAlmostEqual(hi, 95.0)

    def test_log_odds(self):
        d, z = log_odds_z(50, 100, 10, 100)
        self.assertGreater(d, 0)
        self.assertGreater(z, 4)
        d2, _ = log_odds_z(10, 100, 10, 100)
        self.assertAlmostEqual(d2, 0.0)


class TestFormatting(unittest.TestCase):
    def test_no_leading_zero(self):
        self.assertEqual(fmt(0.634), ".63")
        self.assertEqual(fmt(-0.081), "-.08")
        self.assertEqual(fmt(1.0), "1.00")
        self.assertEqual(fmt(-0.001), ".00")
        self.assertEqual(fmt(0.5, 3), ".500")
        self.assertEqual(fmt(float("nan")), "n/a")
        self.assertEqual(fmt(None), "n/a")

    def test_pct(self):
        self.assertEqual(pct(0.1234), "12.3%")
        self.assertEqual(pct(0.5, 0), "50%")


class TestBootstrap(unittest.TestCase):
    def setUp(self):
        rng = np.random.default_rng(11)
        n = 3000
        self.g = rng.random(n) < 0.3
        self.x = np.round(rng.exponential(1.0, n) * (rng.random(n) < 0.3), 1)
        self.x[self.g] += (rng.random(int(self.g.sum())) < 0.4) * 1.0
        self.rng = rng

    def test_point_estimates_match_direct(self):
        bs = Bootstrap(np.arange(len(self.x)), B=50, seed=1)
        a = bs.add_auc("a", self.x, self.g, ~self.g)
        r = bs.add_r("r", self.x, self.g, ~self.g)
        self.assertAlmostEqual(a, auc(self.x[self.g], self.x[~self.g]))
        self.assertAlmostEqual(r, point_biserial(self.x, self.g.astype(float)))

    def test_interval_matches_naive_bootstrap(self):
        bs = Bootstrap(np.arange(len(self.x)), B=2000, seed=1)
        a = bs.add_auc("a", self.x, self.g, ~self.g)
        bs.add_r("r", self.x, self.g, ~self.g)
        out = bs.run()
        lo, hi = interval(out["a"])
        self.assertLess(lo, a)
        self.assertGreater(hi, a)
        naive_a, naive_r = [], []
        n = len(self.x)
        for _ in range(600):
            i = self.rng.integers(0, n, n)
            naive_a.append(auc(self.x[i][self.g[i]], self.x[i][~self.g[i]]))
            naive_r.append(point_biserial(self.x[i], self.g[i].astype(float)))
        self.assertAlmostEqual(np.std(out["a"]), np.std(naive_a), delta=0.15 * np.std(naive_a))
        self.assertAlmostEqual(np.std(out["r"]), np.std(naive_r), delta=0.15 * np.std(naive_r))

    def test_seeded(self):
        def once():
            bs = Bootstrap(np.arange(len(self.x)), B=200, seed=5)
            bs.add_auc("a", self.x, self.g, ~self.g)
            return bs.run()["a"]
        np.testing.assert_array_equal(once(), once())

    def test_same_resamples_make_differences_paired(self):
        bs = Bootstrap(np.arange(len(self.x)), B=300, seed=2)
        bs.add_auc("a", self.x, self.g, ~self.g)
        bs.add_auc("b", self.x, self.g, ~self.g)
        out = bs.run()
        np.testing.assert_allclose(out["a"] - out["b"], 0)

    def test_cluster_bootstrap_is_wider_when_texts_cluster(self):
        # 100 clusters of 20 identical texts: the cluster interval must be much wider than the naive one
        rng = np.random.default_rng(7)
        cl = np.repeat(np.arange(100), 20)
        g = np.repeat(rng.random(100) < 0.5, 20)
        x = np.repeat(rng.normal(0, 1, 100), 20) + g * 0.3
        naive = Bootstrap(np.arange(len(x)), B=500, seed=1)
        naive.add_auc("a", x, g, ~g)
        clustered = Bootstrap(cl, B=500, seed=1)
        clustered.add_auc("a", x, g, ~g)
        self.assertGreater(np.nanstd(clustered.run()["a"]), 2.5 * np.nanstd(naive.run()["a"]))


class TestDecisionRule(unittest.TestCase):
    def test_supported(self):
        self.assertEqual(H.verdict(0.80, 0.75, 0.70, 0.50, 0.20), "supported")

    def test_point_estimate_too_low(self):
        self.assertEqual(H.verdict(0.64, 0.62, 0.70, 0.50, 0.10), "weak")

    def test_adjusted_bound_too_low(self):
        self.assertEqual(H.verdict(0.70, 0.59, 0.70, 0.50, 0.10), "weak")

    def test_not_specific(self):
        self.assertEqual(H.verdict(0.80, 0.75, 0.59, 0.50, 0.20), "weak")

    def test_opposite_picked_up(self):
        self.assertEqual(H.verdict(0.80, 0.75, 0.70, 0.56, 0.20), "weak")
        self.assertEqual(H.verdict(0.80, 0.75, 0.70, 0.50, -0.01), "weak")

    def test_not_supported(self):
        self.assertEqual(H.verdict(0.54, 0.52, 0.70, 0.50, 0.10), "not supported")
        self.assertEqual(H.verdict(0.60, 0.50, 0.70, 0.50, 0.10), "not supported")

    def test_valence_rule(self):
        self.assertEqual(H.verdict_valence(0.70, 0.66), "supported")
        self.assertEqual(H.verdict_valence(0.60, 0.58), "weak")
        self.assertEqual(H.verdict_valence(0.52, 0.49), "not supported")

    def test_family_sizes(self):
        self.assertEqual(H.EN_FAMILY, 10)
        self.assertEqual(H.ZH_FAMILY, 7)


if __name__ == "__main__":
    unittest.main()
