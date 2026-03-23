/** 7-dimension emotion model (design-spec.md S3, agent-spec.md S4) */
export interface EmotionState {
  happiness: number; // 0.0-1.0, default 0.6, floor 0.2
  curiosity: number; // 0.0-1.0, default 0.7
  anxiety: number; // 0.0-1.0, default 0.2, ceiling 0.6
  boredom: number; // 0.0-1.0, default 0.3, ceiling 0.9
  excitement: number; // 0.0-1.0, default 0.4
  contentment: number; // 0.0-1.0, default 0.5
  frustration: number; // 0.0-1.0, default 0.1, ceiling 0.7
}

/** Physical state tracked alongside emotions (agent-spec.md S10) */
export interface PhysicalState {
  energy: number; // 0.0-1.0
  hunger: number; // 0.0-1.0
  tiredness: number; // 0.0-1.0
}

/** Overall derived mood: weighted composite of emotion dimensions */
export type OverallMood =
  | "happy"
  | "curious"
  | "anxious"
  | "bored"
  | "excited"
  | "content"
  | "frustrated"
  | "contemplative"
  | "neutral";
