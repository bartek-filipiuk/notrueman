#!/usr/bin/env node
/**
 * Generate walk frames for 4 directional sprites.
 * For front/back: shift legs left/right (horizontal split at center X)
 * For left/right: shift legs up/down (simulates stepping forward/back in side view)
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Use jimp from /tmp (sharp broken in workspace)
const Jimp = require("/tmp/node_modules/jimp");
const path = require("path");

const DIR = "packages/renderer/public/sprites/truman";

const LEG_SHIFT = 4; // pixels to shift legs

async function generateWalkPair(idleFile, walk1File, walk2File, mode) {
  const img = await Jimp.read(path.join(DIR, idleFile));
  const w = img.getWidth();
  const h = img.getHeight();

  // Find where legs start (scan from bottom up, find first non-transparent row from ~60% height)
  let legCutY = Math.round(h * 0.55);

  // Find center X of character at leg level
  let sumX = 0, count = 0;
  for (let y = legCutY; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const { a } = Jimp.intToRGBA(img.getPixelColor(x, y));
      if (a > 10) { sumX += x; count++; }
    }
  }
  const centerX = count > 0 ? Math.round(sumX / count) : Math.round(w / 2);
  const centerY = legCutY;

  console.log(`  ${idleFile}: ${w}x${h}, legCut=${legCutY}, center=(${centerX}, ${centerY}), mode=${mode}`);

  async function makeFrame(shiftA, shiftB, outFile) {
    const frame = img.clone();

    // Clear leg area
    for (let y = legCutY; y < h; y++) {
      for (let x = 0; x < w; x++) {
        frame.setPixelColor(0x00000000, x, y);
      }
    }

    // Redraw legs with shift
    for (let y = legCutY; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const color = img.getPixelColor(x, y);
        const { a } = Jimp.intToRGBA(color);
        if (a <= 10) continue;

        let newX = x, newY = y;

        if (mode === "horizontal") {
          // Front/back: split left/right leg, shift horizontally
          const isLeft = x < centerX;
          newX = x + (isLeft ? shiftA : shiftB);
        } else {
          // Side view: split top/bottom of leg area, shift vertically
          const isUpper = y < centerY + (h - centerY) / 2;
          newY = y + (isUpper ? shiftA : shiftB);
        }

        if (newX >= 0 && newX < w && newY >= 0 && newY < h) {
          frame.setPixelColor(color, newX, newY);
        }
      }
    }

    await frame.writeAsync(path.join(DIR, outFile));
    console.log(`    ✓ ${outFile}`);
  }

  await makeFrame(-LEG_SHIFT, LEG_SHIFT, walk1File);
  await makeFrame(LEG_SHIFT, -LEG_SHIFT, walk2File);
}

async function main() {
  console.log("Generating 4-directional walk frames...\n");

  // Front/back: legs shift left/right
  await generateWalkPair("idle_front.png", "walk_front_1.png", "walk_front_2.png", "horizontal");
  await generateWalkPair("idle_back.png", "walk_back_1.png", "walk_back_2.png", "horizontal");

  // Side views: legs shift vertically (forward/back step)
  await generateWalkPair("idle_left.png", "walk_left_1.png", "walk_left_2.png", "vertical");
  await generateWalkPair("idle_right.png", "walk_right_1.png", "walk_right_2.png", "vertical");

  // Also update legacy walk_1/walk_2 (from front idle)
  await generateWalkPair("idle_front.png", "walk_1.png", "walk_2.png", "horizontal");

  console.log("\nDone! 10 walk frames generated.");
}

main().catch(console.error);
