import type { ActivityType } from "@nts/shared";
import type { LLMClient } from "./llm-client.js";

export interface ThoughtContext {
  activity: ActivityType;
  mood: string;
  timeOfDay: string;
  recentThought?: string;
  toolResults?: string;
  recentMemories?: string[];
}

/**
 * Generate Truman's inner monologue for the current activity and mood.
 * Returns 1-3 sentences of reflective, character-appropriate thought.
 */
export async function generateThought(
  client: LLMClient,
  systemPrompt: string,
  context: ThoughtContext,
): Promise<string> {
  // Build tool results context
  const toolContext = context.toolResults
    ? `\nYou just used a tool and got these results: ${context.toolResults}`
    : "";

  // Build recent memories context
  const memoriesContext = context.recentMemories?.length
    ? `\nYour recent memories: ${context.recentMemories.join("; ")}`
    : "";

  const prompt = `You are currently ${context.activity}. It's ${context.timeOfDay}. Your mood is ${context.mood}.${context.recentThought ? ` Your last thought was: "${context.recentThought}"` : ""}${toolContext}${memoriesContext}

What are you thinking right now? Express your inner monologue in 1-3 short sentences. Be reflective, warm, and true to your personality. Don't describe your actions — share what's going through your mind.${context.toolResults ? " Incorporate what you learned from the tool results into your thinking." : ""}${context.recentMemories?.length ? " Let your recent memories color your inner narrative — continue your inner story." : ""}`;

  const result = await client.generateText({
    model: "think",
    system: systemPrompt,
    prompt,
  });

  return result.text.trim();
}
