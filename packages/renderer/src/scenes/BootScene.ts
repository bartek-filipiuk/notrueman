import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";

const TIPS = [
  "Truman doesn't know you're watching.",
  "Press ~ to open the debug panel.",
  "Add ?apiKey=... to the URL for AI mode.",
  "Truman's mood affects his thought bubbles.",
  "Every activity has a 25% chance of failure.",
  "Truman is a curious introvert with dry humor.",
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Dark background
    this.cameras.main.setBackgroundColor("#0a0a1a");

    // Title with warm glow
    const title = this.add
      .text(cx, cy - 40, "No True Man Show", {
        fontSize: "20px",
        fontFamily: "'Press Start 2P', monospace",
        color: "#ffd93d",
        align: "center",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // Subtitle
    const subtitle = this.add
      .text(cx, cy, "a life, observed", {
        fontSize: "10px",
        fontFamily: "'Press Start 2P', monospace",
        color: "#6ec6ff",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // Loading dots (animated)
    const loading = this.add
      .text(cx, cy + 50, "...", {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#555555",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // Random tip
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    const tipText = this.add
      .text(cx, GAME_HEIGHT - 40, tip, {
        fontSize: "8px",
        fontFamily: "'Press Start 2P', monospace",
        color: "#444444",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // Fade in sequence
    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 600,
      ease: "Power2",
    });

    this.tweens.add({
      targets: subtitle,
      alpha: 0.8,
      duration: 500,
      delay: 400,
      ease: "Power2",
    });

    this.tweens.add({
      targets: [loading, tipText],
      alpha: 0.6,
      duration: 400,
      delay: 700,
    });

    // Animate loading dots
    let dotFrame = 0;
    this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        dotFrame = (dotFrame + 1) % 4;
        loading.setText(".".repeat(dotFrame + 1));
      },
    });

    // Fade out and transition
    this.time.delayedCall(2000, () => {
      this.cameras.main.fadeOut(500, 10, 10, 26);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("RoomScene");
      });
    });
  }
}
