import type { LLMClient } from "./llm-client.js";
import type { MemoryRow } from "@nts/memory-service";

export interface ReflectionResult {
  reflections: string[];
  sourceIds: string[];
}

/**
 * Generate reflections from recent observations.
 * Called every ~30 minutes. Takes 20 recent observations and asks LLM to synthesize insights.
 */
export async function generateReflections(
  client: LLMClient,
  systemPrompt: string,
  recentObservations: Pick<MemoryRow, "id" | "description">[],
): Promise<ReflectionResult> {
  if (recentObservations.length === 0) {
    return { reflections: [], sourceIds: [] };
  }

  const observationList = recentObservations
    .map((o, i) => `${i + 1}. ${o.description}`)
    .join("\n");

  const result = await client.generateText({
    model: "think",
    system: systemPrompt,
    prompt: `Looking back at your recent experiences, what patterns, insights, or reflections come to mind?

Your recent observations:
${observationList}

Synthesize 1-3 higher-level insights or reflections. Each should be a single sentence. Be philosophical, personal, and true to your nature. Don't just summarize — find deeper meaning or patterns.

Format each reflection on its own line.`,
  });

  const reflections = result.text
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);

  return {
    reflections,
    sourceIds: recentObservations.map((o) => o.id),
  };
}
