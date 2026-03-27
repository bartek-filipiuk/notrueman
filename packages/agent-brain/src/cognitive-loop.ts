import { EventEmitter } from "node:events";
import type { ActivityType, ActionCommand, MindFeedEvent, MindFeedEventType } from "@nts/shared";
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
import type { ToolRegistry } from "./tools/tool-registry.js";
import type { BudgetManager } from "./tools/budget-manager.js";

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
  toolRegistry?: ToolRegistry;
  budgetManager?: BudgetManager;
  interests?: string[];
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
export class CognitiveLoop extends EventEmitter {
  private llm: LLMClient;
  private bridge: RendererBridge;
  private memory: MemoryAdapter;
  private embedding: EmbeddingAdapter;
  private retrieval: RetrievalAdapter;
  private config: CognitiveLoopConfig;
  private log: LogFn;
  private emotionEngine: EmotionEngine;
  private toolRegistry?: ToolRegistry;
  private budgetManager?: BudgetManager;
  private interests: string[];

  private state: CognitiveLoopState;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private tickLock = false;

  constructor(deps: CognitiveLoopDeps) {
    super();
    this.llm = deps.llm;
    this.bridge = deps.bridge;
    this.memory = deps.memory;
    this.embedding = deps.embedding;
    this.retrieval = deps.retrieval;
    this.config = deps.config;
    this.log = deps.log ?? DEFAULT_LOG;
    this.emotionEngine = new EmotionEngine();
    this.toolRegistry = deps.toolRegistry;
    this.budgetManager = deps.budgetManager;
    this.interests = deps.interests ?? [];

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

  /** Emit a MindFeedEvent to all listeners */
  emitMindFeedEvent(
    type: MindFeedEventType,
    data: Record<string, unknown>,
    isPublic: boolean,
  ): void {
    const event: MindFeedEvent = {
      type,
      timestamp: Date.now(),
      data,
      public: isPublic,
    };
    this.emit("mindFeedEvent", event);
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

      // 2.5. TOOLS — use tools if available for current activity (TK.1)
      let toolContext = "";
      if (this.toolRegistry && this.budgetManager && this.state.currentActivity) {
        toolContext = await this.useToolsForActivity(this.state.currentActivity, retrievedMemories);
      }

      // Build enhanced system prompt with interests (TK.2)
      const systemPrompt = this.buildSystemPrompt();

      // 3. PLAN — decide next action (with memory context + tool results)
      const memoriesWithTools = toolContext
        ? [...retrievedMemories, `[Tool results] ${toolContext}`]
        : retrievedMemories;

      const action = await this.withRetry(() =>
        planWithMemoryContext(this.llm, systemPrompt, {
          timeOfDay,
          currentMood: this.state.currentMood,
          recentActivities: this.state.recentActivities,
          memories: memoriesWithTools,
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

      // Emit thought event
      this.emitMindFeedEvent("thought", { text: thought }, true);

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
      const prevActivity = this.state.currentActivity;
      this.updateRecentActivities(action.activity);
      this.state.currentActivity = action.activity;

      // Emit activity_change if activity changed
      if (prevActivity !== action.activity) {
        this.emitMindFeedEvent(
          "activity_change",
          { activity: action.activity, prevActivity: prevActivity ?? "idle" },
          true,
        );
      }

      // Update emotions
      const prevMood = this.state.currentMood;
      this.emotionEngine.applyTimeDrift();
      if (failure.failed) {
        this.emotionEngine.applyDelta({ frustration: 0.08, happiness: -0.03 });
      } else {
        this.emotionEngine.applyDelta({ happiness: 0.03, contentment: 0.02 });
      }
      this.state.currentMood = this.emotionEngine.getOverallMood();

      // Emit mood_change if mood changed
      if (prevMood !== this.state.currentMood) {
        this.emitMindFeedEvent(
          "mood_change",
          { mood: this.state.currentMood, prevMood },
          true,
        );
      }

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

      // Emit reflection event when threshold reached
      if (this.state.importanceAccumulator >= this.config.reflectionThreshold) {
        this.emitMindFeedEvent(
          "reflection",
          { insight: description, importance, accumulator: this.state.importanceAccumulator },
          true,
        );
        this.state.importanceAccumulator = 0;
      }

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

  /** Build system prompt with interests (TK.2) */
  private buildSystemPrompt(): string {
    if (this.interests.length === 0) return this.config.systemPrompt;
    const interestsList = this.interests.join(", ");
    return `${this.config.systemPrompt}\n\nYou are curious about: ${interestsList}. Use available tools when relevant. At computer: write blog posts. While drawing: create artwork concepts.`;
  }

  /** Use tools available for the current activity (TK.1) */
  private async useToolsForActivity(
    activity: ActivityType,
    _memories: string[],
  ): Promise<string> {
    if (!this.toolRegistry || !this.budgetManager) return "";
    if (!this.budgetManager.isWithinBudget()) {
      this.log("info", "[BUDGET] No budget remaining — skipping tools");
      return "";
    }

    const tools = this.toolRegistry.getToolsForActivity(activity);
    if (Object.keys(tools).length === 0) return "";

    try {
      const result = await this.llm.generateWithTools({
        prompt: `You are currently doing: ${activity}. Your mood is ${this.state.currentMood}. Use available tools if relevant to what you're doing. Be concise.`,
        model: "think",
        system: this.buildSystemPrompt(),
        tools,
        maxToolRoundtrips: 2,
      });

      // Track budget for each tool call (TK.5)
      for (const tc of result.toolCalls) {
        const tracked = this.budgetManager.trackCall(tc.toolName);
        if (!tracked) break;
        this.log("info", `[TOOL] ${tc.toolName} called`);
        // Emit tool_call event (public gets tool name + topic only)
        this.emitMindFeedEvent(
          "tool_call",
          { tool: tc.toolName, topic: String((tc.args as Record<string, unknown>)?.topic ?? ""), args: tc.args },
          true,
        );
      }

      // Store tool results in memory (TK.3)
      for (const tr of result.toolResults) {
        const importance = (tr.toolName === "write_blog_post" || tr.toolName === "create_artwork") ? 8 : 4;
        const description = `Used tool ${tr.toolName}: ${JSON.stringify(tr.result).slice(0, 500)}`;
        await this.storeToolObservation(description, importance, result.toolCalls);

        // Emit blog/artwork creation events
        if (tr.toolName === "write_blog_post") {
          const res = tr.result as Record<string, unknown>;
          this.emitMindFeedEvent(
            "blog_created",
            { title: res?.title ?? "Untitled", tags: res?.tags ?? [], content: res?.content ?? "" },
            true,
          );
        } else if (tr.toolName === "create_artwork") {
          const res = tr.result as Record<string, unknown>;
          this.emitMindFeedEvent(
            "artwork_created",
            { title: res?.title ?? "Untitled", style: res?.style ?? "", description: res?.description ?? "" },
            true,
          );
        }
      }

      // Log budget status (TK.5)
      const budget = this.budgetManager.getRemainingBudget();
      this.log("info", `[BUDGET] ${budget.callsLeft}/${budget.totalCalls} calls remaining`);

      return result.text || "";
    } catch (err) {
      this.log("warn", `Tool calling failed: ${err}`);
      return "";
    }
  }

  /** Store a tool observation in memory (TK.3) */
  private async storeToolObservation(
    description: string,
    importance: number,
    toolCalls: Array<{ toolName: string; args: unknown }>,
  ): Promise<void> {
    try {
      let embedding: number[] | undefined;
      try {
        embedding = await this.embedding.embed(description);
      } catch {
        // Continue without embedding
      }

      await this.memory.createMemory({
        agentId: this.config.agentId,
        type: "observation",
        description,
        embedding,
        importance,
        emotionalContext: { ...this.emotionEngine.getState() } as Record<string, unknown>,
        metadata: {
          toolCalls: toolCalls.map((tc) => ({
            tool: tc.toolName,
            input: tc.args,
          })),
        },
      });
    } catch (err) {
      this.log("warn", `Failed to store tool observation: ${err}`);
    }
  }

  /** Get current interests */
  getInterests(): string[] {
    return [...this.interests];
  }

  /** Update interests (TK.4 — called after reflection) */
  setInterests(newInterests: string[]): void {
    this.interests = newInterests.slice(0, 10);
  }

  /** Update recent activities list (keep last 20). Mutates in place to avoid GC. */
  private updateRecentActivities(activity: ActivityType): void {
    const tickSeconds = this.config.tickIntervalMs / 1000;
    for (const a of this.state.recentActivities) {
      a.completedSecondsAgo += tickSeconds;
    }

    this.state.recentActivities.unshift({ activity, completedSecondsAgo: 0 });

    if (this.state.recentActivities.length > 20) {
      this.state.recentActivities.length = 20;
    }
  }
}

