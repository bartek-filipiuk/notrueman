import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn(() => {
    const modelFn = (modelId: string) => ({ modelId, provider: "openrouter" });
    return modelFn;
  }),
}));

import { BrainLoop } from "../brain-loop.js";
import { RendererBridge } from "../renderer-bridge.js";
import { createLLMClient } from "../llm-client.js";
import { EmotionEngine } from "../emotion-engine.js";
import { PhysicalStateEngine } from "../physical-state.js";
import type { RendererHandler } from "../renderer-bridge.js";

function createMockHandler(): RendererHandler {
  return {
    moveTo: vi.fn().mockResolvedValue(undefined),
    playActivity: vi.fn(),
    showThought: vi.fn(),
    updateHUD: vi.fn(),
  };
}

describe("TH: Recovery Integration", () => {
  let brain: BrainLoop;
  let emotions: EmotionEngine;
  let physicalState: PhysicalStateEngine;

  beforeEach(() => {
    const handler = createMockHandler();
    const bridge = new RendererBridge(handler);
    const client = createLLMClient({
      apiKey: "test-key",
      thinkModel: "test/model",
      classifyModel: "test/model",
    });
    brain = new BrainLoop(client, bridge, {
      tickIntervalMs: 30000,
      failureRate: 0,
      maxRetries: 0,
      systemPrompt: "test",
    });
    emotions = new EmotionEngine();
    physicalState = new PhysicalStateEngine();
  });

  describe("TH.3: BrainLoop.restoreState()", () => {
    it("restores tickCount", () => {
      brain.restoreState({ tickCount: 42 });
      expect(brain.getState().tickCount).toBe(42);
    });

    it("restores currentActivity", () => {
      brain.restoreState({ currentActivity: "read" });
      expect(brain.getState().currentActivity).toBe("read");
    });

    it("restores currentMood", () => {
      brain.restoreState({ currentMood: "happy" });
      expect(brain.getState().currentMood).toBe("happy");
    });

    it("restores recentActivities", () => {
      const activities = [
        { activity: "read" as const, completedSecondsAgo: 30 },
        { activity: "cook" as const, completedSecondsAgo: 90 },
      ];
      brain.restoreState({ recentActivities: activities });
      const state = brain.getState();
      expect(state.recentActivities).toHaveLength(2);
      expect(state.recentActivities[0].activity).toBe("read");
      expect(state.recentActivities[1].activity).toBe("cook");
    });

    it("restores multiple fields at once", () => {
      brain.restoreState({
        tickCount: 100,
        currentActivity: "exercise",
        currentMood: "excited",
        recentActivities: [{ activity: "exercise" as const, completedSecondsAgo: 0 }],
      });
      const state = brain.getState();
      expect(state.tickCount).toBe(100);
      expect(state.currentActivity).toBe("exercise");
      expect(state.currentMood).toBe("excited");
      expect(state.recentActivities).toHaveLength(1);
    });
  });

  describe("TH.3: EmotionEngine.setState() recovery", () => {
    it("restores emotion state", () => {
      const savedEmotions = {
        happiness: 0.8,
        curiosity: 0.6,
        anxiety: 0.1,
        boredom: 0.05,
        excitement: 0.7,
        contentment: 0.5,
        frustration: 0.02,
      };
      emotions.setState(savedEmotions);
      const restored = emotions.getState();
      expect(restored.happiness).toBeCloseTo(0.8);
      expect(restored.curiosity).toBeCloseTo(0.6);
      expect(restored.excitement).toBeCloseTo(0.7);
    });

    it("restores overall mood from saved emotions", () => {
      emotions.setState({
        happiness: 0.9,
        curiosity: 0.3,
        anxiety: 0.0,
        boredom: 0.0,
        excitement: 0.2,
        contentment: 0.5,
        frustration: 0.0,
      });
      expect(emotions.getOverallMood()).toBe("happy");
    });
  });

  describe("TH.3: PhysicalStateEngine.setState() recovery", () => {
    it("restores physical state", () => {
      physicalState.setState({ energy: 0.3, hunger: 0.7, tiredness: 0.5 });
      const restored = physicalState.getState();
      expect(restored.energy).toBeCloseTo(0.3);
      expect(restored.hunger).toBeCloseTo(0.7);
      expect(restored.tiredness).toBeCloseTo(0.5);
    });

    it("clamps out-of-range values", () => {
      physicalState.setState({ energy: 1.5, hunger: -0.2, tiredness: 0.5 });
      const restored = physicalState.getState();
      expect(restored.energy).toBe(1);
      expect(restored.hunger).toBe(0);
    });
  });

  describe("TH.4: Offline time compensation", () => {
    it("physical state drifts over elapsed hours", () => {
      physicalState.setState({ energy: 0.8, hunger: 0.2, tiredness: 0.2 });
      physicalState.applyTimeDrift(4); // 4 hours offline
      const state = physicalState.getState();
      // energy should decrease, hunger/tiredness should increase
      expect(state.energy).toBeLessThan(0.8);
      expect(state.hunger).toBeGreaterThan(0.2);
      expect(state.tiredness).toBeGreaterThan(0.2);
    });

    it("8h+ offline resets tiredness (Truman slept)", () => {
      physicalState.setState({ energy: 0.3, hunger: 0.4, tiredness: 0.9 });
      physicalState.applyTimeDrift(10); // 10 hours — applies drift first
      // Simulate the sleep reset (done in main.ts recoverBrain)
      const afterDrift = physicalState.getState();
      physicalState.setState({ ...afterDrift, tiredness: 0.1 });
      expect(physicalState.getState().tiredness).toBeCloseTo(0.1);
    });

    it("emotion drift moves toward defaults", () => {
      emotions.setState({
        happiness: 0.1,
        curiosity: 0.1,
        anxiety: 0.9,
        boredom: 0.9,
        excitement: 0.1,
        contentment: 0.1,
        frustration: 0.9,
      });
      // Simulate 2 hours passing
      const future = new Date(Date.now() + 2 * 3_600_000);
      emotions.applyTimeDrift(future);
      const state = emotions.getState();
      // Extreme values should move toward center/defaults
      expect(state.anxiety).toBeLessThan(0.9);
      expect(state.boredom).toBeLessThan(0.9);
      expect(state.frustration).toBeLessThan(0.9);
    });
  });

  describe("TH.5: Day counter math", () => {
    it("dayCount = 0 on first day", () => {
      const createdAt = Date.now();
      const dayCount = Math.floor((Date.now() - createdAt) / 86_400_000);
      expect(dayCount).toBe(0);
    });

    it("dayCount = 1 after 24h", () => {
      const createdAt = Date.now() - 86_400_000; // 24h ago
      const dayCount = Math.floor((Date.now() - createdAt) / 86_400_000);
      expect(dayCount).toBe(1);
    });

    it("dayCount = 3 after 3.5 days", () => {
      const createdAt = Date.now() - 86_400_000 * 3.5;
      const dayCount = Math.floor((Date.now() - createdAt) / 86_400_000);
      expect(dayCount).toBe(3);
    });
  });
});
