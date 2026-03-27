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

## Audio System

### AudioMixer

Three-channel mixer using Phaser Sound Manager.

| Method | Description |
|---|---|
| `playAmbient(key, config?)` | Play a looping ambient sound |
| `stopAmbient(key)` | Stop an ambient sound |
| `playVoice(buffer)` | Play TTS audio buffer on voice channel |
| `setVolume(channel, vol)` | Set volume (0-1) for voice/ambient/music |
| `mute()` / `unmute()` | Global mute toggle |
| `isMuted()` | Get mute state |

### TTSClient

Calls OpenAI `gpt-4o-mini-tts` API with mood-based emotional instructions.

```typescript
interface TTSClientConfig {
  apiKey: string;
  voice: string;    // alloy|ash|ballad|coral|echo|fable|nova|onyx|sage|shimmer
  model: string;    // default: gpt-4o-mini-tts
}

// Returns mp3 ArrayBuffer
ttsClient.synthesize(text: string, mood: string): Promise<ArrayBuffer>
```

### TTSManager

Orchestrates speech queue and playback via Web Audio API.

| Method | Description |
|---|---|
| `speak(text, mood)` | Queue text for TTS synthesis + playback |
| `stopCurrent()` | Stop currently playing utterance |
| `setEnabled(on)` | Enable/disable TTS |
| `setApiKey(key)` | Set OpenAI API key |
| `setVoice(voice)` | Set voice preset |
| `isEnabled()` | Check if TTS is active |
| `getIsPlaying()` | Check if audio is currently playing |
| `getQueueSize()` | Number of queued utterances |

### URL Configuration

| Param | Default | Description |
|---|---|---|
| `tts` | `off` | Enable TTS (`on`/`off`) |
| `openaiKey` | — | OpenAI API key for TTS |
| `voice` | `echo` | Voice preset |

### Audio Autoplay Policy

The game shows a "Click to start" overlay on load. User interaction (click/touch) is required before the Phaser game initializes, satisfying browser autoplay restrictions for AudioContext.

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

### POST /state/save

Save agent state to PostgreSQL. Available on `localhost:3001`.

**Request:**
```json
{
  "agentId": "truman",
  "state": {
    "version": 1,
    "savedAt": 1711500000000,
    "createdAt": 1711400000000,
    "dayCount": 1,
    "totalTimeAliveMs": 86400000,
    "sessionCount": 3,
    "truman": { "x": 400, "y": 300, "facing": "right", "currentActivity": "read", "currentMood": "curious" },
    "emotions": { "happiness": 0.6, "curiosity": 0.7, "anxiety": 0.2, "boredom": 0.3, "excitement": 0.4, "contentment": 0.5, "frustration": 0.1 },
    "physicalState": { "energy": 0.8, "hunger": 0.3, "tiredness": 0.2 },
    "recentActivities": [{ "type": "read", "at": 1711499900000 }],
    "brainTickCount": 42
  }
}
```

**Response:** `200 { "ok": true, "savedAt": 1711500000000 }`

**Errors:**
- `400` — Invalid save data (Zod validation failed)
- `503` — StatePersistence not configured

**Security:** Agent ID is hardcoded to "truman" (user input ignored). State validated against `SaveDataSchema`. CORS restricted to `localhost:*` origins.

### GET /state/load/:agentId

Load latest agent state from PostgreSQL. Available on `localhost:3001`.

**Response:** `200 { "agentId": "truman", "state": { ... } }`

**Errors:**
- `404` — No saved state found
- `503` — StatePersistence not configured

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

## Admin API

### POST /api/admin/login

Authenticate with admin password, receive JWT token.

**Request:** `{ "password": "your-admin-password" }`

**Response:** `200 { "token": "eyJ..." }`

**Errors:**
- `401` — Invalid password
- `429` — Rate limited (max 5 attempts/min per IP)
- `503` — Admin auth not configured

### JWT Authentication

All `/api/admin/*` endpoints (except login) require JWT in Authorization header:

```
Authorization: Bearer <token>
```

Tokens expire after 24 hours. Obtain via `/api/admin/login`.

### GET /api/admin/brain-state

Returns current brain state, config, and health status.

### GET /api/admin/settings

Returns current config and interests.

### POST /api/admin/settings

Update config at runtime (hot-reload). Body: partial config object + optional `interests` array.

### GET /api/admin/memories

Query memories. Query params: `type`, `importance`, `limit` (default 20), `offset`.

### POST /api/admin/reset

Reset agent state. Body: `{ "mode": "soft" | "hard" }`.
- Soft: acknowledge only, brain continues
- Hard: clears saved state

### POST /api/admin/force-activity

Override next tick activity. Body: `{ "activity": "read" }`.

## WebSocket Endpoints

### GET /ws/mind-feed

Public WebSocket endpoint for streaming Truman's thoughts, moods, and activities in real-time. Auto-upgrades HTTP to WebSocket.

**Connection:** `ws://localhost:3001/ws/mind-feed`

**Events received:**

```typescript
interface PublicMindFeedEvent {
  type: "thought" | "mood_change" | "tool_call" | "activity_change" | "blog_created" | "artwork_created" | "reflection";
  timestamp: number;
  data: Record<string, unknown>;
}
```

**Allowed data fields per type:**
| Type | Fields |
|---|---|
| `thought` | `text` |
| `mood_change` | `mood`, `prevMood` |
| `tool_call` | `tool`, `topic` |
| `activity_change` | `activity`, `prevActivity` |
| `blog_created` | `title`, `tags` |
| `artwork_created` | `title`, `style` |
| `reflection` | `insight` |

**Security:** Raw LLM prompts, costs, tool inputs/outputs, memory IDs, and debug info are stripped.

**Limits:** Max 100 connections, 10 per IP.

### GET /ws/admin-feed

Admin WebSocket endpoint streaming ALL unfiltered events including raw prompts, tool I/O, costs, emotion deltas, and memory IDs.

**Connection:** `ws://localhost:3001/ws/admin-feed?token=<JWT>`

**Authentication:** JWT token required as `token` query parameter. Connections without valid JWT are immediately closed with code 1008.

**Events:** Same `MindFeedEvent` type but with all data fields unfiltered, plus `public: boolean` field.

**Limits:** Max 5 connections, 10 per IP.

### MindFeedEvent Schema (Zod)

```typescript
const MindFeedEventSchema = z.object({
  type: MindFeedEventTypeSchema,  // 7 event types
  timestamp: z.number(),
  data: z.record(z.string(), z.unknown()),
  public: z.boolean(),
});
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
| `SaveDataSchema` | @nts/shared | Persisted agent state (position, emotions, day counter) |
| `TrumanConfigSchema` | @nts/agent-brain | Runtime config validation |

Activity enums in all schemas derive from `ACTIVITY_LIST` in `packages/shared/src/constants.ts`.

## Creative Tools

### Tool Definitions

| Tool | Trigger Activities | Input | Output | Status |
|---|---|---|---|---|
| `web_search` | computer, think, read, draw | `{ query: string, count?: number }` | `{ results: Array<{ title, url, snippet }> }` | Real (Brave Search API) |
| `write_blog_post` | computer | `{ title: string, content: string, tags: string[] }` | `{ id: string, status: "draft_saved" }` | Placeholder |
| `create_artwork` | draw | `{ title: string, description: string, style: string }` | `{ id: string, status: "concept_saved" }` | Placeholder |

### Budget System

- Default: 20 tool calls per day (`tools.maxCallsPerDay` in `truman-config.json`)
- Daily reset at midnight UTC
- Hard-blocks calls when budget exceeded (no graceful degradation)
- Tracked via `BudgetManager` class

### LLM Client Extension

`generateWithTools()` method on `LLMClient`:
- Uses Vercel AI SDK `generateText()` with `tools` parameter
- `stopWhen: stepCountIs(N)` controls max tool round-trips (default: 3)
- Returns `{ text, toolCalls, toolResults, usage }`

### Configuration

`config/truman-config.json`:
```json
{
  "tools": {
    "maxCallsPerDay": 20,
    "enabledTools": ["web_search", "write_blog_post", "create_artwork"]
  },
  "interests": ["technology", "philosophy", "art", "science", "creativity"]
}
```

Environment: `BRAVE_SEARCH_API_KEY` in `.env` (Brave Search API free tier, 2000 queries/month).
