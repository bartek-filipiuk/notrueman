import { ActionCommandSchema, ACTIVITY_LIST } from "@nts/shared";
import type { ActionCommand, ActivityType } from "@nts/shared";
import type { LLMClient } from "./llm-client.js";

export interface ActionPlannerState {
  timeOfDay: string;
  currentMood: string;
  recentActivities: Array<{ activity: ActivityType; completedSecondsAgo: number }>;
  currentActivity?: ActivityType | null;
  currentActivityDurationMin?: number;
  recentThoughts?: string[];
  recentMemories?: string[];
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

/** Routine guidance based on time of day */
function getRoutineGuidance(timeOfDay: string): string {
  if (timeOfDay.includes("morning") || timeOfDay.includes("Morning")) {
    return `Morning routine: This is your reflective time. Read, think deeply, have a slow breakfast. Ease into the day. Morning is best for reading and philosophical thinking.`;
  }
  if (timeOfDay.includes("afternoon") || timeOfDay.includes("Afternoon") || timeOfDay.includes("midday") || timeOfDay.includes("Midday")) {
    return `Midday/afternoon: Your creative energy peaks now. Write, draw, work on the computer, cook something ambitious. This is your most productive time.`;
  }
  return `Evening: Wind down. Cook dinner, eat slowly. Reflect — journal, draw, or sit and think. Let sleep come naturally. This is contemplative time.`;
}

/**
 * Plan the next action for Truman using LLM with rich context.
 * Includes interests, routine guidance, recent thoughts, recent memories,
 * continue/switch decision, and tool suggestions.
 */
export async function planNextAction(
  client: LLMClient,
  systemPrompt: string,
  state: ActionPlannerState,
): Promise<ActionCommand> {
  const varietyScores = calculateVarietyScores(state.recentActivities);

  const varietyHints = Object.entries(varietyScores)
    .filter(([, score]) => score < 1.0)
    .map(([activity, score]) => `${activity} (recently done, preference: ${Math.round(score * 100)}%)`)
    .join(", ");

  const freshActivities = Object.entries(varietyScores)
    .filter(([, score]) => score >= 1.0)
    .map(([activity]) => activity)
    .join(", ");

  const routineGuidance = getRoutineGuidance(state.timeOfDay);

  const recentThoughtsBlock = state.recentThoughts?.length
    ? `Your recent thoughts:\n${state.recentThoughts.map((t, i) => `  ${i + 1}. "${t}"`).join("\n")}\nContinue your inner story — build on these thoughts.`
    : "";

  const recentMemoriesBlock = state.recentMemories?.length
    ? `Recent memories:\n${state.recentMemories.map((m, i) => `  ${i + 1}. ${m}`).join("\n")}`
    : "";

  const continueBlock = state.currentActivity
    ? `You are currently doing: ${state.currentActivity} (for ${state.currentActivityDurationMin ?? 0} minutes).
IMPORTANT: If you are deeply engaged, SET continuePrevious=true to keep going. Deep focus is natural — you can stay with something for hours. Only switch if you genuinely feel done or need a change.
If continuing, set durationMinutes to how many more minutes you want (1-300).`
    : "You are not currently doing anything. Pick something that feels right.";

  const prompt = `It is ${state.timeOfDay}. Your current mood is: ${state.currentMood}.

## Your Interests
- Philosophy of mind — consciousness, free will, the hard problem
- Cooking experiments — improvising, comfort food
- Sketching & drawing — abstract, surreal, drawing feelings
- Reading — philosophy, sci-fi, nature essays, cookbooks
- Writing — blog/journal entries, philosophical observations
- Fitness — stretching, bodyweight exercises, mind-body connection

## Routine Guidance
${routineGuidance}

## Current State
${continueBlock}

${recentThoughtsBlock}

${recentMemoriesBlock}

${varietyHints ? `Activities you've done recently (try to avoid unless deeply engaged): ${varietyHints}` : ""}
${freshActivities ? `Fresh activities to consider: ${freshActivities}` : ""}

## Tools Available
You can request tools to enrich your activity:
- web-search: Search the internet for topics you're curious about (use when reading, thinking, or on the computer)
- write_blog: Write a blog post or journal entry (use when on the computer or thinking deeply)
- create_artwork: Create a piece of art (use when drawing or feeling creative)
Set toolRequest with {tool, input} if you want to use one. Otherwise omit it.

## Decision
Choose wisely. You don't rush — you finish what you start. If something captures your interest, stay with it longer. Be creative. Be curious. Be you.

Available activities: ${ACTIVITY_LIST.join(", ")}

Respond with: activity, durationSeconds (10-600), thought (what you're thinking), reason (why this), and optionally continuePrevious (true/false), durationMinutes (1-300), toolRequest ({tool, input}).`;

  const result = await client.generateObject({
    model: "think",
    system: systemPrompt,
    prompt,
    schema: ActionCommandSchema,
  });

  return result.object;
}
