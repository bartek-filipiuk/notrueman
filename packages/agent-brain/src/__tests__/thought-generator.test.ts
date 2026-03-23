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

import { generateText } from "ai";
import { generateThought } from "../thought-generator.js";
import { createLLMClient } from "../llm-client.js";

describe("thought generation (T2.5)", () => {
  let client: ReturnType<typeof createLLMClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createLLMClient({
      apiKey: "test-key",
      thinkModel: "deepseek/deepseek-chat",
      classifyModel: "mistralai/mistral-small-latest",
    });
  });

  it("generates a thought string for an activity", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "There's something meditative about stirring soup. The rhythm of it, the warmth.",
    } as any);

    const thought = await generateThought(client, "You are Truman.", {
      activity: "cook",
      mood: "content",
      timeOfDay: "evening",
    });

    expect(thought).toBe("There's something meditative about stirring soup. The rhythm of it, the warmth.");
  });

  it("includes activity and mood in the prompt", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: "A thought." } as any);

    await generateThought(client, "System prompt", {
      activity: "read",
      mood: "curious",
      timeOfDay: "afternoon",
    });

    const callArgs = vi.mocked(generateText).mock.calls[0][0];
    expect(callArgs.prompt).toContain("read");
    expect(callArgs.prompt).toContain("curious");
    expect(callArgs.prompt).toContain("afternoon");
  });

  it("includes recent thought for continuity when provided", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: "Continuing thought." } as any);

    await generateThought(client, "System prompt", {
      activity: "think",
      mood: "philosophical",
      timeOfDay: "night",
      recentThought: "I wonder why the stars are so quiet.",
    });

    const callArgs = vi.mocked(generateText).mock.calls[0][0];
    expect(callArgs.prompt).toContain("stars are so quiet");
  });

  it("uses think model for thought generation", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: "Deep thought." } as any);

    await generateThought(client, "System prompt", {
      activity: "exercise",
      mood: "energetic",
      timeOfDay: "morning",
    });

    const callArgs = vi.mocked(generateText).mock.calls[0][0];
    expect((callArgs.model as any).modelId).toBe("deepseek/deepseek-chat");
  });

  it("trims whitespace from generated text", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "  A clean thought.  \n",
    } as any);

    const thought = await generateThought(client, "System prompt", {
      activity: "draw",
      mood: "happy",
      timeOfDay: "afternoon",
    });

    expect(thought).toBe("A clean thought.");
  });
});
