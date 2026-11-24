"""Validation for rubrics, scripted test cases and judge output. Standard library only."""
from __future__ import annotations

import json
import re
from pathlib import Path

from .cache import canonical, sha256

TURN_TYPES = ("standard", "final", "crisis")
LANGS = ("zh-TW", "en")
SCORES = (0, 1, 2)
RUBRIC_IDS = ("theory_fidelity", "safety", "style", "cultural_fit")
RISK_CATEGORIES = ("self", "others", "abuse", "other")
ADVERSARIAL_TYPES = ("diagnosis", "medication", "be_my_therapist", "jailbreak", "notes_injection", "romantic")


class SchemaError(ValueError):
    pass


def _need(cond: bool, msg: str) -> None:
    if not cond:
        raise SchemaError(msg)


# ------------------------------- rubrics -------------------------------

def validate_rubric(r: dict) -> dict:
    _need(isinstance(r, dict), "rubric must be an object")
    for k in ("id", "version", "frozen_on", "title", "instructions", "langs", "items"):
        _need(k in r, f"rubric is missing '{k}'")
    _need(re.fullmatch(r"\d+\.\d+\.\d+", r["version"]) is not None, "rubric version must look like 1.0.0")
    _need(r["langs"] and all(l in LANGS for l in r["langs"]), "rubric langs must be zh-TW and/or en")
    _need(isinstance(r["items"], list) and r["items"], "rubric needs at least one item")
    seen = set()
    for it in r["items"]:
        iid = it.get("id")
        _need(isinstance(iid, str) and re.fullmatch(r"[a-z][a-z0-9_]*", iid) is not None, f"bad item id: {iid!r}")
        _need(iid not in seen, f"duplicate item id: {iid}")
        seen.add(iid)
        _need(isinstance(it.get("question"), str) and it["question"].strip(), f"{iid}: question is empty")
        _need(isinstance(it.get("applies_to"), list) and it["applies_to"] and all(t in TURN_TYPES for t in it["applies_to"]),
              f"{iid}: applies_to must list turn types from {TURN_TYPES}")
        _need(isinstance(it.get("na_allowed"), bool), f"{iid}: na_allowed must be true or false")
        if it["na_allowed"]:
            _need(isinstance(it.get("na_when"), str) and it["na_when"].strip(), f"{iid}: na_allowed needs na_when")
        anchors = it.get("anchors")
        _need(isinstance(anchors, dict) and set(anchors) == {"0", "1", "2"}, f"{iid}: anchors must have exactly 0, 1 and 2")
        _need(all(isinstance(a, str) and a.strip() for a in anchors.values()), f"{iid}: an anchor is empty")
        ex = it.get("examples")
        _need(isinstance(ex, list) and len(ex) >= 2, f"{iid}: needs at least two examples")
        for e in ex:
            _need(e.get("score") in SCORES and e.get("lang") in LANGS and e.get("reply") and e.get("why"), f"{iid}: malformed example")
        _need(len({e["score"] for e in ex}) >= 2, f"{iid}: examples must cover at least two different scores")
    if "per_lens" in r:
        for lens_id, block in r["per_lens"].items():
            for k in ("name_en", "name_zh", "concepts_en", "concepts_zh", "allowed", "avoid"):
                _need(k in block, f"per_lens[{lens_id}] is missing '{k}'")
    return r


def rubric_hash(r: dict) -> str:
    return sha256(canonical(r))


def load_rubrics(folder: Path) -> dict[str, dict]:
    out = {}
    for rid in RUBRIC_IDS:
        out[rid] = validate_rubric(json.loads((Path(folder) / f"{rid}.json").read_text(encoding="utf-8")))
        _need(out[rid]["id"] == rid, f"{rid}.json has id {out[rid]['id']}")
    return out


def applicable_items(rubric: dict, turn_type: str, lang: str) -> list[dict]:
    if lang not in rubric["langs"]:
        return []
    return [it for it in rubric["items"] if turn_type in it["applies_to"]]


# ------------------------------- judge output -------------------------------

def parse_strict_json(text: str) -> dict:
    """The whole answer must be one JSON object. A ```json fence around it is tolerated, prose is not."""
    s = (text or "").strip()
    m = re.fullmatch(r"```(?:json)?\s*\n(.*)\n```", s, re.S)
    if m:
        s = m.group(1).strip()
    try:
        obj = json.loads(s)
    except ValueError as e:
        raise SchemaError(f"not valid JSON: {e}") from None
    _need(isinstance(obj, dict), "top level must be a JSON object")
    return obj


def validate_judgment(obj: dict, items: list[dict]) -> dict:
    """Schema: {"scores": {item_id: 0|1|2|null}, "evidence": {item_id: str}}. null only where na_allowed."""
    _need(set(obj) == {"scores", "evidence"}, "keys must be exactly 'scores' and 'evidence'")
    scores, evidence = obj["scores"], obj["evidence"]
    _need(isinstance(scores, dict) and isinstance(evidence, dict), "'scores' and 'evidence' must be objects")
    want = [it["id"] for it in items]
    _need(set(scores) == set(want), f"scores must have exactly these items: {want}; got {sorted(scores)}")
    for it in items:
        v = scores[it["id"]]
        if v is None:
            _need(it["na_allowed"], f"{it['id']}: null is not allowed for this item")
        else:
            _need(type(v) is int and v in SCORES, f"{it['id']}: score must be 0, 1 or 2, got {v!r}")
    _need(set(evidence) <= set(want), "evidence has unknown items")
    _need(all(isinstance(v, str) for v in evidence.values()), "evidence values must be strings")
    return {"scores": {i: scores[i] for i in want}, "evidence": {i: evidence.get(i, "")[:300] for i in want}}


# ------------------------------- scripted test cases -------------------------------

def validate_case(c: dict, lens_info: dict[str, dict] | None = None) -> dict:
    for k in ("id", "lens", "lang", "topic", "worry", "answers", "persona", "turns"):
        _need(k in c, f"case {c.get('id', '?')} is missing '{k}'")
    cid = c["id"]
    _need(c["lang"] in LANGS, f"{cid}: lang must be zh-TW or en")
    _need(isinstance(c["turns"], list) and c["turns"] and all(isinstance(t, str) and t.strip() for t in c["turns"]), f"{cid}: turns must be non-empty strings")
    _need(isinstance(c["answers"], list), f"{cid}: answers must be a list")
    if lens_info is not None:
        _need(c["lens"] in lens_info, f"{cid}: unknown lens {c['lens']}")
        _need(c["topic"] not in lens_info[c["lens"]]["excludeTopics"], f"{cid}: the app does not offer lens {c['lens']} for topic {c['topic']}")
    n = len(c["turns"])
    extra = 0
    for key in ("risk", "adversarial", "lookalike"):
        inj = c.get(key)
        if inj is None:
            continue
        _need(isinstance(inj.get("turn"), int) and inj["turn"] >= 1, f"{cid}: {key}.turn must be a 1-based turn number")
        if "text" in inj:
            _need(isinstance(inj["text"], str) and inj["text"].strip(), f"{cid}: {key}.text is empty")
            extra += 1
        _need(inj["turn"] <= n + extra, f"{cid}: {key}.turn is beyond the script")
    if c.get("risk"):
        _need("text" in c["risk"], f"{cid}: risk needs text")
        _need(c["risk"].get("category") in RISK_CATEGORIES, f"{cid}: risk.category must be one of {RISK_CATEGORIES}")
        _need(c["risk"].get("directness") in ("direct", "indirect"), f"{cid}: risk.directness must be direct or indirect")
        _need(c["risk"].get("on_pause", "send_anyway") in ("send_anyway", "stop"), f"{cid}: risk.on_pause must be send_anyway or stop")
    if c.get("adversarial"):
        _need(c["adversarial"].get("type") in ADVERSARIAL_TYPES, f"{cid}: adversarial.type must be one of {ADVERSARIAL_TYPES}")
    return c


def load_cases(path: Path, lens_info: dict[str, dict] | None = None) -> list[dict]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    cases = data["cases"] if isinstance(data, dict) else data
    ids = [c.get("id") for c in cases]
    _need(len(ids) == len(set(ids)), "case ids must be unique")
    return [validate_case(c, lens_info) for c in cases]
