#!/bin/bash
# Tile evenly spaced frames from a video into one image, for reviewing motion at a glance.
# Usage: tools/filmstrip.sh video.mp4 out.png [cols] [rows] [start_s] [end_s]
set -euo pipefail
in=$1; out=$2; cols=${3:-6}; rows=${4:-4}; start=${5:-0}
end=${6:-$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")}
n=$((cols * rows))
fps=$(python3 -c "print($n / max(0.01, $end - $start))")
ffmpeg -y -loglevel error -ss "$start" -to "$end" -i "$in" \
  -vf "fps=$fps,scale=480:-2,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='%{pts\\:hms}':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.5,tile=${cols}x${rows}:padding=4" \
  -frames:v 1 "$out"
echo "$out ($n frames, ${start}s to ${end}s)"
