# API Reference

## Brain -> Renderer Interface

The `RendererBridge` translates brain decisions into renderer commands using the `RendererCommands` interface:

| Command | Payload | Description |
|---|---|---|
| `move_to` | `{ objectId }` | Move Truman to a room object |
| `play_animation` | `{ state }` | Play an activity animation |
| `show_bubble` | `{ text, type, mood }` | Show a thought/speech bubble |
| `update_hud` | `{ mood?, activity?, time? }` | Update HUD display |
| `set_object_state` | `{ objectId, state }` | Change object visual state |

### RendererHandler Interface

```typescript
interface RendererHandler {
  moveTo(objectId: InteractiveObjectId): Promise<void>;
  playActivity(activity: string): void;
  showThought(text: string, mood: string): void;
  updateHUD(update: { mood?: string; activity?: string; time?: string }): void;
}
```

### High-Level Action Execution

`RendererBridge.executeAction(activity, thought, mood)` orchestrates:
1. Update HUD with activity and mood
2. Move Truman to the target object
3. Play activity animation
4. Show thought bubble (if thought is non-empty)

## SceneHandler (Browser Adapter)

`packages/renderer/src/adapters/SceneHandler.ts` — implements `RendererHandler` by wrapping `RoomScene`. Used by BrainLoop in browser AI mode.

## Browser Brain Integration

`packages/renderer/src/main.ts` — dual mode:
- **Demo mode** (no API key): hardcoded activity loop
- **AI mode** (`?apiKey=sk-or-...`): BrainLoop → RendererBridge → SceneHandler → RoomScene

Press `~` for ConfigPanel debug overlay.

## CognitiveLoop

The main agent loop. Configurable via `CognitiveLoopConfig`.

### CognitiveLoopConfig

```typescript
interface CognitiveLoopConfig {
  tickIntervalMs: number;      // 10000-120000ms
  failureRate: number;          // 0.0-1.0
  maxRetries: number;           // 0-10 (with exponential backoff)
  systemPrompt: string;         // Truman's personality prompt
  agentId: string;              // Agent identifier for memory storage
  reflectionThreshold: number;  // Importance accumulator threshold for reflection
}
```

### CognitiveLoopState

```typescript
interface CognitiveLoopState {
  isRunning: boolean;
  currentActivity: ActivityType | null;
  currentMood: string;
  recentActivities: Array<{ activity: ActivityType; completedSecondsAgo: number }>;
  tickCount: number;
  lastTickAt: Date | null;
  lastError: string | null;
  importanceAccumulator: number;
}
```

### Methods

| Method | Description |
|---|---|
| `start()` | Start the cognitive loop |
| `stop()` | Stop the cognitive loop |
| `tick()` | Execute a single tick (with lock to prevent overlap) |
| `getState()` | Get readonly copy of current state |
| `getConfig()` | Get readonly copy of current config |
| `updateConfig(partial)` | Update config at runtime (hot-reload) |

## EmotionEngine

7-dimensional emotion system with drift toward defaults and floor/ceiling clamping.

### EmotionState

```typescript
interface EmotionState {
  happiness: number;     // [0.2, 1.0] floor=0.2
  curiosity: number;     // [0.0, 1.0]
  anxiety: number;       // [0.0, 0.6] ceiling=0.6
  boredom: number;       // [0.0, 0.9] ceiling=0.9
  excitement: number;    // [0.0, 1.0]
  contentment: number;   // [0.0, 1.0]
  frustration: number;   // [0.0, 0.7] ceiling=0.7
}
```

### Methods

| Method | Description |
|---|---|
| `applyDelta(delta)` | Add/subtract emotion values (clamped to bounds) |
| `applyTimeDrift(now?)` | Drift all emotions toward defaults over time |
| `getState()` | Get current emotion values |
| `getOverallMood()` | Compute mood label from weighted emotion composite |

### Overall Mood Labels

`happy`, `curious`, `anxious`, `bored`, `excited`, `content`, `frustrated`, `contemplative`

Each mood maps to a visual bubble style (color, border, animation) defined in `MOOD_BUBBLE_STYLES`.

## Memory Service Interface

### MemoryRepository

```typescript
interface MemoryRepository {
  createMemory(memory: NewMemoryRow): Promise<MemoryRow>;
  getMemory(id: string): Promise<MemoryRow | null>;
  updateLastAccessed(id: string): Promise<void>;
  getRecentMemories(agentId: string, limit: number, type?: string): Promise<MemoryRow[]>;
}
```

### Memory Retrieval (Park et al.)

```typescript
retrieveMemories(repo, embeddingClient, agentId, query, k, types?): Promise<ScoredMemoryResult[]>
```

Scoring: `score = recency * importance * relevance`
- **Recency:** `0.995^hours` exponential decay
- **Importance:** normalized from 1-10 to 0-1
- **Relevance:** cosine similarity between query and memory embeddings

### EmbeddingClient

```typescript
interface EmbeddingClient {
  embed(text: string): Promise<number[]>;  // 768-dim vector
  getDimensions(): number;
}
```

### StatePersistence

```typescript
interface StatePersistence {
  saveState(agentId: string, state: Record<string, unknown>): Promise<void>;
  loadLatestState(agentId: string): Promise<Record<string, unknown> | null>;
}
```

## LLM Client

### LLMClient Interface

```typescript
interface LLMClient {
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
  generateObject<T>(params: GenerateObjectParams<T>): Promise<GenerateObjectResult<T>>;
}
```

### Model Types

| Type | Purpose | Default Model |
|---|---|---|
| `think` | Reasoning, planning, reflection | `deepseek/deepseek-chat` |
| `classify` | Classification, scoring | `mistralai/mistral-small-latest` |

Models are configurable via `config/truman-config.json` and hot-reloadable.

## Config System

### TrumanConfigSchema (Zod)

```typescript
const TrumanConfigSchema = z.object({
  tickIntervalMs: z.number().min(10000).max(120000),
  models: z.object({
    think: z.string().min(1),
    classify: z.string().min(1),
  }),
  failureRate: z.number().min(0).max(1),
  maxRetries: z.number().min(0).max(10),
  varietyPenalty: z.object({
    veryRecentHours: z.number().min(0),
    recentHours: z.number().min(0),
    moderateHours: z.number().min(0),
  }),
  emotions: z.object({ /* 7 dimensions, each 0.0-1.0 */ }),
});
```

### ConfigWatcher

Watches `config/truman-config.json` with `fs.watch()`. On change:
1. Reads and parses file
2. Validates against TrumanConfigSchema
3. If valid: applies to running CognitiveLoop via `updateConfig()`
4. If invalid: logs warning, retains previous config

## HTTP Endpoints

### GET /health

Returns JSON with agent status. Available on `localhost:3001`.

```json
{
  "status": "ok",
  "uptime": 12345,
  "lastTickAt": "2026-03-24T12:00:00Z",
  "tickCount": 42,
  "currentActivity": "read",
  "currentMood": "curious",
  "memoryCount": 150
}
```

**Security:** No API keys, DB credentials, or secrets are exposed.

### GET /metrics

Returns Prometheus-formatted metrics for scraping.

```
# HELP nts_tick_count Total number of cognitive loop ticks
# TYPE nts_tick_count gauge
nts_tick_count 42

# HELP nts_uptime_seconds Agent uptime in seconds
# TYPE nts_uptime_seconds gauge
nts_uptime_seconds 12345

# HELP nts_memory_count Number of stored memories
# TYPE nts_memory_count gauge
nts_memory_count 150
```

## BullMQ Queues

| Queue | Job Schema | Description |
|---|---|---|
| `agent:think` | `AgentThinkJobSchema` | Triggers cognitive loop tick |
| `agent:action` | `AgentActionJobSchema` | Brain action decision output |
| `renderer:command` | `RendererCommandJobSchema` | Commands to renderer |
| `log:event` | `LogEventJobSchema` | Structured event logging |

All queues use `concurrency: 1`, `removeOnComplete: { count: 1000 }`, `removeOnFail: { count: 5000 }`.

## Zod Schemas (Shared)

| Schema | Package | Purpose |
|---|---|---|
| `ActionCommandSchema` | @nts/shared | LLM action decision (activity + duration + thought) |
| `DailyPlanSchema` | @nts/shared | LLM daily plan (5-8 activities with time blocks) |
| `ImportanceScoreSchema` | @nts/shared | Memory importance (1-10 scale) |
| `EmotionDeltaSchema` | @nts/shared | Emotion change per tick (-0.1 to +0.1 per dim) |
| `AgentThinkJobSchema` | @nts/shared | Think queue payload |
| `AgentActionJobSchema` | @nts/shared | Action queue payload |
| `RendererCommandJobSchema` | @nts/shared | Renderer command payload |
| `TrumanConfigSchema` | @nts/agent-brain | Runtime config validation |

Activity enums in all schemas derive from `ACTIVITY_LIST` in `packages/shared/src/constants.ts`.
