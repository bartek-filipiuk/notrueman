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
  const toolResultsBlock = context.toolResults
    ? `\nYou just searched for something and found: ${context.toolResults}\nIncorporate this into your thinking.`
    : "";

  const memoriesBlock = context.recentMemories?.length
    ? `\nYour recent memories: ${context.recentMemories.map((m, i) => `${i + 1}. ${m}`).join("; ")}. Continue your inner story — these memories shape your thoughts.`
    : "";

  const prompt = `You are currently ${context.activity}. It's ${context.timeOfDay}. Your mood is ${context.mood}.${context.recentThought ? ` Your last thought was: "${context.recentThought}"` : ""}${toolResultsBlock}${memoriesBlock}

What are you thinking right now? Express your inner monologue in 1-3 short sentences. Be reflective, warm, and true to your personality. Don't describe your actions — share what's going through your mind.`;

  const result = await client.generateText({
    model: "think",
    system: systemPrompt,
    prompt,
  });

  return result.text.trim();
}
