export {
  memories,
  reflectionSources,
  agentStateSnapshots,
} from "./db/schema.js";

export type {
  MemoryRow,
  NewMemoryRow,
  ReflectionSourceRow,
  NewReflectionSourceRow,
  AgentStateSnapshotRow,
  NewAgentStateSnapshotRow,
} from "./db/schema.js";

export { createDatabase } from "./db/connection.js";
export type { Database } from "./db/connection.js";

export { createMemoryRepository } from "./memory-repository.js";
export type { MemoryRepository } from "./memory-repository.js";

export { createEmbeddingClient, createMockEmbeddingClient } from "./embedding-client.js";
export type { EmbeddingClient } from "./embedding-client.js";
