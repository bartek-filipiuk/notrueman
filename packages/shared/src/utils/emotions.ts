import type { EmotionState } from "../types/emotions.js";
import {
  EMOTION_DEFAULTS,
  EMOTION_FLOORS,
  EMOTION_CEILINGS,
} from "../constants.js";

const EMOTION_KEYS: (keyof EmotionState)[] = [
  "happiness",
  "curiosity",
  "anxiety",
  "boredom",
  "excitement",
  "contentment",
  "frustration",
];

/** Clamp a single emotion value to its floor/ceiling */
export function clampEmotion(
  key: keyof EmotionState,
  value: number,
): number {
  const floor = EMOTION_FLOORS[key] ?? 0;
  const ceiling = EMOTION_CEILINGS[key] ?? 1;
  return Math.max(floor, Math.min(ceiling, value));
}

/** Clamp all emotion values to their floors/ceilings */
export function clampAllEmotions(emotions: EmotionState): EmotionState {
  const result = { ...emotions };
  for (const key of EMOTION_KEYS) {
    result[key] = clampEmotion(key, result[key]);
  }
  return result;
}

/** Create default emotion state */
export function createDefaultEmotions(): EmotionState {
  return { ...EMOTION_DEFAULTS };
}

/** Calculate overall mood as a weighted composite (-1.0 to 1.0) */
export function calculateOverallMood(emotions: EmotionState): number {
  const positive =
    emotions.happiness * 0.3 +
    emotions.contentment * 0.2 +
    emotions.excitement * 0.15 +
    emotions.curiosity * 0.1;
  const negative =
    emotions.anxiety * 0.2 +
    emotions.frustration * 0.2 +
    emotions.boredom * 0.1;
  // Scale to -1.0 to 1.0
  return Math.max(-1, Math.min(1, (positive - negative) * 2));
}
