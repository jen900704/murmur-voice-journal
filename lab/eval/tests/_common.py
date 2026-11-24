"""Shared setup for the tests: import path, one bridge per process, small fake providers."""
import shutil
import sys
import unittest
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent.parent
REPO = EVAL_DIR.parent.parent
if str(EVAL_DIR) not in sys.path:
    sys.path.insert(0, str(EVAL_DIR))

from murmur_eval.bridge import Bridge  # noqa: E402
from murmur_eval.providers import Completion, Provider, ProviderError  # noqa: E402

NODE = shutil.which("node")
needs_node = unittest.skipUnless(NODE, "node is needed to run the app's JavaScript")

_bridge = None


def bridge() -> Bridge:
    global _bridge
    if _bridge is None:
        _bridge = Bridge()
    return _bridge


class ScriptedProvider(Provider):
    """Returns the given outputs in order. An Exception in the list is raised instead."""

    name = "scripted"

    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.requests = []

    def complete(self, *, system, messages, model, temperature, max_tokens, seed=None, timeout=60.0):
        self.requests.append({"system": system, "messages": messages, "model": model, "temperature": temperature, "max_tokens": max_tokens})
        out = self.outputs.pop(0)
        if isinstance(out, Exception):
            raise out
        if isinstance(out, Completion):
            return out
        return Completion(text=out, stop_reason="end_turn", model=model, provider=self.name)


__all__ = ["EVAL_DIR", "REPO", "NODE", "needs_node", "bridge", "ScriptedProvider", "ProviderError", "Completion"]
