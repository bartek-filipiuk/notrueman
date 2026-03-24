import { describe, it, expect, afterEach } from "vitest";
import { createHealthServer, type HealthServerDeps } from "../health-server.js";

function createMockDeps(): HealthServerDeps {
  return {
    getStatus: () => ({
      status: "ok" as const,
      uptime: 12345,
      lastTickAt: new Date().toISOString(),
      tickCount: 42,
      currentActivity: "read",
      currentMood: "curious",
      memoryCount: 150,
    }),
  };
}

describe("Health Server (T4.7)", () => {
  let server: Awaited<ReturnType<typeof createHealthServer>> | null = null;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  it("creates a Fastify server", async () => {
    server = await createHealthServer(createMockDeps(), { port: 0 });
    expect(server).toBeDefined();
  });

  it("/health returns JSON with status fields", async () => {
    server = await createHealthServer(createMockDeps(), { port: 0 });
    const response = await server.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("ok");
    expect(body.uptime).toBe(12345);
    expect(body.tickCount).toBe(42);
    expect(body.currentActivity).toBe("read");
    expect(body.currentMood).toBe("curious");
    expect(body.memoryCount).toBe(150);
    expect(body.lastTickAt).toBeDefined();
  });

  it("/health does not expose API keys or DB credentials", async () => {
    server = await createHealthServer(createMockDeps(), { port: 0 });
    const response = await server.inject({ method: "GET", url: "/health" });

    const bodyStr = response.body;
    expect(bodyStr).not.toContain("API_KEY");
    expect(bodyStr).not.toContain("PASSWORD");
    expect(bodyStr).not.toContain("SECRET");
    expect(bodyStr).not.toContain("sk-or-");
    expect(bodyStr).not.toContain("postgres://");
  });

  it("/metrics returns Prometheus-formatted text", async () => {
    server = await createHealthServer(createMockDeps(), { port: 0 });
    const response = await server.inject({ method: "GET", url: "/metrics" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    // Should contain some metric
    expect(response.body).toContain("# ");
  });

  it("responds with 404 on unknown routes", async () => {
    server = await createHealthServer(createMockDeps(), { port: 0 });
    const response = await server.inject({ method: "GET", url: "/secret" });

    expect(response.statusCode).toBe(404);
  });
});
