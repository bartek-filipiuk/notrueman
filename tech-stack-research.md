# Technology Stack Research Summary

**Research Date:** 2026-02-27
**Purpose:** 24/7 AI Agent Live Stream ("The Truman Show" with AI character in pixel art)

---

## 1. TypeScript vs Python for 24/7 Autonomous AI Agent Systems

### Overview

As of early 2026, TypeScript has reached near-parity with Python for building production AI agent systems. The choice now depends more on your surrounding stack than on AI framework maturity. For a system that also includes a browser-based renderer, stream pipeline, and real-time event handling, TypeScript offers a unified stack advantage.

### Key Findings

- **Vercel AI SDK 6** (released Dec 2025) is the most polished TypeScript agent framework. It provides a first-class `ToolLoopAgent` abstraction with built-in loop control (`stopWhen`, `prepareStep`), human-in-the-loop approval (`needsApproval: true`), full MCP support, and DevTools. It supports 25+ LLM providers out of the box.
- **OpenAI Agents SDK** now has full TypeScript/JS parity with the Python version. Both support tool use, handoffs between agents, guardrails, and tracing. It is provider-agnostic.
- **LangGraph.js** has caught up significantly with LangGraph Python. Core concepts (directed graphs, state management, conditional routing, checkpointing) are identical across both. Python remains slightly more mature, but the JS version is production-ready.
- **LangChain.js** community reports it is "moving faster in JS than Python" for new integrations as of mid-2025.

### Recommendation: TypeScript

**Rationale for this project:**

1. **Unified stack** -- The renderer (Phaser/PixiJS) runs in a browser/Chromium. The stream pipeline (FFmpeg orchestration, WebSocket events) is Node.js-native. Using TypeScript end-to-end eliminates serialization boundaries and language context-switching.
2. **Type safety for complex state machines** -- The agent's memory, plan state, emotional model, and action queue form a complex state machine. TypeScript's type system catches entire categories of bugs at compile time that Python would only surface at runtime.
3. **Async/event-driven by design** -- Node.js's event loop model is purpose-built for the kind of "wait for LLM response, then animate, then speak, then observe" pipeline this project requires. Python's asyncio is capable but more verbose and less ergonomic.
4. **Operational simplicity** -- One runtime (Node.js), one package manager, one build system, one deployment target.

### Recommended Framework Stack

| Layer | Tool | Version |
|-------|------|---------|
| Agent orchestration | Vercel AI SDK | 6.x |
| LLM provider | OpenAI SDK (`openai` npm) | 4.x |
| Complex graph workflows (if needed) | LangGraph.js | 0.2.x |
| State persistence | Custom + PostgreSQL | -- |

### When Python Would Be Better

- If you needed heavy ML/data-science preprocessing (not the case here)
- If you needed a Python-only library with no JS equivalent (increasingly rare)

### Sources

- [TypeScript Rising: Replacing Python in Multi-Agent AI Systems](https://visiononedge.com/typescript-replacing-python-in-multiagent-systems/)
- [LangChain vs Vercel AI SDK vs OpenAI SDK: 2026 Guide](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide)
- [AI SDK 6 - Vercel](https://vercel.com/blog/ai-sdk-6)
- [AI SDK Core: ToolLoopAgent](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent)
- [OpenAI Agents SDK TypeScript](https://openai.github.io/openai-agents-js/)
- [LangGraph.js GitHub](https://github.com/langchain-ai/langgraphjs)
- [Choosing Your Stack: LangChain & LangGraph in Python vs. JS/TS](https://techwithibrahim.medium.com/choosing-your-stack-langchain-langgraph-in-python-vs-js-tyscript-0552256883d8)

---

## 2. Phaser.js vs PixiJS for Headless Rendering in Chromium

### Overview

For a 24/7 pixel art scene rendered in headless Chromium and captured to FFmpeg, **Phaser 3** is the stronger choice. It provides a complete game framework with built-in sprite animation, tilemap support, a scene graph, and -- critically -- a documented pixel art mode and headless renderer option. PixiJS is a lower-level rendering library that would require you to build all game-framework features yourself.

### Key Findings

**Phaser 3 (v3.85.x, current stable):**
- Has a dedicated `pixelArt: true` config flag that sets `roundPixels` and disables anti-aliasing globally
- Supports `type: Phaser.HEADLESS` renderer mode (skips preRender/render/postRender hooks for server-side logic)
- Native Aseprite animation import for pixel art workflows
- Supports both Canvas and WebGL renderers
- Built-in scene management, tweens, timers, sprite physics -- all useful for an autonomous character simulation
- Actively maintained for 10+ years; large community

**PixiJS (v8.x):**
- Pure rendering library -- faster raw rendering but no game framework features
- Significant history of memory leak issues, especially with `Graphics` objects (documented issues: #10586, #10877, #8189, #5543, #685)
- v8 introduced WebGPU support, but this adds complexity without benefit for simple pixel art
- `pixijs-node` package exists for server-side rendering but is less battle-tested
- You would need to build your own scene management, animation system, and update loop

### Memory Leak Concerns (Critical for 24/7)

PixiJS has a documented pattern of memory leaks, particularly:
- Rapidly creating/destroying `Graphics` objects in v8 leads to memory leaks and `RangeError` crashes
- WebGPU renderer shows memory leaks not present in WebGL
- Texture management requires careful manual cleanup

Phaser 3 is not immune to memory issues but wraps resource management more safely. The key mitigation for both: **do not create/destroy objects in the hot loop; use object pools.**

### Recommended Architecture

```
[Phaser 3 game in Chromium (headless mode off, Canvas/WebGL on)]
    |
    v
[Puppeteer/Playwright captures page at 30fps]
    |
    v
[FFmpeg receives frame stream, encodes to RTMP/HLS]
    |
    v
[Twitch/YouTube ingest]
```

**Important distinction:** Use Phaser's Canvas/WebGL renderer (NOT `Phaser.HEADLESS`). The headless mode skips rendering entirely and is meant for server-side game logic only. You need actual pixels on a canvas for FFmpeg capture. Run the game in headless **Chromium** (not headless Phaser) so the browser renders to an offscreen buffer that Puppeteer can capture.

### Recommendation: Phaser 3

| Factor | Phaser 3 | PixiJS v8 |
|--------|----------|-----------|
| Pixel art support | Built-in config flag | Manual setup |
| Animation system | Built-in + Aseprite import | Build your own |
| Scene management | Built-in | Build your own |
| Memory stability (24/7) | Better (managed lifecycle) | Known leak issues |
| Headless Chromium compat | Proven | Works but less documented |
| Overhead | Higher (full framework) | Lower (just renderer) |
| Community/docs | Extensive | Good but less game-focused |

### Common Pitfalls

1. **Do NOT use `Phaser.HEADLESS` for stream capture** -- it produces no visual output. Use `Phaser.CANVAS` or `Phaser.WEBGL` inside headless Chromium.
2. **Object pooling is mandatory** for 24/7 operation. Never `new Sprite()` in a loop; reuse from a pool.
3. **Restart the Chromium process periodically** (every 6-12 hours) as a safety measure against browser memory growth. Use a blue-green pattern with two browser instances.
4. **Lock the frame rate** to 30fps to reduce GPU/CPU load. Pixel art does not benefit from 60fps.

### Sources

- [Phaser Pixel Art Mode Example (v3.85.0)](https://phaser.io/examples/v3.85.0/game-config/view/pixel-art-mode)
- [Phaser Headless Renderer Example (v3.85.0)](https://phaser.io/examples/v3.85.0/game-config/view/headless-renderer)
- [Phaser vs PixiJS for 2D games - DEV Community](https://dev.to/ritza/phaser-vs-pixijs-for-making-2d-games-2j8c)
- [PixiJS v8 memory leak - Graphics destruction (Issue #10586)](https://github.com/pixijs/pixijs/issues/10586)
- [PixiJS v8 memory leak - WebGPU (Issue #10877)](https://github.com/pixijs/pixijs/issues/10877)
- [Running Phaser 3 on the server (Medium)](https://medium.com/@16patsle/running-phaser-3-on-the-server-4c0d09ffd5e6)

---

## 3. PostgreSQL + pgvector vs Qdrant for AI Agent Memory

### Overview

For a generative agent system (Park et al. 2023 style) that stores memories, reflections, and plans, **PostgreSQL + pgvector** is the clear winner. The memory system requires tight coupling between structured metadata (timestamps, importance scores, agent state, relationships) and semantic vector search. PostgreSQL handles both in a single query, single database, single backup, and single operational burden.

### Key Findings

**pgvector 0.8.0 (current):**
- Up to 9x faster query processing vs previous versions
- Iterative index scans solve the "overfiltering" problem (critical for metadata-heavy queries like "find memories from last 3 hours with importance > 7")
- HNSW index support with excellent recall (0.99+)
- Works with PostgreSQL 14-17 (recommend PostgreSQL 17.3+)
- Open source, no additional cost beyond PostgreSQL hosting

**Benchmarks (pgvector + pgvectorscale vs Qdrant):**
- pgvector+pgvectorscale: 471 QPS at 99% recall on 50M vectors
- Qdrant: 41 QPS at same recall (11.4x slower throughput)
- Note: A January 2026 Medium article argues they are "the same speed" when properly configured, but the workload matters

**Qdrant strengths:**
- Faster index builds
- Native scale-out for billion-vector datasets
- Slightly better recall in some benchmarks (0.911 vs 0.900)
- Purpose-built filtering and sharding

### Memory Architecture for Generative Agents (Park et al.)

The Park et al. architecture requires three types of memory:

| Memory Type | Data Pattern | Best Fit |
|-------------|-------------|----------|
| **Observations** | Timestamp + location + description + embedding + importance score | PostgreSQL (relational + vector) |
| **Reflections** | Links to source observations + synthesized insight + embedding | PostgreSQL (foreign keys + vector) |
| **Plans** | Hierarchical (day -> hour -> action) + status + timestamps | PostgreSQL (recursive queries) |

All three require **hybrid queries**: semantic similarity (vector) + metadata filtering (SQL WHERE). This is exactly what pgvector 0.8's iterative index scans were designed for.

### Recommendation: PostgreSQL + pgvector

| Factor | PostgreSQL + pgvector | Qdrant |
|--------|----------------------|--------|
| Operational complexity | One database to manage | Two databases (still need PG for structured data) |
| Hybrid queries (vector + metadata) | Native SQL + vector in one query | Separate system, needs sync |
| Backup/recovery | Standard pg_dump / pg_basebackup | Separate backup pipeline |
| Cost (managed hosting) | ~$15-50/mo on Railway/Supabase/Neon | +$25-100/mo for Qdrant Cloud |
| Scale needed | Thousands-to-millions of memories | Billions (overkill here) |
| Relational integrity | Foreign keys, transactions, joins | None |
| Ecosystem | Drizzle ORM, Prisma, pgAdmin, etc. | REST API, gRPC |

### Schema Design Sketch

```sql
-- Core memory table
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('observation', 'reflection', 'plan')),
  description TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-3-small
  importance FLOAT NOT NULL DEFAULT 5.0,
  recency_weight FLOAT NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,
  location TEXT,
  metadata JSONB DEFAULT '{}'
);

-- HNSW index for fast vector search
CREATE INDEX ON memories
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Composite index for common filter patterns
CREATE INDEX ON memories (agent_id, type, created_at DESC);

-- Reflection-to-memory links
CREATE TABLE reflection_sources (
  reflection_id UUID REFERENCES memories(id),
  source_id UUID REFERENCES memories(id),
  PRIMARY KEY (reflection_id, source_id)
);
```

### Retrieval Function (Park et al. scoring)

```sql
-- Score = recency * importance * relevance
SELECT id, description,
  (1 - (embedding <=> $1::vector)) AS relevance,
  importance,
  EXP(-0.995 * EXTRACT(EPOCH FROM (now() - last_accessed_at)) / 3600) AS recency,
  -- Combined score
  (1 - (embedding <=> $1::vector))
    * importance
    * EXP(-0.995 * EXTRACT(EPOCH FROM (now() - last_accessed_at)) / 3600) AS score
FROM memories
WHERE agent_id = $2
  AND type = ANY($3)
ORDER BY score DESC
LIMIT $4;
```

### Sources

- [pgvector 0.8.0 Released - PostgreSQL.org](https://www.postgresql.org/about/news/pgvector-080-released-2952/)
- [pgvector vs Qdrant Benchmark - Nirant Kasliwal](https://nirantk.com/writing/pgvector-vs-qdrant/)
- [Qdrant vs pgvector: Same Speed (Jan 2026)](https://medium.com/@TheWake/qdrant-vs-pgvector-theyre-the-same-speed-5ac6b7361d9d)
- [Why Postgres Wins for AI and Vector Workloads - Tiger Data](https://www.tigerdata.com/blog/why-postgres-wins-for-ai-and-vector-workloads)
- [pgvector 0.8.0 on Aurora PostgreSQL - AWS](https://aws.amazon.com/blogs/database/supercharging-vector-search-performance-and-relevance-with-pgvector-0-8-0-on-amazon-aurora-postgresql/)
- [Park et al. 2023 - Generative Agents](https://3dvar.com/Park2023Generative.pdf)

---

## 4. BullMQ + Redis vs Other Message Queues

### Overview

For inter-service communication in a TypeScript AI system running 24/7, **BullMQ + Redis** is the pragmatic choice. It is written in TypeScript, battle-tested at scale (50,000+ jobs/day with zero downtime reported in production), and operationally simple (Redis is your only dependency). For this project's scale, it is the sweet spot between simplicity and capability.

### Key Findings

**BullMQ (current):**
- Written in TypeScript with first-class type support
- Built on Redis (which you likely already need for caching)
- Exactly-once semantics (at-least-once in worst case)
- Features: delayed jobs, repeatable jobs, rate limiting, prioritization, job dependencies, sandboxed processors
- Monitoring via Bull Board
- Active maintenance since 2011 (Bull lineage)

**Alternatives Considered:**

| Queue System | Pros | Cons | Verdict |
|-------------|------|------|---------|
| **BullMQ + Redis** | TypeScript-native, simple ops, proven | Redis is in-memory (cost at scale) | **Best fit** |
| **Temporal** | Durable workflows, long-running processes | Heavy infrastructure (server + DB), steep learning curve | Overkill for this scale |
| **Inngest** | Serverless, zero infra, event-driven | Vendor lock-in, less control over execution | Good but less control |
| **RabbitMQ** | Mature, protocol-standard (AMQP) | Java/Erlang ops burden, weaker TS support | Unnecessary complexity |
| **Apache Kafka** | Massive scale, event sourcing | Extreme operational complexity | Wildly overkill |

### Recommended Architecture for This Project

```
Services:
  [Agent Brain]  <-- BullMQ --> [Animation Controller]
  [Agent Brain]  <-- BullMQ --> [TTS Service]
  [Agent Brain]  <-- BullMQ --> [Memory Service]
  [Stream Manager] <-- BullMQ --> [Chat Ingestion]

Queue Types:
  - agent:think        (priority: high, delayed: scheduled intervals)
  - agent:speak        (priority: normal, FIFO)
  - agent:animate      (priority: normal, FIFO)
  - agent:memory-store (priority: low, batch)
  - chat:process       (priority: normal, rate-limited)
```

### Production Configuration

```typescript
import { Queue, Worker } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST,
  port: 6379,
  maxRetriesPerRequest: null, // Critical for 24/7: retries forever
};

const agentThinkQueue = new Queue('agent:think', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 3600 }, // Clean up after 1 hour
    removeOnFail: { age: 86400 },    // Keep failures for 24 hours
  },
});

const worker = new Worker('agent:think', async (job) => {
  // Process agent thinking cycle
}, {
  connection,
  concurrency: 1, // Sequential thinking
  limiter: { max: 1, duration: 5000 }, // Max 1 thought per 5 seconds
});
```

### Common Pitfalls

1. **Set `maxRetriesPerRequest: null`** -- Without this, workers will stop processing after Redis connection hiccups. This is the most common 24/7 reliability issue.
2. **Always set `removeOnComplete` and `removeOnFail`** -- Without cleanup, Redis memory grows unbounded over days/weeks.
3. **Use `concurrency: 1` for the agent brain** -- LLM calls should be sequential to maintain narrative coherence.
4. **Monitor with Bull Board** -- Set up a dashboard endpoint for visibility into queue depths and failed jobs.

### Sources

- [BullMQ Official Documentation](https://docs.bullmq.io)
- [BullMQ GitHub](https://github.com/taskforcesh/bullmq)
- [Complete Production Guide to BullMQ](https://js.elitedev.in/js/complete-production-guide-to-bullmq-message-queue-processing-with-redis-and-nodejs-72739aef/)
- [A Hands-On Guide to BullMQ for Node.js](https://upqueue.io/blog/a-practical-guide-to-bullmq-in-node-js/)
- [How to Build a Job Queue in Node.js with BullMQ and Redis](https://oneuptime.com/blog/post/2026-01-06-nodejs-job-queue-bullmq-redis/view)

---

## 5. TTS Pricing and Quality Comparison (2025-2026)

### Overview

For a 24/7 stream with natural-sounding voice at minimal cost, **OpenAI gpt-4o-mini-tts** offers the best balance of quality, cost, and simplicity. For maximum voice quality (at higher cost), ElevenLabs remains the leader. For ultra-low latency (real-time conversational feel), Deepgram Aura-2 is the best option.

### Pricing Comparison (as of Feb 2026)

| Provider | Model | Price | Unit | Approx $/hour of speech |
|----------|-------|-------|------|------------------------|
| **OpenAI** | tts-1 (legacy) | $15.00 | per 1M chars | ~$1.20/hr |
| **OpenAI** | tts-1-hd (legacy) | $30.00 | per 1M chars | ~$2.40/hr |
| **OpenAI** | gpt-4o-mini-tts | $0.60/1M input tokens + $12/1M audio tokens | tokens | ~$0.90/hr |
| **ElevenLabs** | Multilingual v2 | $0.18-0.30 | per 1K chars (plan dependent) | ~$14-24/hr |
| **ElevenLabs** | Scale plan ($330/mo) | Included | 2M chars/mo | ~$5.50/hr (if within quota) |
| **Deepgram** | Aura-2 | $0.030 | per 1K chars | ~$2.40/hr |
| **Google Cloud** | WaveNet | $16.00 | per 1M chars | ~$1.28/hr |
| **Amazon** | Polly Neural | $16.00 | per 1M chars | ~$1.28/hr |

**Assumptions:** ~80,000 characters per hour of speech (average speaking rate).

### 24/7 Stream Cost Projection

If the AI character speaks ~25% of the time (6 hours/day):

| Provider | Model | Monthly Cost |
|----------|-------|-------------|
| **OpenAI gpt-4o-mini-tts** | Token-based | ~$162/mo |
| **OpenAI tts-1** | Character-based | ~$216/mo |
| **Deepgram Aura-2** | Character-based | ~$432/mo |
| **ElevenLabs Scale** | Subscription | $330/mo (may need overage) |
| **Google WaveNet** | Character-based | ~$230/mo |

### Quality Ranking (subjective, based on community consensus)

1. **ElevenLabs v2/v3** -- Best overall naturalness, emotion control, voice cloning (MOS ~4.14)
2. **OpenAI gpt-4o-mini-tts** -- Very natural, supports "instructions" parameter for tone/emotion direction
3. **OpenAI tts-1-hd** -- Good quality, less controllable than gpt-4o-mini-tts
4. **Deepgram Aura-2** -- Professional quality, 90ms latency (best for real-time)
5. **Google WaveNet** -- Good but less natural for conversational speech
6. **Amazon Polly Neural** -- Adequate, less natural than above options

### Recommendation: OpenAI gpt-4o-mini-tts

**Rationale:**
1. **Cost-effective** -- Cheapest option at ~$162/mo for 6 hours/day of speech
2. **Quality** -- Near-ElevenLabs quality with the added benefit of `instructions` parameter for emotional direction (e.g., "speak warmly and contemplatively")
3. **Simplicity** -- Same OpenAI API you already use for the LLM, one vendor, one billing
4. **Latency** -- Streaming support, adequate for non-real-time stream output

**When to consider alternatives:**
- **ElevenLabs** if voice identity/cloning is critical to the character's brand and budget allows
- **Deepgram Aura-2** if you need sub-100ms latency for real-time chat interaction

### Implementation Note

```typescript
import OpenAI from 'openai';
const openai = new OpenAI();

const response = await openai.audio.speech.create({
  model: 'gpt-4o-mini-tts',
  voice: 'nova',      // or: alloy, echo, fable, onyx, shimmer
  input: 'Hello, welcome to my world!',
  instructions: 'Speak warmly, with a slight sense of wonder, as if seeing something beautiful for the first time.',
  response_format: 'pcm', // Raw PCM for piping to FFmpeg
});
```

### Sources

- [OpenAI API Pricing](https://platform.openai.com/docs/pricing)
- [OpenAI TTS API Pricing Calculator (Feb 2026)](https://costgoat.com/pricing/openai-tts)
- [AI Text To Speech Cost Comparison - DAISY Consortium](https://daisy.org/news-events/articles/ai-text-to-speech-cost-comparison/)
- [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api)
- [Best TTS APIs in 2026 - Speechmatics](https://www.speechmatics.com/company/articles-and-news/best-tts-apis-in-2025-top-12-text-to-speech-services-for-developers)
- [Deepgram Aura-2 Announcement](https://deepgram.com/learn/introducing-aura-2-enterprise-text-to-speech)
- [10 Best Text to Speech APIs - Deepgram](https://deepgram.com/learn/best-text-to-speech-apis-2026)

---

## 6. Turborepo vs Nx for TypeScript Monorepos

### Overview

For a small team (1-5 developers) building a TypeScript monorepo, **Turborepo** is the clear choice. It is simpler to set up (under 10 minutes), faster for small projects (3x faster than Nx on 2-5 packages), and does not impose an opinionated project structure.

### Key Findings

**Turborepo (v2.7, Dec 2025):**
- Rewritten in Rust for performance
- Free remote caching for Vercel-linked repos (since Jan 2025)
- New DevTools for visualizing Package and Task Graphs
- Composable configuration
- Yarn 4 catalogs support
- Sidecar tasks (v2.6)
- Watch mode caching (experimental, v2.5)
- Biome linter integration

**Nx (v20.x):**
- Full build intelligence platform
- Code generators, module boundaries, affected detection
- Heavier setup, more opinionated
- Better for large teams (10+ developers) and 50+ packages

### Comparison for This Project

| Factor | Turborepo 2.7 | Nx 20.x |
|--------|---------------|---------|
| Setup time | <10 minutes | 30-60 minutes |
| Learning curve | Minimal (just turbo.json) | Moderate (nx.json, project.json, plugins) |
| Build speed (2-5 packages) | ~2.8s (3x faster) | ~8.3s |
| Build speed (50+ packages) | Comparable | Slightly better (affected detection) |
| Remote caching | Free (Vercel) or self-hosted | Nx Cloud (free tier available) |
| Code generation | None built-in | Extensive generators |
| Project restructuring required | None | Prefers Nx workspace structure |
| TypeScript support | Native | Native |
| Config complexity | Single turbo.json | nx.json + per-project configs |

### Recommended Monorepo Structure

```
no-trueman-show/
  turbo.json
  package.json
  packages/
    shared/              # Shared types, constants, utils
      src/
      package.json
    agent-brain/         # AI agent logic (Vercel AI SDK)
      src/
      package.json
    memory-service/      # PostgreSQL + pgvector memory
      src/
      package.json
    renderer/            # Phaser.js pixel art scene
      src/
      package.json
    tts-service/         # OpenAI TTS wrapper
      src/
      package.json
    stream-manager/      # FFmpeg, RTMP, stream orchestration
      src/
      package.json
  apps/
    dashboard/           # Monitoring UI (optional)
      src/
      package.json
```

### Minimal turbo.json

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
    }
  }
}
```

### Recommendation: Turborepo

**Rationale:**
1. You have a small team and likely fewer than 10 packages
2. Zero restructuring of existing code required
3. Free remote caching if deploying any piece to Vercel
4. DevTools (v2.7) give graph visualization without Nx's complexity
5. If you outgrow it, migration to Nx is documented and straightforward

### Sources

- [Turborepo 2.7 Release Blog](https://turborepo.dev/blog/turbo-2-7)
- [Why I Chose Turborepo Over Nx - DEV Community](https://dev.to/saswatapal/why-i-chose-turborepo-over-nx-monorepo-performance-without-the-complexity-1afp)
- [Turborepo, Nx, and Lerna: The Truth in 2026 - DEV Community](https://dev.to/dataformathub/turborepo-nx-and-lerna-the-truth-about-monorepo-tooling-in-2026-71)
- [Nx vs Turborepo: Which Monorepo Tool for Your Startup?](https://nextbuild.co/blog/nx-vs-turborepo-monorepo-startups)
- [Nx vs. Turborepo: Integrated Ecosystem or High-Speed Task Runner?](https://dev.to/thedavestack/nx-vs-turborepo-integrated-ecosystem-or-high-speed-task-runner-the-key-decision-for-your-monorepo-279)
- [Turborepo Official Docs](https://turbo.build/)

---

## Executive Summary: Recommended Stack

| Layer | Choice | Key Reason |
|-------|--------|------------|
| **Language** | TypeScript | Unified stack, type safety for state machines |
| **Monorepo** | Turborepo 2.7 | Simplest option for small teams |
| **Agent Framework** | Vercel AI SDK 6 | Best TS agent abstraction, Dec 2025 release |
| **2D Renderer** | Phaser 3 (v3.85) | Built-in pixel art support, full game framework |
| **Database** | PostgreSQL 17 + pgvector 0.8 | Single DB for structured data + vector search |
| **Message Queue** | BullMQ + Redis | TypeScript-native, battle-tested, simple ops |
| **TTS** | OpenAI gpt-4o-mini-tts | Best cost/quality ratio at ~$162/mo |
| **Streaming** | Headless Chromium + Puppeteer + FFmpeg | Industry-standard pipeline |

**Estimated monthly infrastructure cost (excluding LLM API):**
- PostgreSQL (managed): $15-50/mo
- Redis (managed): $10-30/mo
- Compute (VPS/cloud): $30-100/mo
- TTS: ~$162/mo
- LLM API (OpenAI): ~$100-500/mo (depends on thinking frequency)
- **Total: ~$320-840/mo**

---

## Research Metadata

- **Sources consulted:** Web search (multiple queries per topic), official documentation sites, GitHub repositories, community benchmarks, pricing pages
- **Date of research:** 2026-02-27
- **Key version numbers:**
  - Vercel AI SDK: 6.x (released Dec 24, 2025)
  - Phaser: 3.85.x (current stable)
  - PixiJS: 8.x (current stable)
  - pgvector: 0.8.0
  - PostgreSQL: 17.3+
  - BullMQ: latest on npm
  - Turborepo: 2.7 (Dec 2025)
  - OpenAI gpt-4o-mini-tts: current
  - LangGraph.js: 0.2.x
  - OpenAI Agents SDK (JS): current
