import Phaser from "phaser";
import { GAME_WIDTH } from "@nts/shared";

/**
 * HUD overlay: time (top-right), mood icon (top-left), activity label (top-right, below time).
 * Subtle, ~80% opacity per visual-spec.md S6.
 */
export class HUD {
  private moodText: Phaser.GameObjects.Text;
  private timeText: Phaser.GameObjects.Text;
  private activityText: Phaser.GameObjects.Text;
  private lastTimeString = "";

  constructor(scene: Phaser.Scene) {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ffffff",
    };

    // Mood icon — top-left
    this.moodText = scene.add
      .text(12, 10, "Mood: neutral", { ...style })
      .setAlpha(0.8)
      .setDepth(100);

    // Time — top-right
    this.timeText = scene.add
      .text(GAME_WIDTH - 12, 10, "00:00", { ...style, align: "right" })
      .setOrigin(1, 0)
      .setAlpha(0.8)
      .setDepth(100);

    // Activity label — top-right, below time
    this.activityText = scene.add
      .text(GAME_WIDTH - 12, 28, "Idle", { ...style, align: "right", fontSize: "10px" })
      .setOrigin(1, 0)
      .setAlpha(0.8)
      .setDepth(100);
  }

  /** Update the mood display */
  updateMood(mood: string): void {
    this.moodText.setText(`Mood: ${mood}`);
  }

  /** Update the time display (real 24h clock). Caches to avoid redundant updates. */
  updateTime(time?: string): void {
    if (time) {
      if (time !== this.lastTimeString) {
        this.lastTimeString = time;
        this.timeText.setText(time);
      }
    } else {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const timeStr = `${h}:${m}`;
      if (timeStr !== this.lastTimeString) {
        this.lastTimeString = timeStr;
        this.timeText.setText(timeStr);
      }
    }
  }

  /** Update the activity label */
  updateActivity(activity: string): void {
    this.activityText.setText(activity);
  }
}
