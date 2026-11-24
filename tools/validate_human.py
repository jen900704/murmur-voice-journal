"""Part A of docs/validation-protocol.md: agreement with Praat and with transcripts.

Usage: python3 -I tools/validate_human.py <audio-dir> <out-dir>
<audio-dir> is the folder made by tools/fetch-validation-audio.sh.
"""
import json
import os
import re
import subprocess
import sys

import numpy as np
import parselmouth

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 16000
AUDIO, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
TMP = os.path.join(OUT, "f32")
os.makedirs(TMP, exist_ok=True)

TRANSCRIPTS = {
    "jfk": "And so my fellow Americans ask not what your country can do for you ask what you can do for your country",
    "lj": "unless a system is established for the frequent formal review of activities thereunder In this regard",
    "ldc": "She had your dark suit in greasy wash water all year",
}
SINGLE = ["jfk", "lj", "ldc", "libri_f", "libri_m1", "libri_m2"]
FILES = {"jfk": "jfk.flac", "lj": "lj.wav", "ldc": "ldc.wav", "libri_f": "libri_f.ogg",
         "libri_m1": "libri_m1.ogg", "libri_m2": "libri_m2.ogg", "conv": "conv.wav"}
FSDD_SPEAKERS = ["george", "jackson", "lucas", "nicolas", "theo", "yweweler"]
DIGIT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]


def decode(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def build_fsdd(speaker, s):
    parts = []
    gap = np.zeros(int(0.4 * SR), dtype=np.float32)
    for d in range(10):
        for i in range(4 * s, 4 * s + 4):
            x = decode(os.path.join(AUDIO, "fsdd", "recordings", f"{d}_{speaker}_{i}.wav"))
            if parts:
                parts.append(gap)
            parts.append(x)
    return np.concatenate(parts)


def syllables_cmudict(text):
    import cmudict
    d = cmudict.dict()
    total, missing = 0, []
    for w in re.findall(r"[a-zA-Z']+", text.lower()):
        if w in d:
            total += sum(1 for ph in d[w][0] if ph[-1].isdigit())
        else:
            missing.append(w)
    return total, missing


def praat(x):
    snd = parselmouth.Sound(x.astype(np.float64), sampling_frequency=SR)
    p = snd.to_pitch_ac(time_step=0.01, pitch_floor=70, pitch_ceiling=500)
    f = p.selected_array["frequency"]
    t = p.xs()
    h = snd.to_harmonicity_cc(time_step=0.01, minimum_pitch=70).values[0]
    h = h[h > -199]
    return t, f, float(np.mean(h)) if len(h) else float("nan")


def murmur(paths, frames=True):
    cmd = ["node", os.path.join(HERE, "murmur-analyze.mjs")] + (["--frames"] if frames else []) + paths
    out = subprocess.run(cmd, check=True, capture_output=True, text=True).stdout
    return [json.loads(line) for line in out.splitlines()]


def st(hz):
    return 12 * np.log2(hz)


def compare(x, m):
    """Frame-level comparison inside Murmur's speech span."""
    t_p, f_p, hnr = praat(x)
    fr = m["frames"]
    rows = []
    for f in range(fr["firstSpeech"], fr["lastSpeech"] + 1):
        tc = f * fr["hopS"] + 0.010
        j = int(np.argmin(np.abs(t_p - tc)))
        if abs(t_p[j] - tc) > 0.005:
            continue
        mv = fr["f0"][f]
        pv = f_p[j] if f_p[j] > 0 else None
        rows.append((mv, pv))
    both = [(a, b) for a, b in rows if a and b]
    gross = [abs(a - b) / b > 0.2 for a, b in both]
    cents = [abs(1200 * np.log2(a / b)) for (a, b), g in zip(both, gross) if not g]
    m_only = sum(1 for a, b in rows if a and not b)
    p_only = sum(1 for a, b in rows if b and not a)
    pv_all = np.array([b for a, b in rows if b])
    return {
        "frames": len(rows),
        "bothVoiced": len(both),
        "grossErrors": int(sum(gross)),
        "fineCents": cents,
        "murmurOnly": m_only,
        "praatOnly": p_only,
        "praat": {
            "f0MedianHz": float(np.median(pv_all)) if len(pv_all) else None,
            "f0SdSt": float(np.std(st(pv_all), ddof=1)) if len(pv_all) > 1 else None,
            "f0RangeSt": float(np.percentile(st(pv_all), 95) - np.percentile(st(pv_all), 5)) if len(pv_all) else None,
            "hnrDb": hnr,
        },
    }


clips = {}
for cid in SINGLE + ["conv"]:
    clips[cid] = decode(os.path.join(AUDIO, FILES[cid]))
for spk in FSDD_SPEAKERS:
    for s in range(5):
        clips[f"fsdd_{spk}_{s}"] = build_fsdd(spk, s)

paths = {}
for cid, x in clips.items():
    p = os.path.join(TMP, cid + ".f32")
    x.astype(np.float32).tofile(p)
    paths[cid] = p
ids = list(clips)
results = dict(zip(ids, murmur([paths[c] for c in ids])))

report = {"clips": {}, "pooled": {}, "notes": []}
pooled = {"bothVoiced": 0, "grossErrors": 0, "fineCents": [], "frames": 0, "murmurOnly": 0, "praatOnly": 0}
for cid in ids:
    m = results[cid]
    entry = {"durationS": round(len(clips[cid]) / SR, 2), "ok": m["ok"], "reason": m.get("reason")}
    if not m["ok"]:
        report["clips"][cid] = entry
        continue
    c = compare(clips[cid], m)
    pr = c["praat"]
    entry.update({
        "gpe": c["grossErrors"] / max(c["bothVoiced"], 1),
        "fineCentsMedian": float(np.median(c["fineCents"])) if c["fineCents"] else None,
        "voicingDisagreement": (c["murmurOnly"] + c["praatOnly"]) / max(c["frames"], 1),
        "murmurOnlyVoiced": c["murmurOnly"] / max(c["frames"], 1),
        "praatOnlyVoiced": c["praatOnly"] / max(c["frames"], 1),
        "murmur": {k: m[k] for k in ["f0MedianHz", "f0SdSt", "f0RangeSt", "periodicityDb", "syllables", "pauseCount", "speechRate", "articulationRate", "voicedFraction"]},
        "praat": pr,
        "medianDiffSt": float(st(m["f0MedianHz"]) - st(pr["f0MedianHz"])) if pr["f0MedianHz"] else None,
        "sdDiffSt": float(m["f0SdSt"] - pr["f0SdSt"]) if pr["f0SdSt"] is not None else None,
        "rangeDiffSt": float(m["f0RangeSt"] - pr["f0RangeSt"]) if pr["f0RangeSt"] is not None else None,
        "quality": m["quality"],
    })
    if cid in TRANSCRIPTS:
        n, missing = syllables_cmudict(TRANSCRIPTS[cid])
        entry["syllablesTrue"] = n
        entry["syllablesMissingWords"] = missing
        entry["syllableRelErr"] = (m["syllables"] - n) / n
    if cid.startswith("fsdd_"):
        n = sum(syllables_cmudict(w)[0] for d in range(10) for w in [DIGIT_WORDS[d]] * 4)
        entry["syllablesTrue"] = n
        entry["syllableRelErr"] = (m["syllables"] - n) / n
        entry["pausesTrue"] = 39
        entry["pauseRelErr"] = (m["pauseCount"] - 39) / 39
    report["clips"][cid] = entry
    if cid != "conv":
        for k in ["bothVoiced", "grossErrors", "frames", "murmurOnly", "praatOnly"]:
            pooled[k] += c[k]
        pooled["fineCents"] += c["fineCents"]

report["pooled"] = {
    "frames": pooled["frames"],
    "bothVoiced": pooled["bothVoiced"],
    "gpe": pooled["grossErrors"] / pooled["bothVoiced"],
    "fineCentsMedian": float(np.median(pooled["fineCents"])),
    "voicingDisagreement": (pooled["murmurOnly"] + pooled["praatOnly"]) / pooled["frames"],
    "murmurOnlyVoiced": pooled["murmurOnly"] / pooled["frames"],
    "praatOnlyVoiced": pooled["praatOnly"] / pooled["frames"],
}

# Spearman: periodicity vs Praat HNR across single-speaker clips
from scipy.stats import spearmanr
pairs = [(e["murmur"]["periodicityDb"], e["praat"]["hnrDb"]) for c, e in report["clips"].items() if e.get("ok") and c != "conv" and "murmur" in e]
rho = spearmanr([a for a, b in pairs], [b for a, b in pairs]).statistic
report["periodicityVsPraatHnr"] = {"spearman": float(rho), "n": len(pairs)}

with open(os.path.join(OUT, "validation-human.json"), "w") as fh:
    json.dump(report, fh, indent=1)
print(json.dumps(report["pooled"], indent=1))
print("periodicity vs HNR", report["periodicityVsPraatHnr"])
for cid, e in report["clips"].items():
    if not e.get("ok"):
        print(cid, "NOT OK", e.get("reason"))
        continue
    print(f"{cid:20s} gpe={e['gpe']:.3f} fine={e['fineCentsMedian']:.1f} vde={e['voicingDisagreement']:.3f} "
          f"med={e['medianDiffSt']:+.2f} sd={e['sdDiffSt']:+.2f} rng={e['rangeDiffSt']:+.2f} "
          f"syl={e['murmur']['syllables']}/{e.get('syllablesTrue','-')} pau={e['murmur']['pauseCount']}/{e.get('pausesTrue','-')} "
          f"f0={e['murmur']['f0MedianHz']}/{e['praat']['f0MedianHz']:.1f} q={e['quality']['flags']}")
