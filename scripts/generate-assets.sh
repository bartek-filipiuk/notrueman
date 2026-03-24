#!/bin/bash
# Generate all game assets via Retro Diffusion on Replicate
# Usage: REPLICATE_API_TOKEN=r8_xxx ./scripts/generate-assets.sh
#
# Cost: ~$0.03/image × ~30 images = ~$0.90 total

set -e

TOKEN="${REPLICATE_API_TOKEN:?Set REPLICATE_API_TOKEN}"
API="https://api.replicate.com/v1/models"
OUT_DIR="packages/renderer/public/sprites"

generate() {
  local model="$1" prompt="$2" width="$3" height="$4" outfile="$5" extra="${6:-}"

  echo ">>> Generating: $(basename $outfile) ($width×$height)..."

  local body="{\"input\":{\"prompt\":\"$prompt\",\"width\":$width,\"height\":$height,\"remove_bg\":true${extra}}}"

  local id=$(curl -s -X POST "$API/$model/predictions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

  # Poll until done (max 60s)
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

echo "=== Room Objects (14) ==="

generate "retro-diffusion/rd-plus" \
  "cozy wooden bed with red pillow and blue blanket, side view, pixel art room furniture, warm cozy style" \
  128 64 "$OUT_DIR/objects/bed.png"

generate "retro-diffusion/rd-plus" \
  "wooden desk with drawer and metal handle, side view, pixel art room furniture" \
  96 64 "$OUT_DIR/objects/desk.png"

generate "retro-diffusion/rd-plus" \
  "computer monitor on stand showing code on dark screen, green text, pixel art, side view" \
  64 48 "$OUT_DIR/objects/computer.png"

generate "retro-diffusion/rd-plus" \
  "wooden bookshelf with colorful books on three shelves, side view, pixel art furniture, warm colors" \
  64 96 "$OUT_DIR/objects/bookshelf.png"

generate "retro-diffusion/rd-plus" \
  "white refrigerator with small colored magnets, side view, pixel art kitchen appliance" \
  48 80 "$OUT_DIR/objects/fridge.png"

generate "retro-diffusion/rd-plus" \
  "kitchen stove with two burners and oven door, side view, pixel art kitchen appliance, silver" \
  48 48 "$OUT_DIR/objects/stove.png"

generate "retro-diffusion/rd-plus" \
  "wooden dining table with chair, side view, pixel art furniture, warm brown wood" \
  96 64 "$OUT_DIR/objects/table_chair.png"

generate "retro-diffusion/rd-plus" \
  "wooden art easel with small canvas showing abstract painting, side view, pixel art" \
  48 80 "$OUT_DIR/objects/easel.png"

generate "retro-diffusion/rd-plus" \
  "rolled yoga exercise mat, teal cyan color, side view, pixel art fitness equipment" \
  96 32 "$OUT_DIR/objects/exercise_mat.png"

generate "retro-diffusion/rd-plus" \
  "window with wooden frame showing blue sky and white clouds, curtains on sides, pixel art" \
  64 80 "$OUT_DIR/objects/window.png"

generate "retro-diffusion/rd-plus" \
  "round wall clock with brown frame and white face showing hands, pixel art" \
  32 32 "$OUT_DIR/objects/clock.png"

generate "retro-diffusion/rd-plus" \
  "green potted plant in brown clay pot, small houseplant with round leaves, pixel art" \
  32 48 "$OUT_DIR/objects/plant.png"

generate "retro-diffusion/rd-plus" \
  "framed poster on wall with geometric abstract art in warm colors, pixel art" \
  48 48 "$OUT_DIR/objects/poster.png"

generate "retro-diffusion/rd-plus" \
  "wooden door with panels and brass doorknob, closed, side view, pixel art, warm brown" \
  48 96 "$OUT_DIR/objects/door.png"

echo ""
echo "=== Truman Character ==="

generate "retro-diffusion/rd-plus" \
  "chibi pixel art character, young man standing idle, blue shirt, dark pants, brown messy hair, large head small body, cute proportions, game sprite, facing right" \
  48 64 "$OUT_DIR/truman/idle.png"

generate "retro-diffusion/rd-plus" \
  "chibi pixel art character, young man happy smiling, blue shirt, brown hair, large head, cute game sprite, facing right, blushing cheeks" \
  48 64 "$OUT_DIR/truman/mood_happy.png"

generate "retro-diffusion/rd-plus" \
  "chibi pixel art character, young man curious wondering, blue shirt, brown hair, large head, one eyebrow raised, cute game sprite, facing right" \
  48 64 "$OUT_DIR/truman/mood_curious.png"

generate "retro-diffusion/rd-plus" \
  "chibi pixel art character, young man anxious worried, blue shirt, brown hair, large head, sweat drop, cute game sprite, facing right" \
  48 64 "$OUT_DIR/truman/mood_anxious.png"

generate "retro-diffusion/rd-plus" \
  "chibi pixel art character, young man frustrated annoyed, blue shirt, brown hair, large head, furrowed brows, cute game sprite, facing right" \
  48 64 "$OUT_DIR/truman/mood_frustrated.png"

generate "retro-diffusion/rd-plus" \
  "chibi pixel art character, young man excited enthusiastic, blue shirt, brown hair, large head, big smile, sparkling eyes, cute game sprite, facing right" \
  48 64 "$OUT_DIR/truman/mood_excited.png"

generate "retro-diffusion/rd-plus" \
  "chibi pixel art character, young man content peaceful, blue shirt, brown hair, large head, gentle smile closed eyes, cute game sprite, facing right" \
  48 64 "$OUT_DIR/truman/mood_content.png"

generate "retro-diffusion/rd-plus" \
  "chibi pixel art character, young man contemplative thinking, blue shirt, brown hair, large head, hand on chin, cute game sprite, facing right" \
  48 64 "$OUT_DIR/truman/mood_contemplative.png"

generate "retro-diffusion/rd-plus" \
  "chibi pixel art character, young man bored sleepy, blue shirt, brown hair, large head, half-closed eyes, cute game sprite, facing right" \
  48 64 "$OUT_DIR/truman/mood_bored.png"

echo ""
echo "=== Tiles ==="

generate "retro-diffusion/rd-tile" \
  "wooden floor planks, warm brown wood grain, pixel art seamless texture" \
  64 64 "$OUT_DIR/tiles/floor.png"

generate "retro-diffusion/rd-tile" \
  "warm beige wallpaper with subtle diamond pattern, pixel art seamless texture, cozy room" \
  64 64 "$OUT_DIR/tiles/wall.png"

echo ""
echo "=== DONE ==="
echo "Generated assets in $OUT_DIR"
ls -la $OUT_DIR/objects/ $OUT_DIR/truman/ $OUT_DIR/tiles/ 2>/dev/null
