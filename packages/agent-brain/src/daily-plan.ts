import { DailyPlanSchema } from "@nts/shared";
import type { DailyPlan } from "@nts/shared";
import type { LLMClient } from "./llm-client.js";

/**
 * Generate a daily plan for Truman using LLM.
 * The plan contains 5-8 activities across time blocks, with an overall theme.
 */
export async function generateDailyPlan(
  client: LLMClient,
  systemPrompt: string,
  timeOfDay: string,
): Promise<DailyPlan> {
  const result = await client.generateObject({
    model: "think",
    system: systemPrompt,
    prompt: `It is currently ${timeOfDay}. Plan your day ahead. What activities would you like to do? Consider your mood, the time of day, and what might be interesting or fulfilling. Include a mix of practical tasks (eating, exercising) and things you enjoy (reading, drawing, thinking). Plan 5-8 activities spread across the day's remaining time blocks (morning, afternoon, evening, night).`,
    schema: DailyPlanSchema,
  });

  return result.object;
}
