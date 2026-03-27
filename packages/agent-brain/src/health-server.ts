import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { register, Gauge, Counter } from "prom-client";
import { SaveDataSchema, filterForPublicFeed } from "@nts/shared";
import type { MindFeedEvent } from "@nts/shared";
import type { StatePersistence } from "@nts/memory-service";
import type { WebSocket } from "ws";

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
  /** Optional JWT verification function for admin WebSocket */
  verifyJWT?: (token: string) => boolean;
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
 * and state persistence endpoints POST /state/save, GET /state/load/:agentId.
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

  // --- WebSocket Mind Feed (TM.3) ---
  await app.register(websocket);

  const MAX_PUBLIC_CONNECTIONS = 100;
  const MAX_ADMIN_CONNECTIONS = 5;
  const publicClients = new Set<WebSocket>();
  const adminClients = new Set<WebSocket>();
  const ipConnections = new Map<string, number>();
  const MAX_CONNECTIONS_PER_IP = 10;

  function getClientIP(request: { ip: string }): string {
    return request.ip;
  }

  function checkIPLimit(ip: string): boolean {
    const count = ipConnections.get(ip) ?? 0;
    return count < MAX_CONNECTIONS_PER_IP;
  }

  function trackIPConnection(ip: string, delta: number): void {
    const current = ipConnections.get(ip) ?? 0;
    const next = current + delta;
    if (next <= 0) {
      ipConnections.delete(ip);
    } else {
      ipConnections.set(ip, next);
    }
  }

  /** Public mind feed — streams filtered events (TM.4) */
  app.get("/ws/mind-feed", { websocket: true }, (socket, request) => {
    const ip = getClientIP(request);

    if (publicClients.size >= MAX_PUBLIC_CONNECTIONS || !checkIPLimit(ip)) {
      socket.close(1013, "Too many connections");
      return;
    }

    publicClients.add(socket);
    trackIPConnection(ip, 1);

    socket.on("close", () => {
      publicClients.delete(socket);
      trackIPConnection(ip, -1);
    });

    // Send initial status
    const status = deps.getStatus();
    socket.send(JSON.stringify({
      type: "status",
      data: { connected: true, brainOnline: status.status !== "error" },
    }));
  });

  /** Admin feed — streams ALL events, requires JWT (TM.5) */
  app.get("/ws/admin-feed", { websocket: true }, (socket, request) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const token = url.searchParams.get("token");

    if (!token || !deps.verifyJWT?.(token)) {
      socket.close(1008, "Unauthorized");
      return;
    }

    const ip = getClientIP(request);
    if (adminClients.size >= MAX_ADMIN_CONNECTIONS || !checkIPLimit(ip)) {
      socket.close(1013, "Too many connections");
      return;
    }

    adminClients.add(socket);
    trackIPConnection(ip, 1);

    socket.on("close", () => {
      adminClients.delete(socket);
      trackIPConnection(ip, -1);
    });

    socket.send(JSON.stringify({
      type: "status",
      data: { connected: true, admin: true },
    }));
  });

  /**
   * Broadcast a MindFeedEvent to connected WebSocket clients.
   * Public clients get filtered events; admin clients get everything.
   */
  function broadcastEvent(event: MindFeedEvent): void {
    // Admin feed: send raw event
    const adminMsg = JSON.stringify(event);
    for (const client of adminClients) {
      if (client.readyState === 1) {
        client.send(adminMsg);
      }
    }

    // Public feed: filter sensitive data
    const publicEvent = filterForPublicFeed(event);
    if (publicEvent) {
      const publicMsg = JSON.stringify(publicEvent);
      for (const client of publicClients) {
        if (client.readyState === 1) {
          client.send(publicMsg);
        }
      }
    }
  }

  if (options.port > 0) {
    await app.listen({ port: options.port, host: options.host ?? "localhost" });
  }

  return Object.assign(app, {
    broadcastEvent,
    getPublicClientCount: () => publicClients.size,
    getAdminClientCount: () => adminClients.size,
  });
}
