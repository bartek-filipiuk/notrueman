import type { EmotionState, PhysicalState } from "./emotions.js";
import type { PersonalityState, Preferences } from "./personality.js";
import type { AwakeningState } from "./awakening.js";
import type { Plan } from "./memory.js";

/** Activity types (design-spec.md S5.2) */
export type ActivityType =
  | "sleep"
  | "eat"
  | "read"
  | "computer"
  | "exercise"
  | "think"
  | "cook"
  | "draw";

/** Current activity state */
export interface CurrentActivity {
  type: ActivityType;
  startedAt: Date;
  plannedDuration: number; // minutes
  progress: number; // 0.0-1.0
}

/** Full agent state (agent-spec.md S10.1) */
export interface AgentState {
  agentId: string;
  name: string;

  emotions: EmotionState;
  personality: PersonalityState;

  currentActivity: CurrentActivity | null;
  dailyPlan: Plan | null;
  currentGoals: string[];

  awakening: AwakeningState;
  preferences: Preferences;
  physical: PhysicalState;

  lastActionAt: Date;
  lastReflectionAt: Date;
  lastPlanUpdateAt: Date;
  wakeUpTime: Date;
  bedTime: Date;
}
