import Phaser from "phaser";
import { getVisualConfig } from "../config/VisualConfig";

const SPRITE_WIDTH = 32;
const SPRITE_HEIGHT = 48;
// Extra padding for glow FX overflow
const PAD = 8;
const TEX_W = SPRITE_WIDTH + PAD * 2;
const TEX_H = SPRITE_HEIGHT + PAD * 2;

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
 * Truman pixel art sprite using RenderTexture for WebGL FX support.
 * Container holds: RenderTexture (character with glow PreFX) + shadow ellipse.
 * Head-heavy proportions (~40% head) for pixel art charm.
 */
export class TrumanSprite extends Phaser.GameObjects.Container {
  private rt: Phaser.GameObjects.RenderTexture;
  private pngSprite: Phaser.GameObjects.Image | null = null;
  private shadow: Phaser.GameObjects.Ellipse;
  private facing: "left" | "right" = "right";
  private animTimer?: Phaser.Time.TimerEvent;
  private currentAnim: string = "idle";
  private frameIndex = 0;
  private currentMood: string = "neutral";
  private usePNG = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    // Shadow ellipse (below character)
    this.shadow = scene.add.ellipse(0, 24, 22, 6, 0x000000, SHADOW_ALPHA);
    this.add(this.shadow);

    // Check if AI-generated PNG sprites are available
    this.usePNG = scene.textures.exists("truman_idle");

    if (this.usePNG) {
      // Use AI-generated PNG sprite (mood-switchable)
      this.pngSprite = scene.add.image(0, -4, "truman_idle");
      this.pngSprite.setDisplaySize(SPRITE_WIDTH + 8, SPRITE_HEIGHT + 8);
      this.add(this.pngSprite);

      // Apply glow to PNG sprite
      try {
        const fxConfig = getVisualConfig();
        if (fxConfig.trumanGlow && this.pngSprite.preFX) {
          this.pngSprite.preFX.addGlow(0xffffff, 1, 0, false, 0.1, 4);
        }
      } catch { /* skip */ }

      // RenderTexture hidden but kept for compatibility
      this.rt = scene.add.renderTexture(0, 0, 1, 1);
      this.rt.setVisible(false);
    } else {
      // Fallback: programmatic RenderTexture
      this.rt = scene.add.renderTexture(0, 0, TEX_W, TEX_H);
      this.rt.setOrigin(0.5, 0.5);
      this.add(this.rt);

      try {
        const fxConfig = getVisualConfig();
        if (fxConfig.trumanGlow && this.rt.preFX) {
          this.rt.preFX.addGlow(0xffffff, 1, 0, false, 0.1, 4);
        }
      } catch { /* skip */ }
    }

    this.setSize(SPRITE_WIDTH, SPRITE_HEIGHT);
    scene.add.existing(this as Phaser.GameObjects.GameObject);

    this.renderFrame(0, 0);
    this.playIdle();
  }

  setMood(mood: string): void {
    this.currentMood = mood;

    if (this.usePNG && this.pngSprite) {
      // Switch PNG texture based on mood
      const moodKey = mood === "neutral" ? "truman_idle" : `truman_mood_${mood}`;
      if (this.scene.textures.exists(moodKey)) {
        this.pngSprite.setTexture(moodKey);
      } else {
        this.pngSprite.setTexture("truman_idle");
      }
      // Flip for facing direction
      this.pngSprite.setFlipX(this.facing === "left");
    } else {
      this.renderFrame(0, 0);
    }
  }

  /** Render character to RenderTexture using offscreen Graphics */
  private renderFrame(yOffset: number, legFrame: number): void {
    const gfx = this.scene.make.graphics({ add: false });
    // Draw centered in texture (offset by PAD + half sprite)
    const cx = TEX_W / 2;
    const cy = TEX_H / 2;
    this.drawCharacter(gfx, cx, cy, yOffset, legFrame);

    this.rt.clear();
    this.rt.draw(gfx, 0, 0);
    gfx.destroy();
  }

  /** Draw the pixel character at (cx, cy) offset */
  private drawCharacter(g: Phaser.GameObjects.Graphics, cx: number, cy: number, yOffset: number, legFrame: number): void {
    const f = this.facing;
    const mood = MOOD_EYES[this.currentMood] || MOOD_EYES.neutral;
    const fDir = f === "right" ? 1 : -1;

    // === LEGS ===
    const legSpread = legFrame % 2 === 0 ? 0 : 2;
    g.fillStyle(PANTS);
    g.fillRect(cx - 6, cy + 8 + yOffset, 5, 12 + legSpread);
    g.fillStyle(PANTS_DARK);
    g.fillRect(cx - 6, cy + 8 + yOffset, 1, 12 + legSpread);
    g.fillStyle(PANTS);
    g.fillRect(cx + 1, cy + 8 + yOffset, 5, 12 - legSpread);
    g.fillStyle(PANTS_DARK);
    g.fillRect(cx + 5, cy + 8 + yOffset, 1, 12 - legSpread);

    // Shoes
    g.fillStyle(SHOES);
    g.fillRect(cx - 7, cy + 19 + yOffset + legSpread, 6, 4);
    g.fillRect(cx + 1, cy + 19 + yOffset - legSpread + 2, 6, 4);
    g.fillStyle(0x3d3d5c);
    g.fillRect(cx - 7, cy + 19 + yOffset + legSpread, 6, 1);
    g.fillRect(cx + 1, cy + 19 + yOffset - legSpread + 2, 6, 1);

    // === BODY ===
    g.fillStyle(SHIRT);
    g.fillRect(cx - 8, cy - 6 + yOffset, 16, 15);
    g.fillStyle(SHIRT_DARK);
    g.fillRect(cx - 8, cy - 6 + yOffset, 2, 15);
    g.fillRect(cx + 6, cy - 6 + yOffset, 2, 15);
    g.fillStyle(SHIRT_COLLAR);
    g.fillRect(cx - 5, cy - 6 + yOffset, 10, 3);
    g.fillStyle(EYE_WHITE, 0.5);
    g.fillRect(cx, cy + yOffset, 1, 1);
    g.fillRect(cx, cy + 3 + yOffset, 1, 1);

    // === ARMS ===
    g.fillStyle(SHIRT_DARK);
    g.fillRect(f === "right" ? cx - 11 : cx + 7, cy - 4 + yOffset, 4, 10);
    g.fillStyle(SKIN_SHADOW);
    g.fillRect(f === "right" ? cx - 11 : cx + 7, cy + 6 + yOffset, 4, 4);
    g.fillStyle(SHIRT);
    g.fillRect(f === "right" ? cx + 7 : cx - 11, cy - 4 + yOffset, 4, 10);
    g.fillStyle(SKIN);
    g.fillRect(f === "right" ? cx + 7 : cx - 11, cy + 6 + yOffset, 4, 4);

    // === HEAD ===
    g.fillStyle(SKIN);
    g.fillRect(cx - 7, cy - 22 + yOffset, 14, 16);
    g.fillStyle(SKIN_SHADOW);
    g.fillRect(cx - 5, cy - 8 + yOffset, 10, 2);
    g.fillStyle(SKIN_SHADOW);
    g.fillRect(f === "right" ? cx + 6 : cx - 7, cy - 17 + yOffset, 2, 4);

    // === HAIR ===
    g.fillStyle(HAIR);
    g.fillRect(cx - 8, cy - 25 + yOffset, 16, 7);
    g.fillRect(f === "right" ? cx - 8 : cx + 6, cy - 22 + yOffset, 2, 6);
    g.fillRect(f === "right" ? cx + 6 : cx - 8, cy - 22 + yOffset, 2, 4);
    g.fillStyle(HAIR_HIGHLIGHT);
    g.fillRect(cx - 4, cy - 25 + yOffset, 6, 2);
    g.fillStyle(HAIR);
    g.fillRect(cx - 6 + fDir * 2, cy - 19 + yOffset, 4, 2);

    // === FACE ===
    const eyeBaseX = f === "right" ? cx - 3 : cx - 4;
    g.fillStyle(EYE_WHITE);
    g.fillRect(eyeBaseX, cy - 18 + yOffset + mood.brow, 3, 3);
    g.fillRect(eyeBaseX + 5, cy - 18 + yOffset + mood.brow, 3, 3);
    g.fillStyle(EYE_PUPIL);
    g.fillRect(eyeBaseX + (f === "right" ? 1 : 0), cy - 17 + yOffset + mood.brow, 2, 2);
    g.fillRect(eyeBaseX + 5 + (f === "right" ? 1 : 0), cy - 17 + yOffset + mood.brow, 2, 2);
    g.fillStyle(HAIR);
    g.fillRect(eyeBaseX - 1, cy - 20 + yOffset + mood.brow, 4, 1);
    g.fillRect(eyeBaseX + 4, cy - 20 + yOffset + mood.brow, 4, 1);

    // Mouth
    g.fillStyle(MOUTH);
    const mouthX = cx - Math.floor(mood.mouthW / 2);
    g.fillRect(mouthX, cy - 12 + yOffset, mood.mouthW, mood.mouthH);

    // Blush
    if (mood.blush) {
      g.fillStyle(BLUSH, 0.3);
      g.fillRect(cx - 6, cy - 14 + yOffset, 3, 2);
      g.fillRect(cx + 3, cy - 14 + yOffset, 3, 2);
    }

    // Nose
    g.fillStyle(SKIN_SHADOW);
    g.fillRect(cx + (fDir > 0 ? 1 : -2), cy - 14 + yOffset, 1, 2);
  }

  playIdle(): void {
    this.stopAnim();
    this.currentAnim = "idle";
    this.frameIndex = 0;

    if (this.usePNG && this.pngSprite) {
      // PNG mode: gentle bob animation on the sprite
      this.animTimer = this.scene.time.addEvent({
        delay: 600,
        loop: true,
        callback: () => {
          this.frameIndex = (this.frameIndex + 1) % 4;
          const yOff = this.frameIndex === 1 || this.frameIndex === 2 ? -1 : 0;
          this.pngSprite!.setY(-4 + yOff);
        },
      });
    } else {
      this.animTimer = this.scene.time.addEvent({
        delay: 600,
        loop: true,
        callback: () => {
          this.frameIndex = (this.frameIndex + 1) % 4;
          const yOffset = this.frameIndex === 1 || this.frameIndex === 2 ? -1 : 0;
          this.renderFrame(yOffset, 0);
        },
      });
    }
  }

  playWalk(direction: "left" | "right"): void {
    this.stopAnim();
    this.facing = direction;
    this.currentAnim = "walk";
    this.frameIndex = 0;

    if (this.usePNG && this.pngSprite) {
      this.pngSprite.setFlipX(direction === "left");
      // PNG mode: bob + slight tilt for walk feel
      this.animTimer = this.scene.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => {
          this.frameIndex = (this.frameIndex + 1) % 6;
          const yOff = this.frameIndex % 3 === 0 ? 0 : -1;
          this.pngSprite!.setY(-4 + yOff);
        },
      });
    } else {
      this.animTimer = this.scene.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => {
          this.frameIndex = (this.frameIndex + 1) % 6;
          const yOffset = this.frameIndex % 3 === 0 ? 0 : -1;
          this.renderFrame(yOffset, this.frameIndex);
        },
      });
    }
  }

  stopAnim(): void {
    if (this.animTimer) {
      this.animTimer.destroy();
      this.animTimer = undefined;
    }
  }

  getCurrentAnim(): string {
    return this.currentAnim;
  }

  getFacing(): "left" | "right" {
    return this.facing;
  }

  setFacing(dir: "left" | "right"): void {
    this.facing = dir;
    if (this.usePNG && this.pngSprite) {
      this.pngSprite.setFlipX(dir === "left");
    } else {
      this.renderFrame(0, 0);
    }
  }
}
