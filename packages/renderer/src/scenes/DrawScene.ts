import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";
import { ActivitySceneBase, SceneContext } from "./ActivitySceneBase";

export class DrawScene extends ActivitySceneBase {
  protected bgKey = "scene_draw_bg";
  protected label = "painting...";
  protected labelColor = "#f06292";

  constructor() { super({ key: "DrawScene" }); }

  protected addOverlays(): void {
    // Paint splatters — colors based on mood
    const colors = this.getSplatterColors();
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

  protected displayContent(context: SceneContext): void {
    // Artwork description on the canvas area
    const artworkResult = context.toolResults?.find(r => r.tool === "create_artwork");
    if (artworkResult) {
      this.addArtworkDescription(artworkResult.title, artworkResult.description);
    }

    // Bottom thought bar
    if (context.thought) {
      this.addBottomThoughtBar(context.thought);
    }
  }

  /** Display artwork title + description on the canvas area */
  private addArtworkDescription(title?: string, description?: string): void {
    let yPos = 200;

    if (title) {
      this.add.text(480, yPos, title, {
        fontSize: "9px",
        fontFamily: "Inter, 'Segoe UI', sans-serif",
        color: "#f8bbd0",
        wordWrap: { width: 180 },
        align: "center",
        fontStyle: "bold",
      }).setOrigin(0.5, 0).setAlpha(0.7);
      yPos += 25;
    }

    if (description) {
      const displayDesc = description.length > 120
        ? description.substring(0, 117) + "..."
        : description;

      const descText = this.add.text(480, yPos, displayDesc, {
        fontSize: "7px",
        fontFamily: "Inter, 'Segoe UI', sans-serif",
        color: "#f48fb1",
        wordWrap: { width: 170 },
        align: "center",
        lineSpacing: 3,
      }).setOrigin(0.5, 0).setAlpha(0);

      // Fade in the description
      this.tweens.add({
        targets: descText,
        alpha: 0.6,
        duration: 1500,
        ease: "Sine.easeIn",
      });
    }
  }

  /** Get splatter colors based on mood */
  private getSplatterColors(): number[] {
    const mood = this.context?.mood;
    const moodPalettes: Record<string, number[]> = {
      happy: [0xffd700, 0xff6b6b, 0xffd93d, 0x55efc4, 0xffab40],
      curious: [0x48dbfb, 0x00bcd4, 0x81d4fa, 0x4dd0e1, 0x80deea],
      anxious: [0xff4444, 0xff6b6b, 0xef5350, 0xd32f2f, 0xff8a80],
      excited: [0xffeb3b, 0xff6b6b, 0x48dbfb, 0xffd93d, 0x55efc4],
      frustrated: [0xff9800, 0xff6b6b, 0xef6c00, 0xd84315, 0xff5722],
    };
    return (mood && moodPalettes[mood]) || [0xff6b6b, 0x48dbfb, 0xffd93d, 0x55efc4, 0xfd79a8];
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
