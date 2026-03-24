import { z } from "zod";
import { ACTIVITY_LIST } from "../constants.js";
import type { ActivityType } from "../types/agent-state.js";

/** ACTIVITY_LIST cast to a tuple type that z.enum() accepts while preserving ActivityType */
const ACTIVITY_ENUM = ACTIVITY_LIST as unknown as readonly [ActivityType, ...ActivityType[]];

/**
 * Job payload schema for `agent:think` queue.
 * Sent each tick to trigger the cognitive loop iteration.
 */
export const AgentThinkJobSchema = z.object({
  tickId: z.string().min(1),
  timestamp: z.string(),
  currentActivity: z.string().nullable(),
  emotionSummary: z.record(z.string(), z.number()),
  timeOfDay: z.string(),
  recentActivities: z.array(z.string()),
});
export type AgentThinkJob = z.infer<typeof AgentThinkJobSchema>;

/**
 * Job payload schema for `agent:action` queue.
 * Emitted by brain after deciding what Truman should do.
 */
export const AgentActionJobSchema = z.object({
  tickId: z.string().min(1),
  activity: z.enum(ACTIVITY_ENUM),
  durationSeconds: z.number().min(1).max(600),
  thought: z.string().max(500),
  mood: z.string(),
  failed: z.boolean(),
});
export type AgentActionJob = z.infer<typeof AgentActionJobSchema>;

/**
 * Job payload schema for `renderer:command` queue.
 * Commands from brain/action worker to the renderer.
 */
export const RendererCommandJobSchema = z.object({
  tickId: z.string().min(1),
  command: z.enum([
    "move_to",
    "play_animation",
    "show_bubble",
    "update_hud",
    "set_object_state",
  ]),
  payload: z.record(z.string(), z.unknown()),
});
export type RendererCommandJob = z.infer<typeof RendererCommandJobSchema>;

/**
 * Job payload schema for `log:event` queue.
 * Structured event logging for observability.
 */
export const LogEventJobSchema = z.object({
  tickId: z.string().min(1),
  eventType: z.string().min(1),
  timestamp: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export type LogEventJob = z.infer<typeof LogEventJobSchema>;
