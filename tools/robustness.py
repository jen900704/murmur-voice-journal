"""Part B of docs/validation-protocol.md: robustness to recording conditions.

Usage: python3 -I tools/robustness.py <audio-dir> <out-dir>
Needs the decoded clips written by tools/validate_human.py into <out-dir>/f32.
"""
import json
import os
import subprocess
import sys

import numpy as np
from scipy.signal import butter, sosfiltfilt, fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 16000
AUDIO, OUT = sys.argv[1], sys.argv[2]
F32 = os.path.join(OUT, "f32")
WORK = os.path.join(OUT, "robust")
os.makedirs(WORK, exist_ok=True)

FEATURES = ["f0MedianHz", "f0SdSt", "f0RangeSt", "speechRate", "articulationRate", "pauseRatio", "meanPauseS", "intensitySdDb", "periodicityDb"]
SPEAKERS = ["george", "jackson", "lucas", "nicolas", "theo", "yweweler"]
CLIPS = ["jfk", "lj", "libri_f", "libri_m1", "libri_m2"] + [f"fsdd_{s}_0" for s in SPEAKERS]
K_FLAG = 3.02  # the app's cut-off at 10 earlier recordings
rng = np.random.default_rng(20261124)


def load(cid):
    return np.fromfile(os.path.join(F32, cid + ".f32"), dtype=np.float32).astype(np.float64)


def save(x, name):
    p = os.path.join(WORK, name + ".f32")
    x.astype(np.float32).tofile(p)
    return p


def analyze(paths):
    out = subprocess.run(["node", os.path.join(HERE, "murmur-analyze.mjs")] + paths, check=True, capture_output=True, text=True).stdout
    return [json.loads(l) for l in out.splitlines()]


def ffmpeg_roundtrip(x, codec_args, ext):
    src = os.path.join(WORK, "tmp_in.wav")
    enc = os.path.join(WORK, "tmp_enc." + ext)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", src], input=x.astype(np.float32).tobytes(), check=True)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src] + codec_args + [enc], check=True)
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", enc, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], check=True, capture_output=True).stdout
    y = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return y[: len(x)] if len(y) >= len(x) else np.pad(y, (0, len(x) - len(y)))


def ffmpeg_filter(x, af):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", af, "-f", "f32le", "-"],
                         input=x.astype(np.float32).tobytes(), check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)[: len(x)]


def add_noise(x, snr_db, kind):
    p_sig = np.mean(x ** 2)
    if kind == "white":
        n = rng.standard_normal(len(x))
    else:  # speech-shaped: random phase with the clip's long-term magnitude spectrum
        mag = np.abs(np.fft.rfft(x))
        mag = np.convolve(mag, np.ones(201) / 201, mode="same")
        phase = np.exp(1j * rng.uniform(0, 2 * np.pi, len(mag)))
        n = np.fft.irfft(mag * phase, n=len(x))
    n *= np.sqrt(p_sig / (np.mean(n ** 2) * 10 ** (snr_db / 10)))
    return x + n


def reverb(x, rt60):
    n = int(rt60 * 1.2 * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-6.9078 * t / rt60)
    ir[0] = 1.0
    ir *= 1 / np.sqrt(np.sum(ir ** 2))
    y = fftconvolve(x, ir)[: len(x)]
    return y * (np.sqrt(np.mean(x ** 2)) / np.sqrt(np.mean(y ** 2)))


def band(x):
    sos = butter(4, [300, 3400], btype="bandpass", fs=SR, output="sos")
    return sosfiltfilt(sos, x)


def gain(x, db):
    return np.clip(x * 10 ** (db / 20), -1, 1)


CONDITIONS = {
    "opus_24k": lambda x: ffmpeg_roundtrip(x, ["-c:a", "libopus", "-b:a", "24k"], "ogg"),
    "opus_64k": lambda x: ffmpeg_roundtrip(x, ["-c:a", "libopus", "-b:a", "64k"], "ogg"),
    "opus_128k": lambda x: ffmpeg_roundtrip(x, ["-c:a", "libopus", "-b:a", "128k"], "ogg"),
    "aac_64k": lambda x: ffmpeg_roundtrip(x, ["-c:a", "aac", "-b:a", "64k"], "m4a"),
    "aac_128k": lambda x: ffmpeg_roundtrip(x, ["-c:a", "aac", "-b:a", "128k"], "m4a"),
    "gain_-12dB": lambda x: gain(x, -12),
    "gain_-6dB": lambda x: gain(x, -6),
    "gain_+6dB": lambda x: gain(x, 6),
    "gain_+12dB": lambda x: gain(x, 12),
    "agc_dynaudnorm": lambda x: ffmpeg_filter(x, "dynaudnorm"),
    "white_30dB": lambda x: add_noise(x, 30, "white"),
    "white_20dB": lambda x: add_noise(x, 20, "white"),
    "white_15dB": lambda x: add_noise(x, 15, "white"),
    "white_10dB": lambda x: add_noise(x, 10, "white"),
    "speechnoise_30dB": lambda x: add_noise(x, 30, "speech"),
    "speechnoise_20dB": lambda x: add_noise(x, 20, "speech"),
    "speechnoise_15dB": lambda x: add_noise(x, 15, "speech"),
    "speechnoise_10dB": lambda x: add_noise(x, 10, "speech"),
    "reverb_0.3s": lambda x: reverb(x, 0.3),
    "reverb_0.6s": lambda x: reverb(x, 0.6),
    "telephone_band": band,
}
COMMON = ["opus_64k", "opus_128k", "aac_64k", "aac_128k", "gain_-6dB", "gain_+6dB", "agc_dynaudnorm", "white_20dB", "speechnoise_20dB"]

# reference spread from the 5 sequences of each digit speaker
ref_paths = [os.path.join(F32, f"fsdd_{s}_{i}.f32") for s in SPEAKERS for i in range(5)]
ref = analyze(ref_paths)
spread = {}
for f in FEATURES:
    per = []
    for si, s in enumerate(SPEAKERS):
        v = np.array([ref[si * 5 + i][f] for i in range(5) if ref[si * 5 + i]["ok"] and ref[si * 5 + i][f] is not None], dtype=float)
        if len(v) >= 3:
            per.append(1.4826 * np.median(np.abs(v - np.median(v))))
    spread[f] = float(np.median(per))

# clean and perturbed versions
jobs = []
for cid in CLIPS:
    x = load(cid)
    jobs.append((cid, "clean", save(x, f"{cid}__clean")))
    for cname, fn in CONDITIONS.items():
        jobs.append((cid, cname, save(fn(x), f"{cid}__{cname}")))
res = analyze([p for _, _, p in jobs])
table = {}
for (cid, cname, _), r in zip(jobs, res):
    table.setdefault(cid, {})[cname] = r

summary = {"referenceSpread": spread, "conditions": {}, "notes": {}}
for cname in CONDITIONS:
    entry = {"failed": 0, "flaggedNoisy": 0, "flaggedClipping": 0, "features": {}}
    snr_est = []
    for f in FEATURES:
        shifts = []
        for cid in CLIPS:
            c, p = table[cid]["clean"], table[cid][cname]
            if not (c["ok"] and p["ok"]) or c[f] is None or p[f] is None:
                continue
            shifts.append(p[f] - c[f])
        shifts = np.array(shifts)
        if len(shifts) == 0:
            continue
        ratio = float(np.median(np.abs(shifts)) / spread[f]) if spread[f] > 0 else float("nan")
        entry["features"][f] = {
            "n": int(len(shifts)),
            "medianShift": float(np.median(shifts)),
            "medianAbsShift": float(np.median(np.abs(shifts))),
            "ratio": ratio,
            "band": "robust" if ratio < 0.25 else "caution" if ratio <= 0.5 else "sensitive",
            "tripRate": float(np.mean(np.abs(shifts) / spread[f] > K_FLAG)) if spread[f] > 0 else None,
        }
    for cid in CLIPS:
        p = table[cid][cname]
        if not p["ok"]:
            entry["failed"] += 1
            continue
        flags = p["quality"]["flags"]
        entry["flaggedNoisy"] += "noisy" in flags
        entry["flaggedClipping"] += "clipping" in flags
        snr_est.append(p["quality"]["snrDb"])
    if snr_est:
        entry["snrEstimateMedian"] = float(np.median(snr_est))
    summary["conditions"][cname] = entry

# split-half reliability on the LibriSpeech clips
halves = []
for cid in ["libri_f", "libri_m1", "libri_m2"]:
    x = load(cid)
    m = len(x) // 2
    halves.append((cid, save(x[:m], f"{cid}__h1"), save(x[m:], f"{cid}__h2")))
hr = analyze([p for _, a, b in halves for p in (a, b)])
split = {}
for f in FEATURES:
    diffs = []
    for i in range(len(halves)):
        a, b = hr[2 * i], hr[2 * i + 1]
        if a["ok"] and b["ok"] and a[f] is not None and b[f] is not None:
            diffs.append(abs(a[f] - b[f]) / spread[f] if spread[f] > 0 else float("nan"))
    split[f] = {"ratios": diffs, "median": float(np.median(diffs)) if diffs else None}
summary["splitHalf"] = split
summary["clean"] = {cid: {f: table[cid]["clean"].get(f) for f in FEATURES} for cid in CLIPS}

with open(os.path.join(OUT, "robustness.json"), "w") as fh:
    json.dump(summary, fh, indent=1)

print("reference spread:", {k: round(v, 3) for k, v in spread.items()})
print(f"{'condition':18s}" + "".join(f"{f[:9]:>10s}" for f in FEATURES) + "  fail noisy clip snrEst")
for cname, e in summary["conditions"].items():
    cells = "".join(f"{e['features'][f]['ratio']:>10.2f}" if f in e["features"] else f"{'-':>10s}" for f in FEATURES)
    print(f"{cname:18s}{cells}  {e['failed']:>4d} {e['flaggedNoisy']:>5d} {e['flaggedClipping']:>4d} {e.get('snrEstimateMedian', float('nan')):6.1f}")
print("split-half median ratio:", {k: (round(v['median'], 2) if v['median'] is not None else None) for k, v in split.items()})
print("common-condition bands:")
for f in FEATURES:
    bands = [summary["conditions"][c]["features"].get(f, {}).get("band", "-") for c in COMMON]
    print(f"  {f:18s}", " ".join(f"{b[:4]}" for b in bands))
