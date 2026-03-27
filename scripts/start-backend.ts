/**
 * Standalone backend server: HealthServer + PostgreSQL + Admin Auth.
 * Usage: npx tsx scripts/start-backend.ts
 */
import "dotenv/config";
import { createHealthServer, hashPassword } from "@nts/agent-brain";
import {
  createStatePersistence,
  createDatabase,
  createLLMCallLog,
  createMemoryRepository,
  agentStateSnapshots,
  memories,
} from "@nts/memory-service";
import { eq, desc, and, isNotNull, sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || "default-jwt-secret-change-me-32chars!!";

const startTime = Date.now();

async function main() {
  console.log("[backend] Connecting to PostgreSQL...");
  const db = createDatabase(DATABASE_URL!);
  const statePersistence = createStatePersistence(db);
  const llmCallLog = createLLMCallLog(db);
  const memoryRepo = createMemoryRepository(db);

  // Hash admin password if provided
  let adminAuth;
  if (ADMIN_PASSWORD) {
    console.log("[backend] Hashing admin password...");
    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    adminAuth = { passwordHash, jwtSecret: JWT_SECRET };
    console.log("[backend] Admin auth configured");
  } else {
    console.warn("[backend] WARNING: ADMIN_PASSWORD not set — admin panel disabled");
  }

  console.log("[backend] Starting HealthServer on port 3001...");
  await createHealthServer(
    {
      getStatus: () => ({
        status: "ok" as const,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        lastTickAt: null,
        tickCount: 0,
        currentActivity: null,
        currentMood: "neutral",
        memoryCount: 0,
      }),
      statePersistence,
      adminAuth,
      llmCallLog,
      createMemory: async (memory: {
        agentId: string;
        type: string;
        description: string;
        importance?: number;
        emotionalContext?: Record<string, number>;
        metadata?: Record<string, unknown>;
      }) => {
        return memoryRepo.createMemory({
          agentId: memory.agentId,
          type: memory.type as "observation" | "reflection" | "plan",
          description: memory.description,
          importance: memory.importance ?? 5,
          emotionalContext: memory.emotionalContext ?? {},
          metadata: memory.metadata ?? {},
        });
      },
      queryMemories: async (params: {
        type?: string;
        importance?: number;
        limit?: number;
        offset?: number;
      }) => {
        return memoryRepo.getRecentMemories(
          "truman",
          params.limit ?? 50,
          params.type,
        );
      },
      queryGallery: async (params: { limit: number }) => {
        // Memories whose metadata contains toolCalls with write_blog_post or create_artwork
        const rows = await db
          .select()
          .from(memories)
          .where(
            and(
              eq(memories.agentId, "truman"),
              sql`(${memories.metadata}::jsonb -> 'toolCalls')::text LIKE '%write_blog_post%'
                OR (${memories.metadata}::jsonb -> 'toolCalls')::text LIKE '%create_artwork%'`,
            ),
          )
          .orderBy(desc(memories.createdAt))
          .limit(params.limit);

        return rows.map((row) => {
          const meta = (row.metadata ?? {}) as Record<string, unknown>;
          const toolCalls = (meta.toolCalls ?? []) as Array<Record<string, unknown>>;
          const isBlog = toolCalls.some((tc) => tc.toolName === "write_blog_post");
          return {
            type: isBlog ? "blog" : "artwork",
            title: (meta.title as string) ?? row.description.slice(0, 80),
            content: isBlog ? (meta.content as string) ?? row.description : undefined,
            description: !isBlog ? row.description : undefined,
            style: (meta.style as string) ?? null,
            tags: (meta.tags as string[]) ?? [],
            createdAt: row.createdAt,
          };
        });
      },
      queryEmotions: async (params: { limit: number }) => {
        const rows = await db
          .select({
            createdAt: memories.createdAt,
            emotionalContext: memories.emotionalContext,
          })
          .from(memories)
          .where(
            and(
              eq(memories.agentId, "truman"),
              isNotNull(memories.emotionalContext),
            ),
          )
          .orderBy(desc(memories.createdAt))
          .limit(params.limit);

        return rows
          .filter((row) => row.emotionalContext && Object.keys(row.emotionalContext).length > 0)
          .map((row) => ({
            timestamp: row.createdAt,
            happiness: row.emotionalContext?.happiness ?? 0,
            curiosity: row.emotionalContext?.curiosity ?? 0,
            anxiety: row.emotionalContext?.anxiety ?? 0,
            boredom: row.emotionalContext?.boredom ?? 0,
            excitement: row.emotionalContext?.excitement ?? 0,
            contentment: row.emotionalContext?.contentment ?? 0,
            frustration: row.emotionalContext?.frustration ?? 0,
          }));
      },
      queryStateHistory: async (limit: number) => {
        return db
          .select()
          .from(agentStateSnapshots)
          .where(eq(agentStateSnapshots.agentId, "truman"))
          .orderBy(desc(agentStateSnapshots.createdAt))
          .limit(limit);
      },
    },
    { port: 3001, host: "0.0.0.0" },
  );

  console.log("[backend] HealthServer running: http://localhost:3001");
  console.log("[backend] Admin: " + (adminAuth ? "ENABLED" : "DISABLED"));
}

main().catch((err) => {
  console.error("[backend] Failed:", err.message);
  process.exit(1);
});
