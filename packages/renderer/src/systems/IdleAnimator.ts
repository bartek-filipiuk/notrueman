import Phaser from "phaser";
import { TrumanSprite } from "../entities/TrumanSprite";

/**
 * Idle micro-animations: looking around only.
 * Scale-based animations (breathing, blinking) removed — they conflict
 * with sprite-level scaling in the new frame animation system.
 */
export class IdleAnimator {
  private scene: Phaser.Scene;
  private truman: TrumanSprite;
  private active = false;
  private lookTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, truman: TrumanSprite) {
    this.scene = scene;
    this.truman = truman;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.scheduleLook();
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.lookTimer?.destroy();
    this.lookTimer = null;
  }

  private scheduleLook(): void {
    const delay = 12000 + Math.random() * 8000;
    this.lookTimer = this.scene.time.delayedCall(delay, () => {
      if (!this.active) return;
      const original = this.truman.getFacing();
      const opposite = original === "left" ? "right" : "left";
      this.truman.setFacing(opposite);
      this.scene.time.delayedCall(400, () => {
        if (this.active) this.truman.setFacing(original);
      });
      this.scheduleLook();
    });
  }
}
