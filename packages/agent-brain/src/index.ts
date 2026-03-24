export { createLLMClient } from "./llm-client.js";
export type {
  LLMClient,
  LLMClientConfig,
  ModelType,
  GenerateTextParams,
  GenerateTextResult,
  GenerateObjectParams,
  GenerateObjectResult,
} from "./llm-client.js";

export { loadPersonalityPrompt } from "./personality.js";
export { generateDailyPlan } from "./daily-plan.js";
export { planNextAction, calculateVarietyScores } from "./action-planner.js";
export type { ActionPlannerState } from "./action-planner.js";
export { generateThought } from "./thought-generator.js";
export type { ThoughtContext } from "./thought-generator.js";
export { checkActivityFailure } from "./failure-mechanic.js";
export type { FailureResult, FailureConfig, FailureType } from "./failure-mechanic.js";
export { RendererBridge } from "./renderer-bridge.js";
export type { RendererHandler } from "./renderer-bridge.js";
export { BrainLoop } from "./brain-loop.js";
export type { BrainLoopConfig, BrainLoopState } from "./brain-loop.js";
export { CognitiveLoop } from "./cognitive-loop.js";
export type {
  CognitiveLoopConfig,
  CognitiveLoopDeps,
  CognitiveLoopState,
  MemoryAdapter,
  EmbeddingAdapter,
  RetrievalAdapter,
} from "./cognitive-loop.js";
export { loadConfig, TrumanConfigSchema } from "./config.js";
export type { TrumanConfig } from "./config.js";
export { RateLimiter } from "./rate-limiter.js";
export { scoreImportance } from "./importance-scorer.js";
export { EmotionEngine } from "./emotion-engine.js";
export { generateReflections } from "./reflection-generator.js";
export type { ReflectionResult } from "./reflection-generator.js";
export { planWithMemoryContext } from "./memory-context.js";
export type { MemoryContextState } from "./memory-context.js";
export { DayNightCycle } from "./day-night-cycle.js";
export type { DayNightConfig, DayPhase, DayNightState } from "./day-night-cycle.js";
export { PhysicalStateEngine } from "./physical-state.js";
