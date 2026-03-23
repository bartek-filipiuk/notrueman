import type { AwakeningPhase } from "./awakening.js";

/** All 16 event log types (observability-spec.md S2.2) */
export type EventType =
  | "tick_start"
  | "observation"
  | "memory_retrieval"
  | "reflection_trigger"
  | "reflection_result"
  | "react_decision"
  | "replan"
  | "action_start"
  | "action_result"
  | "vocalization"
  | "emotion_update"
  | "awakening_update"
  | "llm_call"
  | "llm_fallback"
  | "cost_checkpoint"
  | "tick_end";

/** Event payload types mapped to event type */
export interface EventPayloads {
  tick_start: {
    emotions: Record<string, number>;
    energy: number;
    hunger: number;
    tiredness: number;
    current_activity: string | null;
    awakening_phase: AwakeningPhase;
    suspicion_level: number;
  };
  observation: {
    description: string;
    importance: number;
    location: string | null;
    viewer_influenced: boolean;
    embedding_latency_ms: number;
  };
  memory_retrieval: {
    query_summary: string;
    result_count: number;
    top_5_scores: number[];
    retrieval_latency_ms: number;
  };
  reflection_trigger: {
    accumulator_value: number;
    questions_generated: number;
    evidence_count_per_question: number[];
  };
  reflection_result: {
    question: string;
    insight: string;
    source_memory_ids: string[];
    importance_assigned: number;
  };
  react_decision: {
    observation: string;
    decision: boolean;
    reason: string;
    model: string;
    latency_ms: number;
  };
  replan: {
    trigger: string;
    old_activity: string | null;
    new_actions_count: number;
    model: string;
    latency_ms: number;
  };
  action_start: {
    action_type: string;
    action_description: string;
    planned_duration_min: number;
  };
  action_result: {
    action_type: string;
    success: boolean;
    actual_duration_min: number;
    outcome_description: string;
  };
  vocalization: {
    text: string;
    bubble_type: string;
    model: string;
    latency_ms: number;
    token_count: number;
  };
  emotion_update: {
    deltas: Record<string, number>;
    source: "rule" | "llm";
    trigger: string;
  };
  awakening_update: {
    old_level: number;
    new_level: number;
    delta: number;
    trigger_description: string;
  };
  llm_call: {
    model: string;
    purpose: string;
    prompt_tokens: number;
    completion_tokens: number;
    latency_ms: number;
    cost_usd: number;
    success: boolean;
  };
  llm_fallback: {
    original_model: string;
    fallback_model: string;
    reason: string;
    recovered: boolean;
  };
  cost_checkpoint: {
    daily_total: number;
    hourly_rate: number;
    by_service: { llm: number; tts: number; images: number };
    cap_percentage: number;
  };
  tick_end: {
    total_llm_calls: number;
    total_latency_ms: number;
    tick_duration_ms: number;
  };
}

/** Typed event log entry (observability-spec.md S2.1) */
export interface EventLogEntry<T extends EventType = EventType> {
  id: number;
  tickId: string;
  simTime: Date;
  wallTime: Date;
  eventType: T;
  data: EventPayloads[T];
  configVersion: string;
}
