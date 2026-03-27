import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";
import { ActivitySceneBase, SceneContext } from "./ActivitySceneBase";

export class ReadScene extends ActivitySceneBase {
  protected bgKey = "scene_read_bg";
  protected label = "reading...";
  protected labelColor = "#ce93d8";

  constructor() { super({ key: "ReadScene" }); }

  protected addOverlays(): void {
    // Lamp warm glow
    const lamp = this.add.circle(200, 200, 50, 0xffa726, 0.04).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: lamp, alpha: { from: 0.03, to: 0.06 }, duration: 3000, yoyo: true, repeat: -1 });

    // Dust in lamplight
    this.makeParticle("read_dust", 0xffd54f, 0.6, 2);
    this.add.particles(220, 180, "read_dust", { speed: { min: 1, max: 4 }, angle: { min: 160, max: 200 }, scale: { start: 0.3, end: 0 }, alpha: { start: 0.3, end: 0 }, lifespan: 4000, frequency: 1000, quantity: 1, blendMode: Phaser.BlendModes.ADD });
  }

  protected displayContent(context: SceneContext): void {
    // Search results as "reading material" with page-turn effect
    const searchResult = context.toolResults?.find(r => r.tool === "web_search");
    if (searchResult) {
      this.addReadingContent(searchResult.title, searchResult.content);
    } else if (context.thought) {
      this.addReadingReflection(context.thought);
    } else {
      this.addFallbackQuotes();
    }

    // Bottom thought bar
    if (context.thought) {
      super.displayContent(context);
    }
  }

  /** Display search snippet as reading material, cycling every 4s */
  private addReadingContent(title?: string, content?: string): void {
    const pages: string[] = [];
    if (title) pages.push(title);
    if (content) {
      const words = content.split(" ");
      let page = "";
      for (const word of words) {
        if ((page + " " + word).length > 80) {
          pages.push(page.trim());
          page = word;
        } else {
          page += " " + word;
        }
      }
      if (page.trim()) pages.push(page.trim());
    }

    if (pages.length === 0) {
      this.addFallbackQuotes();
      return;
    }

    let qi = 0;
    const quote = this.add.text(300, 400, pages[0], {
      fontSize: "6px",
      fontFamily: "'Press Start 2P', monospace",
      color: "#d4c5a9",
      lineSpacing: 3,
      wordWrap: { width: 200 },
    }).setAlpha(0.5);

    this.time.addEvent({ delay: 4000, loop: true, callback: () => {
      qi = (qi + 1) % pages.length;
      this.tweens.add({
        targets: quote, alpha: 0, duration: 300,
        onComplete: () => {
          quote.setText(pages[qi]);
          this.tweens.add({ targets: quote, alpha: 0.5, duration: 300 });
        },
      });
    }});
  }

  /** Show thought as reading reflection */
  private addReadingReflection(thought: string): void {
    const displayText = thought.length > 100
      ? thought.substring(0, 97) + "..."
      : thought;

    const quote = this.add.text(300, 400, displayText, {
      fontSize: "6px",
      fontFamily: "'Press Start 2P', monospace",
      color: "#d4c5a9",
      lineSpacing: 3,
      wordWrap: { width: 200 },
    }).setAlpha(0.5);

    this.tweens.add({
      targets: quote,
      alpha: { from: 0.3, to: 0.6 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
    });
  }

  /** Fallback: classic hardcoded quotes */
  private addFallbackQuotes(): void {
    const quotes = [
      '"The unexamined life\nis not worth living."',
      '"I think, therefore\nI am."',
      '"To be or not to be,\nthat is the question."',
      '"The only true wisdom\nis knowing you\nknow nothing."',
    ];
    let qi = 0;
    const quote = this.add.text(300, 400, quotes[0], {
      fontSize: "6px",
      fontFamily: "'Press Start 2P', monospace",
      color: "#d4c5a9",
      lineSpacing: 3,
    }).setAlpha(0.5);

    this.time.addEvent({ delay: 4000, loop: true, callback: () => {
      qi = (qi + 1) % quotes.length;
      this.tweens.add({
        targets: quote, alpha: 0, duration: 300,
        onComplete: () => {
          quote.setText(quotes[qi]);
          this.tweens.add({ targets: quote, alpha: 0.5, duration: 300 });
        },
      });
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
