import Phaser from "phaser";

const SPRITE_WIDTH = 32;
const SPRITE_HEIGHT = 48;

/** Drop shadow opacity — exported for tests */
export const SHADOW_ALPHA = 0.25;

// Truman palette
const SKIN = 0xffcc99;
const SKIN_SHADOW = 0xe6b380;
const HAIR = 0x6b3a1f;
const HAIR_HIGHLIGHT = 0x8b5a3f;
const SHIRT = 0x4a90d9;
const SHIRT_DARK = 0x3570b0;
const SHIRT_COLLAR = 0x3a7bc8;
const PANTS = 0x34495e;
const PANTS_DARK = 0x2c3e50;
const SHOES = 0x2c2c44;
const EYE_WHITE = 0xffffff;
const EYE_PUPIL = 0x1a1a2e;
const MOUTH = 0xcc8866;
const BLUSH = 0xffaa88;

// Mood eye styles
const MOOD_EYES: Record<string, { brow: number; mouthW: number; mouthH: number; blush: boolean }> = {
  happy:         { brow: 0,  mouthW: 4, mouthH: 2, blush: true },
  curious:       { brow: -1, mouthW: 2, mouthH: 1, blush: false },
  anxious:       { brow: 1,  mouthW: 3, mouthH: 1, blush: false },
  excited:       { brow: -1, mouthW: 5, mouthH: 2, blush: true },
  frustrated:    { brow: 2,  mouthW: 3, mouthH: 1, blush: false },
  content:       { brow: 0,  mouthW: 3, mouthH: 1, blush: false },
  contemplative: { brow: 0,  mouthW: 2, mouthH: 1, blush: false },
  bored:         { brow: 1,  mouthW: 4, mouthH: 1, blush: false },
  neutral:       { brow: 0,  mouthW: 3, mouthH: 1, blush: false },
};

/**
 * Truman pixel art sprite — head-heavy proportions for readability.
 * Drawn with Graphics API. Supports mood-based facial expressions.
 * Head is ~40% of total height for that charming pixel art look.
 */
export class TrumanSprite extends Phaser.GameObjects.Container {
  private gfx: Phaser.GameObjects.Graphics;
  private facing: "left" | "right" = "right";
  private animTimer?: Phaser.Time.TimerEvent;
  private currentAnim: string = "idle";
  private frameIndex = 0;
  private currentMood: string = "neutral";

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    this.setSize(SPRITE_WIDTH, SPRITE_HEIGHT);

    scene.add.existing(this as Phaser.GameObjects.GameObject);

    this.drawFrame(0, 0);
    this.playIdle();
  }

  /** Set mood for facial expression */
  setMood(mood: string): void {
    this.currentMood = mood;
    this.drawFrame(0, 0);
  }

  /** Draw the full character at given offsets */
  private drawFrame(yOffset: number, legFrame: number): void {
    this.gfx.clear();
    const f = this.facing;
    const mood = MOOD_EYES[this.currentMood] || MOOD_EYES.neutral;
    const fDir = f === "right" ? 1 : -1;

    // Drop shadow
    this.gfx.fillStyle(0x000000, SHADOW_ALPHA);
    this.gfx.fillEllipse(0, 24, 22, 6);

    // === LEGS ===
    const legSpread = legFrame % 2 === 0 ? 0 : 2;
    // Left leg
    this.gfx.fillStyle(PANTS);
    this.gfx.fillRect(-6, 8 + yOffset, 5, 12 + legSpread);
    this.gfx.fillStyle(PANTS_DARK);
    this.gfx.fillRect(-6, 8 + yOffset, 1, 12 + legSpread);
    // Right leg
    this.gfx.fillStyle(PANTS);
    this.gfx.fillRect(1, 8 + yOffset, 5, 12 - legSpread);
    this.gfx.fillStyle(PANTS_DARK);
    this.gfx.fillRect(5, 8 + yOffset, 1, 12 - legSpread);

    // Shoes
    this.gfx.fillStyle(SHOES);
    this.gfx.fillRect(-7, 19 + yOffset + legSpread, 6, 4);
    this.gfx.fillRect(1, 19 + yOffset - legSpread + 2, 6, 4);
    // Shoe highlight
    this.gfx.fillStyle(0x3d3d5c);
    this.gfx.fillRect(-7, 19 + yOffset + legSpread, 6, 1);
    this.gfx.fillRect(1, 19 + yOffset - legSpread + 2, 6, 1);

    // === BODY (shirt) ===
    this.gfx.fillStyle(SHIRT);
    this.gfx.fillRect(-8, -6 + yOffset, 16, 15);
    // Shirt shading
    this.gfx.fillStyle(SHIRT_DARK);
    this.gfx.fillRect(-8, -6 + yOffset, 2, 15); // left edge shadow
    this.gfx.fillRect(6, -6 + yOffset, 2, 15);  // right edge shadow
    // Collar
    this.gfx.fillStyle(SHIRT_COLLAR);
    this.gfx.fillRect(-5, -6 + yOffset, 10, 3);
    // Shirt button
    this.gfx.fillStyle(EYE_WHITE, 0.5);
    this.gfx.fillRect(0, 0 + yOffset, 1, 1);
    this.gfx.fillRect(0, 3 + yOffset, 1, 1);

    // === ARMS ===
    // Back arm
    this.gfx.fillStyle(SHIRT_DARK);
    this.gfx.fillRect(f === "right" ? -11 : 7, -4 + yOffset, 4, 10);
    this.gfx.fillStyle(SKIN_SHADOW);
    this.gfx.fillRect(f === "right" ? -11 : 7, 6 + yOffset, 4, 4);
    // Front arm
    this.gfx.fillStyle(SHIRT);
    this.gfx.fillRect(f === "right" ? 7 : -11, -4 + yOffset, 4, 10);
    this.gfx.fillStyle(SKIN);
    this.gfx.fillRect(f === "right" ? 7 : -11, 6 + yOffset, 4, 4);

    // === HEAD ===
    // Head base (larger for head-heavy proportions)
    this.gfx.fillStyle(SKIN);
    this.gfx.fillRect(-7, -22 + yOffset, 14, 16);
    // Face shadow (chin/neck)
    this.gfx.fillStyle(SKIN_SHADOW);
    this.gfx.fillRect(-5, -8 + yOffset, 10, 2);
    // Ear (on facing side)
    this.gfx.fillStyle(SKIN_SHADOW);
    this.gfx.fillRect(f === "right" ? 6 : -7, -17 + yOffset, 2, 4);

    // === HAIR ===
    this.gfx.fillStyle(HAIR);
    this.gfx.fillRect(-8, -25 + yOffset, 16, 7);
    // Side hair
    this.gfx.fillRect(f === "right" ? -8 : 6, -22 + yOffset, 2, 6);
    this.gfx.fillRect(f === "right" ? 6 : -8, -22 + yOffset, 2, 4);
    // Hair highlight
    this.gfx.fillStyle(HAIR_HIGHLIGHT);
    this.gfx.fillRect(-4, -25 + yOffset, 6, 2);
    // Fringe detail
    this.gfx.fillStyle(HAIR);
    this.gfx.fillRect(-6 + fDir * 2, -19 + yOffset, 4, 2);

    // === FACE ===
    // Eye whites
    const eyeBaseX = f === "right" ? -3 : -4;
    this.gfx.fillStyle(EYE_WHITE);
    this.gfx.fillRect(eyeBaseX, -18 + yOffset + mood.brow, 3, 3);
    this.gfx.fillRect(eyeBaseX + 5, -18 + yOffset + mood.brow, 3, 3);
    // Pupils
    this.gfx.fillStyle(EYE_PUPIL);
    this.gfx.fillRect(eyeBaseX + (f === "right" ? 1 : 0), -17 + yOffset + mood.brow, 2, 2);
    this.gfx.fillRect(eyeBaseX + 5 + (f === "right" ? 1 : 0), -17 + yOffset + mood.brow, 2, 2);
    // Eyebrows (mood-based position)
    this.gfx.fillStyle(HAIR);
    this.gfx.fillRect(eyeBaseX - 1, -20 + yOffset + mood.brow, 4, 1);
    this.gfx.fillRect(eyeBaseX + 4, -20 + yOffset + mood.brow, 4, 1);

    // Mouth
    this.gfx.fillStyle(MOUTH);
    const mouthX = -Math.floor(mood.mouthW / 2);
    this.gfx.fillRect(mouthX, -12 + yOffset, mood.mouthW, mood.mouthH);

    // Blush (happy/excited)
    if (mood.blush) {
      this.gfx.fillStyle(BLUSH, 0.3);
      this.gfx.fillRect(-6, -14 + yOffset, 3, 2);
      this.gfx.fillRect(3, -14 + yOffset, 3, 2);
    }

    // Nose (tiny)
    this.gfx.fillStyle(SKIN_SHADOW);
    this.gfx.fillRect(fDir > 0 ? 1 : -2, -14 + yOffset, 1, 2);
  }

  /** Play idle animation (gentle bob + blink) */
  playIdle(): void {
    this.stopAnim();
    this.currentAnim = "idle";
    this.frameIndex = 0;

    this.animTimer = this.scene.time.addEvent({
      delay: 600,
      loop: true,
      callback: () => {
        this.frameIndex = (this.frameIndex + 1) % 4;
        // Subtle breathing bob
        const yOffset = this.frameIndex === 1 || this.frameIndex === 2 ? -1 : 0;
        this.drawFrame(yOffset, 0);
      },
    });
  }

  /** Play walk animation (leg swing + bob) */
  playWalk(direction: "left" | "right"): void {
    this.stopAnim();
    this.facing = direction;
    this.currentAnim = "walk";
    this.frameIndex = 0;

    this.animTimer = this.scene.time.addEvent({
      delay: 140,
      loop: true,
      callback: () => {
        this.frameIndex = (this.frameIndex + 1) % 6;
        const yOffset = this.frameIndex % 3 === 0 ? 0 : -1;
        this.drawFrame(yOffset, this.frameIndex);
      },
    });
  }

  /** Stop current animation */
  stopAnim(): void {
    if (this.animTimer) {
      this.animTimer.destroy();
      this.animTimer = undefined;
    }
  }

  /** Get the current animation name */
  getCurrentAnim(): string {
    return this.currentAnim;
  }

  /** Get facing direction */
  getFacing(): "left" | "right" {
    return this.facing;
  }

  /** Set facing direction */
  setFacing(dir: "left" | "right"): void {
    this.facing = dir;
    this.drawFrame(0, 0);
  }
}
