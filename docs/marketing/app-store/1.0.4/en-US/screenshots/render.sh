#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
OUTPUT_DIR="${1:-/Users/ibrahimi/Desktop/App Store Screenshots/ASO-1.0.4/en-US}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE_DIR="/private/tmp/overthought-aso-104-chrome-$$"

mkdir -p "$OUTPUT_DIR"

files=(
  01-dating-verdict.png
  02-describe-the-text.png
  03-evidence-check.png
  04-next-move.png
  05-track-patterns.png
  06-start-free.png
)

for index in {1..6}; do
  output_file="$OUTPUT_DIR/${files[$index]}"
  rm -f "$output_file"

  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --disable-background-networking \
    --disable-component-update \
    --hide-scrollbars \
    --no-first-run \
    --no-default-browser-check \
    --force-device-scale-factor=1 \
    --user-data-dir="$PROFILE_DIR-$index" \
    --window-size=1242,2688 \
    --screenshot="$output_file" \
    "file://$SCRIPT_DIR/index.html?slide=$index" &

  chrome_pid=$!
  for _ in {1..150}; do
    [[ -s "$output_file" ]] && break
    sleep 0.1
  done

  if [[ ! -s "$output_file" ]]; then
    kill "$chrome_pid" 2>/dev/null || true
    wait "$chrome_pid" 2>/dev/null || true
    echo "Render failed for ${files[$index]}" >&2
    exit 1
  fi

  sleep 0.2
  kill "$chrome_pid" 2>/dev/null || true
  wait "$chrome_pid" 2>/dev/null || true
done

echo "Rendered six App Store screenshots to $OUTPUT_DIR"
