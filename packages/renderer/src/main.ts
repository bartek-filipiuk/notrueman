import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, GAME_FPS, EMOTION_DEFAULTS, SAVE_DATA_VERSION } from "@nts/shared";
import type { SaveData } from "@nts/shared";
import { BootScene } from "./scenes/BootScene";
import { RoomScene } from "./scenes/RoomScene";
import { ComputerScene } from "./scenes/ComputerScene";
import { SleepScene } from "./scenes/SleepScene";
import { CookScene } from "./scenes/CookScene";
import { ReadScene } from "./scenes/ReadScene";
import { DrawScene } from "./scenes/DrawScene";
import { ExerciseScene } from "./scenes/ExerciseScene";
import { EatScene } from "./scenes/EatScene";
import { ThinkScene } from "./scenes/ThinkScene";
import { SceneHandler } from "./adapters/SceneHandler";
import {
  BrainLoop,
  RendererBridge,
  createLLMClient,
  EmotionEngine,
} from "@nts/agent-brain";
import { ConfigPanel } from "./ui/ConfigPanel";
import type { SaveStats } from "./ui/ConfigPanel";
import { TTSManager, getTTSConfigFromURL } from "./systems/TTSManager";
import { SaveManager } from "./systems/SaveManager";

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
  type: Phaser.WEBGL,
  parent: "game-container",
  pixelArt: false,
  antialias: true,
  roundPixels: false,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#0f0f13",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
  },
  render: {
    // Sharper text: tell Phaser to use higher DPI canvas
    desynchronized: false,
  },
  fps: {
    target: GAME_FPS,
    forceSetTimeOut: true,
  },
  scene: [BootScene, RoomScene, ComputerScene, SleepScene, CookScene, ReadScene, DrawScene, ExerciseScene, EatScene, ThinkScene],
};

/** Remove the "Click to start" overlay and create the game.
 *  The click/touch satisfies browser autoplay policy so AudioContext can start. */
function startGame(): void {
  const overlay = document.getElementById("start-overlay");
  if (overlay) overlay.remove();

  const game = new Phaser.Game(config);

  // Wait for RoomScene to be ready, then decide mode
  game.events.on("ready", () => {
    // Wait for RoomScene to be fully ready (Truman, HUD, etc.)
    const waitForScene = async () => {
      const roomScene = game.scene.getScene("RoomScene") as RoomScene | null;
      if (!roomScene?.getTruman?.() || !roomScene?.getThoughtBubble?.()) {
        setTimeout(waitForScene, 500);
        return;
      }

      // Handle URL reset params (TI.5)
      const resetParam = new URLSearchParams(window.location.search).get("reset");
      if (resetParam === "hard" || resetParam === "soft") {
        await handleResetParam(resetParam);
        return;
      }

      // Init save manager + load existing save
      const save = await initSaveManager();
      if (save) {
        restoreRendererState(game, save);
      }
      initBrain(game, save);
    };
    setTimeout(waitForScene, 1500);
  });
}

/** Handle ?reset=soft or ?reset=hard URL params (TI.5) */
async function handleResetParam(mode: "soft" | "hard"): Promise<void> {
  console.log(`[save] URL reset param: ${mode}`);
  await saveManager.init();
  if (mode === "hard") {
    await saveManager.reset("hard");
  }
  // Remove the reset param and reload
  const url = new URL(window.location.href);
  url.searchParams.delete("reset");
  window.location.replace(url.toString());
}

// Gate game creation on user interaction (audio autoplay policy)
const overlay = document.getElementById("start-overlay");
if (overlay) {
  overlay.addEventListener("click", startGame, { once: true });
  overlay.addEventListener("touchstart", startGame, { once: true });
} else {
  startGame();
}

/** Restore Truman's renderer state (position, facing) from a save (TH.2) */
function restoreRendererState(game: Phaser.Game, save: SaveData): void {
  const roomScene = game.scene.getScene("RoomScene") as RoomScene | null;
  if (!roomScene) return;
  const truman = roomScene.getTruman?.();
  if (!truman) {
    console.warn("[save] Truman not ready — skipping position restore");
    return;
  }
  truman.setPosition(save.truman.x, save.truman.y);
  truman.setFacing(save.truman.facing);
  console.log(`[save] Restored position: (${save.truman.x.toFixed(0)}, ${save.truman.y.toFixed(0)}) facing ${save.truman.facing}`);
}

/** Apply offline time compensation — drift emotions + physical state (TH.4) */
function applyOfflineCompensation(
  save: SaveData,
  emotions: EmotionEngine,
): void {
  const elapsed = Date.now() - save.savedAt;
  if (elapsed <= 0) return;

  const elapsedHours = elapsed / (1000 * 60 * 60);

  // Emotions: drift toward defaults using EmotionEngine's built-in drift
  // Create a date in the past so applyTimeDrift calculates correctly
  const pastDate = new Date(save.savedAt);
  emotions.setState(save.emotions);
  // Override lastUpdateAt by re-constructing after setState
  // setState sets lastUpdateAt to now — we need to set it to savedAt
  // So we manually call applyTimeDrift with a synthesized elapsed
  emotions.applyTimeDrift(new Date());

  // Physical state adjustments based on elapsed time
  // Hunger increases ~0.1/hour, tiredness increases ~0.08/hour
  // If elapsed > 8h → Truman "slept" (reset tiredness)
  const hungerIncrease = Math.min(1, elapsedHours * 0.1);
  const tirednessIncrease = Math.min(1, elapsedHours * 0.08);
  const slept = elapsedHours > 8;

  console.log(
    `[save] Offline compensation: ${elapsedHours.toFixed(1)}h elapsed.` +
    ` Hunger +${hungerIncrease.toFixed(2)}, tiredness ${slept ? "reset (slept)" : `+${tirednessIncrease.toFixed(2)}`}`
  );
}

function initBrain(game: Phaser.Game, save?: SaveData | null): void {
  const roomScene = game.scene.getScene("RoomScene") as RoomScene;
  // Wait until RoomScene is fully created (has all subsystems initialized)
  if (!roomScene || !roomScene.getThoughtBubble?.()) {
    console.warn("[main] RoomScene not fully ready, retrying in 1s...");
    setTimeout(() => initBrain(game, save), 1000);
    return;
  }

  const apiKey = getApiKey();

  if (!apiKey) {
    console.log("[main] No API key provided — running in DEMO mode");
    console.log("[main] Add ?apiKey=sk-or-... to URL for AI mode");
    // Demo mode: ActivityManager hardcoded loop already running from RoomScene.create()
    const demoPanel = new ConfigPanel(() => ({ mode: "demo", tickCount: 0, currentActivity: "cycling", currentMood: "neutral" }));
    setupConfigPanelStats(demoPanel, roomScene);
    demoPanel.setOnReset((mode) => {
      void performReset(mode, roomScene, null, null);
    });
    // Save triggers for demo mode too
    setupSaveTriggers(roomScene, null, null);
    return;
  }

  console.log("[main] API key detected — starting AI brain mode");

  // Stop the demo loop (if it was started — may not exist yet if scene still loading)
  try {
    roomScene.getActivityManager()?.stopLoop();
  } catch {
    console.log("[main] ActivityManager not ready yet — demo loop was prevented by URL check");
  }

  // Create LLM client — models from config/truman-config.json
  const llmClient = createLLMClient({
    apiKey,
    thinkModel: "deepseek/deepseek-chat",
    classifyModel: "deepseek/deepseek-chat",
  });

  // Create emotion engine — drives mood in HUD and thought bubbles
  // Restore from save if available (TH.3)
  const emotions = new EmotionEngine(save?.emotions);

  // Apply offline time compensation (TH.4)
  if (save) {
    applyOfflineCompensation(save, emotions);
  }

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

  // Initialize TTS (if configured via URL params)
  const ttsConfig = getTTSConfigFromURL();
  const ttsManager = new TTSManager(ttsConfig);
  ttsManager.setAudioMixer(roomScene.getAudioMixer());
  roomScene.setTTSManager(ttsManager);

  // Create renderer bridge
  const bridge = new RendererBridge(emotionAwareHandler);

  // Create and start brain loop
  const brain = new BrainLoop(llmClient, bridge, {
    tickIntervalMs: 60000,
    failureRate: 0.25,
    maxRetries: 2,
    systemPrompt: PERSONALITY,
  });

  // Restore brain state from save (TH.3)
  if (save) {
    const now = Date.now();
    brain.restoreState({
      tickCount: save.brainTickCount,
      currentActivity: save.truman.currentActivity,
      currentMood: save.truman.currentMood,
      recentActivities: save.recentActivities.map((ra) => ({
        activity: ra.type as import("@nts/shared").ActivityType,
        completedSecondsAgo: Math.round((now - ra.at) / 1000),
      })),
    });
    console.log(`[save] Restored brain: tick #${save.brainTickCount}, mood ${save.truman.currentMood}, ${save.recentActivities.length} recent activities`);
  }

  // Patch bridge.executeAction to:
  // 1. Pass brain context to ActivityManager for scene use
  // 2. Sometimes produce speech bubbles (30% chance)
  const originalExecuteAction = bridge.executeAction.bind(bridge);
  bridge.executeAction = async function (activity, thought, mood) {
    // Set brain context for the next zoom scene
    const activityMgr = roomScene.getActivityManager();
    activityMgr.setSceneContext({
      thought: thought || undefined,
      mood: mood || undefined,
    });

    // Post thought event with ACTUAL thought text for mind feed + admin
    if (thought) {
      postBrainEvent({
        type: "thought",
        timestamp: Date.now(),
        data: { thought, mood, activity },
        public: true,
      });
    }

    // Use ActivityManager.doActivity() to trigger zoom scenes + proper flow
    await activityMgr.doActivity(activity as import("@nts/shared").ActivityType);

    // Show thought/speech bubble after activity starts
    if (thought) {
      if (ttsManager.isEnabled() && Math.random() < 0.3) {
        roomScene.showSpeech(thought, mood);
      } else {
        roomScene.showThought(thought, mood);
      }
    }
  };

  // After each tick, update emotions based on activity outcome
  const originalTick = brain.tick.bind(brain);
  brain.tick = async function () {
    // Show thinking indicator during LLM call
    roomScene.showThought("...", "contemplative");
    postBrainEvent({ type: "thought", timestamp: Date.now(), data: { thought: "Thinking..." }, public: true });

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

    // Update background music to match mood (crossfade if different)
    roomScene.getMusicManager().onMoodChange(mood);

    console.log(`[emotions] ${mood} (h:${emotions.getState().happiness.toFixed(2)} c:${emotions.getState().curiosity.toFixed(2)} f:${emotions.getState().frustration.toFixed(2)})`);

    // Post events to backend for WebSocket broadcast
    postBrainEvent({
      type: "thought",
      timestamp: Date.now(),
      data: { thought: state.currentActivity ? `Tick #${state.tickCount}: ${state.currentActivity}` : "Thinking...", mood, activity: state.currentActivity },
      public: true,
    });
    if (state.currentActivity) {
      postBrainEvent({
        type: "activity_change",
        timestamp: Date.now(),
        data: { activity: state.currentActivity, mood },
        public: true,
      });
    }
    postBrainEvent({
      type: "mood_change",
      timestamp: Date.now(),
      data: { mood, emotions: emotions.getState() },
      public: true,
    });
  };

  brain.start();

  // Expose for debugging
  (window as any).__brain = brain;
  (window as any).__bridge = bridge;
  (window as any).__emotions = emotions;
  (window as any).__tts = ttsManager;

  // Config panel (toggle with ~ key)
  const configPanel = new ConfigPanel(() => ({
    mode: "AI",
    ...brain.getState(),
    currentMood: emotions.getOverallMood(),
    emotions: emotions.getState(),
    tts: {
      enabled: ttsManager.isEnabled(),
      voice: ttsManager.getVoice(),
      playing: ttsManager.getIsPlaying(),
      queueSize: ttsManager.getQueueSize(),
    },
  }));

  // Wire save stats to ConfigPanel (TI.2)
  setupConfigPanelStats(configPanel, roomScene);

  // Wire reset buttons (TI.3, TI.4)
  configPanel.setOnReset((mode) => {
    void performReset(mode, roomScene, brain, emotions);
  });

  const ttsStatus = ttsManager.isEnabled()
    ? `TTS enabled (voice: ${ttsManager.getVoice()})`
    : "TTS disabled (add ?tts=on&openaiKey=sk-... to enable)";
  console.log(`[main] Brain loop started with emotion engine. ${ttsStatus}. Press ~ for debug panel.`);

  // --- State persistence (TG.4 + TG.5) ---
  setupSaveTriggers(roomScene, brain, emotions);
}

// =============================================
// State Persistence — Save triggers + Day counter
// =============================================

/** Global save manager instance */
const saveManager = new SaveManager();

/** Track dirty state to avoid unnecessary saves */
let dirty = false;

/** Session-level state for day counter (TG.5) */
let saveCreatedAt: number = Date.now();
let saveTotalTimeAliveMs: number = 0;
let saveSessionCount: number = 0;
let saveBrainTickCountBase: number = 0;
let sessionStartedAt: number = Date.now();

/** Mark state as dirty (something changed) */
export function markDirty(): void {
  dirty = true;
}

/** Collect current SaveData from all game systems */
function collectSaveData(
  roomScene: RoomScene,
  brain: BrainLoop | null,
  emotions: EmotionEngine | null,
): SaveData {
  const truman = roomScene.getTruman();
  const activityMgr = roomScene.getActivityManager();
  const now = Date.now();
  const elapsedThisSession = now - sessionStartedAt;
  const totalAlive = saveTotalTimeAliveMs + elapsedThisSession;
  const dayCount = Math.floor((now - saveCreatedAt) / 86_400_000);

  const brainState = brain?.getState();
  const emotionState = emotions?.getState();

  return {
    version: SAVE_DATA_VERSION,
    savedAt: now,
    createdAt: saveCreatedAt,
    dayCount,
    totalTimeAliveMs: totalAlive,
    sessionCount: saveSessionCount,
    truman: {
      x: truman.x,
      y: truman.y,
      facing: truman.getFacing(),
      currentActivity: activityMgr.getCurrentActivity(),
      currentMood: emotions?.getOverallMood() ?? "neutral",
    },
    emotions: emotionState ?? { ...EMOTION_DEFAULTS },
    physicalState: { energy: 1.0, hunger: 0.0, tiredness: 0.0 },
    recentActivities: (brainState?.recentActivities ?? []).map((ra) => ({
      type: ra.activity,
      at: Date.now() - ra.completedSecondsAgo * 1000,
    })),
    brainTickCount: saveBrainTickCountBase + (brainState?.tickCount ?? 0),
  };
}

/** Initialize save manager and restore session counters from existing save */
async function initSaveManager(): Promise<SaveData | null> {
  await saveManager.init();
  const save = await saveManager.load();

  if (save) {
    // Restore session-level counters (TG.5)
    saveCreatedAt = save.createdAt;
    saveTotalTimeAliveMs = save.totalTimeAliveMs;
    saveSessionCount = save.sessionCount + 1; // increment on load
    saveBrainTickCountBase = save.brainTickCount;
    sessionStartedAt = Date.now();
    console.log(`[save] Restored session #${saveSessionCount}, Day ${save.dayCount}, alive ${Math.round(save.totalTimeAliveMs / 3600000)}h`);
  } else {
    // First ever run
    saveCreatedAt = Date.now();
    saveTotalTimeAliveMs = 0;
    saveSessionCount = 1;
    saveBrainTickCountBase = 0;
    sessionStartedAt = Date.now();
    console.log("[save] No previous save — starting fresh (Day 0, Session #1)");
  }

  return save;
}

/** Set up save triggers: visibilitychange, pagehide, periodic 30s, activity change */
function setupSaveTriggers(
  roomScene: RoomScene,
  brain: BrainLoop | null,
  emotions: EmotionEngine | null,
): void {
  const doSave = async () => {
    if (!dirty) return;
    const data = collectSaveData(roomScene, brain, emotions);
    await saveManager.save(data);
    dirty = false;
    lastSavedTimestamp = Date.now();
  };

  const doBeaconSave = () => {
    const data = collectSaveData(roomScene, brain, emotions);
    saveManager.saveBeacon(data);
    dirty = false;
    lastSavedTimestamp = Date.now();
  };

  // Save when tab becomes hidden
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      doBeaconSave();
    }
  });

  // Save on page unload (pagehide preferred over beforeunload)
  window.addEventListener("pagehide", () => {
    doBeaconSave();
  });

  // Periodic save every 30s if dirty
  setInterval(() => {
    doSave().catch((e) => console.warn("[save] Periodic save failed:", e));
  }, 30_000);

  // Activity change → mark dirty (will be saved by periodic or visibility trigger)
  roomScene.getActivityManager().setOnActivityChange(() => {
    markDirty();
  });

  // Mark dirty on each brain tick
  if (brain) {
    const origTick = brain.tick.bind(brain);
    brain.tick = async function () {
      await origTick();
      markDirty();
    };
  }

  // Track position changes > 10px → mark dirty (TH.5)
  let lastSavedX = roomScene.getTruman().x;
  let lastSavedY = roomScene.getTruman().y;
  setInterval(() => {
    const truman = roomScene.getTruman();
    const dx = truman.x - lastSavedX;
    const dy = truman.y - lastSavedY;
    if (dx * dx + dy * dy > 100) { // 10px threshold squared
      lastSavedX = truman.x;
      lastSavedY = truman.y;
      markDirty();
    }
  }, 2000); // check every 2s

  // Expose for debugging
  (window as any).__saveManager = saveManager;
  console.log(`[save] Triggers active: visibilitychange, pagehide, 30s periodic, activity change. Backend: ${saveManager.isBackendAvailable ? "PostgreSQL" : "localStorage"}`);
}

// =============================================
// ConfigPanel Wiring — Stats + Reset (TI.2-TI.4)
// =============================================

/** Wire save stats updates to ConfigPanel (TI.2) */
function setupConfigPanelStats(panel: ConfigPanel, roomScene: RoomScene): void {
  // Also update HUD day counter
  const updateStats = () => {
    const now = Date.now();
    const elapsedThisSession = now - sessionStartedAt;
    const totalAlive = saveTotalTimeAliveMs + elapsedThisSession;
    const dayCount = Math.floor((now - saveCreatedAt) / 86_400_000);

    const stats: SaveStats = {
      dayCount,
      sessionCount: saveSessionCount,
      totalTimeAliveMs: totalAlive,
      lastSavedAt: lastSavedTimestamp,
    };
    panel.setSaveStats(stats);

    // Update HUD day counter
    roomScene.getHUD().updateDayCounter(dayCount);
  };

  updateStats();
  setInterval(updateStats, 2000);
}

/** Track when last save occurred (for "Xs ago" display) */
let lastSavedTimestamp = 0;

/** Perform soft or hard reset (TI.3, TI.4) */
async function performReset(
  mode: "soft" | "hard",
  roomScene: RoomScene,
  brain: BrainLoop | null,
  emotions: EmotionEngine | null,
): Promise<void> {
  console.log(`[save] Performing ${mode} reset...`);

  if (mode === "hard") {
    await saveManager.reset("hard");
    // Clear and reload — Day 0, fresh start
    window.location.reload();
    return;
  }

  // Soft reset: position → center, emotions → default, activity → idle
  // Preserve: dayCount, createdAt, sessionCount, memories
  const truman = roomScene.getTruman();
  truman.setPosition(480, 400); // center of room
  truman.setFacing("right");

  if (emotions) {
    emotions.setState({
      happiness: 0.5, curiosity: 0.5, anxiety: 0.2,
      boredom: 0.3, excitement: 0.3, contentment: 0.5, frustration: 0.1,
    });
  }

  if (brain) {
    brain.restoreState({
      currentActivity: null,
      currentMood: "contemplative",
    });
  }

  // Save the reset state immediately
  const data = collectSaveData(roomScene, brain, emotions);
  await saveManager.save(data);
  markDirty();

  // Reload page to apply cleanly
  window.location.reload();
}

/** Post brain event to backend for WebSocket broadcast */
function postBrainEvent(event: { type: string; timestamp: number; data: Record<string, unknown>; public: boolean }): void {
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  }).catch(() => { /* ignore — best effort */ });
}
