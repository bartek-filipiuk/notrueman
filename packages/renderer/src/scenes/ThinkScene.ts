import Phaser from "phaser";
import { GAME_WIDTH } from "@nts/shared";
import { ActivitySceneBase } from "./ActivitySceneBase";

export class ThinkScene extends ActivitySceneBase {
  protected bgKey = "scene_think_bg";
  protected label = "thinking...";
  protected labelColor = "#b0bec5";

  constructor() { super({ key: "ThinkScene" }); }

  protected addOverlays(): void {
    // Clouds drifting (slow horizontal movement)
    const cloud = this.add.rectangle(200, 150, 80, 20, 0xffffff, 0.04);
    this.tweens.add({ targets: cloud, x: { from: 100, to: GAME_WIDTH - 100 }, duration: 20000, repeat: -1 });

    const cloud2 = this.add.rectangle(600, 120, 50, 14, 0xffffff, 0.03);
    this.tweens.add({ targets: cloud2, x: { from: GAME_WIDTH - 50, to: 50 }, duration: 25000, repeat: -1 });

    // Thought dots "..." appearing
    const dots = this.add.text(600, 180, "", { fontSize: "12px", fontFamily: "'Press Start 2P', monospace", color: "#b0bec5" }).setAlpha(0);
    this.time.addEvent({ delay: 4000, loop: true, callback: () => {
      dots.setAlpha(0.5);
      let d = 0;
      const typing = this.time.addEvent({ delay: 400, repeat: 2, callback: () => { d++; dots.setText(".".repeat(d)); } });
      this.time.delayedCall(2000, () => { this.tweens.add({ targets: dots, alpha: 0, duration: 500 }); });
    }});

    // Birds (tiny particles crossing sky)
    this.makeParticle("bird", 0x333333, 0.6, 2);
    this.add.particles(0, 130, "bird", { speedX: { min: 15, max: 30 }, speedY: { min: -3, max: 3 }, scale: 0.3, alpha: { start: 0.4, end: 0 }, lifespan: 8000, frequency: 3000, quantity: 1 });

    // Sunset glow pulse
    const sun = this.add.circle(480, 200, 80, 0xff8a65, 0.03).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: sun, alpha: { from: 0.02, to: 0.05 }, duration: 3000, yoyo: true, repeat: -1 });
  }
}
