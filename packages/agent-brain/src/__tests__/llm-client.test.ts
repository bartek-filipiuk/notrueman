import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * T2.1: Vercel AI SDK setup tests.
 * Tests the LLM client wrapper that uses AI SDK 6 + OpenRouter.
 * Uses mocked AI SDK functions to avoid real API calls.
 */

// Mock AI SDK functions before imports
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

import { createLLMClient } from "../llm-client.js";
import { generateText, generateObject } from "ai";
import type { LLMClient } from "../llm-client.js";

describe("LLM client (T2.1)", () => {
  let client: LLMClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createLLMClient({
      apiKey: "test-key-123",
      thinkModel: "deepseek/deepseek-chat",
      classifyModel: "mistralai/mistral-small-latest",
    });
  });

  it("createLLMClient returns an object with generateText and generateObject methods", () => {
    expect(client).toBeDefined();
    expect(typeof client.generateText).toBe("function");
    expect(typeof client.generateObject).toBe("function");
  });

  it("generateText calls AI SDK generateText with correct model", async () => {
    const mockGenerateText = vi.mocked(generateText);
    mockGenerateText.mockResolvedValueOnce({
      text: "Hello from LLM",
      usage: { inputTokens: 10, outputTokens: 5 },
    } as any);

    const result = await client.generateText({
      prompt: "Say hello",
      model: "think",
    });

    expect(result.text).toBe("Hello from LLM");
    expect(mockGenerateText).toHaveBeenCalledOnce();
    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.prompt).toBe("Say hello");
    expect(callArgs.model).toBeDefined();
  });

  it("generateObject calls AI SDK generateObject with schema", async () => {
    const { z } = await import("zod");
    const schema = z.object({ activity: z.string(), duration: z.number() });

    const mockGenerateObject = vi.mocked(generateObject);
    mockGenerateObject.mockResolvedValueOnce({
      object: { activity: "read", duration: 300 },
      usage: { inputTokens: 15, outputTokens: 10 },
    } as any);

    const result = await client.generateObject({
      prompt: "Pick an activity",
      schema,
      model: "classify",
    });

    expect(result.object).toEqual({ activity: "read", duration: 300 });
    expect(mockGenerateObject).toHaveBeenCalledOnce();
  });

  it("uses think model for 'think' model type", async () => {
    const mockGenerateText = vi.mocked(generateText);
    mockGenerateText.mockResolvedValueOnce({ text: "deep thought" } as any);

    await client.generateText({ prompt: "Think deeply", model: "think" });

    const callArgs = mockGenerateText.mock.calls[0][0];
    // The mock returns an object with modelId from createOpenRouter mock
    expect((callArgs.model as any).modelId).toBe("deepseek/deepseek-chat");
  });

  it("uses classify model for 'classify' model type", async () => {
    const mockGenerateText = vi.mocked(generateText);
    mockGenerateText.mockResolvedValueOnce({ text: "classified" } as any);

    await client.generateText({ prompt: "Classify this", model: "classify" });

    const callArgs = mockGenerateText.mock.calls[0][0];
    expect((callArgs.model as any).modelId).toBe("mistralai/mistral-small-latest");
  });

  it("generateText supports optional system prompt", async () => {
    const mockGenerateText = vi.mocked(generateText);
    mockGenerateText.mockResolvedValueOnce({ text: "response" } as any);

    await client.generateText({
      prompt: "Hello",
      model: "think",
      system: "You are Truman",
    });

    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.system).toBe("You are Truman");
  });
});
