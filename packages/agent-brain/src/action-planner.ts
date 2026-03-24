import { ActionCommandSchema, ACTIVITY_LIST } from "@nts/shared";
import type { ActionCommand, ActivityType } from "@nts/shared";
import type { LLMClient } from "./llm-client.js";

export interface ActionPlannerState {
  timeOfDay: string;
  currentMood: string;
  recentActivities: Array<{ activity: ActivityType; completedSecondsAgo: number }>;
}

/**
 * Calculate variety scores for activities based on recency (T4.4).
 * Penalizes recently performed activities to encourage variety.
 * Thresholds per spec: <2h=0.2, <6h=0.5, <12h=0.8, 12-24h=1.0, >24h=1.2 (bonus).
 */
export function calculateVarietyScores(
  recentActivities: Array<{ activity: ActivityType; completedSecondsAgo: number }>,
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const activity of ACTIVITY_LIST) {
    scores[activity] = 1.0; // default: no penalty
  }

  for (const recent of recentActivities) {
    const hoursAgo = recent.completedSecondsAgo / 3600;
    let score: number;

    if (hoursAgo < 2) {
      score = 0.2;   // heavy penalty
    } else if (hoursAgo < 6) {
      score = 0.5;   // moderate penalty
    } else if (hoursAgo < 12) {
      score = 0.8;   // light penalty
    } else if (hoursAgo < 24) {
      score = 1.0;   // no penalty
    } else {
      score = 1.2;   // novelty bonus
    }

    // For bonus (1.2), use max to apply it; for penalties, use min
    if (score > 1.0) {
      scores[recent.activity] = Math.max(scores[recent.activity], score);
    } else {
      scores[recent.activity] = Math.min(scores[recent.activity], score);
    }
  }

  return scores;
}

/**
 * Plan the next action for Truman using LLM with anti-repetition variety scoring.
 */
export async function planNextAction(
  client: LLMClient,
  systemPrompt: string,
  state: ActionPlannerState,
): Promise<ActionCommand> {
  const varietyScores = calculateVarietyScores(state.recentActivities);

  // Build variety hint for the prompt
  const varietyHints = Object.entries(varietyScores)
    .filter(([, score]) => score < 1.0)
    .map(([activity, score]) => `${activity} (recently done, preference: ${Math.round(score * 100)}%)`)
    .join(", ");

  const freshActivities = Object.entries(varietyScores)
    .filter(([, score]) => score >= 1.0)
    .map(([activity]) => activity)
    .join(", ");

  const prompt = `It is ${state.timeOfDay}. Your current mood is: ${state.currentMood}.

Decide what to do next. Choose an activity, how long to do it (10-600 seconds), what you're thinking, and briefly why.

${varietyHints ? `Activities you've done recently (try to avoid): ${varietyHints}` : ""}
${freshActivities ? `Fresh activities to consider: ${freshActivities}` : ""}

Available activities: ${ACTIVITY_LIST.join(", ")}`;

  const result = await client.generateObject({
    model: "think",
    system: systemPrompt,
    prompt,
    schema: ActionCommandSchema,
  });

  return result.object;
}
