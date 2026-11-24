"""Corpus loaders and the bridge to the app's scorer (node)."""
import csv
import json
import os
import subprocess

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # lab/langval
SCORER = os.path.join(ROOT, "score_texts.mjs")


def load_goemotions(tsv_path, emotions_path, prefix="ge"):
    """Rows of the filtered GoEmotions files: text <tab> comma-separated label ids <tab> comment id."""
    with open(emotions_path, encoding="utf-8") as f:
        names = [x.strip() for x in f if x.strip()]
    rows = []
    with open(tsv_path, encoding="utf-8", newline="") as f:
        for i, line in enumerate(f):
            line = line.rstrip("\r\n")
            if not line:
                continue
            text, labels, _cid = line.rsplit("\t", 2)
            rows.append({"id": f"{prefix}-{i}", "text": text, "labels": frozenset(names[int(k)] for k in labels.split(",")), "cluster": i})
    return rows


def load_cped(csv_path, prefix="cped", convert=None):
    """Rows of a CPED split. convert: optional function applied to the utterance (script conversion)."""
    rows = []
    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        for i, r in enumerate(csv.DictReader(f)):
            text = r["Utterance"]
            rows.append({"id": f"{prefix}-{i}", "text": convert(text) if convert else text,
                         "labels": frozenset([r["Emotion"]]), "cluster": r["Dialogue_ID"]})
    return rows


def score_rows(rows, hits=True, node="node"):
    """Runs the app's scorer over rows ({id, text}); returns (meta, {id: scored row})."""
    payload = "".join(json.dumps({"id": r["id"], "text": r["text"]}, ensure_ascii=False) + "\n" for r in rows)
    cmd = [node, SCORER] + (["--hits"] if hits else [])
    p = subprocess.run(cmd, input=payload.encode("utf-8"), stdout=subprocess.PIPE, check=True)
    meta, out = None, {}
    for line in p.stdout.decode("utf-8").splitlines():
        o = json.loads(line)
        if "_meta" in o:
            meta = o["_meta"]
        else:
            out[o["id"]] = o
    return meta, out


def score_cached(rows, cache_path, hits=True):
    """score_rows with a JSON-lines cache on disk (data/scored/, not committed)."""
    if os.path.exists(cache_path):
        meta, out = None, {}
        with open(cache_path, encoding="utf-8") as f:
            for line in f:
                o = json.loads(line)
                if "_meta" in o:
                    meta = o["_meta"]
                else:
                    out[o["id"]] = o
        if len(out) == len(rows):
            return meta, out
    meta, out = score_rows(rows, hits=hits)
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        f.write(json.dumps({"_meta": meta}) + "\n")
        for r in rows:
            f.write(json.dumps(out[r["id"]], ensure_ascii=False) + "\n")
    return meta, out


def to_arrays(rows, scored, lang, categories):
    """Keeps the rows the app assigned to `lang` with at least one unit. Returns a dict of arrays."""
    keep = [r for r in rows if scored[r["id"]]["lang"] == lang and scored[r["id"]]["words"] > 0]
    words = np.array([scored[r["id"]]["words"] for r in keep], dtype=float)
    counts = {c: np.array([scored[r["id"]]["c"].get(c, 0) for r in keep], dtype=float) for c in categories}
    vsum = np.array([scored[r["id"]]["vsum"] for r in keep], dtype=float)
    vn = np.array([scored[r["id"]]["vn"] for r in keep], dtype=float)
    vader = np.where(vn > 0, vsum / np.maximum(vn, 1), 0.0)
    return {
        "rows": keep,
        "n_input": len(rows),
        "n_other_language": sum(1 for r in rows if scored[r["id"]]["lang"] != lang),
        "n_zero_units": sum(1 for r in rows if scored[r["id"]]["lang"] == lang and scored[r["id"]]["words"] == 0),
        "words": words,
        "counts": counts,
        "vader": vader,
        "clusters": np.array([r["cluster"] for r in keep]),
    }


def has_any(rows, labels):
    labels = set(labels)
    return np.array([bool(r["labels"] & labels) for r in rows], dtype=bool)


def only(rows, label):
    return np.array([r["labels"] == frozenset([label]) for r in rows], dtype=bool)
