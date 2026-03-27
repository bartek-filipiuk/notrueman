import { z } from "zod";

/** Types of events that can appear in the mind feed */
export const MindFeedEventTypeSchema = z.enum([
  "thought",
  "mood_change",
  "tool_call",
  "activity_change",
  "blog_created",
  "artwork_created",
  "reflection",
]);
export type MindFeedEventType = z.infer<typeof MindFeedEventTypeSchema>;

/** A single event in the mind feed stream */
export const MindFeedEventSchema = z.object({
  type: MindFeedEventTypeSchema,
  timestamp: z.number(),
  data: z.record(z.string(), z.unknown()),
  public: z.boolean(),
});
export type MindFeedEvent = z.infer<typeof MindFeedEventSchema>;

/** Public-safe subset of a mind feed event (stripped of sensitive data) */
export const PublicMindFeedEventSchema = z.object({
  type: MindFeedEventTypeSchema,
  timestamp: z.number(),
  data: z.record(z.string(), z.unknown()),
});
export type PublicMindFeedEvent = z.infer<typeof PublicMindFeedEventSchema>;

/**
 * Fields allowed in public feed per event type.
 * Everything else is stripped before broadcast.
 */
export const PUBLIC_ALLOWED_FIELDS: Record<MindFeedEventType, string[]> = {
  thought: ["text"],
  mood_change: ["mood", "prevMood"],
  tool_call: ["tool", "topic"],
  activity_change: ["activity", "prevActivity"],
  blog_created: ["title", "tags"],
  artwork_created: ["title", "style"],
  reflection: ["insight"],
};

/**
 * Filter a MindFeedEvent for public consumption.
 * Returns null if event is not public.
 * Strips data fields not in PUBLIC_ALLOWED_FIELDS.
 */
export function filterForPublicFeed(
  event: MindFeedEvent,
): PublicMindFeedEvent | null {
  if (!event.public) return null;

  const allowed = PUBLIC_ALLOWED_FIELDS[event.type];
  const filteredData: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in event.data) {
      filteredData[key] = event.data[key];
    }
  }

  return {
    type: event.type,
    timestamp: event.timestamp,
    data: filteredData,
  };
}
