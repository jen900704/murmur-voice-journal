"""Exploratory pilot (not preregistered): Murmur's pitch tracker against Praat on recorded
Mandarin speech, where lexical tones make F0 move fast. Two clips, two speakers.

Usage: python3 -I tools/validate_mandarin.py <audio-dir> <out-json>
<audio-dir> holds zh_cosyvoice.wav and zh_f5.wav (see docs/mandarin-pilot.md for sources
and checksums). Same frame comparison as tools/validate_human.py.
"""
import hashlib
import json
import os
import subprocess
import sys

import numpy as np
import parselmouth

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 16000
AUDIO, OUT = sys.argv[1], sys.argv[2]
CLIPS = {"zh_cosyvoice": "zh_cosyvoice.wav", "zh_f5": "zh_f5.wav"}


def decode(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def praat(x):
    snd = parselmouth.Sound(x.astype(np.float64), sampling_frequency=SR)
    p = snd.to_pitch_ac(time_step=0.01, pitch_floor=70, pitch_ceiling=500)
    return p.xs(), p.selected_array["frequency"]


def murmur(paths):
    out = subprocess.run(["node", os.path.join(HERE, "murmur-analyze.mjs"), "--frames"] + paths, check=True, capture_output=True, text=True).stdout
    return [json.loads(line) for line in out.splitlines()]


def st(hz):
    return 12 * np.log2(hz)


tmp = os.path.join(os.path.dirname(os.path.abspath(OUT)) or ".", "zh-f32")
os.makedirs(tmp, exist_ok=True)
xs, paths, sums = {}, [], {}
for cid, f in CLIPS.items():
    src = os.path.join(AUDIO, f)
    sums[cid] = hashlib.sha256(open(src, "rb").read()).hexdigest()
    x = decode(src)
    xs[cid] = x
    p = os.path.join(tmp, cid + ".f32")
    x.astype(np.float32).tofile(p)
    paths.append(p)

report = {"note": "exploratory pilot, not preregistered; two Mandarin clips", "clips": {}}
pool = {"both": 0, "gross": 0, "cents": []}
for cid, m in zip(CLIPS, murmur(paths)):
    t_p, f_p = praat(xs[cid])
    fr = m["frames"]
    both = []
    for f in range(fr["firstSpeech"], fr["lastSpeech"] + 1):
        tc = f * fr["hopS"] + 0.010
        j = int(np.argmin(np.abs(t_p - tc)))
        if abs(t_p[j] - tc) > 0.005:
            continue
        a, b = fr["f0"][f], f_p[j]
        if a and b > 0:
            both.append((a, b))
    gross = [abs(a - b) / b > 0.2 for a, b in both]
    cents = [abs(1200 * np.log2(a / b)) for (a, b), g in zip(both, gross) if not g]
    pv = np.array([b for a, b in both])
    report["clips"][cid] = {
        "sha256": sums[cid],
        "durationS": round(len(xs[cid]) / SR, 2),
        "bothVoiced": len(both),
        "grossErrorRate": round(sum(gross) / len(both), 4) if both else None,
        "medianFineCents": round(float(np.median(cents)), 1) if cents else None,
        "murmur": {k: m.get(k) for k in ("f0MedianHz", "f0SdSt", "f0RangeSt")},
        "praat": {"f0MedianHz": round(float(np.median(pv)), 1), "f0SdSt": round(float(np.std(st(pv), ddof=1)), 2), "f0RangeSt": round(float(np.percentile(st(pv), 95) - np.percentile(st(pv), 5)), 2)},
    }
    pool["both"] += len(both)
    pool["gross"] += sum(gross)
    pool["cents"] += cents
report["pooled"] = {"bothVoiced": pool["both"], "grossErrorRate": round(pool["gross"] / pool["both"], 4), "medianFineCents": round(float(np.median(pool["cents"])), 1)}
json.dump(report, open(OUT, "w"), indent=2, ensure_ascii=False)
print(json.dumps(report, indent=2, ensure_ascii=False))
