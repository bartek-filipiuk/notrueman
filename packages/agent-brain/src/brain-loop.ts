import type { ActivityType, ActionCommand } from "@nts/shared";
import { ACTIVITY_LIST } from "@nts/shared";
import type { LLMClient } from "./llm-client.js";
import type { RendererBridge } from "./renderer-bridge.js";
import { planNextAction } from "./action-planner.js";
import { generateThought } from "./thought-generator.js";
import { checkActivityFailure } from "./failure-mechanic.js";
import { getTimeOfDay, sleep } from "./utils.js";

export interface BrainLoopConfig {
  tickIntervalMs: number;   // 30000-60000 ms (base interval)
  failureRate: number;       // 0.0-1.0
  maxRetries: number;        // LLM retry count
  systemPrompt: string;
}

export interface BrainLoopState {
  isRunning: boolean;
  currentActivity: ActivityType | null;
  currentMood: string;
  recentActivities: Array<{ activity: ActivityType; completedSecondsAgo: number }>;
  tickCount: number;
  lastTickAt: Date | null;
  lastError: string | null;
  /** When the current activity started (ms timestamp) */
  currentActivityStartedAt: number | null;
  /** How long Truman plans to stay in the current activity (minutes) */
  currentActivityDuration: number | null;
  /** Whether Truman is in deep focus mode */
  inDeepFocus: boolean;
  /** Recent thoughts for context (last 3) */
  recentThoughts: string[];
  /** Last action command from LLM */
  lastAction: ActionCommand | null;
}

type LogFn = (level: "info" | "warn" | "error", message: string) => void;

const DEFAULT_LOG: LogFn = (level, message) => {
  const prefix = `[brain:${level}]`;
  if (level === "error") {
    console.error(prefix, message);
  } else if (level === "warn") {
    console.warn(prefix, message);
  } else {
    console.log(prefix, message);
  }
};

/** Deep focus tick interval (slower — less interruption) */
const DEEP_FOCUS_TICK_MS = 90_000;
/** Idle tick interval (faster — quick decision making) */
const IDLE_TICK_MS = 30_000;

/**
 * Main brain loop orchestrator.
 * Runs brain.tick() on an interval, commanding the renderer.
 */
export class BrainLoop {
  private client: LLMClient;
  private bridge: RendererBridge;
  private config: BrainLoopConfig;
  private state: BrainLoopState;
  private intervalHandle: ReturnType<typeof setTimeout> | null = null;
  private log: LogFn;

  constructor(
    client: LLMClient,
    bridge: RendererBridge,
    config: BrainLoopConfig,
    log: LogFn = DEFAULT_LOG,
  ) {
    this.client = client;
    this.bridge = bridge;
    this.config = config;
    this.log = log;
    this.state = {
      isRunning: false,
      currentActivity: null,
      currentMood: "contemplative",
      recentActivities: [],
      tickCount: 0,
      lastTickAt: null,
      lastError: null,
      currentActivityStartedAt: null,
      currentActivityDuration: null,
      inDeepFocus: false,
      recentThoughts: [],
      lastAction: null,
    };
  }

  /** Get the current dynamic tick interval based on deep focus state */
  private getTickInterval(): number {
    if (this.state.inDeepFocus) return DEEP_FOCUS_TICK_MS;
    if (!this.state.currentActivity) return IDLE_TICK_MS;
    return this.config.tickIntervalMs;
  }

  /** Schedule the next tick with dynamic interval */
  private scheduleNextTick(): void {
    if (!this.state.isRunning) return;
    if (this.intervalHandle) clearTimeout(this.intervalHandle);
    const interval = this.getTickInterval();
    this.intervalHandle = setTimeout(() => {
      void this.tick().then(() => this.scheduleNextTick());
    }, interval);
  }

  /** Start the brain loop */
  start(): void {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.log("info", `Brain loop started (base tick every ${this.config.tickIntervalMs}ms)`);

    // Run first tick immediately, then schedule dynamically
    void this.tick().then(() => this.scheduleNextTick());
  }

  /** Stop the brain loop */
  stop(): void {
    if (!this.state.isRunning) return;
    this.state.isRunning = false;
    if (this.intervalHandle) {
      clearTimeout(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.log("info", "Brain loop stopped");
  }

  /** Get current state (readonly copy) */
  getState(): Readonly<BrainLoopState> {
    return { ...this.state };
  }

  /** Restore partial state from persisted save (for recovery after refresh) */
  restoreState(partial: {
    tickCount?: number;
    currentActivity?: ActivityType | null;
    currentMood?: string;
    recentActivities?: Array<{ activity: ActivityType; completedSecondsAgo: number }>;
  }): void {
    if (partial.tickCount !== undefined) this.state.tickCount = partial.tickCount;
    if (partial.currentActivity !== undefined) this.state.currentActivity = partial.currentActivity;
    if (partial.currentMood !== undefined) this.state.currentMood = partial.currentMood;
    if (partial.recentActivities !== undefined) {
      this.state.recentActivities = [...partial.recentActivities];
    }
  }

  /** Execute a single brain tick with retry and fallback */
  async tick(): Promise<void> {
    this.state.tickCount++;
    this.state.lastTickAt = new Date();
    this.state.lastError = null;

    const timeOfDay = getTimeOfDay();

    // Calculate how long current activity has been going (in minutes)
    const currentActivityMinutes = this.state.currentActivityStartedAt
      ? Math.round((Date.now() - this.state.currentActivityStartedAt) / 60_000)
      : undefined;

    try {
      // 1. Plan next action (with retries)
      const action = await this.withRetry(() =>
        planNextAction(this.client, this.config.systemPrompt, {
          timeOfDay,
          currentMood: this.state.currentMood,
          recentActivities: this.state.recentActivities,
          recentThoughts: this.state.recentThoughts.length > 0 ? this.state.recentThoughts : undefined,
          currentActivity: this.state.currentActivity,
          currentActivityMinutes,
        }),
      );

      this.state.lastAction = action;

      // 2. Handle continue/switch logic
      if (action.continuePrevious && this.state.currentActivity) {
        // Deep focus: continue current activity
        this.state.inDeepFocus = true;
        if (action.durationMinutes) {
          this.state.currentActivityDuration = action.durationMinutes;
        }
        this.log("info", `Tick #${this.state.tickCount}: CONTINUE ${this.state.currentActivity} (deep focus, ${currentActivityMinutes ?? 0}m in)`);
      } else {
        // Switch to new activity
        this.state.inDeepFocus = false;
        this.state.currentActivityStartedAt = Date.now();
        this.state.currentActivityDuration = action.durationMinutes ?? null;
      }

      // 3. Generate thought
      const thought = await this.withRetry(() =>
        generateThought(this.client, this.config.systemPrompt, {
          activity: action.activity,
          mood: this.state.currentMood,
          timeOfDay,
          recentThought: this.state.recentThoughts[0],
        }),
      );

      // Track recent thoughts (keep last 3)
      this.state.recentThoughts.unshift(thought);
      if (this.state.recentThoughts.length > 3) {
        this.state.recentThoughts = this.state.recentThoughts.slice(0, 3);
      }

      // 4. Check for failure
      const failure = await checkActivityFailure(
        this.client,
        this.config.systemPrompt,
        action.activity,
        this.state.currentMood,
        { failureRate: this.config.failureRate },
      );

      // 5. Execute via renderer bridge
      const displayThought = failure.failed && failure.reaction
        ? failure.reaction
        : thought;

      await this.bridge.executeAction(
        action.activity,
        displayThought,
        this.state.currentMood,
      );

      // 6. Update state
      this.updateRecentActivities(action.activity);
      this.state.currentActivity = action.activity;

      this.log("info", `Tick #${this.state.tickCount}: ${action.activity}${failure.failed ? " (FAILED)" : ""}${this.state.inDeepFocus ? " [DEEP FOCUS]" : ""}`);
    } catch (error) {
      this.handleTickError(error);
    }
  }

  /** Retry an async operation with exponential backoff */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < this.config.maxRetries) {
          const delayMs = Math.pow(2, attempt) * 1000;
          this.log("warn", `Retry ${attempt + 1}/${this.config.maxRetries} after ${delayMs}ms`);
          await sleep(delayMs);
        }
      }
    }
    throw lastError;
  }

  /** Handle tick errors with fallback to random activity */
  private handleTickError(error: unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.state.lastError = errorMsg;
    this.log("error", `Tick #${this.state.tickCount} failed: ${errorMsg}`);

    // Fallback: random activity with neutral thought
    const fallbackActivity = ACTIVITY_LIST[
      Math.floor(Math.random() * ACTIVITY_LIST.length)
    ];

    void this.bridge.executeAction(
      fallbackActivity,
      "Hmm, let me just do something...",
      "neutral",
    ).catch((bridgeError) => {
      this.log("error", `Fallback also failed: ${bridgeError}`);
    });

    this.state.currentActivity = fallbackActivity;
    this.state.inDeepFocus = false;
  }

  /** Update recent activities list (keep last 10) */
  private updateRecentActivities(activity: ActivityType): void {
    // Age existing activities
    this.state.recentActivities = this.state.recentActivities.map((a) => ({
      ...a,
      completedSecondsAgo: a.completedSecondsAgo + this.getTickInterval() / 1000,
    }));

    // Add new one
    this.state.recentActivities.unshift({
      activity,
      completedSecondsAgo: 0,
    });

    // Keep last 10
    if (this.state.recentActivities.length > 10) {
      this.state.recentActivities = this.state.recentActivities.slice(0, 10);
    }
  }
}
