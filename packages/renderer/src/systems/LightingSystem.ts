import Phaser from "phaser";
import { getVisualConfig } from "../config/VisualConfig";

/**
 * Minimal lighting — room is ALWAYS bright and readable.
 * Only applies very subtle warm color grading. No darkening ever.
 */
export class LightingSystem {
  private colorMatrix: Phaser.FX.ColorMatrix | null = null;

  constructor(scene: Phaser.Scene) {
    const fx = getVisualConfig();

    if (fx.colorGrading && scene.cameras.main.postFX) {
      this.colorMatrix = scene.cameras.main.postFX.addColorMatrix();
      // Very subtle warm tint — always on, never darkens
      this.colorMatrix.saturate(0.05);
      this.colorMatrix.brightness(0.02);
    }
  }

  update(): void {
    // No-op — lighting is static now (always bright)
  }
}
