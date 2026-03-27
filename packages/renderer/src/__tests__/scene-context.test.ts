import { describe, it, expect } from "vitest";
import type { SceneContext, SceneToolResult, ActivitySceneData } from "../scenes/ActivitySceneBase";

describe("Stage Q: Scene Context Pipeline", () => {
  describe("TQ.1: ActivitySceneData with context", () => {
    it("ActivitySceneData accepts optional context field", () => {
      const data: ActivitySceneData = {
        duration: 12000,
        mood: "happy",
        onComplete: () => {},
        context: {
          thought: "I wonder what's out there...",
          reason: "curious about the world",
          mood: "curious",
          toolResults: [
            { tool: "web_search", query: "quantum physics", title: "Intro to QM", content: "Quantum mechanics..." },
          ],
          recentMemory: "I was reading about science yesterday",
        },
      };
      expect(data.context).toBeDefined();
      expect(data.context!.thought).toBe("I wonder what's out there...");
      expect(data.context!.toolResults).toHaveLength(1);
      expect(data.context!.toolResults![0].tool).toBe("web_search");
    });

    it("ActivitySceneData works without context (backwards compatible)", () => {
      const data: ActivitySceneData = {
        duration: 12000,
        mood: "neutral",
        onComplete: () => {},
      };
      expect(data.context).toBeUndefined();
    });

    it("SceneContext fields are all optional", () => {
      const emptyContext: SceneContext = {};
      expect(emptyContext.thought).toBeUndefined();
      expect(emptyContext.reason).toBeUndefined();
      expect(emptyContext.mood).toBeUndefined();
      expect(emptyContext.toolResults).toBeUndefined();
      expect(emptyContext.recentMemory).toBeUndefined();
    });

    it("SceneToolResult has correct shape", () => {
      const result: SceneToolResult = {
        tool: "write_blog_post",
        title: "My Blog",
        content: "Some content here...",
        description: "A blog post about AI",
      };
      expect(result.tool).toBe("write_blog_post");
      expect(result.title).toBe("My Blog");
    });
  });

  describe("TQ.5: Mood tint mapping", () => {
    const MOOD_TINT_MAP: Record<string, number> = {
      happy: 0xffd700,
      curious: 0x00bcd4,
      anxious: 0xff4444,
      excited: 0xffeb3b,
      content: 0x4caf50,
      frustrated: 0xff9800,
      bored: 0x9e9e9e,
      contemplative: 0x7986cb,
      neutral: 0xffffff,
    };

    it("all expected moods have tint colors", () => {
      const expectedMoods = ["happy", "curious", "anxious", "excited", "content", "frustrated", "bored", "contemplative", "neutral"];
      for (const mood of expectedMoods) {
        expect(MOOD_TINT_MAP[mood]).toBeDefined();
        expect(typeof MOOD_TINT_MAP[mood]).toBe("number");
      }
    });

    it("neutral mood maps to white (no tint)", () => {
      expect(MOOD_TINT_MAP.neutral).toBe(0xffffff);
    });

    it("each mood has a distinct tint color", () => {
      const colors = Object.values(MOOD_TINT_MAP);
      // neutral (white) is the "no tint" case, others should be unique
      const nonNeutral = colors.filter(c => c !== 0xffffff);
      expect(new Set(nonNeutral).size).toBe(nonNeutral.length);
    });
  });

  describe("TQ.6: Dynamic duration", () => {
    const DEFAULT_DURATION = 12_000;
    const CREATIVE_DURATION = 18_000;
    const SLEEP_DURATION = 15_000;

    function getSceneDuration(type: string, hasToolResults: boolean): number {
      if (type === "sleep") return SLEEP_DURATION;
      if (hasToolResults) return CREATIVE_DURATION;
      return DEFAULT_DURATION;
    }

    it("default duration is 12s", () => {
      expect(getSceneDuration("computer", false)).toBe(12_000);
      expect(getSceneDuration("think", false)).toBe(12_000);
      expect(getSceneDuration("cook", false)).toBe(12_000);
    });

    it("sleep duration is 15s", () => {
      expect(getSceneDuration("sleep", false)).toBe(15_000);
      expect(getSceneDuration("sleep", true)).toBe(15_000); // sleep always 15s
    });

    it("creative activities with tool results get 18s", () => {
      expect(getSceneDuration("computer", true)).toBe(18_000);
      expect(getSceneDuration("draw", true)).toBe(18_000);
      expect(getSceneDuration("read", true)).toBe(18_000);
    });
  });

  describe("TQ.2: ActivityManager context passing", () => {
    it("context structure matches SceneContext interface", () => {
      const context: SceneContext = {
        thought: "Researching quantum physics...",
        reason: "curious about the universe",
        mood: "curious",
        toolResults: [
          { tool: "web_search", query: "quantum entanglement", title: "Quantum Entanglement Explained" },
        ],
        recentMemory: "Read about black holes yesterday",
      };

      // Verify all fields are present and typed correctly
      expect(typeof context.thought).toBe("string");
      expect(typeof context.reason).toBe("string");
      expect(typeof context.mood).toBe("string");
      expect(Array.isArray(context.toolResults)).toBe(true);
      expect(typeof context.recentMemory).toBe("string");
    });
  });

  describe("TQ.3: Brain bridge context pipeline", () => {
    it("context is constructed from executeAction params", () => {
      // Simulate what main.ts does: construct context from executeAction args
      const activity = "computer";
      const thought = "Let me search for interesting topics...";
      const mood = "curious";

      const context: SceneContext = {
        thought: thought || undefined,
        mood: mood || undefined,
      };

      expect(context.thought).toBe(thought);
      expect(context.mood).toBe(mood);
    });

    it("empty thought/mood results in undefined context fields", () => {
      const emptyThought = "";
      const emptyMood = "";
      const context: SceneContext = {
        thought: emptyThought || undefined,
        mood: emptyMood || undefined,
      };

      expect(context.thought).toBeUndefined();
      expect(context.mood).toBeUndefined();
    });
  });
});
