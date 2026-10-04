#!/bin/bash
# Build "Pass the Blame" (scenes/pass-the-blame-v2.html, chapters 1-9) into one film.
#
# Usage (from video/):
#   tools/ptb-build.sh            full quality (1080p, 30 fps)
#   PREVIEW=1 tools/ptb-build.sh  draft for review (540p, 12 fps): much faster
#   CHAPTERS="3 5" tools/ptb-build.sh   re-render only some chapters, then rejoin
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=out/ptb2; mkdir -p "$OUT"
SUFFIX=${PREVIEW:+.preview}
RFLAGS=${PREVIEW:+--preview --fps 12}; RFLAGS=${RFLAGS:---fps ${FPS:-24}}; LOQ=${PREVIEW:+&lo=1}
node narration/build-timings.mjs > /dev/null

voice_at() { case $1 in 1) echo 2.2;; 9) echo -;; *) echo 2.0;; esac; }

# Render in 8-second chunks: each chunk is written to .part and renamed when complete, so a
# restarted build skips finished chunks and only redoes the ones cut off.
CHUNK=${CHUNK:-192}
mkdir -p "$OUT/chunks$SUFFIX"
render_chunk() {
  local n=$1 a=$2 b=$3 f="$OUT/chunks$SUFFIX/ch$1-$(printf %05d $2).mp4"
  [ -f "$f" ] && return 0
  node render.mjs scenes/pass-the-blame-v2.html --query "?ch=$n$LOQ" $RFLAGS --frames "$a:$b" --out "${f%.mp4}.part.mp4" > "${f%.mp4}.log" 2>&1 \
    && mv "${f%.mp4}.part.mp4" "$f" && mv "${f%.mp4}.part.cues.json" "$OUT/ch$n$SUFFIX.cues.json" 2>/dev/null; echo "ch$n $a-$b: $(tail -c 120 "${f%.mp4}.log" | tr '\r' '\n' | tail -1)"
}
export -f render_chunk; export OUT SUFFIX RFLAGS LOQ
JOBS_LIST=$(for n in ${CHAPTERS:-1 2 3 4 5 6 7 8 9}; do
  total=$(node render.mjs scenes/pass-the-blame-v2.html --query "?ch=$n$LOQ" $RFLAGS --info | tail -1 | python3 -c "import json,sys; print(json.load(sys.stdin)['frames'])")
  for ((a = 0; a < total; a += CHUNK)); do echo "$n $a $((a + CHUNK < total ? a + CHUNK : total))"; done
done)
echo "$JOBS_LIST" | xargs -P "${JOBS:-4}" -L 1 bash -c 'render_chunk "$0" "$1" "$2"'
for n in 1 2 3 4 5 6 7 8 9; do
  ls "$OUT/chunks$SUFFIX"/ch$n-*.mp4 | grep -v part | sed "s|^$OUT/|file '|; s|\$|'|" > "$OUT/ch$n$SUFFIX.list"
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/ch$n$SUFFIX.list" -c copy "$OUT/ch$n$SUFFIX.mp4"
done

# Per-chapter audio: narration placed at its start + synthesised sound cues.
: > "$OUT/video$SUFFIX.txt"; : > "$OUT/audio$SUFFIX.txt"
for n in 1 2 3 4 5 6 7 8 9; do
  v="$OUT/ch$n$SUFFIX.mp4"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$v")
  at=$(voice_at "$n")
  if [ "$at" = "-" ]; then
    ffmpeg -y -loglevel error -f lavfi -i "anullsrc=r=48000:cl=stereo" -t "$dur" "$OUT/ch$n.voice.wav"
  else
    ms=$(python3 -c "print(int($at*1000))")
    ffmpeg -y -loglevel error -i "narration/ptb-0$n.voice.wav" -af "adelay=${ms}:all=1,apad,aresample=48000" -ac 2 -t "$dur" "$OUT/ch$n.voice.wav"
  fi
  cues="$OUT/ch$n$SUFFIX.cues.json"; [ -f "$cues" ] || echo '[]' > "$cues"
  python3 music/sfx.py "$cues" "$dur" "$OUT/ch$n.sfx.wav" > /dev/null
  echo "file 'ch$n$SUFFIX.mp4'" >> "$OUT/video$SUFFIX.txt"
  echo "file 'ch$n.voice.wav'" >> "$OUT/audio$SUFFIX.txt"
  echo "file 'ch$n.sfx.wav'" >> "$OUT/sfx$SUFFIX.txt.tmp"
done
mv "$OUT/sfx$SUFFIX.txt.tmp" "$OUT/sfx$SUFFIX.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/video$SUFFIX.txt" -c copy "$OUT/video$SUFFIX.mp4"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/audio$SUFFIX.txt" -c pcm_s16le "$OUT/voice-all.wav"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/sfx$SUFFIX.txt" -c pcm_s16le "$OUT/sfx-all.wav"
total=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/video$SUFFIX.mp4")
python3 music/ambient.py "$total" "$OUT/ambient.wav" > /dev/null

# Mix: voice on top; music + effects ducked under the voice; then loudness to -16 LUFS.
ffmpeg -y -loglevel error -i "$OUT/voice-all.wav" -i "$OUT/ambient.wav" -i "$OUT/sfx-all.wav" -filter_complex \
  "[0:a]asplit=2[voice][key];[1:a]aecho=0.8:0.7:120|260:0.25|0.18,volume=${MUSIC_GAIN:-0.2}[bed];[2:a]volume=${SFX_GAIN:-0.55}[fx];\
   [bed][fx]amix=inputs=2:normalize=0[under];[under][key]sidechaincompress=threshold=0.015:ratio=5:attack=80:release=1200[ducked];\
   [voice][ducked]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[mix]" \
  -map "[mix]" -ar 48000 "$OUT/mix$SUFFIX.wav"
ffmpeg -y -loglevel error -i "$OUT/video$SUFFIX.mp4" -i "$OUT/mix$SUFFIX.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT/pass-the-blame$SUFFIX.mp4"
echo "film: $OUT/pass-the-blame$SUFFIX.mp4 (${total}s)"
