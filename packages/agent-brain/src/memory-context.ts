import { ActionCommandSchema, ACTIVITY_LIST } from "@nts/shared";
import type { ActionCommand, ActivityType } from "@nts/shared";
import type { LLMClient } from "./llm-client.js";
import { calculateVarietyScores } from "./action-planner.js";

export interface MemoryContextState {
  timeOfDay: string;
  currentMood: string;
  recentActivities: Array<{ activity: ActivityType; completedSecondsAgo: number }>;
  memories: string[];
}

/**
 * Plan next action with memory context.
 * Extends the basic action planner by including retrieved memories in the prompt.
 */
export async function planWithMemoryContext(
  client: LLMClient,
  systemPrompt: string,
  state: MemoryContextState,
): Promise<ActionCommand> {
  const varietyScores = calculateVarietyScores(state.recentActivities);

  const freshActivities = Object.entries(varietyScores)
    .filter(([, score]) => score >= 1.0)
    .map(([activity]) => activity)
    .join(", ");

  const memorySection = state.memories.length > 0
    ? `\nRelevant memories:\n${state.memories.map((m) => `- ${m}`).join("\n")}\n`
    : "";

  const prompt = `It is ${state.timeOfDay}. Your current mood is: ${state.currentMood}.
${memorySection}
Decide what to do next. Choose an activity, duration (10-600 seconds), what you're thinking, and briefly why.

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
