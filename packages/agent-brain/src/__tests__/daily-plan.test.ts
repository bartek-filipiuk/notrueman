import { describe, it, expect, vi, beforeEach } from "vitest";
import { DailyPlanSchema } from "@nts/shared";

// Mock AI SDK
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
import { generateDailyPlan } from "../daily-plan.js";
import { createLLMClient } from "../llm-client.js";

const MOCK_PLAN = {
  activities: [
    { activity: "read", timeBlock: "morning", description: "Read philosophy book", estimatedDurationMin: 60 },
    { activity: "cook", timeBlock: "morning", description: "Make breakfast", estimatedDurationMin: 30 },
    { activity: "exercise", timeBlock: "afternoon", description: "Yoga on the mat", estimatedDurationMin: 45 },
    { activity: "computer", timeBlock: "afternoon", description: "Write in journal", estimatedDurationMin: 60 },
    { activity: "draw", timeBlock: "evening", description: "Sketch the view from window", estimatedDurationMin: 45 },
    { activity: "think", timeBlock: "evening", description: "Contemplate the day", estimatedDurationMin: 30 },
  ],
  overallTheme: "A day of quiet creativity and reflection",
};

describe("daily plan generation (T2.3)", () => {
  let client: ReturnType<typeof createLLMClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createLLMClient({
      apiKey: "test-key",
      thinkModel: "deepseek/deepseek-chat",
      classifyModel: "mistralai/mistral-small-latest",
    });
  });

  it("generates a valid daily plan via LLM", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: MOCK_PLAN,
      usage: { inputTokens: 100, outputTokens: 50 },
    } as any);

    const plan = await generateDailyPlan(client, "You are Truman.", "morning");

    expect(plan.overallTheme).toBe("A day of quiet creativity and reflection");
    expect(plan.activities.length).toBe(6);
    // Validate against Zod schema
    expect(() => DailyPlanSchema.parse(plan)).not.toThrow();
  });

  it("passes system prompt and time of day to LLM", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: MOCK_PLAN,
    } as any);

    await generateDailyPlan(client, "You are Truman.", "evening");

    const callArgs = vi.mocked(generateObject).mock.calls[0][0];
    expect(callArgs.system).toContain("You are Truman.");
    expect(callArgs.prompt).toContain("evening");
  });

  it("uses think model for plan generation", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: MOCK_PLAN,
    } as any);

    await generateDailyPlan(client, "System prompt", "morning");

    const callArgs = vi.mocked(generateObject).mock.calls[0][0];
    expect((callArgs.model as any).modelId).toBe("deepseek/deepseek-chat");
  });

  it("plan activities have required fields", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: MOCK_PLAN,
    } as any);

    const plan = await generateDailyPlan(client, "System prompt", "morning");

    for (const activity of plan.activities) {
      expect(activity.activity).toBeDefined();
      expect(activity.timeBlock).toBeDefined();
      expect(activity.description).toBeDefined();
      expect(activity.estimatedDurationMin).toBeGreaterThanOrEqual(15);
    }
  });
});
