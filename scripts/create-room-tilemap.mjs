/**
 * Generate a Tiled-compatible JSON tilemap for the room layout.
 * Run: node scripts/create-room-tilemap.mjs
 * Output: packages/renderer/public/tilemaps/room.json
 *
 * After generating, open in Tiled for visual fine-tuning:
 *   tiled packages/renderer/public/tilemaps/room.json
 *
 * Room background: 384x216 scaled to 960x540 in Phaser.
 * Floor line in background: approximately y=330 (in game coords).
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const GAME_W = 960;
const GAME_H = 540;
const FLOOR_Y = 330; // where floor starts in background

// Object definitions: id, texture filename, zone, approximate good position + size
// Positions designed for dollhouse cutaway perspective:
// - Floor objects: bottom edge near FLOOR_Y, spread across room
// - Wall objects: y=90-200, centered on back wall
// - Tall objects: span from wall to floor
const objects = [
  // LEFT ZONE: Bedroom
  { id: "bed",           w: 190, h: 95,  x: 100,  y: FLOOR_Y, zone: "sleep" },
  { id: "easel",         w: 55,  h: 120, x: 90,   y: FLOOR_Y, zone: "creative" },

  // LEFT-CENTER: Kitchen
  { id: "fridge",        w: 55,  h: 115, x: 310,  y: FLOOR_Y, zone: "kitchen" },
  { id: "stove",         w: 55,  h: 65,  x: 375,  y: FLOOR_Y, zone: "kitchen" },

  // CENTER: Workspace
  { id: "desk",          w: 130, h: 80,  x: 460,  y: FLOOR_Y, zone: "work" },
  { id: "computer",      w: 75,  h: 55,  x: 485,  y: FLOOR_Y - 75, zone: "work" },

  // CENTER-RIGHT: Living area
  { id: "table_chair",   w: 115, h: 75,  x: 620,  y: FLOOR_Y, zone: "kitchen" },
  { id: "bookshelf",     w: 85,  h: 190, x: 570,  y: FLOOR_Y, zone: "reading" },

  // RIGHT: Entry / window area
  { id: "plant",         w: 40,  h: 60,  x: 740,  y: FLOOR_Y, zone: "window" },
  { id: "door",          w: 75,  h: 185, x: 840,  y: FLOOR_Y, zone: "door" },

  // FLOOR
  { id: "exercise_mat",  w: 115, h: 28,  x: 200,  y: FLOOR_Y + 70, zone: "exercise" },

  // WALL (hanging objects — y is center, not bottom)
  { id: "window",        w: 110, h: 130, x: 790,  y: 120, zone: "window", wall: true },
  { id: "clock",         w: 42,  h: 42,  x: 490,  y: 115, zone: "window", wall: true },
  { id: "poster",        w: 75,  h: 75,  x: 195,  y: 130, zone: "creative", wall: true },
];

// For floor objects: y = bottom edge. Tiled uses bottom-left origin for tile objects.
// For wall objects: y = center position.
// Phaser will need to handle origin correctly.

// Build object list for Tiled JSON
let nextId = 1;
const tiledObjects = objects.map(obj => {
  // For floor objects, y = bottom edge (Tiled bottom-left origin)
  // For wall objects, y = center + half height
  const tiledY = obj.wall ? obj.y + obj.h / 2 : obj.y;
  const tiledX = obj.x;

  return {
    id: nextId++,
    name: obj.id,
    type: obj.zone,
    x: tiledX,
    y: tiledY,
    width: obj.w,
    height: obj.h,
    rotation: 0,
    visible: true,
    properties: [
      { name: "zone", type: "string", value: obj.zone },
      { name: "isWall", type: "bool", value: !!obj.wall },
    ],
  };
});

// Truman spawn point
tiledObjects.push({
  id: nextId++,
  name: "truman_spawn",
  type: "character",
  x: GAME_W / 2,
  y: FLOOR_Y + 50,
  width: 64,
  height: 96,
  rotation: 0,
  visible: true,
  properties: [],
});

const tilemap = {
  compressionlevel: -1,
  height: Math.ceil(GAME_H / 32),
  width: Math.ceil(GAME_W / 32),
  tileheight: 32,
  tilewidth: 32,
  infinite: false,
  orientation: "orthogonal",
  renderorder: "right-down",
  tiledversion: "1.10.0",
  type: "map",
  version: "1.10",
  layers: [
    {
      id: 1,
      name: "background",
      type: "imagelayer",
      image: "../sprites/room_background.png",
      offsetx: 0,
      offsety: 0,
      opacity: 1,
      visible: true,
      x: 0,
      y: 0,
    },
    {
      id: 2,
      name: "furniture",
      type: "objectgroup",
      objects: tiledObjects,
      opacity: 1,
      visible: true,
      x: 0,
      y: 0,
      draworder: "topdown",
    },
  ],
  nextlayerid: 3,
  nextobjectid: nextId,
};

const outPath = resolve(__dirname, "../packages/renderer/public/tilemaps/room.json");
writeFileSync(outPath, JSON.stringify(tilemap, null, 2));
console.log(`✓ Wrote ${outPath}`);
console.log(`  ${tiledObjects.length} objects (14 furniture + 1 character spawn)`);
console.log(`  Open in Tiled for visual fine-tuning: tiled ${outPath}`);
