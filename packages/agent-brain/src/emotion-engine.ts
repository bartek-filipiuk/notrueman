import type { EmotionState, EmotionDelta, OverallMood } from "@nts/shared";
import {
  EMOTION_DEFAULTS,
  clampAllEmotions,
  createDefaultEmotions,
  calculateOverallMood,
} from "@nts/shared";

const EMOTION_KEYS: (keyof EmotionState)[] = [
  "happiness", "curiosity", "anxiety", "boredom",
  "excitement", "contentment", "frustration",
];

/** Drift rate per hour — emotions move toward defaults at this fraction */
const DRIFT_RATE_PER_HOUR = 0.15; // ~2-3 hours to return to defaults

/**
 * Emotion engine: manages Truman's 7-dimensional emotional state.
 * Supports delta updates, time-based drift, and mood computation.
 */
export class EmotionEngine {
  private state: EmotionState;
  private lastUpdateAt: Date;

  constructor(initial?: EmotionState) {
    this.state = initial ? clampAllEmotions({ ...initial }) : createDefaultEmotions();
    this.lastUpdateAt = new Date();
  }

  /** Get current emotion state (clamped copy) */
  getState(): EmotionState {
    return { ...this.state };
  }

  /** Get the computed overall mood label */
  getOverallMood(): OverallMood {
    const score = calculateOverallMood(this.state);
    return moodFromScore(this.state, score);
  }

  /** Get the numeric mood score (-1 to 1) */
  getMoodScore(): number {
    return calculateOverallMood(this.state);
  }

  /** Apply an emotion delta (from LLM or rules) */
  applyDelta(delta: Partial<EmotionDelta>): void {
    for (const key of EMOTION_KEYS) {
      const d = delta[key];
      if (d !== undefined && d !== 0) {
        this.state[key] += d;
      }
    }
    this.state = clampAllEmotions(this.state);
    this.lastUpdateAt = new Date();
  }

  /** Apply time-based drift toward defaults */
  applyTimeDrift(now: Date = new Date()): void {
    const hoursSinceLast = (now.getTime() - this.lastUpdateAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLast <= 0) return;

    const driftFactor = Math.min(1, hoursSinceLast * DRIFT_RATE_PER_HOUR);

    for (const key of EMOTION_KEYS) {
      const current = this.state[key];
      const target = EMOTION_DEFAULTS[key];
      this.state[key] = current + (target - current) * driftFactor;
    }

    this.state = clampAllEmotions(this.state);
    this.lastUpdateAt = now;
  }

  /** Set state directly (for recovery from persistence) */
  setState(state: EmotionState): void {
    this.state = clampAllEmotions({ ...state });
    this.lastUpdateAt = new Date();
  }
}

/** Map overall score + dominant emotion to a mood label */
function moodFromScore(state: EmotionState, score: number): OverallMood {
  // Find dominant emotion
  let maxKey: keyof EmotionState = "happiness";
  let maxVal = 0;

  for (const key of EMOTION_KEYS) {
    if (state[key] > maxVal) {
      maxVal = state[key];
      maxKey = key;
    }
  }

  // Map based on dominant emotion if it's strong enough
  if (maxVal > 0.6) {
    const moodMap: Record<keyof EmotionState, OverallMood> = {
      happiness: "happy",
      curiosity: "curious",
      anxiety: "anxious",
      boredom: "bored",
      excitement: "excited",
      contentment: "content",
      frustration: "frustrated",
    };
    return moodMap[maxKey];
  }

  // Otherwise use score
  if (score > 0.3) return "happy";
  if (score > 0.1) return "content";
  if (score < -0.3) return "frustrated";
  if (score < -0.1) return "anxious";
  return "contemplative";
}
