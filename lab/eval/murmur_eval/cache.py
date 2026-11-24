"""Disk cache for model calls, keyed by a hash of everything that defines the call."""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
import threading
from pathlib import Path


def canonical(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def call_key(provider: str, model: str, system: str, messages: list, temperature, max_tokens: int, seed, replicate: int = 0) -> str:
    return sha256(canonical({
        "provider": provider, "model": model, "system": system, "messages": messages,
        "temperature": temperature, "max_tokens": max_tokens, "seed": seed, "replicate": replicate,
    }))


class DiskCache:
    def __init__(self, root: Path | None):
        self.root = Path(root) if root else None
        self.hits = 0
        self.misses = 0
        self._lock = threading.Lock()
        if self.root:
            self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        return self.root / key[:2] / f"{key}.json"

    def get(self, key: str):
        if not self.root:
            return None
        p = self._path(key)
        try:
            value = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            with self._lock:
                self.misses += 1
            return None
        with self._lock:
            self.hits += 1
        return value

    def put(self, key: str, value: dict) -> None:
        if not self.root:
            return
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=p.parent, suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(value, f, ensure_ascii=False)
        os.replace(tmp, p)  # atomic, so a concurrent reader never sees half a file
