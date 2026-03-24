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

function createDeps(): CognitiveLoopDeps {
  return {
    llm: createLLMClient({
      apiKey: "test-key",
      thinkModel: "deepseek/deepseek-chat",
      classifyModel: "mistralai/mistral-small-latest",
    }),
    bridge: new RendererBridge(createMockHandler()),
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
      failureRate: 0.1,
      maxRetries: 0,
      systemPrompt: "You are Truman.",
      agentId: "truman",
      reflectionThreshold: 150,
    },
    log: () => {},
  };
}

describe("Endurance simulation (T4.9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("survives 100 rapid ticks without memory leak indicators", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        activity: "read",
        durationSeconds: 120,
        thought: "Reading",
        reason: "Curious",
      },
    } as any);

    vi.mocked(generateText).mockResolvedValue({
      text: "Interesting.",
    } as any);

    const deps = createDeps();
    const loop = new CognitiveLoop(deps);

    for (let i = 0; i < 100; i++) {
      await loop.tick();
    }

    const state = loop.getState();
    expect(state.tickCount).toBe(100);
    expect(state.lastError).toBeNull();

    // Recent activities should be capped at 20 (not growing unbounded)
    expect(state.recentActivities.length).toBeLessThanOrEqual(20);
  });

  it("survives mix of successes and failures over 50 ticks", async () => {
    let callCount = 0;
    vi.mocked(generateObject).mockImplementation(async () => {
      callCount++;
      // Every 5th call fails
      if (callCount % 5 === 0) {
        throw new Error("Simulated LLM failure");
      }
      return {
        object: {
          activity: "read",
          durationSeconds: 120,
          thought: "Reading",
          reason: "Curious",
        },
      } as any;
    });

    vi.mocked(generateText).mockResolvedValue({
      text: "Good book.",
    } as any);

    const deps = createDeps();
    const loop = new CognitiveLoop(deps);

    for (let i = 0; i < 50; i++) {
      await loop.tick();
    }

    const state = loop.getState();
    expect(state.tickCount).toBe(50);
    // Should have processed some successfully
    expect(state.currentActivity).toBeDefined();
  });

  it("memory service calls are bounded per tick", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        activity: "cook",
        durationSeconds: 60,
        thought: "Cooking",
        reason: "Hungry",
      },
    } as any);

    vi.mocked(generateText).mockResolvedValue({
      text: "Nice meal.",
    } as any);

    const deps = createDeps();
    const loop = new CognitiveLoop(deps);

    await loop.tick();
    await loop.tick();
    await loop.tick();

    // Memory create calls should be bounded (max 2 per tick: prev observation + current)
    const createCalls = (deps.memory.createMemory as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(createCalls).toBeLessThanOrEqual(10); // 3 ticks * max ~3 observations each
  });
});
