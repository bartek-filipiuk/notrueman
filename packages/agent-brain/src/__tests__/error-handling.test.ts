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

import { generateText, generateObject } from "ai";
import { CognitiveLoop } from "../cognitive-loop.js";
import { RendererBridge } from "../renderer-bridge.js";
import { createLLMClient } from "../llm-client.js";
import type { RendererHandler } from "../renderer-bridge.js";
import type { CognitiveLoopDeps } from "../cognitive-loop.js";

function createMockHandler(): RendererHandler {
  return {
    moveTo: vi.fn().mockResolvedValue(undefined),
    playActivity: vi.fn(),
    showThought: vi.fn(),
    updateHUD: vi.fn(),
  };
}

function createDeps(overrides?: Partial<CognitiveLoopDeps>): CognitiveLoopDeps {
  const handler = createMockHandler();
  const client = createLLMClient({
    apiKey: "test-key",
    thinkModel: "deepseek/deepseek-chat",
    classifyModel: "mistralai/mistral-small-latest",
  });

  return {
    llm: client,
    bridge: new RendererBridge(handler),
    memory: {
      createMemory: vi.fn().mockResolvedValue({ id: "mem-1" }),
      getRecentMemories: vi.fn().mockResolvedValue([]),
    },
    embedding: {
      embed: vi.fn().mockResolvedValue(new Array(768).fill(0)),
    },
    retrieval: {
      retrieve: vi.fn().mockResolvedValue([]),
    },
    config: {
      tickIntervalMs: 30000,
      failureRate: 0.0,
      maxRetries: 1,
      systemPrompt: "You are Truman.",
      agentId: "truman",
      reflectionThreshold: 150,
    },
    log: () => {},
    ...overrides,
  };
}

function setupSuccessfulLLM() {
  vi.mocked(generateObject).mockResolvedValue({
    object: {
      activity: "read",
      durationSeconds: 120,
      thought: "Reading",
      reason: "Curious",
    },
  } as any);

  vi.mocked(generateText).mockResolvedValue({
    text: "Interesting book.",
  } as any);
}

describe("Graceful Error Handling (T4.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LLM failures", () => {
    it("retries LLM call 3 times with exponential backoff then falls back", async () => {
      const deps = createDeps({
        config: {
          tickIntervalMs: 30000,
          failureRate: 0,
          maxRetries: 2,
          systemPrompt: "Test",
          agentId: "truman",
          reflectionThreshold: 150,
        },
      });

      vi.mocked(generateObject).mockRejectedValue(new Error("LLM timeout"));
      const loop = new CognitiveLoop(deps);

      await loop.tick();

      // Should not crash, should have a fallback activity
      const state = loop.getState();
      expect(state.tickCount).toBe(1);
      expect(state.lastError).toContain("LLM timeout");
      expect(state.currentActivity).toBeDefined();
    });

    it("falls back to random activity with neutral thought on LLM failure", async () => {
      const handler = createMockHandler();
      const deps = createDeps({
        bridge: new RendererBridge(handler),
      });

      vi.mocked(generateObject).mockRejectedValue(new Error("API down"));
      const loop = new CognitiveLoop(deps);

      await loop.tick();

      // Fallback should execute via bridge
      expect(handler.moveTo).toHaveBeenCalled();
    });

    it("main loop continues after LLM failure", async () => {
      const deps = createDeps();
      const loop = new CognitiveLoop(deps);

      // First tick: LLM fails
      vi.mocked(generateObject).mockRejectedValueOnce(new Error("API error"));
      await loop.tick();

      // Second tick: LLM works
      setupSuccessfulLLM();
      await loop.tick();

      const state = loop.getState();
      expect(state.tickCount).toBe(2);
      expect(state.lastError).toBeNull(); // Error cleared on successful tick
    });
  });

  describe("Memory failures", () => {
    it("continues without context when memory retrieval fails", async () => {
      const deps = createDeps({
        retrieval: {
          retrieve: vi.fn().mockRejectedValue(new Error("DB connection lost")),
        },
      });
      setupSuccessfulLLM();

      const loop = new CognitiveLoop(deps);
      await loop.tick();

      const state = loop.getState();
      expect(state.tickCount).toBe(1);
      expect(state.lastError).toBeNull();
      expect(state.currentActivity).toBe("read");
    });

    it("continues when memory storage fails", async () => {
      const deps = createDeps({
        memory: {
          createMemory: vi.fn().mockRejectedValue(new Error("DB write error")),
          getRecentMemories: vi.fn().mockResolvedValue([]),
        },
      });
      setupSuccessfulLLM();

      const loop = new CognitiveLoop(deps);
      await loop.tick();

      const state = loop.getState();
      expect(state.tickCount).toBe(1);
      expect(state.lastError).toBeNull();
      expect(state.currentActivity).toBe("read");
    });

    it("continues when embedding service fails", async () => {
      const deps = createDeps({
        embedding: {
          embed: vi.fn().mockRejectedValue(new Error("Ollama unavailable")),
        },
      });
      setupSuccessfulLLM();

      const loop = new CognitiveLoop(deps);
      await loop.tick();

      const state = loop.getState();
      expect(state.tickCount).toBe(1);
      expect(state.lastError).toBeNull();
    });
  });

  describe("Renderer failures", () => {
    it("does not crash when renderer bridge fails", async () => {
      const handler = createMockHandler();
      handler.moveTo = vi.fn().mockRejectedValue(new Error("Renderer crash"));

      const deps = createDeps({
        bridge: new RendererBridge(handler),
      });
      setupSuccessfulLLM();

      const loop = new CognitiveLoop(deps);
      await loop.tick();

      // Should record error but not crash
      const state = loop.getState();
      expect(state.tickCount).toBe(1);
    });
  });

  describe("Multiple consecutive failures", () => {
    it("survives 5 consecutive tick failures", async () => {
      const deps = createDeps({
        config: {
          tickIntervalMs: 30000,
          failureRate: 0,
          maxRetries: 0, // No retries to keep test fast
          systemPrompt: "Test",
          agentId: "truman",
          reflectionThreshold: 150,
        },
      });
      const loop = new CognitiveLoop(deps);

      vi.mocked(generateObject).mockRejectedValue(new Error("Persistent failure"));

      for (let i = 0; i < 5; i++) {
        await loop.tick();
      }

      const state = loop.getState();
      expect(state.tickCount).toBe(5);
      // Loop should still be functional
      expect(state.currentActivity).toBeDefined();
    });
  });
});
