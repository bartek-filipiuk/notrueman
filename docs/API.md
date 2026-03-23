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

## External API

HTTP endpoints will be documented as they are implemented in Stage 4 (health endpoint, metrics).
