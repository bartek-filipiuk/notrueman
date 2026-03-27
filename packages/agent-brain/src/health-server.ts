import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { register, Gauge, Counter } from "prom-client";
import { SaveDataSchema, filterForPublicFeed } from "@nts/shared";
import type { MindFeedEvent } from "@nts/shared";
import type { StatePersistence } from "@nts/memory-service";
import type { WebSocket } from "ws";
import {
  verifyPassword,
  createToken,
  verifyToken,
  checkLoginRateLimit,
  type AdminAuthConfig,
} from "./admin-auth.js";

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
  /** Optional CognitiveLoop event source — listens for 'mindFeedEvent' */
  brainEvents?: { on(event: string, listener: (...args: unknown[]) => void): void };
  /** Optional admin auth config for JWT login */
  adminAuth?: AdminAuthConfig;
  /** Optional CognitiveLoop instance for admin API */
  cognitiveLoop?: {
    getState(): Record<string, unknown>;
    getConfig(): Record<string, unknown>;
    updateConfig(partial: Record<string, unknown>): void;
    getInterests(): string[];
    setInterests(interests: string[]): void;
  };
  /** Optional memory query function for admin */
  queryMemories?: (params: {
    type?: string;
    importance?: number;
    limit?: number;
    offset?: number;
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

/** CORS origins: configurable via CORS_ORIGIN env var */
function getAllowedOrigins(): string[] {
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    return corsOrigin.split(",").map((o) => o.trim()).filter(Boolean);
  }
  // Default: localhost only (dev)
  return ["http://localhost:5173", "http://localhost:3001"];
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const allowed = getAllowedOrigins();
  // Exact match against whitelist — no wildcards
  if (allowed.includes(origin)) return true;
  // Also allow any localhost origin in dev (when no CORS_ORIGIN set)
  if (!process.env.CORS_ORIGIN) {
    return /^https?:\/\/localhost(:\d+)?$/.test(origin);
  }
  return false;
}

/** WebSocket origin check */
function isAllowedWSOrigin(origin: string | undefined): boolean {
  return isAllowedOrigin(origin);
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
      reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      reply.header("Access-Control-Allow-Credentials", "true");
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

  // --- Admin API (TN.1-TN.2) ---

  /** POST /api/admin/login — authenticate and get JWT */
  app.post("/api/admin/login", async (request, reply) => {
    if (!deps.adminAuth) {
      return reply.status(503).send({ error: "Admin auth not configured" });
    }

    const ip = request.ip;
    if (!checkLoginRateLimit(ip)) {
      return reply.status(429).send({ error: "Too many login attempts. Try again in 1 minute." });
    }

    const body = request.body as { password?: string } | null;
    if (!body?.password || typeof body.password !== "string") {
      return reply.status(400).send({ error: "Password required" });
    }

    const valid = await verifyPassword(body.password, deps.adminAuth.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid password" });
    }

    const token = createToken(deps.adminAuth.jwtSecret);
    return reply.send({ token });
  });

  /** JWT middleware for /api/admin/* routes (except login) */
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/admin/") || request.url === "/api/admin/login") {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Authorization header required" });
    }

    const token = authHeader.slice(7);
    const jwtSecret = deps.adminAuth?.jwtSecret;
    if (!jwtSecret || !verifyToken(token, jwtSecret)) {
      return reply.status(401).send({ error: "Invalid or expired token" });
    }
  });

  /** GET /api/admin/brain-state — current brain state */
  app.get("/api/admin/brain-state", async (_request, reply) => {
    if (!deps.cognitiveLoop) {
      return reply.status(503).send({ error: "Brain not configured" });
    }
    const state = deps.cognitiveLoop.getState();
    const config = deps.cognitiveLoop.getConfig();
    const status = deps.getStatus();
    return reply.send({ state, config, status });
  });

  /** GET /api/admin/settings — current config */
  app.get("/api/admin/settings", async (_request, reply) => {
    if (!deps.cognitiveLoop) {
      return reply.status(503).send({ error: "Brain not configured" });
    }
    const config = deps.cognitiveLoop.getConfig();
    const interests = deps.cognitiveLoop.getInterests();
    return reply.send({ config, interests });
  });

  /** POST /api/admin/settings — update config (hot-reload) */
  app.post("/api/admin/settings", async (request, reply) => {
    if (!deps.cognitiveLoop) {
      return reply.status(503).send({ error: "Brain not configured" });
    }
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return reply.status(400).send({ error: "Invalid settings" });
    }

    if (body.interests && Array.isArray(body.interests)) {
      deps.cognitiveLoop.setInterests(body.interests as string[]);
    }

    const { interests: _, ...configUpdates } = body;
    if (Object.keys(configUpdates).length > 0) {
      deps.cognitiveLoop.updateConfig(configUpdates);
    }

    return reply.send({ ok: true, updatedAt: Date.now() });
  });

  /** GET /api/admin/memories — query memories */
  app.get("/api/admin/memories", async (request, reply) => {
    if (!deps.queryMemories) {
      return reply.status(503).send({ error: "Memory service not configured" });
    }
    const query = request.query as Record<string, string>;
    const memories = await deps.queryMemories({
      type: query.type,
      importance: query.importance ? Number(query.importance) : undefined,
      limit: query.limit ? Number(query.limit) : 20,
      offset: query.offset ? Number(query.offset) : 0,
    });
    return reply.send({ memories });
  });

  /** POST /api/admin/reset — soft or hard reset */
  app.post("/api/admin/reset", async (request, reply) => {
    if (!deps.statePersistence) {
      return reply.status(503).send({ error: "State persistence not configured" });
    }
    const body = request.body as { mode?: string } | null;
    const mode = body?.mode === "hard" ? "hard" : "soft";

    if (mode === "hard") {
      // Hard reset: clear saved state
      await deps.statePersistence.saveState("truman", {});
    }
    // Soft reset: just acknowledge (brain continues with current state)
    return reply.send({ ok: true, mode, resetAt: Date.now() });
  });

  /** POST /api/admin/force-activity — override next tick's activity */
  app.post("/api/admin/force-activity", async (request, reply) => {
    if (!deps.cognitiveLoop) {
      return reply.status(503).send({ error: "Brain not configured" });
    }
    const body = request.body as { activity?: string } | null;
    if (!body?.activity) {
      return reply.status(400).send({ error: "Activity required" });
    }
    // Store as config override — cognitive loop will pick up on next tick
    deps.cognitiveLoop.updateConfig({ forcedActivity: body.activity });
    return reply.send({ ok: true, activity: body.activity });
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

  const HEARTBEAT_INTERVAL_MS = 30_000;
  const IDLE_TIMEOUT_MS = 5 * 60_000; // 5 minutes

  function setupHeartbeat(socket: WebSocket, onTimeout: () => void): NodeJS.Timeout {
    let lastPong = Date.now();
    socket.on("pong", () => { lastPong = Date.now(); });
    const interval = setInterval(() => {
      if (Date.now() - lastPong > IDLE_TIMEOUT_MS) {
        clearInterval(interval);
        onTimeout();
        return;
      }
      if (socket.readyState === 1) {
        socket.ping();
      }
    }, HEARTBEAT_INTERVAL_MS);
    socket.on("close", () => clearInterval(interval));
    return interval;
  }

  /** Public mind feed — streams filtered events (TM.4) */
  app.get("/ws/mind-feed", { websocket: true }, (socket, request) => {
    // Origin check (TP.3)
    const origin = request.headers.origin;
    if (process.env.CORS_ORIGIN && !isAllowedWSOrigin(origin)) {
      socket.close(1008, "Origin not allowed");
      return;
    }

    const ip = getClientIP(request);

    if (publicClients.size >= MAX_PUBLIC_CONNECTIONS || !checkIPLimit(ip)) {
      socket.close(1013, "Too many connections");
      return;
    }

    publicClients.add(socket);
    trackIPConnection(ip, 1);

    // Heartbeat + idle disconnect (TP.3)
    setupHeartbeat(socket, () => {
      socket.close(1000, "Idle timeout");
    });

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
    // Origin check (TP.3)
    const origin = request.headers.origin;
    if (process.env.CORS_ORIGIN && !isAllowedWSOrigin(origin)) {
      socket.close(1008, "Origin not allowed");
      return;
    }

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

    // Heartbeat + idle disconnect (TP.3)
    setupHeartbeat(socket, () => {
      socket.close(1000, "Idle timeout");
    });

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

  // Wire brain events → WebSocket broadcast (TM.7)
  if (deps.brainEvents) {
    deps.brainEvents.on("mindFeedEvent", (event: unknown) => {
      broadcastEvent(event as MindFeedEvent);
    });
  }

  // Periodically send brain status to public clients when no events flowing
  const brainStatusInterval = setInterval(() => {
    if (publicClients.size === 0 && adminClients.size === 0) return;
    const status = deps.getStatus();
    const isOnline = status.status !== "error";
    if (!isOnline) {
      const msg = JSON.stringify({
        type: "status",
        data: { brainOnline: false, message: "brain offline" },
      });
      for (const client of publicClients) {
        if (client.readyState === 1) client.send(msg);
      }
    }
  }, 30_000);

  app.addHook("onClose", async () => {
    clearInterval(brainStatusInterval);
  });

  if (options.port > 0) {
    await app.listen({ port: options.port, host: options.host ?? "localhost" });
  }

  return Object.assign(app, {
    broadcastEvent,
    getPublicClientCount: () => publicClients.size,
    getAdminClientCount: () => adminClients.size,
  });
}
