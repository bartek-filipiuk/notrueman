import type { MemoryRow } from "./db/schema.js";
import type { MemoryRepository } from "./memory-repository.js";
import type { EmbeddingClient } from "./embedding-client.js";

export interface ScoredMemoryResult extends MemoryRow {
  score: number;
  recency: number;
  relevance: number;
  normalizedImportance: number;
}

/**
 * Calculate recency score using exponential decay.
 * score = 0.995^hours_since_last_access
 */
export function calculateRecency(lastAccessedAt: Date, now: Date = new Date()): number {
  const hoursSince = (now.getTime() - lastAccessedAt.getTime()) / (1000 * 60 * 60);
  return Math.pow(0.995, Math.max(0, hoursSince));
}

/**
 * Calculate cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Normalize importance score from 1-10 to 0-1.
 */
export function normalizeImportance(importance: number): number {
  return Math.max(0, Math.min(1, (importance - 1) / 9));
}

/**
 * Retrieve memories using Park et al. scoring:
 * score = recency × importance × relevance
 *
 * @param repo Memory repository
 * @param embeddingClient Embedding client for query vectorization
 * @param agentId Agent ID
 * @param query Text query for relevance matching
 * @param k Number of results to return
 * @param types Optional filter by memory types
 */
export async function retrieveMemories(
  repo: MemoryRepository,
  embeddingClient: EmbeddingClient,
  agentId: string,
  query: string,
  k: number,
  types?: string[],
): Promise<ScoredMemoryResult[]> {
  // 1. Get query embedding
  const queryEmbedding = await embeddingClient.embed(query);

  // 2. Fetch recent memories (larger pool for scoring)
  const poolSize = Math.max(k * 10, 100);
  const candidateType = types?.length === 1 ? types[0] : undefined;
  const candidates = await repo.getRecentMemories(agentId, poolSize, candidateType);

  // 3. Filter by types if multiple specified
  const filtered = types && types.length > 1
    ? candidates.filter((m) => types.includes(m.type))
    : candidates;

  const now = new Date();

  // 4. Score each memory
  const scored: ScoredMemoryResult[] = filtered.map((memory) => {
    const recency = calculateRecency(memory.lastAccessedAt, now);
    const normalizedImp = normalizeImportance(memory.importance);

    // Calculate relevance via cosine similarity
    let relevance = 0.5; // default when no embedding
    if (memory.embedding) {
      try {
        const memoryEmbedding: number[] = JSON.parse(memory.embedding);
        relevance = (cosineSimilarity(queryEmbedding, memoryEmbedding) + 1) / 2; // normalize to 0-1
      } catch {
        relevance = 0.5;
      }
    }

    const score = recency * normalizedImp * relevance;

    return {
      ...memory,
      score,
      recency,
      relevance,
      normalizedImportance: normalizedImp,
    };
  });

  // 5. Sort by score descending and take top k
  scored.sort((a, b) => b.score - a.score);

  // 6. Update last_accessed_at for retrieved memories
  const topK = scored.slice(0, k);
  await Promise.all(topK.map((m) => repo.updateLastAccessed(m.id)));

  return topK;
}
