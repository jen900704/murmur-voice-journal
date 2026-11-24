"""An end-to-end run with the MockProvider, and the orchestrator's machinery. No network anywhere."""
import csv
import json
import os
import socket
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

from _common import EVAL_DIR, ProviderError, ScriptedProvider, bridge, needs_node

from murmur_eval.cache import DiskCache, call_key
from murmur_eval.orchestrator import RESULT_COLUMNS, LLMClient, Orchestrator, RunConfig, independence
from murmur_eval.providers import AnthropicProvider, MockProvider, make_provider, model_family


def no_network(*a, **k):
    raise AssertionError("a test tried to open a network connection")


def config(tmp, **kw):
    base = dict(out_root=Path(tmp) / "runs", cache_dir=Path(tmp) / "cache", counselor_model="mock-counselor-1", judge_model="mock-judge-1", concurrency=4)
    base.update(kw)
    return RunConfig(**base)


def read_jsonl(p):
    return [json.loads(l) for l in Path(p).read_text(encoding="utf-8").splitlines() if l.strip()]


@needs_node
class EndToEndMock(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.tmp.cleanup)
        with mock.patch.object(socket, "create_connection", no_network), mock.patch.object(socket.socket, "connect", no_network):
            provider = MockProvider()
            cls.orch = Orchestrator(config(cls.tmp.name, run_id="first"), provider, provider, bridge=bridge())
            cls.run_dir = cls.orch.run()
            provider2 = MockProvider()
            cls.orch2 = Orchestrator(config(cls.tmp.name, run_id="second"), provider2, provider2, bridge=bridge())
            cls.run_dir2 = cls.orch2.run()

    def test_files_are_written(self):
        for name in ("run.json", "transcripts.jsonl", "labels.jsonl", "judgments.jsonl", "results.csv", "risk_turns.csv", "summary.md"):
            self.assertTrue((self.run_dir / name).stat().st_size > 0, name)

    def test_manifest_records_models_temperatures_hashes_and_seed(self):
        man = json.loads((self.run_dir / "run.json").read_text(encoding="utf-8"))
        self.assertEqual(man["counselor"]["model"], "mock-counselor-1")
        self.assertIsNone(man["counselor"]["temperature"])
        self.assertEqual(man["judge"]["temperature"], 0.0)
        self.assertEqual(man["judge_independence"], "different_model")
        self.assertEqual(man["seed"], 20261124)
        self.assertEqual(set(man["rubrics"]), {"theory_fidelity", "safety", "style", "cultural_fit"})
        for h in list(man["app_sources_sha256"].values()) + [man["cases_sha256"], man["judge"]["system_prompt_sha256"]] + [r["sha256"] for r in man["rubrics"].values()]:
            self.assertRegex(h, r"^[0-9a-f]{64}$")
        self.assertIn("ai-chat.js", man["app_sources_sha256"])
        self.assertEqual(man["case_errors"], [])
        self.assertEqual(man["n_cases"], len(self.orch.cases))

    def test_transcripts_cover_every_case_and_carry_the_run_record(self):
        ts = read_jsonl(self.run_dir / "transcripts.jsonl")
        self.assertEqual(len(ts), len(self.orch.cases))
        for t in ts:
            self.assertIsNone(t["error"])
            self.assertEqual((t["counselor_model"], t["judge_model"], t["seed"]), ("mock-counselor-1", "mock-judge-1", 20261124))
            self.assertNotIn("persona", t)  # annotators must not see case labels
            for tr in t["turns"]:
                self.assertNotIn("label", tr)
                if tr["assistant"]:
                    self.assertRegex(tr["system_prompt_sha256"], r"^[0-9a-f]{64}$")
        full = [t for t in ts if len(t["turns"]) == 10]
        self.assertTrue(full and all(t["ended"] == "turn_limit" and t["turns"][-1]["turn_type"] == "final" for t in full))

    def test_the_app_flow_shows_in_the_outcomes(self):
        with open(self.run_dir / "risk_turns.csv", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        risk = [r for r in rows if r["label"] == "risk"]
        self.assertEqual(len(risk), sum("risk" in c for c in self.orch.cases))
        self.assertTrue(any(r["gate_flagged"] == "1" for r in risk))
        self.assertTrue(any(r["pause_action"] == "stop" and r["model_help_line"] == "" for r in risk))   # script stopped at the pause
        self.assertTrue(any(r["reply_held"] == "1" for r in rows))                                        # the app held a reply back
        self.assertTrue(any(r["model_help_line"] == "1" and r["app_help_shown"] == "1" for r in risk))   # chat ended on a help line
        for r in rows:  # a pause always shows help
            if r["gate_flagged"] == "1":
                self.assertEqual(r["app_help_shown"], "1")

    def test_results_table(self):
        with open(self.run_dir / "results.csv", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(list(rows[0]), RESULT_COLUMNS)
        self.assertEqual({r["rubric"] for r in rows}, {"theory_fidelity", "safety", "style", "cultural_fit", "auto_checks"})
        self.assertTrue(all(r["score"] in ("", "0", "1", "2") for r in rows))
        self.assertFalse([r for r in rows if r["rubric"] == "cultural_fit" and r["lang"] == "en"])
        self.assertEqual(len({r["lens"] for r in rows}), 14)

    def test_judgments_validate_and_retries_happened(self):
        js = read_jsonl(self.run_dir / "judgments.jsonl")
        self.assertTrue(js)
        self.assertFalse([j for j in js if j["failed"]])
        self.assertTrue(any(j["attempts"] > 1 for j in js), "the mock gives a malformed first answer now and then")
        self.assertTrue(all(set(j["scores"].values()) <= {0, 1, 2, None} for j in js))

    def test_summary_report(self):
        md = (self.run_dir / "summary.md").read_text(encoding="utf-8")
        for needle in ("MockProvider", "scripted test cases", "## Risk turns", "gate recall", "system recall", "## Judge scores by rubric item",
                       "## Judge scores by approach", "family-systems", "## Failure examples", "## Automatic checks", "Wilson 95%"):
            self.assertIn(needle, md)
        self.assertNotIn(chr(0x2014), md)  # no em dashes in reports
        self.assertNotIn("real user", md.lower())

    def test_second_run_is_identical_and_served_from_cache(self):
        strip = lambda t: {k: v for k, v in t.items() if k != "run_id"} | {"turns": [{k: v for k, v in tr.items() if k != "cached"} for tr in t["turns"]]}
        a = [strip(t) for t in read_jsonl(self.run_dir / "transcripts.jsonl")]
        b = [strip(t) for t in read_jsonl(self.run_dir2 / "transcripts.jsonl")]
        self.assertEqual(a, b)
        s = self.orch2.counselor_client.stats
        self.assertEqual(s["cache_hits"], s["calls"])
        self.assertGreater(s["calls"], 100)
        self.assertEqual(self.orch.counselor_client.stats["cache_hits"], 0)


@needs_node
class Guards(unittest.TestCase):
    def test_same_model_for_counselor_and_judge_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            p = MockProvider()
            with self.assertRaises(ValueError):
                Orchestrator(config(d, judge_model="mock-counselor-1"), p, p, bridge=bridge())
            o = Orchestrator(config(d, judge_model="mock-counselor-1", allow_same_model=True), p, p, bridge=bridge())
            self.assertEqual(o.independence, "same_model")

    def test_a_broken_case_does_not_lose_the_run(self):
        with tempfile.TemporaryDirectory() as d:
            p = ScriptedProvider([ProviderError("bad request", retryable=False)])
            o = Orchestrator(config(d, only=["c002"], cache_dir=None, run_id="x", concurrency=1), p, MockProvider(), bridge=bridge())
            out = o.run()
            man = json.loads((out / "run.json").read_text(encoding="utf-8"))
            self.assertEqual([e["case_id"] for e in man["case_errors"]], ["c002"])
            self.assertIn("stopped with an error", (out / "summary.md").read_text(encoding="utf-8"))


class ClientMachinery(unittest.TestCase):
    ARGS = dict(role="t", system="s", messages=[{"role": "user", "content": "hi"}], model="m", temperature=0.0, max_tokens=10)

    def client(self, provider, cache=None, **kw):
        self.sleeps = []
        return LLMClient(provider, cache or DiskCache(None), threading.Semaphore(2), sleep=self.sleeps.append, backoff_base=1.0, **kw)

    def test_retries_with_growing_backoff_then_succeeds(self):
        p = ScriptedProvider([ProviderError("429", retryable=True), ProviderError("529", retryable=True), "ok"])
        c = self.client(p)
        self.assertEqual(c.call(**self.ARGS).text, "ok")
        self.assertEqual(c.stats["retries"], 2)
        self.assertEqual(len(self.sleeps), 2)
        self.assertTrue(0.5 <= self.sleeps[0] <= 1.0 and 1.0 <= self.sleeps[1] <= 2.0)  # 1s then 2s, each with jitter down to half

    def test_gives_up_after_max_retries_and_on_errors_that_cannot_be_retried(self):
        c = self.client(ScriptedProvider([ProviderError("503", retryable=True)] * 3), max_retries=2)
        with self.assertRaises(ProviderError):
            c.call(**self.ARGS)
        self.assertEqual(len(self.sleeps), 2)
        c = self.client(ScriptedProvider([ProviderError("401", retryable=False)]))
        with self.assertRaises(ProviderError):
            c.call(**self.ARGS)
        self.assertEqual(self.sleeps, [])

    def test_disk_cache_key_covers_everything_that_defines_a_call(self):
        with tempfile.TemporaryDirectory() as d:
            p = ScriptedProvider(["one", "two", "three"])
            c = self.client(p, DiskCache(Path(d)))
            self.assertEqual(c.call(**self.ARGS).text, "one")
            again = c.call(**self.ARGS)
            self.assertEqual((again.text, again.cached), ("one", True))
            self.assertEqual(c.call(**{**self.ARGS, "temperature": 1.0}).text, "two")
            self.assertEqual(c.call(**self.ARGS, replicate=1).text, "three")
            self.assertEqual(len(p.requests), 3)
        base = dict(provider="a", model="m", system="s", messages=[], temperature=0, max_tokens=1, seed=1, replicate=0)
        keys = {call_key(**{**base, **change}) for change in ({}, {"provider": "b"}, {"model": "n"}, {"system": "t"}, {"messages": [1]}, {"temperature": 1}, {"max_tokens": 2}, {"seed": 2}, {"replicate": 1})}
        self.assertEqual(len(keys), 9)

    def test_concurrency_never_exceeds_the_semaphore(self):
        import time
        from concurrent.futures import ThreadPoolExecutor
        from murmur_eval.providers import Completion, Provider
        lock, state = threading.Lock(), {"now": 0, "max": 0}

        class Slow(Provider):
            name = "slow"
            def complete(self, **kw):
                with lock:
                    state["now"] += 1
                    state["max"] = max(state["max"], state["now"])
                time.sleep(0.01)
                with lock:
                    state["now"] -= 1
                return Completion("x", "end_turn", "m", "slow")
        c = LLMClient(Slow(), DiskCache(None), threading.Semaphore(3))
        with ThreadPoolExecutor(12) as pool:
            list(pool.map(lambda i: c.call(**{**self.ARGS, "system": str(i)}), range(24)))
        self.assertLessEqual(state["max"], 3)
        self.assertGreaterEqual(state["max"], 2)


class Providers(unittest.TestCase):
    def test_keys_come_from_the_environment_only(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ProviderError):
                AnthropicProvider()
            with self.assertRaises(ProviderError):
                make_provider("bedrock")  # no boto3, or no region: either way a clear error and no network
        self.assertIsInstance(make_provider("mock"), MockProvider)
        with self.assertRaises(ProviderError):
            make_provider("other")

    def test_no_key_like_strings_in_the_harness_sources(self):
        import re
        pattern = re.compile(r"sk-ant-[A-Za-z0-9_-]{8,}|AKIA[0-9A-Z]{16}")
        for p in list(EVAL_DIR.glob("*.py")) + list((EVAL_DIR / "murmur_eval").glob("*.py")) + list((EVAL_DIR / "bridge").glob("*.mjs")):
            self.assertIsNone(pattern.search(p.read_text(encoding="utf-8")), p.name)

    def test_mock_is_deterministic(self):
        m = MockProvider()
        args = dict(system="Write in English. through the Gestalt tradition of counseling", messages=[{"role": "user", "content": "I feel stuck at work"}], model="mock", temperature=None, max_tokens=500, seed=5)
        self.assertEqual(m.complete(**args).text, m.complete(**args).text)

    def test_model_family_and_independence(self):
        self.assertEqual(model_family("claude-sonnet-5-5"), "anthropic-claude")
        self.assertEqual(model_family("us.anthropic.claude-x-v1:0"), "anthropic-claude")
        self.assertEqual(model_family("amazon.nova-pro-v1:0"), "amazon-nova")
        self.assertEqual(independence("bedrock", "anthropic.claude-a", "bedrock", "amazon.nova-pro-v1:0"), "different_family")
        self.assertEqual(independence("anthropic", "claude-a", "anthropic", "claude-b"), "different_model")
        self.assertEqual(independence("anthropic", "claude-a", "anthropic", "claude-a"), "same_model")
        self.assertEqual(independence("x", "foo-1", "x", "bar-1"), "different_model")  # unknown families are not assumed to differ


if __name__ == "__main__":
    unittest.main()
