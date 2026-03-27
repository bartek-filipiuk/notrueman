import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";
import { ActivitySceneBase, SceneContext } from "./ActivitySceneBase";

export class CookScene extends ActivitySceneBase {
  protected bgKey = "scene_cook_bg";
  protected label = "cooking...";
  protected labelColor = "#ff8a65";

  constructor() { super({ key: "CookScene" }); }

  protected addOverlays(): void {
    // Steam from pot — intensity based on mood
    const steamFreq = this.getSteamFrequency();
    this.makeParticle("cook_steam", 0xffffff, 0.4, 4);
    this.add.particles(480, 280, "cook_steam", { speed: { min: 4, max: 12 }, angle: { min: 250, max: 290 }, scale: { start: 0.5, end: 0.1 }, alpha: { start: 0.25, end: 0 }, lifespan: 2500, frequency: steamFreq, quantity: 1, blendMode: Phaser.BlendModes.ADD });

    // Burner glow
    const burner = this.add.circle(480, 380, 25, 0xff6600, 0.05).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: burner, alpha: { from: 0.03, to: 0.08 }, duration: 800, yoyo: true, repeat: -1 });

    // Sizzle sparks
    this.makeParticle("sizzle", 0xffab40, 0.7, 2);
    this.add.particles(480, 320, "sizzle", { speed: { min: 10, max: 30 }, angle: { min: 200, max: 340 }, scale: { start: 0.3, end: 0 }, alpha: { start: 0.5, end: 0 }, lifespan: 600, frequency: 400, quantity: 1 });
  }

  protected displayContent(context: SceneContext): void {
    if (context.thought) {
      super.displayContent(context);
    }
  }

  /** Steam frequency based on mood: excited=more, content=calm */
  private getSteamFrequency(): number {
    const mood = this.context?.mood;
    const freqMap: Record<string, number> = {
      excited: 150,
      happy: 200,
      frustrated: 180,
      anxious: 200,
      content: 400,
      bored: 500,
    };
    return (mood && freqMap[mood]) || 300;
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
