import type { ActivityType, ActionCommand } from "@nts/shared";
import { ACTIVITY_LIST } from "@nts/shared";
import type { LLMClient } from "./llm-client.js";
import type { RendererBridge } from "./renderer-bridge.js";
import { planNextAction } from "./action-planner.js";
import { generateThought } from "./thought-generator.js";
import { checkActivityFailure } from "./failure-mechanic.js";

export interface BrainLoopConfig {
  tickIntervalMs: number;   // 30000-60000 ms
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

/**
 * Main brain loop orchestrator.
 * Runs brain.tick() on an interval, commanding the renderer.
 */
export class BrainLoop {
  private client: LLMClient;
  private bridge: RendererBridge;
  private config: BrainLoopConfig;
  private state: BrainLoopState;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
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
    };
  }

  /** Start the brain loop */
  start(): void {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.log("info", `Brain loop started (tick every ${this.config.tickIntervalMs}ms)`);

    // Run first tick immediately
    void this.tick();

    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, this.config.tickIntervalMs);
  }

  /** Stop the brain loop */
  stop(): void {
    if (!this.state.isRunning) return;
    this.state.isRunning = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.log("info", "Brain loop stopped");
  }

  /** Get current state (readonly copy) */
  getState(): Readonly<BrainLoopState> {
    return { ...this.state };
  }

  /** Execute a single brain tick with retry and fallback */
  async tick(): Promise<void> {
    this.state.tickCount++;
    this.state.lastTickAt = new Date();
    this.state.lastError = null;

    const timeOfDay = getTimeOfDay();

    try {
      // 1. Plan next action (with retries)
      const action = await this.withRetry(() =>
        planNextAction(this.client, this.config.systemPrompt, {
          timeOfDay,
          currentMood: this.state.currentMood,
          recentActivities: this.state.recentActivities,
        }),
      );

      // 2. Generate thought
      const thought = await this.withRetry(() =>
        generateThought(this.client, this.config.systemPrompt, {
          activity: action.activity,
          mood: this.state.currentMood,
          timeOfDay,
        }),
      );

      // 3. Check for failure
      const failure = await checkActivityFailure(
        this.client,
        this.config.systemPrompt,
        action.activity,
        this.state.currentMood,
        { failureRate: this.config.failureRate },
      );

      // 4. Execute via renderer bridge
      const displayThought = failure.failed && failure.reaction
        ? failure.reaction
        : thought;

      await this.bridge.executeAction(
        action.activity,
        displayThought,
        this.state.currentMood,
      );

      // 5. Update state
      this.updateRecentActivities(action.activity);
      this.state.currentActivity = action.activity;

      this.log("info", `Tick #${this.state.tickCount}: ${action.activity}${failure.failed ? " (FAILED)" : ""}`);
    } catch (error) {
      this.handleTickError(error, timeOfDay);
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
  private handleTickError(error: unknown, timeOfDay: string): void {
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
  }

  /** Update recent activities list (keep last 10) */
  private updateRecentActivities(activity: ActivityType): void {
    // Age existing activities
    this.state.recentActivities = this.state.recentActivities.map((a) => ({
      ...a,
      completedSecondsAgo: a.completedSecondsAgo + this.config.tickIntervalMs / 1000,
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

/** Get human-readable time of day */
function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
