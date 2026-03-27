import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";
import type { AudioMixer } from "../systems/AudioMixer";

// Mood emoji characters for pixel feel
const MOOD_ICONS: Record<string, string> = {
  happy: "\u263A",        // ☺
  curious: "?",
  anxious: "~",
  excited: "!",
  frustrated: "#",
  content: "\u2665",      // ♥
  contemplative: "\u2026", // …
  bored: "-",
  neutral: "\u25CB",      // ○
};

const MOOD_COLORS: Record<string, string> = {
  happy: "#ffd93d",
  curious: "#6ec6ff",
  anxious: "#ce93d8",
  excited: "#ff8a65",
  frustrated: "#ef5350",
  content: "#81c784",
  contemplative: "#b0bec5",
  bored: "#90a4ae",
  neutral: "#e0e0e0",
};

/**
 * Styled HUD overlay with mood icon, time, activity.
 * Semi-transparent dark bar at top for contrast.
 * Style: warm, readable, pixel-friendly.
 */
export class HUD {
  private moodIcon: Phaser.GameObjects.Text;
  private moodLabel: Phaser.GameObjects.Text;
  private timeText: Phaser.GameObjects.Text;
  private activityText: Phaser.GameObjects.Text;
  private bgBar: Phaser.GameObjects.Rectangle;
  private muteBtn: Phaser.GameObjects.Text;
  private dayCounterText: Phaser.GameObjects.Text;
  private audioMixer: AudioMixer | null = null;
  private lastTimeString = "";

  constructor(scene: Phaser.Scene) {
    // Semi-transparent top bar for HUD readability
    this.bgBar = scene.add
      .rectangle(GAME_WIDTH / 2, 0, GAME_WIDTH, 36, 0x1a1008, 0.45)
      .setOrigin(0.5, 0)
      .setDepth(99);

    // Mood icon (large, colored)
    this.moodIcon = scene.add
      .text(12, 6, MOOD_ICONS.neutral, {
        fontSize: "20px",
        fontFamily: "monospace",
        color: MOOD_COLORS.neutral,
      })
      .setDepth(100);

    // Mood label (beside icon)
    this.moodLabel = scene.add
      .text(36, 9, "neutral", {
        fontSize: "13px",
        fontFamily: "'Space Grotesk', Inter, sans-serif",
        color: "#e0e0e0",
      })
      .setDepth(100);

    // Time (top-right, larger)
    this.timeText = scene.add
      .text(GAME_WIDTH - 10, 5, "00:00", {
        fontSize: "16px",
        fontFamily: "'JetBrains Mono', monospace",
        color: "#ffd93d",
        align: "right",
      })
      .setOrigin(1, 0)
      .setDepth(100);

    // Activity label (below time)
    this.activityText = scene.add
      .text(GAME_WIDTH - 10, 24, "Idle", {
        fontSize: "11px",
        fontFamily: "'Space Grotesk', Inter, sans-serif",
        color: "#b0bec5",
        align: "right",
      })
      .setOrigin(1, 0)
      .setDepth(100);

    // Mute/unmute button
    this.muteBtn = scene.add
      .text(GAME_WIDTH / 2, 7, "\u266B", {
        fontSize: "18px",
        fontFamily: "monospace",
        color: "#81c784",
      })
      .setOrigin(0.5, 0)
      .setDepth(100)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.onMuteToggle());

    // Day counter (bottom-left)
    this.dayCounterText = scene.add
      .text(12, GAME_HEIGHT - 22, "Day 0", {
        fontSize: "12px",
        fontFamily: "'JetBrains Mono', monospace",
        color: "#e0e0e0",
      })
      .setDepth(100)
      .setAlpha(0.7);
  }

  updateMood(mood: string): void {
    const icon = MOOD_ICONS[mood] || MOOD_ICONS.neutral;
    const color = MOOD_COLORS[mood] || MOOD_COLORS.neutral;
    this.moodIcon.setText(icon);
    this.moodIcon.setColor(color);
    this.moodLabel.setText(mood);
    this.moodLabel.setColor(color);
  }

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

  updateActivity(activity: string): void {
    this.activityText.setText(activity);
  }

  /** Update the day counter display (TI.1) */
  updateDayCounter(dayCount: number): void {
    this.dayCounterText.setText(`Day ${dayCount}`);
  }

  /** Connect an AudioMixer so the mute button can toggle audio */
  setAudioMixer(mixer: AudioMixer): void {
    this.audioMixer = mixer;
    this.updateMuteIcon();
  }

  private onMuteToggle(): void {
    if (!this.audioMixer) return;
    this.audioMixer.toggleMasterMute();
    this.updateMuteIcon();
  }

  private updateMuteIcon(): void {
    if (!this.audioMixer) return;
    const muted = this.audioMixer.isMasterMuted();
    // ♫ when audio on, X when muted
    this.muteBtn.setText(muted ? "\u2715" : "\u266B");
    this.muteBtn.setColor(muted ? "#ef5350" : "#81c784");
  }
}
