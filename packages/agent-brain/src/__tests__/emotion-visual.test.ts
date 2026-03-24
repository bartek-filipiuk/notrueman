import { describe, it, expect } from "vitest";
import { EmotionEngine } from "../emotion-engine.js";
import { MOOD_BUBBLE_STYLES } from "@nts/shared";

/**
 * T3.7: Emotion → visual integration tests.
 * Verify that EmotionEngine moods map to valid bubble styles.
 */
describe("emotion → visual integration (T3.7)", () => {
  it("default mood maps to a valid bubble style", () => {
    const engine = new EmotionEngine();
    const mood = engine.getOverallMood();
    expect(MOOD_BUBBLE_STYLES[mood]).toBeDefined();
  });

  it("happy mood has valid bubble style", () => {
    const engine = new EmotionEngine({
      happiness: 0.9, curiosity: 0.3, anxiety: 0.1,
      boredom: 0.1, excitement: 0.3, contentment: 0.5, frustration: 0.05,
    });
    const mood = engine.getOverallMood();
    const style = MOOD_BUBBLE_STYLES[mood];
    expect(style).toBeDefined();
    expect(style.bubbleColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(style.textColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("frustrated mood has valid bubble style", () => {
    const engine = new EmotionEngine({
      happiness: 0.2, curiosity: 0.2, anxiety: 0.5,
      boredom: 0.4, excitement: 0.1, contentment: 0.2, frustration: 0.7,
    });
    const mood = engine.getOverallMood();
    const style = MOOD_BUBBLE_STYLES[mood];
    expect(style).toBeDefined();
  });

  it("all possible moods have bubble styles defined", () => {
    const moods = [
      "happy", "curious", "anxious", "bored", "excited",
      "content", "frustrated", "contemplative", "neutral",
    ];
    for (const mood of moods) {
      expect(MOOD_BUBBLE_STYLES[mood]).toBeDefined();
    }
  });

  it("mood score influences visual mood selection", () => {
    // Very positive state
    const positive = new EmotionEngine({
      happiness: 0.9, curiosity: 0.8, anxiety: 0.1,
      boredom: 0.1, excitement: 0.9, contentment: 0.8, frustration: 0.05,
    });
    expect(positive.getMoodScore()).toBeGreaterThan(0);

    // Very negative state
    const negative = new EmotionEngine({
      happiness: 0.2, curiosity: 0.2, anxiety: 0.6,
      boredom: 0.5, excitement: 0.1, contentment: 0.2, frustration: 0.7,
    });
    expect(negative.getMoodScore()).toBeLessThan(0);
  });
});
