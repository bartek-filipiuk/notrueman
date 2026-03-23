import { readFileSync } from "fs";
import { z } from "zod";

export const TrumanConfigSchema = z.object({
  tickIntervalMs: z.number().min(10000).max(120000),
  models: z.object({
    think: z.string().min(1),
    classify: z.string().min(1),
  }),
  failureRate: z.number().min(0).max(1),
  maxRetries: z.number().min(0).max(10),
  varietyPenalty: z.object({
    veryRecentHours: z.number().min(0),
    recentHours: z.number().min(0),
    moderateHours: z.number().min(0),
  }),
  emotions: z.object({
    happiness: z.number().min(0).max(1),
    curiosity: z.number().min(0).max(1),
    anxiety: z.number().min(0).max(1),
    boredom: z.number().min(0).max(1),
    excitement: z.number().min(0).max(1),
    contentment: z.number().min(0).max(1),
    frustration: z.number().min(0).max(1),
  }),
});

export type TrumanConfig = z.infer<typeof TrumanConfigSchema>;

/**
 * Load and validate truman-config.json.
 * Throws on invalid or missing config.
 */
export function loadConfig(filePath: string): TrumanConfig {
  const raw = readFileSync(filePath, "utf-8");
  const json: unknown = JSON.parse(raw);
  return TrumanConfigSchema.parse(json);
}
