import contextlib
import io
import json
import math
import tempfile
import unittest
from pathlib import Path

import _common  # noqa: F401

import agreement


def write_jsonl(path, rows):
    Path(path).write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")


class PairStats(unittest.TestCase):
    def test_matches_hand_computed_table(self):
        # the 3 x 3 table from test_stats: human rows, judge columns [[7,2,1],[2,6,2],[1,2,7]]
        human_scores = [0] * 10 + [1] * 10 + [2] * 10
        judge_scores = [0] * 7 + [1] * 2 + [2] * 1 + [0] * 2 + [1] * 6 + [2] * 2 + [0] * 1 + [1] * 2 + [2] * 7
        units = [(f"c{i:02d}", 0, 1) for i in range(30)]
        s = agreement.pair_stats(dict(zip(units, human_scores)), dict(zip(units, judge_scores)), n_boot=300, seed=3)
        self.assertEqual(s["confusion"], [[7, 2, 1], [2, 6, 2], [1, 2, 7]])
        self.assertAlmostEqual(s["percent_agreement"], 20 / 30)
        self.assertAlmostEqual(s["kappa"], 0.50)
        self.assertAlmostEqual(s["weighted_kappa"], 0.55)
        lo, hi, used = s["weighted_kappa_ci"]
        self.assertTrue(lo < 0.55 < hi)
        self.assertEqual(s["n_cases"], 30)
        again = agreement.pair_stats(dict(zip(units, human_scores)), dict(zip(units, judge_scores)), n_boot=300, seed=3)
        self.assertEqual(s["weighted_kappa_ci"], again["weighted_kappa_ci"])  # same seed, same interval
        self.assertTrue(math.isnan(s["applies_kappa"]))  # every unit applies: undefined

    def test_not_applicable_is_analysed_apart_from_scores(self):
        u = [("a", 0, 1), ("a", 0, 2), ("b", 0, 1), ("b", 0, 2), ("c", 0, 1)]
        human = dict(zip(u, [None, 2, 2, None, 0]))
        judge = dict(zip(u, [None, 2, None, None, 1]))
        s = agreement.pair_stats(human, judge, n_boot=50)
        self.assertEqual(s["n_units"], 5)
        self.assertEqual(s["n_scored_by_both"], 2)
        self.assertEqual(s["applies_confusion"], [[2, 0], [1, 2]])  # rows human (n/a, applies), columns judge
        self.assertAlmostEqual(s["applies_agreement"], 0.8)
        # applies: po = .8, pe = (2/5)(3/5) + (3/5)(2/5) = .48, kappa = .32/.52
        self.assertAlmostEqual(s["applies_kappa"], 0.32 / 0.52)
        self.assertAlmostEqual(s["percent_agreement"], 0.5)

    def test_alpha_among_humans(self):
        u = [("a", 0, 1), ("b", 0, 1), ("c", 0, 1), ("d", 0, 1)]
        r1 = dict(zip(u, [0, 1, 0, 1]))
        r2 = dict(zip(u, [0, 1, 1, 0]))
        a = agreement.alpha_stats([r1, r2], n_boot=50)
        self.assertAlmostEqual(a["alpha"], 0.125)  # worked by hand in test_stats
        self.assertEqual(a["n_units_with_two_ratings"], 4)


class Report(unittest.TestCase):
    def test_end_to_end_on_a_small_synthetic_fixture(self):
        # Synthetic labels made up for this test. They are not human ratings of anything.
        with tempfile.TemporaryDirectory() as d:
            run = Path(d) / "run"
            run.mkdir()
            judg, h1, h2 = [], [], []
            for i in range(12):
                js = [2, 2, 1, 0][i % 4]
                judg.append({"case_id": f"c{i}", "replicate": 0, "turn": 1, "rubric": "style", "rubric_version": "1.0.0", "failed": False,
                             "scores": {"one_question": js, "does_not_take_sides": None if i % 3 == 0 else 2}})
                for rows, rater, shift in ((h1, "R1", 0), (h2, "R2", 1 if i == 5 else 0)):
                    rows.append({"case_id": f"c{i}", "replicate": 0, "turn": 1, "rater": rater, "rubric": "style", "rubric_version": "1.0.0",
                                 "item": "one_question", "score": max(0, js - shift)})
                    rows.append({"case_id": f"c{i}", "replicate": 0, "turn": 1, "rater": rater, "rubric": "style", "rubric_version": "1.0.0",
                                 "item": "does_not_take_sides", "score": None if i % 3 == 0 else 2})
            judg.append({"case_id": "c99", "replicate": 0, "turn": 1, "rubric": "style", "rubric_version": "1.0.0", "failed": True, "scores": {"one_question": None}})
            write_jsonl(run / "judgments.jsonl", judg)
            write_jsonl(Path(d) / "h1.jsonl", h1)
            write_jsonl(Path(d) / "h2.jsonl", h2)
            with contextlib.redirect_stdout(io.StringIO()):
                code = agreement.main(["--run", str(run), "--human", str(Path(d) / "h1.jsonl"), str(Path(d) / "h2.jsonl"), "--boot", "100"])
            self.assertEqual(code, 0)
            md = (run / "agreement.md").read_text(encoding="utf-8")
            data = json.loads((run / "agreement.json").read_text(encoding="utf-8"))
        r1 = next(x for x in data["judge_vs_human"] if x["rater"] == "R1" and x["item"] == "one_question")
        self.assertEqual(r1["kappa"], 1.0)
        self.assertEqual(r1["n_scored_by_both"], 12)  # the failed judge answer is not counted
        r2 = next(x for x in data["judge_vs_human"] if x["rater"] == "R2" and x["item"] == "one_question")
        self.assertLess(r2["weighted_kappa"], 1.0)
        sides = next(x for x in data["judge_vs_human"] if x["rater"] == "R1" and x["item"] == "does_not_take_sides")
        self.assertIsNone(sides["kappa"])  # everyone gave 2: kappa is undefined, written as null
        self.assertEqual(sides["applies_kappa"], 1.0)
        alpha = next(x for x in data["human_vs_human"] if x["item"] == "one_question")
        self.assertTrue(0 < alpha["alpha"] < 1)
        for needle in ("Krippendorff's alpha", "few", "### style.one_question, rater R2", "| human \\ judge | 0 | 1 | 2 |"):
            self.assertIn(needle, md)
        self.assertNotIn(chr(0x2014), md)  # no em dashes in reports

    def test_rubric_version_mismatch_is_flagged(self):
        with tempfile.TemporaryDirectory() as d:
            run = Path(d)
            write_jsonl(run / "judgments.jsonl", [{"case_id": "c1", "replicate": 0, "turn": 1, "rubric": "style", "rubric_version": "1.1.0", "failed": False, "scores": {"one_question": 2}}])
            write_jsonl(run / "h.jsonl", [{"case_id": "c1", "replicate": 0, "turn": 1, "rater": "R1", "rubric": "style", "rubric_version": "1.0.0", "item": "one_question", "score": 2}])
            md, _ = agreement.build(run, [run / "h.jsonl"], n_boot=10)
        self.assertIn("not comparable", md)
        self.assertIn("second trained rater", md)


if __name__ == "__main__":
    unittest.main()
