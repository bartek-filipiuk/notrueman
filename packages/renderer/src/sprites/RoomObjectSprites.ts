import Phaser from "phaser";

/**
 * Generates pixel art textures for all 14 room objects using Graphics API.
 * Each object is recognizable WITHOUT text labels.
 * Style: 16-bit SNES, Stardew Valley warmth.
 * Call generateAllTextures(scene) once in BootScene.preload or RoomScene.create.
 */

// Warm palette
const WOOD_DARK = 0x6b4e2e;
const WOOD_MID = 0x8b6d45;
const WOOD_LIGHT = 0xa88b5e;
const WOOD_HIGHLIGHT = 0xc4a875;
const WHITE = 0xffffff;
const OFF_WHITE = 0xf0ead6;
const CREAM = 0xe8dcc8;
const BLUE_DARK = 0x2c3e8c;
const BLUE_MID = 0x4a69bd;
const BLUE_LIGHT = 0x6a89cc;
const RED_PILLOW = 0xc0392b;
const RED_DARK = 0x922b21;
const GREEN_PLANT = 0x27ae60;
const GREEN_DARK = 0x1e8449;
const BROWN_POT = 0x8d6e42;
const METAL_DARK = 0x5d6d7e;
const METAL_MID = 0x85929e;
const METAL_LIGHT = 0xaeb6bf;
const SCREEN_GLOW = 0x55efc4;
const SCREEN_BG = 0x2d3436;
const ORANGE_BURNER = 0xe67e22;
const CYAN_MAT = 0x00838f;
const CYAN_LIGHT = 0x26c6da;
const SKY_BLUE = 0x87ceeb;
const FRAME_BROWN = 0x5d4037;
const POSTER_YELLOW = 0xf39c12;
const POSTER_RED = 0xe74c3c;
const DOOR_BROWN = 0x795548;
const DOOR_DARK = 0x5d4037;
const DOOR_LIGHT = 0x8d6e63;
const CLOCK_FACE = 0xfdf2e9;

export function generateAllTextures(scene: Phaser.Scene): void {
  generateBed(scene);
  generateDesk(scene);
  generateComputer(scene);
  generateBookshelf(scene);
  generateFridge(scene);
  generateStove(scene);
  generateTableChair(scene);
  generateEasel(scene);
  generateExerciseMat(scene);
  generateWindow(scene);
  generateClock(scene);
  generatePlant(scene);
  generatePoster(scene);
  generateDoor(scene);
}

function generateBed(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 128, h = 64;
  // Frame
  g.fillStyle(WOOD_MID); g.fillRect(0, 12, w, h - 12);
  g.fillStyle(WOOD_DARK); g.fillRect(0, h - 4, w, 4); // bottom shadow
  g.fillStyle(WOOD_HIGHLIGHT); g.fillRect(0, 12, w, 2); // top edge
  // Headboard
  g.fillStyle(WOOD_DARK); g.fillRect(0, 0, 8, h);
  g.fillStyle(WOOD_MID); g.fillRect(2, 2, 4, h - 4);
  // Mattress
  g.fillStyle(OFF_WHITE); g.fillRect(10, 16, w - 14, h - 24);
  g.fillStyle(CREAM); g.fillRect(10, h - 10, w - 14, 2); // sheet fold
  // Blanket (blue)
  g.fillStyle(BLUE_MID); g.fillRect(40, 18, w - 44, h - 28);
  g.fillStyle(BLUE_DARK); g.fillRect(40, h - 12, w - 44, 2);
  g.fillStyle(BLUE_LIGHT); g.fillRect(40, 18, w - 44, 2);
  // Pillow
  g.fillStyle(RED_PILLOW); g.fillRect(14, 20, 22, 16);
  g.fillStyle(RED_DARK); g.fillRect(14, 34, 22, 2);
  g.fillStyle(0xe74c3c); g.fillRect(14, 20, 22, 2); // highlight
  g.generateTexture("obj_bed", w, h);
  g.destroy();
}

function generateDesk(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 96, h = 64;
  // Desktop surface
  g.fillStyle(WOOD_LIGHT); g.fillRect(0, 0, w, 8);
  g.fillStyle(WOOD_HIGHLIGHT); g.fillRect(0, 0, w, 2);
  g.fillStyle(WOOD_MID); g.fillRect(0, 6, w, 2);
  // Legs
  g.fillStyle(WOOD_DARK); g.fillRect(4, 8, 6, h - 8);
  g.fillStyle(WOOD_DARK); g.fillRect(w - 10, 8, 6, h - 8);
  // Drawer panel
  g.fillStyle(WOOD_MID); g.fillRect(14, 10, w - 28, 24);
  g.fillStyle(WOOD_LIGHT); g.fillRect(14, 10, w - 28, 2);
  g.fillStyle(WOOD_DARK); g.fillRect(14, 32, w - 28, 2);
  // Drawer handle
  g.fillStyle(METAL_MID); g.fillRect(40, 20, 16, 3);
  g.fillStyle(METAL_LIGHT); g.fillRect(40, 20, 16, 1);
  g.generateTexture("obj_desk", w, h);
  g.destroy();
}

function generateComputer(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 64, h = 48;
  // Monitor frame
  g.fillStyle(METAL_DARK); g.fillRect(4, 0, w - 8, h - 12);
  g.fillStyle(METAL_LIGHT); g.fillRect(4, 0, w - 8, 2); // top edge
  // Screen
  g.fillStyle(SCREEN_BG); g.fillRect(8, 4, w - 16, h - 20);
  // Screen content (code lines)
  g.fillStyle(SCREEN_GLOW); g.fillRect(12, 8, 20, 2);
  g.fillStyle(0x74b9ff); g.fillRect(12, 14, 28, 2);
  g.fillStyle(SCREEN_GLOW); g.fillRect(12, 20, 16, 2);
  g.fillStyle(0x74b9ff); g.fillRect(12, 26, 24, 2);
  // Screen glow
  g.fillStyle(SCREEN_GLOW, 0.1); g.fillRect(6, 2, w - 12, h - 16);
  // Stand
  g.fillStyle(METAL_DARK); g.fillRect(24, h - 12, 16, 8);
  g.fillStyle(METAL_MID); g.fillRect(18, h - 4, 28, 4);
  g.generateTexture("obj_computer", w, h);
  g.destroy();
}

function generateBookshelf(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 64, h = 96;
  // Frame
  g.fillStyle(WOOD_DARK); g.fillRect(0, 0, w, h);
  g.fillStyle(WOOD_MID); g.fillRect(2, 2, w - 4, h - 4);
  // Shelves (3 rows)
  const shelfH = 28;
  const bookColors = [0xe74c3c, 0x3498db, 0xf39c12, 0x27ae60, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xc0392b, 0x2980b9];
  for (let row = 0; row < 3; row++) {
    const sy = 4 + row * shelfH;
    // Shelf board
    g.fillStyle(WOOD_DARK); g.fillRect(2, sy + shelfH - 3, w - 4, 3);
    g.fillStyle(WOOD_HIGHLIGHT); g.fillRect(2, sy + shelfH - 3, w - 4, 1);
    // Books
    let bx = 5;
    for (let b = 0; b < 4 + row; b++) {
      const bw = 5 + (b * 3 + row * 7) % 5;
      const bh = 18 + (b * 5 + row * 3) % 6;
      const color = bookColors[(row * 4 + b) % bookColors.length];
      g.fillStyle(color);
      g.fillRect(bx, sy + shelfH - 3 - bh, bw, bh);
      // Spine highlight
      g.fillStyle(0xffffff, 0.2);
      g.fillRect(bx, sy + shelfH - 3 - bh, 1, bh);
      bx += bw + 1;
      if (bx > w - 8) break;
    }
  }
  g.generateTexture("obj_bookshelf", w, h);
  g.destroy();
}

function generateFridge(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 48, h = 80;
  // Body
  g.fillStyle(OFF_WHITE); g.fillRect(0, 0, w, h);
  g.fillStyle(CREAM); g.fillRect(0, h - 4, w, 4); // bottom shadow
  g.fillStyle(WHITE); g.fillRect(0, 0, w, 2); // top highlight
  // Door line (upper/lower compartments)
  g.fillStyle(METAL_LIGHT); g.fillRect(2, h * 0.35, w - 4, 2);
  // Handle
  g.fillStyle(METAL_MID); g.fillRect(w - 8, 14, 3, 16);
  g.fillStyle(METAL_LIGHT); g.fillRect(w - 8, 14, 1, 16);
  g.fillStyle(METAL_MID); g.fillRect(w - 8, h * 0.35 + 8, 3, 12);
  // Magnet (small colored square)
  g.fillStyle(0xe74c3c); g.fillRect(10, 10, 6, 6);
  g.fillStyle(0x3498db); g.fillRect(20, 16, 5, 5);
  // Side shadow
  g.fillStyle(0x000000, 0.08); g.fillRect(w - 3, 2, 3, h - 6);
  g.generateTexture("obj_fridge", w, h);
  g.destroy();
}

function generateStove(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 48, h = 48;
  // Body
  g.fillStyle(METAL_LIGHT); g.fillRect(0, 0, w, h);
  g.fillStyle(METAL_MID); g.fillRect(0, h - 4, w, 4);
  g.fillStyle(WHITE); g.fillRect(0, 0, w, 2);
  // Oven door
  g.fillStyle(METAL_DARK); g.fillRect(4, 20, w - 8, 24);
  g.fillStyle(SCREEN_BG); g.fillRect(8, 24, w - 16, 16); // oven window
  g.fillStyle(METAL_MID); g.fillRect(16, 18, 16, 3); // handle
  // Burners (2x2)
  const burnerR = 5;
  for (let bx = 0; bx < 2; bx++) {
    for (let by = 0; by < 1; by++) {
      const cx = 14 + bx * 20;
      const cy = 10;
      g.fillStyle(METAL_DARK);
      g.fillCircle(cx, cy, burnerR);
      g.fillStyle(METAL_MID);
      g.fillCircle(cx, cy, burnerR - 2);
    }
  }
  g.generateTexture("obj_stove", w, h);
  g.destroy();
}

function generateTableChair(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 96, h = 64;
  // Table top
  g.fillStyle(WOOD_LIGHT); g.fillRect(8, 16, w - 16, 8);
  g.fillStyle(WOOD_HIGHLIGHT); g.fillRect(8, 16, w - 16, 2);
  g.fillStyle(WOOD_MID); g.fillRect(8, 22, w - 16, 2);
  // Table legs
  g.fillStyle(WOOD_DARK); g.fillRect(12, 24, 4, h - 24);
  g.fillStyle(WOOD_DARK); g.fillRect(w - 24, 24, 4, h - 24);
  // Chair (right side)
  // Chair back
  g.fillStyle(WOOD_MID); g.fillRect(w - 12, 0, 8, 40);
  g.fillStyle(WOOD_LIGHT); g.fillRect(w - 12, 0, 8, 2);
  g.fillStyle(WOOD_DARK); g.fillRect(w - 10, 6, 4, 28); // slat
  // Chair seat
  g.fillStyle(WOOD_MID); g.fillRect(w - 20, 36, 16, 6);
  // Chair legs
  g.fillStyle(WOOD_DARK); g.fillRect(w - 18, 42, 3, h - 42);
  g.fillStyle(WOOD_DARK); g.fillRect(w - 8, 42, 3, h - 42);
  g.generateTexture("obj_table_chair", w, h);
  g.destroy();
}

function generateEasel(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 48, h = 80;
  // Legs (A-frame)
  g.fillStyle(WOOD_MID);
  // Left leg
  g.fillRect(6, 20, 4, h - 20);
  // Right leg
  g.fillRect(w - 10, 20, 4, h - 20);
  // Back leg
  g.fillStyle(WOOD_DARK); g.fillRect(w / 2 - 2, 30, 4, h - 30);
  // Cross bar
  g.fillStyle(WOOD_DARK); g.fillRect(6, 50, w - 12, 3);
  // Canvas shelf
  g.fillStyle(WOOD_MID); g.fillRect(4, 24, w - 8, 4);
  g.fillStyle(WOOD_HIGHLIGHT); g.fillRect(4, 24, w - 8, 1);
  // Canvas
  g.fillStyle(OFF_WHITE); g.fillRect(8, 2, w - 16, 22);
  g.fillStyle(CREAM); g.fillRect(8, 2, w - 16, 1); // top edge
  // Paint on canvas (abstract art)
  g.fillStyle(0x3498db, 0.6); g.fillRect(12, 6, 10, 8);
  g.fillStyle(0xe74c3c, 0.5); g.fillRect(20, 10, 8, 10);
  g.fillStyle(0xf39c12, 0.6); g.fillRect(26, 6, 6, 6);
  g.generateTexture("obj_easel", w, h);
  g.destroy();
}

function generateExerciseMat(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 96, h = 32;
  // Mat body
  g.fillStyle(CYAN_MAT); g.fillRect(0, 4, w, h - 8);
  g.fillStyle(CYAN_LIGHT); g.fillRect(0, 4, w, 3); // top highlight
  g.fillStyle(0x006064); g.fillRect(0, h - 6, w, 2); // bottom shadow
  // Rolled edge (left)
  g.fillStyle(0x006064); g.fillCircle(4, h / 2, 6);
  g.fillStyle(CYAN_MAT); g.fillCircle(4, h / 2, 4);
  g.fillStyle(CYAN_LIGHT); g.fillCircle(4, h / 2 - 1, 2);
  // Mat texture lines
  g.fillStyle(CYAN_LIGHT, 0.3);
  g.fillRect(12, 10, w - 16, 1);
  g.fillRect(12, 18, w - 16, 1);
  g.generateTexture("obj_exercise_mat", w, h);
  g.destroy();
}

function generateWindow(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 64, h = 80;
  // Window frame
  g.fillStyle(WOOD_LIGHT); g.fillRect(0, 0, w, h);
  g.fillStyle(WOOD_HIGHLIGHT); g.fillRect(0, 0, w, 2);
  g.fillStyle(WOOD_DARK); g.fillRect(0, h - 2, w, 2);
  // Glass (sky view)
  g.fillStyle(SKY_BLUE); g.fillRect(4, 4, w - 8, h - 8);
  // Clouds
  g.fillStyle(WHITE, 0.7);
  g.fillCircle(16, 18, 8); g.fillCircle(24, 16, 10); g.fillCircle(32, 18, 7);
  g.fillCircle(44, 30, 6); g.fillCircle(50, 28, 8);
  // Window cross frame
  g.fillStyle(WOOD_LIGHT);
  g.fillRect(w / 2 - 2, 4, 4, h - 8); // vertical
  g.fillRect(4, h / 2 - 2, w - 8, 4); // horizontal
  // Curtain hints (sides)
  g.fillStyle(CREAM, 0.6);
  g.fillRect(4, 4, 6, h - 8); // left curtain
  g.fillRect(w - 10, 4, 6, h - 8); // right curtain
  g.fillStyle(OFF_WHITE, 0.4);
  g.fillRect(4, 4, 2, h - 8);
  g.fillRect(w - 6, 4, 2, h - 8);
  // Sill
  g.fillStyle(WOOD_MID); g.fillRect(-2, h - 4, w + 4, 6);
  g.fillStyle(WOOD_HIGHLIGHT); g.fillRect(-2, h - 4, w + 4, 2);
  g.generateTexture("obj_window", w, h);
  g.destroy();
}

function generateClock(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 32, h = 32;
  const cx = w / 2, cy = h / 2, r = 13;
  // Clock body
  g.fillStyle(WOOD_DARK); g.fillCircle(cx, cy, r + 2);
  g.fillStyle(CLOCK_FACE); g.fillCircle(cx, cy, r);
  // Hour markers
  g.fillStyle(WOOD_DARK);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const mx = cx + Math.cos(a) * (r - 3);
    const my = cy + Math.sin(a) * (r - 3);
    g.fillRect(mx - 1, my - 1, 2, 2);
  }
  // Hands
  g.lineStyle(2, WOOD_DARK);
  g.lineBetween(cx, cy, cx + 4, cy - 8); // hour
  g.lineStyle(1, METAL_DARK);
  g.lineBetween(cx, cy, cx - 3, cy - 10); // minute
  // Center dot
  g.fillStyle(0xe74c3c); g.fillCircle(cx, cy, 2);
  g.generateTexture("obj_clock", w, h);
  g.destroy();
}

function generatePlant(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 32, h = 48;
  // Pot
  g.fillStyle(BROWN_POT); g.fillRect(6, 28, 20, 18);
  g.fillStyle(0xa0805a); g.fillRect(6, 28, 20, 3); // rim
  g.fillStyle(0x6b4e2e); g.fillRect(8, 44, 16, 4); // base
  // Soil
  g.fillStyle(0x3e2723); g.fillRect(8, 30, 16, 4);
  // Leaves
  g.fillStyle(GREEN_PLANT);
  g.fillCircle(16, 22, 8);
  g.fillCircle(10, 18, 6);
  g.fillCircle(22, 18, 6);
  g.fillCircle(16, 14, 7);
  g.fillStyle(GREEN_DARK);
  g.fillCircle(14, 20, 4);
  g.fillCircle(18, 16, 4);
  // Stem
  g.fillStyle(GREEN_DARK); g.fillRect(15, 24, 2, 6);
  g.generateTexture("obj_plant", w, h);
  g.destroy();
}

function generatePoster(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 48, h = 48;
  // Frame
  g.fillStyle(FRAME_BROWN); g.fillRect(0, 0, w, h);
  g.fillStyle(WOOD_LIGHT); g.fillRect(2, 2, w - 4, h - 4);
  // Poster content (abstract geometric art)
  g.fillStyle(POSTER_YELLOW); g.fillRect(6, 6, w - 12, h - 12);
  // Geometric shapes
  g.fillStyle(POSTER_RED); g.fillCircle(w / 2, h / 2, 10);
  g.fillStyle(0x2c3e50); g.fillRect(10, 10, 12, 12);
  g.fillStyle(0xecf0f1, 0.6); g.fillRect(28, 28, 10, 10);
  // Border shadow
  g.fillStyle(0x000000, 0.15); g.fillRect(w - 2, 4, 2, h - 4);
  g.fillStyle(0x000000, 0.15); g.fillRect(4, h - 2, w - 4, 2);
  g.generateTexture("obj_poster", w, h);
  g.destroy();
}

function generateDoor(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 48, h = 96;
  // Door frame
  g.fillStyle(WOOD_DARK); g.fillRect(0, 0, w, h);
  // Door body
  g.fillStyle(DOOR_BROWN); g.fillRect(3, 3, w - 6, h - 3);
  g.fillStyle(DOOR_LIGHT); g.fillRect(3, 3, w - 6, 2); // top highlight
  // Panels (2 recessed)
  g.fillStyle(DOOR_DARK);
  g.fillRect(8, 8, w - 16, 32); // upper panel
  g.fillRect(8, 48, w - 16, 36); // lower panel
  g.fillStyle(DOOR_BROWN);
  g.fillRect(10, 10, w - 20, 28);
  g.fillRect(10, 50, w - 20, 32);
  // Panel highlights
  g.fillStyle(DOOR_LIGHT, 0.3);
  g.fillRect(10, 10, w - 20, 2);
  g.fillRect(10, 50, w - 20, 2);
  // Handle
  g.fillStyle(METAL_LIGHT); g.fillRect(w - 14, 44, 4, 8);
  g.fillStyle(0xffd700); g.fillCircle(w - 12, 48, 3); // brass knob
  g.generateTexture("obj_door", w, h);
  g.destroy();
}
