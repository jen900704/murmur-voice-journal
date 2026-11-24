"""Load sparse lexica (CSV with columns term, category, weight)."""
import csv
import os

LEXICA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lexica")
BUNDLED = ("vader_valence", "murmur_basic")


def lexicon_name(path):
    name = os.path.splitext(os.path.basename(path))[0].lower()
    name = "".join(c if c.isalnum() else "_" for c in name)
    return name if name[:1].isalpha() else "lex_" + name


def load_lexicon(path):
    """-> list of (term, category, weight). Terms are lowercased; a missing weight is 1."""
    rows = []
    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or "term" not in reader.fieldnames or "category" not in reader.fieldnames:
            raise ValueError("%s: a lexicon CSV needs the columns term, category and (optionally) weight." % path)
        for r in reader:
            term, cat = (r.get("term") or "").strip().lower(), (r.get("category") or "").strip()
            if not term or not cat:
                continue
            try:
                weight = float(r.get("weight") or 1)
            except ValueError:
                raise ValueError("%s: weight for term %r is not a number." % (path, term))
            rows.append((term, cat, weight))
    if not rows:
        raise ValueError("%s: the lexicon is empty." % path)
    return rows


def bundled_paths():
    return [os.path.join(LEXICA_DIR, n + ".csv") for n in BUNDLED]
