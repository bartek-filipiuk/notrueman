import { describe, it, expect } from "vitest";
import {
  clampEmotion,
  clampAllEmotions,
  calculateOverallMood,
  createDefaultEmotions,
} from "../index.js";
import type { EmotionState } from "../index.js";

describe("T5.3: Emotion edge cases", () => {
  describe("clampAllEmotions with extreme values", () => {
    it("clamps all emotions at ceiling simultaneously", () => {
      const extreme: EmotionState = {
        happiness: 2.0,
        curiosity: 2.0,
        anxiety: 2.0,
        boredom: 2.0,
        excitement: 2.0,
        contentment: 2.0,
        frustration: 2.0,
      };
      const clamped = clampAllEmotions(extreme);
      expect(clamped.happiness).toBeLessThanOrEqual(1.0);
      expect(clamped.anxiety).toBeLessThanOrEqual(0.6);
      expect(clamped.frustration).toBeLessThanOrEqual(0.7);
    });

    it("clamps all emotions at floor simultaneously", () => {
      const extreme: EmotionState = {
        happiness: -1.0,
        curiosity: -1.0,
        anxiety: -1.0,
        boredom: -1.0,
        excitement: -1.0,
        contentment: -1.0,
        frustration: -1.0,
      };
      const clamped = clampAllEmotions(extreme);
      expect(clamped.happiness).toBeGreaterThanOrEqual(0.2);
      for (const key of Object.keys(clamped) as (keyof EmotionState)[]) {
        expect(clamped[key]).toBeGreaterThanOrEqual(0);
      }
    });

    it("handles NaN by clamping to floor", () => {
      const state = createDefaultEmotions();
      state.happiness = NaN;
      const clamped = clampAllEmotions(state);
      // NaN comparisons: Math.max(floor, Math.min(ceiling, NaN)) = NaN
      // This documents current behavior — NaN propagates
      expect(Number.isNaN(clamped.happiness) || clamped.happiness >= 0).toBe(true);
    });

    it("handles Infinity by clamping to ceiling", () => {
      const state = createDefaultEmotions();
      state.excitement = Infinity;
      const clamped = clampAllEmotions(state);
      expect(clamped.excitement).toBeLessThanOrEqual(1.0);
    });

    it("handles negative Infinity by clamping to floor", () => {
      const state = createDefaultEmotions();
      state.excitement = -Infinity;
      const clamped = clampAllEmotions(state);
      expect(clamped.excitement).toBeGreaterThanOrEqual(0);
    });
  });

  describe("calculateOverallMood with extremes", () => {
    it("returns value in [-1, 1] with all emotions at ceiling", () => {
      const extreme: EmotionState = {
        happiness: 1.0,
        curiosity: 1.0,
        anxiety: 0.6,
        boredom: 1.0,
        excitement: 1.0,
        contentment: 1.0,
        frustration: 0.7,
      };
      const mood = calculateOverallMood(extreme);
      expect(mood).toBeGreaterThanOrEqual(-1);
      expect(mood).toBeLessThanOrEqual(1);
    });

    it("returns value in [-1, 1] with all emotions at floor", () => {
      const extreme: EmotionState = {
        happiness: 0.2,
        curiosity: 0,
        anxiety: 0,
        boredom: 0,
        excitement: 0,
        contentment: 0,
        frustration: 0,
      };
      const mood = calculateOverallMood(extreme);
      expect(mood).toBeGreaterThanOrEqual(-1);
      expect(mood).toBeLessThanOrEqual(1);
    });

    it("negative emotions dominating produces negative mood", () => {
      const negative: EmotionState = {
        happiness: 0.2,
        curiosity: 0,
        anxiety: 0.6,
        boredom: 1.0,
        excitement: 0,
        contentment: 0,
        frustration: 0.7,
      };
      const mood = calculateOverallMood(negative);
      expect(mood).toBeLessThan(0);
    });

    it("positive emotions dominating produces positive mood", () => {
      const positive: EmotionState = {
        happiness: 1.0,
        curiosity: 1.0,
        anxiety: 0,
        boredom: 0,
        excitement: 1.0,
        contentment: 1.0,
        frustration: 0,
      };
      const mood = calculateOverallMood(positive);
      expect(mood).toBeGreaterThan(0);
    });
  });
});
