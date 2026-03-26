import { describe, it, expect, afterEach, vi } from "vitest";
import { createHealthServer, type HealthServerDeps } from "../health-server.js";
import type { StatePersistence } from "@nts/memory-service";
import { SAVE_DATA_VERSION } from "@nts/shared";

function validSaveData() {
  return {
    version: SAVE_DATA_VERSION,
    savedAt: Date.now(),
    createdAt: Date.now() - 86_400_000,
    dayCount: 1,
    totalTimeAliveMs: 3_600_000,
    sessionCount: 2,
    truman: {
      x: 400,
      y: 300,
      facing: "right",
      currentActivity: "read",
      currentMood: "curious",
    },
    emotions: {
      happiness: 0.6,
      curiosity: 0.7,
      anxiety: 0.2,
      boredom: 0.3,
      excitement: 0.4,
      contentment: 0.5,
      frustration: 0.1,
    },
    physicalState: {
      energy: 0.8,
      hunger: 0.3,
      tiredness: 0.2,
    },
    recentActivities: [],
    brainTickCount: 10,
  };
}

function createMockDeps(statePersistence?: StatePersistence): HealthServerDeps {
  return {
    getStatus: () => ({
      status: "ok" as const,
      uptime: 100,
      lastTickAt: new Date().toISOString(),
      tickCount: 5,
      currentActivity: "read",
      currentMood: "curious",
      memoryCount: 10,
    }),
    statePersistence,
  };
}

function createMockPersistence(): StatePersistence {
  let stored: Record<string, unknown> | null = null;
  return {
    saveState: vi.fn(async (_agentId: string, state: Record<string, unknown>) => {
      stored = state;
    }),
    loadLatestState: vi.fn(async (_agentId: string) => stored),
  };
}

describe("State Persistence Endpoints (TG.2)", () => {
  let server: Awaited<ReturnType<typeof createHealthServer>> | null = null;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  it("POST /state/save — saves valid data", async () => {
    const persistence = createMockPersistence();
    server = await createHealthServer(createMockDeps(persistence), { port: 0 });

    const response = await server.inject({
      method: "POST",
      url: "/state/save",
      payload: { agentId: "truman", state: validSaveData() },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.ok).toBe(true);
    expect(body.savedAt).toBeTypeOf("number");
    expect(persistence.saveState).toHaveBeenCalledWith("truman", expect.objectContaining({ version: 1 }));
  });

  it("POST /state/save — rejects invalid data (SG.2)", async () => {
    const persistence = createMockPersistence();
    server = await createHealthServer(createMockDeps(persistence), { port: 0 });

    const response = await server.inject({
      method: "POST",
      url: "/state/save",
      payload: { agentId: "truman", state: { version: "bad" } },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe("Invalid save data");
    expect(persistence.saveState).not.toHaveBeenCalled();
  });

  it("POST /state/save — uses hardcoded agentId 'truman' (SG.3)", async () => {
    const persistence = createMockPersistence();
    server = await createHealthServer(createMockDeps(persistence), { port: 0 });

    await server.inject({
      method: "POST",
      url: "/state/save",
      payload: { agentId: "evil-agent", state: validSaveData() },
    });

    // Should save as "truman" regardless of provided agentId
    expect(persistence.saveState).toHaveBeenCalledWith("truman", expect.anything());
  });

  it("GET /state/load/:agentId — returns saved state", async () => {
    const persistence = createMockPersistence();
    server = await createHealthServer(createMockDeps(persistence), { port: 0 });

    // Save first
    await server.inject({
      method: "POST",
      url: "/state/save",
      payload: { agentId: "truman", state: validSaveData() },
    });

    // Load
    const response = await server.inject({
      method: "GET",
      url: "/state/load/truman",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.agentId).toBe("truman");
    expect(body.state.version).toBe(SAVE_DATA_VERSION);
  });

  it("GET /state/load/:agentId — returns 404 when no save exists", async () => {
    const persistence = createMockPersistence();
    server = await createHealthServer(createMockDeps(persistence), { port: 0 });

    const response = await server.inject({
      method: "GET",
      url: "/state/load/truman",
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns 503 when statePersistence not configured", async () => {
    server = await createHealthServer(createMockDeps(), { port: 0 });

    const saveRes = await server.inject({
      method: "POST",
      url: "/state/save",
      payload: { agentId: "truman", state: validSaveData() },
    });
    expect(saveRes.statusCode).toBe(503);

    const loadRes = await server.inject({
      method: "GET",
      url: "/state/load/truman",
    });
    expect(loadRes.statusCode).toBe(503);
  });

  it("CORS — sets headers for localhost origin (SG.1)", async () => {
    server = await createHealthServer(createMockDeps(), { port: 0 });

    const response = await server.inject({
      method: "OPTIONS",
      url: "/state/save",
      headers: { origin: "http://localhost:5173" },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("CORS — does not set headers for non-localhost origin", async () => {
    server = await createHealthServer(createMockDeps(), { port: 0 });

    const response = await server.inject({
      method: "OPTIONS",
      url: "/state/save",
      headers: { origin: "https://evil.com" },
    });

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
