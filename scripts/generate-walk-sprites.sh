#!/bin/bash
# Generate walk cycle sprites for Truman (2 frames)
# Usage: REPLICATE_API_TOKEN=r8_xxx ./scripts/generate-walk-sprites.sh
#
# Uses identical base prompt as idle.png for consistency.
# Generates 3-5 variants of each frame — pick the most consistent pair.

set -e

TOKEN="${REPLICATE_API_TOKEN:?Set REPLICATE_API_TOKEN}"
API="https://api.replicate.com/v1/models"
OUT_DIR="packages/renderer/public/sprites/truman"

generate() {
  local model="$1" prompt="$2" width="$3" height="$4" outfile="$5" extra="${6:-}"

  echo ">>> Generating: $(basename $outfile) ($width×$height)..."

  local body="{\"input\":{\"prompt\":\"$prompt\",\"width\":$width,\"height\":$height,\"remove_bg\":true${extra}}}"

  local id=$(curl -s -X POST "$API/$model/predictions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

  for i in $(seq 1 12); do
    sleep 5
    local result=$(curl -s "$API/../predictions/$id" -H "Authorization: Bearer $TOKEN")
    local status=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")

    if [ "$status" = "succeeded" ]; then
      local url=$(echo "$result" | python3 -c "import sys,json; o=json.load(sys.stdin)['output']; print(o[0] if isinstance(o,list) else o)")
      curl -s -o "$outfile" "$url"
      echo "    ✓ Saved $(basename $outfile)"
      return 0
    elif [ "$status" = "failed" ]; then
      echo "    ✗ FAILED"
      return 1
    fi
  done
  echo "    ✗ TIMEOUT"
  return 1
}

# Base character description — IDENTICAL to idle.png prompt, only legs change
BASE="chibi pixel art character, young man, blue shirt, dark pants, brown messy hair, large head small body, cute proportions, game sprite, facing right"

echo "=== Walk Frame 1 (left leg forward) — 3 variants ==="
for v in 1 2 3; do
  generate "retro-diffusion/rd-plus" \
    "$BASE, walking pose left leg stepping forward, mid-stride" \
    48 64 "$OUT_DIR/walk_1_v${v}.png"
done

echo ""
echo "=== Walk Frame 2 (right leg forward) — 3 variants ==="
for v in 1 2 3; do
  generate "retro-diffusion/rd-plus" \
    "$BASE, walking pose right leg stepping forward, mid-stride" \
    48 64 "$OUT_DIR/walk_2_v${v}.png"
done

echo ""
echo "=== Done! ==="
echo "Generated 6 variants in $OUT_DIR/"
echo "Pick the best walk_1 and walk_2 that match idle.png, then rename:"
echo "  mv walk_1_v1.png walk_1.png"
echo "  mv walk_2_v1.png walk_2.png"
echo ""
echo "Compare with idle.png — choose variants with same face/body proportions."
ls -la "$OUT_DIR"/walk_*.png 2>/dev/null
