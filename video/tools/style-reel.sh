#!/bin/bash
# Render the four style samples at full quality with sound design, label them and join into one reel.
# Usage (from video/): tools/style-reel.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/styles
STYLES=("a-editorial|A · Editorial kinetic" "b-diorama|B · 3D diorama" "c-paper|C · Paper collage" "d-datanoir|D · Data noir")
render() {
  local id=${1%%|*}
  node render.mjs "scenes/style-$id.html" --out "out/styles/$id.mp4" > "out/styles/$id.log" 2>&1
}
export -f render
printf '%s\n' "${STYLES[@]}" | xargs -P 4 -I{} bash -c 'render "$@"' _ {}
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
: > out/styles/list.txt
for s in "${STYLES[@]}"; do
  id=${s%%|*}; label=${s#*|}
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "out/styles/$id.mp4")
  python3 music/sfx.py "out/styles/$id.cues.json" "$dur" "out/styles/$id.sfx.wav" > /dev/null
  python3 music/ambient.py "$dur" "out/styles/$id.bed.wav" > /dev/null
  ffmpeg -y -loglevel error -i "out/styles/$id.mp4" -i "out/styles/$id.bed.wav" -i "out/styles/$id.sfx.wav" -filter_complex \
    "[1:a]volume=0.35[b];[2:a]volume=1.0[s];[b][s]amix=inputs=2:normalize=0,alimiter=limit=0.9[a];\
     [0:v]drawtext=fontfile=$FONT:text='$label':x=40:y=36:fontsize=34:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=14:enable='lt(t,3)'[v]" \
    -map "[v]" -map "[a]" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 "out/styles/$id.final.mp4"
  echo "file '$id.final.mp4'" >> out/styles/list.txt
done
ffmpeg -y -loglevel error -f concat -safe 0 -i out/styles/list.txt -c copy -movflags +faststart out/styles/style-options.mp4
echo "reel: out/styles/style-options.mp4 ($(ffprobe -v error -show_entries format=duration -of csv=p=0 out/styles/style-options.mp4)s)"
