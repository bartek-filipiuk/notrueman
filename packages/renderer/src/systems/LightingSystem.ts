import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";
import { getVisualConfig } from "../config/VisualConfig";

/**
 * Dynamic lighting using ColorMatrix PostFX for proper color grading.
 * Falls back to Rectangle overlay when colorGrading is disabled.
 *
 * Time presets: morning (warm), midday (neutral), afternoon (amber),
 * evening (cool blue), night (dark blue).
 */

function getPresetForHour(hour: number): string {
  if (hour >= 6 && hour < 10) return "morning";
  if (hour >= 10 && hour < 16) return "midday";
  if (hour >= 16 && hour < 19) return "afternoon";
  if (hour >= 19 && hour < 22) return "evening";
  return "night";
}

export class LightingSystem {
  private scene: Phaser.Scene;
  private colorMatrix: Phaser.FX.ColorMatrix | null = null;
  private windowGlow: Phaser.GameObjects.Rectangle;
  private cornerShadowL: Phaser.GameObjects.Rectangle;
  private cornerShadowR: Phaser.GameObjects.Rectangle;
  private lastHour = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const fx = getVisualConfig();

    // Try ColorMatrix PostFX (WebGL only, config-gated)
    if (fx.colorGrading && scene.cameras.main.postFX) {
      this.colorMatrix = scene.cameras.main.postFX.addColorMatrix();
    }

    // Window light brightening effect (spatial, not full-screen)
    this.windowGlow = scene.add
      .rectangle(680 + 32, 300, 200, 300, 0xfff8e1, 0)
      .setDepth(1);

    // Corner shadows
    this.cornerShadowL = scene.add
      .rectangle(30, GAME_HEIGHT / 2, 60, GAME_HEIGHT, 0x000000, 0)
      .setDepth(2);
    this.cornerShadowR = scene.add
      .rectangle(GAME_WIDTH - 20, GAME_HEIGHT / 2, 40, GAME_HEIGHT, 0x000000, 0)
      .setDepth(2);

    this.updateLighting();
  }

  update(): void {
    const hour = new Date().getHours();
    if (hour !== this.lastHour) {
      this.lastHour = hour;
      this.updateLighting();
    }
  }

  private updateLighting(): void {
    const hour = new Date().getHours();
    const preset = getPresetForHour(hour);

    // Apply ColorMatrix color grading
    if (this.colorMatrix) {
      this.colorMatrix.reset();
      switch (preset) {
        case "morning":
          this.colorMatrix.saturate(0.12);
          this.colorMatrix.brightness(0.04);
          break;
        case "midday":
          // Neutral — no grading
          this.colorMatrix.brightness(0.02);
          break;
        case "afternoon":
          this.colorMatrix.saturate(0.08);
          this.colorMatrix.brightness(-0.02);
          break;
        case "evening":
          this.colorMatrix.saturate(-0.04);
          break;
        case "night":
          // Very subtle — room must always be clearly visible
          this.colorMatrix.saturate(-0.06);
          break;
      }
    }

    // Window glow intensity
    const glowMap: Record<string, number> = {
      morning: 0.08, midday: 0.10, afternoon: 0.06, evening: 0.03, night: 0.01,
    };
    this.windowGlow.setAlpha(glowMap[preset] ?? 0.05);

    // Corner shadows
    const isNight = preset === "evening" || preset === "night";
    this.cornerShadowL.setAlpha(isNight ? 0.08 : 0.03);
    this.cornerShadowR.setAlpha(isNight ? 0.08 : 0.03);
  }
}
