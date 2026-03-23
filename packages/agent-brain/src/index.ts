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
