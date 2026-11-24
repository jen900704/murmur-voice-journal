#!/usr/bin/env python3
"""Regenerates data/lexica/*.json from the source packages.

    pip install vaderSentiment==3.3.2 empath==0.89
    python3 tools/build-lexica.py

Sources and licenses
  vaderSentiment 3.3.2  MIT (c) 2016 C.J. Hutto        vader_lexicon.txt, emoji_utf8_lexicon.txt
  (optional, not bundled) empath 0.89, MIT terms (c) 2016 Ethan Fast, data/categories.tsv,
                        only with --with-empath; see docs/language-analysis/LICENSES.md

The output is deterministic: no dates, sorted keys. Each file records the package version and
the SHA-256 of the source file it was made from. Also writes tests/fixtures/vader-expected.json
(scores from the Python reference implementation) so the JavaScript port can be checked.
"""
import hashlib
import importlib.metadata as md
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'lexica')


def sha(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def write(name, obj):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
        f.write('\n')
    print('wrote', os.path.relpath(path, ROOT), os.path.getsize(path), 'bytes')


def build_vader():
    import vaderSentiment
    from vaderSentiment import vaderSentiment as vs
    base = os.path.dirname(vaderSentiment.__file__)
    lex_path = os.path.join(base, 'vader_lexicon.txt')
    emo_path = os.path.join(base, 'emoji_utf8_lexicon.txt')
    lexicon = {}
    with open(lex_path, encoding='utf-8') as f:
        for line in f.read().rstrip('\n').split('\n'):
            if not line:
                continue
            word, measure = line.strip().split('\t')[0:2]
            lexicon[word] = float(measure)
    emoji = {}
    with open(emo_path, encoding='utf-8') as f:
        for line in f.read().rstrip('\n').split('\n'):
            e, desc = line.strip().split('\t')[0:2]
            emoji[e] = desc
    write('vader.json', {
        'name': 'VADER sentiment lexicon',
        'version': md.version('vaderSentiment'),
        'license': 'MIT',
        'copyright': 'Copyright (c) 2016 C.J. Hutto',
        'attribution': 'Hutto, C.J. & Gilbert, E.E. (2014). VADER: A Parsimonious Rule-based Model for Sentiment Analysis of Social Media Text. ICWSM-14.',
        'source': 'https://github.com/cjhutto/vaderSentiment',
        'sourceFiles': {'vader_lexicon.txt': sha(lex_path), 'emoji_utf8_lexicon.txt': sha(emo_path)},
        'note': 'Mean valence per entry (the per-rater columns of the source file are left out). Rule constants are in js/langlab/vader.js.',
        'constants': {
            'B_INCR': vs.B_INCR, 'B_DECR': vs.B_DECR, 'C_INCR': vs.C_INCR, 'N_SCALAR': vs.N_SCALAR,
            'NEGATE': vs.NEGATE, 'BOOSTER_DICT': vs.BOOSTER_DICT, 'SPECIAL_CASES': vs.SPECIAL_CASES,
        },
        'lexicon': lexicon,
        'emoji': emoji,
    })
    # reference scores for the port
    analyzer = vs.SentimentIntensityAnalyzer()
    sentences = [
        'VADER is smart, handsome, and funny.',
        'VADER is smart, handsome, and funny!',
        'VADER is very smart, handsome, and funny.',
        'VADER is VERY SMART, handsome, and FUNNY.',
        'VADER is VERY SMART, handsome, and FUNNY!!!',
        'VADER is VERY SMART, uber handsome, and FRIGGIN FUNNY!!!',
        'VADER is not smart, handsome, nor funny.',
        'The book was good.',
        "At least it isn't a horrible book.",
        'The book was only kind of good.',
        'The plot was good, but the characters are uncompelling and the dialog is not great.',
        'Today SUX!',
        "Today only kinda sux! But I'll get by, lol",
        'Make sure you :) or :D today!',
        'Not bad at all',
        'I am so happy today, the walk was lovely.',
        'I never thought this would be so hard.',
        'No good news yet, nor any bad news.',
        'It was the least helpful meeting ever.',
        'Without a doubt, a great day.',
        'Why would they do that???',
        'The food was to die for.',
        'I do not hate it.',
        'nothing here',
        'A quiet day 😁 after all',
        "I can't say I am sad, but I am tired and a little worried.",
    ]
    exp = [{'text': s, **analyzer.polarity_scores(s)} for s in sentences]
    fx = os.path.join(ROOT, 'tests', 'fixtures', 'vader-expected.json')
    with open(fx, 'w', encoding='utf-8') as f:
        json.dump({'version': md.version('vaderSentiment'), 'cases': exp}, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('wrote', os.path.relpath(fx, ROOT))


def build_empath():
    import empath
    base = os.path.dirname(empath.__file__)
    path = os.path.join(base, 'data', 'categories.tsv')
    cats = {}
    dropped = 0
    with open(path, encoding='utf-8') as f:
        for line in f:
            cols = line.strip().split('\t')
            if len(cols) < 2:
                continue
            words = set()
            for t in cols[1:]:
                t = t.strip().lower()
                # single lowercase words only: the engine matches one token at a time
                if re.fullmatch(r"[a-z][a-z']*", t):
                    words.add(t)
                else:
                    dropped += 1
            cats[cols[0]] = sorted(words)
    write('empath.json', {
        'name': 'Empath built-in categories',
        'version': md.version('empath'),
        'license': 'MIT',
        'copyright': 'Copyright (c) 2016 Ethan Fast',
        'attribution': 'Fast, E., Chen, B., & Bernstein, M.S. (2016). Empath: Understanding Topic Signals in Large-Scale Text. CHI 2016.',
        'source': 'https://github.com/Ejhfast/empath-client',
        'sourceFiles': {'data/categories.tsv': sha(path)},
        'note': f'Terms that are not a single lowercase word (for example terms joined with an underscore) are left out: {dropped} terms.',
        'categories': cats,
    })


if __name__ == '__main__':
    build_vader()
    # Empath is not bundled: docs/language-analysis/LICENSES.md asks for VADER only.
    # The reader is kept for a later decision: pass --with-empath to write data/lexica/empath.json.
    if '--with-empath' in sys.argv:
        build_empath()
