import { ImportanceScoreSchema } from "@nts/shared";
import type { LLMClient } from "./llm-client.js";

/**
 * Score the importance of an observation using LLM (Mistral Small 3).
 * Returns a score from 1-10 following Park et al.
 */
export async function scoreImportance(
  client: LLMClient,
  description: string,
): Promise<number> {
  const result = await client.generateObject({
    model: "classify",
    prompt: `On a scale of 1 to 10, where 1 is purely mundane (e.g., brushing teeth) and 10 is life-changing or deeply significant, rate the importance of this observation for an AI character's memory:

"${description}"

Consider: How likely is this to affect future behavior? How emotionally significant is it? How novel or unusual is it?`,
    schema: ImportanceScoreSchema,
  });

  return result.object.score;
}
