import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";
import { getVisualConfig } from "../config/VisualConfig";
import type { RoomScene } from "../scenes/RoomScene";

/**
 * Day/Night cycle — ambient Light2D + soft fill light + vignette + ColorMatrix.
 * No harsh visible light sources. Evening/night feel like "lamp on somewhere off-screen".
 *
 * Layers:
 * 1. Light2D ambient color (warm/cool base)
 * 2. One large soft Light2D addLight() as fill (radius 1200, very dim)
 * 3. Camera PostFX ColorMatrix for brightness/saturation shift
 * 4. Baked vignette overlay (MULTIPLY blend) — darker edges, lighter center
 */

interface PhaseConfig {
  ambient: { r: number; g: number; b: number };
  fillIntensity: number;
  fillColor: number;
  brightness: number;
  saturate: number;
  vignetteAlpha: number;
}

const PHASES: Record<string, PhaseConfig> = {
  morning: {
    ambient: { r: 0.88, g: 0.83, b: 0.75 },
    fillIntensity: 0.3, fillColor: 0xfff0d0,
    brightness: 0.98, saturate: 0.05,
    vignetteAlpha: 0.05,
  },
  day: {
    ambient: { r: 0.95, g: 0.95, b: 0.93 },
    fillIntensity: 0.2, fillColor: 0xffffff,
    brightness: 1.0, saturate: 0,
    vignetteAlpha: 0,
  },
  evening: {
    ambient: { r: 0.72, g: 0.62, b: 0.50 },
    fillIntensity: 0.45, fillColor: 0xffddaa,
    brightness: 0.92, saturate: -0.08,
    vignetteAlpha: 0.18,
  },
  night: {
    ambient: { r: 0.45, g: 0.42, b: 0.55 },
    fillIntensity: 0.35, fillColor: 0xccccff,
    brightness: 0.85, saturate: -0.15,
    vignetteAlpha: 0.25,
  },
};

function getPhase(hour: number): string {
  if (hour >= 6 && hour < 9) return "morning";
  if (hour >= 9 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export class DayNightCycle {
  private scene: Phaser.Scene;
  private lastPhase = "";
  private fillLight: Phaser.GameObjects.Light | null = null;
  private colorMatrix: Phaser.FX.ColorMatrix | null = null;
  private vignetteOverlay: Phaser.GameObjects.Image | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Enable Light2D pipeline
    scene.lights.enable();
    scene.lights.setAmbientColor(Phaser.Display.Color.GetColor(240, 240, 235));

    // Apply Light2D pipeline to all existing Images
    scene.children.list.forEach((child) => {
      if (child instanceof Phaser.GameObjects.Image && child.depth >= 0) {
        try { child.setPipeline("Light2D"); } catch { /* skip */ }
      }
    });

    // Create one large soft fill light (Light2D system, NOT pointlight sprite)
    // Centered in room, huge radius = ambient wash, not visible circle
    this.fillLight = scene.lights.addLight(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50,
      1200,    // radius — very large = covers whole room softly
      0xffffff,
      0.2,     // intensity — very dim
    );

    // Camera PostFX ColorMatrix for brightness/saturation
    try {
      this.colorMatrix = scene.cameras.main.postFX.addColorMatrix();
    } catch { /* WebGL only */ }

    // Baked vignette overlay (radial gradient: transparent center, dark edges)
    this.createVignetteOverlay();

    // Apply initial phase
    this.applyPhase(getPhase(new Date().getHours()));
  }

  /** Generate vignette texture once — radial gradient, MULTIPLY blend */
  private createVignetteOverlay(): void {
    const key = "vignette_overlay";
    if (this.scene.textures.exists(key)) {
      this.vignetteOverlay = this.scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key);
    } else {
      const g = this.scene.add.graphics();
      const cx = GAME_WIDTH / 2;
      const cy = GAME_HEIGHT / 2;
      const maxR = Math.max(GAME_WIDTH, GAME_HEIGHT) * 0.7;

      // Draw concentric rings from outside (dark) to inside (transparent)
      const steps = 20;
      for (let i = steps; i >= 0; i--) {
        const t = i / steps;
        const r = maxR * t;
        // Alpha: 0 at center, increases toward edges
        const alpha = t * t * 0.4; // quadratic falloff, max 0.4
        g.fillStyle(0x000000, alpha);
        g.fillCircle(cx, cy, r);
      }

      g.generateTexture(key, GAME_WIDTH, GAME_HEIGHT);
      g.destroy();
      this.vignetteOverlay = this.scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key);
    }

    this.vignetteOverlay.setDepth(89); // below HUD (90+) and bubbles
    this.vignetteOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.vignetteOverlay.setAlpha(0);
  }

  /** Call from RoomScene.update() */
  update(): void {
    const config = getVisualConfig();

    if (!config.dayNightCycle) {
      if (this.lastPhase !== "bright") {
        this.applyBright();
        this.lastPhase = "bright";
      }
      return;
    }

    const phase = getPhase(new Date().getHours());
    if (phase !== this.lastPhase) {
      this.applyPhase(phase);
    }
  }

  private applyBright(): void {
    this.setAmbient({ r: 0.95, g: 0.95, b: 0.93 });
    if (this.fillLight) this.fillLight.intensity = 0.2;
    if (this.colorMatrix) {
      this.colorMatrix.reset();
      this.colorMatrix.brightness(1.0);
    }
    if (this.vignetteOverlay) this.vignetteOverlay.setAlpha(0);
  }

  private applyPhase(phase: string): void {
    const cfg = PHASES[phase] ?? PHASES.day;

    // Switch room background texture (day/night)
    const isNight = phase === "night" || phase === "evening";
    const roomScene = this.scene as unknown as RoomScene;
    if (typeof roomScene.setBackgroundTime === "function") {
      roomScene.setBackgroundTime(isNight);
    }

    this.setAmbient(cfg.ambient);

    if (this.fillLight) {
      this.fillLight.intensity = cfg.fillIntensity;
      const rgb = Phaser.Display.Color.IntegerToRGB(cfg.fillColor);
      this.fillLight.color.set(rgb.r / 255, rgb.g / 255, rgb.b / 255);
    }

    if (this.colorMatrix) {
      this.colorMatrix.reset();
      if (cfg.brightness !== 1.0) this.colorMatrix.brightness(cfg.brightness);
      if (cfg.saturate !== 0) this.colorMatrix.saturate(cfg.saturate);
    }

    if (this.vignetteOverlay) {
      this.vignetteOverlay.setAlpha(cfg.vignetteAlpha);
    }

    this.lastPhase = phase;
  }

  private setAmbient(c: { r: number; g: number; b: number }): void {
    this.scene.lights.setAmbientColor(
      Phaser.Display.Color.GetColor(
        Math.round(c.r * 255),
        Math.round(c.g * 255),
        Math.round(c.b * 255),
      ),
    );
  }
}
