#!/bin/bash
# Install the video kit's dependencies so scenes can be rendered right away.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/video"
npm install --no-audit --no-fund

command -v ffmpeg >/dev/null || { echo "ffmpeg not found; video rendering needs it" >&2; exit 1; }
