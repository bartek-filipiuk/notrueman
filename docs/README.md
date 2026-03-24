# No True Man Show

A 24/7 AI agent living in a pixel art room, rendered with Phaser 3 in the browser. Truman autonomously decides what to do, remembers past events, and expresses emotions — all without human intervention.

## Quick Start

### Prerequisites
- Node.js >= 20
- npm >= 10
- Docker & Docker Compose (for database services)

### Install & Run

```bash
# Install dependencies
npm install

# Start the renderer (demo mode — no AI, hardcoded activity loop)
npx turbo dev --filter=@nts/renderer
# Open http://localhost:5173 in your browser
```

### AI Mode (LLM-powered Truman)

To have Truman think for himself, add your OpenRouter API key to the URL:

```
http://localhost:5173/?apiKey=sk-or-YOUR_KEY_HERE
```

Get a key at https://openrouter.ai/keys. Uses DeepSeek Chat (~$0.28/1M tokens) + Mistral Small 3 (~$0.05/1M tokens). Cost: ~$0.01-0.03 per hour of Truman thinking.

Press `~` (tilde) to open the debug panel showing brain state, emotions, and recent activities.

### TTS (Text-to-Speech)

To have Truman speak aloud via OpenAI gpt-4o-mini-tts:

```
http://localhost:5173/?apiKey=sk-or-KEY&tts=on&openaiKey=sk-OPENAI_KEY
```

Optional voice selection (default: `echo`):
```
http://localhost:5173/?apiKey=sk-or-KEY&tts=on&openaiKey=sk-KEY&voice=nova
```

Available voices: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer. ~30% of thoughts become speech bubbles (pointed tail + audio). TTS status visible in debug panel (`~`).

### Visual FX

Requires WebGL (default). To disable all visual effects (vignette, bloom, glow) for lower-end machines:

```
http://localhost:5173/?fx=off
```

### With Database (optional — for memory persistence)

```bash
# Start dev services (PostgreSQL, Redis, Ollama)
docker compose up -d

# Start the renderer
npx turbo dev --filter=@nts/renderer
```

### Build & Test

```bash
# Build all packages
npm run build

# Run all tests
npm run test

# Type check
npm run typecheck

# Run all checks at once
npx turbo typecheck build test
```

## Art Assets

All sprites are generated programmatically via `Phaser.GameObjects.Graphics` + `generateTexture()`. No external image files needed.

- **Room objects:** `packages/renderer/src/sprites/RoomObjectSprites.ts` — 14 objects
- **Truman:** `packages/renderer/src/entities/TrumanSprite.ts` — Graphics API with mood faces
- **Particles:** `packages/renderer/src/systems/ParticleManager.ts` — Phaser emitters

To modify an object's appearance, edit the corresponding `generate*()` function and reload. Palette constants at the top of each file.

## Architecture

```
Browser (Phaser 3)
    ^
    |  executeAction(), showThought(), updateHUD()
    v
RendererBridge (command pattern)
    ^
    |  planWithMemoryContext(), generateThought()
    v
CognitiveLoop (Observe -> Retrieve -> Plan -> Act -> Store)
    |
    +---> LLM Client (Vercel AI SDK 6 + OpenRouter)
    +---> Memory (PostgreSQL + pgvector, Park et al. scoring)
    +---> EmotionEngine (7-dimension, drift + delta)
    +---> PhysicalStateEngine (energy, hunger, tiredness)
```

The cognitive loop runs every 30-45 seconds (configurable). Each tick:
1. **Observe** — Store what just happened as a memory
2. **Retrieve** — Fetch relevant memories via embedding similarity
3. **Plan** — LLM decides next activity using context + memories
4. **Act** — Renderer executes the activity with visual effects
5. **Store** — Record the outcome and update emotional state

## Directory Structure

```
notrueman/
  packages/
    shared/          # Shared types, schemas, constants (@nts/shared)
    renderer/        # Phaser 3 game client (@nts/renderer)
    agent-brain/     # AI agent logic (@nts/agent-brain)
    memory-service/  # Memory & embeddings (@nts/memory-service)
  apps/              # Application entry points
  config/            # Runtime config (truman-config.json, truman-personality.md)
  docs/              # Documentation & specs
  docker-compose.yml # Dev services
  turbo.json         # Turborepo config
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and fill in required values:

```bash
cp .env.example .env
```

Key variables:
- `OPENROUTER_API_KEY` — Required for AI agent brain (get from OpenRouter)
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `DAILY_COST_CAP_USD` — Max daily API spend (default: $5.00)

### Agent Config

`config/truman-config.json` controls the brain loop (hot-reloadable without restart):
- `tickIntervalMs` — How often the brain thinks (default: 45000ms)
- `models.think` / `models.classify` — LLM model IDs via OpenRouter
- `failureRate` — Probability of activity failure (default: 0.25)
- `maxRetries` — LLM retry count with exponential backoff
- `emotions` — Default emotion values (7 dimensions)
- `varietyPenalty` — Activity repetition penalty time windows

`config/truman-personality.md` contains Truman's personality prompt (editable without rebuild).

### Health & Monitoring

When the agent is running, health and metrics are available:
- `http://localhost:3001/health` — JSON agent status
- `http://localhost:3001/metrics` — Prometheus-compatible metrics

## Extending

### Adding a New Activity

See the step-by-step guide in `packages/shared/src/constants.ts` at the `ACTIVITY_LIST` definition. Activities are validated via Zod schemas that derive from this single source of truth.

### Changing the LLM Model

Edit `config/truman-config.json` — the ConfigWatcher picks up changes automatically:
```json
{
  "models": {
    "think": "openai/gpt-4o",
    "classify": "anthropic/claude-3-haiku"
  }
}
```
Any model available on OpenRouter can be used.

### Modifying Emotions

Emotion defaults, floors, and ceilings are in `packages/shared/src/constants.ts`. Runtime overrides via `config/truman-config.json` `emotions` field.

## Tech Stack

- **Frontend:** Phaser 3 (CANVAS, pixelArt, 960x540, 30 FPS), Vite, TypeScript
- **AI:** Vercel AI SDK 6, OpenRouter (DeepSeek V3.2 + Mistral Small 3)
- **Backend:** Node.js, PostgreSQL 17 + pgvector, Redis 7, Ollama
- **Memory:** Park et al. scoring (recency x importance x relevance), Drizzle ORM
- **Queues:** BullMQ + Redis (agent:think, agent:action, renderer:command, log:event)
- **Monitoring:** Fastify + prom-client (Prometheus metrics), daily cost tracking
- **Build:** Turborepo, npm workspaces, strict TypeScript
- **Testing:** Vitest (330+ tests across 43 files)

## Security

See [docs/SECURITY.md](SECURITY.md) for the full security audit report, including threat model, implemented controls, and known limitations.

## Documentation

- [API Reference](API.md) — All interfaces, endpoints, and queue schemas
- [Changelog](CHANGELOG.md) — Version history by stage
- [Security](SECURITY.md) — Audit report and threat model
- [Design Spec](design-spec.md) — Truman's personality, activities, and world design
- [Brain Algorithm](brain-algorithm.md) — Cognitive loop, memory scoring, reflection
- [Visual Spec](visual-spec.md) — Pixel art style, room layout, animations
- [Tech Stack](tech-stack.md) — Technology decisions and rationale
