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
  agentStateSnapshots,
} from "@nts/memory-service";
import { eq, desc } from "drizzle-orm";

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
