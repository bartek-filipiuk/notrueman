import Phaser from "phaser";
import { TrumanSprite } from "../entities/TrumanSprite";

/**
 * Idle micro-animations: breathing, blinking, looking around, sighing.
 * Makes Truman feel alive even when standing still.
 * All animations are subtle scale/position tweens — no extra sprite frames needed.
 */
export class IdleAnimator {
  private scene: Phaser.Scene;
  private truman: TrumanSprite;
  private active = false;

  private breathTween: Phaser.Tweens.Tween | null = null;
  private blinkTimer: Phaser.Time.TimerEvent | null = null;
  private lookTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, truman: TrumanSprite) {
    this.scene = scene;
    this.truman = truman;
  }

  /** Start idle animations (call when Truman enters idle state) */
  start(): void {
    if (this.active) return;
    this.active = true;

    // Breathing: gentle scaleY pulse
    this.breathTween = this.scene.tweens.add({
      targets: this.truman,
      scaleY: 1.015,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    // Blinking: quick scaleY squish every 3-6s
    this.scheduleBlink();

    // Look around: flip direction briefly every 12-20s
    this.scheduleLook();
  }

  /** Stop all idle animations (call when Truman starts moving/acting) */
  stop(): void {
    if (!this.active) return;
    this.active = false;

    this.breathTween?.destroy();
    this.breathTween = null;
    this.blinkTimer?.destroy();
    this.blinkTimer = null;
    this.lookTimer?.destroy();
    this.lookTimer = null;

    // Reset scale
    this.truman.setScale(1, 1);
  }

  private scheduleBlink(): void {
    const delay = 3000 + Math.random() * 3000; // 3-6s
    this.blinkTimer = this.scene.time.delayedCall(delay, () => {
      if (!this.active) return;
      // Quick squish to simulate blink
      this.scene.tweens.add({
        targets: this.truman,
        scaleY: 0.97,
        duration: 50,
        yoyo: true,
        ease: "Quad.InOut",
      });
      this.scheduleBlink();
    });
  }

  private scheduleLook(): void {
    const delay = 12000 + Math.random() * 8000; // 12-20s
    this.lookTimer = this.scene.time.delayedCall(delay, () => {
      if (!this.active) return;
      // Flip direction briefly
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
