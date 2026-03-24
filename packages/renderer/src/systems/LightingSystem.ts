import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";

/**
 * Dynamic lighting overlay that changes based on real-time hour.
 * Creates a color tint over the entire scene to simulate day/night.
 *
 * Time of day palette:
 * - Morning (6-10): warm golden glow
 * - Midday (10-16): neutral/bright
 * - Afternoon (16-19): warm amber/orange
 * - Evening (19-22): cool blue-purple
 * - Night (22-6): dark blue
 */

interface LightPreset {
  tintColor: number;
  tintAlpha: number;
  windowGlowAlpha: number;
}

const PRESETS: Record<string, LightPreset> = {
  morning:   { tintColor: 0xffd54f, tintAlpha: 0.06,  windowGlowAlpha: 0.08 },
  midday:    { tintColor: 0xffffff, tintAlpha: 0.0,   windowGlowAlpha: 0.10 },
  afternoon: { tintColor: 0xff8f00, tintAlpha: 0.08,  windowGlowAlpha: 0.06 },
  evening:   { tintColor: 0x5c6bc0, tintAlpha: 0.12,  windowGlowAlpha: 0.03 },
  night:     { tintColor: 0x1a237e, tintAlpha: 0.22,  windowGlowAlpha: 0.01 },
};

function getPresetForHour(hour: number): LightPreset {
  if (hour >= 6 && hour < 10) return PRESETS.morning;
  if (hour >= 10 && hour < 16) return PRESETS.midday;
  if (hour >= 16 && hour < 19) return PRESETS.afternoon;
  if (hour >= 19 && hour < 22) return PRESETS.evening;
  return PRESETS.night;
}

export class LightingSystem {
  private overlay: Phaser.GameObjects.Rectangle;
  private windowGlow: Phaser.GameObjects.Rectangle;
  private cornerShadowL: Phaser.GameObjects.Rectangle;
  private cornerShadowR: Phaser.GameObjects.Rectangle;
  private lastHour = -1;

  constructor(scene: Phaser.Scene) {
    // Full-screen color overlay
    this.overlay = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
      .setDepth(50)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    // Window light brightening effect
    this.windowGlow = scene.add
      .rectangle(680 + 32, 300, 200, 300, 0xfff8e1, 0)
      .setDepth(1);

    // Corner shadows (darker in corners, especially at night)
    this.cornerShadowL = scene.add
      .rectangle(30, GAME_HEIGHT / 2, 60, GAME_HEIGHT, 0x000000, 0)
      .setDepth(50);
    this.cornerShadowR = scene.add
      .rectangle(GAME_WIDTH - 20, GAME_HEIGHT / 2, 40, GAME_HEIGHT, 0x000000, 0)
      .setDepth(50);

    this.updateLighting();
  }

  /** Call from scene.update() — checks hour and applies lighting */
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

    // Main overlay tint
    this.overlay.setFillStyle(preset.tintColor, preset.tintAlpha);

    // Window glow intensity
    this.windowGlow.setAlpha(preset.windowGlowAlpha);

    // Corner shadows more intense at night
    const cornerAlpha = preset.tintAlpha > 0.1 ? 0.08 : 0.03;
    this.cornerShadowL.setAlpha(cornerAlpha);
    this.cornerShadowR.setAlpha(cornerAlpha);
  }
}
