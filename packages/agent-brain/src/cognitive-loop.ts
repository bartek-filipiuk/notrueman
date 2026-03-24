import type { ActivityType, ActionCommand } from "@nts/shared";
import { ACTIVITY_LIST, REFLECTION_THRESHOLD } from "@nts/shared";
import type { LLMClient } from "./llm-client.js";
import type { RendererBridge } from "./renderer-bridge.js";
import { planWithMemoryContext } from "./memory-context.js";
import { planNextAction } from "./action-planner.js";
import { generateThought } from "./thought-generator.js";
import { checkActivityFailure } from "./failure-mechanic.js";
import { scoreImportance } from "./importance-scorer.js";
import { EmotionEngine } from "./emotion-engine.js";
import { getTimeOfDay, sleep } from "./utils.js";

type LogFn = (level: "info" | "warn" | "error", message: string) => void;

const DEFAULT_LOG: LogFn = (level, message) => {
  const prefix = `[cognitive:${level}]`;
  if (level === "error") console.error(prefix, message);
  else if (level === "warn") console.warn(prefix, message);
  else console.log(prefix, message);
};

/** Memory repository interface (subset needed by CognitiveLoop) */
export interface MemoryAdapter {
  createMemory(memory: {
    agentId: string;
    type: "observation" | "reflection" | "plan";
    description: string;
    embedding?: number[];
    importance: number;
    location?: string;
    emotionalContext?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }>;
  getRecentMemories(agentId: string, limit: number, type?: string): Promise<Array<{ id: string; description: string }>>;
}

/** Embedding client interface */
export interface EmbeddingAdapter {
  embed(text: string): Promise<number[]>;
}

/** Memory retrieval interface */
export interface RetrievalAdapter {
  retrieve(query: string, k?: number): Promise<Array<{ id: string; description: string; score: number }>>;
}

export interface CognitiveLoopConfig {
  tickIntervalMs: number;
  failureRate: number;
  maxRetries: number;
  systemPrompt: string;
  agentId: string;
  reflectionThreshold: number;
}

export interface CognitiveLoopDeps {
  llm: LLMClient;
  bridge: RendererBridge;
  memory: MemoryAdapter;
  embedding: EmbeddingAdapter;
  retrieval: RetrievalAdapter;
  config: CognitiveLoopConfig;
  log?: LogFn;
}

export interface CognitiveLoopState {
  isRunning: boolean;
  currentActivity: ActivityType | null;
  currentMood: string;
  recentActivities: Array<{ activity: ActivityType; completedSecondsAgo: number }>;
  tickCount: number;
  lastTickAt: Date | null;
  lastError: string | null;
  importanceAccumulator: number;
}

/**
 * Full cognitive loop: Observe → Retrieve → Plan → Act → Speak → Store.
 * Sequential processing (tick lock prevents overlap).
 * Configurable tick interval.
 */
export class CognitiveLoop {
  private llm: LLMClient;
  private bridge: RendererBridge;
  private memory: MemoryAdapter;
  private embedding: EmbeddingAdapter;
  private retrieval: RetrievalAdapter;
  private config: CognitiveLoopConfig;
  private log: LogFn;
  private emotionEngine: EmotionEngine;

  private state: CognitiveLoopState;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private tickLock = false;

  constructor(deps: CognitiveLoopDeps) {
    this.llm = deps.llm;
    this.bridge = deps.bridge;
    this.memory = deps.memory;
    this.embedding = deps.embedding;
    this.retrieval = deps.retrieval;
    this.config = deps.config;
    this.log = deps.log ?? DEFAULT_LOG;
    this.emotionEngine = new EmotionEngine();

    this.state = {
      isRunning: false,
      currentActivity: null,
      currentMood: "contemplative",
      recentActivities: [],
      tickCount: 0,
      lastTickAt: null,
      lastError: null,
      importanceAccumulator: 0,
    };
  }

  /** Start the cognitive loop */
  start(): void {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.log("info", `Cognitive loop started (tick every ${this.config.tickIntervalMs}ms)`);

    void this.tick();

    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, this.config.tickIntervalMs);
  }

  /** Stop the cognitive loop */
  stop(): void {
    if (!this.state.isRunning) return;
    this.state.isRunning = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.log("info", "Cognitive loop stopped");
  }

  /** Get current state (readonly copy) */
  getState(): Readonly<CognitiveLoopState> {
    return { ...this.state };
  }

  /** Get current config */
  getConfig(): Readonly<CognitiveLoopConfig> {
    return { ...this.config };
  }

  /** Update config at runtime (for hot-reload) */
  updateConfig(partial: Partial<CognitiveLoopConfig>): void {
    Object.assign(this.config, partial);
  }

  /** Execute a single cognitive tick (with lock to prevent overlap) */
  async tick(): Promise<void> {
    // Sequential processing: skip if previous tick still running
    if (this.tickLock) {
      this.log("warn", "Tick skipped — previous tick still running");
      return;
    }

    this.tickLock = true;
    try {
      await this.executeTick();
    } finally {
      this.tickLock = false;
    }
  }

  private async executeTick(): Promise<void> {
    this.state.tickCount++;
    this.state.lastTickAt = new Date();
    this.state.lastError = null;

    const timeOfDay = getTimeOfDay();

    try {
      // 1. OBSERVE — create observation from previous action (if any)
      if (this.state.currentActivity) {
        await this.storeObservation(
          `I was ${this.state.currentActivity}. ${timeOfDay} time.`,
        );
      }

      // 2. RETRIEVE — fetch relevant memories
      const contextQuery = `${this.state.currentActivity ?? "idle"} ${this.state.currentMood} ${timeOfDay}`;
      let retrievedMemories: string[] = [];
      try {
        const results = await this.retrieval.retrieve(contextQuery, 20);
        retrievedMemories = results.map((r) => r.description);
      } catch (err) {
        this.log("warn", `Memory retrieval failed, continuing without context: ${err}`);
      }

      // 3. PLAN — decide next action (with memory context)
      const action = await this.withRetry(() =>
        planWithMemoryContext(this.llm, this.config.systemPrompt, {
          timeOfDay,
          currentMood: this.state.currentMood,
          recentActivities: this.state.recentActivities,
          memories: retrievedMemories,
        }),
      );

      // 4. Generate thought
      const thought = await this.withRetry(() =>
        generateThought(this.llm, this.config.systemPrompt, {
          activity: action.activity,
          mood: this.state.currentMood,
          timeOfDay,
        }),
      );

      // 5. Check for failure
      const failure = await checkActivityFailure(
        this.llm,
        this.config.systemPrompt,
        action.activity,
        this.state.currentMood,
        { failureRate: this.config.failureRate },
      );

      const displayThought = failure.failed && failure.reaction
        ? failure.reaction
        : thought;

      // 6. ACT — execute via renderer bridge
      await this.bridge.executeAction(
        action.activity,
        displayThought,
        this.state.currentMood,
      );

      // 7. STORE — record what happened as observation
      const observationText = failure.failed
        ? `I tried ${action.activity} but it failed. ${displayThought}`
        : `I ${action.activity}. ${thought}`;

      await this.storeObservation(observationText);

      // 8. UPDATE STATE
      this.updateRecentActivities(action.activity);
      this.state.currentActivity = action.activity;

      // Update emotions
      this.emotionEngine.applyTimeDrift();
      if (failure.failed) {
        this.emotionEngine.applyDelta({ frustration: 0.08, happiness: -0.03 });
      } else {
        this.emotionEngine.applyDelta({ happiness: 0.03, contentment: 0.02 });
      }
      this.state.currentMood = this.emotionEngine.getOverallMood();

      this.log(
        "info",
        `Tick #${this.state.tickCount}: ${action.activity}${failure.failed ? " (FAILED)" : ""} [mood: ${this.state.currentMood}]`,
      );
    } catch (error) {
      this.handleTickError(error, timeOfDay);
    }
  }

  /** Store an observation in memory with importance scoring and embedding */
  private async storeObservation(description: string): Promise<void> {
    try {
      // Score importance
      let importance = 5;
      try {
        importance = await scoreImportance(this.llm, description);
      } catch {
        // Default importance if scoring fails
      }

      this.state.importanceAccumulator += importance;

      // Generate embedding
      let embedding: number[] | undefined;
      try {
        embedding = await this.embedding.embed(description);
      } catch {
        // Continue without embedding if service unavailable
      }

      await this.memory.createMemory({
        agentId: this.config.agentId,
        type: "observation",
        description,
        embedding,
        importance,
        emotionalContext: { ...this.emotionEngine.getState() } as Record<string, unknown>,
      });
    } catch (err) {
      this.log("warn", `Failed to store observation: ${err}`);
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

  /** Update recent activities list (keep last 20) */
  private updateRecentActivities(activity: ActivityType): void {
    this.state.recentActivities = this.state.recentActivities.map((a) => ({
      ...a,
      completedSecondsAgo: a.completedSecondsAgo + this.config.tickIntervalMs / 1000,
    }));

    this.state.recentActivities.unshift({ activity, completedSecondsAgo: 0 });

    if (this.state.recentActivities.length > 20) {
      this.state.recentActivities = this.state.recentActivities.slice(0, 20);
    }
  }
}

