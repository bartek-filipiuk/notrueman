import Phaser from "phaser";
import type { ActivityType } from "@nts/shared";
import { TrumanSprite } from "../entities/TrumanSprite";

/** Activity overlay colors and effects — exported for tests */
export const ACTIVITY_EFFECT_COLORS: Record<ActivityType, number> = {
  sleep: 0x3949ab,
  eat: 0xef6c00,
  read: 0x6a1b9a,
  computer: 0x558b2f,
  exercise: 0x00838f,
  think: 0xfdd835,
  cook: 0xef6c00,
  draw: 0xad1457,
};

/** Transition duration for fade in/out between activities */
export const TRANSITION_DURATION_MS = 400;

/**
 * Renders activity-specific visual effects near Truman.
 * Each activity has a simple 2-3 frame animation cycle with smooth fade transitions.
 */
export class ActivityRenderer {
  private scene: Phaser.Scene;
  private truman: TrumanSprite;
  private activityGfx: Phaser.GameObjects.Graphics;
  private activityTimer?: Phaser.Time.TimerEvent;
  private currentActivity: ActivityType | null = null;
  private frameIndex = 0;
  private effectAlpha = 1;
  private fadeTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, truman: TrumanSprite) {
    this.scene = scene;
    this.truman = truman;
    this.activityGfx = scene.add.graphics();
  }

  /** Start playing an activity animation with fade-in */
  playActivity(type: ActivityType): void {
    this.stopActivity();
    this.currentActivity = type;
    this.frameIndex = 0;
    this.effectAlpha = 0;

    // Fade in the activity effect
    this.fadeTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: TRANSITION_DURATION_MS,
      onUpdate: (tween) => {
        this.effectAlpha = tween.getValue() ?? 0;
      },
    });

    this.activityTimer = this.scene.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => {
        this.frameIndex = (this.frameIndex + 1) % 3;
        this.drawActivityFrame(type, this.frameIndex);
      },
    });

    this.drawActivityFrame(type, 0);
  }

  /** Stop the current activity animation with fade-out */
  stopActivity(): void {
    if (this.fadeTween) {
      this.fadeTween.destroy();
      this.fadeTween = undefined;
    }
    if (this.activityTimer) {
      this.activityTimer.destroy();
      this.activityTimer = undefined;
    }
    this.currentActivity = null;
    this.effectAlpha = 1;
    this.activityGfx.clear();
  }

  /** Draw activity-specific visuals with alpha for transitions */
  private drawActivityFrame(type: ActivityType, frame: number): void {
    this.activityGfx.clear();

    const x = this.truman.x;
    const y = this.truman.y;
    const color = ACTIVITY_EFFECT_COLORS[type];
    const a = this.effectAlpha;

    switch (type) {
      case "sleep":
        this.drawSleep(x, y, frame, a);
        break;
      case "eat":
        this.drawEat(x, y, frame, color, a);
        break;
      case "read":
        this.drawRead(x, y, frame, color, a);
        break;
      case "computer":
        this.drawComputer(x, y, frame, color, a);
        break;
      case "exercise":
        this.drawExercise(x, y, frame, a);
        break;
      case "think":
        this.drawThink(x, y, frame, a);
        break;
      case "cook":
        this.drawCook(x, y, frame, a);
        break;
      case "draw":
        this.drawDraw(x, y, frame, color, a);
        break;
    }
  }

  private drawSleep(x: number, y: number, frame: number, a: number): void {
    // Zzz floating letters with ascending fade
    const offsets = [0, -10, -22];
    const sizes = [5, 7, 9];
    const alphas = [0.8, 0.6, 0.4];
    for (let i = 0; i <= frame; i++) {
      this.activityGfx.fillStyle(0xaaaaff, alphas[i] * a);
      this.activityGfx.fillRect(x + 15 + i * 10, y - 30 + offsets[i], sizes[i], sizes[i]);
    }
    // Subtle glow under Zzz
    this.activityGfx.fillStyle(0x3949ab, 0.15 * a);
    this.activityGfx.fillCircle(x + 20, y - 30, 12);
  }

  private drawEat(x: number, y: number, frame: number, color: number, a: number): void {
    // Plate
    this.activityGfx.fillStyle(0xeeeeee, 0.8 * a);
    this.activityGfx.fillCircle(x + 15, y, 8);
    // Plate rim
    this.activityGfx.lineStyle(1, 0xcccccc, 0.5 * a);
    this.activityGfx.strokeCircle(x + 15, y, 8);
    // Food with animation
    if (frame < 2) {
      this.activityGfx.fillStyle(color, 0.8 * a);
      this.activityGfx.fillRect(x + 12, y - 4, 6, 4);
    }
    // Small steam wisps from hot food
    if (frame === 1) {
      this.activityGfx.fillStyle(0xdddddd, 0.3 * a);
      this.activityGfx.fillCircle(x + 14, y - 8, 2);
    }
  }

  private drawRead(x: number, y: number, frame: number, color: number, a: number): void {
    // Open book with spine
    this.activityGfx.fillStyle(color, 0.7 * a);
    this.activityGfx.fillRect(x + 10, y - 10, 14, 10);
    // Book spine
    this.activityGfx.fillStyle(0x000000, 0.2 * a);
    this.activityGfx.fillRect(x + 16, y - 10, 1, 10);
    // Page lines
    this.activityGfx.fillStyle(0xffffff, 0.5 * a);
    for (let i = 0; i < 3; i++) {
      this.activityGfx.fillRect(x + 12, y - 8 + i * 3, 4, 1);
    }
    // Page turn sparkle on frame 2
    if (frame === 2) {
      this.activityGfx.fillStyle(0xffffcc, 0.6 * a);
      this.activityGfx.fillCircle(x + 22, y - 12, 2);
    }
  }

  private drawComputer(x: number, y: number, frame: number, color: number, a: number): void {
    // Screen glow with pulsing effect
    const glowAlpha = (0.25 + frame * 0.1) * a;
    this.activityGfx.fillStyle(color, glowAlpha);
    this.activityGfx.fillRect(x - 20, y - 30, 40, 25);
    // Scan line effect
    this.activityGfx.fillStyle(0xffffff, 0.08 * a);
    const scanY = y - 28 + (frame * 8);
    this.activityGfx.fillRect(x - 18, scanY, 36, 2);
    // Keyboard glow
    this.activityGfx.fillStyle(color, 0.1 * a);
    this.activityGfx.fillRect(x - 15, y - 3, 30, 4);
  }

  private drawExercise(x: number, y: number, frame: number, a: number): void {
    // Sweat drops with gravity animation
    if (frame >= 1) {
      // Right drop — falling down
      this.activityGfx.fillStyle(0x88ccff, 0.7 * a);
      this.activityGfx.fillCircle(x + 12, y - 20 + frame * 2, 2);
      // Drop trail
      this.activityGfx.fillStyle(0x88ccff, 0.3 * a);
      this.activityGfx.fillCircle(x + 12, y - 22 + frame * 2, 1);
    }
    if (frame >= 2) {
      // Left drop
      this.activityGfx.fillStyle(0x88ccff, 0.6 * a);
      this.activityGfx.fillCircle(x - 10, y - 16, 2);
    }
    // Effort lines near arms
    this.activityGfx.lineStyle(1, 0xffcc88, 0.4 * a);
    if (frame === 0) {
      this.activityGfx.lineBetween(x - 16, y - 8, x - 20, y - 10);
      this.activityGfx.lineBetween(x + 14, y - 8, x + 18, y - 10);
    }
  }

  private drawThink(x: number, y: number, frame: number, a: number): void {
    // Ascending thought dots with size gradient
    for (let i = 0; i <= frame; i++) {
      const dotAlpha = (0.6 - i * 0.15) * a;
      this.activityGfx.fillStyle(0xffffff, dotAlpha);
      this.activityGfx.fillCircle(x + 10 + i * 3, y - 35 - i * 10, 2 + i);
    }
    // Subtle glow at top
    if (frame === 2) {
      this.activityGfx.fillStyle(0xfdd835, 0.12 * a);
      this.activityGfx.fillCircle(x + 16, y - 55, 8);
    }
  }

  private drawCook(x: number, y: number, frame: number, a: number): void {
    // Rising steam particles with varying sizes and fade
    const steamPositions = [
      { dx: -3, dy: -25, r: 3 },
      { dx: 3, dy: -32, r: 4 },
      { dx: -1, dy: -40, r: 3 },
    ];
    for (let i = 0; i <= frame; i++) {
      const p = steamPositions[i];
      const fadeUp = 0.5 - i * 0.12;
      this.activityGfx.fillStyle(0xdddddd, fadeUp * a);
      this.activityGfx.fillCircle(x + p.dx, y + p.dy, p.r);
    }
    // Pan glow
    this.activityGfx.fillStyle(0xff6600, 0.15 * a);
    this.activityGfx.fillCircle(x, y - 18, 6);
  }

  private drawDraw(x: number, y: number, frame: number, color: number, a: number): void {
    // Paint splatters with varied colors
    const colors = [color, 0xff6b6b, 0x48dbfb];
    const positions = [
      { dx: 16, dy: -15, r: 3 },
      { dx: 22, dy: -10, r: 2 },
      { dx: 13, dy: -8, r: 4 },
    ];
    for (let i = 0; i <= frame; i++) {
      this.activityGfx.fillStyle(colors[i % colors.length], 0.6 * a);
      this.activityGfx.fillCircle(x + positions[i].dx, y + positions[i].dy, positions[i].r);
    }
    // Brush stroke line on frame 1+
    if (frame >= 1) {
      this.activityGfx.lineStyle(1, color, 0.4 * a);
      this.activityGfx.lineBetween(x + 14, y - 14, x + 22, y - 9);
    }
  }

  /** Get the current activity being rendered */
  getCurrentActivity(): ActivityType | null {
    return this.currentActivity;
  }

  /** Update graphics position to follow Truman */
  update(): void {
    if (this.currentActivity) {
      this.drawActivityFrame(this.currentActivity, this.frameIndex);
    }
  }
}
