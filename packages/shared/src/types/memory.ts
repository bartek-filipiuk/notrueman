import type { EmotionState } from "./emotions.js";

/** Memory types from Park et al. (agent-spec.md S5.1) */
export type MemoryType = "observation" | "reflection" | "plan";

/** Plan timeframes (agent-spec.md S5.1) */
export type PlanTimeframe = "immediate" | "hourly" | "daily";

/** Plan status (agent-spec.md S5.1) */
export type PlanStatus = "pending" | "in_progress" | "completed" | "abandoned";

/** Base memory type (agent-spec.md S5) */
export interface Memory {
  id: string;
  agentId: string;
  type: MemoryType;
  description: string;
  embedding: number[] | null; // vector(768) from nomic-embed-text
  importance: number; // 1-10
  createdAt: Date;
  lastAccessedAt: Date;
  location: string | null;
  emotionalContext: Partial<EmotionState>;
  viewerInfluenced: boolean;
  metadata: Record<string, unknown>;
}

/** Observation memory (agent-spec.md S5.1) */
export interface Observation extends Memory {
  type: "observation";
}

/** Reflection memory with source links (agent-spec.md S5.1) */
export interface Reflection extends Memory {
  type: "reflection";
  sourceIds: string[];
}

/** Plan memory with hierarchy (agent-spec.md S5.1) */
export interface Plan extends Memory {
  type: "plan";
  timeframe: PlanTimeframe;
  status: PlanStatus;
  parentPlanId: string | null;
}

/** Memory retrieval result with scoring components */
export interface ScoredMemory extends Memory {
  score: number;
  recency: number;
  relevance: number;
  normalizedImportance: number;
}
