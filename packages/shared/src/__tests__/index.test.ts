import { describe, it, expect } from "vitest";
import {
  APP_NAME,
  EMOTION_DEFAULTS,
  EMOTION_FLOORS,
  EMOTION_CEILINGS,
  GAME_WIDTH,
  GAME_HEIGHT,
  GAME_FPS,
  EMBEDDING_DIMENSIONS,
  MOOD_BUBBLE_STYLES,
  ACTIVITY_FAILURE_RATES,
  VARIETY_SCORING,
  QUEUE_NAMES,
  clampEmotion,
  clampAllEmotions,
  createDefaultEmotions,
  calculateOverallMood,
  ImportanceScoreSchema,
  EmotionDeltaSchema,
  DailyPlanSchema,
  ActionQueueSchema,
  BubbleTypeSchema,
} from "../index.js";

describe("shared package exports", () => {
  it("exports APP_NAME constant", () => {
    expect(APP_NAME).toBe("No True Man Show");
  });

  it("exports game constants", () => {
    expect(GAME_WIDTH).toBe(960);
    expect(GAME_HEIGHT).toBe(540);
    expect(GAME_FPS).toBe(30);
    expect(EMBEDDING_DIMENSIONS).toBe(768);
  });

  it("exports emotion defaults matching design-spec", () => {
    expect(EMOTION_DEFAULTS.happiness).toBe(0.6);
    expect(EMOTION_DEFAULTS.curiosity).toBe(0.7);
    expect(EMOTION_DEFAULTS.anxiety).toBe(0.2);
    expect(EMOTION_DEFAULTS.frustration).toBe(0.1);
  });

  it("exports emotion floors and ceilings", () => {
    expect(EMOTION_FLOORS.happiness).toBe(0.2);
    expect(EMOTION_CEILINGS.anxiety).toBe(0.6);
    expect(EMOTION_CEILINGS.frustration).toBe(0.7);
  });

  it("exports mood bubble styles for all moods", () => {
    expect(MOOD_BUBBLE_STYLES.happy).toBeDefined();
    expect(MOOD_BUBBLE_STYLES.curious).toBeDefined();
    expect(MOOD_BUBBLE_STYLES.anxious).toBeDefined();
    expect(MOOD_BUBBLE_STYLES.frustrated).toBeDefined();
    expect(MOOD_BUBBLE_STYLES.content).toBeDefined();
    expect(MOOD_BUBBLE_STYLES.contemplative).toBeDefined();
  });

  it("exports activity failure rates", () => {
    expect(ACTIVITY_FAILURE_RATES.sleep).toBe(0);
    expect(ACTIVITY_FAILURE_RATES.cook).toBe(0.3);
  });

  it("exports queue names", () => {
    expect(QUEUE_NAMES.AGENT_ACTION).toBe("agent:action");
    expect(QUEUE_NAMES.RENDERER_COMMAND).toBe("renderer:command");
  });

  it("exports variety scoring thresholds", () => {
    expect(VARIETY_SCORING.HEAVY_PENALTY_HOURS).toBe(2);
    expect(VARIETY_SCORING.NOVELTY_BONUS_VALUE).toBe(1.2);
  });
});

describe("emotion utilities", () => {
  it("clampEmotion respects floor for happiness", () => {
    expect(clampEmotion("happiness", 0.1)).toBe(0.2);
    expect(clampEmotion("happiness", 0.5)).toBe(0.5);
  });

  it("clampEmotion respects ceiling for frustration", () => {
    expect(clampEmotion("frustration", 0.9)).toBe(0.7);
    expect(clampEmotion("frustration", 0.5)).toBe(0.5);
  });

  it("clampEmotion respects ceiling for anxiety", () => {
    expect(clampEmotion("anxiety", 0.8)).toBe(0.6);
  });

  it("clampEmotion clamps to 0-1 range for unconstrained dimensions", () => {
    expect(clampEmotion("curiosity", -0.5)).toBe(0);
    expect(clampEmotion("curiosity", 1.5)).toBe(1);
  });

  it("clampAllEmotions applies all floors and ceilings", () => {
    const extreme = {
      happiness: 0.0,
      curiosity: 0.5,
      anxiety: 1.0,
      boredom: 0.5,
      excitement: 0.5,
      contentment: 0.5,
      frustration: 1.0,
    };
    const clamped = clampAllEmotions(extreme);
    expect(clamped.happiness).toBe(0.2); // floor
    expect(clamped.anxiety).toBe(0.6); // ceiling
    expect(clamped.frustration).toBe(0.7); // ceiling
    expect(clamped.curiosity).toBe(0.5); // unchanged
  });

  it("createDefaultEmotions returns a fresh copy of defaults", () => {
    const a = createDefaultEmotions();
    const b = createDefaultEmotions();
    expect(a).toEqual(EMOTION_DEFAULTS);
    expect(a).not.toBe(b); // different object references
  });

  it("calculateOverallMood returns number in [-1, 1]", () => {
    const mood = calculateOverallMood(EMOTION_DEFAULTS);
    expect(mood).toBeGreaterThanOrEqual(-1);
    expect(mood).toBeLessThanOrEqual(1);
  });

  it("calculateOverallMood is positive for default emotions", () => {
    const mood = calculateOverallMood(EMOTION_DEFAULTS);
    expect(mood).toBeGreaterThan(0);
  });
});

describe("Zod schemas", () => {
  it("ImportanceScoreSchema validates valid scores", () => {
    expect(ImportanceScoreSchema.parse({ score: 5 })).toEqual({ score: 5 });
    expect(ImportanceScoreSchema.parse({ score: 1 })).toEqual({ score: 1 });
    expect(ImportanceScoreSchema.parse({ score: 10 })).toEqual({ score: 10 });
  });

  it("ImportanceScoreSchema rejects out-of-range scores", () => {
    expect(() => ImportanceScoreSchema.parse({ score: 0 })).toThrow();
    expect(() => ImportanceScoreSchema.parse({ score: 11 })).toThrow();
  });

  it("EmotionDeltaSchema validates valid deltas", () => {
    const result = EmotionDeltaSchema.parse({
      happiness: 0.05,
      curiosity: -0.03,
    });
    expect(result.happiness).toBe(0.05);
    expect(result.curiosity).toBe(-0.03);
    // Defaults should fill in
    expect(result.anxiety).toBe(0);
  });

  it("EmotionDeltaSchema rejects out-of-range deltas", () => {
    expect(() =>
      EmotionDeltaSchema.parse({ happiness: 0.5 }),
    ).toThrow();
  });

  it("BubbleTypeSchema validates bubble types", () => {
    expect(BubbleTypeSchema.parse("thought")).toBe("thought");
    expect(BubbleTypeSchema.parse("speech")).toBe("speech");
    expect(() => BubbleTypeSchema.parse("invalid")).toThrow();
  });

  it("DailyPlanSchema validates a plan", () => {
    const plan = {
      activities: [
        { activity: "read", timeBlock: "morning", description: "Read a book", estimatedDurationMin: 60 },
        { activity: "cook", timeBlock: "morning", description: "Make breakfast", estimatedDurationMin: 30 },
        { activity: "exercise", timeBlock: "afternoon", description: "Workout", estimatedDurationMin: 45 },
        { activity: "computer", timeBlock: "afternoon", description: "Work", estimatedDurationMin: 120 },
        { activity: "think", timeBlock: "evening", description: "Reflect", estimatedDurationMin: 30 },
      ],
      overallTheme: "A productive day",
    };
    const result = DailyPlanSchema.parse(plan);
    expect(result.activities).toHaveLength(5);
  });

  it("ActionQueueSchema validates action queue", () => {
    const queue = {
      actions: [
        { action: "read", description: "Pick up book", durationMin: 10 },
        { action: "sit", description: "Sit at desk", durationMin: 5 },
      ],
    };
    const result = ActionQueueSchema.parse(queue);
    expect(result.actions).toHaveLength(2);
  });
});
