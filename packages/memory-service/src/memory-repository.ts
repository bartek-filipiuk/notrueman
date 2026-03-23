import { eq, desc, and, sql } from "drizzle-orm";
import { memories } from "./db/schema.js";
import type { NewMemoryRow, MemoryRow } from "./db/schema.js";
import type { Database } from "./db/connection.js";

export interface MemoryRepository {
  createMemory(memory: NewMemoryRow): Promise<MemoryRow>;
  getMemory(id: string): Promise<MemoryRow | null>;
  updateLastAccessed(id: string): Promise<void>;
  getRecentMemories(agentId: string, limit: number, type?: string): Promise<MemoryRow[]>;
}

/** Create a memory repository backed by Drizzle/PostgreSQL */
export function createMemoryRepository(db: Database): MemoryRepository {
  return {
    async createMemory(memory: NewMemoryRow): Promise<MemoryRow> {
      const [row] = await db.insert(memories).values(memory).returning();
      return row;
    },

    async getMemory(id: string): Promise<MemoryRow | null> {
      const rows = await db
        .select()
        .from(memories)
        .where(eq(memories.id, id))
        .limit(1);
      return rows[0] ?? null;
    },

    async updateLastAccessed(id: string): Promise<void> {
      await db
        .update(memories)
        .set({ lastAccessedAt: new Date() })
        .where(eq(memories.id, id));
    },

    async getRecentMemories(
      agentId: string,
      limit: number,
      type?: string,
    ): Promise<MemoryRow[]> {
      const conditions = [eq(memories.agentId, agentId)];
      if (type) {
        conditions.push(eq(memories.type, type as "observation" | "reflection" | "plan"));
      }

      return db
        .select()
        .from(memories)
        .where(and(...conditions))
        .orderBy(desc(memories.createdAt))
        .limit(limit);
    },
  };
}
