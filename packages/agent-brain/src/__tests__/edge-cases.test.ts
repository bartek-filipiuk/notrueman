import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmotionEngine } from "../emotion-engine.js";
import { getTimeOfDay, sleep } from "../utils.js";
import type { EmotionState } from "@nts/shared";

describe("T5.3: Agent brain edge case tests", () => {
  describe("EmotionEngine extreme drift", () => {
    it("48h+ drift fully converges to defaults", () => {
      const engine = new EmotionEngine({
        happiness: 1.0,
        curiosity: 0.0,
        anxiety: 0.6,
        boredom: 1.0,
        excitement: 0.0,
        contentment: 0.0,
        frustration: 0.7,
      });

      // Simulate 48 hours later
      const now = new Date();
      const future = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      engine.applyTimeDrift(future);

      const state = engine.getState();
      // After 48h, emotions should be very close to defaults
      expect(state.happiness).toBeCloseTo(0.6, 1);
      expect(state.curiosity).toBeCloseTo(0.7, 1);
      expect(state.anxiety).toBeCloseTo(0.2, 1);
      expect(state.frustration).toBeCloseTo(0.1, 1);
    });

    it("negative time delta does not change state", () => {
      const engine = new EmotionEngine();
      const initial = engine.getState();

      // Apply drift with past time
      const past = new Date(Date.now() - 60 * 60 * 1000);
      engine.applyTimeDrift(past);

      const state = engine.getState();
      expect(state).toEqual(initial);
    });

    it("drift from ceiling values stays within bounds", () => {
      const engine = new EmotionEngine({
        happiness: 1.0,
        curiosity: 1.0,
        anxiety: 0.6,
        boredom: 1.0,
        excitement: 1.0,
        contentment: 1.0,
        frustration: 0.7,
      });

      const future = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1h
      engine.applyTimeDrift(future);

      const state = engine.getState();
      for (const key of Object.keys(state) as (keyof EmotionState)[]) {
        expect(state[key]).toBeGreaterThanOrEqual(0);
        expect(state[key]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("EmotionEngine applyDelta edge cases", () => {
    it("empty delta does not change state", () => {
      const engine = new EmotionEngine();
      const initial = engine.getState();
      engine.applyDelta({});
      expect(engine.getState()).toEqual(initial);
    });

    it("delta with zero values does not change state", () => {
      const engine = new EmotionEngine();
      const initial = engine.getState();
      engine.applyDelta({ happiness: 0, anxiety: 0 });
      expect(engine.getState()).toEqual(initial);
    });

    it("large positive delta gets clamped", () => {
      const engine = new EmotionEngine();
      engine.applyDelta({ happiness: 100, frustration: 100 });
      const state = engine.getState();
      expect(state.happiness).toBeLessThanOrEqual(1.0);
      expect(state.frustration).toBeLessThanOrEqual(0.7);
    });

    it("large negative delta gets clamped to floor", () => {
      const engine = new EmotionEngine();
      engine.applyDelta({ happiness: -100 });
      expect(engine.getState().happiness).toBeGreaterThanOrEqual(0.2);
    });
  });

  describe("EmotionEngine mood mapping edge cases", () => {
    it("all emotions at default produces valid mood label", () => {
      const engine = new EmotionEngine();
      const mood = engine.getOverallMood();
      const validMoods = ["happy", "curious", "anxious", "bored", "excited", "content", "frustrated", "contemplative"];
      expect(validMoods).toContain(mood);
    });

    it("extreme positive state produces happy/excited/content mood", () => {
      const engine = new EmotionEngine({
        happiness: 1.0,
        curiosity: 0.5,
        anxiety: 0,
        boredom: 0,
        excitement: 1.0,
        contentment: 1.0,
        frustration: 0,
      });
      const mood = engine.getOverallMood();
      expect(["happy", "excited", "content"]).toContain(mood);
    });

    it("high frustration produces frustrated mood", () => {
      const engine = new EmotionEngine({
        happiness: 0.2,
        curiosity: 0,
        anxiety: 0,
        boredom: 0,
        excitement: 0,
        contentment: 0,
        frustration: 0.7,
      });
      expect(engine.getOverallMood()).toBe("frustrated");
    });
  });

  describe("getTimeOfDay boundary tests", () => {
    it("returns correct period for hour boundaries", () => {
      const originalDate = globalThis.Date;

      // Test boundary at hour 6 (night → morning)
      vi.useFakeTimers({ now: new Date(2026, 0, 1, 5, 59) });
      expect(getTimeOfDay()).toBe("night");

      vi.setSystemTime(new Date(2026, 0, 1, 6, 0));
      expect(getTimeOfDay()).toBe("morning");

      // Test boundary at hour 12 (morning → afternoon)
      vi.setSystemTime(new Date(2026, 0, 1, 11, 59));
      expect(getTimeOfDay()).toBe("morning");

      vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
      expect(getTimeOfDay()).toBe("afternoon");

      // Test boundary at hour 18 (afternoon → evening)
      vi.setSystemTime(new Date(2026, 0, 1, 17, 59));
      expect(getTimeOfDay()).toBe("afternoon");

      vi.setSystemTime(new Date(2026, 0, 1, 18, 0));
      expect(getTimeOfDay()).toBe("evening");

      vi.useRealTimers();
    });
  });

  describe("sleep utility edge cases", () => {
    it("resolves after specified delay", async () => {
      vi.useFakeTimers();
      const promise = sleep(100);
      vi.advanceTimersByTime(100);
      await promise; // should resolve without hanging
      vi.useRealTimers();
    });

    it("resolves immediately for 0ms", async () => {
      vi.useFakeTimers();
      const promise = sleep(0);
      vi.advanceTimersByTime(0);
      await promise;
      vi.useRealTimers();
    });
  });
});
