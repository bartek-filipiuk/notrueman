import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";
import { ActivitySceneBase, SceneContext } from "./ActivitySceneBase";

export class ComputerScene extends ActivitySceneBase {
  protected bgKey = "scene_computer_bg";
  protected label = "coding...";
  protected labelColor = "#44dd88";

  constructor() { super({ key: "ComputerScene" }); }

  protected addOverlays(): void {
    // Cursor blink
    const cursor = this.add.rectangle(605, 240, 5, 8, 0x44dd88, 0.9);
    this.tweens.add({ targets: cursor, alpha: { from: 0.9, to: 0 }, duration: 530, yoyo: true, repeat: -1 });

    // Monitor glow — color based on mood
    const glowColor = this.getMoodGlowColor();
    const glow = this.add.rectangle(560, 210, 170, 120, glowColor, 0.03).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: { from: 0.02, to: 0.06 }, duration: 2000, yoyo: true, repeat: -1 });

    // Coffee steam
    this.makeParticle("cs_steam", 0xffffff, 0.5, 4);
    this.add.particles(170, 350, "cs_steam", { speed: { min: 2, max: 6 }, angle: { min: 255, max: 285 }, scale: { start: 0.4, end: 0 }, alpha: { start: 0.2, end: 0 }, lifespan: 3000, frequency: 600, quantity: 1, blendMode: Phaser.BlendModes.ADD });
  }

  protected displayContent(context: SceneContext): void {
    // Scrolling content on the "monitor" area (upper portion of scene)
    const monitorLines = this.getMonitorLines(context);
    this.addScrollingMonitorText(monitorLines);

    // Thought text at bottom (from base class pattern)
    if (context.thought) {
      this.addBottomThoughtBar(context.thought);
    }
  }

  /** Extract display lines from brain context */
  private getMonitorLines(context: SceneContext): string[] {
    // Check for web_search results
    const searchResult = context.toolResults?.find(r => r.tool === "web_search");
    if (searchResult) {
      const lines: string[] = [];
      if (searchResult.query) lines.push(`> Search: ${searchResult.query}`, "");
      if (searchResult.title) lines.push(searchResult.title);
      if (searchResult.content) {
        // Split content into short lines for monitor display
        const words = searchResult.content.split(" ");
        let line = "";
        for (const word of words) {
          if ((line + " " + word).length > 30) {
            lines.push(line.trim());
            line = word;
          } else {
            line += " " + word;
          }
        }
        if (line.trim()) lines.push(line.trim());
      }
      return lines.length > 0 ? lines : this.getFallbackLines();
    }

    // Check for blog writing
    const blogResult = context.toolResults?.find(r => r.tool === "write_blog_post");
    if (blogResult) {
      const lines: string[] = [];
      if (blogResult.title) lines.push(`# ${blogResult.title}`, "");
      if (blogResult.content) {
        const words = blogResult.content.split(" ");
        let line = "";
        for (const word of words) {
          if ((line + " " + word).length > 30) {
            lines.push(line.trim());
            line = word;
          } else {
            line += " " + word;
          }
        }
        if (line.trim()) lines.push(line.trim());
      }
      return lines.length > 0 ? lines : this.getFallbackLines();
    }

    return this.getFallbackLines();
  }

  private getFallbackLines(): string[] {
    return [
      "thinking...",
      "",
      "processing ideas...",
      "exploring concepts...",
      "",
      "connecting thoughts...",
      "analyzing patterns...",
      "",
      "formulating response...",
    ];
  }

  /** Scrolling text on the monitor area */
  private addScrollingMonitorText(lines: string[]): void {
    let idx = 0;
    const visibleLines = 8;
    const code = this.add.text(540, 160, "", {
      fontSize: "6px",
      fontFamily: "'Press Start 2P', monospace",
      color: "#44dd88",
      lineSpacing: 3,
      wordWrap: { width: 160 },
    }).setAlpha(0.7);

    this.time.addEvent({
      delay: 600,
      loop: true,
      callback: () => {
        idx++;
        const start = Math.max(0, idx - visibleLines);
        const end = idx % lines.length + 1;
        code.setText(lines.slice(start, end).join("\n"));
        if (idx >= lines.length) idx = 0;
      },
    });
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

  /** Map mood to monitor glow color */
  private getMoodGlowColor(): number {
    const mood = this.context?.mood;
    const map: Record<string, number> = {
      happy: 0xffd700,
      curious: 0x00bcd4,
      anxious: 0xff4444,
      excited: 0xffeb3b,
      content: 0x4caf50,
      frustrated: 0xff9800,
      bored: 0x9e9e9e,
    };
    return (mood && map[mood]) || 0x33cc77;
  }
}
