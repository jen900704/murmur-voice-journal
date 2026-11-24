#!/usr/bin/env bash
# Compares Murmur's features with Praat on synthesized speech.
# Needs: espeak-ng, ffmpeg, node, python3 with praat-parselmouth and numpy.
set -euo pipefail
DIR="$(mktemp -d)"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
EN="Today I walked to the lab in the morning. The air was cold, and the sky was very clear. I think I want to call my family tonight."
ZH="jin1 tian1 zao3 shang4 wo3 zou3 lu4 qu4 shi2 yan4 shi4. kong1 qi4 hen3 leng3, tian1 kong1 hen3 qing1 chu3. wo3 xiang3 jin1 tian1 wan3 shang4 da3 dian4 hua4 gei3 jia1 ren2."
espeak-ng -v en-us -s 130 -p 40 -w "$DIR/en_130wpm.wav" "$EN"
espeak-ng -v en-us -s 160 -p 70 -w "$DIR/en_160wpm_high.wav" "$EN"
espeak-ng -v en-us -s 200 -p 40 -w "$DIR/en_200wpm.wav" "$EN"
espeak-ng -v cmn-latn-pinyin -s 130 -w "$DIR/zh_130.wav" "$ZH"
espeak-ng -v cmn-latn-pinyin -s 190 -w "$DIR/zh_190.wav" "$ZH"
for f in "$DIR"/*.wav; do
  ffmpeg -loglevel error -y -i "$f" -ac 1 -ar 16000 -f f32le "${f%.wav}.f32"
  ffmpeg -loglevel error -y -i "$f" -ac 1 -ar 16000 "${f%.wav}.16k.wav"
done
node "$HERE/tests/validate_synth.mjs" "$DIR"/*.f32 > "$DIR/murmur.jsonl"
python3 - "$DIR" <<'PY'
import sys, json, glob, os
import numpy as np, parselmouth
d = sys.argv[1]
truth = {'en': 34, 'zh': 32}
rows = [json.loads(l) for l in open(os.path.join(d, 'murmur.jsonl'))]
print(f"{'file':<18}{'F0 Murmur':>10}{'F0 Praat':>10}{'syll':>6}{'true':>6}{'pauses':>8}")
for r in rows:
    name = os.path.basename(r['file'])[:-4]
    s = parselmouth.Sound(os.path.join(d, name + '.16k.wav'))
    p = s.to_pitch(time_step=0.01, pitch_floor=70, pitch_ceiling=500).selected_array['frequency']
    p = p[p > 0]
    print(f"{name:<18}{r['f0MedianHz']:>10.1f}{np.median(p):>10.1f}{r['syllables']:>6}{truth[name[:2]]:>6}{r['pauseCount']:>8}")
PY
