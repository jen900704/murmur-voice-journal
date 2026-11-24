"""python3 -m murmur_dlatk.run --input export.json --out results/

Turns a Murmur backup (and optional social posts) into a DLATK message table, extracts
1- to 3-gram and lexicon features per week or month, and, when there are enough rated
periods, correlates them with the mood and energy ratings. Everything runs on this
computer; nothing is sent anywhere.
"""
import argparse
import csv
import hashlib
import json
import os
import sys
from collections import Counter, OrderedDict

from . import __version__, dlatk_engine, export, fallback, grouping, lexica, plots, textprep, topics

OUTCOMES = ("mood", "energy")


def build_parser():
    p = argparse.ArgumentParser(prog="python3 -m murmur_dlatk.run", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--input", required=True, help="Murmur JSON backup (About > Export backup).")
    p.add_argument("--out", required=True, help="Folder for the results (created if missing).")
    p.add_argument("--posts", help="Optional JSON list of social posts: [{text, timestamp, source}, ...].")
    p.add_argument("--group", choices=("week", "month"), default="week", help="Unit of analysis (default: week).")
    p.add_argument("--engine", choices=("auto", "dlatk", "fallback"), default="auto",
                   help="auto: DLATK when it is installed, otherwise the pure-Python fallback.")
    p.add_argument("--dlatk-interface", help="Path to dlatkInterface.py (default: found on PATH).")
    p.add_argument("--sources", default=",".join(export.SOURCES),
                   help="Comma-separated text sources to include. Default: %(default)s")
    p.add_argument("--include-demo", action="store_true", help="Include the app's synthetic demo entries.")
    p.add_argument("--utc-offset", type=float, default=0.0, help="Hours added to UTC before cutting weeks or months (default 0).")
    p.add_argument("--user-id", default="u1", help="Value of the user_id column (default u1).")
    p.add_argument("--min-words", type=int, default=50, help="A period needs this many tokens to be analyzed (DLATK's --group_freq_thresh; default 50).")
    p.add_argument("--min-groups", type=int, default=12, help="Correlations need this many periods with text and ratings (default 12).")
    p.add_argument("--p-occ", type=float, default=0.5, help="Keep n-grams that occur in at least this share of periods (DLATK's --set_p_occ; default 0.5).")
    p.add_argument("--lexicon", action="append", default=[], metavar="CSV", help="Extra lexicon CSV (term,category,weight). Check its license yourself.")
    p.add_argument("--no-bundled-lexica", action="store_true", help="Do not use the lexica shipped in murmur_dlatk/lexica.")
    p.add_argument("--topics", choices=("auto", "on", "off"), default="auto", help="LDA topics from this text only (auto: when there are enough messages and scikit-learn is installed).")
    p.add_argument("--num-topics", type=int, default=5)
    p.add_argument("--lda-min-messages", type=int, default=200, help="Minimum number of messages before topics are estimated (default 200).")
    p.add_argument("--no-plots", action="store_true")
    return p


class Stop(Exception):
    """A problem to show the person, without a traceback."""


def fmt(v):
    if v is None:
        return ""
    if isinstance(v, float):
        return "%.6g" % v
    return str(v)


def write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        for r in rows:
            w.writerow([fmt(v) for v in r])


def r_str(v):
    """APA style, no leading zero: .63, -.20"""
    if v is None:
        return "n/a"
    s = "%.2f" % v
    return s.replace("0.", ".", 1) if abs(v) < 1 else s


def compare_tables(a, b):
    """Agreement between two period -> {feat: (value, norm)} tables."""
    keys_a = {(g, f) for g, feats in a.items() for f in feats}
    keys_b = {(g, f) for g, feats in b.items() for f in feats}
    common = keys_a & keys_b
    diff = max((abs(a[g][f][1] - b[g][f][1]) for g, f in common), default=0.0)
    counts = sum(1 for g, f in common if a[g][f][0] != b[g][f][0])
    return {"rows_dlatk": len(keys_a), "rows_fallback": len(keys_b), "rows_in_both": len(common),
            "rows_only_dlatk": len(keys_a - keys_b), "rows_only_fallback": len(keys_b - keys_a),
            "counts_that_differ": counts, "max_abs_diff_group_norm": float("%.3g" % diff)}


def compare_correlations(a, b):
    ka = {(r["feature"], r["outcome"]): r for r in a}
    kb = {(r["feature"], r["outcome"]): r for r in b}
    common = sorted(set(ka) & set(kb))
    out = {"rows_dlatk": len(ka), "rows_fallback": len(kb), "rows_in_both": len(common)}
    for k in ("rho", "p", "p_bh"):
        out["max_abs_diff_" + k] = float("%.3g" % max((abs(ka[c][k] - kb[c][k]) for c in common), default=0.0))
    return out


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        return run(args)
    except (export.ExportError, Stop, dlatk_engine.DlatkNotFound, dlatk_engine.DlatkFailed, ValueError) as err:
        print("murmur_dlatk: " + str(err), file=sys.stderr)
        return 2


def run(args):
    notes, skipped_steps = [], OrderedDict()
    group_col = args.group + "_id"

    # ---- 1. read ----
    data = export.load_json(args.input)
    parsed = export.parse_export(data, include_demo=args.include_demo)
    messages = parsed["messages"]
    if args.posts:
        posts, bad = export.parse_posts(export.load_json(args.posts))
        messages, parsed["skipped"] = messages + posts, parsed["skipped"] + bad
    wanted = [s.strip() for s in args.sources.split(",") if s.strip()]
    unknown = [s for s in wanted if s not in export.SOURCES]
    if unknown:
        raise Stop("Unknown --sources value(s): %s. Choose from: %s" % (", ".join(unknown), ", ".join(export.SOURCES)))
    messages = export.sort_messages(export.filter_sources(messages, wanted))
    prepared = [(m, textprep.normalize(m.text)) for m in messages]
    prepared = [(m, t) for m, t in prepared if t]
    if not prepared:
        raise Stop("No text was found in the input (notes, bedtime worries and kind things, lens exercises, posts). "
                   "Nothing to analyze." + (" %d demo entries were left out; add --include-demo to use them." % parsed["demo_skipped"] if parsed["demo_skipped"] else ""))
    if parsed["demo_skipped"]:
        notes.append("%d synthetic demo entries from the app were left out (use --include-demo to keep them)." % parsed["demo_skipped"])
    if parsed["skipped"]:
        notes.append("%d records were skipped because they had no usable date or text." % parsed["skipped"])

    os.makedirs(args.out, exist_ok=True)
    work = os.path.join(args.out, "work")
    os.makedirs(work, exist_ok=True)

    # ---- 2. message table and groups ----
    off = args.utc_offset
    rows = [(i + 1, args.user_id, grouping.week_id(m.created, off), grouping.month_id(m.created, off),
             m.created.strftime("%Y-%m-%d %H:%M:%S"), m.source, t) for i, (m, t) in enumerate(prepared)]
    gi = 2 if args.group == "week" else 3
    grouped = OrderedDict()
    for r in rows:
        grouped.setdefault(r[gi], []).append(r[6])
    grouped = OrderedDict(sorted(grouped.items()))
    outcomes = grouping.mean_ratings(parsed["ratings"], args.group, off)

    lex = OrderedDict()
    paths = ([] if args.no_bundled_lexica else lexica.bundled_paths()) + list(args.lexicon)
    for path in paths:
        if not os.path.isfile(path):
            raise Stop("Lexicon file not found: %s" % path)
        lex[lexica.lexicon_name(path)] = lexica.load_lexicon(path)

    # ---- 3. optional topics, from this text only ----
    topic_summary = None
    if args.topics == "off":
        skipped_steps["topics"] = "turned off with --topics off"
    elif len(prepared) < args.lda_min_messages and args.topics == "auto":
        skipped_steps["topics"] = "%d messages, fewer than the %d set by --lda-min-messages" % (len(prepared), args.lda_min_messages)
    elif not topics.available():
        if args.topics == "on":
            raise Stop("--topics on needs scikit-learn (pip install scikit-learn).")
        skipped_steps["topics"] = "scikit-learn is not installed"
    else:
        try:
            topic_rows, topic_summary = topics.estimate([t for _, t in prepared], num_topics=args.num_topics)
            lex["murmur_topics"] = topic_rows
        except ValueError as err:
            if args.topics == "on":
                raise Stop("Topics could not be estimated: %s." % err)
            skipped_steps["topics"] = str(err)

    # ---- 4. features: fallback always (it is cheap and gives the parity check) ----
    fb_ngram = {n: fallback.ngram_table(grouped, n) for n in (1, 2, 3)}
    fb_lex = OrderedDict((name, fallback.lexicon_table(fb_ngram[1], rws)) for name, rws in lex.items())

    engine, dl, dl_versions, parity = "fallback", None, None, None
    if args.engine != "fallback":
        try:
            python, interface = dlatk_engine.find_interface(args.dlatk_interface)
            engine = "dlatk"
        except dlatk_engine.DlatkNotFound:
            if args.engine == "dlatk":
                raise
            notes.append("DLATK is not installed, so the pure-Python fallback engine was used. The n-gram and lexicon "
                         "definitions are the same; see the README for how to install DLATK.")
            print("murmur_dlatk: DLATK not found, using the pure-Python fallback (see README to install DLATK).", file=sys.stderr)

    if engine == "dlatk":
        dlatk_engine.build_database(os.path.join(work, "murmur.db"), rows, outcomes, group_col)
        dlatk_engine.build_lexicon_database(os.path.join(work, "lexica.db"), lex)
        dl = dlatk_engine.Dlatk(python, interface, work, os.path.join(args.out, "dlatk_raw"), group_col)
        dl_versions = dlatk_engine.versions(python)
        n_tables, combined_name = dl.add_ngrams()
        ngram = {n: dl.read_table(t) for n, t in zip((1, 2, 3), n_tables)}
        lex_tables = OrderedDict((name, dl.add_lexicon(name)) for name in lex)
        lex_feats = OrderedDict((name, dl.read_table(t)) for name, t in lex_tables.items())
        parity = OrderedDict(("%dgram" % n, compare_tables(ngram[n], fb_ngram[n])) for n in (1, 2, 3))
        for name in lex:
            parity["lexicon_" + name] = compare_tables(lex_feats[name], fb_lex[name])
    else:
        ngram, lex_feats = fb_ngram, fb_lex

    words = fallback.word_counts(ngram[1])
    included = [g for g in grouped if words.get(g, 0) >= args.min_words]
    if not included:
        raise Stop("No %s has at least %d words (the largest has %d). Lower --min-words, group by month, or come back "
                   "when there is more text." % (args.group, args.min_words, max(words.values(), default=0)))

    combined = fallback.combine([ngram[n] for n in (1, 2, 3)])
    filtered, threshold = fallback.occurrence_filter(combined, included, args.p_occ)
    filtered_name = None
    if engine == "dlatk":
        filtered_name = dl.occurrence_filter(combined_name, args.p_occ, args.min_words)
        dl_filtered = dl.read_table(filtered_name)
        fb_filtered, _ = fallback.occurrence_filter(fallback.combine([fb_ngram[n] for n in (1, 2, 3)]),
                                                    [g for g in grouped if fallback.word_counts(fb_ngram[1]).get(g, 0) >= args.min_words], args.p_occ)
        parity["1to3gram_filtered"] = compare_tables(dl_filtered, fb_filtered)
        filtered = OrderedDict((g, dl_filtered.get(g, {})) for g in included)

    # ---- 5. correlations with mood and energy ----
    rated = {o: [g for g in included if outcomes.get(g, {}).get(o) is not None] for o in OUTCOMES}
    usable = []
    for o in OUTCOMES:
        distinct = len({outcomes[g][o] for g in rated[o]})
        if len(rated[o]) < args.min_groups:
            skipped_steps["correlations_" + o] = ("%d %ss have both enough text and %s ratings; --min-groups asks for %d"
                                                  % (len(rated[o]), args.group, o, args.min_groups))
        elif distinct < 3:
            skipped_steps["correlations_" + o] = "the mean %s rating takes fewer than 3 different values" % o
        else:
            usable.append(o)
    correlations, families, dlatk_clouds = [], [], []
    if usable:
        tables = [("ngrams_1to3", filtered, filtered_name)] + \
                 [("lexicon_" + name, OrderedDict((g, lex_feats[name].get(g, {})) for g in included),
                   lex_tables[name] if engine == "dlatk" else None) for name in lex]
        fb_all = []
        for label, table, dl_name in tables:
            fb_rows, _ = fallback.correlate(table, outcomes, included, usable)
            for r in fb_rows:
                r["feature_table"] = label
            fb_all.extend(fb_rows)
            if engine == "dlatk":
                got, note = dl.correlate(dl_name, label, usable, args.min_words, wordclouds=(label == "ngrams_1to3"))
                if note:
                    notes.append(note)
                elif label == "ngrams_1to3":
                    wc_dir = os.path.join(args.out, "dlatk_raw", label + "_bh_tagcloud_wordclouds")
                    pngs = sorted(f for f in os.listdir(wc_dir) if f.endswith(".png")) if os.path.isdir(wc_dir) else []
                    if pngs:
                        dlatk_clouds.extend("dlatk_raw/%s_bh_tagcloud_wordclouds/%s" % (label, f) for f in pngs)
                    else:
                        notes.append("DLATK draws word clouds only from n-grams that stay below .05 after correction. None did, so no word cloud was drawn.")
                for r in got:
                    r["feature_table"] = label
            else:
                got = fb_rows
            correlations.extend(got)
            for o in usable:
                sub = [r for r in got if r["outcome"] == o]
                families.append({"feature_table": label, "outcome": o, "tests": len(sub),
                                 "n_periods": len(rated[o]),
                                 "bh_below_05": sum(1 for r in sub if r["p_bh"] < 0.05),
                                 "uncorrected_below_05": sum(1 for r in sub if r["p"] < 0.05)})
        if engine == "dlatk":
            parity["correlations"] = compare_correlations(correlations, fb_all)
    correlations.sort(key=lambda r: (r["feature_table"], r["outcome"], -abs(r["rho"]), r["feature"]))

    # ---- 6. tables ----
    out = args.out
    write_csv(os.path.join(out, "groups.csv"),
              [group_col, "n_messages", "n_words", "included", "mood_mean", "n_mood", "energy_mean", "n_energy"],
              [[g, len(grouped[g]), words.get(g, 0), "yes" if g in included else "no",
                outcomes.get(g, {}).get("mood"), outcomes.get(g, {}).get("n_mood", 0),
                outcomes.get(g, {}).get("energy"), outcomes.get(g, {}).get("n_energy", 0)] for g in grouped])
    write_csv(os.path.join(out, "ngrams_filtered.csv"), ["group_id", "feat", "value", "group_norm"],
              [[g, f, v, gn] for g in included for f, (v, gn) in sorted(filtered[g].items())])
    top_by_n, top_rows = {}, []
    for n in (1, 2, 3):
        tot = Counter()
        for g in included:
            for f, (v, _) in ngram[n].get(g, {}).items():
                tot[f] += v
        total = sum(tot.values()) or 1
        ranked = sorted(tot.items(), key=lambda kv: (-kv[1], kv[0]))
        top_rows += [[n, f, v, v / total] for f, v in ranked[:30]]
        top_by_n[n] = [(f, v / total) for f, v in ranked if all(any(c.isalnum() for c in tok) for tok in f.split())][:15]
    write_csv(os.path.join(out, "top_ngrams.csv"), ["n", "feat", "count", "share_of_all_ngrams"], top_rows)
    write_csv(os.path.join(out, "lexicon_scores.csv"), ["group_id", "lexicon", "category", "value", "group_norm"],
              [[g, name, c, v, gn] for name in lex for g in included for c, (v, gn) in sorted(lex_feats[name].get(g, {}).items())])
    if topic_summary:
        write_csv(os.path.join(out, "topics.csv"), ["topic", "rank", "word", "p_topic_given_word"],
                  [[t, i + 1, w, wt] for t, ws in topic_summary for i, (w, wt) in enumerate(ws)])
    if correlations:
        write_csv(os.path.join(out, "correlations.csv"),
                  ["feature_table", "outcome", "feature", "rho", "p", "p_bh", "n", "ci_low", "ci_high", "freq"],
                  [[r["feature_table"], r["outcome"], r["feature"], r["rho"], r["p"], r["p_bh"], r["n"],
                    r["ci_low"], r["ci_high"], r["freq"]] for r in correlations])
    if parity is not None:
        with open(os.path.join(out, "parity.json"), "w", encoding="utf-8") as f:
            json.dump(parity, f, indent=2)
            f.write("\n")

    # ---- 7. charts ----
    made = []
    label = "SYNTHETIC EXAMPLE DATA. " if parsed["synthetic"] else ""
    note = label + "One person's text, descriptive only. Not a clinical measure."
    if args.no_plots:
        skipped_steps["charts"] = "turned off with --no-plots"
    elif not plots.available():
        skipped_steps["charts"] = "matplotlib is not installed"
    else:
        try:
            pdir = os.path.join(out, "plots")
            os.makedirs(pdir, exist_ok=True)
            if plots.top_ngrams(os.path.join(pdir, "top_ngrams.png"), top_by_n, note):
                made.append("plots/top_ngrams.png")
            series = []
            for name in lex:
                if name == "murmur_topics":
                    continue
                for c in sorted({c for g in included for c in lex_feats[name].get(g, {})}):
                    series.append(("%s: %s" % (name, c), "weighted share of words",
                                   [lex_feats[name].get(g, {}).get(c, (0, 0.0))[1] for g in included]))
            for o in OUTCOMES:
                series.append(("Mean %s rating (1 to 7)" % o, o, [outcomes.get(g, {}).get(o) for g in included]))
            if plots.series_panels(os.path.join(pdir, "lexicon_and_ratings_by_%s.png" % args.group), included, series, note):
                made.append("plots/lexicon_and_ratings_by_%s.png" % args.group)
            for o in usable:
                sub = [dict(r, feature="%s: %s" % (r["feature_table"][len("lexicon_"):], r["feature"]))
                       for r in correlations if r["outcome"] == o and r["feature_table"].startswith("lexicon_")]
                if plots.correlation_dots(os.path.join(pdir, "lexicon_correlations_%s.png" % o), sub,
                                          "Lexicon categories and %s, per %s (n = %d)" % (o, args.group, len(rated[o])),
                                          note + "\nExploratory. The intervals ignore that neighbouring periods resemble each other."):
                    made.append("plots/lexicon_correlations_%s.png" % o)
        except Exception as err:  # a chart problem must not lose the tables
            skipped_steps["charts"] = "a chart could not be drawn (%s)" % err

    # ---- 8. run record and report ----
    with open(args.input, "rb") as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    info = OrderedDict([
        ("pipeline", "murmur_dlatk %s" % __version__),
        ("synthetic_input", parsed["synthetic"]),
        ("engine", engine),
        ("engine_requested", args.engine),
        ("dlatk_versions", dl_versions),
        ("runner_python", sys.version.split()[0]),
        ("topics_scikit_learn", topics.version() if topic_summary else None),
        ("input_sha256", digest),
        ("parameters", OrderedDict([("group", args.group), ("sources", wanted), ("utc_offset", args.utc_offset),
                                    ("min_words", args.min_words), ("min_groups", args.min_groups), ("p_occ", args.p_occ),
                                    ("occurrence_threshold_groups", threshold), ("correlation", "Spearman"),
                                    ("p_correction", "Benjamini-Hochberg, per feature table and outcome"),
                                    ("lexica", list(lex)), ("topics", args.topics), ("include_demo", args.include_demo)])),
        ("counts", OrderedDict([("messages", len(prepared)), ("messages_by_source", OrderedDict(sorted(Counter(m.source for m, _ in prepared).items()))),
                                ("ratings", len(parsed["ratings"])), ("periods", len(grouped)), ("periods_included", len(included)),
                                ("words_in_included_periods", sum(words[g] for g in included)),
                                ("ngram_features_before_filter", len({f for g in included for f in combined.get(g, {})})),
                                ("ngram_features_after_filter", len({f for g in included for f in filtered[g]}))])),
        ("correlation_families", families),
        ("skipped_steps", skipped_steps),
        ("notes", notes),
        ("charts", made + dlatk_clouds),
    ])
    with open(os.path.join(out, "run_info.json"), "w", encoding="utf-8") as f:
        json.dump(info, f, indent=2, ensure_ascii=False)
        f.write("\n")
    write_report(os.path.join(out, "report.md"), info, args, included, top_by_n, lex, lex_feats, correlations, parity, topic_summary)
    print("murmur_dlatk: engine %s, %d messages, %d of %d %ss analyzed. Results in %s (start with report.md)."
          % (engine, len(prepared), len(included), len(grouped), args.group, out))
    return 0


def write_report(path, info, args, included, top_by_n, lex, lex_feats, correlations, parity, topic_summary):
    c, L = info["counts"], []
    add = L.append
    add("# Murmur text analysis report")
    add("")
    if info["synthetic_input"]:
        add("**SYNTHETIC EXAMPLE DATA.** The input was made up for demonstration. Nothing below describes a real person.")
        add("")
    v = info["dlatk_versions"] or {}
    if info["engine"] == "dlatk":
        add("Engine: DLATK %s (Schwartz et al., 2017) on SQLite, Python %s." % (v.get("dlatk"), v.get("python")))
    else:
        add("Engine: pure-Python fallback (DLATK was not used). The feature definitions are the same as DLATK's.")
    add("")
    add("This is a description of one person's own text. It is not a clinical measure, and it cannot show what causes what.")
    add("")
    add("## What went in")
    add("")
    add("- %d messages (%s)" % (c["messages"], ", ".join("%s: %d" % kv for kv in c["messages_by_source"].items())))
    add("- %d mood or energy ratings" % c["ratings"])
    add("- %d %ss with text, of which %d have at least %d words and were analyzed (%d words in total)"
        % (c["periods"], args.group, c["periods_included"], args.min_words, c["words_in_included_periods"]))
    add("- %d distinct 1- to 3-grams, %d left after keeping those that occur in at least %d of the %d %ss"
        % (c["ngram_features_before_filter"], c["ngram_features_after_filter"],
           info["parameters"]["occurrence_threshold_groups"], c["periods_included"], args.group))
    for n in info["notes"]:
        add("- Note: " + n)
    add("")
    add("## Most frequent words and phrases")
    add("")
    add("Share of all n-grams of that length across the analyzed %ss (punctuation left out of this list)." % args.group)
    add("")
    for n in (1, 2, 3):
        add("- %d-grams: %s" % (n, ", ".join("%s (%.1f%%)" % (f, 100 * s) for f, s in top_by_n[n][:10])))
    add("")
    add("## Lexicon scores")
    add("")
    add("Mean over the analyzed %ss of the weighted share of words in each category. Licenses: murmur_dlatk/lexica/LICENSES.md." % args.group)
    add("")
    add("| Lexicon | Category | Mean score | Lowest %s | Highest %s |" % (args.group, args.group))
    add("|---|---|---|---|---|")
    for name in lex:
        for cat in sorted({k for g in included for k in lex_feats[name].get(g, {})}):
            vals = [lex_feats[name].get(g, {}).get(cat, (0, 0.0))[1] for g in included]
            add("| %s | %s | %.4f | %.4f | %.4f |" % (name, cat, sum(vals) / len(vals), min(vals), max(vals)))
    add("")
    if topic_summary:
        add("## Topics (LDA on this text only)")
        add("")
        add("Topics from a small personal collection change a lot from run to run and with the number of topics. Read them as a rough sorting of words, nothing more.")
        add("")
        for t, ws in topic_summary:
            add("- %s: %s" % (t, ", ".join(w for w, _ in ws[:10])))
        add("")
    add("## Language and ratings")
    add("")
    if not info["correlation_families"]:
        add("No correlations were computed:")
        add("")
        for k, why in info["skipped_steps"].items():
            if k.startswith("correlations_"):
                add("- %s: %s." % (k.split("_", 1)[1], why))
        add("")
    else:
        add("Spearman correlations between each feature's score in a %s and that %s's mean rating. p-values are corrected "
            "with the Benjamini-Hochberg procedure within each feature table and outcome." % (args.group, args.group))
        add("")
        add("| Feature table | Outcome | %ss | Tests | Below .05 before correction | Below .05 after correction |" % args.group.capitalize())
        add("|---|---|---|---|---|---|")
        for f in info["correlation_families"]:
            add("| %s | %s | %d | %d | %d | %d |" % (f["feature_table"], f["outcome"], f["n_periods"], f["tests"],
                                                   f["uncorrected_below_05"], f["bh_below_05"]))
        add("")
        total = sum(f["tests"] for f in info["correlation_families"])
        add("That is %d tests in all. With this many, some uncorrected p-values fall below .05 by chance alone, so only the "
            "last column is worth attention, and even those are leads to be curious about." % total)
        add("")
        sig = [r for r in correlations if r["p_bh"] < 0.05]
        if sig:
            add("Features below .05 after correction (at most 20 shown, full list in correlations.csv):")
            add("")
            add("| Feature table | Outcome | Feature | rho | 95% interval | Corrected p | n |")
            add("|---|---|---|---|---|---|---|")
            for r in sorted(sig, key=lambda r: r["p_bh"])[:20]:
                add("| %s | %s | %s | %s | %s to %s | %s | %d |" % (r["feature_table"], r["outcome"], r["feature"], r_str(r["rho"]),
                                                                 r_str(r["ci_low"]), r_str(r["ci_high"]), r_str(r["p_bh"]) if r["p_bh"] >= 0.005 else "< .005", r["n"]))
            add("")
        else:
            add("No feature stayed below .05 after correction.")
            add("")
        add("Things these numbers do not account for: neighbouring %ss resemble each other (a hard month affects several "
            "weeks in a row), which makes the intervals and p-values too optimistic; the ratings and the text were often "
            "written at the same moment; and a word that tracks mood for one person may mean nothing for another." % args.group)
        add("")
    for k, why in info["skipped_steps"].items():
        if not k.startswith("correlations_"):
            add("- Skipped %s: %s." % (k, why))
    if parity:
        add("")
        add("## Agreement between DLATK and the fallback engine")
        add("")
        add("| Table | Rows in both | Only DLATK | Only fallback | Largest difference |")
        add("|---|---|---|---|---|")
        for k, p in parity.items():
            if k == "correlations":
                add("| correlations | %d | %d | %d | rho %.1e, p %.1e, corrected p %.1e |"
                    % (p["rows_in_both"], p["rows_dlatk"] - p["rows_in_both"], p["rows_fallback"] - p["rows_in_both"],
                       p["max_abs_diff_rho"], p["max_abs_diff_p"], p["max_abs_diff_p_bh"]))
            else:
                add("| %s | %d | %d | %d | %.1e |" % (k, p["rows_in_both"], p["rows_only_dlatk"], p["rows_only_fallback"], p["max_abs_diff_group_norm"]))
    while L and not L[-1]:
        L.pop()
    add("")
    add("## Files")
    add("")
    add("groups.csv, top_ngrams.csv, ngrams_filtered.csv, lexicon_scores.csv, correlations.csv (when computed), "
        "run_info.json (settings and versions)" + (", parity.json, dlatk_raw/ (DLATK's own output and the commands that were run)" if parity else "")
        + (", " + ", ".join(info["charts"]) if info["charts"] else "") + ".")
    add("The work/ folder holds the SQLite database with your text. Delete it when you are done.")
    add("")
    add("Reference: Schwartz, H. A., Giorgi, S., Sap, M., Crutchley, P., Ungar, L., & Eichstaedt, J. (2017). "
        "DLATK: Differential Language Analysis ToolKit. EMNLP System Demonstrations.")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")


if __name__ == "__main__":
    sys.exit(main())
