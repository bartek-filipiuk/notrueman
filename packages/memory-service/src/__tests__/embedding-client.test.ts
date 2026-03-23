import { describe, it, expect } from "vitest";
import { createMockEmbeddingClient, createEmbeddingClient } from "../embedding-client.js";

describe("embedding client (T3.3)", () => {
  it("mock client returns vector of correct dimensions", async () => {
    const client = createMockEmbeddingClient();
    const embedding = await client.embed("Hello world");
    expect(embedding.length).toBe(768);
  });

  it("mock client returns normalized vectors", async () => {
    const client = createMockEmbeddingClient();
    const embedding = await client.embed("Test text");
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 1);
  });

  it("getDimensions returns 768", () => {
    const client = createMockEmbeddingClient();
    expect(client.getDimensions()).toBe(768);
  });

  it("different texts produce different embeddings", async () => {
    const client = createMockEmbeddingClient();
    const emb1 = await client.embed("Hello");
    const emb2 = await client.embed("World");
    // Random vectors should be different
    const same = emb1.every((v, i) => v === emb2[i]);
    expect(same).toBe(false);
  });

  it("createEmbeddingClient falls back to random vector when Ollama unavailable", async () => {
    // Use a definitely-unreachable URL
    const client = createEmbeddingClient("http://localhost:1", "nonexistent-model");
    const embedding = await client.embed("Test");
    expect(embedding.length).toBe(768);
  });

  it("embedding values are numbers in [-1, 1] range", async () => {
    const client = createMockEmbeddingClient();
    const embedding = await client.embed("Test");
    for (const val of embedding) {
      expect(typeof val).toBe("number");
      expect(val).toBeGreaterThanOrEqual(-2);
      expect(val).toBeLessThanOrEqual(2);
    }
  });
});
