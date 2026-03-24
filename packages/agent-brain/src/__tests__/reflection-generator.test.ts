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
import { generateReflections } from "../reflection-generator.js";
import { createLLMClient } from "../llm-client.js";

describe("reflection generation (T3.8)", () => {
  let client: ReturnType<typeof createLLMClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createLLMClient({
      apiKey: "test-key",
      thinkModel: "deepseek/deepseek-chat",
      classifyModel: "mistralai/mistral-small-latest",
    });
  });

  it("generates reflections from observations", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "Small acts of attention are what make a place feel like home.\nThe world reveals its patterns to those who sit still long enough.",
    } as any);

    const result = await generateReflections(client, "You are Truman.", [
      { id: "1", description: "I watered the plant carefully this morning." },
      { id: "2", description: "The sunlight made patterns on the floor." },
      { id: "3", description: "I noticed the clock's ticking for the first time." },
    ]);

    expect(result.reflections.length).toBeGreaterThanOrEqual(1);
    expect(result.reflections.length).toBeLessThanOrEqual(3);
    expect(result.sourceIds).toEqual(["1", "2", "3"]);
  });

  it("returns empty for no observations", async () => {
    const result = await generateReflections(client, "System prompt", []);

    expect(result.reflections).toHaveLength(0);
    expect(result.sourceIds).toHaveLength(0);
    expect(vi.mocked(generateText)).not.toHaveBeenCalled();
  });

  it("caps reflections at 3", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "Reflection 1\nReflection 2\nReflection 3\nReflection 4\nReflection 5",
    } as any);

    const result = await generateReflections(client, "System prompt", [
      { id: "1", description: "Observation 1" },
    ]);

    expect(result.reflections.length).toBeLessThanOrEqual(3);
  });

  it("strips numbering from LLM output", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "1. First insight.\n2. Second insight.",
    } as any);

    const result = await generateReflections(client, "System prompt", [
      { id: "1", description: "Observation" },
    ]);

    expect(result.reflections[0]).toBe("First insight.");
    expect(result.reflections[1]).toBe("Second insight.");
  });

  it("uses think model for reflection generation", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: "A reflection." } as any);

    await generateReflections(client, "System prompt", [
      { id: "1", description: "Observation" },
    ]);

    const callArgs = vi.mocked(generateText).mock.calls[0][0];
    expect((callArgs.model as any).modelId).toBe("deepseek/deepseek-chat");
  });
});
