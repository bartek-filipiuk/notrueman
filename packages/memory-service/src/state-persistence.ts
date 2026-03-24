import { eq, desc } from "drizzle-orm";
import { agentStateSnapshots } from "./db/schema.js";
import type { Database } from "./db/connection.js";

export interface StatePersistence {
  saveState(agentId: string, state: Record<string, unknown>): Promise<void>;
  loadLatestState(agentId: string): Promise<Record<string, unknown> | null>;
}

/** Create a state persistence service backed by PostgreSQL */
export function createStatePersistence(db: Database): StatePersistence {
  return {
    async saveState(agentId: string, state: Record<string, unknown>): Promise<void> {
      await db.insert(agentStateSnapshots).values({
        agentId,
        state,
      });
    },

    async loadLatestState(agentId: string): Promise<Record<string, unknown> | null> {
      const rows = await db
        .select()
        .from(agentStateSnapshots)
        .where(eq(agentStateSnapshots.agentId, agentId))
        .orderBy(desc(agentStateSnapshots.createdAt))
        .limit(1);

      if (rows.length === 0) return null;
      return rows[0].state as Record<string, unknown>;
    },
  };
}
