import { describe, it, expect } from "vitest";
import {
  calculateRecency,
  cosineSimilarity,
  normalizeImportance,
  retrieveMemories,
} from "../memory-retrieval.js";
import type { MemoryRepository } from "../memory-repository.js";
import type { EmbeddingClient } from "../embedding-client.js";
import type { MemoryRow } from "../db/schema.js";

describe("T5.3: Memory retrieval edge cases", () => {
  describe("cosineSimilarity edge cases", () => {
    it("returns 0 for empty vectors", () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it("returns 0 for mismatched dimensions", () => {
      expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
    });

    it("returns 0 for all-zero vector", () => {
      expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    });

    it("returns 0 when both vectors are zero", () => {
      expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
    });

    it("returns 1 for identical vectors", () => {
      expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
    });

    it("returns -1 for opposite vectors", () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
    });

    it("handles very small values without precision issues", () => {
      const a = [1e-10, 1e-10];
      const b = [1e-10, 1e-10];
      const result = cosineSimilarity(a, b);
      expect(result).toBeCloseTo(1, 3);
    });
  });

  describe("calculateRecency edge cases", () => {
    it("returns 1.0 for just-accessed memory", () => {
      const now = new Date();
      expect(calculateRecency(now, now)).toBeCloseTo(1.0, 5);
    });

    it("returns value < 1 for memory accessed 1 hour ago", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const recency = calculateRecency(oneHourAgo, now);
      expect(recency).toBeLessThan(1);
      expect(recency).toBeGreaterThan(0.99);
    });

    it("returns very low value for memory accessed 1000 hours ago", () => {
      const now = new Date();
      const longAgo = new Date(now.getTime() - 1000 * 60 * 60 * 1000);
      const recency = calculateRecency(longAgo, now);
      expect(recency).toBeLessThan(0.01);
      expect(recency).toBeGreaterThan(0);
    });

    it("handles future lastAccessedAt (negative hours clamped to 0)", () => {
      const now = new Date();
      const future = new Date(now.getTime() + 60 * 60 * 1000);
      const recency = calculateRecency(future, now);
      // Math.pow(0.995, Math.max(0, -1)) = Math.pow(0.995, 0) = 1
      expect(recency).toBe(1);
    });
  });

  describe("normalizeImportance edge cases", () => {
    it("clamps importance below 1 to 0", () => {
      expect(normalizeImportance(0)).toBe(0);
      expect(normalizeImportance(-5)).toBe(0);
    });

    it("clamps importance above 10 to 1", () => {
      expect(normalizeImportance(10)).toBe(1);
      expect(normalizeImportance(100)).toBe(1);
    });

    it("normalizes mid-range correctly", () => {
      expect(normalizeImportance(5)).toBeCloseTo(4 / 9, 5);
    });
  });

  describe("retrieveMemories with empty database", () => {
    const mockEmbedding = [0.1, 0.2, 0.3];

    const mockRepo: MemoryRepository = {
      createMemory: async () => ({} as MemoryRow),
      getMemory: async () => null,
      getRecentMemories: async () => [], // Empty DB
      updateLastAccessed: async () => {},
    };

    const mockEmbeddingClient: EmbeddingClient = {
      embed: async () => mockEmbedding,
    };

    it("returns empty array when DB has no memories", async () => {
      const results = await retrieveMemories(
        mockRepo,
        mockEmbeddingClient,
        "agent-1",
        "test query",
        10,
      );
      expect(results).toEqual([]);
    });

    it("returns empty array with type filter on empty DB", async () => {
      const results = await retrieveMemories(
        mockRepo,
        mockEmbeddingClient,
        "agent-1",
        "test query",
        5,
        ["observation"],
      );
      expect(results).toEqual([]);
    });
  });

  describe("retrieveMemories with null embeddings", () => {
    const now = new Date();
    const memoryWithNullEmbedding: MemoryRow = {
      id: "mem-1",
      agentId: "agent-1",
      type: "observation",
      description: "Test memory",
      embedding: null,
      importance: 5,
      createdAt: now,
      lastAccessedAt: now,
      location: null,
      emotionalContext: null,
      metadata: null,
    };

    const mockRepo: MemoryRepository = {
      createMemory: async () => memoryWithNullEmbedding,
      getMemory: async () => null,
      getRecentMemories: async () => [memoryWithNullEmbedding],
      updateLastAccessed: async () => {},
    };

    const mockEmbeddingClient: EmbeddingClient = {
      embed: async () => [0.1, 0.2, 0.3],
    };

    it("assigns default relevance 0.5 for null embedding", async () => {
      const results = await retrieveMemories(
        mockRepo,
        mockEmbeddingClient,
        "agent-1",
        "test",
        10,
      );
      expect(results).toHaveLength(1);
      expect(results[0].relevance).toBe(0.5);
    });
  });

  describe("retrieveMemories with malformed embedding JSON", () => {
    const now = new Date();
    const memoryWithBadEmbedding: MemoryRow = {
      id: "mem-2",
      agentId: "agent-1",
      type: "observation",
      description: "Bad embedding",
      embedding: "not-valid-json",
      importance: 7,
      createdAt: now,
      lastAccessedAt: now,
      location: null,
      emotionalContext: null,
      metadata: null,
    };

    const mockRepo: MemoryRepository = {
      createMemory: async () => memoryWithBadEmbedding,
      getMemory: async () => null,
      getRecentMemories: async () => [memoryWithBadEmbedding],
      updateLastAccessed: async () => {},
    };

    const mockEmbeddingClient: EmbeddingClient = {
      embed: async () => [0.1, 0.2, 0.3],
    };

    it("falls back to relevance 0.5 for malformed JSON embedding", async () => {
      const results = await retrieveMemories(
        mockRepo,
        mockEmbeddingClient,
        "agent-1",
        "test",
        10,
      );
      expect(results).toHaveLength(1);
      expect(results[0].relevance).toBe(0.5);
    });
  });
});
