import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
  stepCountIs: vi.fn(() => ({ type: "step-count", stepCount: 3 })),
  tool: vi.fn((def: any) => def),
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
import { ToolRegistry } from "../tools/tool-registry.js";
import { BudgetManager } from "../tools/budget-manager.js";
import {
  WEB_SEARCH_METADATA,
  WRITE_BLOG_METADATA,
  CREATE_ARTWORK_METADATA,
} from "../tools/index.js";
import type { RendererHandler } from "../renderer-bridge.js";
import type { MemoryAdapter, EmbeddingAdapter, RetrievalAdapter } from "../cognitive-loop.js";

function createMockHandler(): RendererHandler {
  return {
    moveTo: vi.fn().mockResolvedValue(undefined),
    playActivity: vi.fn(),
    showThought: vi.fn(),
    updateHUD: vi.fn(),
  };
}

function createMockMemory(): MemoryAdapter {
  return {
    createMemory: vi.fn().mockResolvedValue({ id: "test-id" }),
    getRecentMemories: vi.fn().mockResolvedValue([]),
  };
}

function createMockEmbedding(): EmbeddingAdapter {
  return {
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  };
}

function createMockRetrieval(): RetrievalAdapter {
  return {
    retrieve: vi.fn().mockResolvedValue([]),
  };
}

function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(
    { ...WEB_SEARCH_METADATA, activityTriggers: [...WEB_SEARCH_METADATA.activityTriggers] },
    { description: "mock search", execute: async () => ({ results: [] }) },
  );
  registry.register(
    { ...WRITE_BLOG_METADATA, activityTriggers: [...WRITE_BLOG_METADATA.activityTriggers] },
    { description: "mock blog", execute: async () => ({ id: "b1", status: "draft_saved" }) },
  );
  registry.register(
    { ...CREATE_ARTWORK_METADATA, activityTriggers: [...CREATE_ARTWORK_METADATA.activityTriggers] },
    { description: "mock artwork", execute: async () => ({ id: "a1", status: "concept_saved" }) },
  );
  return registry;
}

describe("Stage K: CognitiveLoop Tool Integration", () => {
  let loop: CognitiveLoop;
  let memory: MemoryAdapter;
  let budget: BudgetManager;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(generateObject).mockResolvedValue({
      object: {
        activity: "computer",
        durationSeconds: 120,
        thought: "Let me use the computer.",
        reason: "Feeling curious",
      },
    } as any);

    vi.mocked(generateText).mockResolvedValue({
      text: "I think about technology...",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      steps: [],
    } as any);

    memory = createMockMemory();
    budget = new BudgetManager(20);

    const handler = createMockHandler();
    const bridge = new RendererBridge(handler);
    const client = createLLMClient({ apiKey: "test", thinkModel: "m", classifyModel: "m" });

    loop = new CognitiveLoop({
      llm: client,
      bridge,
      memory,
      embedding: createMockEmbedding(),
      retrieval: createMockRetrieval(),
      config: {
        tickIntervalMs: 30000,
        failureRate: 0,
        maxRetries: 0,
        systemPrompt: "You are Truman.",
        agentId: "truman",
        reflectionThreshold: 100,
      },
      toolRegistry: createToolRegistry(),
      budgetManager: budget,
      interests: ["technology", "art", "philosophy"],
    });
  });

  describe("TK.2: Personality prompt with interests", () => {
    it("getInterests returns configured interests", () => {
      expect(loop.getInterests()).toEqual(["technology", "art", "philosophy"]);
    });

    it("setInterests updates and caps at 10", () => {
      const newInterests = Array.from({ length: 12 }, (_, i) => `topic_${i}`);
      loop.setInterests(newInterests);
      expect(loop.getInterests()).toHaveLength(10);
    });
  });

  describe("TK.3: Memory storage of tool results", () => {
    it("memory.createMemory is called during tick", async () => {
      await loop.tick();
      // At least one observation should be stored (from the tick itself)
      expect(memory.createMemory).toHaveBeenCalled();
    });
  });

  describe("TK.4: Interest evolution", () => {
    it("setInterests accepts new interests from reflection", () => {
      loop.setInterests(["quantum physics", "neural networks", "painting"]);
      expect(loop.getInterests()).toContain("quantum physics");
    });
  });

  describe("TK.5: Budget tracking during tick", () => {
    it("budget starts full", () => {
      expect(budget.getRemainingBudget().callsLeft).toBe(20);
    });

    it("budget manager blocks after exhaustion", () => {
      for (let i = 0; i < 20; i++) budget.trackCall("test");
      expect(budget.isWithinBudget()).toBe(false);
    });
  });

  describe("Tool registry + activity integration", () => {
    it("computer activity has web_search and write_blog_post", () => {
      const registry = createToolRegistry();
      const tools = registry.getToolsForActivity("computer");
      expect(Object.keys(tools)).toContain("web_search");
      expect(Object.keys(tools)).toContain("write_blog_post");
    });

    it("draw activity has create_artwork and web_search", () => {
      const registry = createToolRegistry();
      const tools = registry.getToolsForActivity("draw");
      expect(Object.keys(tools)).toContain("create_artwork");
      expect(Object.keys(tools)).toContain("web_search");
    });

    it("sleep activity has no tools", () => {
      const registry = createToolRegistry();
      const tools = registry.getToolsForActivity("sleep");
      expect(Object.keys(tools)).toHaveLength(0);
    });
  });
});
