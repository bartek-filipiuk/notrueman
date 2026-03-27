import { describe, it, expect } from "vitest";
import {
  MindFeedEventSchema,
  MindFeedEventTypeSchema,
  PublicMindFeedEventSchema,
  filterForPublicFeed,
  PUBLIC_ALLOWED_FIELDS,
} from "../types/mind-feed.js";
import type { MindFeedEvent, MindFeedEventType } from "../types/mind-feed.js";

describe("MindFeedEventTypeSchema", () => {
  it("accepts valid event types", () => {
    const types: MindFeedEventType[] = [
      "thought",
      "mood_change",
      "tool_call",
      "activity_change",
      "blog_created",
      "artwork_created",
      "reflection",
    ];
    for (const t of types) {
      expect(MindFeedEventTypeSchema.parse(t)).toBe(t);
    }
  });

  it("rejects invalid event types", () => {
    expect(() => MindFeedEventTypeSchema.parse("invalid")).toThrow();
  });
});

describe("MindFeedEventSchema", () => {
  it("parses a valid event", () => {
    const event = {
      type: "thought",
      timestamp: Date.now(),
      data: { text: "I wonder about the sky" },
      public: true,
    };
    const result = MindFeedEventSchema.parse(event);
    expect(result.type).toBe("thought");
    expect(result.public).toBe(true);
    expect(result.data["text"]).toBe("I wonder about the sky");
  });

  it("rejects event missing required fields", () => {
    expect(() =>
      MindFeedEventSchema.parse({ type: "thought", timestamp: 123 }),
    ).toThrow();
  });

  it("rejects event with invalid type", () => {
    expect(() =>
      MindFeedEventSchema.parse({
        type: "unknown",
        timestamp: 123,
        data: {},
        public: false,
      }),
    ).toThrow();
  });
});

describe("PublicMindFeedEventSchema", () => {
  it("parses event without public field", () => {
    const event = {
      type: "mood_change",
      timestamp: Date.now(),
      data: { mood: "curious" },
    };
    const result = PublicMindFeedEventSchema.parse(event);
    expect(result.type).toBe("mood_change");
  });
});

describe("filterForPublicFeed", () => {
  it("returns null for non-public events", () => {
    const event: MindFeedEvent = {
      type: "thought",
      timestamp: Date.now(),
      data: { text: "secret thought" },
      public: false,
    };
    expect(filterForPublicFeed(event)).toBeNull();
  });

  it("strips disallowed fields from thought events", () => {
    const event: MindFeedEvent = {
      type: "thought",
      timestamp: 1000,
      data: { text: "hello", rawPrompt: "system: ...", cost: 0.05 },
      public: true,
    };
    const result = filterForPublicFeed(event);
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ text: "hello" });
    expect(result!.timestamp).toBe(1000);
    expect("rawPrompt" in result!.data).toBe(false);
    expect("cost" in result!.data).toBe(false);
  });

  it("keeps mood and prevMood for mood_change", () => {
    const event: MindFeedEvent = {
      type: "mood_change",
      timestamp: 2000,
      data: { mood: "happy", prevMood: "neutral", deltas: { happiness: 0.3 } },
      public: true,
    };
    const result = filterForPublicFeed(event);
    expect(result!.data).toEqual({ mood: "happy", prevMood: "neutral" });
  });

  it("keeps tool and topic for tool_call, strips input/output", () => {
    const event: MindFeedEvent = {
      type: "tool_call",
      timestamp: 3000,
      data: {
        tool: "brave_search",
        topic: "cats",
        query: "best cats breeds 2025",
        result: "...",
      },
      public: true,
    };
    const result = filterForPublicFeed(event);
    expect(result!.data).toEqual({ tool: "brave_search", topic: "cats" });
  });

  it("keeps title and tags for blog_created", () => {
    const event: MindFeedEvent = {
      type: "blog_created",
      timestamp: 4000,
      data: { title: "My Blog", tags: ["tech"], content: "full content..." },
      public: true,
    };
    const result = filterForPublicFeed(event);
    expect(result!.data).toEqual({ title: "My Blog", tags: ["tech"] });
  });

  it("keeps title and style for artwork_created", () => {
    const event: MindFeedEvent = {
      type: "artwork_created",
      timestamp: 5000,
      data: { title: "Art", style: "abstract", description: "long desc" },
      public: true,
    };
    const result = filterForPublicFeed(event);
    expect(result!.data).toEqual({ title: "Art", style: "abstract" });
  });

  it("keeps insight for reflection", () => {
    const event: MindFeedEvent = {
      type: "reflection",
      timestamp: 6000,
      data: {
        insight: "I learned something",
        memoryIds: ["m1", "m2"],
        evidence: "...",
      },
      public: true,
    };
    const result = filterForPublicFeed(event);
    expect(result!.data).toEqual({ insight: "I learned something" });
  });

  it("keeps activity fields for activity_change", () => {
    const event: MindFeedEvent = {
      type: "activity_change",
      timestamp: 7000,
      data: { activity: "reading", prevActivity: "idle", debug: "info" },
      public: true,
    };
    const result = filterForPublicFeed(event);
    expect(result!.data).toEqual({
      activity: "reading",
      prevActivity: "idle",
    });
  });

  it("covers all event types in PUBLIC_ALLOWED_FIELDS", () => {
    const allTypes = MindFeedEventTypeSchema.options;
    for (const t of allTypes) {
      expect(PUBLIC_ALLOWED_FIELDS[t]).toBeDefined();
      expect(Array.isArray(PUBLIC_ALLOWED_FIELDS[t])).toBe(true);
    }
  });
});
