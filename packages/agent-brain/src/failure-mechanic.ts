import type { ActivityType } from "@nts/shared";
import type { LLMClient } from "./llm-client.js";

export type FailureType = "minor" | "comedic";

export interface FailureResult {
  failed: boolean;
  failureType?: FailureType;
  reaction?: string;
}

export interface FailureConfig {
  failureRate: number; // 0.0-1.0, default 0.25
  useLLM: boolean;     // true = LLM decides failure, false = random
}

const DEFAULT_CONFIG: FailureConfig = {
  failureRate: 0.25,
  useLLM: false,
};

/**
 * Determine if the current activity fails, and generate a reaction.
 * ~25% of activities end in failure (configurable).
 */
export async function checkActivityFailure(
  client: LLMClient,
  systemPrompt: string,
  activity: ActivityType,
  mood: string,
  config: Partial<FailureConfig> = {},
  randomFn: () => number = Math.random,
): Promise<FailureResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const shouldFail = randomFn() < cfg.failureRate;

  if (!shouldFail) {
    return { failed: false };
  }

  // Determine failure type: comedic is more likely when mood is good
  const failureType: FailureType = randomFn() > 0.5 ? "comedic" : "minor";

  // Generate a reaction using LLM
  const result = await client.generateText({
    model: "think",
    system: systemPrompt,
    prompt: `You were ${activity} and it just went wrong in a ${failureType} way. Your mood is ${mood}. React in 1 sentence — ${failureType === "comedic" ? "find the humor in it" : "acknowledge it with quiet frustration and dry humor"}. Stay in character.`,
  });

  return {
    failed: true,
    failureType,
    reaction: result.text.trim(),
  };
}
