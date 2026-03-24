import { z } from "zod";

/**
 * Zod schema for Redis connection config used by BullMQ.
 * `maxRetriesPerRequest: null` is critical for 24/7 operation (STACK_GUIDELINES.md).
 */
export const QueueConnectionConfigSchema = z.object({
  host: z.string().min(1).default("localhost"),
  port: z.number().int().min(1).max(65535).default(6379),
  password: z.string().optional(),
  maxRetriesPerRequest: z.null().default(null),
});
export type QueueConnectionConfig = z.infer<typeof QueueConnectionConfigSchema>;

/**
 * Creates a BullMQ-compatible Redis connection config.
 * Always sets `maxRetriesPerRequest: null` for 24/7 stability.
 */
export function createConnectionConfig(
  opts: {
    host?: string;
    port?: number;
    password?: string;
  } = {},
): QueueConnectionConfig {
  return QueueConnectionConfigSchema.parse({
    host: opts.host ?? "localhost",
    port: opts.port ?? 6379,
    password: opts.password,
    maxRetriesPerRequest: null,
  });
}
