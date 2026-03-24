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
