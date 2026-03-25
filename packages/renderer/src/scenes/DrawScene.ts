import Phaser from "phaser";
import { ActivitySceneBase } from "./ActivitySceneBase";

export class DrawScene extends ActivitySceneBase {
  protected bgKey = "scene_draw_bg";
  protected label = "painting...";
  protected labelColor = "#f06292";

  constructor() { super({ key: "DrawScene" }); }

  protected addOverlays(): void {
    // Paint splatters (colorful particles)
    const colors = [0xff6b6b, 0x48dbfb, 0xffd93d, 0x55efc4, 0xfd79a8];
    colors.forEach((c, i) => {
      this.makeParticle(`paint_${i}`, c, 0.7, 3);
      this.add.particles(450 + Math.random() * 100, 250 + Math.random() * 80, `paint_${i}`, { speed: { min: 5, max: 15 }, angle: { min: 0, max: 360 }, scale: { start: 0.4, end: 0 }, alpha: { start: 0.5, end: 0 }, lifespan: 1500, frequency: 3000 + i * 500, quantity: 1 });
    });

    // Brush stroke — line appears on canvas periodically
    this.time.addEvent({ delay: 2500, loop: true, callback: () => {
      const y = 220 + Math.random() * 80;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const stroke = this.add.rectangle(440 + Math.random() * 60, y, 30 + Math.random() * 40, 3, color, 0.4);
      this.tweens.add({ targets: stroke, alpha: 0, duration: 2000, delay: 500, onComplete: () => stroke.destroy() });
    }});
  }
}
