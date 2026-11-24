#!/usr/bin/env bash
# Fetches the human-speech recordings used in docs/validation-protocol.md, from pinned
# commits, into a directory outside the repository (default: ./validation-audio).
# The audio is not redistributed here; see each source for its license.
set -euo pipefail
OUT="${1:-validation-audio}"
mkdir -p "$OUT"
cd "$OUT"
raw() { curl -fsSL -o "$2" "https://raw.githubusercontent.com/$1"; }

raw openai/whisper/86098128c0b4f24f0e2aa2994de830614b474227/tests/jfk.flac jfk.flac
raw speechbrain/speechbrain/c0241278f93ef02cd5191f03caf4e5f8e1292bf6/tests/samples/TTS/LJ050-0131.wav lj.wav
raw mozilla/DeepSpeech/6913ae817bc09159c64def7f130708682c197ba3/data/smoke_test/LDC93S1.wav ldc.wav
raw librosa/data/5285c94e33c74bbe97501f5c9fa95e5e2ce55d48/audio/198-209-0000.ogg libri_f.ogg
raw librosa/data/5285c94e33c74bbe97501f5c9fa95e5e2ce55d48/audio/3436-172162-0000.ogg libri_m1.ogg
raw librosa/data/5285c94e33c74bbe97501f5c9fa95e5e2ce55d48/audio/5703-47212-0000.ogg libri_m2.ogg
raw pyannote/pyannote-audio/c2b12c5aa5f4c7e52c180a421072be8acc9c94a3/tutorials/assets/sample.wav conv.wav

if [ ! -d fsdd ]; then
  git clone -q https://github.com/Jakobovski/free-spoken-digit-dataset fsdd
  git -C fsdd checkout -q 26eb9aaf76e81b692f806f9140c2d2777410d7a1
fi
echo "Fetched into $(pwd)"
