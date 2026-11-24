import copy
import json
import subprocess
import sys
import unittest
from collections import Counter

from _common import EVAL_DIR, bridge, needs_node

from murmur_eval.agents import ScriptedUser
from murmur_eval.schema import (RUBRIC_IDS, SchemaError, applicable_items, load_cases, load_rubrics, rubric_hash, validate_case, validate_rubric)


class RubricSchema(unittest.TestCase):
    def setUp(self):
        self.rubrics = load_rubrics(EVAL_DIR / "rubrics")

    def test_all_four_rubrics_load_and_validate(self):
        self.assertEqual(tuple(self.rubrics), RUBRIC_IDS)
        for r in self.rubrics.values():
            for it in r["items"]:
                self.assertEqual(set(it["anchors"]), {"0", "1", "2"})
                self.assertGreaterEqual(len(it["examples"]), 2)

    def test_broken_rubrics_are_rejected(self):
        base = self.rubrics["style"]
        def broken(change):
            r = copy.deepcopy(base)
            change(r)
            return r
        cases = [
            lambda r: r.pop("version"),
            lambda r: r.update(version="1"),
            lambda r: r["items"][0]["anchors"].pop("1"),
            lambda r: r["items"][0].update(applies_to=["sometimes"]),
            lambda r: r["items"].append(copy.deepcopy(r["items"][0])),
            lambda r: r["items"][0].update(examples=r["items"][0]["examples"][:1]),
            lambda r: r["items"][0].update(na_allowed=True),  # na_allowed without na_when
            lambda r: r.update(langs=["fr"]),
        ]
        for change in cases:
            with self.assertRaises(SchemaError):
                validate_rubric(broken(change))

    def test_hash_changes_when_an_anchor_changes(self):
        r = copy.deepcopy(self.rubrics["safety"])
        before = rubric_hash(r)
        r["items"][0]["anchors"]["2"] += " "
        self.assertNotEqual(before, rubric_hash(r))

    def test_applicability_by_turn_type_and_language(self):
        style = self.rubrics["style"]
        self.assertIn("one_question", [i["id"] for i in applicable_items(style, "standard", "en")])
        self.assertNotIn("one_question", [i["id"] for i in applicable_items(style, "final", "en")])
        self.assertEqual([i["id"] for i in applicable_items(style, "crisis", "en")], ["plain_language", "crisis_brief_and_kind"])
        self.assertEqual(applicable_items(self.rubrics["cultural_fit"], "standard", "en"), [])
        self.assertTrue(applicable_items(self.rubrics["cultural_fit"], "standard", "zh-TW"))

    @needs_node
    def test_frozen_copies_match_the_app_and_the_annotation_page(self):
        # per-approach concepts in the theory rubric come from js/lenses.js and js/ai-chat.js;
        # annotate.html carries a copy of all rubrics. Both are checked against their sources.
        out = subprocess.run([sys.executable, str(EVAL_DIR / "tools" / "sync_from_app.py"), "--check"], capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, "run python3 lab/eval/tools/sync_from_app.py and bump the rubric version: " + out.stdout + out.stderr)

    @needs_node
    def test_every_approach_has_anchors(self):
        ids = {l["id"] for l in bridge().info()["lenses"]}
        self.assertEqual(set(self.rubrics["theory_fidelity"]["per_lens"]), ids)
        self.assertEqual(len(ids), 14)


@needs_node
class ScriptedCases(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lens_info = {l["id"]: l for l in bridge().info()["lenses"]}
        cls.cases = load_cases(EVAL_DIR / "cases" / "cases.json", cls.lens_info)

    def test_coverage(self):
        self.assertGreaterEqual(len(self.cases), 40)
        pairs = {(c["lens"], c["lang"]) for c in self.cases}
        self.assertEqual(len(pairs), 28, "every approach in both languages")
        self.assertGreaterEqual(sum("risk" in c for c in self.cases), 8)
        self.assertGreaterEqual(sum("adversarial" in c for c in self.cases), 6)
        types = Counter(c["adversarial"]["type"] for c in self.cases if "adversarial" in c)
        for t in ("diagnosis", "medication", "be_my_therapist", "jailbreak"):
            self.assertGreaterEqual(types[t], 1, t)
        risk = [c["risk"] for c in self.cases if "risk" in c]
        for lang in ("zh-TW", "en"):
            self.assertGreaterEqual(sum(1 for c in self.cases if "risk" in c and c["lang"] == lang and c["risk"]["directness"] == "indirect"), 2, lang)
        self.assertTrue(any(r["directness"] == "direct" for r in risk))

    def test_bad_cases_are_rejected(self):
        good = self.cases[0]
        for change in (lambda c: c.update(lang="jp"), lambda c: c.update(turns=[]), lambda c: c.update(lens="astrology"),
                       lambda c: c.update(risk={"turn": 9, "text": "x", "category": "self", "directness": "direct"}),
                       lambda c: c.update(risk={"turn": 1, "text": "x", "category": "weather", "directness": "direct"}),
                       lambda c: c.update(lens="rebt", topic="loss")):  # the app does not offer REBT for loss
            c = copy.deepcopy(good)
            c.pop("lookalike", None)
            change(c)
            with self.assertRaises(SchemaError):
                validate_case(c, self.lens_info)

    def test_scripted_user_inserts_turns_at_the_stated_position(self):
        case = {"id": "t", "lens": "rebt", "lang": "en", "topic": "work", "worry": "w", "answers": [], "persona": "p", "turns": ["a", "b", "c"],
                "risk": {"turn": 2, "text": "R", "category": "self", "directness": "direct"},
                "adversarial": {"turn": 4, "type": "diagnosis"}}
        user = ScriptedUser(validate_case(case, self.lens_info))
        self.assertEqual([(t.index, t.text, t.label) for t in user.turns], [(1, "a", "plain"), (2, "R", "risk"), (3, "b", "plain"), (4, "c", "adversarial")])
        self.assertEqual(user.turns[1].meta["directness"], "direct")
        self.assertEqual(user.on_pause(user.turns[1]), "send_anyway")
        self.assertEqual(user.context, {"concern": "w", "answers": []})

    def test_cases_file_is_plain_json_with_unique_ids(self):
        data = json.loads((EVAL_DIR / "cases" / "cases.json").read_text(encoding="utf-8"))
        ids = [c["id"] for c in data["cases"]]
        self.assertEqual(len(ids), len(set(ids)))


if __name__ == "__main__":
    unittest.main()
