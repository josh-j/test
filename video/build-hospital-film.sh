#!/bin/bash
# Build "The Hospital That Must Change Shape": narration tracks, per-scene renders, final film.
#
# Usage (from video/):
#   ./build-hospital-film.sh            # render every scene (3 in parallel) and join them
#   ./build-hospital-film.sh 2 5        # re-render only scenes 2 and 5, then rejoin
#
# Needs narration/scene-XX.voice.wav (narration/generate-openai.mjs + narration/deepen.sh).
set -euo pipefail
cd "$(dirname "$0")"

# scene number | html file | seconds before the voice starts | scene duration (must match window.VIDEO.duration)
SCENES=(
  "1|scenes/hospital-01-habitat.html|5.0|31"
  "2|scenes/hospital-02-one-price.html|1.0|43.5"
  "3|scenes/hospital-03-case-for-change.html|1.0|32.5"
  "4|scenes/hospital-04-weight.html|1.0|52.5"
  "5|scenes/hospital-05-empty-bed.html|1.0|47.5"
  "6|scenes/hospital-06-changing-shape.html|1.0|44"
  "7|scenes/hospital-07-beyond-the-door.html|1.0|35.5"
  "8|scenes/hospital-08-what-will-tell-us.html|1.0|46.5"
  "9|scenes/hospital-09-end-card.html|-|12"
)
mkdir -p out/hospital narration/tracks
node narration/build-timings.mjs

# Narration track per scene: voice delayed to its start, padded to the scene length, 48 kHz stereo.
track() {
  local n=$1 at=$2 dur=$3 id
  id=$(printf '%02d' "$n")
  if [ "$at" = "-" ]; then
    ffmpeg -y -loglevel error -f lavfi -i "anullsrc=r=48000:cl=stereo" -t "$dur" "narration/tracks/scene-$id.wav"
  else
    local ms; ms=$(python3 -c "print(int($at*1000))")
    ffmpeg -y -loglevel error -i "narration/scene-$id.voice.wav" \
      -af "adelay=${ms}:all=1,apad,aresample=48000" -ac 2 -t "$dur" "narration/tracks/scene-$id.wav"
  fi
}

render_one() {
  IFS='|' read -r n file at dur <<<"$1"
  local id; id=$(printf '%02d' "$n")
  track "$n" "$at" "$dur"
  node render.mjs "$file" --out "out/hospital/scene-$id.mp4" --audio "narration/tracks/scene-$id.wav" > "out/hospital/scene-$id.log" 2>&1
  echo "scene $id done: $(tail -c 120 "out/hospital/scene-$id.log" | tr '\r' '\n' | tail -1)"
}
export -f render_one track

selected=()
for s in "${SCENES[@]}"; do
  n=${s%%|*}
  if [ "$#" -eq 0 ] || printf '%s\n' "$@" | grep -qx "$n"; then selected+=("$s"); fi
done
printf '%s\n' "${selected[@]}" | xargs -P "${JOBS:-3}" -I{} bash -c 'render_one "$@"' _ {}

# Join: every scene shares codec settings, so the concat demuxer can copy streams.
: > out/hospital/list.txt
for s in "${SCENES[@]}"; do echo "file 'scene-$(printf '%02d' "${s%%|*}").mp4'" >> out/hospital/list.txt; done
ffmpeg -y -loglevel error -f concat -safe 0 -i out/hospital/list.txt -c copy -movflags +faststart out/hospital/hospital-change-shape.mp4
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 out/hospital/hospital-change-shape.mp4)

# Soft ambient bed under the narration: reverb, then ducked whenever the voice speaks.
python3 music/ambient.py "$dur" narration/tracks/ambient.wav
ffmpeg -y -loglevel error -i out/hospital/hospital-change-shape.mp4 -i narration/tracks/ambient.wav -filter_complex \
  "[1:a]aecho=0.8:0.7:120|260:0.25|0.18,volume=${MUSIC_GAIN:-0.22}[bed];\
   [0:a]asplit=2[voice][key];\
   [bed][key]sidechaincompress=threshold=0.015:ratio=5:attack=120:release=1400[ducked];\
   [voice][ducked]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[mix]" \
  -map 0:v -map "[mix]" -c:v copy -c:a aac -b:a 192k -movflags +faststart out/hospital/hospital-change-shape-music.mp4
echo "film: out/hospital/hospital-change-shape-music.mp4 (${dur}s, with ambient bed); narration only: out/hospital/hospital-change-shape.mp4"
