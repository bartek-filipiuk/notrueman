import Phaser from "phaser";
import { ActivitySceneBase } from "./ActivitySceneBase";

export class CookScene extends ActivitySceneBase {
  protected bgKey = "scene_cook_bg";
  protected label = "cooking...";
  protected labelColor = "#ff8a65";

  constructor() { super({ key: "CookScene" }); }

  protected addOverlays(): void {
    // Steam from pot
    this.makeParticle("cook_steam", 0xffffff, 0.4, 4);
    this.add.particles(480, 280, "cook_steam", { speed: { min: 4, max: 12 }, angle: { min: 250, max: 290 }, scale: { start: 0.5, end: 0.1 }, alpha: { start: 0.25, end: 0 }, lifespan: 2500, frequency: 300, quantity: 1, blendMode: Phaser.BlendModes.ADD });

    // Burner glow
    const burner = this.add.circle(480, 380, 25, 0xff6600, 0.05).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: burner, alpha: { from: 0.03, to: 0.08 }, duration: 800, yoyo: true, repeat: -1 });

    // Sizzle sparks
    this.makeParticle("sizzle", 0xffab40, 0.7, 2);
    this.add.particles(480, 320, "sizzle", { speed: { min: 10, max: 30 }, angle: { min: 200, max: 340 }, scale: { start: 0.3, end: 0 }, alpha: { start: 0.5, end: 0 }, lifespan: 600, frequency: 400, quantity: 1 });
  }
}
