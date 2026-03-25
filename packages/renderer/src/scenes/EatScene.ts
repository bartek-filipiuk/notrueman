import Phaser from "phaser";
import { ActivitySceneBase } from "./ActivitySceneBase";

export class EatScene extends ActivitySceneBase {
  protected bgKey = "scene_eat_bg";
  protected label = "eating...";
  protected labelColor = "#ffb74d";

  constructor() { super({ key: "EatScene" }); }

  protected addOverlays(): void {
    // Food steam
    this.makeParticle("food_steam", 0xffffff, 0.4, 4);
    this.add.particles(450, 340, "food_steam", { speed: { min: 2, max: 6 }, angle: { min: 255, max: 285 }, scale: { start: 0.3, end: 0 }, alpha: { start: 0.15, end: 0 }, lifespan: 2500, frequency: 700, quantity: 1, blendMode: Phaser.BlendModes.ADD });

    // "nom nom" text appearing periodically
    const nom = this.add.text(500, 250, "", { fontSize: "8px", fontFamily: "'Press Start 2P', monospace", color: "#ffcc80" }).setAlpha(0);
    this.time.addEvent({ delay: 3000, loop: true, callback: () => {
      nom.setPosition(480 + Math.random() * 40, 240 + Math.random() * 20);
      nom.setText(Math.random() > 0.5 ? "nom" : "yum");
      nom.setAlpha(0.5);
      this.tweens.add({ targets: nom, y: nom.y - 30, alpha: 0, duration: 1500, ease: "Sine.easeOut" });
    }});

    // Warm ambient glow
    const warm = this.add.circle(450, 300, 60, 0xffa726, 0.03).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: warm, alpha: { from: 0.02, to: 0.05 }, duration: 2500, yoyo: true, repeat: -1 });
  }
}
