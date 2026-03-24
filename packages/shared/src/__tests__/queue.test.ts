import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  QUEUE_NAMES,
  AgentThinkJobSchema,
  AgentActionJobSchema,
  RendererCommandJobSchema,
  LogEventJobSchema,
  QueueConnectionConfigSchema,
  createConnectionConfig,
  createQueue,
  createWorker,
} from "../index.js";

describe("Queue names", () => {
  it("includes all required queue names for Stage 4", () => {
    expect(QUEUE_NAMES.AGENT_THINK).toBe("agent:think");
    expect(QUEUE_NAMES.AGENT_ACTION).toBe("agent:action");
    expect(QUEUE_NAMES.RENDERER_COMMAND).toBe("renderer:command");
    expect(QUEUE_NAMES.LOG_EVENT).toBe("log:event");
  });

  it("all queue names are colon-separated strings", () => {
    for (const name of Object.values(QUEUE_NAMES)) {
      expect(name).toMatch(/^[a-z]+:[a-z]+$/);
    }
  });
});

describe("AgentThinkJobSchema", () => {
  it("validates a valid agent think job payload", () => {
    const valid = {
      tickId: "tick-001",
      timestamp: "2026-03-24T12:00:00Z",
      currentActivity: "read",
      emotionSummary: { happiness: 0.6, curiosity: 0.7 },
      timeOfDay: "afternoon",
      recentActivities: ["eat", "read"],
    };
    const result = AgentThinkJobSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects missing tickId", () => {
    const invalid = {
      timestamp: "2026-03-24T12:00:00Z",
      currentActivity: "read",
      emotionSummary: {},
      timeOfDay: "afternoon",
      recentActivities: [],
    };
    const result = AgentThinkJobSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("allows null currentActivity", () => {
    const valid = {
      tickId: "tick-002",
      timestamp: "2026-03-24T12:00:00Z",
      currentActivity: null,
      emotionSummary: {},
      timeOfDay: "morning",
      recentActivities: [],
    };
    const result = AgentThinkJobSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe("AgentActionJobSchema", () => {
  it("validates a valid agent action job", () => {
    const valid = {
      tickId: "tick-001",
      activity: "cook",
      durationSeconds: 120,
      thought: "Time to make some pasta",
      mood: "happy",
      failed: false,
    };
    const result = AgentActionJobSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects invalid activity type", () => {
    const invalid = {
      tickId: "tick-001",
      activity: "fly_to_mars",
      durationSeconds: 120,
      thought: "Let's go",
      mood: "excited",
      failed: false,
    };
    const result = AgentActionJobSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects negative duration", () => {
    const invalid = {
      tickId: "tick-001",
      activity: "read",
      durationSeconds: -10,
      thought: "Reading time",
      mood: "curious",
      failed: false,
    };
    const result = AgentActionJobSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("RendererCommandJobSchema", () => {
  it("validates a move_to command", () => {
    const valid = {
      tickId: "tick-001",
      command: "move_to",
      payload: { objectId: "desk" },
    };
    const result = RendererCommandJobSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("validates a show_bubble command", () => {
    const valid = {
      tickId: "tick-001",
      command: "show_bubble",
      payload: { text: "Hmm, interesting...", type: "thought", mood: "curious" },
    };
    const result = RendererCommandJobSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("validates an update_hud command", () => {
    const valid = {
      tickId: "tick-001",
      command: "update_hud",
      payload: { mood: "happy", activity: "reading" },
    };
    const result = RendererCommandJobSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects missing tickId", () => {
    const invalid = {
      command: "move_to",
      payload: { objectId: "desk" },
    };
    const result = RendererCommandJobSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("LogEventJobSchema", () => {
  it("validates a valid log event job", () => {
    const valid = {
      tickId: "tick-001",
      eventType: "action_start",
      timestamp: "2026-03-24T12:00:00Z",
      data: { action_type: "cook", action_description: "Making pasta", planned_duration_min: 10 },
    };
    const result = LogEventJobSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects missing eventType", () => {
    const invalid = {
      tickId: "tick-001",
      timestamp: "2026-03-24T12:00:00Z",
      data: {},
    };
    const result = LogEventJobSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("QueueConnectionConfigSchema", () => {
  it("validates a valid Redis connection config", () => {
    const valid = {
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: null,
    };
    const result = QueueConnectionConfigSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("uses default port 6379 when not provided", () => {
    const valid = {
      host: "localhost",
      maxRetriesPerRequest: null,
    };
    const result = QueueConnectionConfigSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.port).toBe(6379);
    }
  });

  it("allows password field", () => {
    const valid = {
      host: "redis.example.com",
      port: 6380,
      password: "secret",
      maxRetriesPerRequest: null,
    };
    const result = QueueConnectionConfigSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe("createConnectionConfig", () => {
  it("returns config with defaults from env-like params", () => {
    const config = createConnectionConfig({
      host: "localhost",
      port: 6379,
    });
    expect(config.host).toBe("localhost");
    expect(config.port).toBe(6379);
    expect(config.maxRetriesPerRequest).toBeNull();
  });

  it("sets maxRetriesPerRequest to null (critical for 24/7)", () => {
    const config = createConnectionConfig({});
    expect(config.maxRetriesPerRequest).toBeNull();
  });
});

describe("createQueue and createWorker exports", () => {
  it("createQueue is a function", () => {
    expect(typeof createQueue).toBe("function");
  });

  it("createWorker is a function", () => {
    expect(typeof createWorker).toBe("function");
  });
});
