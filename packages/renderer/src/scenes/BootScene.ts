import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  create(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    this.add
      .text(centerX, centerY, "Hello Truman", {
        fontSize: "32px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, centerY + 50, "No True Man Show", {
        fontSize: "16px",
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);
  }
}
