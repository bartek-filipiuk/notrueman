import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";
import { ActivitySceneBase, SceneContext } from "./ActivitySceneBase";

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

    // Birds (tiny particles crossing sky)
    this.makeParticle("bird", 0x333333, 0.6, 2);
    this.add.particles(0, 130, "bird", { speedX: { min: 15, max: 30 }, speedY: { min: -3, max: 3 }, scale: 0.3, alpha: { start: 0.4, end: 0 }, lifespan: 8000, frequency: 3000, quantity: 1 });

    // Sunset glow pulse
    const sun = this.add.circle(480, 200, 80, 0xff8a65, 0.03).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: sun, alpha: { from: 0.02, to: 0.05 }, duration: 3000, yoyo: true, repeat: -1 });
  }

  protected displayContent(context: SceneContext): void {
    if (context.thought) {
      this.addTypewriterThought(context.thought);
      super.displayContent(context);
    } else {
      this.addFallbackDots();
    }
  }

  /** Typewriter effect: thought appears word by word (100ms/word) */
  private addTypewriterThought(thought: string): void {
    const displayText = thought.length > 150
      ? thought.substring(0, 147) + "..."
      : thought;

    const words = displayText.split(" ");
    const textObj = this.add.text(GAME_WIDTH / 2, 180, "", {
      fontSize: "10px",
      fontFamily: "Inter, 'Segoe UI', sans-serif",
      color: "#e0e0e0",
      wordWrap: { width: GAME_WIDTH * 0.5 },
      align: "center",
      lineSpacing: 4,
    }).setOrigin(0.5, 0).setAlpha(0.8);

    let wordIdx = 0;
    this.time.addEvent({
      delay: 100,
      repeat: words.length - 1,
      callback: () => {
        wordIdx++;
        textObj.setText(words.slice(0, wordIdx).join(" "));
      },
    });
  }

  /** Fallback: classic dots animation */
  private addFallbackDots(): void {
    const dots = this.add.text(600, 180, "", { fontSize: "12px", fontFamily: "'Press Start 2P', monospace", color: "#b0bec5" }).setAlpha(0);
    this.time.addEvent({ delay: 4000, loop: true, callback: () => {
      dots.setAlpha(0.5);
      let d = 0;
      this.time.addEvent({ delay: 400, repeat: 2, callback: () => { d++; dots.setText(".".repeat(d)); } });
      this.time.delayedCall(2000, () => { this.tweens.add({ targets: dots, alpha: 0, duration: 500 }); });
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
