import Phaser from "phaser";
import type { ActivityType } from "@nts/shared";
import { TrumanSprite } from "../entities/TrumanSprite";
import { ParticleManager } from "./ParticleManager";

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

/** Activities that use Phaser particle emitters instead of Graphics API */
export const PARTICLE_ACTIVITIES: ReadonlySet<ActivityType> = new Set([
  "cook",
  "computer",
  "sleep",
  "exercise",
  "read",
  "draw",
]);

/** Transition duration for fade in/out between activities */
export const TRANSITION_DURATION_MS = 400;

/**
 * Renders activity-specific visual effects near Truman.
 * Uses Phaser Particle Emitters for cook, computer, sleep, exercise, read, draw.
 * Keeps Graphics API for eat and think (which have static prop visuals).
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
  private particles: ParticleManager;

  constructor(scene: Phaser.Scene, truman: TrumanSprite) {
    this.scene = scene;
    this.truman = truman;
    this.activityGfx = scene.add.graphics();
    this.particles = new ParticleManager(scene);
  }

  /** Start playing an activity animation with fade-in */
  playActivity(type: ActivityType): void {
    this.stopActivity();
    this.currentActivity = type;
    this.frameIndex = 0;
    this.effectAlpha = 0;

    // Fade in the activity effect (for Graphics-based effects)
    this.fadeTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: TRANSITION_DURATION_MS,
      onUpdate: (tween) => {
        this.effectAlpha = tween.getValue() ?? 0;
      },
    });

    // Start particle emitter for particle-based activities
    if (PARTICLE_ACTIVITIES.has(type)) {
      this.particles.startEffect(type, this.truman.x, this.truman.y);
    }

    // Timer for frame-based animations (Graphics API effects)
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
    this.particles.stopAll();
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
        // Particles handle Zzz — keep subtle glow via Graphics
        this.drawSleepGlow(x, y, a);
        break;
      case "eat":
        this.drawEat(x, y, frame, color, a);
        break;
      case "read":
        // Particles handle golden dust — keep book graphic
        this.drawReadBook(x, y, frame, color, a);
        break;
      case "computer":
        // Particles handle sparks — keep screen glow + scan line
        this.drawComputerGlow(x, y, frame, color, a);
        break;
      case "exercise":
        // Particles handle sweat drops — keep effort lines
        this.drawExerciseLines(x, y, frame, a);
        break;
      case "think":
        this.drawThink(x, y, frame, a);
        break;
      case "cook":
        // Particles handle steam — keep pan glow
        this.drawCookGlow(x, y, a);
        break;
      case "draw":
        // Particles handle paint splatter — keep brush stroke
        this.drawDrawStroke(x, y, frame, color, a);
        break;
    }
  }

  /** Subtle glow underneath Zzz particles */
  private drawSleepGlow(x: number, y: number, a: number): void {
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

  /** Book graphic (particles handle the golden dust sparkles) */
  private drawReadBook(x: number, y: number, frame: number, color: number, a: number): void {
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
  }

  /** Screen glow + scan line (particles handle green/blue sparks) */
  private drawComputerGlow(x: number, y: number, frame: number, color: number, a: number): void {
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

  /** Effort lines near arms (particles handle sweat drops) */
  private drawExerciseLines(x: number, y: number, frame: number, a: number): void {
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

  /** Pan glow (particles handle rising steam) */
  private drawCookGlow(x: number, y: number, a: number): void {
    this.activityGfx.fillStyle(0xff6600, 0.15 * a);
    this.activityGfx.fillCircle(x, y - 18, 6);
  }

  /** Brush stroke line (particles handle paint splatters) */
  private drawDrawStroke(x: number, y: number, frame: number, color: number, a: number): void {
    if (frame >= 1) {
      this.activityGfx.lineStyle(1, color, 0.4 * a);
      this.activityGfx.lineBetween(x + 14, y - 14, x + 22, y - 9);
    }
  }

  /** Get the current activity being rendered */
  getCurrentActivity(): ActivityType | null {
    return this.currentActivity;
  }

  /** Update graphics position to follow Truman + particle positions */
  update(): void {
    if (this.currentActivity) {
      this.drawActivityFrame(this.currentActivity, this.frameIndex);
      if (PARTICLE_ACTIVITIES.has(this.currentActivity)) {
        this.particles.updatePosition(this.truman.x, this.truman.y);
      }
    }
  }
}
