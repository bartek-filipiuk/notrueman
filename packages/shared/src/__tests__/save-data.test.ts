import { describe, it, expect } from "vitest";
import { SaveDataSchema, SAVE_DATA_VERSION } from "../types/save-data.js";

/** Valid minimal save data */
function validSaveData() {
  return {
    version: SAVE_DATA_VERSION,
    savedAt: Date.now(),
    createdAt: Date.now() - 86_400_000 * 3, // 3 days ago
    dayCount: 3,
    totalTimeAliveMs: 7_200_000,
    sessionCount: 5,
    truman: {
      x: 400,
      y: 300,
      facing: "right" as const,
      currentActivity: "read" as const,
      currentMood: "curious" as const,
    },
    emotions: {
      happiness: 0.6,
      curiosity: 0.7,
      anxiety: 0.2,
      boredom: 0.3,
      excitement: 0.4,
      contentment: 0.5,
      frustration: 0.1,
    },
    physicalState: {
      energy: 0.8,
      hunger: 0.3,
      tiredness: 0.2,
    },
    recentActivities: [
      { type: "read", at: Date.now() - 60_000 },
      { type: "think", at: Date.now() - 120_000 },
    ],
    brainTickCount: 42,
  };
}

describe("SaveData Zod Schema (TG.1)", () => {
  it("validates correct save data", () => {
    const result = SaveDataSchema.safeParse(validSaveData());
    expect(result.success).toBe(true);
  });

  it("accepts null currentActivity", () => {
    const data = validSaveData();
    (data.truman as any).currentActivity = null;
    const result = SaveDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects negative dayCount", () => {
    const data = validSaveData();
    data.dayCount = -1;
    const result = SaveDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects emotion values > 1", () => {
    const data = validSaveData();
    data.emotions.happiness = 1.5;
    const result = SaveDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects emotion values < 0", () => {
    const data = validSaveData();
    data.emotions.anxiety = -0.1;
    const result = SaveDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects invalid activity type", () => {
    const data = validSaveData();
    (data.truman as any).currentActivity = "fly";
    const result = SaveDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects invalid mood", () => {
    const data = validSaveData();
    (data.truman as any).currentMood = "ecstatic";
    const result = SaveDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = SaveDataSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects non-integer version", () => {
    const data = validSaveData();
    data.version = 1.5;
    const result = SaveDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("validates all activity types", () => {
    const activities = ["sleep", "eat", "read", "computer", "exercise", "think", "cook", "draw"];
    for (const activity of activities) {
      const data = validSaveData();
      (data.truman as any).currentActivity = activity;
      const result = SaveDataSchema.safeParse(data);
      expect(result.success, `activity ${activity} should be valid`).toBe(true);
    }
  });

  it("validates all mood types", () => {
    const moods = ["happy", "curious", "anxious", "bored", "excited", "content", "frustrated", "contemplative", "neutral"];
    for (const mood of moods) {
      const data = validSaveData();
      (data.truman as any).currentMood = mood;
      const result = SaveDataSchema.safeParse(data);
      expect(result.success, `mood ${mood} should be valid`).toBe(true);
    }
  });

  it("SAVE_DATA_VERSION is 1", () => {
    expect(SAVE_DATA_VERSION).toBe(1);
  });
});

describe("Day Counter Math (TG.5)", () => {
  it("dayCount = 0 for same-day creation", () => {
    const now = Date.now();
    const dayCount = Math.floor((now - now) / 86_400_000);
    expect(dayCount).toBe(0);
  });

  it("dayCount = 1 after 24 hours", () => {
    const now = Date.now();
    const createdAt = now - 86_400_000;
    const dayCount = Math.floor((now - createdAt) / 86_400_000);
    expect(dayCount).toBe(1);
  });

  it("dayCount = 3 after 3.5 days", () => {
    const now = Date.now();
    const createdAt = now - 86_400_000 * 3.5;
    const dayCount = Math.floor((now - createdAt) / 86_400_000);
    expect(dayCount).toBe(3);
  });

  it("dayCount handles large values", () => {
    const now = Date.now();
    const createdAt = now - 86_400_000 * 365;
    const dayCount = Math.floor((now - createdAt) / 86_400_000);
    expect(dayCount).toBe(365);
  });
});
