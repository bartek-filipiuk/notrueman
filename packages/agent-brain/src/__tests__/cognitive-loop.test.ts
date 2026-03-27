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

function createMockMemory() {
  return {
    createMemory: vi.fn().mockResolvedValue({
      id: "mem-1",
      agentId: "truman",
      type: "observation",
      description: "test",
      importance: 5,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    }),
    getMemory: vi.fn().mockResolvedValue(null),
    updateLastAccessed: vi.fn().mockResolvedValue(undefined),
    getRecentMemories: vi.fn().mockResolvedValue([]),
  };
}

function createMockEmbedding() {
  return {
    embed: vi.fn().mockResolvedValue(new Array(768).fill(0)),
  };
}

function createMockRetrieval() {
  return {
    retrieve: vi.fn().mockResolvedValue([]),
  };
}

function setupLLMMocks() {
  // Action planning
  vi.mocked(generateObject).mockResolvedValue({
    object: {
      activity: "read",
      durationSeconds: 120,
      thought: "Let me read.",
      reason: "Feeling curious",
    },
  } as any);

  // Thought generation
  vi.mocked(generateText).mockResolvedValue({
    text: "Books are like doors to other worlds.",
  } as any);
}

describe("CognitiveLoop (T4.2)", () => {
  let handler: RendererHandler;
  let deps: CognitiveLoopDeps;
  let loop: CognitiveLoop;
  const silentLog = () => {};

  beforeEach(() => {
    vi.clearAllMocks();
    handler = createMockHandler();

    const client = createLLMClient({
      apiKey: "test-key",
      thinkModel: "deepseek/deepseek-chat",
      classifyModel: "mistralai/mistral-small-latest",
    });

    deps = {
      llm: client,
      bridge: new RendererBridge(handler),
      memory: createMockMemory(),
      embedding: createMockEmbedding(),
      retrieval: createMockRetrieval(),
      config: {
        tickIntervalMs: 30000,
        failureRate: 0.0,
        maxRetries: 1,
        systemPrompt: "You are Truman.",
        agentId: "truman",
        reflectionThreshold: 150,
      },
      log: silentLog,
    };

    loop = new CognitiveLoop(deps);
  });

  it("starts in non-running state", () => {
    const state = loop.getState();
    expect(state.isRunning).toBe(false);
    expect(state.tickCount).toBe(0);
    expect(state.currentActivity).toBeNull();
  });

  it("tick executes full cognitive sequence", async () => {
    setupLLMMocks();

    await loop.tick();

    const state = loop.getState();
    expect(state.tickCount).toBe(1);
    expect(state.currentActivity).toBe("read");
    expect(state.lastError).toBeNull();
  });

  it("retrieves memories during tick", async () => {
    setupLLMMocks();

    await loop.tick();

    expect(deps.retrieval.retrieve).toHaveBeenCalled();
  });

  it("stores observation after action", async () => {
    setupLLMMocks();

    await loop.tick();

    expect(deps.memory.createMemory).toHaveBeenCalled();
    const callArg = deps.memory.createMemory.mock.calls[0][0];
    expect(callArg.type).toBe("observation");
    expect(callArg.agentId).toBe("truman");
  });

  it("generates embedding for observation", async () => {
    setupLLMMocks();

    await loop.tick();

    expect(deps.embedding.embed).toHaveBeenCalled();
  });

  it("renders action via bridge", async () => {
    setupLLMMocks();

    await loop.tick();

    expect(handler.moveTo).toHaveBeenCalled();
    expect(handler.playActivity).toHaveBeenCalled();
    expect(handler.showThought).toHaveBeenCalled();
    expect(handler.updateHUD).toHaveBeenCalled();
  });

  it("tracks importance accumulator across ticks", async () => {
    // Mock that handles both importance scoring and action planning
    vi.mocked(generateObject).mockImplementation(async (params: any) => {
      // Importance scoring uses classify model and ImportanceScoreSchema
      const promptStr = String(params.prompt ?? "");
      if (promptStr.includes("rate the importance")) {
        return { object: { score: 5 } } as any;
      }
      // Action planning
      return {
        object: {
          activity: "read",
          durationSeconds: 120,
          thought: "Let me read.",
          reason: "Feeling curious",
        },
      } as any;
    });

    vi.mocked(generateText).mockResolvedValue({
      text: "Deep in thought.",
    } as any);

    await loop.tick();
    await loop.tick();

    const state = loop.getState();
    expect(state.importanceAccumulator).toBeGreaterThan(0);
  });

  it("handles errors gracefully with fallback", async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error("API down"));

    await loop.tick();

    const state = loop.getState();
    expect(state.tickCount).toBe(1);
    expect(state.lastError).toContain("API down");
    // Should still have a current activity (fallback)
    expect(state.currentActivity).toBeDefined();
  });

  it("start and stop control the loop", () => {
    loop.start();
    expect(loop.getState().isRunning).toBe(true);

    loop.stop();
    expect(loop.getState().isRunning).toBe(false);
  });

  it("configurable tick interval is used", () => {
    const customDeps = {
      ...deps,
      config: { ...deps.config, tickIntervalMs: 60000 },
    };
    const customLoop = new CognitiveLoop(customDeps);
    expect(customLoop.getConfig().tickIntervalMs).toBe(60000);
  });

  it("sequential processing (concurrency: 1) — tick does not overlap", async () => {
    setupLLMMocks();

    // Make tick take some time
    vi.mocked(generateObject).mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return {
        object: {
          activity: "read",
          durationSeconds: 120,
          thought: "Reading",
          reason: "Curious",
        },
      } as any;
    });

    // Start two ticks simultaneously
    const tick1 = loop.tick();
    const tick2 = loop.tick();

    await Promise.all([tick1, tick2]);

    // Second tick should have been skipped (lock)
    const state = loop.getState();
    expect(state.tickCount).toBe(1);
  });

  it("updates emotion state after tick", async () => {
    setupLLMMocks();

    await loop.tick();

    const state = loop.getState();
    expect(state.currentMood).toBeDefined();
    expect(typeof state.currentMood).toBe("string");
  });
});

describe("CognitiveLoop EventEmitter (TM.2)", () => {
  let handler: RendererHandler;
  let deps: CognitiveLoopDeps;
  let loop: CognitiveLoop;
  const silentLog = () => {};

  beforeEach(() => {
    vi.clearAllMocks();
    handler = createMockHandler();

    const client = createLLMClient({
      apiKey: "test-key",
      thinkModel: "deepseek/deepseek-chat",
      classifyModel: "mistralai/mistral-small-latest",
    });

    deps = {
      llm: client,
      bridge: new RendererBridge(handler),
      memory: createMockMemory(),
      embedding: createMockEmbedding(),
      retrieval: createMockRetrieval(),
      config: {
        tickIntervalMs: 30000,
        failureRate: 0.0,
        maxRetries: 1,
        systemPrompt: "You are Truman.",
        agentId: "truman",
        reflectionThreshold: 150,
      },
      log: silentLog,
    };

    loop = new CognitiveLoop(deps);
  });

  it("is an instance of EventEmitter", () => {
    expect(typeof loop.on).toBe("function");
    expect(typeof loop.emit).toBe("function");
  });

  it("emitMindFeedEvent emits a MindFeedEvent with correct structure", () => {
    const events: any[] = [];
    loop.on("mindFeedEvent", (e: any) => events.push(e));

    loop.emitMindFeedEvent("thought", { text: "hello" }, true);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("thought");
    expect(events[0].data.text).toBe("hello");
    expect(events[0].public).toBe(true);
    expect(typeof events[0].timestamp).toBe("number");
  });

  it("emits thought event during tick", async () => {
    setupLLMMocks();

    const events: any[] = [];
    loop.on("mindFeedEvent", (e: any) => {
      if (e.type === "thought") events.push(e);
    });

    await loop.tick();

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].data.text).toBeDefined();
    expect(events[0].public).toBe(true);
  });

  it("emits activity_change event when activity changes", async () => {
    setupLLMMocks();

    const events: any[] = [];
    loop.on("mindFeedEvent", (e: any) => {
      if (e.type === "activity_change") events.push(e);
    });

    await loop.tick();

    // First tick: null → "read" should emit activity_change
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].data.activity).toBe("read");
    expect(events[0].data.prevActivity).toBe("idle");
  });

  it("does not emit activity_change when same activity repeats", async () => {
    setupLLMMocks();

    const events: any[] = [];
    loop.on("mindFeedEvent", (e: any) => {
      if (e.type === "activity_change") events.push(e);
    });

    await loop.tick();
    const countAfterFirst = events.length;

    await loop.tick();
    // Same activity "read" → should not emit again
    expect(events.length).toBe(countAfterFirst);
  });

  it("emits reflection event when importance threshold reached", async () => {
    // Use low threshold so it triggers
    deps.config.reflectionThreshold = 1;
    loop = new CognitiveLoop(deps);

    setupLLMMocks();
    vi.mocked(generateObject).mockImplementation(async (params: any) => {
      const promptStr = String(params.prompt ?? "");
      if (promptStr.includes("rate the importance")) {
        return { object: { score: 8 } } as any;
      }
      return {
        object: {
          activity: "read",
          durationSeconds: 120,
          thought: "Let me read.",
          reason: "Feeling curious",
        },
      } as any;
    });

    const events: any[] = [];
    loop.on("mindFeedEvent", (e: any) => {
      if (e.type === "reflection") events.push(e);
    });

    await loop.tick();

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].data.insight).toBeDefined();
    expect(events[0].public).toBe(true);
  });
});
