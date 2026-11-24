"""Statistics against values worked out by hand or published with the method."""
import math
import unittest

import _common  # noqa: F401

from murmur_eval.stats import bootstrap_ci, cohen_kappa, confusion, fmt, krippendorff_alpha, wilson


class Wilson(unittest.TestCase):
    def test_known_values(self):
        lo, hi = wilson(8, 10)   # centre (0.8 + 1.92073/10) / 1.384146 = 0.71673; half width 0.22658
        self.assertAlmostEqual(lo, 0.4902, places=4)
        self.assertAlmostEqual(hi, 0.9433, places=4)
        lo, hi = wilson(10, 10)  # all caught: the lower bound is n / (n + z^2) = 10 / 13.8415
        self.assertAlmostEqual(lo, 0.7225, places=4)
        self.assertEqual(hi, 1.0)
        lo, hi = wilson(0, 10)
        self.assertEqual(lo, 0.0)
        self.assertAlmostEqual(hi, 0.2775, places=4)
        self.assertTrue(all(math.isnan(v) for v in wilson(0, 0)))


class Kappa(unittest.TestCase):
    def test_two_by_two_by_hand(self):
        # table [[20, 5], [10, 15]]: po = 35/50 = .70, pe = .5*.6 + .5*.4 = .50, kappa = .20/.50 = .40
        a = [1] * 25 + [0] * 25
        b = [1] * 20 + [0] * 5 + [1] * 10 + [0] * 15
        self.assertEqual(confusion(a, b, [1, 0]), [[20, 5], [10, 15]])
        self.assertAlmostEqual(cohen_kappa(a, b, [0, 1]), 0.40, places=10)

    def test_three_by_three_by_hand(self):
        # table [[7,2,1],[2,6,2],[1,2,7]], n = 30, all margins 10, so every expected cell is 30/9.
        # unweighted: po = 20/30, pe = 1/3, kappa = .50
        # linear:    observed disagreement (8*.5 + 2*1)/30 = .2000, expected (4*.5 + 2*1)*(30/9)/30 = .4444, kappa = .55
        # quadratic: observed (8*.25 + 2*1)/30 = .1333, expected (4*.25 + 2*1)*(30/9)/30 = .3333, kappa = .60
        x = [0] * 10 + [1] * 10 + [2] * 10
        y = [0] * 7 + [1] * 2 + [2] * 1 + [0] * 2 + [1] * 6 + [2] * 2 + [0] * 1 + [1] * 2 + [2] * 7
        self.assertEqual(confusion(x, y, [0, 1, 2]), [[7, 2, 1], [2, 6, 2], [1, 2, 7]])
        self.assertAlmostEqual(cohen_kappa(x, y, [0, 1, 2]), 0.50, places=10)
        self.assertAlmostEqual(cohen_kappa(x, y, [0, 1, 2], "linear"), 0.55, places=10)
        self.assertAlmostEqual(cohen_kappa(x, y, [0, 1, 2], "quadratic"), 0.60, places=10)

    def test_edges(self):
        self.assertAlmostEqual(cohen_kappa([0, 1, 2, 2], [0, 1, 2, 2], [0, 1, 2], "linear"), 1.0)
        self.assertTrue(math.isnan(cohen_kappa([2, 2, 2], [2, 2, 2], [0, 1, 2])))  # one category only: undefined
        self.assertTrue(math.isnan(cohen_kappa([], [], [0, 1, 2])))
        self.assertAlmostEqual(cohen_kappa([0, 0, 1, 1], [1, 1, 0, 0], [0, 1]), -1.0)


class Alpha(unittest.TestCase):
    # The worked example in Krippendorff (2011), "Computing Krippendorff's Alpha-Reliability":
    # four observers, twelve units, with missing values. Published results: nominal .743,
    # ordinal .815, interval .849.
    A = [1, 2, 3, 3, 2, 1, 4, 1, 2, None, None, None]
    B = [1, 2, 3, 3, 2, 2, 4, 1, 2, 5, None, 3]
    C = [None, 3, 3, 3, 2, 3, 4, 2, 2, 5, 1, None]
    D = [1, 2, 3, 3, 2, 4, 4, 1, 2, 5, 1, None]

    def test_published_example(self):
        units = list(zip(self.A, self.B, self.C, self.D))
        self.assertAlmostEqual(krippendorff_alpha(units, "nominal"), 0.743, places=3)
        self.assertAlmostEqual(krippendorff_alpha(units, "ordinal"), 0.815, places=3)
        self.assertAlmostEqual(krippendorff_alpha(units, "interval"), 0.849, places=3)

    def test_two_raters_binary_by_hand(self):
        # units (0,0) (1,1) (0,1) (1,0): coincidences o00 = 2, o11 = 2, o01 = o10 = 2; n0 = n1 = 4, n = 8
        # Do = 4, De = 2 * 4 * 4 / 7 = 4.571, alpha = 1 - 4/4.571 = .125
        self.assertAlmostEqual(krippendorff_alpha([(0, 0), (1, 1), (0, 1), (1, 0)], "nominal"), 0.125, places=10)

    def test_edges(self):
        self.assertAlmostEqual(krippendorff_alpha([(0, 0), (1, 1), (2, 2)], "ordinal"), 1.0)
        self.assertTrue(math.isnan(krippendorff_alpha([(1, None), (None, 2)], "ordinal")))  # no unit has two ratings
        self.assertTrue(math.isnan(krippendorff_alpha([(2, 2), (2, 2)], "ordinal")))        # no variation: undefined


class Bootstrap(unittest.TestCase):
    def test_reproducible_and_brackets_the_estimate(self):
        data = [0, 0, 1, 1, 1, 1, 1, 1, 1, 1] * 5
        stat = lambda idx: sum(data[i] for i in idx) / len(idx)
        a = bootstrap_ci(len(data), stat, n_boot=500, seed=7)
        self.assertEqual(a, bootstrap_ci(len(data), stat, n_boot=500, seed=7))
        self.assertLess(a[0], 0.8)
        self.assertGreater(a[1], 0.8)
        self.assertEqual(a[2], 500)

    def test_undefined_resamples_are_dropped_and_counted(self):
        lo, hi, used = bootstrap_ci(4, lambda idx: float("nan") if 0 in idx else 1.0, n_boot=200, seed=1)
        self.assertEqual((lo, hi), (1.0, 1.0))
        self.assertLess(used, 200)
        self.assertTrue(math.isnan(bootstrap_ci(0, lambda idx: 1.0)[0]))


class Format(unittest.TestCase):
    def test_no_leading_zero(self):
        self.assertEqual([fmt(0.63), fmt(-0.2), fmt(1.0), fmt(0.0), fmt(float("nan")), fmt(1.8125)], [".63", "-.20", "1.00", ".00", "n/a", "1.81"])


if __name__ == "__main__":
    unittest.main()
