import { describe, it, expect, vi, afterEach } from "vitest";
import {
  CognitiveLoop,
  type MemoryAdapter,
  type EmbeddingAdapter,
  type RetrievalAdapter,
} from "../cognitive-loop.js";
import type { LLMClient } from "../llm-client.js";
import type { RendererBridge } from "../renderer-bridge.js";
import { createHealthServer } from "../health-server.js";

/**
 * T5.8: Smoke test suite — automated start → health → verify → stop.
 *
 * Validates the full system lifecycle with mocked external dependencies.
 * No real DB, Redis, or LLM calls required.
 */
describe("T5.8: Smoke test suite", () => {
  function createMockDeps() {
    const mockLlm: LLMClient = {
      generateText: vi.fn().mockResolvedValue({ text: "Thinking about life..." }),
      generateObject: vi.fn().mockResolvedValue({
        object: { activity: "read", reason: "curious", durationSeconds: 30, thought: "I should read" },
      }),
    };

    const mockBridge: RendererBridge = {
      executeAction: vi.fn().mockResolvedValue(undefined),
    } as unknown as RendererBridge;

    const mockMemory: MemoryAdapter = {
      createMemory: vi.fn().mockResolvedValue({ id: "mem-1" }),
      getRecentMemories: vi.fn().mockResolvedValue([]),
    };

    const mockEmbedding: EmbeddingAdapter = {
      embed: vi.fn().mockResolvedValue(new Array(768).fill(0.01)),
    };

    const mockRetrieval: RetrievalAdapter = {
      retrieve: vi.fn().mockResolvedValue([]),
    };

    return { mockLlm, mockBridge, mockMemory, mockEmbedding, mockRetrieval };
  }

  describe("CognitiveLoop lifecycle", () => {
    let loop: CognitiveLoop | null = null;

    afterEach(() => {
      if (loop) {
        loop.stop();
        loop = null;
      }
    });

    it("starts, executes tick, and stops cleanly", async () => {
      const { mockLlm, mockBridge, mockMemory, mockEmbedding, mockRetrieval } = createMockDeps();

      loop = new CognitiveLoop({
        llm: mockLlm,
        bridge: mockBridge,
        memory: mockMemory,
        embedding: mockEmbedding,
        retrieval: mockRetrieval,
        config: {
          tickIntervalMs: 60000, // long interval — we manually tick
          failureRate: 0,
          maxRetries: 0,
          systemPrompt: "You are Truman.",
          agentId: "smoke-test-agent",
          reflectionThreshold: 100,
        },
        log: vi.fn(),
      });

      // 1. START
      const stateBefore = loop.getState();
      expect(stateBefore.isRunning).toBe(false);
      expect(stateBefore.tickCount).toBe(0);

      loop.start();
      expect(loop.getState().isRunning).toBe(true);

      // Wait for the initial tick to complete (currentActivity set at end of tick)
      await vi.waitFor(() => {
        expect(loop!.getState().currentActivity).toBeTruthy();
      }, { timeout: 5000 });

      // 2. VERIFY STATE
      const stateAfter = loop.getState();
      expect(stateAfter.tickCount).toBeGreaterThanOrEqual(1);
      expect(stateAfter.currentActivity).toBeTruthy();
      expect(stateAfter.lastTickAt).toBeInstanceOf(Date);
      expect(stateAfter.lastError).toBeNull();

      // 3. VERIFY DEPENDENCIES CALLED
      expect(mockLlm.generateObject).toHaveBeenCalled();
      expect(mockBridge.executeAction).toHaveBeenCalled();
      expect(mockMemory.createMemory).toHaveBeenCalled();

      // 4. STOP
      loop.stop();
      expect(loop.getState().isRunning).toBe(false);
    });

    it("multiple start/stop cycles work without errors", async () => {
      const deps = createMockDeps();

      loop = new CognitiveLoop({
        llm: deps.mockLlm,
        bridge: deps.mockBridge,
        memory: deps.mockMemory,
        embedding: deps.mockEmbedding,
        retrieval: deps.mockRetrieval,
        config: {
          tickIntervalMs: 60000,
          failureRate: 0,
          maxRetries: 0,
          systemPrompt: "You are Truman.",
          agentId: "smoke-test-agent",
          reflectionThreshold: 100,
        },
        log: vi.fn(),
      });

      // Cycle 1
      loop.start();
      await vi.waitFor(() => {
        expect(loop!.getState().currentActivity).toBeTruthy();
      }, { timeout: 5000 });
      loop.stop();
      const countAfterFirst = loop.getState().tickCount;

      // Cycle 2
      loop.start();
      await vi.waitFor(() => {
        expect(loop!.getState().tickCount).toBeGreaterThan(countAfterFirst);
      }, { timeout: 5000 });
      loop.stop();

      expect(loop.getState().isRunning).toBe(false);
      expect(loop.getState().tickCount).toBeGreaterThan(countAfterFirst);
    });

    it("config can be updated at runtime", () => {
      const deps = createMockDeps();

      loop = new CognitiveLoop({
        llm: deps.mockLlm,
        bridge: deps.mockBridge,
        memory: deps.mockMemory,
        embedding: deps.mockEmbedding,
        retrieval: deps.mockRetrieval,
        config: {
          tickIntervalMs: 30000,
          failureRate: 0.25,
          maxRetries: 3,
          systemPrompt: "Original prompt.",
          agentId: "smoke-test-agent",
          reflectionThreshold: 100,
        },
        log: vi.fn(),
      });

      loop.updateConfig({ tickIntervalMs: 60000, failureRate: 0.1 });

      const config = loop.getConfig();
      expect(config.tickIntervalMs).toBe(60000);
      expect(config.failureRate).toBe(0.1);
      expect(config.maxRetries).toBe(3); // unchanged
    });
  });

  describe("Health server integration", () => {
    let server: Awaited<ReturnType<typeof createHealthServer>> | null = null;

    afterEach(async () => {
      if (server) {
        await server.close();
        server = null;
      }
    });

    it("health endpoint reflects running agent state", async () => {
      const deps = createMockDeps();
      const loop = new CognitiveLoop({
        llm: deps.mockLlm,
        bridge: deps.mockBridge,
        memory: deps.mockMemory,
        embedding: deps.mockEmbedding,
        retrieval: deps.mockRetrieval,
        config: {
          tickIntervalMs: 60000,
          failureRate: 0,
          maxRetries: 0,
          systemPrompt: "You are Truman.",
          agentId: "smoke-test-agent",
          reflectionThreshold: 100,
        },
        log: vi.fn(),
      });

      // Run a tick to populate state
      await loop.tick();

      const state = loop.getState();

      server = await createHealthServer(
        {
          getStatus: () => ({
            status: "ok" as const,
            uptime: 60,
            lastTickAt: state.lastTickAt?.toISOString() ?? null,
            tickCount: state.tickCount,
            currentActivity: state.currentActivity,
            currentMood: state.currentMood,
            memoryCount: 5,
          }),
        },
        { port: 0 },
      );

      const response = await server.inject({ method: "GET", url: "/health" });
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.status).toBe("ok");
      expect(body.tickCount).toBe(state.tickCount);
      expect(body.currentActivity).toBe(state.currentActivity);
      expect(body.currentMood).toBeTruthy();
    });

    it("metrics endpoint returns valid Prometheus format", async () => {
      server = await createHealthServer(
        {
          getStatus: () => ({
            status: "ok" as const,
            uptime: 120,
            lastTickAt: new Date().toISOString(),
            tickCount: 10,
            currentActivity: "sleep",
            currentMood: "content",
            memoryCount: 42,
          }),
        },
        { port: 0 },
      );

      // Hit health first to populate gauges
      await server.inject({ method: "GET", url: "/health" });

      const response = await server.inject({ method: "GET", url: "/metrics" });
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("nts_tick_count");
      expect(response.body).toContain("nts_uptime_seconds");
      expect(response.body).toContain("nts_memory_count");
    });
  });

  describe("Graceful degradation smoke", () => {
    it("system remains stable when all external services fail", async () => {
      const failingLlm: LLMClient = {
        generateText: vi.fn().mockRejectedValue(new Error("LLM down")),
        generateObject: vi.fn().mockRejectedValue(new Error("LLM down")),
      };

      const failingBridge: RendererBridge = {
        executeAction: vi.fn().mockResolvedValue(undefined),
      } as unknown as RendererBridge;

      const failingMemory: MemoryAdapter = {
        createMemory: vi.fn().mockRejectedValue(new Error("DB down")),
        getRecentMemories: vi.fn().mockRejectedValue(new Error("DB down")),
      };

      const failingEmbedding: EmbeddingAdapter = {
        embed: vi.fn().mockRejectedValue(new Error("Embedding down")),
      };

      const failingRetrieval: RetrievalAdapter = {
        retrieve: vi.fn().mockRejectedValue(new Error("Retrieval down")),
      };

      const loop = new CognitiveLoop({
        llm: failingLlm,
        bridge: failingBridge,
        memory: failingMemory,
        embedding: failingEmbedding,
        retrieval: failingRetrieval,
        config: {
          tickIntervalMs: 60000,
          failureRate: 0,
          maxRetries: 0,
          systemPrompt: "Test",
          agentId: "smoke-test-agent",
          reflectionThreshold: 100,
        },
        log: vi.fn(),
      });

      // Run 5 ticks — none should throw
      for (let i = 0; i < 5; i++) {
        await loop.tick();
      }

      const state = loop.getState();
      expect(state.tickCount).toBe(5);
      expect(state.lastError).toBeTruthy(); // errors recorded
      expect(state.currentActivity).toBeTruthy(); // fallback activity assigned
    });
  });
});
