import { describe, it, expect } from "vitest";
import { EmotionEngine } from "../emotion-engine.js";
import { EMOTION_DEFAULTS } from "@nts/shared";

describe("emotion engine (T3.6)", () => {
  it("initializes with defaults", () => {
    const engine = new EmotionEngine();
    const state = engine.getState();
    expect(state.happiness).toBe(EMOTION_DEFAULTS.happiness);
    expect(state.curiosity).toBe(EMOTION_DEFAULTS.curiosity);
    expect(state.frustration).toBe(EMOTION_DEFAULTS.frustration);
  });

  it("initializes with custom state", () => {
    const engine = new EmotionEngine({
      happiness: 0.9, curiosity: 0.3, anxiety: 0.1,
      boredom: 0.2, excitement: 0.8, contentment: 0.4, frustration: 0.05,
    });
    expect(engine.getState().happiness).toBe(0.9);
    expect(engine.getState().excitement).toBe(0.8);
  });

  it("applyDelta changes emotions", () => {
    const engine = new EmotionEngine();
    const before = engine.getState().happiness;

    engine.applyDelta({ happiness: 0.1 });

    expect(engine.getState().happiness).toBeCloseTo(before + 0.1, 5);
  });

  it("applyDelta clamps to floors and ceilings", () => {
    const engine = new EmotionEngine();

    // Push frustration above ceiling (0.7)
    engine.applyDelta({ frustration: 1.0 });
    expect(engine.getState().frustration).toBeLessThanOrEqual(0.7);

    // Push happiness below floor (0.2)
    engine.applyDelta({ happiness: -1.0 });
    expect(engine.getState().happiness).toBeGreaterThanOrEqual(0.2);
  });

  it("getOverallMood returns a valid mood label", () => {
    const engine = new EmotionEngine();
    const mood = engine.getOverallMood();
    const validMoods = [
      "happy", "curious", "anxious", "bored", "excited",
      "content", "frustrated", "contemplative", "neutral",
    ];
    expect(validMoods).toContain(mood);
  });

  it("getMoodScore returns a number between -1 and 1", () => {
    const engine = new EmotionEngine();
    const score = engine.getMoodScore();
    expect(score).toBeGreaterThanOrEqual(-1);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("applyTimeDrift moves emotions toward defaults", () => {
    const engine = new EmotionEngine({
      happiness: 0.9, curiosity: 0.9, anxiety: 0.5,
      boredom: 0.8, excitement: 0.9, contentment: 0.9, frustration: 0.5,
    });

    // Simulate 2 hours passing
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000);
    engine.applyTimeDrift(future);

    const state = engine.getState();
    // Emotions should have drifted toward defaults
    expect(state.happiness).toBeLessThan(0.9);
    expect(state.happiness).toBeGreaterThan(EMOTION_DEFAULTS.happiness);
  });

  it("time drift with zero elapsed time is a no-op", () => {
    const engine = new EmotionEngine();
    const before = engine.getState();
    engine.applyTimeDrift(new Date());
    const after = engine.getState();

    expect(after.happiness).toBeCloseTo(before.happiness, 5);
  });

  it("setState replaces state and clamps", () => {
    const engine = new EmotionEngine();
    engine.setState({
      happiness: 1.5, // should be clamped to ceiling
      curiosity: 0.5, anxiety: 0.3, boredom: 0.2,
      excitement: 0.4, contentment: 0.6, frustration: 0.1,
    });

    expect(engine.getState().happiness).toBeLessThanOrEqual(1.0);
  });
});
