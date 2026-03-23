import { z } from "zod";

/** Importance score from LLM (brain-algorithm.md S3.3 step 1) */
export const ImportanceScoreSchema = z.object({
  score: z.number().min(1).max(10),
});
export type ImportanceScore = z.infer<typeof ImportanceScoreSchema>;

/** Should-react decision (brain-algorithm.md S3.3 step 4) */
export const ReactDecisionSchema = z.object({
  should_react: z.boolean(),
  reason: z.string(),
});
export type ReactDecision = z.infer<typeof ReactDecisionSchema>;

/** Emotion delta from LLM evaluation (brain-algorithm.md S10.2) */
export const EmotionDeltaSchema = z.object({
  happiness: z.number().min(-0.1).max(0.1).default(0),
  curiosity: z.number().min(-0.1).max(0.1).default(0),
  anxiety: z.number().min(-0.1).max(0.1).default(0),
  boredom: z.number().min(-0.1).max(0.1).default(0),
  excitement: z.number().min(-0.1).max(0.1).default(0),
  contentment: z.number().min(-0.1).max(0.1).default(0),
  frustration: z.number().min(-0.1).max(0.1).default(0),
});
export type EmotionDelta = z.infer<typeof EmotionDeltaSchema>;

/** Daily plan activity (brain-algorithm.md S3.2) */
export const DailyPlanActivitySchema = z.object({
  activity: z.string(),
  timeBlock: z.enum(["morning", "afternoon", "evening", "night"]),
  description: z.string(),
  estimatedDurationMin: z.number().min(15).max(240),
});

/** Daily plan (brain-algorithm.md S3.2) */
export const DailyPlanSchema = z.object({
  activities: z
    .array(DailyPlanActivitySchema)
    .min(5)
    .max(8),
  overallTheme: z.string(),
});
export type DailyPlan = z.infer<typeof DailyPlanSchema>;

/** Hourly block (brain-algorithm.md S3.2) */
export const HourlyBlockSchema = z.object({
  startHour: z.number().min(0).max(23),
  endHour: z.number().min(0).max(23),
  activity: z.string(),
  description: z.string(),
});

/** Hourly plan (brain-algorithm.md S3.2) */
export const HourlyPlanSchema = z.object({
  blocks: z.array(HourlyBlockSchema).min(1),
});
export type HourlyPlan = z.infer<typeof HourlyPlanSchema>;

/** Action in the action queue (brain-algorithm.md S3.2) */
export const ActionSchema = z.object({
  action: z.string(),
  description: z.string(),
  durationMin: z.number().min(5).max(15),
  objectId: z.string().optional(),
});

/** Action queue (brain-algorithm.md S3.2) */
export const ActionQueueSchema = z.object({
  actions: z.array(ActionSchema).min(2).max(5),
});
export type ActionQueue = z.infer<typeof ActionQueueSchema>;

/** Reflection questions (brain-algorithm.md S6.2) */
export const ReflectionQuestionsSchema = z.object({
  questions: z.array(z.string()).min(2).max(3),
});
export type ReflectionQuestions = z.infer<typeof ReflectionQuestionsSchema>;

/** Bubble type determination */
export const BubbleTypeSchema = z.enum([
  "thought",
  "speech",
  "exclamation",
  "whisper",
]);
