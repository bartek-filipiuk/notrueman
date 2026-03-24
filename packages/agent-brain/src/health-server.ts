import Fastify from "fastify";
import { register, Gauge, Counter } from "prom-client";

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

/**
 * Create a Fastify health/metrics server (T4.7).
 * Exposes /health (JSON) and /metrics (Prometheus format).
 * Does NOT expose secrets (API keys, DB credentials).
 */
export async function createHealthServer(
  deps: HealthServerDeps,
  options: HealthServerOptions,
) {
  const app = Fastify({ logger: false });

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

  if (options.port > 0) {
    await app.listen({ port: options.port, host: options.host ?? "localhost" });
  }

  return app;
}
