import { describe, it, expect, vi } from "vitest";
import { loadConfig, TrumanConfigSchema } from "../config.js";
import type { LLMClient, GenerateTextParams, GenerateObjectParams } from "../llm-client.js";
import type {
  CognitiveLoopDeps,
  MemoryAdapter,
  EmbeddingAdapter,
  RetrievalAdapter,
} from "../cognitive-loop.js";
import { CognitiveLoop } from "../cognitive-loop.js";
import type { RendererBridge } from "../renderer-bridge.js";
import { z } from "zod";

describe("S5.2: Security negative cases", () => {
  describe("Invalid LLM JSON response", () => {
    it("CognitiveLoop falls back on LLM failure", async () => {
      const failingLlm: LLMClient = {
        generateText: vi.fn().mockRejectedValue(new Error("LLM returned invalid JSON")),
        generateObject: vi.fn().mockRejectedValue(new Error("LLM returned invalid JSON")),
      };

      const mockBridge: RendererBridge = {
        executeAction: vi.fn().mockResolvedValue(undefined),
      } as unknown as RendererBridge;

      const mockMemory: MemoryAdapter = {
        createMemory: vi.fn().mockResolvedValue({ id: "mem-1" }),
        getRecentMemories: vi.fn().mockResolvedValue([]),
      };

      const mockEmbedding: EmbeddingAdapter = {
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };

      const mockRetrieval: RetrievalAdapter = {
        retrieve: vi.fn().mockResolvedValue([]),
      };

      const loop = new CognitiveLoop({
        llm: failingLlm,
        bridge: mockBridge,
        memory: mockMemory,
        embedding: mockEmbedding,
        retrieval: mockRetrieval,
        config: {
          tickIntervalMs: 30000,
          failureRate: 0,
          maxRetries: 0,
          systemPrompt: "test",
          agentId: "test-agent",
          reflectionThreshold: 100,
        },
        log: vi.fn(),
      });

      // Should not throw — graceful fallback to random activity
      await loop.tick();

      const state = loop.getState();
      expect(state.tickCount).toBe(1);
      expect(state.lastError).toBeTruthy();
      expect(state.currentActivity).toBeTruthy(); // fallback activity assigned
    });
  });

  describe("Config validation rejects bad input", () => {
    it("rejects config with missing fields", () => {
      expect(() =>
        TrumanConfigSchema.parse({ tickIntervalMs: 30000 }),
      ).toThrow();
    });

    it("rejects config with out-of-range tickIntervalMs", () => {
      expect(() =>
        TrumanConfigSchema.parse({
          tickIntervalMs: 1, // below min 10000
          models: { think: "a", classify: "b" },
          failureRate: 0,
          maxRetries: 0,
          varietyPenalty: { veryRecentHours: 0, recentHours: 0, moderateHours: 0 },
          emotions: {
            happiness: 0.5, curiosity: 0.5, anxiety: 0.2,
            boredom: 0.3, excitement: 0.4, contentment: 0.5, frustration: 0.1,
          },
        }),
      ).toThrow();
    });

    it("rejects config with invalid failureRate", () => {
      expect(() =>
        TrumanConfigSchema.parse({
          tickIntervalMs: 30000,
          models: { think: "a", classify: "b" },
          failureRate: 2.0, // above max 1
          maxRetries: 0,
          varietyPenalty: { veryRecentHours: 0, recentHours: 0, moderateHours: 0 },
          emotions: {
            happiness: 0.5, curiosity: 0.5, anxiety: 0.2,
            boredom: 0.3, excitement: 0.4, contentment: 0.5, frustration: 0.1,
          },
        }),
      ).toThrow();
    });

    it("loadConfig throws on non-existent file", () => {
      expect(() => loadConfig("/nonexistent/path.json")).toThrow();
    });
  });

  describe("DB unavailable — memory operations fail gracefully", () => {
    it("CognitiveLoop continues when memory store fails", async () => {
      const mockLlm: LLMClient = {
        generateText: vi.fn().mockResolvedValue({ text: "thinking..." }),
        generateObject: vi.fn().mockResolvedValue({
          object: { activity: "read", reason: "test" },
        }),
      };

      const mockBridge: RendererBridge = {
        executeAction: vi.fn().mockResolvedValue(undefined),
      } as unknown as RendererBridge;

      const failingMemory: MemoryAdapter = {
        createMemory: vi.fn().mockRejectedValue(new Error("Connection refused")),
        getRecentMemories: vi.fn().mockRejectedValue(new Error("Connection refused")),
      };

      const mockEmbedding: EmbeddingAdapter = {
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      };

      const failingRetrieval: RetrievalAdapter = {
        retrieve: vi.fn().mockRejectedValue(new Error("Connection refused")),
      };

      const loop = new CognitiveLoop({
        llm: mockLlm,
        bridge: mockBridge,
        memory: failingMemory,
        embedding: mockEmbedding,
        retrieval: failingRetrieval,
        config: {
          tickIntervalMs: 30000,
          failureRate: 0,
          maxRetries: 0,
          systemPrompt: "test",
          agentId: "test-agent",
          reflectionThreshold: 100,
        },
        log: vi.fn(),
      });

      // Should not throw — memory failures are caught
      await loop.tick();

      const state = loop.getState();
      expect(state.tickCount).toBe(1);
      // Loop should complete even with DB down
      expect(state.currentActivity).toBeTruthy();
    });
  });

  describe("Embedding service unavailable", () => {
    it("CognitiveLoop continues without embeddings", async () => {
      const mockLlm: LLMClient = {
        generateText: vi.fn().mockResolvedValue({ text: "thinking..." }),
        generateObject: vi.fn().mockResolvedValue({
          object: { activity: "sleep", reason: "tired" },
        }),
      };

      const mockBridge: RendererBridge = {
        executeAction: vi.fn().mockResolvedValue(undefined),
      } as unknown as RendererBridge;

      const mockMemory: MemoryAdapter = {
        createMemory: vi.fn().mockResolvedValue({ id: "mem-1" }),
        getRecentMemories: vi.fn().mockResolvedValue([]),
      };

      const failingEmbedding: EmbeddingAdapter = {
        embed: vi.fn().mockRejectedValue(new Error("Embedding service unavailable")),
      };

      const mockRetrieval: RetrievalAdapter = {
        retrieve: vi.fn().mockResolvedValue([]),
      };

      const loop = new CognitiveLoop({
        llm: mockLlm,
        bridge: mockBridge,
        memory: mockMemory,
        embedding: failingEmbedding,
        retrieval: mockRetrieval,
        config: {
          tickIntervalMs: 30000,
          failureRate: 0,
          maxRetries: 0,
          systemPrompt: "test",
          agentId: "test-agent",
          reflectionThreshold: 100,
        },
        log: vi.fn(),
      });

      await loop.tick();

      const state = loop.getState();
      expect(state.tickCount).toBe(1);
      expect(state.currentActivity).toBeTruthy();
      // Memory should still be created (without embedding)
      expect(mockMemory.createMemory).toHaveBeenCalled();
    });
  });
});
