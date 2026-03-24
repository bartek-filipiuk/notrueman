import { describe, it, expect } from "vitest";

/**
 * AmbientManager unit tests (T8.2).
 * Tests the mapping logic and configuration of ambient sounds.
 * Browser Audio API not available in Vitest, so we test pure logic.
 */

describe("AmbientManager (T8.2)", () => {
  describe("activity-to-sound mapping", () => {
    // Import the mapping to verify it matches visual-spec S9.2
    it("maps activity types to correct ambient sound keys", async () => {
      const mod = await import("../systems/AmbientManager");
      const mapping = mod.ACTIVITY_SOUND_MAP;

      expect(mapping.computer).toBe("ambient_typing");
      expect(mapping.cook).toBe("ambient_sizzle");
      expect(mapping.read).toBe("ambient_page_turn");
      expect(mapping.exercise).toBe("ambient_breathing");
      expect(mapping.draw).toBe("ambient_pencil");
      // Activities with no specific ambient sound
      expect(mapping.sleep).toBeUndefined();
      expect(mapping.eat).toBeUndefined();
      expect(mapping.think).toBeUndefined();
    });
  });

  describe("sound volume configuration", () => {
    it("defines volumes matching visual-spec S9.2", async () => {
      const mod = await import("../systems/AmbientManager");
      const volumes = mod.AMBIENT_VOLUMES;

      // Clock ticking: 10%
      expect(volumes.ambient_clock).toBeCloseTo(0.1, 1);
      // Cooking sizzle: 30%
      expect(volumes.ambient_sizzle).toBeCloseTo(0.3, 1);
      // Keyboard typing: 20%
      expect(volumes.ambient_typing).toBeCloseTo(0.2, 1);
      // Page turning: 15%
      expect(volumes.ambient_page_turn).toBeCloseTo(0.15, 1);
      // Pencil scratching: 15%
      expect(volumes.ambient_pencil).toBeCloseTo(0.15, 1);
      // Exercise breathing: 20%
      expect(volumes.ambient_breathing).toBeCloseTo(0.2, 1);
      // Night crickets: 10%
      expect(volumes.ambient_crickets).toBeCloseTo(0.1, 1);
    });
  });

  describe("time-of-day ambient sounds", () => {
    it("identifies night hours correctly (21:00 - 05:59)", async () => {
      const mod = await import("../systems/AmbientManager");
      const isNight = mod.isNightTime;

      expect(isNight(21)).toBe(true);
      expect(isNight(0)).toBe(true);
      expect(isNight(3)).toBe(true);
      expect(isNight(5)).toBe(true);
      expect(isNight(6)).toBe(false);
      expect(isNight(12)).toBe(false);
      expect(isNight(20)).toBe(false);
    });
  });

  describe("ProceduralAudio sound keys", () => {
    it("defines all required sound generation functions", async () => {
      const mod = await import("../systems/ProceduralAudio");

      expect(typeof mod.generateClockTick).toBe("function");
      expect(typeof mod.generateTyping).toBe("function");
      expect(typeof mod.generateSizzle).toBe("function");
      expect(typeof mod.generatePageTurn).toBe("function");
      expect(typeof mod.generateBreathing).toBe("function");
      expect(typeof mod.generatePencilScratch).toBe("function");
      expect(typeof mod.generateCrickets).toBe("function");
      expect(typeof mod.generateAllAmbientSounds).toBe("function");
    });
  });

  describe("AmbientManager class", () => {
    it("is importable and constructable interface is correct", async () => {
      const mod = await import("../systems/AmbientManager");
      expect(mod.AmbientManager).toBeDefined();
      expect(typeof mod.AmbientManager).toBe("function");
    });
  });
});
