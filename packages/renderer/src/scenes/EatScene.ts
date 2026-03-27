import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";
import { ActivitySceneBase, SceneContext } from "./ActivitySceneBase";

export class EatScene extends ActivitySceneBase {
  protected bgKey = "scene_eat_bg";
  protected label = "eating...";
  protected labelColor = "#ffb74d";

  constructor() { super({ key: "EatScene" }); }

  protected addOverlays(): void {
    // Food steam
    this.makeParticle("food_steam", 0xffffff, 0.4, 4);
    this.add.particles(450, 340, "food_steam", { speed: { min: 2, max: 6 }, angle: { min: 255, max: 285 }, scale: { start: 0.3, end: 0 }, alpha: { start: 0.15, end: 0 }, lifespan: 2500, frequency: 700, quantity: 1, blendMode: Phaser.BlendModes.ADD });

    // Warm ambient glow
    const warm = this.add.circle(450, 300, 60, 0xffa726, 0.03).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: warm, alpha: { from: 0.02, to: 0.05 }, duration: 2500, yoyo: true, repeat: -1 });
  }

  protected displayContent(context: SceneContext): void {
    if (context.thought) {
      // Real thought instead of random "nom"/"yum"
      this.addEatingThought(context.thought);
      super.displayContent(context);
    } else {
      // Fallback: classic "nom"/"yum" animation
      this.addFallbackNom();
    }
  }

  /** Display brain thought as eating commentary */
  private addEatingThought(thought: string): void {
    const displayText = thought.length > 60
      ? thought.substring(0, 57) + "..."
      : thought;

    const nom = this.add.text(500, 250, displayText, {
      fontSize: "7px",
      fontFamily: "Inter, 'Segoe UI', sans-serif",
      color: "#ffcc80",
      wordWrap: { width: 160 },
      align: "center",
    }).setOrigin(0.5, 0.5).setAlpha(0);

    // Fade in gently
    this.tweens.add({
      targets: nom,
      alpha: 0.6,
      duration: 1000,
      ease: "Sine.easeIn",
    });
  }

  /** Fallback: classic nom/yum appearing periodically */
  private addFallbackNom(): void {
    const nom = this.add.text(500, 250, "", { fontSize: "8px", fontFamily: "'Press Start 2P', monospace", color: "#ffcc80" }).setAlpha(0);
    this.time.addEvent({ delay: 3000, loop: true, callback: () => {
      nom.setPosition(480 + Math.random() * 40, 240 + Math.random() * 20);
      nom.setText(Math.random() > 0.5 ? "nom" : "yum");
      nom.setAlpha(0.5);
      this.tweens.add({ targets: nom, y: nom.y - 30, alpha: 0, duration: 1500, ease: "Sine.easeOut" });
    }});
  }

  /** Bottom thought bar */
  private addBottomThoughtBar(thought: string): void {
    const barY = GAME_HEIGHT - 50;
    const barHeight = 45;
    this.add.rectangle(
      GAME_WIDTH / 2, barY + barHeight / 2,
      GAME_WIDTH * 0.85, barHeight,
      0x000000, 0.5,
    ).setOrigin(0.5, 0.5);

    const displayText = thought.length > 120
      ? thought.substring(0, 117) + "..."
      : thought;

    this.add.text(GAME_WIDTH / 2, barY + barHeight / 2, displayText, {
      fontSize: "11px",
      fontFamily: "Inter, 'Segoe UI', sans-serif",
      color: "#e0e0e0",
      wordWrap: { width: GAME_WIDTH * 0.80 },
      align: "center",
      lineSpacing: 2,
    }).setOrigin(0.5, 0.5).setAlpha(0.9);
  }
}
