#!/usr/bin/env node
/**
 * Generate walk_1.png and walk_2.png from idle.png by shifting the lower body.
 * Splits the sprite at a configurable Y line (legs cutoff).
 * Upper body stays identical, legs are shifted left/right to simulate walking.
 */
import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const SPRITE_DIR = "packages/renderer/public/sprites/truman";
const IDLE_PATH = join(SPRITE_DIR, "idle.png");

// Configuration — tune these for the specific sprite
const LEG_CUT_Y = 88;      // Y line where legs begin (pixels from top)
const LEG_SHIFT_X = 4;     // How many pixels to shift each leg sideways
const LEG_SHIFT_Y = 1;     // Slight vertical offset for "step" feel

async function generate() {
  const img = sharp(IDLE_PATH);
  const { width, height } = await img.metadata();

  console.log(`Idle sprite: ${width}x${height}`);
  console.log(`Leg cut at Y=${LEG_CUT_Y}, shift=${LEG_SHIFT_X}px`);

  // Get raw pixel data
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const channels = info.channels; // 4 (RGBA)

  // Find the center X of the character (center of mass of non-transparent pixels at leg level)
  let sumX = 0, count = 0;
  for (let y = LEG_CUT_Y; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * channels + 3];
      if (alpha > 10) { sumX += x; count++; }
    }
  }
  const centerX = count > 0 ? Math.round(sumX / count) : Math.round(w / 2);
  console.log(`Character center X at leg level: ${centerX}`);

  // Create walk frame by shifting left/right halves of legs
  function createWalkFrame(leftShiftX, rightShiftX, verticalShift) {
    const output = Buffer.from(data); // copy

    // Clear leg area first
    for (let y = LEG_CUT_Y; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * channels;
        output[idx] = 0;
        output[idx + 1] = 0;
        output[idx + 2] = 0;
        output[idx + 3] = 0;
      }
    }

    // Re-draw legs with shift applied
    for (let y = LEG_CUT_Y; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcIdx = (y * w + x) * channels;
        const alpha = data[srcIdx + 3];
        if (alpha <= 10) continue;

        // Determine if pixel is left leg or right leg
        const isLeftSide = x < centerX;
        const shiftX = isLeftSide ? leftShiftX : rightShiftX;
        const shiftY = isLeftSide ? verticalShift : -verticalShift;

        const newX = x + shiftX;
        const newY = y + shiftY;

        if (newX >= 0 && newX < w && newY >= 0 && newY < h) {
          const dstIdx = (newY * w + newX) * channels;
          output[dstIdx] = data[srcIdx];
          output[dstIdx + 1] = data[srcIdx + 1];
          output[dstIdx + 2] = data[srcIdx + 2];
          output[dstIdx + 3] = data[srcIdx + 3];
        }
      }
    }

    return output;
  }

  // Walk frame 1: left leg forward (shifted left), right leg back (shifted right)
  const walk1Data = createWalkFrame(-LEG_SHIFT_X, LEG_SHIFT_X, LEG_SHIFT_Y);
  await sharp(walk1Data, { raw: { width: w, height: h, channels } })
    .png()
    .toFile(join(SPRITE_DIR, "walk_1.png"));
  console.log("✓ walk_1.png — left leg forward");

  // Walk frame 2: right leg forward, left leg back (opposite)
  const walk2Data = createWalkFrame(LEG_SHIFT_X, -LEG_SHIFT_X, -LEG_SHIFT_Y);
  await sharp(walk2Data, { raw: { width: w, height: h, channels } })
    .png()
    .toFile(join(SPRITE_DIR, "walk_2.png"));
  console.log("✓ walk_2.png — right leg forward");

  console.log("\nDone! Check the sprites visually.");
}

generate().catch(console.error);
