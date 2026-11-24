import json
import threading
import unittest

from _common import EVAL_DIR, ScriptedProvider

from murmur_eval.agents import JUDGE_SYSTEM, Judge
from murmur_eval.cache import DiskCache
from murmur_eval.orchestrator import LLMClient
from murmur_eval.providers import JUDGE_MARK
from murmur_eval.schema import SchemaError, applicable_items, load_rubrics, parse_strict_json, validate_judgment

RUBRICS = load_rubrics(EVAL_DIR / "rubrics")
ARGS = dict(lens_id="rebt", lang="en", turn_type="standard", notes={"concern": "w", "answers": []}, history=[],
            last_user="I must get it.", reply="You said you must get it. What would be true if you did not?")


def client(provider):
    return LLMClient(provider, DiskCache(None), threading.Semaphore(2), sleep=lambda s: None)


def good_answer(rubric_id, turn_type="standard", lang="en", **override):
    items = applicable_items(RUBRICS[rubric_id], turn_type, lang)
    scores = {i["id"]: 2 for i in items}
    scores.update(override)
    return json.dumps({"scores": scores, "evidence": {i["id"]: "quote" for i in items}})


class StrictJson(unittest.TestCase):
    def test_accepts_an_object_and_a_fenced_object(self):
        self.assertEqual(parse_strict_json(' {"a": 1} '), {"a": 1})
        self.assertEqual(parse_strict_json('```json\n{"a": 1}\n```'), {"a": 1})

    def test_rejects_prose_arrays_and_broken_json(self):
        for bad in ('Here you go: {"a": 1}', '{"a": 1} Hope this helps', "[1, 2]", "{'a': 1}", "", '{"a": 1'):
            with self.assertRaises(SchemaError):
                parse_strict_json(bad)


class JudgmentSchema(unittest.TestCase):
    def setUp(self):
        self.items = applicable_items(RUBRICS["safety"], "standard", "en")

    def test_valid(self):
        out = validate_judgment(json.loads(good_answer("safety", risk_response=None)), self.items)
        self.assertIsNone(out["scores"]["risk_response"])
        self.assertEqual(out["scores"]["no_diagnosis"], 2)

    def test_invalid(self):
        base = json.loads(good_answer("safety"))
        def variant(change):
            o = json.loads(json.dumps(base))
            change(o)
            return o
        bad = [
            variant(lambda o: o["scores"].pop("no_diagnosis")),             # missing item
            variant(lambda o: o["scores"].update(extra=2)),                 # unknown item
            variant(lambda o: o["scores"].update(no_diagnosis=3)),          # out of range
            variant(lambda o: o["scores"].update(no_diagnosis="2")),        # string, not integer
            variant(lambda o: o["scores"].update(no_diagnosis=True)),       # boolean is not a score
            variant(lambda o: o["scores"].update(no_diagnosis=1.5)),
            variant(lambda o: o["scores"].update(no_diagnosis=None)),       # null where not allowed
            variant(lambda o: o.pop("evidence")),
            variant(lambda o: o.update(comment="x")),
            variant(lambda o: o["evidence"].update(no_diagnosis=5)),
        ]
        for o in bad:
            with self.assertRaises(SchemaError, msg=o):
                validate_judgment(o, self.items)


class JudgeRetries(unittest.TestCase):
    def test_retries_until_the_answer_passes_and_tells_the_judge_what_was_wrong(self):
        provider = ScriptedProvider(["Sure! Scores: all good.", good_answer("style", one_question=7), good_answer("style", one_question=1)])
        judge = Judge(RUBRICS["style"], client(provider), "judge-x", max_attempts=3)
        out = judge.score(**ARGS)
        self.assertFalse(out["failed"])
        self.assertEqual(out["attempts"], 3)
        self.assertEqual(out["scores"]["one_question"], 1)
        self.assertEqual(len(out["parse_errors"]), 2)
        third = provider.requests[2]["messages"]
        self.assertEqual([m["role"] for m in third], ["user", "assistant", "user", "assistant", "user"])
        self.assertIn("rejected", third[-1]["content"])
        self.assertIn("score must be 0, 1 or 2", third[-1]["content"])
        self.assertTrue(all(r["system"] == JUDGE_SYSTEM and r["temperature"] == 0.0 for r in provider.requests))

    def test_gives_up_after_max_attempts_and_marks_the_judgment_failed(self):
        provider = ScriptedProvider(["nope"] * 3)
        out = Judge(RUBRICS["style"], client(provider), "judge-x", max_attempts=3).score(**ARGS)
        self.assertTrue(out["failed"])
        self.assertTrue(all(v is None for v in out["scores"].values()))
        self.assertEqual(len(provider.requests), 3)

    def test_prompt_holds_the_rubric_the_approach_and_the_material(self):
        provider = ScriptedProvider([good_answer("theory_fidelity")])
        Judge(RUBRICS["theory_fidelity"], client(provider), "judge-x").score(**ARGS)
        prompt = provider.requests[0]["messages"][0]["content"]
        self.assertTrue(provider.requests[0]["system"].startswith(JUDGE_MARK))
        for needle in ("preferences versus demands", "Excluded techniques: forceful disputation", "lens_move", "2 = Clearly one of the allowed moves",
                       "<reply_to_score>\nYou said you must get it.", "null = does not apply"):
            self.assertIn(needle, prompt)

    def test_rubric_that_does_not_apply_makes_no_call(self):
        provider = ScriptedProvider([])
        self.assertIsNone(Judge(RUBRICS["cultural_fit"], client(provider), "judge-x").score(**ARGS))
        self.assertEqual(provider.requests, [])


if __name__ == "__main__":
    unittest.main()
