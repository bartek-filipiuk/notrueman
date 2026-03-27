import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";
import { ActivitySceneBase, SceneContext } from "./ActivitySceneBase";

export class SleepScene extends ActivitySceneBase {
  protected bgKey = "scene_sleep_bg";
  protected label = "sleeping...";
  protected labelColor = "#7986cb";

  constructor() { super({ key: "SleepScene" }); }

  protected addOverlays(): void {
    // Zzz text floating up
    const zzz = this.add.text(500, 200, "z", { fontSize: "14px", fontFamily: "'Press Start 2P', monospace", color: "#7986cb" }).setAlpha(0);
    this.time.addEvent({ delay: 2500, loop: true, callback: () => {
      zzz.setPosition(480 + Math.random() * 40, 220);
      zzz.setAlpha(0.6);
      zzz.setText(["z", "zz", "zzz"][Math.floor(Math.random() * 3)]);
      this.tweens.add({ targets: zzz, y: zzz.y - 60, alpha: 0, duration: 2000, ease: "Sine.easeOut" });
    }});

    // Breathing — subtle alpha pulse on entire screen
    const breathe = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000020, 0);
    this.tweens.add({ targets: breathe, alpha: { from: 0, to: 0.03 }, duration: 3000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    // Moonlight glow
    const moon = this.add.circle(120, 80, 40, 0xfff8e1, 0.04).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: moon, alpha: { from: 0.03, to: 0.06 }, duration: 4000, yoyo: true, repeat: -1 });

    // Star twinkle particles
    this.makeParticle("star_p", 0xfff9c4, 0.8, 2);
    this.add.particles(100, 60, "star_p", { speed: 0, scale: { start: 0.3, end: 0 }, alpha: { start: 0.6, end: 0 }, lifespan: 1500, frequency: 800, quantity: 1, emitZone: { type: "random", source: new Phaser.Geom.Rectangle(0, 0, 200, 100) } as any });
  }

  protected displayContent(context: SceneContext): void {
    // Dream text from memories — floating, dreamlike
    const dreamText = context.recentMemory || context.thought;
    if (dreamText) {
      this.addDreamText(dreamText);
    }

    // Bottom thought bar: what they're dreaming about
    if (context.thought) {
      super.displayContent(context);
    }
  }

  /** Dream text element for cleanup */
  private dreamOverlay: HTMLDivElement | null = null;

  /** Floating dream text as HTML overlay — crisp at any resolution */
  private addDreamText(text: string): void {
    const displayText = text.length > 100
      ? text.substring(0, 97) + "..."
      : text;

    this.dreamOverlay = document.createElement("div");
    this.dreamOverlay.className = "scene-html-overlay";
    this.dreamOverlay.style.cssText = `
      position: fixed;
      top: 30%;
      left: 50%;
      transform: translateX(-50%);
      max-width: 60%;
      padding: 10px 20px;
      color: #b39ddb;
      font-family: 'Space Grotesk', Inter, sans-serif;
      font-size: 18px;
      font-style: italic;
      line-height: 1.6;
      text-align: center;
      z-index: 500;
      pointer-events: none;
      animation: dreamPulse 3s ease-in-out infinite, dreamFloat 4s ease-in-out infinite;
    `;
    this.dreamOverlay.textContent = `Dream: ${displayText}`;

    // Add CSS animation keyframes if not already present
    if (!document.getElementById("dream-keyframes")) {
      const style = document.createElement("style");
      style.id = "dream-keyframes";
      style.textContent = `
        @keyframes dreamPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }
        @keyframes dreamFloat { 0%, 100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-10px); } }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(this.dreamOverlay);
  }

  shutdown(): void {
    super.shutdown();
    // dreamOverlay cleaned by base class cleanupAllOverlays() via .scene-html-overlay class
    this.dreamOverlay = null;
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
      color: "#c5cae9",
      wordWrap: { width: GAME_WIDTH * 0.80 },
      align: "center",
      lineSpacing: 2,
    }).setOrigin(0.5, 0.5).setAlpha(0.7);
  }
}
