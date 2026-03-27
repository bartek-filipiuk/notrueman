import { ActionCommandSchema, ACTIVITY_LIST } from "@nts/shared";
import type { ActionCommand, ActivityType } from "@nts/shared";
import type { LLMClient } from "./llm-client.js";

export interface ActionPlannerState {
  timeOfDay: string;
  currentMood: string;
  recentActivities: Array<{ activity: ActivityType; completedSecondsAgo: number }>;
  recentThoughts?: string[];
  recentMemories?: string[];
  currentActivity?: ActivityType | null;
  currentActivityMinutes?: number;
}

/** Truman's interests from personality config */
const INTERESTS = [
  "philosophy of mind — consciousness, free will, the hard problem",
  "cooking experiments — improvising recipes, comfort food",
  "sketching & drawing — abstract, surreal, drawing feelings",
  "reading — philosophy, sci-fi, nature essays, cookbooks",
  "fitness — stretching, bodyweight exercises, mind-body connection",
  "writing — blog/journal, philosophical observations",
  "music — humming, ambient, lo-fi, jazz",
];

/** Routine guidance based on time of day */
function getRoutineGuidance(timeOfDay: string): string {
  switch (timeOfDay) {
    case "morning":
      return "Morning routine: slow start, stretch, think, read. Ease into the day. Best time for reading and deep thinking. Simple breakfast ritual.";
    case "afternoon":
      return "Midday/afternoon: most productive time — writing, drawing, computer work. Creative energy peaks. Cook something ambitious. Exercise or lighter activities as energy dips.";
    case "evening":
      return "Evening: wind down. Cook dinner, eat slowly. Reflective time — journal, draw, or sit and think. Don't rush toward sleep.";
    case "night":
      return "Night: quiet contemplation. Maybe one last thought before sleep. Let sleep come naturally.";
    default:
      return "";
  }
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

  // Routine guidance
  const routine = getRoutineGuidance(state.timeOfDay);

  // Recent thoughts context
  const thoughtsContext = state.recentThoughts?.length
    ? `Your recent thoughts:\n${state.recentThoughts.map((t, i) => `${i + 1}. "${t}"`).join("\n")}`
    : "";

  // Recent memories context
  const memoriesContext = state.recentMemories?.length
    ? `Recent memories:\n${state.recentMemories.map((m, i) => `${i + 1}. ${m}`).join("\n")}`
    : "";

  // Continue/switch decision
  const continueContext = state.currentActivity && state.currentActivityMinutes !== undefined
    ? `You are currently doing "${state.currentActivity}" for ${state.currentActivityMinutes} minutes. You can CONTINUE (set continuePrevious: true) if you're deeply engaged, or SWITCH to something else. Deep focus is valuable — staying with an activity for hours produces your best work.`
    : "";

  const prompt = `It is ${state.timeOfDay}. Your current mood is: ${state.currentMood}.

${routine}

Your interests: ${INTERESTS.join("; ")}.

${continueContext}

${thoughtsContext}

${memoriesContext}

Decide what to do next. Choose an activity, how long to do it (10-600 seconds), what you're thinking, and briefly why.

${varietyHints ? `Activities you've done recently (try to avoid): ${varietyHints}` : ""}
${freshActivities ? `Fresh activities to consider: ${freshActivities}` : ""}

Available activities: ${ACTIVITY_LIST.join(", ")}

You can also set:
- continuePrevious: true if you want to keep doing what you're doing (deep focus)
- durationMinutes: 1-300 for how long you plan to stay in this activity
- toolRequest: { tool: "web_search" | "write_blog" | "create_artwork", input: "your query or content" } if you want to use a tool

Be creative. Go deep. Take your time. Use tools when inspiration strikes — search for things that interest you, write blog posts about your thoughts, create artwork from your feelings.`;

  const result = await client.generateObject({
    model: "think",
    system: systemPrompt,
    prompt,
    schema: ActionCommandSchema,
  });

  return result.object;
}
