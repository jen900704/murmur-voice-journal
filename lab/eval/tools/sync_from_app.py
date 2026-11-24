#!/usr/bin/env python3
"""Copies what the frozen files need from their sources of truth.

1. rubrics/theory_fidelity.json gets a per_lens block (names, concepts, allowed moves, excluded
   techniques) read from js/lenses.js and js/ai-chat.js through the node bridge.
2. annotate.html gets the four rubrics embedded, so the page works from a file with no server.

Run with --check to verify without writing (the tests do this). When this script changes a
rubric, bump that rubric's version: scores under different versions are not comparable.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(EVAL_DIR))

from murmur_eval.bridge import Bridge  # noqa: E402
from murmur_eval.schema import RUBRIC_IDS  # noqa: E402

RUBRIC_BLOCK = re.compile(r'(<script type="application/json" id="rubrics">)(.*?)(</script>)', re.S)


def per_lens_from_app(bridge: Bridge) -> dict:
    return {l["id"]: {"name_en": l["en"]["name"], "name_zh": l["zh"]["name"], "chapter": l["chapter"],
                      "concepts_en": l["en"]["concepts"], "concepts_zh": l["zh"]["concepts"],
                      "allowed": l["allowed"], "avoid": l["avoid"]} for l in bridge.info()["lenses"]}


def embedded_rubrics() -> str:
    data = {rid: json.loads((EVAL_DIR / "rubrics" / f"{rid}.json").read_text(encoding="utf-8")) for rid in RUBRIC_IDS}
    # "</" must not appear inside a script element
    return json.dumps(data, ensure_ascii=False).replace("</", "<\\/")


def main() -> int:
    check = "--check" in sys.argv
    stale = []
    path = EVAL_DIR / "rubrics" / "theory_fidelity.json"
    rubric = json.loads(path.read_text(encoding="utf-8"))
    bridge = Bridge()
    try:
        want = per_lens_from_app(bridge)
    finally:
        bridge.close()
    if rubric.get("per_lens") != want:
        stale.append("rubrics/theory_fidelity.json per_lens")
        if not check:
            rubric["per_lens"] = want
            path.write_text(json.dumps(rubric, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    page = EVAL_DIR / "annotate.html"
    if page.exists():
        html = page.read_text(encoding="utf-8")
        m = RUBRIC_BLOCK.search(html)
        if not m:
            print("annotate.html has no rubrics block", file=sys.stderr)
            return 2
        want_block = embedded_rubrics()
        if m.group(2).strip() != want_block:
            stale.append("annotate.html rubrics")
            if not check:
                page.write_text(html[: m.start(2)] + "\n" + want_block + "\n" + html[m.end(2):], encoding="utf-8")
    if stale:
        print(("stale: " if check else "updated: ") + ", ".join(stale))
        return 1 if check else 0
    print("in sync")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
