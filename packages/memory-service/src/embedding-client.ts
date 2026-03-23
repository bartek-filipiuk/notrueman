const EMBEDDING_DIMS = 768;

export interface EmbeddingClient {
  embed(text: string): Promise<number[]>;
  getDimensions(): number;
}

/**
 * Create an embedding client using Ollama (nomic-embed-text).
 * Falls back to random vectors when Ollama is unavailable.
 */
export function createEmbeddingClient(
  ollamaBaseUrl: string = "http://localhost:11434",
  model: string = "nomic-embed-text",
): EmbeddingClient {
  return {
    async embed(text: string): Promise<number[]> {
      try {
        const response = await fetch(`${ollamaBaseUrl}/api/embed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, input: text }),
        });

        if (!response.ok) {
          throw new Error(`Ollama embedding failed: ${response.status}`);
        }

        const data = (await response.json()) as { embeddings: number[][] };
        if (!data.embeddings?.[0] || data.embeddings[0].length !== EMBEDDING_DIMS) {
          throw new Error(`Invalid embedding dimensions: expected ${EMBEDDING_DIMS}`);
        }

        return data.embeddings[0];
      } catch {
        // Fallback: random vector for dev when Ollama is unavailable
        return createRandomVector(EMBEDDING_DIMS);
      }
    },

    getDimensions(): number {
      return EMBEDDING_DIMS;
    },
  };
}

/** Create a random unit vector (for dev fallback) */
function createRandomVector(dims: number): number[] {
  const vec = Array.from({ length: dims }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => v / norm);
}

/** Create a mock embedding client for testing */
export function createMockEmbeddingClient(): EmbeddingClient {
  return {
    async embed(_text: string): Promise<number[]> {
      return createRandomVector(EMBEDDING_DIMS);
    },
    getDimensions(): number {
      return EMBEDDING_DIMS;
    },
  };
}
