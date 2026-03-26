#!/usr/bin/env node
/**
 * Generate room background + furniture sprites using FLUX 1.1 Pro.
 * Higher quality than Retro Diffusion — proper pixel art aesthetic.
 *
 * Usage: REPLICATE_API_TOKEN=r8_xxx node scripts/generate-room-flux.mjs
 */

const TOKEN = process.env.REPLICATE_API_TOKEN;
if (!TOKEN) { console.error("Set REPLICATE_API_TOKEN"); process.exit(1); }

const API = "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions";
const OUT_DIR = "packages/renderer/public/sprites";

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

async function generate(prompt, width, height, outfile) {
  console.log(`>>> ${outfile} (${width}x${height})...`);

  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { prompt, width, height, output_format: "png", output_quality: 100 }
    }),
  });
  const { id } = await res.json();

  // Poll
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const result = await poll.json();

    if (result.status === "succeeded") {
      const url = Array.isArray(result.output) ? result.output[0] : result.output;
      const imgRes = await fetch(url);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      writeFileSync(outfile, buf);
      console.log(`    ✓ ${outfile} (${buf.length} bytes)`);
      return;
    }
    if (result.status === "failed") {
      console.log(`    ✗ FAILED: ${result.error}`);
      return;
    }
  }
  console.log("    ✗ TIMEOUT");
}

// Style prefix for consistency across all assets
const STYLE = "16-bit pixel art, SNES style, cozy warm colors, clean crisp pixels, no anti-aliasing, transparent background where specified";

async function main() {
  mkdirSync(join(OUT_DIR, "objects_34"), { recursive: true });

  // === ROOM BACKGROUND (empty shell, 3/4 top-down) ===
  console.log("\n=== Room Background ===");
  await generate(
    `${STYLE}, cozy studio apartment room interior viewed from above at three-quarter angle, warm wooden plank floor seen from top, cream colored back wall with subtle wallpaper pattern, small window with white curtains on back wall, wooden door on right side, warm afternoon lighting, empty room NO furniture, game background, 16bit SNES RPG style`,
    960, 540,
    join(OUT_DIR, "room_background_34.png"),
  );

  // === FURNITURE (individual pieces, transparent bg) ===
  console.log("\n=== Furniture Sprites ===");

  const furniture = [
    { id: "bed", w: 128, h: 80, prompt: "single cozy bed with blue blanket red pillow wooden frame, three-quarter top-down view from above" },
    { id: "desk", w: 96, h: 64, prompt: "small wooden desk with drawer, three-quarter top-down view from above" },
    { id: "computer", w: 64, h: 48, prompt: "retro CRT computer monitor on small stand showing green code on dark screen, three-quarter top-down view" },
    { id: "bookshelf", w: 64, h: 80, prompt: "wooden bookshelf with colorful books on three shelves, three-quarter top-down view from above" },
    { id: "fridge", w: 48, h: 64, prompt: "small white refrigerator with magnets on door, three-quarter top-down view from above" },
    { id: "stove", w: 48, h: 48, prompt: "small kitchen stove with four burners, three-quarter top-down view from above" },
    { id: "table_chair", w: 96, h: 64, prompt: "small wooden dining table with one wooden chair, three-quarter top-down view from above" },
    { id: "easel", w: 48, h: 72, prompt: "wooden painting easel with canvas showing colorful art, three-quarter top-down view from above" },
    { id: "exercise_mat", w: 80, h: 40, prompt: "blue yoga exercise mat rolled slightly at edges, three-quarter top-down view from above" },
    { id: "plant", w: 32, h: 48, prompt: "small potted green plant in terracotta pot, three-quarter top-down view from above" },
    { id: "clock", w: 32, h: 32, prompt: "round wooden wall clock with visible hands, front view, pixel art" },
    { id: "poster", w: 48, h: 48, prompt: "colorful art poster in thin frame, front view, pixel art" },
  ];

  for (const item of furniture) {
    await generate(
      `${STYLE}, ${item.prompt}, game sprite asset, isolated on pure black background`,
      item.w * 2, item.h * 2, // generate at 2x, will be displayed at 1x
      join(OUT_DIR, "objects_34", `${item.id}.png`),
    );
  }

  console.log("\n=== Done! ===");
  console.log("Review generated sprites, then refresh browser.");
  console.log("Room background: sprites/room_background_34.png");
  console.log("Furniture: sprites/objects_34/*.png");
}

main().catch(console.error);
