import { Queue, Worker, type ConnectionOptions, type WorkerOptions, type QueueOptions } from "bullmq";
import type { ZodSchema } from "zod";
import type { QueueConnectionConfig } from "./connection.js";

/** Default job options applied to all queues (STACK_GUIDELINES.md) */
const DEFAULT_QUEUE_OPTIONS: Partial<QueueOptions> = {
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
};

/**
 * Creates a typed BullMQ queue with standard options.
 * Uses removeOnComplete/removeOnFail to prevent memory growth (24/7 operation).
 */
export function createQueue<T>(
  name: string,
  connection: QueueConnectionConfig,
): Queue<T> {
  return new Queue<T>(name, {
    connection: connection as ConnectionOptions,
    ...DEFAULT_QUEUE_OPTIONS,
  });
}

/**
 * Creates a typed BullMQ worker with Zod validation on job data.
 * `concurrency: 1` by default for sequential agent processing (STACK_GUIDELINES.md).
 */
export function createWorker<T>(
  name: string,
  connection: QueueConnectionConfig,
  schema: ZodSchema<T>,
  processor: (data: T, jobId: string) => Promise<void>,
  options?: Partial<WorkerOptions>,
): Worker<T> {
  return new Worker<T>(
    name,
    async (job) => {
      const parsed = schema.parse(job.data);
      await processor(parsed, job.id ?? "unknown");
    },
    {
      connection: connection as ConnectionOptions,
      concurrency: 1,
      ...options,
    },
  );
}
