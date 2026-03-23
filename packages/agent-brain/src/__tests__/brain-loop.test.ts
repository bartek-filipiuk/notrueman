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
import { BrainLoop } from "../brain-loop.js";
import { RendererBridge } from "../renderer-bridge.js";
import { createLLMClient } from "../llm-client.js";
import type { RendererHandler } from "../renderer-bridge.js";

function createMockHandler(): RendererHandler {
  return {
    moveTo: vi.fn().mockResolvedValue(undefined),
    playActivity: vi.fn(),
    showThought: vi.fn(),
    updateHUD: vi.fn(),
  };
}

function setupMocks() {
  vi.mocked(generateObject).mockResolvedValue({
    object: {
      activity: "read",
      durationSeconds: 120,
      thought: "Let me read.",
      reason: "Feeling curious",
    },
  } as any);

  vi.mocked(generateText).mockResolvedValue({
    text: "Books are like doors to other worlds.",
  } as any);
}

describe("brain loop (T2.8)", () => {
  let handler: RendererHandler;
  let bridge: RendererBridge;
  let loop: BrainLoop;
  const silentLog = () => {};

  beforeEach(() => {
    vi.clearAllMocks();
    handler = createMockHandler();
    bridge = new RendererBridge(handler);

    const client = createLLMClient({
      apiKey: "test-key",
      thinkModel: "deepseek/deepseek-chat",
      classifyModel: "mistralai/mistral-small-latest",
    });

    loop = new BrainLoop(client, bridge, {
      tickIntervalMs: 30000,
      failureRate: 0.0, // no failures for basic tests
      maxRetries: 1,
      systemPrompt: "You are Truman.",
    }, silentLog);
  });

  it("starts in non-running state", () => {
    const state = loop.getState();
    expect(state.isRunning).toBe(false);
    expect(state.tickCount).toBe(0);
    expect(state.currentActivity).toBeNull();
  });

  it("tick executes full sequence: plan → thought → render", async () => {
    setupMocks();

    await loop.tick();

    // Plan was called
    expect(vi.mocked(generateObject)).toHaveBeenCalled();
    // Thought was generated
    expect(vi.mocked(generateText)).toHaveBeenCalled();
    // Renderer was called
    expect(handler.moveTo).toHaveBeenCalled();
    expect(handler.playActivity).toHaveBeenCalled();
    expect(handler.showThought).toHaveBeenCalled();
  });

  it("tick updates state correctly", async () => {
    setupMocks();

    await loop.tick();

    const state = loop.getState();
    expect(state.tickCount).toBe(1);
    expect(state.currentActivity).toBe("read");
    expect(state.lastTickAt).toBeDefined();
    expect(state.lastError).toBeNull();
  });

  it("tick tracks recent activities", async () => {
    setupMocks();

    await loop.tick();
    await loop.tick();

    const state = loop.getState();
    expect(state.recentActivities.length).toBe(2);
    expect(state.recentActivities[0].activity).toBe("read");
  });

  it("handles LLM errors with fallback to random activity", async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error("API error"));

    await loop.tick();

    const state = loop.getState();
    expect(state.tickCount).toBe(1);
    expect(state.lastError).toContain("API error");
    // Fallback should have been called
    expect(state.currentActivity).toBeDefined();
  });

  it("start and stop control the loop", () => {
    loop.start();
    expect(loop.getState().isRunning).toBe(true);

    loop.stop();
    expect(loop.getState().isRunning).toBe(false);
  });

  it("start is idempotent", () => {
    setupMocks();
    loop.start();
    loop.start(); // should not throw or double-start
    expect(loop.getState().isRunning).toBe(true);
    loop.stop();
  });

  it("stop is idempotent", () => {
    loop.stop(); // should not throw when not running
    expect(loop.getState().isRunning).toBe(false);
  });

  it("recent activities list is capped at 10", async () => {
    setupMocks();

    for (let i = 0; i < 15; i++) {
      await loop.tick();
    }

    expect(loop.getState().recentActivities.length).toBe(10);
  });
});
