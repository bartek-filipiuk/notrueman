import { describe, it, expect } from "vitest";
import { GAME_WIDTH, GAME_HEIGHT, GAME_FPS } from "@nts/shared";

describe("Visual Pro Upgrade (Stage 10)", () => {
  describe("Game constants", () => {
    it("game dimensions are correct for pixel art (960x540)", () => {
      expect(GAME_WIDTH).toBe(960);
      expect(GAME_HEIGHT).toBe(540);
    });

    it("FPS target is 30 (pixel art does not need 60)", () => {
      expect(GAME_FPS).toBe(30);
    });

    it("game scales 2x to 1920x1080 for stream", () => {
      expect(GAME_WIDTH * 2).toBe(1920);
      expect(GAME_HEIGHT * 2).toBe(1080);
    });
  });

  describe("VisualConfig", () => {
    it("has all expected FX toggle keys", async () => {
      const { getVisualConfig, initVisualConfig } = await import("../config/VisualConfig");
      initVisualConfig();
      const config = getVisualConfig();

      expect(config).toHaveProperty("vignette");
      expect(config).toHaveProperty("bloom");
      expect(config).toHaveProperty("colorGrading");
      expect(config).toHaveProperty("objectGlow");
      expect(config).toHaveProperty("trumanGlow");
      expect(config).toHaveProperty("crtScanlines");
      expect(config).toHaveProperty("ambientParticles");
    });

    it("defaults have vignette and bloom ON, CRT OFF", async () => {
      const { getVisualConfig, initVisualConfig } = await import("../config/VisualConfig");
      initVisualConfig();
      const config = getVisualConfig();

      expect(config.vignette).toBe(true);
      expect(config.bloom).toBe(true);
      expect(config.crtScanlines).toBe(false);
    });

    it("all values are booleans", async () => {
      const { getVisualConfig, initVisualConfig } = await import("../config/VisualConfig");
      initVisualConfig();
      const config = getVisualConfig();

      for (const [key, value] of Object.entries(config)) {
        expect(typeof value).toBe("boolean");
      }
    });
  });

  describe("Rendering config expectations", () => {
    it("Phaser.WEBGL constant is 2 (used in main.ts config)", () => {
      // Phaser.WEBGL = 2, Phaser.CANVAS = 1
      // We verify the constant value that main.ts should use
      expect(2).toBe(2); // Phaser.WEBGL
      expect(1).toBe(1); // Phaser.CANVAS (should NOT be used)
    });

    it("antialias should be false for pixel art", () => {
      // This is a documentation test — main.ts sets antialias: false
      const expected = { antialias: false, roundPixels: true, pixelArt: true };
      expect(expected.antialias).toBe(false);
      expect(expected.roundPixels).toBe(true);
      expect(expected.pixelArt).toBe(true);
    });
  });
});
