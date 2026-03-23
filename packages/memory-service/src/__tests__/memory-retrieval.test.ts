import { describe, it, expect } from "vitest";
import {
  calculateRecency,
  cosineSimilarity,
  normalizeImportance,
} from "../memory-retrieval.js";

describe("memory retrieval scoring (T3.4)", () => {
  describe("recency scoring", () => {
    it("returns 1.0 for just-accessed memory", () => {
      const now = new Date();
      expect(calculateRecency(now, now)).toBeCloseTo(1.0, 3);
    });

    it("decays over time (0.995^hours)", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600 * 1000);
      const score = calculateRecency(oneHourAgo, now);
      expect(score).toBeCloseTo(0.995, 3);
    });

    it("24 hours ago gives significant decay", () => {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
      const score = calculateRecency(dayAgo, now);
      // 0.995^24 ≈ 0.887
      expect(score).toBeCloseTo(0.887, 2);
    });

    it("one week ago gives strong decay", () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      const score = calculateRecency(weekAgo, now);
      // 0.995^168 ≈ 0.429
      expect(score).toBeCloseTo(0.429, 1);
    });

    it("handles future dates gracefully", () => {
      const now = new Date();
      const future = new Date(now.getTime() + 3600 * 1000);
      expect(calculateRecency(future, now)).toBeCloseTo(1.0, 3);
    });
  });

  describe("cosine similarity", () => {
    it("identical vectors have similarity 1.0", () => {
      const v = [1, 0, 0, 1];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
    });

    it("orthogonal vectors have similarity 0.0", () => {
      const a = [1, 0, 0, 0];
      const b = [0, 1, 0, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
    });

    it("opposite vectors have similarity -1.0", () => {
      const a = [1, 0];
      const b = [-1, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
    });

    it("handles empty vectors", () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it("handles zero vectors", () => {
      expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
    });
  });

  describe("importance normalization", () => {
    it("importance 1 maps to 0.0", () => {
      expect(normalizeImportance(1)).toBeCloseTo(0.0, 5);
    });

    it("importance 10 maps to 1.0", () => {
      expect(normalizeImportance(10)).toBeCloseTo(1.0, 5);
    });

    it("importance 5 maps to ~0.44", () => {
      expect(normalizeImportance(5)).toBeCloseTo(4 / 9, 3);
    });

    it("clamps below 1", () => {
      expect(normalizeImportance(0)).toBe(0);
    });

    it("clamps above 10", () => {
      expect(normalizeImportance(15)).toBe(1);
    });
  });
});
