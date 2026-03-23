# Technology Stack Specification: No True Man Show

**Version:** 1.0
**Date:** 2026-02-28
**Status:** Approved for implementation
**Source:** Validated through comprehensive research (see `tech-stack-research.md` and `research/24-7-ai-livestream-research.md`)

---

## 1. Stack Overview

| Layer | Technology | Version | Key Reason |
|---|---|---|---|
| **Language** | TypeScript | 5.x | Unified stack, type safety for complex state machines |
| **Runtime** | Node.js | 22 LTS | Event-driven, ideal for async LLM + animation pipeline |
| **Monorepo** | Turborepo | 2.7 | Simplest option for small teams, free Vercel caching |
| **LLM Interface** | Vercel AI SDK 6 + Custom Cognitive Loop | 6.x | AI SDK for LLM calls, custom loop for autonomous agent (see `brain-algorithm.md`) |
| **LLM Provider** | OpenRouter (multi-model) | Current | Single API for DeepSeek V3.2, Mistral Small 3, GPT-4o-mini, others |
| **2D Renderer** | Phaser 3 | 3.85.x | Built-in pixel art support, full game framework, Aseprite import |
| **Database** | PostgreSQL + pgvector | 17.3+ / 0.8.0 | Single DB for structured data + vector search, hybrid queries |
| **Message Queue** | BullMQ + Redis | Latest / 7.x | TypeScript-native, battle-tested, simple ops |
| **TTS** | Kokoro-82M (self-hosted) / OpenAI upgrade | Current | $0 starter via Kokoro-FastAPI, OpenAI-compatible API, upgrade path to gpt-4o-mini-tts |
| **Twitch Bot** | Twurple | 8.x | Full EventSub, Channel Points, Polls, TypeScript-native |
| **YouTube Bot** | googleapis | Official | Only maintained option, direct API access |
| **Streaming** | XVFB + Chromium + FFmpeg | Latest | Battle-tested x11grab pipeline for 24/7 operation |
| **Containerization** | Docker Compose | V2 | Health checks, resource limits, log rotation |
| **Embeddings** | nomic-embed-text (self-hosted via Ollama) | 768 dim | $0, CPU inference, quality matches OpenAI |
| **Image Generation** | Replicate Flux Schnell | Current | $0.003/image, upgrade to Flux Dev for quality |
| **Hosting** | Hetzner CX32 | 4 vCPU / 8 GB | Best value, 20 TB bandwidth, EU region |
| **Monitoring** | Beszel + Uptime Kuma | Latest | ~60 MB RAM total, upgrade to Prometheus when needed |

---

## 2. Monorepo Structure

```
no-trueman-show/
  turbo.json
  package.json
  docker-compose.yml
  packages/
    shared/                 # Shared types, constants, utilities
    agent-brain/            # AI agent logic (Vercel AI SDK)
    memory-service/         # PostgreSQL + pgvector memory
    renderer/               # Phaser.js pixel art scene
    tts-service/            # OpenAI TTS wrapper + audio pipeline
    stream-manager/         # FFmpeg, RTMP, watchdog
    chat-service/           # Twurple + YouTube, voting, sanitizer
  apps/
    companion-web/          # Companion website (stream embed, voting, journal)
    admin-dashboard/        # Operator monitoring + emergency controls
  docs/
    design-spec.md
    security-spec.md
    interaction-spec.md
    agent-spec.md
    visual-spec.md
    tech-stack.md           # (this file)
```

### 2.1 Turborepo Configuration

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

## 3. Agent Brain (`packages/agent-brain`)

### 3.1 Framework: Vercel AI SDK 6 + Custom Cognitive Loop

Vercel AI SDK 6 provides the LLM call layer. The cognitive loop is custom -- it's a game AI, not a chatbot.

**What we use from AI SDK:**
- `generateText()` -- open-ended generation (dialogue, thoughts, planning)
- `generateObject()` -- structured output with Zod (importance scores, decisions, emotion deltas)
- `@ai-sdk/openai` -- OpenAI-compatible provider, pointed at OpenRouter

**What we don't use:** `ToolLoopAgent` (designed for request-response, not a persistent think loop).

See `docs/brain-algorithm.md` for the complete cognitive loop pseudocode.

### 3.2 LLM Models (via OpenRouter)

| Task | Model | Estimated Calls/Hour | Cost/Hour |
|---|---|---|---|
| Importance scoring | Mistral Small 3 ($0.05/$0.08 per 1M) | ~60 | ~$0.0006 |
| Should-react decisions | Mistral Small 3 | ~10 | ~$0.0002 |
| Emotion evaluation | Mistral Small 3 | ~24 | ~$0.0005 |
| Content sanitization | Mistral Small 3 | Variable | ~$0.0001 |
| Day planning / replanning | DeepSeek V3.2 ($0.28/$0.42 per 1M) | ~4 | ~$0.002 |
| Thought/speech generation | DeepSeek V3.2 | ~40 | ~$0.010 |
| Reflection synthesis | DeepSeek V3.2 | ~1 | ~$0.0007 |

**Estimated total:** ~$0.014/hour, ~$0.25/day, ~$7.50/month (Starter tier)

### 3.3 Dependencies

```json
{
  "ai": "^6.0.0",
  "@ai-sdk/openai": "^1.0.0",
  "bullmq": "latest",
  "drizzle-orm": "latest",
  "zod": "latest"
}
```

---

## 4. Memory Service (`packages/memory-service`)

### 4.1 PostgreSQL 17 + pgvector 0.8

**Why pgvector over Qdrant:**
- Single database for structured data + vector search
- Hybrid queries (SQL WHERE + vector similarity) in one call
- pgvector 0.8 iterative index scans solve overfiltering
- 9x faster query processing than previous versions
- One backup pipeline, one operational burden

### 4.2 Key Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('observation', 'reflection', 'plan')),
  description TEXT NOT NULL,
  embedding vector(768),
  importance FLOAT NOT NULL DEFAULT 5.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location TEXT,
  emotional_context JSONB DEFAULT '{}',
  viewer_influenced BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX ON memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX ON memories (agent_id, type, created_at DESC);
```

### 4.3 ORM: Drizzle

Drizzle ORM for type-safe database access with pgvector support:

```typescript
import { pgTable, uuid, text, real, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import { vector } from 'pgvector/drizzle-orm';

export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: text('agent_id').notNull(),
  type: text('type').notNull(),
  description: text('description').notNull(),
  embedding: vector('embedding', { dimensions: 768 }),
  importance: real('importance').notNull().default(5.0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }).notNull().defaultNow(),
  location: text('location'),
  emotionalContext: jsonb('emotional_context').default({}),
  viewerInfluenced: boolean('viewer_influenced').default(false),
  metadata: jsonb('metadata').default({}),
});
```

### 4.4 Embedding Model

| Property | Value |
|---|---|
| Model | nomic-embed-text (self-hosted via Ollama) |
| Dimensions | 768 |
| Cost | $0 (CPU inference on VPS) |
| Latency | ~200ms per embedding on 4 vCPU |
| Quality | Comparable to OpenAI text-embedding-3-small on MTEB benchmarks |

---

## 5. Renderer (`packages/renderer`)

### 5.1 Phaser 3 Configuration

```typescript
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,  // or Phaser.WEBGL -- NOT Phaser.HEADLESS
  width: 960,
  height: 540,
  pixelArt: true,       // Disables anti-aliasing, sets roundPixels
  fps: {
    target: 30,
    forceSetTimeOut: true,
  },
  scene: [RoomScene, HUDScene, BubbleScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },  // Top-down/side-view, no gravity
    },
  },
};
```

### 5.2 Critical Architecture Note

Phaser runs inside **headless Chromium** (not headless Phaser):
- Chromium renders to XVFB virtual display
- FFmpeg captures the virtual display via x11grab
- `Phaser.HEADLESS` mode produces no pixels -- never use it for streaming

### 5.3 Object Pooling (Mandatory for 24/7)

```typescript
// Never create/destroy sprites in the hot loop
class SpritePool {
  private pool: Phaser.GameObjects.Sprite[] = [];

  acquire(): Phaser.GameObjects.Sprite { /* reuse from pool */ }
  release(sprite: Phaser.GameObjects.Sprite): void { /* return to pool */ }
}
```

### 5.4 Browser Recycling

Restart Chromium every 4-8 hours to prevent memory leaks:
- Brief stream drop (~2-5 seconds)
- Twitch/YouTube handle reconnections gracefully
- Integrated into narrative as brief "deep thought" moments

---

## 6. TTS Service (`packages/tts-service`)

### 6.1 Kokoro-82M (Starter) / OpenAI (Upgrade)

**Starter tier:** Kokoro-82M self-hosted via Kokoro-FastAPI. Provides an OpenAI-compatible `/v1/audio/speech` endpoint at zero cost. Same client code works for both Kokoro and OpenAI -- switching is a URL change.

**Upgrade path:** OpenAI gpt-4o-mini-tts for emotional peaks (Growth tier) or full-time (Production tier). See `docs/cost-strategy.md` for tier details.

```typescript
import { createOpenAI } from '@ai-sdk/openai';

// Points to Kokoro-FastAPI locally, or OpenAI in production
const ttsClient = new OpenAI({
  baseURL: process.env.TTS_BASE_URL,  // http://localhost:8880/v1 or https://api.openai.com/v1
  apiKey: process.env.TTS_API_KEY,
});

const response = await ttsClient.audio.speech.create({
  model: process.env.TTS_MODEL || 'kokoro',  // or 'gpt-4o-mini-tts'
  voice: 'nova',  // TBD: voice selection based on character testing
  input: trumanSpeech,
  response_format: 'pcm',  // Raw PCM for FFmpeg pipeline
});
```

### 6.2 Cost by Tier

| Tier | TTS Provider | Monthly Cost |
|---|---|---|
| Starter | Kokoro-82M self-hosted | $0 |
| Growth | Kokoro + OpenAI for emotional peaks | $20-40 |
| Production | OpenAI gpt-4o-mini-tts full-time | ~$162 |

### 6.3 Audio Pipeline

```
TTS (PCM output)
       |
       v
Audio Queue (BullMQ: agent:speak)
       |
       v
Audio Mixer (PulseAudio virtual sink)
  + Ambient sounds
  + Background music
       |
       v
FFmpeg captures mixed audio → RTMP stream
```

---

## 7. Stream Manager (`packages/stream-manager`)

### 7.1 Pipeline Architecture

```
[Phaser game in Chromium] → [XVFB :99 virtual display]
                                    |
[PulseAudio virtual sink] ←--------+
       |                            |
       v                            v
[FFmpeg -f pulse -i default] + [FFmpeg -f x11grab -i :99]
                    |
                    v
            [H.264 + AAC → FLV]
                    |
                    v
            [RTMP → Twitch/YouTube ingest]
```

### 7.2 FFmpeg Configuration

```bash
ffmpeg \
  -f x11grab -video_size 1920x1080 -framerate 30 -i :99 \
  -f pulse -i default \
  -c:v libx264 -preset veryfast -tune zerolatency \
  -b:v 4500k -maxrate 4500k -bufsize 9000k \
  -g 60 -sc_threshold 0 \
  -c:a aac -b:a 160k -ar 44100 \
  -f flv \
  -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 30 \
  "rtmp://live.twitch.tv/app/{STREAM_KEY}"
```

### 7.3 Watchdog System

| Monitor | Check Interval | Action on Failure |
|---|---|---|
| FFmpeg process | 30 seconds | Restart FFmpeg, alert operator |
| Chromium process | 30 seconds | Restart Chromium + Phaser, alert operator |
| XVFB process | 60 seconds | Restart full pipeline |
| Memory usage | 30 seconds | Force recycle if Chrome > 2 GB |
| Stream health | 60 seconds | Verify RTMP connection, reconnect if needed |

---

## 8. Chat Service (`packages/chat-service`)

### 8.1 Twitch: Twurple

```typescript
import { ApiClient } from '@twurple/api';
import { ChatClient } from '@twurple/chat';
import { EventSubWsListener } from '@twurple/eventsub-ws';

// Chat for votes
const chatClient = new ChatClient({ authProvider, channels: ['notruemanshow'] });

// EventSub for Channel Points, Polls
const listener = new EventSubWsListener({ apiClient });
listener.onChannelRedemptionAdd(userId, handleRedemption);
listener.onChannelPollEnd(userId, handlePollResult);
```

### 8.2 YouTube: googleapis

```typescript
import { google } from 'googleapis';
const youtube = google.youtube({ version: 'v3', auth });

// Polling loop (respect pollingIntervalMillis)
async function pollChat(liveChatId: string) {
  const response = await youtube.liveChatMessages.list({
    liveChatId,
    part: ['snippet', 'authorDetails'],
  });
  const pollInterval = response.data.pollingIntervalMillis || 5000;
  // Process messages, then wait pollInterval
}
```

### 8.3 YouTube Quota Budget

Daily quota: 10,000 units. Budget allocation:

| Operation | Units | Budget |
|---|---|---|
| Chat reads (~5/read) | ~7,000 | ~1,400 reads/day |
| Bot messages (~50/write) | ~2,500 | ~50 messages/day |
| Moderation (reserve) | ~500 | ~10 actions/day |

---

## 9. Infrastructure

### 9.1 Docker Compose Services

| Service | Image/Build | Resources | Health Check |
|---|---|---|---|
| app (agent-brain) | Build | 1 CPU / 512 MB | HTTP /health |
| streamer | Build (Chromium + FFmpeg) | 4 CPU / 4 GB, shm_size 2 GB | pgrep ffmpeg && chromium |
| postgres | postgres:17-alpine + pgvector | 1 CPU / 1 GB | pg_isready |
| redis | redis:7-alpine | 0.5 CPU / 512 MB | redis-cli ping |
| chat-service | Build | 0.5 CPU / 256 MB | HTTP /health |
| tts-service | Build | 0.5 CPU / 256 MB | HTTP /health |
| kokoro-tts | ghcr.io/remsky/kokoro-fastapi | 1 CPU / 1 GB | HTTP :8880/health |
| ollama | ollama/ollama | 1 CPU / 1.5 GB | HTTP :11434 |
| beszel | henrygd/beszel | 0.25 CPU / 128 MB | HTTP :8090 |
| uptime-kuma | louislam/uptime-kuma:1 | 0.25 CPU / 256 MB | HTTP :3001 |

### 9.2 VPS: Hetzner CX32

| Spec | Value |
|---|---|
| vCPU | 4 (AMD, shared) |
| RAM | 8 GB |
| Storage | 160 GB NVMe SSD |
| Bandwidth | 20 TB/month |
| Cost | ~EUR 16/month |
| Location | EU (Falkenstein or Helsinki) |

**Budget alternative:** Hetzner CAX21 (ARM, 4 vCPU / 8 GB) at ~EUR 7/month. Requires ARM-compatible Docker images.

### 9.3 Logging

All services configured with log rotation:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "5"
```

---

## 10. Monitoring Strategy

### 10.1 Tier 1 (MVP): Beszel + Uptime Kuma

- **Beszel:** CPU, memory, disk, network metrics. Docker container monitoring. ~6 MB agent + ~23 MB hub.
- **Uptime Kuma:** Endpoint monitoring (stream health, API, DB). Alerts via Discord/Telegram.
- **Total overhead:** ~60 MB RAM.

### 10.2 Application Metrics (Day 1, Scrape Later)

Expose `/metrics` endpoint using `prom-client` from the start:

```typescript
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

export const streamUptimeGauge = new Gauge({ name: 'stream_uptime_seconds', help: '...' });
export const chatMessagesCounter = new Counter({ name: 'chat_messages_total', help: '...', labelNames: ['platform'] });
export const aiResponseLatency = new Histogram({ name: 'ai_response_duration_seconds', help: '...', buckets: [0.1, 0.5, 1, 2, 5, 10, 30] });
export const apiCostCounter = new Counter({ name: 'api_cost_dollars_total', help: '...', labelNames: ['service'] });
```

### 10.3 Behavior Observability & Feedback Loop

For structured decision logging, emotion timelines, LLM call sampling, config versioning, and the 2-week frontier LLM analysis protocol, see `docs/observability-spec.md`.

### 10.4 Tier 2 (When Needed): Prometheus + Grafana

Add when custom dashboards are needed. Zero code changes -- just deploy Prometheus and point it at `/metrics`.

---

## 11. Cost Projection

See `docs/cost-strategy.md` for the complete three-tier cost strategy (Starter $20-30, Growth $50-100, Production $150-300).

### 11.1 Quick Summary (Starter Tier)

| Item | Cost |
|---|---|
| VPS (Hetzner CX32) | ~$8 |
| LLM via OpenRouter (DeepSeek V3.2 + Mistral Small 3) | ~$8-12 |
| Image generation (Replicate Flux Schnell) | ~$1-3 |
| Domain | ~$1 |
| TTS (Kokoro-82M self-hosted) | $0 |
| Embeddings (Ollama nomic-embed-text) | $0 |
| **Total** | **~$18-24/month** |

The architecture supports upgrading any component via config change. See cost-strategy.md for upgrade triggers and per-tier breakdowns.

---

## 12. Implementation Stages

| Stage | Name | Key Technologies | Duration Estimate |
|---|---|---|---|
| 0 | Foundation | Turborepo, Docker Compose, shared types, Drizzle | 1 week |
| 1 | Agent Brain | Vercel AI SDK, PostgreSQL + pgvector, BullMQ | 2-3 weeks |
| 2 | Visualization | Phaser 3, Aseprite sprites, room scene, HUD | 2-3 weeks |
| 3 | Streaming Pipeline | XVFB, Chromium, FFmpeg, watchdog | 1-2 weeks |
| 4 | Voice + Audio | gpt-4o-mini-tts, PulseAudio, ambient mixing | 1 week |
| 5 | Chat & Interaction | Twurple, googleapis, voting, sanitizer | 2 weeks |
| 6 | Companion Website | Next.js/Astro, WebSocket, voting UI | 1-2 weeks |
| 7 | Production Hardening | Beszel, Uptime Kuma, cost caps, maintenance mode | 1 week |
| 8 | Launch & Iterate | Go live, monitor, adjust | Ongoing |

---

## 13. Key Technical Decisions & Rationale

| Decision | Choice | Rejected Alternative | Why |
|---|---|---|---|
| TypeScript over Python | Unified stack | Python + ChromaDB | Single runtime, type safety, event-driven async |
| Custom loop over ToolLoopAgent | Custom cognitive loop + AI SDK | Vercel AI SDK ToolLoopAgent | ToolLoopAgent is request-response; Truman needs a persistent autonomous loop |
| OpenRouter over direct OpenAI | Multi-model via single API | Direct provider SDKs | One API key, easy model switching, access to DeepSeek/Mistral/OpenAI |
| DeepSeek V3.2 + Mistral Small 3 | Multi-model routing | GPT-4o-mini for everything | 80-85% cost reduction, task-appropriate model quality |
| pgvector over Qdrant | Operational simplicity | Qdrant | One database, hybrid queries, no sync layer |
| Phaser over PixiJS | Game framework vs renderer | PixiJS v8 | Built-in animation/scene/pixel art, fewer memory leaks |
| BullMQ over Temporal | Right-sized | Temporal | Temporal is overkill, BullMQ is TS-native and simpler |
| Twurple over tmi.js | Full platform coverage | tmi.js | tmi.js is chat-only, no EventSub/Points/Polls |
| XVFB over headless Chrome | Real rendering | CDP screencast | More stable for 24/7, real compositor behavior |
| Turborepo over Nx | Simplicity | Nx | Faster for small teams, less config overhead |
| Kokoro-82M over OpenAI TTS | $0 starter | OpenAI gpt-4o-mini-tts | Self-hosted, OpenAI-compatible API, upgrade path when quality needed |
| nomic-embed-text over OpenAI | $0, self-hosted | text-embedding-3-small | Comparable MTEB quality, 768 dim, runs on CPU via Ollama |
| Replicate Flux Schnell over DALL-E | $0.003/img | DALL-E 3 | 88-96% cheaper, sufficient quality for pixel art context |
| Hetzner over DigitalOcean | Value | DigitalOcean | 3-4x cheaper for equivalent specs |

---

## Cross-References

- Brain algorithm (cognitive loop): `docs/brain-algorithm.md`
- Cost strategy (three tiers): `docs/cost-strategy.md`
- Design specification: `docs/design-spec.md`
- Security architecture: `docs/security-spec.md`
- Viewer interaction mechanics: `docs/interaction-spec.md`
- Agent architecture: `docs/agent-spec.md`
- Visual design: `docs/visual-spec.md`
- Original research: `tech-stack-research.md`, `research/24-7-ai-livestream-research.md`
