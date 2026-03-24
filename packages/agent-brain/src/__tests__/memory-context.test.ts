import { describe, it, expect, vi, beforeEach } from "vitest";

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
import { planWithMemoryContext } from "../memory-context.js";
import { createLLMClient } from "../llm-client.js";

describe("memory-informed decisions (T3.9)", () => {
  let client: ReturnType<typeof createLLMClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createLLMClient({
      apiKey: "test-key",
      thinkModel: "deepseek/deepseek-chat",
      classifyModel: "mistralai/mistral-small-latest",
    });
  });

  it("includes memory context in planning prompt", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        activity: "read",
        durationSeconds: 120,
        thought: "I remember enjoying that book.",
        reason: "Memory of good reading experience",
      },
    } as any);

    await planWithMemoryContext(client, "System prompt", {
      timeOfDay: "afternoon",
      currentMood: "curious",
      recentActivities: [],
      memories: [
        "I really enjoyed reading the philosophy book yesterday.",
        "Drawing always makes me feel calm.",
      ],
    });

    const callArgs = vi.mocked(generateObject).mock.calls[0][0];
    expect(callArgs.prompt).toContain("philosophy book");
    expect(callArgs.prompt).toContain("Drawing always makes me feel calm");
  });

  it("works without memories", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        activity: "think",
        durationSeconds: 60,
        thought: "What should I do?",
        reason: "No strong memories",
      },
    } as any);

    const result = await planWithMemoryContext(client, "System prompt", {
      timeOfDay: "morning",
      currentMood: "neutral",
      recentActivities: [],
      memories: [],
    });

    expect(result.activity).toBe("think");
  });

  it("returns a valid ActionCommand", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        activity: "cook",
        durationSeconds: 180,
        thought: "Time for breakfast.",
        reason: "Hungry",
      },
    } as any);

    const result = await planWithMemoryContext(client, "System prompt", {
      timeOfDay: "morning",
      currentMood: "happy",
      recentActivities: [],
      memories: ["I haven't eaten in a while."],
    });

    expect(result.activity).toBe("cook");
    expect(result.durationSeconds).toBe(180);
  });
});
