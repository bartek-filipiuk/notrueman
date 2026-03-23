# Project Map: No True Man Show

24/7 AI livestream featuring "Truman," an autonomous pixel art character living in a room, unaware he's being watched. Viewers influence his world indirectly. Central narrative: gradual awakening to his reality over months.

## Architecture at a Glance

```
Viewers (Twitch/YouTube)
    |
    v
chat-service (Twurple + googleapis) --> Sanitizer (3-layer) --> Environment changes
    |                                                                    |
    v                                                                    v
Vote Aggregator / Event Queue (BullMQ + Redis)          agent-brain (Vercel AI SDK 6)
                                                         |  Observe -> Retrieve -> Reflect -> Plan -> Act -> Speak
                                                         |  Models: Mistral Small 3 (classify) + DeepSeek V3.2 (think)
                                                         |  Memory: PostgreSQL + pgvector (Park et al. scoring)
                                                         v
                                                    renderer (Phaser 3 in headless Chromium)
                                                         |
                                                         v
                                                    stream-manager (XVFB + FFmpeg -> RTMP)
                                                         |
                                                    tts-service (Kokoro-82M / OpenAI)
```

## Doc Map

When you need to understand or modify something, go to the right doc:

| Question | Doc | Key Sections |
|---|---|---|
| **Who is Truman? What can he do?** | `design-spec.md` | S2 (personality), S3 (emotions), S5 (activities, objects, sleep), S7 (ethics) |
| **How does Truman think?** | `brain-algorithm.md` | S3.2 (wake-up), S3.3 (tick loop), S4 (memory scoring), S6 (reflection) |
| **What models, when?** | `brain-algorithm.md` | S2 (model routing table), S11 (cost per call type) |
| **Agent state, memory schema, personality drift** | `agent-spec.md` | S3 (personality), S4 (emotions), S5 (memory types + DB schema), S10 (state persistence) |
| **How viewers interact** | `interaction-spec.md` | S2 (indirection principle), S3 (tiers: votes/points/polls), S4 (letters, newspaper), S7 (chaos mode) |
| **Content safety, sanitizer, prompt injection** | `security-spec.md` | S3 (3-layer sanitizer), S5 (injection defense), S6 (cost caps), S12 (incident response) |
| **Pixel art, room layout, animations, HUD, audio** | `visual-spec.md` | S3 (room layout), S5 (animation states), S6 (HUD), S7 (bubbles), S9 (audio) |
| **What tech, why, how deployed** | `tech-stack.md` | S1 (stack table), S2 (monorepo), S9 (Docker Compose), S13 (decision rationale) |
| **How much does it cost?** | `cost-strategy.md` | S2 (3 tiers), S4 (adapter pattern), S5 (upgrade triggers), S6 (caps + fallbacks) |
| **Logging, feedback loop, metrics** | `observability-spec.md` | S2 (event_log), S3 (LLM sampling), S7 (analysis protocol), S8 (Prometheus metrics) |
| **Awakening arc mechanics** | `agent-spec.md` | S7 (suspicion triggers, phase transitions, community influence) |

## Monorepo Structure (planned)

```
packages/
  shared/              # Types, constants, utilities
  agent-brain/         # Cognitive loop (AI SDK + custom loop)
  memory-service/      # PostgreSQL + pgvector
  renderer/            # Phaser 3 pixel art scene
  tts-service/         # TTS wrapper + audio pipeline
  stream-manager/      # FFmpeg, RTMP, watchdog
  chat-service/        # Twurple + YouTube, voting, sanitizer
apps/
  companion-web/       # Stream embed, voting, journal
  admin-dashboard/     # Operator monitoring + controls
docs/                  # All spec documents (this directory)
config/                # truman-config.json (tunable params)
scripts/
  observability/       # SQL export scripts for feedback loop
```

## Key Technical Decisions

- **TypeScript everywhere** -- single runtime, Vercel AI SDK 6 for LLM calls
- **Custom cognitive loop, not ToolLoopAgent** -- Truman is a game AI, not a chatbot
- **OpenRouter for all LLMs** -- single API key, swap models via config
- **PostgreSQL + pgvector** -- one DB for structured data + vector search, no Qdrant
- **Phaser 3 in headless Chromium** -- NOT `Phaser.HEADLESS` (produces no pixels)
- **Kokoro-82M for TTS** -- $0 starter, OpenAI-compatible API, upgrade path to OpenAI
- **BullMQ + Redis** -- inter-service messaging, job scheduling
- **Hetzner CX32** -- 4 vCPU / 8 GB / 160 GB NVMe, ~EUR 16/month

## Cost: Starter Tier ~$18-24/month

LLM ~$8-12 (DeepSeek V3.2 + Mistral Small 3 via OpenRouter), VPS ~$8, images ~$1-3. TTS and embeddings self-hosted at $0. All providers swappable via env vars.

## Implementation Stages

0. Foundation (Turborepo, Docker, shared types)
1. Agent Brain (AI SDK, PostgreSQL + pgvector, BullMQ)
2. Visualization (Phaser 3, sprites, room, HUD)
3. Streaming Pipeline (XVFB, Chromium, FFmpeg, watchdog)
4. Voice + Audio (TTS, PulseAudio, ambient mixing)
5. Chat & Interaction (Twurple, YouTube, voting, sanitizer)
6. Companion Website (status, voting UI, journal)
7. Production Hardening (monitoring, alerting, cost caps)
8. Launch & Iterate

## Research Files (read-only reference, not specs)

| File | Purpose |
|---|---|
| `prd-desc.md` | Original PRD in Polish |
| `analysis-ogolna.md` | Initial project analysis (Polish) |
| `stack-alternatywny.md` | Alternative stack proposal (Polish) |
| `glowne-punkty-prac.md` | Work breakdown points (Polish) |
| `tech-stack-research.md` | Detailed technology research with benchmarks and citations |
| `research/24-7-ai-livestream-research.md` | Infrastructure and streaming pipeline research |


<claude-mem-context>

</claude-mem-context>