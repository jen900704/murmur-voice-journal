"""Checks on the post-fix retest material: the frozen baseline engine, the generated
Simplified-to-Traditional data, and the style rules of RETEST.md. No network."""
import hashlib
import os
import re
import shutil
import subprocess
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.dirname(os.path.dirname(ROOT))
ENGINE_FILES = ["score.js", "tokenize.js", "lexicon-en.js", "lexicon-zh.js", "vader.js"]


def sha(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def lock():
    out = {}
    with open(os.path.join(ROOT, "PREREG.lock"), encoding="utf-8") as f:
        for line in f:
            if line.strip() and not line.startswith("#"):
                h, name = line.split()
                out[os.path.basename(name)] = h
    return out


class TestRetestMaterial(unittest.TestCase):
    def test_baseline_engine_is_the_locked_engine(self):
        hashes = lock()
        for f in ENGINE_FILES:
            self.assertEqual(sha(os.path.join(ROOT, "baseline_engine", "js", "langlab", f)), hashes[f], f)

    def test_plan_files_are_unchanged(self):
        hashes = lock()
        self.assertEqual(sha(os.path.join(ROOT, "PREREG.md")), hashes["PREREG.md"])
        self.assertEqual(sha(os.path.join(ROOT, "langval", "hypotheses.py")), hashes["hypotheses.py"])
        self.assertEqual(sha(os.path.join(ROOT, "score_texts.mjs")), hashes["score_texts.mjs"])

    def test_retest_document_style(self):
        path = os.path.join(ROOT, "RETEST.md")
        if not os.path.exists(path):
            self.skipTest("RETEST.md not written yet")
        with open(path, encoding="utf-8") as f:
            text = f.read()
        self.assertNotIn("—", text)
        self.assertIsNone(re.search(r"\br = -?0\.\d", text))
        self.assertIsNone(re.search(r"AUC[^|\n]{0,20}\b0\.\d", text))
        self.assertIn("post-fix retest", text.lower())
        self.assertIn("held-out", text.lower())

    def test_generated_map_is_up_to_date(self):
        try:
            import opencc  # noqa: F401
        except ImportError:
            self.skipTest("opencc-python-reimplemented not installed")
        if not shutil.which("node"):
            self.skipTest("node not installed")
        p = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "build_zh_s2t.py"), "--check"],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.assertEqual(p.returncode, 0, p.stdout.decode() + p.stderr.decode())

    @unittest.skipUnless(shutil.which("node"), "node not installed")
    def test_old_and_new_engine_differ_only_where_fixed(self):
        sys.path.insert(0, ROOT)
        import run_retest as R
        import tempfile

        tmp = tempfile.mkdtemp(prefix="langval-test-")
        try:
            old_scorer = R.baseline_tree(tmp)
            rows = [
                {"id": "a", "text": "A huge yellow health scare, but we hug and heal."},
                {"id": "b", "text": "我很難過，也很高興。你在幹什麼？"},
                {"id": "c", "text": "我很难过，谢谢你。"},
                {"id": "d", "text": "I am happy and grateful, not sad."},
            ]
            _, old = R.score(rows, old_scorer)
            _, new = R.score(rows, os.path.join(ROOT, "score_texts.mjs"))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        self.assertEqual(old["a"]["c"].get("posemo"), 4)   # huge, health, hug, heal
        self.assertEqual(new["a"]["c"].get("posemo"), 2)   # hug, heal
        self.assertEqual(old["a"]["c"].get("anger"), 1)    # yellow
        self.assertNotIn("anger", new["a"]["c"])
        self.assertNotIn("sad", old["b"]["c"])
        self.assertEqual(new["b"]["c"].get("sad"), 1)
        self.assertEqual(new["b"]["c"].get("posemo"), 1)
        self.assertEqual(old["b"]["c"].get("anger"), 1)    # 幹 in 幹什麼
        self.assertNotIn("anger", new["b"]["c"])
        self.assertNotIn("grat", old["c"]["c"])
        self.assertEqual(new["c"]["c"].get("grat"), 1)
        self.assertEqual(new["c"]["c"].get("sad"), 1)
        self.assertEqual(old["d"]["c"], new["d"]["c"])


if __name__ == "__main__":
    unittest.main()
