import { describe, it, expect, vi } from "vitest";
import { MOOD_BUBBLE_STYLES, ACTIVITY_LIST } from "@nts/shared";

// Mock Phaser to avoid browser-only dependencies
vi.mock("phaser", () => ({
  default: {
    GameObjects: {
      Container: class {},
      Graphics: class {},
      Text: class {},
    },
    Scene: class {},
    Display: {
      Color: {
        HexStringToColor: () => ({ color: 0 }),
      },
    },
    BlendModes: {
      ADD: 1,
    },
    CANVAS: 1,
  },
}));

describe("T5.1: Visual polish smoke tests", () => {
  describe("mood bubble border styles", () => {
    it("all mood styles have a border property", () => {
      for (const [mood, style] of Object.entries(MOOD_BUBBLE_STYLES)) {
        expect(style.border, `${mood} should have a border`).toBeDefined();
        expect(typeof style.border).toBe("string");
      }
    });

    it("supports at least 4 distinct border styles", () => {
      const borderTypes = new Set(
        Object.values(MOOD_BUBBLE_STYLES).map((s) => s.border),
      );
      expect(borderTypes.size).toBeGreaterThanOrEqual(4);
    });

    it("border styles include rounded, angular, wobbly, sharp", () => {
      const borders = Object.values(MOOD_BUBBLE_STYLES).map((s) => s.border);
      expect(borders).toContain("rounded");
      expect(borders).toContain("angular");
      expect(borders).toContain("wobbly");
      expect(borders).toContain("sharp");
    });
  });

  describe("activity visual effects data", () => {
    it("all 8 activities have defined colors in ACTIVITY_EFFECT_COLORS", async () => {
      const { ACTIVITY_EFFECT_COLORS } = await import("../systems/ActivityRenderer");
      for (const activity of ACTIVITY_LIST) {
        expect(
          ACTIVITY_EFFECT_COLORS[activity],
          `${activity} should have a color`,
        ).toBeDefined();
      }
    });
  });

  describe("visual constants", () => {
    it("SHADOW_ALPHA is defined and reasonable", async () => {
      const { SHADOW_ALPHA } = await import("../entities/TrumanSprite");
      expect(SHADOW_ALPHA).toBeGreaterThan(0);
      expect(SHADOW_ALPHA).toBeLessThanOrEqual(0.5);
    });

    it("TRANSITION_DURATION_MS is defined and reasonable", async () => {
      const { TRANSITION_DURATION_MS } = await import("../systems/ActivityRenderer");
      expect(TRANSITION_DURATION_MS).toBeGreaterThanOrEqual(200);
      expect(TRANSITION_DURATION_MS).toBeLessThanOrEqual(1000);
    });

    it("BUBBLE_BORDER_RADIUS varies by border style", async () => {
      const { getBubbleBorderRadius } = await import("../ui/ThoughtBubble");
      // rounded should have high radius
      expect(getBubbleBorderRadius("rounded")).toBeGreaterThanOrEqual(6);
      // sharp should have 0 or very low radius
      expect(getBubbleBorderRadius("sharp")).toBeLessThanOrEqual(2);
      // angular should be moderate
      expect(getBubbleBorderRadius("angular")).toBeLessThanOrEqual(5);
    });

    it("WINDOW_GLOW_COLOR is defined", async () => {
      const { WINDOW_GLOW_COLOR } = await import("../scenes/RoomScene");
      expect(WINDOW_GLOW_COLOR).toBeDefined();
      expect(typeof WINDOW_GLOW_COLOR).toBe("number");
    });
  });

  describe("T7.8: Particle system", () => {
    it("PARTICLE_ACTIVITIES includes cook, computer, sleep, exercise, read, draw", async () => {
      const { PARTICLE_ACTIVITIES } = await import("../systems/ActivityRenderer");
      expect(PARTICLE_ACTIVITIES.has("cook")).toBe(true);
      expect(PARTICLE_ACTIVITIES.has("computer")).toBe(true);
      expect(PARTICLE_ACTIVITIES.has("sleep")).toBe(true);
      expect(PARTICLE_ACTIVITIES.has("exercise")).toBe(true);
      expect(PARTICLE_ACTIVITIES.has("read")).toBe(true);
      expect(PARTICLE_ACTIVITIES.has("draw")).toBe(true);
    });

    it("PARTICLE_ACTIVITIES does NOT include eat and think (Graphics-only)", async () => {
      const { PARTICLE_ACTIVITIES } = await import("../systems/ActivityRenderer");
      expect(PARTICLE_ACTIVITIES.has("eat")).toBe(false);
      expect(PARTICLE_ACTIVITIES.has("think")).toBe(false);
    });

    it("PARTICLE_TEXTURE_KEYS has all required texture keys", async () => {
      const { PARTICLE_TEXTURE_KEYS } = await import("../systems/ParticleManager");
      expect(PARTICLE_TEXTURE_KEYS.STEAM).toBe("particle_steam");
      expect(PARTICLE_TEXTURE_KEYS.SPARK_GREEN).toBe("particle_spark_green");
      expect(PARTICLE_TEXTURE_KEYS.SPARK_BLUE).toBe("particle_spark_blue");
      expect(PARTICLE_TEXTURE_KEYS.ZZZ).toBe("particle_zzz");
      expect(PARTICLE_TEXTURE_KEYS.SWEAT).toBe("particle_sweat");
      expect(PARTICLE_TEXTURE_KEYS.DUST).toBe("particle_dust");
      expect(PARTICLE_TEXTURE_KEYS.PAINT_RED).toBe("particle_paint_red");
      expect(PARTICLE_TEXTURE_KEYS.PAINT_CYAN).toBe("particle_paint_cyan");
      expect(PARTICLE_TEXTURE_KEYS.PAINT_PINK).toBe("particle_paint_pink");
    });

    it("has 9 distinct particle texture keys", async () => {
      const { PARTICLE_TEXTURE_KEYS } = await import("../systems/ParticleManager");
      const keys = Object.values(PARTICLE_TEXTURE_KEYS);
      expect(keys.length).toBe(9);
      expect(new Set(keys).size).toBe(9);
    });
  });
});
