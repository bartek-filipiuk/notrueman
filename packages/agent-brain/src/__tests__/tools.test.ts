import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "../tools/tool-registry.js";
import { BudgetManager } from "../tools/budget-manager.js";
import { WebSearchInputSchema } from "../tools/web-search.js";
import { WriteBlogInputSchema } from "../tools/write-blog.js";
import { CreateArtworkInputSchema } from "../tools/create-artwork.js";
import {
  WEB_SEARCH_METADATA,
  WRITE_BLOG_METADATA,
  CREATE_ARTWORK_METADATA,
} from "../tools/index.js";

describe("Stage J: Tool Framework", () => {
  describe("TJ.1: ToolRegistry", () => {
    let registry: ToolRegistry;

    beforeEach(() => {
      registry = new ToolRegistry();
      registry.register(
        { ...WEB_SEARCH_METADATA, activityTriggers: [...WEB_SEARCH_METADATA.activityTriggers] },
        { description: "mock web search" },
      );
      registry.register(
        { ...WRITE_BLOG_METADATA, activityTriggers: [...WRITE_BLOG_METADATA.activityTriggers] },
        { description: "mock write blog" },
      );
      registry.register(
        { ...CREATE_ARTWORK_METADATA, activityTriggers: [...CREATE_ARTWORK_METADATA.activityTriggers] },
        { description: "mock create artwork" },
      );
    });

    it("registers 3 tools", () => {
      expect(registry.size).toBe(3);
    });

    it("getToolsForActivity('computer') returns web_search + write_blog_post", () => {
      const tools = registry.getToolsForActivity("computer");
      expect(Object.keys(tools)).toContain("web_search");
      expect(Object.keys(tools)).toContain("write_blog_post");
      expect(Object.keys(tools)).not.toContain("create_artwork");
    });

    it("getToolsForActivity('draw') returns create_artwork + web_search", () => {
      const tools = registry.getToolsForActivity("draw");
      expect(Object.keys(tools)).toContain("create_artwork");
      expect(Object.keys(tools)).toContain("web_search");
    });

    it("getToolsForActivity('think') returns web_search only", () => {
      const tools = registry.getToolsForActivity("think");
      expect(Object.keys(tools)).toEqual(["web_search"]);
    });

    it("getToolsForActivity('sleep') returns empty", () => {
      const tools = registry.getToolsForActivity("sleep");
      expect(Object.keys(tools)).toHaveLength(0);
    });

    it("getAvailableTools filters by budget", () => {
      const tools = registry.getAvailableTools(1);
      expect(Object.keys(tools).length).toBe(3);

      const noTools = registry.getAvailableTools(0);
      expect(Object.keys(noTools).length).toBe(0);
    });

    it("getMetadata returns correct metadata", () => {
      const meta = registry.getMetadata("web_search");
      expect(meta?.name).toBe("web_search");
      expect(meta?.costPerCall).toBe(1);
    });

    it("getToolNames returns all registered names", () => {
      expect(registry.getToolNames()).toEqual(["web_search", "write_blog_post", "create_artwork"]);
    });
  });

  describe("TJ.2: BudgetManager", () => {
    let budget: BudgetManager;

    beforeEach(() => {
      budget = new BudgetManager(20);
    });

    it("starts with full budget", () => {
      const remaining = budget.getRemainingBudget();
      expect(remaining.callsLeft).toBe(20);
      expect(remaining.totalCalls).toBe(20);
    });

    it("trackCall decrements budget", () => {
      budget.trackCall("web_search");
      expect(budget.getRemainingBudget().callsLeft).toBe(19);
    });

    it("trackCall returns false when budget exceeded", () => {
      for (let i = 0; i < 20; i++) {
        expect(budget.trackCall("test")).toBe(true);
      }
      expect(budget.trackCall("test")).toBe(false);
    });

    it("isWithinBudget returns correct status", () => {
      expect(budget.isWithinBudget()).toBe(true);
      for (let i = 0; i < 20; i++) budget.trackCall("test");
      expect(budget.isWithinBudget()).toBe(false);
    });

    it("getCallsUsed tracks usage", () => {
      expect(budget.getCallsUsed()).toBe(0);
      budget.trackCall("a");
      budget.trackCall("b");
      expect(budget.getCallsUsed()).toBe(2);
    });

    it("custom cost per call", () => {
      budget.trackCall("expensive", 5);
      expect(budget.getRemainingBudget().callsLeft).toBe(15);
    });

    it("blocks when cost would exceed remaining", () => {
      for (let i = 0; i < 18; i++) budget.trackCall("test");
      expect(budget.trackCall("expensive", 3)).toBe(false); // would need 21
      expect(budget.getRemainingBudget().callsLeft).toBe(2);
    });
  });

  describe("TJ.3: Web Search tool Zod schema", () => {
    it("accepts valid input", () => {
      const result = WebSearchInputSchema.safeParse({ query: "quantum physics", count: 3 });
      expect(result.success).toBe(true);
    });

    it("defaults count to 3", () => {
      const result = WebSearchInputSchema.parse({ query: "test" });
      expect(result.count).toBe(3);
    });

    it("rejects empty query", () => {
      const result = WebSearchInputSchema.safeParse({ query: "" });
      expect(result.success).toBe(false);
    });

    it("rejects count > 5", () => {
      const result = WebSearchInputSchema.safeParse({ query: "test", count: 10 });
      expect(result.success).toBe(false);
    });

    it("rejects query > 200 chars", () => {
      const result = WebSearchInputSchema.safeParse({ query: "a".repeat(201) });
      expect(result.success).toBe(false);
    });
  });

  describe("TJ.4: Blog Post tool Zod schema", () => {
    it("accepts valid input", () => {
      const result = WriteBlogInputSchema.safeParse({
        title: "My thoughts on AI",
        content: "AI is fascinating...",
        tags: ["ai", "technology"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing content", () => {
      const result = WriteBlogInputSchema.safeParse({
        title: "Test",
        tags: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects > 5 tags", () => {
      const result = WriteBlogInputSchema.safeParse({
        title: "Test",
        content: "Content",
        tags: ["a", "b", "c", "d", "e", "f"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("TJ.5: Artwork tool Zod schema", () => {
    it("accepts valid input", () => {
      const result = CreateArtworkInputSchema.safeParse({
        title: "Neural Network Abstract",
        description: "A colorful visualization of neural pathways",
        style: "abstract digital",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing style", () => {
      const result = CreateArtworkInputSchema.safeParse({
        title: "Test",
        description: "A test",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("TJ.7: Config schema with tools", () => {
    it("TrumanConfigSchema accepts tools field", async () => {
      const { TrumanConfigSchema } = await import("../config.js");
      const config = {
        tickIntervalMs: 45000,
        models: { think: "deepseek/deepseek-chat", classify: "mistralai/mistral-small-latest" },
        failureRate: 0.25,
        maxRetries: 3,
        varietyPenalty: { veryRecentHours: 0.5, recentHours: 1.5, moderateHours: 3.0 },
        emotions: {
          happiness: 0.6, curiosity: 0.7, anxiety: 0.2,
          boredom: 0.3, excitement: 0.4, contentment: 0.5, frustration: 0.1,
        },
        tools: {
          maxCallsPerDay: 20,
          enabledTools: ["web_search", "write_blog_post", "create_artwork"],
        },
        interests: ["technology", "philosophy", "art"],
      };

      const result = TrumanConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("TrumanConfigSchema accepts config without tools (optional)", async () => {
      const { TrumanConfigSchema } = await import("../config.js");
      const config = {
        tickIntervalMs: 45000,
        models: { think: "a", classify: "b" },
        failureRate: 0.25,
        maxRetries: 3,
        varietyPenalty: { veryRecentHours: 0.5, recentHours: 1.5, moderateHours: 3.0 },
        emotions: {
          happiness: 0.6, curiosity: 0.7, anxiety: 0.2,
          boredom: 0.3, excitement: 0.4, contentment: 0.5, frustration: 0.1,
        },
      };

      const result = TrumanConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("interests max 10 items", async () => {
      const { TrumanConfigSchema } = await import("../config.js");
      const config = {
        tickIntervalMs: 45000,
        models: { think: "a", classify: "b" },
        failureRate: 0.25,
        maxRetries: 3,
        varietyPenalty: { veryRecentHours: 0.5, recentHours: 1.5, moderateHours: 3.0 },
        emotions: {
          happiness: 0.6, curiosity: 0.7, anxiety: 0.2,
          boredom: 0.3, excitement: 0.4, contentment: 0.5, frustration: 0.1,
        },
        interests: Array.from({ length: 11 }, (_, i) => `topic_${i}`),
      };

      const result = TrumanConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });
});
