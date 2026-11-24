"""Calls the app's real JavaScript (prompt, retrieval, safety net, send flow) through one node process."""
from __future__ import annotations

import atexit
import json
import shutil
import subprocess
import threading
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent.parent
BRIDGE_SCRIPT = EVAL_DIR / "bridge" / "murmur_bridge.mjs"


class BridgeError(RuntimeError):
    pass


class Bridge:
    """A line-based JSON channel to bridge/murmur_bridge.mjs. Safe to share across threads."""

    def __init__(self, node: str | None = None, script: Path = BRIDGE_SCRIPT):
        self._node = node or shutil.which("node")
        if not self._node:
            raise BridgeError("node was not found on PATH; the harness needs it to run the app's own JavaScript")
        self._script = str(script)
        self._lock = threading.Lock()
        self._proc: subprocess.Popen | None = None
        self._prompts: dict[tuple, str] = {}
        self._safety: dict[str, dict] = {}
        self._info: dict | None = None
        atexit.register(self.close)

    def _start(self) -> None:
        self._proc = subprocess.Popen(
            [self._node, self._script],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            bufsize=1,
        )

    def request(self, op: str, **params):
        with self._lock:
            if self._proc is None or self._proc.poll() is not None:
                self._start()
            assert self._proc and self._proc.stdin and self._proc.stdout
            try:
                self._proc.stdin.write(json.dumps({"op": op, **params}, ensure_ascii=False) + "\n")
                self._proc.stdin.flush()
                line = self._proc.stdout.readline()
            except (BrokenPipeError, OSError):
                line = ""
            if not line:
                err = self._proc.stderr.read() if self._proc.stderr else ""
                self._proc = None
                raise BridgeError(f"the node bridge stopped: {err.strip()[-800:]}")
        out = json.loads(line)
        if not out.get("ok"):
            raise BridgeError(out.get("error", "unknown bridge error"))
        return out["result"]

    def info(self) -> dict:
        if self._info is None:
            self._info = self.request("info")
        return self._info

    def system_prompt(self, lens: str, lang: str, last: bool = False) -> str:
        key = (lens, lang, bool(last))
        if key not in self._prompts:
            self._prompts[key] = self.request("system_prompt", lens=lens, lang=lang, last=bool(last))
        return self._prompts[key]

    def notes_block(self, concern: str, answers: list) -> str:
        return self.request("notes_block", context={"concern": concern, "answers": answers})

    # --- one conversation inside the app's own createAiChat().send() ---
    def chat_open(self, lens: str, lang: str, context: dict, model: str | None = None) -> dict:
        return self.request("chat_open", lens=lens, lang=lang, context=context, model=model)

    def chat_send(self, chat: str, text: str, confirmed: bool = False) -> dict:
        return self.request("chat_send", chat=chat, text=text, confirmed=confirmed)

    def chat_reply(self, chat: str, text: str, stop_reason: str | None = None, status: int = 200) -> dict:
        return self.request("chat_reply", chat=chat, text=text, stopReason=stop_reason, status=status)

    def chat_dismiss_crisis(self, chat: str) -> dict:
        return self.request("chat_dismiss_crisis", chat=chat)

    def chat_close(self, chat: str) -> None:
        try:
            self.request("chat_close", chat=chat)
        except BridgeError:
            pass

    def safety(self, text: str) -> dict:
        """{'risk': bool, 'kinds': [...], 'helpLine': bool} from js/safety.js."""
        if text not in self._safety:
            self._safety[text] = self.request("safety", texts=[text])[0]
        return self._safety[text]

    def safety_many(self, texts: list[str]) -> list[dict]:
        missing = [t for t in dict.fromkeys(texts) if t not in self._safety]
        if missing:
            for t, r in zip(missing, self.request("safety", texts=missing)):
                self._safety[t] = r
        return [self._safety[t] for t in texts]

    def close(self) -> None:
        with self._lock:
            proc, self._proc = self._proc, None
            if proc is None:
                return
            try:
                if proc.poll() is None:
                    proc.stdin.close()
                    proc.wait(timeout=3)
            except Exception:
                proc.kill()
                proc.wait()
            finally:
                for stream in (proc.stdin, proc.stdout, proc.stderr):
                    try:
                        stream.close()
                    except Exception:
                        pass
