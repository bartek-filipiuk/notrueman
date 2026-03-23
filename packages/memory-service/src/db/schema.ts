import {
  pgTable,
  uuid,
  text,
  timestamp,
  real,
  boolean,
  jsonb,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Custom pgvector column type.
 * Drizzle doesn't have native pgvector support, so we use customType equivalent.
 */
function vector(name: string, dimensions: number) {
  return text(name);
  // In production, this would use a custom type for vector(768)
  // For now, we store as text and cast in queries
}

/** Memories table — core storage for observations, reflections, and plans */
export const memories = pgTable(
  "memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: text("agent_id").notNull(),
    type: text("type", { enum: ["observation", "reflection", "plan"] }).notNull(),
    description: text("description").notNull(),
    embedding: text("embedding"), // stored as JSON array string, cast to vector in queries
    importance: integer("importance").notNull().default(5),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }).defaultNow().notNull(),
    location: text("location"),
    emotionalContext: jsonb("emotional_context").$type<Record<string, number>>().default({}),
    viewerInfluenced: boolean("viewer_influenced").default(false).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  },
  (table) => [
    index("idx_memories_agent_id").on(table.agentId),
    index("idx_memories_type").on(table.type),
    index("idx_memories_created_at").on(table.createdAt),
    index("idx_memories_importance").on(table.importance),
  ],
);

/** Reflection sources — links reflections to their source observations */
export const reflectionSources = pgTable(
  "reflection_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reflectionId: uuid("reflection_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    sourceMemoryId: uuid("source_memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("idx_reflection_sources_reflection").on(table.reflectionId),
    index("idx_reflection_sources_source").on(table.sourceMemoryId),
  ],
);

/** Agent state snapshots — persisted state for recovery */
export const agentStateSnapshots = pgTable(
  "agent_state_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: text("agent_id").notNull(),
    state: jsonb("state").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_agent_state_agent_id").on(table.agentId),
    index("idx_agent_state_created_at").on(table.createdAt),
  ],
);

// Types inferred from schema
export type MemoryRow = typeof memories.$inferSelect;
export type NewMemoryRow = typeof memories.$inferInsert;
export type ReflectionSourceRow = typeof reflectionSources.$inferSelect;
export type NewReflectionSourceRow = typeof reflectionSources.$inferInsert;
export type AgentStateSnapshotRow = typeof agentStateSnapshots.$inferSelect;
export type NewAgentStateSnapshotRow = typeof agentStateSnapshots.$inferInsert;
