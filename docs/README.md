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

### Audio

The game requires a click/touch to start (browser autoplay policy). Audio channels:
- **Voice** — TTS speech (primary, ~80% volume)
- **Ambient** — Activity-specific sounds: clock ticking, keyboard typing, cooking sizzle, page turning, exercise breathing
- **Music** — Lo-fi background tracks, mood-based crossfade (15-20% volume)

Mute/unmute via the HUD speaker icon. Volume configurable per channel in the debug panel (`~`).

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

## State Persistence

Truman's state survives page refreshes. Position, emotions, activity, mood, and day counter are saved automatically and restored on startup.

**How it works:**
- **Primary:** PostgreSQL via REST API (`POST /state/save`, `GET /state/load/:agentId`)
- **Fallback:** localStorage (when backend is unavailable)
- **Save triggers:** Tab hidden, page unload (sendBeacon), periodic 30s, activity change, position change >10px
- **Offline compensation:** Emotions drift toward defaults based on elapsed time. If offline >8h, Truman "slept" (tiredness reset).

**Day counter:** `Day X` shown in bottom-left HUD. `X = floor((now - firstEverStart) / 86400000)`. Session count tracks how many times the page was loaded.

**Reset options** (debug panel `~`):
- **Soft Reset** (yellow button): Position → center, emotions → defaults. Preserves day counter, memories.
- **Hard Reset** (red button + confirm): Clears ALL save data. Fresh start at Day 0.
- **URL params:** `?reset=soft` or `?reset=hard` (dev tools, no confirm dialog).

**Version migration:** Save data has a `version` field. On load, mismatched versions are discarded with a console warning.

## Creative Tools

Truman can autonomously use tools during activities:
- **Web Search** (Brave API): searches the internet when curious. Triggered by computer/think/read/draw activities.
- **Blog Posts** (placeholder): writes draft blog posts at the computer. Saved to memory, not published.
- **Artwork** (placeholder): creates artwork concepts while drawing. Saved to memory, not generated.

Tools are wired into the CognitiveLoop's plan phase. Tool results influence Truman's next decisions and are stored as observations in memory. Interests (`config/truman-config.json`) seed search topics and evolve from reflections.

**Budget:** 20 tool calls per day (configurable). Hard-blocks when exceeded. Resets at midnight UTC. Status logged in console.

**Setup:** Add `BRAVE_SEARCH_API_KEY` to `.env` (free tier: 2000 queries/month at https://api.search.brave.com/).

## Activity Panel

Press `Tab` to toggle the Activity Panel — a sidebar showing Truman's creative activity in realtime:
- **Entries:** Search results, blog drafts, artwork concepts, thoughts, system messages
- **Icons:** \uD83D\uDD0D search, \uD83D\uDCDD blog, \uD83C\uDFA8 artwork, \uD83D\uDCAD thought, \u2699\uFE0F system
- **Preview:** Click any entry to see full content in a modal (Escape to close)
- **Budget:** Color-coded bar at bottom shows remaining tool calls and current day

## Admin Panel

Access the admin panel at `/admin.html` (or `/admin.html#/admin/login`).

### Setup

1. Set environment variables in `.env`:
   ```
   ADMIN_PASSWORD=your-secure-password
   JWT_SECRET=at-least-32-characters-long-random-string
   ```
2. Start the health server (port 3001)
3. Open `http://localhost:5175/admin.html` in your browser
4. Login with `ADMIN_PASSWORD`

### Features

- **Dashboard**: Live brain status, emotion bars, budget usage, recent memories
- **Log Viewer**: Realtime event log with type filtering, search, auto-scroll
- **Settings**: Edit interests, tick interval, model names, daily budget, personality prompt
- **Controls**: Soft/hard reset, force next activity, public feed visibility toggles

### Security

- JWT tokens expire after 24 hours
- Login rate limited to 5 attempts per minute per IP
- All admin endpoints require valid JWT in Authorization header
- Admin WebSocket feed requires JWT token in query parameter

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

## Production Deployment (24/7 Streaming)

### Prerequisites
- VPS: Hetzner CPX31 (4 vCPU, 8 GB RAM) or equivalent
- Docker + Docker Compose
- Twitch/YouTube stream key

### Deploy
```bash
# Configure
cp .env.example .env
# Edit .env: set RTMP_URL, OPENROUTER_API_KEY, TWITCH_* credentials

# Harden VPS (firewall, fail2ban, SSH hardening)
sudo bash scripts/harden-vps.sh

# Start production stack
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Verify all services are healthy
docker compose ps
```

### Production Services
| Service | Purpose |
|---------|---------|
| `app` | Phaser game + AI brain (port 5173) |
| `streamer` | Chromium + FFmpeg → RTMP stream |
| `caddy` | Reverse proxy with auto-HTTPS |
| `postgres` | Memory & state persistence |
| `redis` | BullMQ job queue |

### Streaming Features
- **Twitch bot**: `!status`, `!mood`, `!activity` commands
- **Channel Points**: "Change weather", "Send letter"
- **Viewer voting**: Time-windowed activity votes
- **3-layer chat sanitizer**: profanity, spam, injection detection
- **Browser recycling**: Auto-restart Chromium every 4-8h for stability
- **Companion website**: Stream embed, live status, AI disclosure

See [Runbook](RUNBOOK.md) for full operational procedures.

## Directory Structure

```
notrueman/
  packages/
    shared/          # Shared types, schemas, constants (@nts/shared)
    renderer/        # Phaser 3 game client (@nts/renderer)
    agent-brain/     # AI agent logic (@nts/agent-brain)
    memory-service/  # Memory & embeddings (@nts/memory-service)
    chat-service/    # Twitch bot, voting, sanitizer (@nts/chat-service)
    stream-manager/  # FFmpeg RTMP pipeline (@nts/stream-manager)
    tts-service/     # Text-to-speech (@nts/tts-service)
  apps/
    companion-web/   # Stream embed, status, voting UI
  config/            # Runtime config (truman-config.json, personality)
  scripts/           # VPS hardening, asset generation
  docs/              # Documentation & specs
  docker-compose.yml          # Dev services
  docker-compose.prod.yml     # Production stack
  turbo.json                  # Turborepo config
```

## Tech Stack

- **Frontend:** Phaser 3 (WebGL, pixelArt, 960x540, 30 FPS), Vite, TypeScript
- **AI:** Vercel AI SDK 6, OpenRouter (DeepSeek V3.2 + Mistral Small 3)
- **Backend:** Node.js, PostgreSQL 17 + pgvector, Redis 7, Ollama
- **Memory:** Park et al. scoring (recency x importance x relevance), Drizzle ORM
- **Queues:** BullMQ + Redis (agent:think, agent:action, renderer:command, log:event)
- **Streaming:** Chromium + XVFB + FFmpeg → RTMP (Twitch/YouTube)
- **Chat:** Twurple (Twitch), 3-layer sanitizer, voting system
- **TTS:** Kokoro-82M / OpenAI gpt-4o-mini-tts
- **Monitoring:** Fastify + prom-client (Prometheus metrics), daily cost tracking
- **Build:** Turborepo, npm workspaces, strict TypeScript
- **Testing:** Vitest (350+ tests across 47 files)

## Security

- All secrets in `.env`, never in code
- 3-layer chat sanitizer: profanity → context → injection detection
- Docker containers run as non-root users
- VPS hardening: UFW firewall, Fail2ban, SSH key-only, unattended upgrades
- `[AI Character]` disclosure in stream title and companion website
- See [Security Audit](SECURITY.md) for full threat model and controls

## Documentation

- [Runbook](RUNBOOK.md) — Production operations: deploy, restart, monitoring, troubleshooting
- [API Reference](API.md) — All interfaces, endpoints, and queue schemas
- [Changelog](CHANGELOG.md) — Version history by stage
- [Security](SECURITY.md) — Audit report and threat model
- [Design Spec](design-spec.md) — Truman's personality, activities, and world design
- [Brain Algorithm](brain-algorithm.md) — Cognitive loop, memory scoring, reflection
- [Visual Spec](visual-spec.md) — Pixel art style, room layout, animations
- [Tech Stack](tech-stack.md) — Technology decisions and rationale
