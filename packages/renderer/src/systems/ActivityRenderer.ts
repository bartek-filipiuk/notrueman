import Phaser from "phaser";
import type { ActivityType } from "@nts/shared";
import { TrumanSprite } from "../entities/TrumanSprite";

/** Activity overlay colors and effects */
const ACTIVITY_COLORS: Record<ActivityType, number> = {
  sleep: 0x3949ab,
  eat: 0xef6c00,
  read: 0x6a1b9a,
  computer: 0x558b2f,
  exercise: 0x00838f,
  think: 0xfdd835,
  cook: 0xef6c00,
  draw: 0xad1457,
};

/**
 * Renders activity-specific visual effects near Truman.
 * Each activity has a simple 2-3 frame animation cycle.
 */
export class ActivityRenderer {
  private scene: Phaser.Scene;
  private truman: TrumanSprite;
  private activityGfx: Phaser.GameObjects.Graphics;
  private activityTimer?: Phaser.Time.TimerEvent;
  private currentActivity: ActivityType | null = null;
  private frameIndex = 0;

  constructor(scene: Phaser.Scene, truman: TrumanSprite) {
    this.scene = scene;
    this.truman = truman;
    this.activityGfx = scene.add.graphics();
  }

  /** Start playing an activity animation */
  playActivity(type: ActivityType): void {
    this.stopActivity();
    this.currentActivity = type;
    this.frameIndex = 0;

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

  /** Stop the current activity animation */
  stopActivity(): void {
    if (this.activityTimer) {
      this.activityTimer.destroy();
      this.activityTimer = undefined;
    }
    this.currentActivity = null;
    this.activityGfx.clear();
  }

  /** Draw activity-specific visuals */
  private drawActivityFrame(type: ActivityType, frame: number): void {
    this.activityGfx.clear();

    const x = this.truman.x;
    const y = this.truman.y;
    const color = ACTIVITY_COLORS[type];

    switch (type) {
      case "sleep":
        this.drawSleep(x, y, frame);
        break;
      case "eat":
        this.drawEat(x, y, frame, color);
        break;
      case "read":
        this.drawRead(x, y, frame, color);
        break;
      case "computer":
        this.drawComputer(x, y, frame, color);
        break;
      case "exercise":
        this.drawExercise(x, y, frame, color);
        break;
      case "think":
        this.drawThink(x, y, frame, color);
        break;
      case "cook":
        this.drawCook(x, y, frame, color);
        break;
      case "draw":
        this.drawDraw(x, y, frame, color);
        break;
    }
  }

  private drawSleep(x: number, y: number, frame: number): void {
    // Zzz floating letters
    this.activityGfx.fillStyle(0xaaaaff, 0.7);
    const offsets = [0, -8, -16];
    const sizes = [6, 8, 10];
    for (let i = 0; i <= frame; i++) {
      this.activityGfx.fillRect(x + 15 + i * 8, y - 30 + offsets[i], sizes[i], sizes[i]);
    }
  }

  private drawEat(x: number, y: number, frame: number, color: number): void {
    // Plate with food, arm motion
    this.activityGfx.fillStyle(0xeeeeee, 0.8);
    this.activityGfx.fillCircle(x + 15, y, 8); // plate
    this.activityGfx.fillStyle(color, 0.8);
    if (frame < 2) {
      this.activityGfx.fillRect(x + 12, y - 4, 6, 4); // food
    }
  }

  private drawRead(x: number, y: number, frame: number, color: number): void {
    // Open book
    this.activityGfx.fillStyle(color, 0.7);
    this.activityGfx.fillRect(x + 10, y - 10, 14, 10); // book
    this.activityGfx.fillStyle(0xffffff, 0.5);
    // Page lines
    for (let i = 0; i < 3; i++) {
      this.activityGfx.fillRect(x + 12, y - 8 + i * 3, 10, 1);
    }
  }

  private drawComputer(x: number, y: number, frame: number, color: number): void {
    // Screen glow effect
    this.activityGfx.fillStyle(color, 0.3 + frame * 0.1);
    this.activityGfx.fillRect(x - 20, y - 30, 40, 25);
  }

  private drawExercise(x: number, y: number, frame: number, color: number): void {
    // Sweat drops
    this.activityGfx.fillStyle(0x88ccff, 0.7);
    if (frame >= 1) {
      this.activityGfx.fillCircle(x + 12, y - 20, 2);
    }
    if (frame >= 2) {
      this.activityGfx.fillCircle(x - 10, y - 18, 2);
    }
  }

  private drawThink(x: number, y: number, frame: number, color: number): void {
    // Small thought dots leading up
    this.activityGfx.fillStyle(0xffffff, 0.5);
    for (let i = 0; i <= frame; i++) {
      this.activityGfx.fillCircle(x + 10, y - 35 - i * 10, 2 + i);
    }
  }

  private drawCook(x: number, y: number, frame: number, color: number): void {
    // Steam particles
    this.activityGfx.fillStyle(0xcccccc, 0.4 + frame * 0.1);
    for (let i = 0; i <= frame; i++) {
      this.activityGfx.fillCircle(x + (i - 1) * 6, y - 25 - i * 5, 3);
    }
  }

  private drawDraw(x: number, y: number, frame: number, color: number): void {
    // Paint splatter
    this.activityGfx.fillStyle(color, 0.6);
    if (frame >= 0) this.activityGfx.fillCircle(x + 16, y - 15, 3);
    if (frame >= 1) this.activityGfx.fillCircle(x + 20, y - 10, 2);
    if (frame >= 2) this.activityGfx.fillCircle(x + 14, y - 8, 4);
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
