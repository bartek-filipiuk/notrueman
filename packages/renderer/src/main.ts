import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, GAME_FPS } from "@nts/shared";
import { BootScene } from "./scenes/BootScene";
import { RoomScene } from "./scenes/RoomScene";
import { SceneHandler } from "./adapters/SceneHandler";
import {
  BrainLoop,
  RendererBridge,
  createLLMClient,
  EmotionEngine,
} from "@nts/agent-brain";
import { ConfigPanel } from "./ui/ConfigPanel";

/** Read API key from URL params (?apiKey=sk-or-...) or empty string */
function getApiKey(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("apiKey") || "";
}

/** Personality prompt embedded (avoids file system access in browser) */
const PERSONALITY = `You are Truman, a young man living alone in a small, cozy room. You are unaware that anyone is watching you.

You are a curious introvert with dry humor. You are philosophical, occasionally socially awkward, and surprisingly insightful. You approach your world with genuine wonder, ask questions nobody asked you to ask, and find meaning in small things.

Your inner monologue should be 1-2 sentences, reflective, warm, and occasionally witty. Think out loud as if narrating your own life. Be PG-13 at all times. Never break the fourth wall.`;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  parent: "game-container",
  pixelArt: true,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#3a2a1a",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: {
    target: GAME_FPS,
    forceSetTimeOut: true,
  },
  scene: [BootScene, RoomScene],
};

const game = new Phaser.Game(config);

// Wait for RoomScene to be ready, then decide mode
game.events.on("ready", () => {
  // RoomScene starts after BootScene transition (1s delay)
  setTimeout(() => {
    initBrain();
  }, 1500);
});

function initBrain(): void {
  const roomScene = game.scene.getScene("RoomScene") as RoomScene;
  if (!roomScene) {
    console.warn("[main] RoomScene not found, retrying in 1s...");
    setTimeout(initBrain, 1000);
    return;
  }

  const apiKey = getApiKey();

  if (!apiKey) {
    console.log("[main] No API key provided — running in DEMO mode");
    console.log("[main] Add ?apiKey=sk-or-... to URL for AI mode");
    // Demo mode: ActivityManager hardcoded loop already running from RoomScene.create()
    new ConfigPanel(() => ({ mode: "demo", tickCount: 0, currentActivity: "cycling", currentMood: "neutral" }));
    return;
  }

  console.log("[main] API key detected — starting AI brain mode");

  // Stop the demo loop
  roomScene.getActivityManager().stopLoop();

  // Create LLM client
  const llmClient = createLLMClient({
    apiKey,
    thinkModel: "deepseek/deepseek-chat",
    classifyModel: "mistralai/mistral-small-latest",
  });

  // Create emotion engine — drives mood in HUD and thought bubbles
  const emotions = new EmotionEngine();

  // Wrap the SceneHandler to inject emotion updates after each action
  const handler = new SceneHandler(roomScene);
  const emotionAwareHandler: SceneHandler = Object.create(handler, {
    updateHUD: {
      value(update: { mood?: string; activity?: string; time?: string }) {
        const currentMood = emotions.getOverallMood();
        handler.updateHUD({ ...update, mood: currentMood });
      },
    },
  });

  // Create renderer bridge
  const bridge = new RendererBridge(emotionAwareHandler);

  // Create and start brain loop
  const brain = new BrainLoop(llmClient, bridge, {
    tickIntervalMs: 30000,
    failureRate: 0.25,
    maxRetries: 2,
    systemPrompt: PERSONALITY,
  });

  // After each tick, update emotions based on activity outcome
  const originalTick = brain.tick.bind(brain);
  brain.tick = async function () {
    // Apply time drift before tick
    emotions.applyTimeDrift();

    await originalTick();

    // After tick, apply small emotion delta based on activity
    const state = brain.getState();
    if (state.lastError) {
      // Failure — frustration bump
      emotions.applyDelta({ frustration: 0.08, happiness: -0.03 });
    } else if (state.currentActivity) {
      // Success — small happiness bump, activity-specific effects
      const deltas: Record<string, Partial<Record<string, number>>> = {
        read: { curiosity: 0.05, contentment: 0.03 },
        think: { curiosity: 0.06, contentment: 0.04 },
        exercise: { happiness: 0.04, excitement: 0.03, boredom: -0.05 },
        cook: { contentment: 0.04, excitement: 0.02 },
        draw: { happiness: 0.05, excitement: 0.04 },
        computer: { curiosity: 0.04, boredom: -0.02 },
        eat: { contentment: 0.05, happiness: 0.03 },
        sleep: { contentment: 0.06, anxiety: -0.04 },
      };
      const delta = deltas[state.currentActivity] || { happiness: 0.02 };
      emotions.applyDelta(delta as any);
    }

    // Update HUD with new mood
    const mood = emotions.getOverallMood();
    handler.updateHUD({ mood });

    console.log(`[emotions] ${mood} (h:${emotions.getState().happiness.toFixed(2)} c:${emotions.getState().curiosity.toFixed(2)} f:${emotions.getState().frustration.toFixed(2)})`);
  };

  brain.start();

  // Expose for debugging
  (window as any).__brain = brain;
  (window as any).__bridge = bridge;
  (window as any).__emotions = emotions;

  // Config panel (toggle with ~ key)
  new ConfigPanel(() => ({
    mode: "AI",
    ...brain.getState(),
    currentMood: emotions.getOverallMood(),
    emotions: emotions.getState(),
  }));

  console.log("[main] Brain loop started with emotion engine. Press ~ for debug panel.");
}
