"""Unit tests for the Murmur to DLATK pipeline. No network, no DLATK needed.

    python3 -m unittest discover lab/dlatk/tests
"""
import contextlib
import csv
import io
import json
import os
import sqlite3
import sys
import tempfile
import unittest
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from murmur_dlatk import dlatk_engine, export, fallback, grouping, lexica, run, stats, textprep  # noqa: E402

EXAMPLES = os.path.join(ROOT, "examples")


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def ms(*args):
    return int(datetime(*args, tzinfo=timezone.utc).timestamp() * 1000)


BACKUP = {
    "app": "murmur", "version": 1,
    "entries": [
        {"id": "a", "createdAt": ms(2026, 9, 28, 9), "mood": 5, "energy": 3, "note": " Walked to class. ", "features": None, "silent": True},
        {"id": "b", "createdAt": ms(2026, 9, 29, 9), "mood": 2, "energy": None, "note": "", "features": None, "silent": True},
        {"id": "c", "createdAt": ms(2026, 9, 30, 9), "mood": 9, "energy": 4, "note": "Out of range mood."},
        {"id": "d", "createdAt": ms(2026, 9, 30, 9), "mood": 7, "energy": 7, "note": "Demo note.", "demo": True},
        {"id": "e", "createdAt": "not a date", "note": "No date."},
        "garbage",
    ],
    "nights": [{"id": "n", "createdAt": ms(2026, 10, 1, 22), "worry": "The deadline.", "kindness": "Made tea."},
               {"id": "n2", "createdAt": ms(2026, 10, 2, 22), "worry": "", "kindness": ""}],
    "lensSessions": [{"id": "s", "createdAt": ms(2026, 10, 5, 12), "lensId": "narrative", "concern": "Work.",
                      "answers": ["A small step.", 2, "", "Not sure"]}],
}


class ExportParsing(unittest.TestCase):
    def test_messages_ratings_and_skips(self):
        got = export.parse_export(BACKUP)
        self.assertEqual([(m.source, m.text) for m in got["messages"]], [
            ("entry_note", "Walked to class."), ("entry_note", "Out of range mood."),
            ("night_worry", "The deadline."), ("night_kindness", "Made tea."),
            ("lens_concern", "Work."), ("lens_answer", "A small step."), ("lens_answer", "Not sure")])
        self.assertEqual([(r.mood, r.energy) for r in got["ratings"]], [(5, 3), (2, None), (None, 4)])
        self.assertEqual(got["skipped"], 2)          # the undated entry and the non-object
        self.assertEqual(got["demo_skipped"], 1)
        self.assertFalse(got["synthetic"])

    def test_demo_entries_only_on_request(self):
        got = export.parse_export(BACKUP, include_demo=True)
        self.assertIn("Demo note.", [m.text for m in got["messages"]])
        self.assertIn((7, 7), [(r.mood, r.energy) for r in got["ratings"]])

    def test_social_posts(self):
        posts, bad = export.parse_posts([
            {"text": "hello", "timestamp": "2026-10-01T08:00:00Z", "source": "Some Network"},
            {"text": "seconds", "timestamp": 1790000000, "source": ""},
            {"text": "millis", "timestamp": 1790000000000},
            {"text": "", "timestamp": "2026-10-01T08:00:00Z"},
            {"text": "no time"}])
        self.assertEqual(bad, 2)
        self.assertEqual([m.source for m in posts], ["social:some_network", "social:unknown", "social:unknown"])
        self.assertEqual(posts[0].created, datetime(2026, 10, 1, 8, tzinfo=timezone.utc))
        self.assertEqual(posts[1].created, posts[2].created)

    def test_not_a_backup(self):
        for bad in ([1, 2], {"hello": 1}):
            with self.assertRaises(export.ExportError):
                export.parse_export(bad)

    def test_source_filter(self):
        got = export.parse_export(BACKUP)["messages"]
        kept = export.filter_sources(got, ["night_worry", "lens_answer"])
        self.assertEqual({m.source for m in kept}, {"night_worry", "lens_answer"})


class Grouping(unittest.TestCase):
    def test_iso_weeks_and_months(self):
        self.assertEqual(grouping.week_id(datetime(2026, 9, 28, tzinfo=timezone.utc)), "2026-W40")   # a Monday
        self.assertEqual(grouping.week_id(datetime(2026, 9, 27, 23, tzinfo=timezone.utc)), "2026-W39")
        self.assertEqual(grouping.week_id(datetime(2027, 1, 1, tzinfo=timezone.utc)), "2026-W53")    # ISO year
        self.assertEqual(grouping.month_id(datetime(2027, 1, 1, tzinfo=timezone.utc)), "2027-01")

    def test_utc_offset_moves_the_boundary(self):
        late_sunday = datetime(2026, 9, 27, 20, tzinfo=timezone.utc)
        self.assertEqual(grouping.week_id(late_sunday), "2026-W39")
        self.assertEqual(grouping.week_id(late_sunday, 8), "2026-W40")     # already Monday in Taipei

    def test_group_messages_and_mean_ratings(self):
        got = export.parse_export(BACKUP)
        by_week = grouping.group_messages(got["messages"], "week")
        self.assertEqual(list(by_week), ["2026-W40", "2026-W41"])
        self.assertEqual(len(by_week["2026-W40"]), 4)
        self.assertEqual(len(grouping.group_messages(got["messages"], "month")["2026-10"]), 5)
        means = grouping.mean_ratings(got["ratings"], "week")
        self.assertEqual(means["2026-W40"], {"mood": 3.5, "n_mood": 2, "energy": 3.5, "n_energy": 2})


class TextAndNgrams(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(textprep.normalize("Tea &amp; rain\n\nsee https://example.com/x?y=1 我很累"),
                         "Tea & rain see <url> 我 很 累")

    def test_tokenize(self):
        self.assertEqual(textprep.tokenize(textprep.normalize("I'm well-rested, don't worry... 3.5 #sleep :)")),
                         ["i'm", "well-rested", ",", "don't", "worry", "...", "3.5", "#sleep", ":)"])

    def test_ngram_counts_by_hand(self):
        # Week A: "the cat sat" and "the cat ran"; week B: "a dog"
        t1 = fallback.ngram_table({"A": ["The cat sat", "the cat ran"], "B": ["a dog"]}, 1)
        self.assertEqual(t1["A"]["the"], (2, 2 / 6))
        self.assertEqual(t1["A"]["sat"], (1, 1 / 6))
        self.assertEqual(t1["B"], {"a": (1, 0.5), "dog": (1, 0.5)})
        t2 = fallback.ngram_table({"A": ["The cat sat", "the cat ran"], "B": ["a dog"]}, 2)
        self.assertEqual(t2["A"], {"the cat": (2, 0.5), "cat sat": (1, 0.25), "cat ran": (1, 0.25)})   # never "sat the"
        t3 = fallback.ngram_table({"A": ["The cat sat", "the cat ran"], "B": ["a dog"]}, 3)
        self.assertEqual(t3["A"], {"the cat sat": (1, 0.5), "the cat ran": (1, 0.5)})
        self.assertNotIn("B", t3)                    # no 3-gram in a two-word message
        self.assertEqual(fallback.word_counts(t1), {"A": 6, "B": 2})

    def test_relative_frequencies_sum_to_one(self):
        t = fallback.ngram_table({"A": ["one two three two", "two"]}, 1)
        self.assertAlmostEqual(sum(gn for _, gn in t["A"].values()), 1.0)

    def test_occurrence_filter(self):
        table = {"A": {"x": (1, .5), "y": (1, .5)}, "B": {"x": (1, 1.0)}, "C": {"x": (2, .5), "z": (2, .5)}, "D": {"y": (1, 1.0)}}
        kept, threshold = fallback.occurrence_filter(table, ["A", "B", "C", "D"], 0.5)
        self.assertEqual(threshold, 2)
        self.assertEqual({f for g in kept.values() for f in g}, {"x", "y"})

    def test_lexicon_scores_by_hand(self):
        one = fallback.ngram_table({"A": ["happy happy sad worried worry ok"]}, 1)     # 6 words
        lex = [("happy", "POS", 2.0), ("sad", "NEG", 1.5), ("worr*", "NEG", 1.0), ("wo*", "NEG", 9.0)]
        got = fallback.lexicon_table(one, lex)["A"]
        self.assertEqual(got["POS"][0], 2)
        self.assertAlmostEqual(got["POS"][1], 2.0 * 2 / 6)
        self.assertEqual(got["NEG"][0], 3)           # sad, worried, worry; "wo*" is too short a stem to count
        self.assertAlmostEqual(got["NEG"][1], 1.5 / 6 + 1.0 / 6 + 1.0 / 6)

    def test_bundled_lexica_load(self):
        for path in lexica.bundled_paths():
            rows = lexica.load_lexicon(path)
            self.assertTrue(rows)
            self.assertFalse([t for t, _, _ in rows if t.endswith("*") or " " in t])
            self.assertTrue(all(w > 0 for _, _, w in rows))


class Statistics(unittest.TestCase):
    def test_bh_known_example(self):
        # sorted p: .005 .01 .03 .04 .2 .6 ; times 6/rank: .03 .03 .06 .06 .24 .6 (already monotone)
        got = stats.benjamini_hochberg([0.01, 0.04, 0.03, 0.005, 0.2, 0.6])
        for g, want in zip(got, [0.03, 0.06, 0.06, 0.03, 0.24, 0.6]):
            self.assertAlmostEqual(g, want, places=12)

    def test_bh_takes_the_running_minimum_and_caps_at_one(self):
        # sorted .01 .02 .021 .9 ; raw .04 .04 .028 .9 -> the first two drop to .028
        got = stats.benjamini_hochberg([0.021, 0.9, 0.01, 0.02])
        for g, want in zip(got, [0.028, 0.9, 0.028, 0.028]):
            self.assertAlmostEqual(g, want, places=12)
        self.assertEqual(stats.benjamini_hochberg([0.8, 0.9]), [0.9, 0.9])
        self.assertEqual(stats.benjamini_hochberg([]), [])

    def test_ranks_with_ties(self):
        self.assertEqual(stats.ranks([10, 20, 20, 5]), [2.0, 3.5, 3.5, 1.0])

    def test_spearman_against_scipy_values(self):
        # scipy.stats.spearmanr -> 0.9030303030303028, p = 0.00034361219776328223
        rho, p, n = stats.spearman([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [2, 1, 4, 3, 7, 5, 6, 10, 8, 9])
        self.assertAlmostEqual(rho, 0.9030303030303028, places=12)
        self.assertAlmostEqual(p, 0.00034361219776328223, places=12)
        self.assertEqual(n, 10)
        # by hand: d = (0, 0, 0, 1, -1), sum d^2 = 2, rho = 1 - 6*2 / (5*24) = 0.9
        self.assertAlmostEqual(stats.spearman([1, 2, 3, 4, 5], [1, 2, 3, 5, 4])[0], 0.9, places=12)

    def test_spearman_undefined(self):
        self.assertEqual(stats.spearman([1, 1, 1, 1], [1, 2, 3, 4])[0], None)
        self.assertEqual(stats.spearman([1, 2], [1, 2])[0], None)

    def test_t_distribution_p(self):
        self.assertAlmostEqual(stats.t_two_sided_p(2.306004135, 8), 0.05, places=6)
        self.assertAlmostEqual(stats.t_two_sided_p(0.0, 5), 1.0, places=12)

    def test_correlate_counts_constant_features_as_tests(self):
        groups = ["g%d" % i for i in range(6)]
        table = {g: {"up": (i + 1, (i + 1) / 10), "flat": (1, 0.1)} for i, g in enumerate(groups)}
        outcomes = {g: {"mood": float(i)} for i, g in enumerate(groups)}
        rows, used = fallback.correlate(table, outcomes, groups, ["mood"])
        self.assertEqual(used, {"mood": 6})
        self.assertEqual([r["feature"] for r in rows], ["up"])
        self.assertAlmostEqual(rows[0]["rho"], 1.0)
        self.assertEqual(rows[0]["p_bh"], 0.0)


class DlatkPlumbing(unittest.TestCase):
    def test_database_has_no_automatic_indexes(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "m.db")
            dlatk_engine.build_database(path, [(1, "u1", "2026-W40", "2026-09", "2026-09-28 09:00:00", "entry_note", "hello")],
                                        {"2026-W40": {"mood": 4.0, "energy": None}}, "week_id")
            con = sqlite3.connect(path)
            self.assertEqual(con.execute("SELECT count(*) FROM sqlite_master WHERE type='index' AND sql IS NULL").fetchone()[0], 0)
            cols = [r[1] for r in con.execute("PRAGMA table_info(msgs)")]
            self.assertEqual(cols, ["message_id", "user_id", "week_id", "month_id", "created_time", "source", "message"])
            self.assertEqual(con.execute("SELECT * FROM outcomes").fetchall(), [("2026-W40", 4.0, None)])
            con.close()

    def test_reads_dlatk_correlation_csv(self):
        text = ("Namespace(corpdb='x', feattable='y')\n \n\n"
                "feature,energy,p,N,CI_l,CI_u,freq,mood,p,N,CI_l,CI_u,freq\n"
                "tired,-0.5,0.02,20,-0.8,-0.1,31,-0.6,0.01,20,-0.8,-0.2,31\n"
                "_intercept,nan,1.0,20,nan,nan,20,nan,1.0,20,nan,nan,20\n"
                "flat,nan,nan,20,nan,nan,5,0.1,0.7,20,-0.3,0.5,5\n")
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "c.csv")
            with open(path, "w", encoding="utf-8") as f:
                f.write(text)
            got = dlatk_engine.read_correlation_csv(path)
        self.assertEqual(sorted(got), [("flat", "mood"), ("tired", "energy"), ("tired", "mood")])
        self.assertEqual(got[("tired", "mood")], {"feature": "tired", "outcome": "mood", "rho": -0.6, "p": 0.01, "n": 20,
                                                  "ci_low": -0.8, "ci_high": -0.2, "freq": 31.0})

    def test_missing_dlatk_is_a_clear_error(self):
        with self.assertRaises(dlatk_engine.DlatkNotFound) as ctx:
            dlatk_engine.find_interface("/nonexistent/dlatkInterface.py")
        self.assertIn("--engine fallback", str(ctx.exception))


class Runner(unittest.TestCase):
    def run_cli(self, *argv):
        err, out = io.StringIO(), io.StringIO()
        with contextlib.redirect_stderr(err), contextlib.redirect_stdout(out):
            code = run.main(list(argv))
        return code, out.getvalue(), err.getvalue()

    def test_fallback_reproduces_the_committed_dlatk_example(self):
        """The committed example output came from real DLATK. The fallback must give the same
        n-gram relative frequencies and (non-topic) lexicon scores for the same input."""
        with tempfile.TemporaryDirectory() as d:
            code, _, _ = self.run_cli("--input", os.path.join(EXAMPLES, "synthetic-export.json"),
                                      "--posts", os.path.join(EXAMPLES, "synthetic-posts.json"),
                                      "--out", d, "--engine", "fallback", "--topics", "off", "--no-plots")
            self.assertEqual(code, 0)
            info = json.loads(read(os.path.join(d, "run_info.json")))
            self.assertEqual(info["engine"], "fallback")
            self.assertTrue(info["synthetic_input"])
            self.assertIn("SYNTHETIC", read(os.path.join(d, "report.md")))
            for name, key in (("ngrams_filtered.csv", ("group_id", "feat")), ("lexicon_scores.csv", ("group_id", "lexicon", "category"))):
                def load(path):
                    with open(path, encoding="utf-8", newline="") as f:
                        return {tuple(r[k] for k in key): (float(r["value"]), float(r["group_norm"]))
                                for r in csv.DictReader(f) if r.get("lexicon") != "murmur_topics"}
                mine, theirs = load(os.path.join(d, name)), load(os.path.join(EXAMPLES, "output", name))
                self.assertEqual(set(mine), set(theirs), name)
                self.assertGreater(len(mine), 30)
                for k in mine:
                    self.assertEqual(mine[k][0], theirs[k][0], (name, k))
                    self.assertAlmostEqual(mine[k][1], theirs[k][1], places=7, msg=str((name, k)))

    def test_engine_dlatk_without_dlatk_exits_with_instructions(self):
        with tempfile.TemporaryDirectory() as d:
            code, _, err = self.run_cli("--input", os.path.join(EXAMPLES, "synthetic-export.json"), "--out", d,
                                        "--engine", "dlatk", "--dlatk-interface", os.path.join(d, "missing.py"))
        self.assertEqual(code, 2)
        self.assertIn("requirements-dlatk.txt", err)

    def test_too_little_text_and_bad_files(self):
        with tempfile.TemporaryDirectory() as d:
            small = os.path.join(d, "small.json")
            with open(small, "w", encoding="utf-8") as f:
                json.dump({"entries": [{"id": "a", "createdAt": ms(2026, 9, 28, 9), "note": "hello there", "mood": 3}]}, f)
            code, _, err = self.run_cli("--input", small, "--out", os.path.join(d, "o"), "--engine", "fallback")
            self.assertEqual(code, 2)
            self.assertIn("at least 50 words", err)
            bad = os.path.join(d, "bad.json")
            with open(bad, "w", encoding="utf-8") as f:
                f.write("not json")
            code, _, err = self.run_cli("--input", bad, "--out", os.path.join(d, "o"), "--engine", "fallback")
            self.assertEqual(code, 2)
            self.assertIn("not valid JSON", err)

    def test_few_periods_means_no_correlations(self):
        with tempfile.TemporaryDirectory() as d:
            code, _, _ = self.run_cli("--input", os.path.join(EXAMPLES, "synthetic-export.json"), "--out", d,
                                      "--engine", "fallback", "--group", "month", "--topics", "off", "--no-plots")
            self.assertEqual(code, 0)
            self.assertFalse(os.path.exists(os.path.join(d, "correlations.csv")))
            info = json.loads(read(os.path.join(d, "run_info.json")))
            self.assertIn("correlations_mood", info["skipped_steps"])


if __name__ == "__main__":
    unittest.main()
