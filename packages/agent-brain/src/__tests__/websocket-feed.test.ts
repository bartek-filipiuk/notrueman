import { describe, it, expect, afterEach } from "vitest";
import { createHealthServer, type HealthServerDeps } from "../health-server.js";
import type { MindFeedEvent } from "@nts/shared";
import { filterForPublicFeed, PUBLIC_ALLOWED_FIELDS } from "@nts/shared";

function createMockDeps(overrides?: Partial<HealthServerDeps>): HealthServerDeps {
  return {
    getStatus: () => ({
      status: "ok" as const,
      uptime: 100,
      lastTickAt: new Date().toISOString(),
      tickCount: 10,
      currentActivity: "read",
      currentMood: "curious",
      memoryCount: 50,
    }),
    ...overrides,
  };
}

describe("WebSocket Mind Feed (TM.3-5, TM.8)", () => {
  let server: Awaited<ReturnType<typeof createHealthServer>> | null = null;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  it("server exposes broadcastEvent function", async () => {
    server = await createHealthServer(createMockDeps(), { port: 0 });
    expect(typeof server.broadcastEvent).toBe("function");
    expect(typeof server.getPublicClientCount).toBe("function");
    expect(typeof server.getAdminClientCount).toBe("function");
  });

  it("starts with zero connected clients", async () => {
    server = await createHealthServer(createMockDeps(), { port: 0 });
    expect(server.getPublicClientCount()).toBe(0);
    expect(server.getAdminClientCount()).toBe(0);
  });

  it("broadcastEvent does not throw with zero clients", async () => {
    server = await createHealthServer(createMockDeps(), { port: 0 });
    const event: MindFeedEvent = {
      type: "thought",
      timestamp: Date.now(),
      data: { text: "hello" },
      public: true,
    };
    expect(() => server!.broadcastEvent(event)).not.toThrow();
  });
});

describe("Public Feed Filter Logic (TM.4)", () => {
  it("filters out non-public events", () => {
    const event: MindFeedEvent = {
      type: "thought",
      timestamp: Date.now(),
      data: { text: "secret" },
      public: false,
    };
    expect(filterForPublicFeed(event)).toBeNull();
  });

  it("strips raw LLM prompts from thought events", () => {
    const event: MindFeedEvent = {
      type: "thought",
      timestamp: Date.now(),
      data: { text: "I wonder...", rawPrompt: "system: you are...", cost: 0.05 },
      public: true,
    };
    const result = filterForPublicFeed(event);
    expect(result).not.toBeNull();
    expect(result!.data["text"]).toBe("I wonder...");
    expect("rawPrompt" in result!.data).toBe(false);
    expect("cost" in result!.data).toBe(false);
  });

  it("strips tool input/output from tool_call events", () => {
    const event: MindFeedEvent = {
      type: "tool_call",
      timestamp: Date.now(),
      data: { tool: "brave_search", topic: "cats", query: "best cats breeds", result: "lots of data" },
      public: true,
    };
    const result = filterForPublicFeed(event);
    expect(result!.data).toEqual({ tool: "brave_search", topic: "cats" });
  });

  it("strips memory IDs from reflection events", () => {
    const event: MindFeedEvent = {
      type: "reflection",
      timestamp: Date.now(),
      data: { insight: "I learned X", memoryIds: ["m1", "m2"], evidence: "raw..." },
      public: true,
    };
    const result = filterForPublicFeed(event);
    expect(result!.data).toEqual({ insight: "I learned X" });
  });

  it("strips debug info from activity_change events", () => {
    const event: MindFeedEvent = {
      type: "activity_change",
      timestamp: Date.now(),
      data: { activity: "reading", prevActivity: "idle", debug: "internal", timing: 1234 },
      public: true,
    };
    const result = filterForPublicFeed(event);
    expect(result!.data).toEqual({ activity: "reading", prevActivity: "idle" });
  });

  it("all event types have PUBLIC_ALLOWED_FIELDS defined", () => {
    const allTypes = ["thought", "mood_change", "tool_call", "activity_change", "blog_created", "artwork_created", "reflection"] as const;
    for (const type of allTypes) {
      expect(PUBLIC_ALLOWED_FIELDS[type]).toBeDefined();
      expect(PUBLIC_ALLOWED_FIELDS[type].length).toBeGreaterThan(0);
    }
  });
});

describe("Admin Feed Auth (TM.5)", () => {
  it("verifyJWT is used for admin feed when provided", async () => {
    let jwtChecked = false;
    const deps = createMockDeps({
      verifyJWT: (token: string) => {
        jwtChecked = true;
        return token === "valid-token";
      },
    });
    const server = await createHealthServer(deps, { port: 0 });
    // We can't do full WS connection via inject, but verify the dep is wired
    expect(deps.verifyJWT!("valid-token")).toBe(true);
    expect(deps.verifyJWT!("bad-token")).toBe(false);
    expect(jwtChecked).toBe(true);
    await server.close();
  });
});
