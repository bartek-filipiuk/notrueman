import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImportanceScoreSchema } from "@nts/shared";

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
import { scoreImportance } from "../importance-scorer.js";
import { createLLMClient } from "../llm-client.js";

describe("importance scoring (T3.5)", () => {
  let client: ReturnType<typeof createLLMClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createLLMClient({
      apiKey: "test-key",
      thinkModel: "deepseek/deepseek-chat",
      classifyModel: "mistralai/mistral-small-latest",
    });
  });

  it("returns a score from 1-10", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { score: 7 },
    } as any);

    const score = await scoreImportance(client, "I realized I've never seen the other side of the door.");
    expect(score).toBe(7);
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(10);
  });

  it("uses classify model (Mistral Small)", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { score: 3 },
    } as any);

    await scoreImportance(client, "I ate a sandwich.");

    const callArgs = vi.mocked(generateObject).mock.calls[0][0];
    expect((callArgs.model as any).modelId).toBe("mistralai/mistral-small-latest");
  });

  it("includes the description in the prompt", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { score: 5 },
    } as any);

    await scoreImportance(client, "The clock seems to be running backwards.");

    const callArgs = vi.mocked(generateObject).mock.calls[0][0];
    expect(callArgs.prompt).toContain("clock seems to be running backwards");
  });

  it("validates output against ImportanceScoreSchema", () => {
    expect(() => ImportanceScoreSchema.parse({ score: 5 })).not.toThrow();
    expect(() => ImportanceScoreSchema.parse({ score: 0 })).toThrow();
    expect(() => ImportanceScoreSchema.parse({ score: 11 })).toThrow();
  });
});
