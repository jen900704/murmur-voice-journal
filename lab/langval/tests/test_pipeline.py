"""Tests of the loaders, the plan and the analysis on synthetic data. No network.

The one test that calls the app's scorer is skipped when node is not installed.
"""
import os
import re
import shutil
import sys
import unittest

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from langval import hypotheses as H  # noqa: E402
from langval import tables  # noqa: E402
from langval.analysis import list_word_table, rate, run_confirmatory  # noqa: E402
from langval.data import has_any, load_goemotions, only, score_rows, to_arrays  # noqa: E402

SAMPLE = os.path.join(ROOT, "data", "sample")
CPED_LABELS = {"neutral", "anger", "negative-other", "depress", "relaxed", "worried", "positive-other", "happy",
               "astonished", "sadness", "fear", "disgust", "grateful"}


def emotions():
    with open(os.path.join(SAMPLE, "emotions.txt"), encoding="utf-8") as f:
        return [x.strip() for x in f if x.strip()]


class TestSampleAndPlan(unittest.TestCase):
    def test_sample_loads(self):
        rows = load_goemotions(os.path.join(SAMPLE, "goemotions_train_first200.tsv"), os.path.join(SAMPLE, "emotions.txt"))
        self.assertEqual(len(rows), 200)
        names = set(emotions())
        self.assertEqual(len(names), 28)
        for r in rows:
            self.assertTrue(r["text"])
            self.assertTrue(r["labels"] <= names)
        self.assertGreater(int(only(rows, "neutral").sum()), 10)
        self.assertEqual(len({r["id"] for r in rows}), 200)

    def test_every_planned_label_exists(self):
        names = set(emotions())
        for h in H.EN_CONFIRMATORY:
            self.assertTrue(set(h["target"]) | set(h["opposite"]) | set(h["near"]) <= names, h["id"])
            self.assertFalse(set(h["target"]) & set(h["opposite"]), h["id"])
            self.assertFalse(set(h["target"]) & set(h["near"]), h["id"])
        for h in H.EN_EXPLORATORY:
            self.assertTrue(set(h["target"]) <= names, h["id"])
        self.assertEqual(len(H.GE_POSITIVE), 12)
        self.assertEqual(len(H.GE_NEGATIVE), 11)
        for h in H.ZH_CONFIRMATORY:
            self.assertTrue(set(h["target"]) | set(h["opposite"]) | set(h["near"]) <= CPED_LABELS, h["id"])
            self.assertFalse(set(h["target"]) & set(h["opposite"]), h["id"])

    def test_documents_have_no_em_dash_or_leading_zero_correlations(self):
        for name in ["README.md", "PREREG.md", "RESULTS.md"]:
            path = os.path.join(ROOT, name)
            if not os.path.exists(path):
                continue
            with open(path, encoding="utf-8") as f:
                text = f.read()
            self.assertNotIn("—", text, name)
            self.assertIsNone(re.search(r"\br = -?0\.\d", text), name)


def synthetic(n=4000, seed=5):
    """Toy corpus: 'sad' fires in texts labeled sadness, 'anx' is pure noise."""
    rng = np.random.default_rng(seed)
    labs = rng.choice(["neutral", "sadness", "joy", "fear", "anger"], size=n, p=[0.4, 0.15, 0.15, 0.15, 0.15])
    rows = [{"id": f"t{i}", "text": "x", "labels": frozenset([labs[i]]), "cluster": i} for i in range(n)]
    words = rng.integers(5, 25, n).astype(float)
    sad = ((labs == "sadness") & (rng.random(n) < 0.6)) | (rng.random(n) < 0.03)
    anx = rng.random(n) < 0.10
    zero = np.zeros(n)
    counts = {"sad": sad.astype(float), "anx": anx.astype(float), "posemo": zero, "negemo": sad.astype(float)}
    return {"rows": rows, "n_input": n, "n_other_language": 0, "n_zero_units": 0, "words": words, "counts": counts,
            "vader": -sad.astype(float) * 0.5, "clusters": np.arange(n)}


class TestAnalysisOnSyntheticData(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.arr = synthetic()
        confirm = [
            dict(id="sad", score="sad", label="sadness", target=["sadness"], opposite=["joy"], near=["anger"], vader_sign=-1),
            dict(id="anx", score="anx", label="anxiety", target=["fear"], opposite=["joy"], near=["anger"], vader_sign=-1),
        ]
        valence = [dict(id="tone", score="tone", label="tone", positive=["joy"], negative=["sadness", "fear", "anger"])]
        explore = [dict(id="x", score="anx", label="noise", target=["anger"])]
        cls.res = run_confirmatory(cls.arr, confirm, valence, explore, 3, "neutral", True, B=400, seed=1)

    def test_signal_is_supported_and_noise_is_not(self):
        sad, anx = self.res["confirmatory"]
        self.assertEqual(sad["verdict"], "supported")
        self.assertEqual(anx["verdict"], "not supported")
        self.assertAlmostEqual(sad["auc"], 0.5 + (0.6 + 0.4 * 0.03 - 0.03) / 2, delta=0.03)
        self.assertAlmostEqual(anx["auc"], 0.5, delta=0.03)
        self.assertLess(sad["auc_ci_adj"][0], sad["auc_ci95"][0])
        self.assertGreater(sad["auc_ci_adj"][1], sad["auc_ci95"][1])

    def test_groups_and_coverage(self):
        sad = self.res["confirmatory"][0]
        rows = self.arr["rows"]
        self.assertEqual(sad["n_target"], int(has_any(rows, ["sadness"]).sum()))
        self.assertEqual(sad["n_neutral"], int(only(rows, "neutral").sum()))
        self.assertEqual(sad["n_target"] + sad["n_neutral"] + sad["n_other"], len(rows))
        self.assertAlmostEqual(sad["hit_target"]["share"], 0.61, delta=0.06)
        self.assertAlmostEqual(sad["hit_neutral"]["share"], 0.03, delta=0.02)
        self.assertGreater(sad["precision"]["share"], sad["base_rate"])
        self.assertAlmostEqual(sad["auc_opposite"], 0.5, delta=0.03)

    def test_rate_is_per_100_units(self):
        x = rate(self.arr, "sad")
        i = int(np.argmax(self.arr["counts"]["sad"]))
        self.assertAlmostEqual(x[i], 100 / self.arr["words"][i])
        self.assertTrue(np.all(rate(self.arr, "tone") <= 0))

    def test_tables_render_without_leading_zero(self):
        res = dict(self.res)
        res.update({"corpus": "toy", "lang": "en", "n_input": 4000, "n_other_language": 0, "n_zero_units": 0, "mean_units": 14.0,
                    "median_units": 14.0, "label_matrix": {"sad": {"sadness": 0.8}}, "label_n": {"sadness": 600, "neutral": 1600},
                    "words": {"sad": {"list_words": [], "missing": []}, "anx": {"list_words": [], "missing": []}}})
        md = tables.render(res)
        self.assertIn("**supported**", md)
        self.assertIn("**not supported**", md)
        self.assertIsNone(re.search(r"(?<![\d.])0\.\d", md))
        self.assertNotIn("—", md)


@unittest.skipUnless(shutil.which("node"), "node is not installed")
class TestScorerBridge(unittest.TestCase):
    def test_app_scorer_counts_and_negation(self):
        rows = [
            {"id": "a", "text": "I am not sad, but I miss my mom. Thanks so much!", "labels": frozenset(["gratitude"]), "cluster": 0},
            {"id": "b", "text": "I was so worried and angry.", "labels": frozenset(["fear"]), "cluster": 1},
            {"id": "c", "text": "12345 !!!", "labels": frozenset(["neutral"]), "cluster": 2},
        ]
        meta, scored = score_rows(rows)
        self.assertIn("grat", meta["categories"])
        self.assertEqual(scored["a"]["words"], 12)
        self.assertEqual(scored["a"]["c"].get("grat"), 1)
        self.assertEqual(scored["a"]["c"].get("sad"), 1)  # "miss" counts; "not sad" is left out by the app's negation rule
        self.assertEqual(scored["b"]["c"].get("anx"), 1)
        self.assertEqual(scored["b"]["c"].get("anger"), 1)
        self.assertLess(scored["b"]["vsum"], 0)
        self.assertEqual(scored["c"]["lang"], "other")
        arr = to_arrays(rows, scored, "en", meta["categories"])
        self.assertEqual(len(arr["rows"]), 2)
        self.assertEqual(arr["n_other_language"], 1)
        h = dict(id="grat", score="grat", target=["gratitude"])
        tab = list_word_table(arr, scored, h, "neutral", min_texts=1)
        self.assertEqual(tab[0]["word"], "thanks")


if __name__ == "__main__":
    unittest.main()
