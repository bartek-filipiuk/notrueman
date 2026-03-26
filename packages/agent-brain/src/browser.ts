// Browser-safe entry point for @nts/agent-brain.
// Excludes: CognitiveLoop, HealthServer, memory-service, fastify, prom-client.
// Used by packages/renderer via Vite alias.

export { BrainLoop } from "./brain-loop";
export type { BrainLoopConfig, BrainLoopState } from "./brain-loop";
export { RendererBridge } from "./renderer-bridge";
export type { RendererHandler } from "./renderer-bridge";
export { createLLMClient } from "./llm-client";
export type { LLMClient, LLMClientConfig, ModelType } from "./llm-client";
// NOTE: loadPersonality uses fs.readFileSync — not browser-compatible.
// Personality prompt should be embedded or fetched in browser context.
export { EmotionEngine } from "./emotion-engine";
export { PhysicalStateEngine } from "./physical-state";
export { planNextAction } from "./action-planner";
export { generateThought } from "./thought-generator";
export { checkActivityFailure } from "./failure-mechanic";
export { getTimeOfDay } from "./utils";
