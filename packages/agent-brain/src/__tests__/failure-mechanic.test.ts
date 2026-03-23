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
import { checkActivityFailure } from "../failure-mechanic.js";
import { createLLMClient } from "../llm-client.js";

describe("failure mechanic (T2.6)", () => {
  let client: ReturnType<typeof createLLMClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createLLMClient({
      apiKey: "test-key",
      thinkModel: "deepseek/deepseek-chat",
      classifyModel: "mistralai/mistral-small-latest",
    });
  });

  it("returns no failure when random > failureRate", async () => {
    const result = await checkActivityFailure(
      client, "System prompt", "cook", "happy",
      { failureRate: 0.25 },
      () => 0.5, // > 0.25 => no failure
    );

    expect(result.failed).toBe(false);
    expect(result.failureType).toBeUndefined();
    expect(result.reaction).toBeUndefined();
  });

  it("returns failure when random < failureRate", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "Well, that's the third time this week the eggs have outsmarted me.",
    } as any);

    const result = await checkActivityFailure(
      client, "System prompt", "cook", "content",
      { failureRate: 0.25 },
      () => 0.1, // < 0.25 => failure
    );

    expect(result.failed).toBe(true);
    expect(result.failureType).toBeDefined();
    expect(result.reaction).toBeDefined();
    expect(result.reaction!.length).toBeGreaterThan(0);
  });

  it("uses default 25% failure rate", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "Of course the pen ran out mid-sentence.",
    } as any);

    const result = await checkActivityFailure(
      client, "System prompt", "draw", "happy",
      {},
      () => 0.2, // < default 0.25
    );

    expect(result.failed).toBe(true);
  });

  it("generates comedic failure type when random > 0.5", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "I just tripped over my own yoga mat. Classic.",
    } as any);

    // First random (0.1) for failure check, second random (0.8) for type
    let callCount = 0;
    const randomFn = () => {
      callCount++;
      return callCount === 1 ? 0.1 : 0.8;
    };

    const result = await checkActivityFailure(
      client, "System prompt", "exercise", "happy",
      { failureRate: 0.25 },
      randomFn,
    );

    expect(result.failed).toBe(true);
    expect(result.failureType).toBe("comedic");
  });

  it("generates minor failure type when random <= 0.5", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "The page won't turn. Fine.",
    } as any);

    let callCount = 0;
    const randomFn = () => {
      callCount++;
      return callCount === 1 ? 0.1 : 0.3;
    };

    const result = await checkActivityFailure(
      client, "System prompt", "read", "neutral",
      { failureRate: 0.25 },
      randomFn,
    );

    expect(result.failed).toBe(true);
    expect(result.failureType).toBe("minor");
  });

  it("includes activity and mood in LLM prompt for reaction", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: "Reaction." } as any);

    await checkActivityFailure(
      client, "System prompt", "computer", "frustrated",
      { failureRate: 1.0 }, // always fail
      () => 0.0,
    );

    const callArgs = vi.mocked(generateText).mock.calls[0][0];
    expect(callArgs.prompt).toContain("computer");
    expect(callArgs.prompt).toContain("frustrated");
  });
});
