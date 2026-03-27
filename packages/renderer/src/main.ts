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
  PhysicalStateEngine,
} from "@nts/agent-brain";
import { ConfigPanel } from "./ui/ConfigPanel";
import { TTSManager, getTTSConfigFromURL } from "./systems/TTSManager";
import { SaveManager } from "./systems/SaveManager";
import PERSONALITY from "../../../config/truman-personality.md?raw";

/** Read API key from URL params (?apiKey=sk-or-...) or empty string */
function getApiKey(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("apiKey") || "";
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: "game-container",
  pixelArt: false,
  antialias: true,
  roundPixels: false,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#d4c0a0",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
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
    // RoomScene starts after BootScene transition (1s delay)
    setTimeout(async () => {
      // Init save manager + load existing save before brain starts
      const save = await initSaveManager();

      // TH.1 + TH.2: Recover renderer state from save before brain init
      const roomScene = game.scene.getScene("RoomScene") as RoomScene;
      if (save && roomScene) {
        recoverRenderer(roomScene, save);
      }

      initBrain(game, save);
    }, 1500);
  });
}

// Gate game creation on user interaction (audio autoplay policy)
const overlay = document.getElementById("start-overlay");
if (overlay) {
  overlay.addEventListener("click", startGame, { once: true });
  overlay.addEventListener("touchstart", startGame, { once: true });
} else {
  startGame();
}

function initBrain(game: Phaser.Game, save: SaveData | null = null): void {
  const roomScene = game.scene.getScene("RoomScene") as RoomScene;
  if (!roomScene) {
    console.warn("[main] RoomScene not found, retrying in 1s...");
    setTimeout(() => initBrain(game, save), 1000);
    return;
  }

  const apiKey = getApiKey();

  if (!apiKey) {
    console.log("[main] No API key provided — running in DEMO mode");
    console.log("[main] Add ?apiKey=sk-or-... to URL for AI mode");
    // Demo mode: ActivityManager hardcoded loop already running from RoomScene.create()
    new ConfigPanel(() => ({ mode: "demo", tickCount: 0, currentActivity: "cycling", currentMood: "neutral" }));
    // Save triggers for demo mode too
    setupSaveTriggers(roomScene, null, null);
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

  // Create physical state engine
  const physicalState = new PhysicalStateEngine();

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
    tickIntervalMs: 30000,
    failureRate: 0.25,
    maxRetries: 2,
    systemPrompt: PERSONALITY,
  });

  // Patch bridge.executeAction to sometimes produce speech bubbles (30% chance)
  // Per visual-spec S7.1: speech = speaking aloud (with TTS), thought = internal monologue
  const originalExecuteAction = bridge.executeAction.bind(bridge);
  bridge.executeAction = async function (activity, thought, mood) {
    // Override: randomly make some thoughts into spoken-aloud speech
    if (thought && ttsManager.isEnabled() && Math.random() < 0.3) {
      // Execute everything except bubble, then show speech bubble
      await bridge.executeCommand({ type: "update_hud", payload: { activity, mood } });
      const objectId = RendererBridge.getObjectForActivity(activity);
      await bridge.executeCommand({ type: "move_to", payload: { objectId } });
      await bridge.executeCommand({ type: "play_animation", payload: { state: activity } });
      await bridge.executeCommand({ type: "show_bubble", payload: { text: thought, type: "speech", mood } });
    } else {
      await originalExecuteAction(activity, thought, mood);
    }
  };

  // After each tick, update emotions based on activity outcome
  const originalTick = brain.tick.bind(brain);
  brain.tick = async function () {
    // Apply time drift before tick
    emotions.applyTimeDrift();

    // TZ.6: Fetch recent memories before planning
    let recentMemoryDescriptions: string[] = [];
    try {
      const memRes = await fetch("/api/recent-memories?limit=5");
      if (memRes.ok) {
        const memData = await memRes.json() as { memories: Array<{ description: string }> };
        recentMemoryDescriptions = (memData.memories ?? []).map((m) => m.description);
      }
    } catch {
      console.debug("[memory] Failed to fetch recent memories");
    }

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

    // TZ.4: Tool calling — if activity is computer/draw/think and toolRequest present
    const lastAction = state.lastAction;
    let toolResultsSummary: string | undefined;
    if (
      lastAction?.toolRequest &&
      ["computer", "draw", "think"].includes(state.currentActivity ?? "")
    ) {
      const { tool, input } = lastAction.toolRequest;
      try {
        if (tool === "web_search") {
          const searchRes = await fetch("/api/tool/web-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: input, count: 5 }),
          });
          if (searchRes.ok) {
            const searchData = await searchRes.json() as { results: Array<{ title: string; description: string }> };
            toolResultsSummary = searchData.results.map((r) => `${r.title}: ${r.description}`).join(" | ");
            console.log(`[tool] Web search for "${input}": ${searchData.results.length} results`);
          }
        }
        // TZ.7: Creative output posting
        if (tool === "write_blog" || tool === "create_artwork") {
          await fetch("/api/observation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: `Creative output: [${tool}] ${input}`,
              importance: 8,
              emotionalContext: emotions.getState(),
              metadata: { tool, title: input, activity: state.currentActivity },
            }),
          }).catch(() => {});
          console.log(`[tool] Creative output: ${tool} — "${input}"`);
        }
      } catch (e) {
        console.debug("[tool] Tool call failed:", e);
      }
    }

    // TZ.5: Post observation memory for this tick
    const tickDescription = `Tick #${state.tickCount}: ${state.currentActivity ?? "idle"} — ${state.recentThoughts?.[0] ?? "..."}${state.inDeepFocus ? " [DEEP FOCUS]" : ""}${toolResultsSummary ? ` [searched: ${toolResultsSummary.slice(0, 100)}]` : ""}`;
    fetch("/api/observation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: tickDescription,
        importance: 5,
        emotionalContext: emotions.getState(),
        metadata: {
          activity: state.currentActivity,
          tickCount: state.tickCount,
          toolResults: toolResultsSummary,
          inDeepFocus: state.inDeepFocus,
          recentMemories: recentMemoryDescriptions.length,
        },
      }),
    }).catch((e) => console.debug("[memory] POST observation failed:", e?.message || e));
  };

  // TH.3 + TH.4: Recover brain state from save
  if (save) {
    recoverBrain(brain, emotions, physicalState, save);
  }

  brain.start();

  // Expose for debugging
  (window as any).__brain = brain;
  (window as any).__bridge = bridge;
  (window as any).__emotions = emotions;
  (window as any).__tts = ttsManager;

  // Config panel (toggle with ~ key)
  new ConfigPanel(() => ({
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

  const ttsStatus = ttsManager.isEnabled()
    ? `TTS enabled (voice: ${ttsManager.getVoice()})`
    : "TTS disabled (add ?tts=on&openaiKey=sk-... to enable)";
  console.log(`[main] Brain loop started with emotion engine. ${ttsStatus}. Press ~ for debug panel.`);

  // --- State persistence (TG.4 + TG.5) ---
  setupSaveTriggers(roomScene, brain, emotions);
}

// =============================================
// Recovery — Restore state from save (TH.1-TH.4)
// =============================================

/** TH.2: Restore renderer position and facing from save */
function recoverRenderer(roomScene: RoomScene, save: SaveData): void {
  const truman = roomScene.getTruman();
  truman.setPosition(save.truman.x, save.truman.y);
  truman.setFacing(save.truman.facing);
  console.log(`[recovery] Renderer: position (${save.truman.x}, ${save.truman.y}), facing ${save.truman.facing}`);
}

/** TH.3 + TH.4: Restore brain/emotion/physical state + offline compensation */
function recoverBrain(
  brain: BrainLoop,
  emotions: EmotionEngine,
  physicalState: PhysicalStateEngine,
  save: SaveData,
): void {
  // Restore emotions
  emotions.setState(save.emotions);

  // Restore physical state
  physicalState.setState(save.physicalState);

  // Restore brain loop state
  const recentActivities = save.recentActivities.map((ra) => ({
    activity: ra.type as import("@nts/shared").ActivityType,
    completedSecondsAgo: Math.round((Date.now() - ra.at) / 1000),
  }));
  brain.restoreState({
    tickCount: save.brainTickCount,
    currentActivity: save.truman.currentActivity,
    currentMood: save.truman.currentMood,
    recentActivities,
  });

  // TH.4: Offline time compensation
  const elapsedMs = Date.now() - save.savedAt;
  const elapsedHours = elapsedMs / 3_600_000;

  if (elapsedHours > 0.01) { // more than ~36 seconds offline
    // Physical state drift
    physicalState.applyTimeDrift(elapsedHours);

    // Emotion drift toward defaults
    emotions.applyTimeDrift();

    // If offline > 8h, Truman "slept" — reset tiredness
    if (elapsedHours > 8) {
      const ps = physicalState.getState();
      physicalState.setState({ ...ps, tiredness: 0.1 });
      // Also reduce hunger slightly (Truman would eat)
      if (ps.hunger > 0.5) {
        physicalState.setState({ ...physicalState.getState(), hunger: 0.3 });
      }
      console.log(`[recovery] Offline ${elapsedHours.toFixed(1)}h — Truman slept (tiredness reset)`);
    } else {
      console.log(`[recovery] Offline ${elapsedHours.toFixed(1)}h — drift applied`);
    }
  }

  console.log(`[recovery] Brain: tick #${save.brainTickCount}, mood ${save.truman.currentMood}, ${recentActivities.length} recent activities`);
}

// =============================================
// State Persistence — Save triggers + Day counter
// =============================================

/** Global save manager instance */
const saveManager = new SaveManager();

/** Track dirty state to avoid unnecessary saves (TH.5) */
let dirty = false;

/** Last saved position for dirty detection (TH.5) */
let lastSavedX = 0;
let lastSavedY = 0;

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
    // TH.5: Initialize position tracking from save
    lastSavedX = save.truman.x;
    lastSavedY = save.truman.y;
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
    lastSavedX = data.truman.x;
    lastSavedY = data.truman.y;
  };

  const doBeaconSave = () => {
    const data = collectSaveData(roomScene, brain, emotions);
    saveManager.saveBeacon(data);
    dirty = false;
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

  // TH.6: Activity change → mark dirty + trigger save
  roomScene.getActivityManager().setOnActivityChange(() => {
    markDirty();
    doSave().catch((e) => console.warn("[save] Activity-change save failed:", e));
  });

  // Mark dirty on each brain tick
  if (brain) {
    const origTick = brain.tick.bind(brain);
    brain.tick = async function () {
      await origTick();
      markDirty();
    };
  }

  // TH.5: Position-based dirty detection (check every 2s)
  setInterval(() => {
    const truman = roomScene.getTruman();
    const dx = truman.x - lastSavedX;
    const dy = truman.y - lastSavedY;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      markDirty();
    }
  }, 2000);

  // Expose for debugging
  (window as any).__saveManager = saveManager;
  console.log(`[save] Triggers active: visibilitychange, pagehide, 30s periodic, activity change. Backend: ${saveManager.isBackendAvailable ? "PostgreSQL" : "localStorage"}`);
}
