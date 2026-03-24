import Phaser from "phaser";

const SPRITE_WIDTH = 32;
const SPRITE_HEIGHT = 48;
const SCALE = 1;

/** Drop shadow opacity — exported for tests */
export const SHADOW_ALPHA = 0.25;

/**
 * Truman placeholder sprite — simple pixel humanoid drawn with graphics.
 * Uses a container with body/head graphics that can be animated.
 * Includes a subtle drop shadow for visual depth.
 */
export class TrumanSprite extends Phaser.GameObjects.Container {
  private gfx: Phaser.GameObjects.Graphics;
  private facing: "left" | "right" = "right";
  private animTimer?: Phaser.Time.TimerEvent;
  private currentAnim: string = "idle";
  private frameIndex = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    this.setSize(SPRITE_WIDTH * SCALE, SPRITE_HEIGHT * SCALE);

    scene.add.existing(this as Phaser.GameObjects.GameObject);

    this.drawFrame(0);
    this.playIdle();
  }

  /** Draw the pixel humanoid at a given frame offset */
  private drawFrame(yOffset: number): void {
    this.gfx.clear();

    // Drop shadow (ellipse under feet)
    this.gfx.fillStyle(0x000000, SHADOW_ALPHA);
    this.gfx.fillEllipse(0, 24, 20, 6);

    // Body (shirt - blue)
    this.gfx.fillStyle(0x4a90d9, 1);
    this.gfx.fillRect(-8, -8 + yOffset, 16, 18);

    // Shirt detail (collar)
    this.gfx.fillStyle(0x3a7bc8, 1);
    this.gfx.fillRect(-6, -8 + yOffset, 12, 3);

    // Legs (dark)
    this.gfx.fillStyle(0x333366, 1);
    this.gfx.fillRect(-7, 10 + yOffset, 6, 14);
    this.gfx.fillRect(1, 10 + yOffset, 6, 14);

    // Shoes (darker)
    this.gfx.fillStyle(0x222244, 1);
    this.gfx.fillRect(-7, 21 + yOffset, 6, 3);
    this.gfx.fillRect(1, 21 + yOffset, 6, 3);

    // Head (skin)
    this.gfx.fillStyle(0xffcc99, 1);
    this.gfx.fillRect(-6, -22 + yOffset, 12, 14);

    // Hair (brown)
    this.gfx.fillStyle(0x8b4513, 1);
    this.gfx.fillRect(-7, -24 + yOffset, 14, 6);

    // Eyes
    this.gfx.fillStyle(0x222222, 1);
    if (this.facing === "right") {
      this.gfx.fillRect(-2, -17 + yOffset, 2, 2);
      this.gfx.fillRect(3, -17 + yOffset, 2, 2);
    } else {
      this.gfx.fillRect(-5, -17 + yOffset, 2, 2);
      this.gfx.fillRect(0, -17 + yOffset, 2, 2);
    }

    // Mouth (subtle smile)
    this.gfx.fillStyle(0xcc9977, 1);
    this.gfx.fillRect(-1, -13 + yOffset, 3, 1);

    // Arms
    this.gfx.fillStyle(0xffcc99, 1);
    this.gfx.fillRect(-12, -6 + yOffset, 4, 12);
    this.gfx.fillRect(8, -6 + yOffset, 4, 12);
  }

  /** Play idle animation (gentle bob) */
  playIdle(): void {
    this.stopAnim();
    this.currentAnim = "idle";
    this.frameIndex = 0;

    this.animTimer = this.scene.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        this.frameIndex = (this.frameIndex + 1) % 3;
        const yOffset = this.frameIndex === 1 ? -1 : 0;
        this.drawFrame(yOffset);
      },
    });
  }

  /** Play walk animation (leg movement + bob) */
  playWalk(direction: "left" | "right"): void {
    this.stopAnim();
    this.facing = direction;
    this.currentAnim = "walk";
    this.frameIndex = 0;

    this.animTimer = this.scene.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => {
        this.frameIndex = (this.frameIndex + 1) % 4;
        const yOffset = this.frameIndex % 2 === 0 ? 0 : -2;
        this.drawFrame(yOffset);
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
    this.drawFrame(0);
  }
}
