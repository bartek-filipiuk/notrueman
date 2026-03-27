import type { ActivityType, ActionCommand } from "@nts/shared";
import { ACTIVITY_LIST } from "@nts/shared";
import type { LLMClient } from "./llm-client.js";
import type { RendererBridge } from "./renderer-bridge.js";
import { planNextAction } from "./action-planner.js";
import { generateThought } from "./thought-generator.js";
import { checkActivityFailure } from "./failure-mechanic.js";
import { getTimeOfDay, sleep } from "./utils.js";

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
  currentActivityStartedAt: number | null;
  currentActivityDurationMin: number;
  recentThoughts: string[];
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

/** Tick interval constants */
const DEEP_FOCUS_TICK_MS = 90_000;  // 90s when in deep focus
const IDLE_TICK_MS = 30_000;         // 30s when idle
const DEFAULT_TICK_MS = 45_000;      // 45s default

/**
 * Main brain loop orchestrator.
 * Runs brain.tick() on a dynamic interval, commanding the renderer.
 * Supports deep focus (continue/switch) and dynamic tick intervals.
 */
export class BrainLoop {
  private client: LLMClient;
  private bridge: RendererBridge;
  private config: BrainLoopConfig;
  private state: BrainLoopState;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private log: LogFn;
  /** Recent memories fetched from backend, injected externally */
  recentMemories: string[] = [];

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
      currentActivityDurationMin: 0,
      recentThoughts: [],
      lastAction: null,
    };
  }

  /** Calculate the next tick interval based on current state */
  private getNextTickInterval(): number {
    if (!this.state.currentActivity) {
      return IDLE_TICK_MS;
    }
    // Deep focus: if activity has been going for > 2 minutes, use longer interval
    if (this.state.currentActivityStartedAt) {
      const elapsed = (Date.now() - this.state.currentActivityStartedAt) / 60_000;
      if (elapsed > 2) {
        return DEEP_FOCUS_TICK_MS;
      }
    }
    return DEFAULT_TICK_MS;
  }

  /** Schedule the next tick with dynamic interval */
  private scheduleNextTick(): void {
    if (!this.state.isRunning) return;
    const interval = this.getNextTickInterval();
    this.timeoutHandle = setTimeout(() => {
      void this.tick().then(() => this.scheduleNextTick());
    }, interval);
  }

  /** Start the brain loop */
  start(): void {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    const interval = this.getNextTickInterval();
    this.log("info", `Brain loop started (initial tick interval ${interval}ms)`);

    // Run first tick immediately, then schedule next
    void this.tick().then(() => this.scheduleNextTick());
  }

  /** Stop the brain loop */
  stop(): void {
    if (!this.state.isRunning) return;
    this.state.isRunning = false;
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    this.log("info", "Brain loop stopped");
  }

  /** Get current state (readonly copy) */
  getState(): Readonly<BrainLoopState> {
    return { ...this.state };
  }

  /** Restore state from persistence (for recovery after refresh) */
  restoreState(partial: {
    tickCount?: number;
    currentActivity?: ActivityType | null;
    currentMood?: string;
    recentActivities?: Array<{ activity: ActivityType; completedSecondsAgo: number }>;
  }): void {
    if (partial.tickCount !== undefined) this.state.tickCount = partial.tickCount;
    if (partial.currentActivity !== undefined) this.state.currentActivity = partial.currentActivity;
    if (partial.currentMood !== undefined) this.state.currentMood = partial.currentMood;
    if (partial.recentActivities !== undefined) this.state.recentActivities = [...partial.recentActivities];
  }

  /** Execute a single brain tick with retry and fallback */
  async tick(): Promise<void> {
    this.state.tickCount++;
    this.state.lastTickAt = new Date();
    this.state.lastError = null;

    const timeOfDay = getTimeOfDay();

    try {
      // 1. Plan next action (with retries) — include rich context
      const action = await this.withRetry(() =>
        planNextAction(this.client, this.config.systemPrompt, {
          timeOfDay,
          currentMood: this.state.currentMood,
          recentActivities: this.state.recentActivities,
          currentActivity: this.state.currentActivity,
          currentActivityDurationMin: this.state.currentActivityDurationMin,
          recentThoughts: this.state.recentThoughts.slice(-3),
          recentMemories: this.recentMemories,
        }),
      );

      // Store last action for external access (tool calling, memory posting)
      this.state.lastAction = action;

      // 2. Handle continue/switch logic
      const isContinuing = action.continuePrevious === true && this.state.currentActivity != null;

      if (isContinuing) {
        // Deep focus: stay in current activity, update duration
        if (this.state.currentActivityStartedAt) {
          this.state.currentActivityDurationMin = Math.round(
            (Date.now() - this.state.currentActivityStartedAt) / 60_000
          );
        }
        if (action.durationMinutes) {
          // LLM requested a specific duration extension
          this.log("info", `Tick #${this.state.tickCount}: continuing ${this.state.currentActivity} (deep focus, +${action.durationMinutes}min)`);
        } else {
          this.log("info", `Tick #${this.state.tickCount}: continuing ${this.state.currentActivity} (deep focus)`);
        }
      } else {
        // Switching activity
        this.state.currentActivityStartedAt = Date.now();
        this.state.currentActivityDurationMin = 0;
      }

      // 3. Generate thought with recent context
      const thought = await this.withRetry(() =>
        generateThought(this.client, this.config.systemPrompt, {
          activity: isContinuing ? (this.state.currentActivity ?? action.activity) : action.activity,
          mood: this.state.currentMood,
          timeOfDay,
          recentThought: this.state.recentThoughts[this.state.recentThoughts.length - 1],
        }),
      );

      // Track recent thoughts (keep last 5)
      this.state.recentThoughts.push(thought);
      if (this.state.recentThoughts.length > 5) {
        this.state.recentThoughts = this.state.recentThoughts.slice(-5);
      }

      // 4. Check for failure (only on new activities, not on continues)
      let displayThought = thought;
      if (!isContinuing) {
        const failure = await checkActivityFailure(
          this.client,
          this.config.systemPrompt,
          action.activity,
          this.state.currentMood,
          { failureRate: this.config.failureRate },
        );
        if (failure.failed && failure.reaction) {
          displayThought = failure.reaction;
        }
      }

      // 5. Execute via renderer bridge (only if switching)
      if (!isContinuing) {
        await this.bridge.executeAction(
          action.activity,
          displayThought,
          this.state.currentMood,
        );
      } else {
        // For continues, still show the new thought
        await this.bridge.executeAction(
          this.state.currentActivity!,
          displayThought,
          this.state.currentMood,
        );
      }

      // 6. Update state
      const effectiveActivity = isContinuing ? this.state.currentActivity! : action.activity;
      if (!isContinuing) {
        this.updateRecentActivities(action.activity);
      }
      this.state.currentActivity = effectiveActivity;

      this.log("info", `Tick #${this.state.tickCount}: ${effectiveActivity}${isContinuing ? " (continuing)" : ""}`);
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
  private handleTickError(error: unknown, _timeOfDay: string): void {
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
    this.state.currentActivityStartedAt = Date.now();
    this.state.currentActivityDurationMin = 0;
  }

  /** Update recent activities list (keep last 10) */
  private updateRecentActivities(activity: ActivityType): void {
    // Age existing activities
    const interval = this.getNextTickInterval();
    this.state.recentActivities = this.state.recentActivities.map((a) => ({
      ...a,
      completedSecondsAgo: a.completedSecondsAgo + interval / 1000,
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
