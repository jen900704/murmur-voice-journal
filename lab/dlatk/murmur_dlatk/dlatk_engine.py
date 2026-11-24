"""Run the real DLATK (dlatkInterface.py) on a local SQLite database, with no MySQL server.

DLATK is called as a separate program and is never imported here, so this package works
(through the fallback engine) when DLATK is absent, and DLATK may live in its own virtual
environment. Every command that is run is written to dlatk_raw/commands.log.
"""
import csv
import json
import os
import shutil
import sqlite3
import subprocess
import sys
from collections import OrderedDict

MSG_TABLE = "msgs"
INSTALL_HELP = """DLATK was not found.

Looked for dlatkInterface.py in: --dlatk-interface, the MURMUR_DLATK_INTERFACE environment
variable, and the PATH.

To install it in its own environment (tested with Python 3.13, see lab/dlatk/README.md):

    python3 -m venv ~/dlatk-venv
    ~/dlatk-venv/bin/pip install -r lab/dlatk/requirements-dlatk.txt
    python3 -m murmur_dlatk.run --input export.json --out results/ \\
        --dlatk-interface ~/dlatk-venv/bin/dlatkInterface.py

Or run without DLATK:  --engine fallback  (same n-gram and lexicon numbers, pure Python)."""


class DlatkNotFound(RuntimeError):
    pass


class DlatkFailed(RuntimeError):
    pass


def find_interface(explicit=None):
    """-> (python executable, path to dlatkInterface.py) or raise DlatkNotFound."""
    if explicit:
        c = os.path.abspath(os.path.expanduser(explicit))
        if not os.path.isfile(c):
            raise DlatkNotFound("--dlatk-interface points to %s, which does not exist.\n\n%s" % (c, INSTALL_HELP))
    for c in (explicit, os.environ.get("MURMUR_DLATK_INTERFACE"), shutil.which("dlatkInterface.py")):
        if not c:
            continue
        c = os.path.abspath(os.path.expanduser(c))
        if os.path.isfile(c):
            beside = os.path.join(os.path.dirname(c), "python")
            return (beside if os.path.exists(beside) else sys.executable), c
    raise DlatkNotFound(INSTALL_HELP)


_VERSIONS = """
import json, sys
from importlib import metadata as m
out = {"python": sys.version.split()[0]}
for name in ("dlatk", "numpy", "scipy", "pandas", "statsmodels", "scikit-learn", "nltk", "patsy", "PyMySQL", "matplotlib", "wordcloud"):
    try: out[name] = m.version(name)
    except Exception: out[name] = None
try:
    out["dlatk_source"] = json.loads(m.distribution("dlatk").read_text("direct_url.json") or "{}")
except Exception:
    out["dlatk_source"] = None
print(json.dumps(out))
"""


def versions(python):
    try:
        res = subprocess.run([python, "-c", _VERSIONS], capture_output=True, text=True, timeout=120)
        return json.loads(res.stdout.strip().splitlines()[-1])
    except Exception as err:  # version reporting must never stop a run
        return {"error": str(err)}


def build_database(db_path, rows, outcomes, group_col):
    """rows: (message_id, user_id, week_id, month_id, created_time, source, message).
    No PRIMARY KEY or UNIQUE on text columns: SQLite would create automatic indexes whose
    definition is NULL, which DLATK's index check cannot read."""
    if os.path.exists(db_path):
        os.remove(db_path)
    con = sqlite3.connect(db_path)
    con.execute("CREATE TABLE %s (message_id INTEGER PRIMARY KEY, user_id TEXT, week_id TEXT, month_id TEXT, "
                "created_time TEXT, source TEXT, message TEXT)" % MSG_TABLE)
    con.executemany("INSERT INTO %s VALUES (?,?,?,?,?,?,?)" % MSG_TABLE, rows)
    con.execute("CREATE INDEX msgs_group ON %s (%s)" % (MSG_TABLE, group_col))
    con.execute("CREATE TABLE outcomes (%s TEXT, mood REAL, energy REAL)" % group_col)
    con.executemany("INSERT INTO outcomes VALUES (?,?,?)",
                    [(g, o.get("mood"), o.get("energy")) for g, o in outcomes.items()])
    con.execute("CREATE INDEX outcomes_group ON outcomes (%s)" % group_col)
    con.commit()
    con.close()


def build_lexicon_database(db_path, lexica):
    """lexica: name -> list of (term, category, weight), in DLATK's sparse lexicon layout."""
    if os.path.exists(db_path):
        os.remove(db_path)
    con = sqlite3.connect(db_path)
    for name, rows in lexica.items():
        con.execute("CREATE TABLE %s (id INTEGER PRIMARY KEY, term TEXT, category TEXT, weight REAL)" % name)
        con.executemany("INSERT INTO %s (term, category, weight) VALUES (?,?,?)" % name, rows)
    con.commit()
    con.close()


class Dlatk:
    def __init__(self, python, interface, work_dir, raw_dir, group_col):
        self.python, self.interface = python, interface
        self.work, self.raw, self.group_col = os.path.abspath(work_dir), os.path.abspath(raw_dir), group_col
        self.db = os.path.join(self.work, "murmur")          # DLATK appends .db
        self.lexdb = os.path.join(self.work, "lexica")
        os.makedirs(self.raw, exist_ok=True)
        self.log = os.path.join(self.raw, "commands.log")
        open(self.log, "w", encoding="utf-8").close()

    def run(self, args, check=True):
        base = ["-e", "sqlite", "-d", self.db, "-t", MSG_TABLE, "-c", self.group_col, "--lexicondb", self.lexdb]
        cmd = [self.python, self.interface] + base + [str(a) for a in args]
        env = dict(os.environ, MPLBACKEND="Agg", PYTHONWARNINGS="ignore")
        res = subprocess.run(cmd, capture_output=True, text=True, env=env, cwd=self.work)
        shown = " ".join(["dlatkInterface.py"] + base + [str(a) for a in args])
        shown = shown.replace(self.work, "<work>").replace(self.raw, "<out>/dlatk_raw")
        with open(self.log, "a", encoding="utf-8") as f:
            f.write("%s\n  exit code %d\n" % (shown, res.returncode))
        if check and res.returncode != 0:
            tail = "\n".join((res.stderr or res.stdout).strip().splitlines()[-15:])
            raise DlatkFailed("DLATK stopped with an error while running:\n  %s\n\n%s" % (shown, tail))
        return res

    def _scrub(self, path):
        """Replace this computer's folder names in a DLATK output file, so results can be shared."""
        with open(path, encoding="utf-8") as f:
            text = f.read()
        text = text.replace(self.raw, "<out>/dlatk_raw").replace(self.work, "<work>")
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)

    def _con(self):
        return sqlite3.connect(self.db + ".db")

    def tables(self, like):
        con = self._con()
        out = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?", (like,))]
        con.close()
        return out

    def read_table(self, table):
        """-> period -> {feat: (value, group_norm)}"""
        con = self._con()
        out = {}
        for g, feat, value, norm in con.execute('SELECT group_id, feat, value, group_norm FROM "%s"' % table):
            if not str(feat).startswith("_intercept"):
                out.setdefault(str(g), {})[feat] = (value, norm)
        con.close()
        return OrderedDict(sorted(out.items()))

    def feat(self, kind):
        return "feat$%s$%s$%s" % (kind, MSG_TABLE, self.group_col)

    def add_ngrams(self):
        self.run(["--add_ngrams", "-n", 1, 2, 3, "--combine_feat_tables", "1to3gram"])
        return [self.feat("%dgram" % n) for n in (1, 2, 3)], self.feat("1to3gram")

    def occurrence_filter(self, table, p_occ, min_words):
        before = set(self.tables(table + "$%"))
        self.run(["-f", table, "--feat_occ_filter", "--set_p_occ", p_occ, "--group_freq_thresh", min_words])
        new = sorted(set(self.tables(table + "$%")) - before)
        if not new:
            raise DlatkFailed("DLATK did not create the occurrence-filtered table for %s." % table)
        return new[0]

    def add_lexicon(self, name):
        self.run(["--add_lex_table", "-l", name, "--weighted_lexicon"])
        found = self.tables("feat$cat_%s_w$%s$%s%%" % (name, MSG_TABLE, self.group_col))
        if not found:
            raise DlatkFailed("DLATK did not create a feature table for lexicon %s." % name)
        return sorted(found)[0]

    def correlate(self, table, label, outcome_names, min_words, wordclouds=False):
        """Two runs: uncorrected p-values, then Benjamini-Hochberg. -> rows, wordcloud note."""
        common = ["-f", table, "--outcome_table", "outcomes", "--outcomes"] + list(outcome_names) + \
                 ["--correlate", "--spearman", "--csv", "--group_freq_thresh", min_words]
        if "$cat_" in table:   # DLATK adds a constant _intercept row to lexicon tables; keep it out of the tests
            common += ["--blacklist", "--feat_blacklist", "_intercept"]
        raw_name, bh_name = os.path.join(self.raw, label + "_uncorrected"), os.path.join(self.raw, label + "_bh")
        self.run(common + ["--no_correction", "--output_name", raw_name])
        note = None
        if wordclouds:
            res = self.run(common + ["--p_correction", "BH", "--output_name", bh_name, "--tagcloud", "--make_wordclouds"], check=False)
            if res.returncode != 0:
                note = "DLATK word clouds could not be made (is the wordcloud package installed next to DLATK?)."
                wordclouds = False
        if not wordclouds:
            self.run(common + ["--p_correction", "BH", "--output_name", bh_name])
        for name in (raw_name, bh_name):   # DLATK prints its parameters, with full paths, at the top of each file
            self._scrub(name + ".csv")
        raw, bh = read_correlation_csv(raw_name + ".csv"), read_correlation_csv(bh_name + ".csv")
        rows = []
        for key, r in sorted(raw.items()):
            if key in bh:
                r["p_bh"] = bh[key]["p"]
                rows.append(r)
        return rows, note


def _num(s):
    try:
        v = float(s)
    except (TypeError, ValueError):
        return None
    return None if v != v else v


def read_correlation_csv(path):
    """DLATK's --csv correlation matrix -> {(feature, outcome): row}. The file starts with a
    dump of the parameters; the table begins at the line whose first cell is 'feature'."""
    out = {}
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    start = next((i for i, r in enumerate(rows) if r and r[0] == "feature"), None)
    if start is None:
        return out
    header = rows[start]
    blocks = [(i, header[i]) for i in range(1, len(header)) if i + 1 < len(header) and header[i + 1] == "p"]
    for r in rows[start + 1:]:
        if len(r) < len(header) or str(r[0]).startswith("_intercept"):
            continue
        for i, outcome in blocks:
            rho, p, n = _num(r[i]), _num(r[i + 1]), _num(r[i + 2])
            if rho is None or p is None:
                continue
            out[(r[0], outcome)] = {"feature": r[0], "outcome": outcome, "rho": rho, "p": p, "n": int(n or 0),
                                    "ci_low": _num(r[i + 3]), "ci_high": _num(r[i + 4]), "freq": _num(r[i + 5])}
    return out
