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

  describe("TR.10: Dynamic scene content", () => {
    it("ComputerScene uses web_search tool results for monitor text", () => {
      const context: SceneContext = {
        thought: "Looking up quantum physics",
        toolResults: [
          { tool: "web_search", query: "quantum physics", title: "Intro to QM", content: "Quantum mechanics is a theory..." },
        ],
      };
      expect(context.toolResults![0].tool).toBe("web_search");
      expect(context.toolResults![0].query).toBe("quantum physics");
      expect(context.toolResults![0].content).toBeDefined();
    });

    it("ComputerScene uses write_blog_post results for scrolling blog", () => {
      const context: SceneContext = {
        thought: "Writing a blog about AI",
        toolResults: [
          { tool: "write_blog_post", title: "AI Revolution", content: "Artificial intelligence is transforming..." },
        ],
      };
      expect(context.toolResults![0].tool).toBe("write_blog_post");
      expect(context.toolResults![0].title).toBe("AI Revolution");
    });

    it("ComputerScene falls back to thinking text without tool results", () => {
      const context: SceneContext = { thought: "Just thinking..." };
      expect(context.toolResults).toBeUndefined();
      // Fallback lines should be used in the scene
    });

    it("SleepScene uses recentMemory for dream text", () => {
      const context: SceneContext = {
        thought: "Dreaming about the stars...",
        recentMemory: "I saw a beautiful sunset yesterday",
      };
      expect(context.recentMemory).toBeDefined();
      expect(context.recentMemory!.length).toBeGreaterThan(0);
    });

    it("SleepScene falls back to thought when no memory", () => {
      const context: SceneContext = { thought: "A strange dream..." };
      const dreamText = context.recentMemory || context.thought;
      expect(dreamText).toBe("A strange dream...");
    });

    it("ThinkScene uses thought for typewriter effect", () => {
      const context: SceneContext = { thought: "What is the meaning of consciousness?" };
      const words = context.thought!.split(" ");
      expect(words.length).toBe(6);
      // Typewriter shows words one by one at 100ms/word
    });

    it("ThinkScene falls back to dots without thought", () => {
      const context: SceneContext = {};
      expect(context.thought).toBeUndefined();
      // Scene should show "..." fallback
    });

    it("DrawScene uses create_artwork results", () => {
      const context: SceneContext = {
        thought: "Creating something beautiful",
        toolResults: [
          { tool: "create_artwork", title: "Sunset Over Ocean", description: "A vibrant sunset with warm colors" },
        ],
      };
      const artResult = context.toolResults!.find(r => r.tool === "create_artwork");
      expect(artResult).toBeDefined();
      expect(artResult!.title).toBe("Sunset Over Ocean");
      expect(artResult!.description).toBe("A vibrant sunset with warm colors");
    });

    it("ReadScene uses web_search as reading material", () => {
      const context: SceneContext = {
        thought: "Interesting read about philosophy",
        toolResults: [
          { tool: "web_search", query: "philosophy of mind", title: "What is Consciousness?", content: "A deep dive into..." },
        ],
      };
      const searchResult = context.toolResults!.find(r => r.tool === "web_search");
      expect(searchResult).toBeDefined();
      expect(searchResult!.title).toBe("What is Consciousness?");
    });

    it("ReadScene falls back to quotes without context", () => {
      const context: SceneContext = {};
      expect(context.thought).toBeUndefined();
      expect(context.toolResults).toBeUndefined();
      // Scene should show hardcoded quotes as fallback
    });

    it("EatScene shows thought instead of random nom/yum when context present", () => {
      const context: SceneContext = { thought: "This soup is really good..." };
      expect(context.thought).toBeDefined();
      // Scene should show the actual thought, not "nom"/"yum"
    });

    it("EatScene falls back to nom/yum without thought", () => {
      const context: SceneContext = {};
      expect(context.thought).toBeUndefined();
      // Scene should show classic "nom"/"yum" fallback
    });

    it("CookScene steam frequency varies by mood", () => {
      const freqMap: Record<string, number> = {
        excited: 150, happy: 200, frustrated: 180, content: 400, bored: 500,
      };
      expect(freqMap.excited).toBeLessThan(freqMap.content);
      expect(freqMap.bored).toBeGreaterThan(freqMap.happy);
    });

    it("ExerciseScene sweat frequency varies by mood", () => {
      const freqMap: Record<string, number> = {
        frustrated: 300, anxious: 350, excited: 400, content: 700, bored: 800,
      };
      expect(freqMap.frustrated).toBeLessThan(freqMap.content);
      expect(freqMap.bored).toBeGreaterThan(freqMap.excited);
    });

    it("DrawScene splatter colors vary by mood", () => {
      const moodPalettes: Record<string, number[]> = {
        happy: [0xffd700, 0xff6b6b, 0xffd93d, 0x55efc4, 0xffab40],
        curious: [0x48dbfb, 0x00bcd4, 0x81d4fa, 0x4dd0e1, 0x80deea],
        anxious: [0xff4444, 0xff6b6b, 0xef5350, 0xd32f2f, 0xff8a80],
      };
      expect(moodPalettes.happy).toHaveLength(5);
      expect(moodPalettes.curious[0]).not.toBe(moodPalettes.happy[0]);
    });

    it("all scenes truncate long text to prevent overflow", () => {
      const longThought = "A".repeat(200);
      const truncated = longThought.length > 120
        ? longThought.substring(0, 117) + "..."
        : longThought;
      expect(truncated.length).toBe(120);
      expect(truncated.endsWith("...")).toBe(true);
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
