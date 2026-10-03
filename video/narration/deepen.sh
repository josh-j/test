#!/bin/bash
# Lower the narrator's pitch without changing speed or timing.
# Chosen setting: 2 semitones down, formants preserved (natural tone).
#
# Usage (from video/): narration/deepen.sh [scene numbers...]   # default: every scene-XX.wav present
# Writes scene-XX.voice.wav next to each source; timing files stay valid (duration is unchanged).
set -euo pipefail
cd "$(dirname "$0")"

SEMITONES="${SEMITONES:-2}"
FORMANT="${FORMANT:-preserved}"
ratio=$(python3 -c "print(2 ** (-${SEMITONES} / 12))")

if [ "$#" -gt 0 ]; then
  files=$(for n in "$@"; do printf 'scene-%02d.wav\n' "$n"; done)
else
  files=$(ls scene-[0-9][0-9].wav)
fi

for f in $files; do
  out="${f%.wav}.voice.wav"
  ffmpeg -y -loglevel error -i "$f" -af "rubberband=pitch=${ratio}:formant=${FORMANT}:pitchq=quality" "$out"
  echo "$f -> $out ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out")s)"
done
