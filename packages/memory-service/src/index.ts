export {
  memories,
  reflectionSources,
  agentStateSnapshots,
  llmCalls,
} from "./db/schema.js";

export type {
  MemoryRow,
  NewMemoryRow,
  ReflectionSourceRow,
  NewReflectionSourceRow,
  AgentStateSnapshotRow,
  NewAgentStateSnapshotRow,
  LLMCallRow,
  NewLLMCallRow,
} from "./db/schema.js";

export { createDatabase } from "./db/connection.js";
export type { Database } from "./db/connection.js";

export { createMemoryRepository } from "./memory-repository.js";
export type { MemoryRepository } from "./memory-repository.js";

export { createEmbeddingClient, createMockEmbeddingClient } from "./embedding-client.js";
export type { EmbeddingClient } from "./embedding-client.js";

export {
  retrieveMemories,
  calculateRecency,
  cosineSimilarity,
  normalizeImportance,
} from "./memory-retrieval.js";
export type { ScoredMemoryResult } from "./memory-retrieval.js";

export { createStatePersistence } from "./state-persistence.js";
export type { StatePersistence } from "./state-persistence.js";

export { createLLMCallLog } from "./llm-call-log.js";
export type { LLMCallLog, LLMCallStats, LLMCallLogFilters } from "./llm-call-log.js";
