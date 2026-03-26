// Browser-safe entry point for @nts/shared.
// Excludes queue infrastructure (BullMQ/ioredis) which requires Node.js.
// Used by packages/renderer via Vite alias.

// Constants
export * from "./constants";

// Types
export type {
  EmotionState,
  PhysicalState,
  OverallMood,
} from "./types/emotions";
export type {
  PersonalityState,
  PersonalityInfluence,
  Preferences,
} from "./types/personality";
export type {
  AwakeningPhase,
  AwakeningState,
  AnomalyEvent,
} from "./types/awakening";
export type {
  MemoryType,
  PlanTimeframe,
  PlanStatus,
  Memory,
  Observation,
  Reflection,
  Plan,
  ScoredMemory,
} from "./types/memory";
export type {
  Platform,
  ViewerEventType,
  ViewerEvent,
} from "./types/viewer-event";
export type {
  EventType,
  EventPayloads,
  EventLogEntry,
} from "./types/events";
export type {
  Position,
  AnimationState,
  BubbleType,
  BubbleStyle,
  InteractiveObjectId,
  RoomObject,
  RoomZone,
  RendererCommandType,
  RendererCommands,
  RendererCommand,
  HUDState,
  CharacterState,
  RendererState,
} from "./types/renderer";
export type {
  SanitizerLayer,
  SanitizerVerdict,
  SanitizerResult,
} from "./types/sanitizer";
export type {
  ActivityType,
  CurrentActivity,
  AgentState,
} from "./types/agent-state";

// Schemas
export {
  ImportanceScoreSchema,
  ReactDecisionSchema,
  EmotionDeltaSchema,
  DailyPlanSchema,
  DailyPlanActivitySchema,
  HourlyPlanSchema,
  HourlyBlockSchema,
  ActionQueueSchema,
  ActionSchema,
  ReflectionQuestionsSchema,
  ActionCommandSchema,
  BubbleTypeSchema,
} from "./schemas/index";
export type {
  ImportanceScore,
  ReactDecision,
  EmotionDelta,
  DailyPlan,
  HourlyPlan,
  ActionQueue,
  ActionCommand,
  ReflectionQuestions,
} from "./schemas/index";

// Utils
export {
  clampEmotion,
  clampAllEmotions,
  createDefaultEmotions,
  calculateOverallMood,
} from "./utils/emotions";

// Save data (state persistence)
export { SaveDataSchema, SAVE_DATA_VERSION } from "./types/save-data";
export type { SaveData } from "./types/save-data";

// NOTE: Queue infrastructure (BullMQ) is NOT exported here.
// Import from "@nts/shared" (full entry) in Node.js packages only.
