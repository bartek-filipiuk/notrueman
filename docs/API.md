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

## External API

HTTP endpoints will be documented as they are implemented in Stage 4 (health endpoint, metrics).
