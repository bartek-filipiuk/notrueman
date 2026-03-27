import { eq, desc, and, gte, sql, count, sum, avg } from "drizzle-orm";
import { llmCalls } from "./db/schema.js";
import type { NewLLMCallRow, LLMCallRow } from "./db/schema.js";
import type { Database } from "./db/connection.js";

export interface LLMCallLogFilters {
  model?: string;
  callType?: string;
  success?: boolean;
}

export interface LLMCallStats {
  callsToday: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  avgDurationMs: number;
  errorCount: number;
}

export interface LLMCallLog {
  logCall(data: NewLLMCallRow): Promise<LLMCallRow>;
  getRecentCalls(
    agentId: string,
    limit: number,
    offset: number,
    filters?: LLMCallLogFilters,
  ): Promise<LLMCallRow[]>;
  getStats(agentId: string, sinceHours?: number): Promise<LLMCallStats>;
}

/** Create an LLM call log backed by Drizzle/PostgreSQL */
export function createLLMCallLog(db: Database): LLMCallLog {
  return {
    async logCall(data: NewLLMCallRow): Promise<LLMCallRow> {
      const [row] = await db.insert(llmCalls).values(data).returning();
      return row;
    },

    async getRecentCalls(
      agentId: string,
      limit: number,
      offset: number,
      filters?: LLMCallLogFilters,
    ): Promise<LLMCallRow[]> {
      const conditions = [eq(llmCalls.agentId, agentId)];
      if (filters?.model) {
        conditions.push(eq(llmCalls.model, filters.model));
      }
      if (filters?.callType) {
        conditions.push(
          eq(
            llmCalls.callType,
            filters.callType as "generateText" | "generateObject" | "generateWithTools",
          ),
        );
      }
      if (filters?.success !== undefined) {
        conditions.push(eq(llmCalls.success, filters.success));
      }

      return db
        .select()
        .from(llmCalls)
        .where(and(...conditions))
        .orderBy(desc(llmCalls.createdAt))
        .limit(limit)
        .offset(offset);
    },

    async getStats(agentId: string, sinceHours = 24): Promise<LLMCallStats> {
      const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
      const conditions = [
        eq(llmCalls.agentId, agentId),
        gte(llmCalls.createdAt, since),
      ];

      const [result] = await db
        .select({
          callCount: count(),
          tokensIn: sum(llmCalls.inputTokens),
          tokensOut: sum(llmCalls.outputTokens),
          totalCost: sum(llmCalls.costUsd),
          avgDuration: avg(llmCalls.durationMs),
          errors: count(
            sql`CASE WHEN ${llmCalls.success} = false THEN 1 END`,
          ),
        })
        .from(llmCalls)
        .where(and(...conditions));

      return {
        callsToday: result.callCount ?? 0,
        totalTokensIn: Number(result.tokensIn) || 0,
        totalTokensOut: Number(result.tokensOut) || 0,
        totalCostUsd: Number(result.totalCost) || 0,
        avgDurationMs: Math.round(Number(result.avgDuration) || 0),
        errorCount: result.errors ?? 0,
      };
    },
  };
}
