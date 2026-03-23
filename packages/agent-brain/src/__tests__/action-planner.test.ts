import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActionCommandSchema } from "@nts/shared";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn(() => {
    const modelFn = (modelId: string) => ({ modelId, provider: "openrouter" });
    return modelFn;
  }),
}));

import { generateObject } from "ai";
import { planNextAction, calculateVarietyScores } from "../action-planner.js";
import { createLLMClient } from "../llm-client.js";

const MOCK_ACTION = {
  activity: "read" as const,
  durationSeconds: 120,
  thought: "I should read that philosophy book I started yesterday.",
  reason: "Haven't read in a while and feeling curious",
};

describe("action planner (T2.4)", () => {
  let client: ReturnType<typeof createLLMClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createLLMClient({
      apiKey: "test-key",
      thinkModel: "deepseek/deepseek-chat",
      classifyModel: "mistralai/mistral-small-latest",
    });
  });

  it("planNextAction returns a valid ActionCommand", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: MOCK_ACTION } as any);

    const action = await planNextAction(client, "You are Truman.", {
      timeOfDay: "afternoon",
      currentMood: "curious",
      recentActivities: [],
    });

    expect(action.activity).toBe("read");
    expect(action.durationSeconds).toBe(120);
    expect(action.thought).toBeDefined();
    expect(() => ActionCommandSchema.parse(action)).not.toThrow();
  });

  it("includes recent activities in prompt for anti-repetition", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: MOCK_ACTION } as any);

    await planNextAction(client, "System prompt", {
      timeOfDay: "morning",
      currentMood: "happy",
      recentActivities: [
        { activity: "eat", completedSecondsAgo: 300 },
        { activity: "sleep", completedSecondsAgo: 3600 },
      ],
    });

    const callArgs = vi.mocked(generateObject).mock.calls[0][0];
    expect(callArgs.prompt).toContain("recently done");
    expect(callArgs.prompt).toContain("eat");
  });

  it("includes mood and time of day in prompt", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({ object: MOCK_ACTION } as any);

    await planNextAction(client, "System prompt", {
      timeOfDay: "evening",
      currentMood: "contemplative",
      recentActivities: [],
    });

    const callArgs = vi.mocked(generateObject).mock.calls[0][0];
    expect(callArgs.prompt).toContain("evening");
    expect(callArgs.prompt).toContain("contemplative");
  });
});

describe("variety scoring", () => {
  it("returns 1.0 for activities with no recent history", () => {
    const scores = calculateVarietyScores([]);
    expect(scores["read"]).toBe(1.0);
    expect(scores["sleep"]).toBe(1.0);
  });

  it("penalizes very recent activities (< 30 min) with 0.2", () => {
    const scores = calculateVarietyScores([
      { activity: "eat", completedSecondsAgo: 600 }, // 10 min ago
    ]);
    expect(scores["eat"]).toBe(0.2);
  });

  it("gives medium penalty for activities 30-90 min ago", () => {
    const scores = calculateVarietyScores([
      { activity: "read", completedSecondsAgo: 3600 }, // 60 min ago
    ]);
    expect(scores["read"]).toBe(0.5);
  });

  it("gives light penalty for activities 1.5-3h ago", () => {
    const scores = calculateVarietyScores([
      { activity: "exercise", completedSecondsAgo: 7200 }, // 2h ago
    ]);
    expect(scores["exercise"]).toBe(0.8);
  });

  it("no penalty for activities over 3h ago", () => {
    const scores = calculateVarietyScores([
      { activity: "think", completedSecondsAgo: 14400 }, // 4h ago
    ]);
    expect(scores["think"]).toBe(1.0);
  });

  it("takes lowest score for duplicate activities", () => {
    const scores = calculateVarietyScores([
      { activity: "cook", completedSecondsAgo: 600 },   // 10 min: 0.2
      { activity: "cook", completedSecondsAgo: 7200 },  // 2h: 0.8
    ]);
    expect(scores["cook"]).toBe(0.2);
  });
});
