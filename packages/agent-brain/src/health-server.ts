import Fastify from "fastify";
import { register, Gauge, Counter } from "prom-client";
import { SaveDataSchema } from "@nts/shared";
import type { StatePersistence } from "@nts/memory-service";

export interface HealthStatus {
  status: "ok" | "degraded" | "error";
  uptime: number;
  lastTickAt: string | null;
  tickCount: number;
  currentActivity: string | null;
  currentMood: string;
  memoryCount: number;
}

export interface HealthServerDeps {
  getStatus: () => HealthStatus;
  /** Optional StatePersistence for save/load endpoints */
  statePersistence?: StatePersistence;
  /** Memory repository for direct memory creation (Stage Z) */
  createMemory?: (memory: {
    agentId: string;
    type: string;
    description: string;
    importance: number;
    emotionalContext?: Record<string, number>;
    metadata?: Record<string, unknown>;
  }) => Promise<unknown>;
  /** Query recent memories */
  queryMemories?: (params: {
    limit?: number;
  }) => Promise<unknown[]>;
}

export interface HealthServerOptions {
  port: number;
  host?: string;
}

// Prometheus metrics
const tickCountGauge = new Gauge({
  name: "nts_tick_count",
  help: "Total number of cognitive loop ticks",
});

const uptimeGauge = new Gauge({
  name: "nts_uptime_seconds",
  help: "Agent uptime in seconds",
});

const memoryCountGauge = new Gauge({
  name: "nts_memory_count",
  help: "Number of stored memories",
});

/** CORS origins: only localhost in dev */
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return /^https?:\/\/localhost(:\d+)?$/.test(origin);
}

/**
 * Create a Fastify health/metrics server (T4.7).
 * Exposes /health (JSON), /metrics (Prometheus format),
 * state persistence endpoints, and Stage Z endpoints for observations, memories, and web search.
 * Does NOT expose secrets (API keys, DB credentials).
 */
export async function createHealthServer(
  deps: HealthServerDeps,
  options: HealthServerOptions,
) {
  const app = Fastify({ logger: false });

  // CORS hook — only localhost origins allowed (SG.1)
  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && isAllowedOrigin(origin)) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      reply.header("Access-Control-Allow-Headers", "Content-Type");
    }
    if (request.method === "OPTIONS") {
      return reply.status(204).send();
    }
  });

  app.get("/health", async (_request, reply) => {
    const status = deps.getStatus();
    // Update Prometheus gauges
    tickCountGauge.set(status.tickCount);
    uptimeGauge.set(status.uptime);
    memoryCountGauge.set(status.memoryCount);

    return reply.send(status);
  });

  app.get("/metrics", async (_request, reply) => {
    const metrics = await register.metrics();
    return reply.type("text/plain; charset=utf-8").send(metrics);
  });

  // --- State persistence endpoints (TG.2) ---

  /** POST /state/save — save agent state to PostgreSQL */
  app.post("/state/save", async (request, reply) => {
    if (!deps.statePersistence) {
      return reply.status(503).send({ error: "State persistence not configured" });
    }

    const body = request.body as { agentId?: string; state?: unknown };
    if (!body || typeof body !== "object") {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    // Hardcoded agent ID for security (SG.3) — ignore user-provided agentId
    const agentId = "truman";

    // Validate state against SaveData schema (SG.2)
    const result = SaveDataSchema.safeParse(body.state);
    if (!result.success) {
      return reply.status(400).send({
        error: "Invalid save data",
        details: result.error.issues,
      });
    }

    await deps.statePersistence.saveState(agentId, result.data as unknown as Record<string, unknown>);
    return reply.send({ ok: true, savedAt: Date.now() });
  });

  /** GET /state/load/:agentId — load latest agent state from PostgreSQL */
  app.get<{ Params: { agentId: string } }>("/state/load/:agentId", async (request, reply) => {
    if (!deps.statePersistence) {
      return reply.status(503).send({ error: "State persistence not configured" });
    }

    // Hardcoded agent ID for security (SG.3) — ignore URL param
    const agentId = "truman";

    const state = await deps.statePersistence.loadLatestState(agentId);
    if (!state) {
      return reply.status(404).send({ error: "No saved state found" });
    }

    return reply.send({ agentId, state });
  });

  // --- Stage Z: Observation + Memory + Tool endpoints ---

  /** POST /api/observation — insert a memory observation (TZ.1) */
  app.post("/api/observation", async (request, reply) => {
    if (!deps.createMemory) {
      return reply.status(503).send({ error: "Memory service not configured" });
    }
    const body = request.body as {
      description?: string;
      importance?: number;
      emotionalContext?: Record<string, number>;
      metadata?: Record<string, unknown>;
    } | null;

    if (!body?.description || typeof body.description !== "string") {
      return reply.status(400).send({ error: "description required" });
    }

    const importance = typeof body.importance === "number"
      ? Math.max(1, Math.min(10, Math.round(body.importance)))
      : 5;

    try {
      const memory = await deps.createMemory({
        agentId: "truman",
        type: "observation",
        description: body.description.slice(0, 2000),
        importance,
        emotionalContext: body.emotionalContext,
        metadata: body.metadata,
      });
      return reply.send({ ok: true, memory });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return reply.status(500).send({ error: msg });
    }
  });

  /** GET /api/recent-memories — get last N memories (TZ.2) */
  app.get("/api/recent-memories", async (request, reply) => {
    if (!deps.queryMemories) {
      return reply.status(503).send({ error: "Memory service not configured" });
    }
    const query = request.query as Record<string, string>;
    const limit = Math.min(Math.max(1, Number(query.limit) || 10), 50);

    try {
      const memories = await deps.queryMemories({ limit });
      return reply.send({ memories });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return reply.status(500).send({ error: msg });
    }
  });

  /** POST /api/tool/web-search — Brave Search API proxy (TZ.3) */
  app.post("/api/tool/web-search", async (request, reply) => {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
      return reply.status(503).send({ error: "BRAVE_SEARCH_API_KEY not configured" });
    }

    const body = request.body as { query?: string; count?: number } | null;
    if (!body?.query || typeof body.query !== "string") {
      return reply.status(400).send({ error: "query required" });
    }

    const count = Math.min(Math.max(1, body.count ?? 5), 20);

    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(body.query)}&count=${count}`;
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
      });

      if (!response.ok) {
        return reply.status(response.status).send({ error: `Brave API error: ${response.statusText}` });
      }

      const data = await response.json() as { web?: { results?: Array<{ title: string; url: string; description: string }> } };
      const results = (data.web?.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        description: r.description,
      }));

      return reply.send({ results });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return reply.status(500).send({ error: msg });
    }
  });

  if (options.port > 0) {
    await app.listen({ port: options.port, host: options.host ?? "localhost" });
  }

  return app;
}
