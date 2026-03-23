# HANDOFF_STAGES_PLAN.md — No True Man Show

**Date:** 2026-02-28
**Purpose:** Complete implementation plan for AI agent handoff. 12 stages, ~50 tasks, vertical slices, TDD backend.

## Assumptions (Global)

- **No code exists yet** — pure docs repo, greenfield TypeScript monorepo
- **Fully autonomous AI agent execution** — each task is self-contained (~150k context tokens), agent implements + tests without human input
- **Human review at stage boundaries** — each stage produces a runnable milestone
- **TDD for all backend code** — test first, then implementation (Vitest)
- **Smoke tests for renderer/frontend** — layout data tests + visual verification
- **Drizzle Kit migrations** — each DB schema change creates a migration file
- **Hybrid service comms** — memory-service is in-process library (critical path), BullMQ for async (TTS, renderer, chat, logging)
- **AI-generated placeholder art** — rough pixel art, replace with hand-made art later
- **Full awakening arc from day 1** — complete suspicion tracking even though it stays near 0 for months

## Dependency Graph

```
Stage 0 (Foundation)
  |
  +---> Stage 1 (Memory)  ──┐
  |                          +---> Stage 3 (Brain Core) ---> Stage 4 (Emotion/Reflection/Awakening)
  +---> Stage 2 (Renderer) ─┘                                   |
                                                                 v
                                                    Stage 5 (Integration: brain + renderer)
                                                         |
                                              +----------+----------+
                                              |                     |
                                        Stage 6 (Streaming)   Stage 8 (Chat & Interaction)
                                              |                     |
                                        Stage 7 (TTS + Audio) +----+----+
                                                               |    |    |
                                                             S9   S10   S11
                                                          (Admin)(Web)(Hardening)
                                                                        |
                                                                  Stage 12 (Launch)
```

Stages 1 & 2 can run **in parallel**. Stages 9, 10, 11 can partially overlap after Stage 8.

---

## Stage 0: Monorepo Foundation

**Goal:** Turborepo monorepo, shared types, Docker Compose (PostgreSQL + Redis + Ollama), Drizzle schemas, BullMQ infrastructure.
**Assumptions:** Node.js 22 LTS and Docker installed.

### Task 0.1: Initialize Turborepo Monorepo

**Description:** Create root monorepo with Turborepo 2.7. Configure workspaces for all 7 packages + 2 apps. Set up TypeScript 5.x base config (strict), ESLint flat config, Vitest workspace config, `.gitignore`, `.env.example`. Create stub `package.json` for every package/app.

**Key files:** `package.json`, `turbo.json`, `tsconfig.base.json`, `vitest.workspace.ts`, `.eslintrc.js`, `.env.example`, all `packages/*/package.json`, all `apps/*/package.json`

**TDD:** Write a test in `packages/shared` that imports a constant. Run `turbo test` to verify pipeline.

**DoD:**
- `npm install` succeeds
- `turbo build`, `turbo test`, `turbo typecheck` all pass
- All packages have `tsconfig.json` extending base
- `.env.example` lists all env vars from `security-spec.md` S9.1

**Context docs:** `tech-stack.md` S2, S2.1

---

### Task 0.2: Shared Types Package

**Description:** Build `packages/shared` with all TypeScript interfaces, Zod schemas, constants, and enums from the specs. Includes: `AgentState`, `EmotionState`, `PersonalityState`, `AwakeningState`, `ViewerEvent`, `SanitizerResult`, all Zod schemas for LLM structured output (`DailyPlanSchema`, `ActionQueueSchema`, `HourlyPlanSchema`, `EmotionDeltaSchema`), memory types, 16 event log types with typed payloads, bubble types, activity types, room object definitions, all constants.

**Key files:** `packages/shared/src/types/` (agent-state, emotions, personality, awakening, memory, viewer-event, events, renderer, sanitizer), `packages/shared/src/schemas/`, `packages/shared/src/constants.ts`, `packages/shared/src/utils/`

**TDD:** Test Zod schema validation (valid parses, invalid rejects). Test emotion clamping. Test constants match spec values.

**DoD:**
- All interfaces from `agent-spec.md` S3-7, S10 defined
- All Zod schemas from `brain-algorithm.md` exported
- 16 event types from `observability-spec.md` S2.2 have typed payloads
- `EmotionState` defaults/floors/ceilings match `design-spec.md` S3
- Constants match `brain-algorithm.md` S3.1
- Other packages can import `@nts/shared`

**Context docs:** `agent-spec.md`, `brain-algorithm.md`, `observability-spec.md` S2.2, `design-spec.md` S3, `interaction-spec.md` S5.2, `visual-spec.md` S7, `security-spec.md` S3.2

---

### Task 0.3: Docker Compose and Database Foundation

**Description:** Create `docker-compose.yml` with PostgreSQL 17 + pgvector 0.8, Redis 7, Ollama. Create Drizzle ORM config and first migration: `memories`, `reflection_sources`, `plan_hierarchy`, `event_log`, `llm_call_samples`, `agent_state` tables. Include pgvector HNSW index. Create `config/truman-config.json` with observability flags.

**Key files:** `docker-compose.yml`, `packages/memory-service/src/db/` (drizzle.config, schema, connection), migration file, `config/truman-config.json`, `scripts/init-db.sh`

**TDD:** Integration tests: connect to test PostgreSQL, run migration, verify tables exist, insert + query a memory with vector embedding, verify HNSW index.

**DoD:**
- `docker compose up postgres redis ollama` starts with health checks
- All tables from `agent-spec.md` S5.3 and `observability-spec.md` S2.1 exist
- HNSW index with `m=16, ef_construction=64`
- `config/truman-config.json` has observability flags from `observability-spec.md` S11
- Integration tests pass

**Context docs:** `tech-stack.md` S4, S9, `agent-spec.md` S5.3, `observability-spec.md` S2.1, S3.2, S11, `cost-strategy.md` S7

---

### Task 0.4: BullMQ Infrastructure and Health Endpoints

**Description:** Set up BullMQ queue definitions, connection factory. Define queue names: `agent:speak`, `agent:action`, `renderer:command`, `tts:generate`, `chat:event`, `log:event`. Create reusable health check HTTP server (Fastify or Node built-in) with `/health` + `/metrics` (prom-client). Register all Prometheus metrics from `tech-stack.md` S10.2 and `observability-spec.md` S8.

**Key files:** `packages/shared/src/queue/` (queues, types), `packages/shared/src/health/server.ts`, `packages/shared/src/metrics/registry.ts`

**TDD:** Test queue connection factory creates valid BullMQ instances. Test health server responds 200. Test metrics endpoint returns Prometheus format.

**DoD:**
- All queue names defined as typed constants with job payload types
- Health server factory works
- All Prometheus metrics registered
- Tests pass

**Context docs:** `tech-stack.md` S7, S10.2, `observability-spec.md` S8

---

**Stage 0 DoD:** `turbo build && turbo test` passes. `docker compose up` starts infrastructure. Database has all tables. Shared types compile. BullMQ queues defined. Health endpoints work.

---

## Stage 1: Memory Service (In-Process Library)

**Goal:** Memory store/retrieve with Park et al. scoring, embedding generation, reflection chains, event logging. Fully tested, ready for brain to import directly.
**Assumptions:** Stage 0 complete.

### Task 1.1: Core Memory CRUD and Embedding

**Description:** Implement `createMemory()`, `getMemory()`, `updateLastAccessed()`, `getRecentMemories()`. Integrate with Ollama for embeddings (nomic-embed-text, 768 dims). Create mockable embedding client.

**Key files:** `packages/memory-service/src/` (index, memory-store, embedding-client, types), tests

**TDD:**
1. `createMemory` stores + returns with ID
2. `getMemory` retrieves by ID
3. `updateLastAccessed` updates timestamp
4. `getRecentMemories` returns ordered by `created_at DESC` with limit
5. Embedding client generates 768-dim vector
6. Store memory with embedding succeeds and vector is queryable

**DoD:** All CRUD operations work. Embedding client produces 768-dim vectors via Ollama. Mock available for unit tests. Tests pass.

**Context docs:** `agent-spec.md` S5, `tech-stack.md` S4, `brain-algorithm.md` S3.3

---

### Task 1.2: Park et al. Memory Retrieval Scoring

**Description:** Implement `retrieveMemories(query, k, types)` with `score = recency + importance + relevance`. Build the SQL query combining cosine similarity, exponential decay (`0.995^hours`), and normalized importance. Update `last_accessed_at` on retrieval.

**Key files:** `packages/memory-service/src/` (retrieval, scoring), tests

**TDD:**
1. `recency(hoursAgo)` returns `0.995^hours`
2. `normalizeImportance(score)` returns `score/10`
3. Retrieval returns memories sorted by combined score
4. `last_accessed_at` updated after retrieval
5. Filtering by memory type works
6. `k` parameter limits results
7. Performance: <100ms for 10,000 memories

**DoD:** Scoring matches `brain-algorithm.md` S4.1 exactly. SQL matches S4.2. Tests pass.

**Context docs:** `brain-algorithm.md` S4, `agent-spec.md` S5.2

---

### Task 1.3: Reflection Storage and Plan Hierarchy

**Description:** Implement reflection-specific storage: `createReflection()` with source links via `reflection_sources` table, `getReflectionChain()` for tracing evidence trees, plan hierarchy via `plan_hierarchy` table, plan status transitions.

**Key files:** `packages/memory-service/src/` (reflections, plans), tests

**TDD:**
1. `createReflection` stores memory + links to source IDs atomically
2. `getReflectionChain(id)` returns full evidence tree
3. Reflection importance > max source importance
4. Plan hierarchy: parent-child relationships
5. Plan status transitions (pending -> in_progress -> completed/abandoned)

**DoD:** Atomic reflection creation. Evidence trees queryable. Plan hierarchy works. Tests pass.

**Context docs:** `brain-algorithm.md` S6, `agent-spec.md` S5.1-5.3, S6

---

### Task 1.4: Event Logger and LLM Call Sampler

**Description:** Implement `EventLogger` (writes to `event_log` table) and `LLMCallSampler` (5% random, 100% for reflections/replanning/daily planning). Read config from `truman-config.json`.

**Key files:** `packages/memory-service/src/` (event-logger, llm-sampler), tests

**TDD:**
1. `logEvent(tickId, eventType, data)` inserts correctly
2. All 16 event types accepted
3. `config_version` included in every event
4. Sampler logs 100% of always-sample purposes
5. Sampler logs ~5% of random calls (statistical test over 1000)
6. Sampled calls store full prompt/response

**DoD:** All 16 event types logged. Sampling strategy from `observability-spec.md` S3.1 works. Config flags respected. Tests pass.

**Context docs:** `observability-spec.md` S2, S3, `brain-algorithm.md` S3.3

---

**Stage 1 DoD:** Memory service fully functional as in-process library. Park et al. scoring works. Reflections and plans have hierarchy. Event logging captures all event types. All tests pass.

---

## Stage 2: Minimal Renderer (Phaser Room)

**Goal:** Phaser 3 scene with pixel art room, 14 interactive objects (placeholder), character that walks between positions, HUD, thought/speech bubbles, BullMQ command API.
**Assumptions:** Stage 0 complete. Independent of Stage 1.

### Task 2.1: Phaser 3 Setup and Static Room

**Description:** Set up Phaser 3 in `packages/renderer`. Game config: CANVAS mode, 960x540, `pixelArt: true`, 30 FPS. Build `RoomScene` with colored rectangles for all 14 interactive objects (bed, desk, computer, bookshelf, fridge, stove, table+chair, easel, exercise mat, window, clock, plant, poster, door). Each has position, size, label.

**Key files:** `packages/renderer/src/` (index, config, scenes/RoomScene, objects/InteractiveObject, objects/room-layout, index.html)

**TDD:** Smoke tests. Test layout data positions. Test Phaser initializes without errors.

**DoD:** Browser shows 960x540 room with all 14 labeled objects. Room layout matches `visual-spec.md` S3.1. Zones visually distinct. No sprites needed — pure placeholders.

**Context docs:** `visual-spec.md` S2, S3, S4, `tech-stack.md` S5

---

### Task 2.2: Character Movement and Animation System

**Description:** Add Truman as sprite/rectangle that walks between objects. Simple pathfinding (horizontal then vertical). Animation state machine: idle, walking, per-zone activity state. Command interface: `moveTo(objectId)`, `playAnimation(state)`, `setIdle()`.

**Key files:** `packages/renderer/src/character/` (Truman, movement, animation-states), `packages/renderer/src/commands/renderer-commands.ts`, tests

**TDD:** Test pathfinding calculates correct waypoints. Test state machine transitions.

**DoD:** Truman walks smoothly between objects. State machine handles idle -> walking -> activity -> idle. Commands work. Tests pass.

**Context docs:** `visual-spec.md` S5, `tech-stack.md` S5

---

### Task 2.3: HUD Scene and Thought Bubble System

**Description:** `HUDScene` overlay: mood icon, real-time clock, activity label. `BubbleScene`: 4 bubble types (thought, speech, exclamation, whisper), typewriter effect (50ms/char), mood-based colors, auto-positioning, 8-10s display + fade, 1 bubble at a time with queue.

**Key files:** `packages/renderer/src/scenes/` (HUDScene, BubbleScene), `packages/renderer/src/ui/` (bubble, mood-icon, hud-elements), tests

**TDD:** Test typewriter timing. Test mood-to-color mapping matches `visual-spec.md` S7.3. Test auto-hide timing. Test single bubble + queue.

**DoD:** HUD shows mood/time/activity. All 4 bubble types with mood colors. Typewriter + fade. Queue if multiple. 80% opacity HUD. Tests pass.

**Context docs:** `visual-spec.md` S6, S7

---

### Task 2.4: Renderer Command API (BullMQ)

**Description:** Renderer subscribes to `renderer:command` BullMQ queue. Commands: `move_to`, `play_animation`, `show_bubble`, `update_hud`, `set_object_state`. HTTP API for admin to query current state.

**Key files:** `packages/renderer/src/commands/` (command-processor, command-types), `packages/renderer/src/state/renderer-state.ts`, `packages/renderer/src/api/renderer-api.ts`, tests

**TDD:** Test each command type (mock Phaser scene). Test unknown commands rejected. Test state endpoint returns position/animation/bubble.

**DoD:** All commands processed from BullMQ. HTTP state endpoint works. Validated against shared types. Invalid commands logged and skipped. Tests pass.

**Context docs:** `tech-stack.md` S5, `visual-spec.md` S4-7, `brain-algorithm.md` S3.3

---

**Stage 2 DoD:** Phaser room visible in browser. Character walks between objects. HUD and bubbles work. Renderer accepts BullMQ commands. Screenshot — first visual milestone.

---

## Stage 3: Agent Brain Core (Observe, Plan, Act)

**Goal:** Core cognitive loop: wake-up, tick loop (observe/plan/act), replanning, vocalization, state persistence. No reflection/emotion/awakening yet (Stage 4).
**Assumptions:** Stages 0 + 1 complete. Stage 2 complete (renderer accepts commands). OpenRouter API key available.

### Task 3.1: LLM Client and Multi-Model Routing

**Description:** Vercel AI SDK 6 + OpenRouter. Two model aliases: `classify` (Mistral Small 3), `think` (DeepSeek V3.2). Instrumented `wrappedGenerateText()` and `wrappedGenerateObject()` with cost tracking, latency measurement, retry/fallback (DeepSeek -> GPT-4o-mini). `DailyCostTracker` with caps (80% -> reduce ticks, 100% -> sleep mode).

**Key files:** `packages/agent-brain/src/llm/` (client, models, wrapped-generate, cost-tracker, fallback), tests

**TDD:**
1. Cost tracker accumulates correctly
2. Alerts at 80%/100% thresholds
3. Fallback retries once then switches model
4. Wrapped generate records latency + token counts
5. LLM calls emit `llm_call` events
6. (Integration) Real OpenRouter call returns structured output

**DoD:** Models configured via env vars. Cost tracking + fallback work. `llm_call` events emitted. Tests pass.

**Context docs:** `brain-algorithm.md` S2, S12, `cost-strategy.md` S6, `tech-stack.md` S3

---

### Task 3.2: Wake-Up Sequence and Daily Planning

**Description:** Summarize yesterday, generate daily plan (5-8 activities), hourly blocks, action queue (5-15 min steps). Variety scoring penalizes recent activities. Store all plans as memories.

**Key files:** `packages/agent-brain/src/planning/` (wake-up, daily-planner, hourly-planner, action-decomposer, variety-scoring), tests

**TDD:**
1. Variety scoring: <2h = 0.2, <6h = 0.5, <12h = 0.8, >24h = 1.2
2. Daily plan has 5-8 activities
3. Hourly plan decomposes daily plan
4. Action queue produces 5-15 min steps
5. All plans stored as memories with correct types/importance
6. (Integration) Full wake-up produces valid plan hierarchy

**DoD:** `wakeUp()` generates daily -> hourly -> action queue. Variety scoring works. Plans stored as memories. Tests pass.

**Context docs:** `brain-algorithm.md` S3.2, S5, S7, `agent-spec.md` S6

---

### Task 3.3: Core Tick Loop (Observe, Act, Persist)

**Description:** Main 30s tick loop. Environment perception, importance scoring (Mistral), embedding, memory storage, action dequeuing, renderer commands, state persistence. Skip reflection/emotion/awakening (placeholders).

**Key files:** `packages/agent-brain/src/loop/` (tick-loop, observe, act, persist), `packages/agent-brain/src/environment/` (world-state, perception), `packages/agent-brain/src/state/agent-state-manager.ts`, tests

**TDD:**
1. `perceive_environment()` detects state changes
2. Importance scoring calls classify model, returns 1-10
3. Observations stored with embeddings
4. `importance_accumulator` accumulates
5. Action dequeue handles empty queue (decompose next hour)
6. Action execution sends renderer commands
7. State persistence saves/loads correctly (crash recovery)
8. `tick_start`/`tick_end` events emitted

**DoD:** Tick runs every 30s. Observations scored + stored. Actions executed via renderer. State persisted. Crash recovery works. Tests pass.

**Context docs:** `brain-algorithm.md` S3.3 steps 1/5/7, `agent-spec.md` S10

---

### Task 3.4: React-or-Continue, Replanning, and Vocalization

**Description:** When importance >= 6, should-react decision (classify model). If yes, replan (think model). All 6 replanning triggers. Vocalization: `should_vocalize()` probability table, `determine_bubble_type()`, speech -> TTS queue, thought -> renderer only.

**Key files:** `packages/agent-brain/src/loop/` (react, vocalize), `packages/agent-brain/src/planning/replan.ts`, tests

**TDD:**
1. Significant obs detection (importance >= 6)
2. Should-react uses classify model
3. Replanning generates new action queue
4. All 6 triggers: significant obs, viewer event, failure, boredom, queue empty, physical state
5. Vocalization probability matches S9.1 table
6. `determine_bubble_type()` correct
7. Speech -> TTS queue, thought -> renderer only
8. Events: `react_decision`, `replan`, `vocalization`
9. Last-20 action tracking

**DoD:** React-or-continue works. All replan triggers. Vocalization probabilities match spec. Speech goes to TTS, thoughts to renderer. Events emitted. Tests pass.

**Context docs:** `brain-algorithm.md` S3.3 steps 4/6, S5.2, S9

---

**Stage 3 DoD:** Brain runs continuous tick loop. Plans day, perceives environment, executes actions, sends renderer commands, vocalizes. Replanning on significant events. State persists for crash recovery.

---

## Stage 4: Emotion, Reflection, and Awakening

**Goal:** 7-dimension emotion model, reflection system, awakening arc, personality evolution — the systems that make Truman feel alive.
**Assumptions:** Stage 3 complete.

### Task 4.1: Emotion System

**Description:** 7 emotion dimensions. Time decay (2%/tick toward defaults). Rule-based updates (success/failure/favorites/boredom/physical). LLM evaluation every 5th tick. Floors/ceilings. `overallMood`. Physical state (energy, hunger, tiredness).

**Key files:** `packages/agent-brain/src/state/` (emotions, emotion-rules, emotion-llm, physical-state), tests

**TDD:**
1. Time decay: 2% drift toward default per tick
2. Rules: success -> happiness +0.05, failure -> frustration +0.08, etc.
3. Floors: happiness >= 0.2, anxiety <= 0.6, frustration <= 0.7
4. Ceilings: boredom <= 0.9
5. Physical: hunger > 0.7 -> frustration +0.02/tick
6. LLM eval runs only every 5th tick
7. `overallMood` calculation
8. Recovery: negative emotions -> default within 2-3 hours
9. `emotion_update` events with deltas and source

**DoD:** All 7 dimensions update correctly. Decay + rules + LLM eval + floors/ceilings. Physical state. Events emitted. Tests pass.

**Context docs:** `agent-spec.md` S4, `brain-algorithm.md` S10, `design-spec.md` S3

---

### Task 4.2: Reflection System

**Description:** When `importance_accumulator >= 150`: retrieve last 100 obs, generate 2-3 questions (think model), retrieve evidence (k=10) per question, synthesize insight, store as reflection with source links, reset accumulator. Reflection trees (reflections referencing reflections).

**Key files:** `packages/agent-brain/src/loop/` (reflect, reflection-questions, reflection-synthesis), tests

**TDD:**
1. Triggers at accumulator >= 150, not before
2. 2-3 questions generated
3. Evidence retrieved per question (k=10)
4. Insight is first-person
5. Reflection importance > max source importance
6. Source links created in `reflection_sources`
7. Accumulator resets to 0
8. Events: `reflection_trigger`, `reflection_result`
9. Reflection tree: reflection can reference other reflections

**DoD:** Full reflection pipeline. Source linking. Tree depth unbounded. Events emitted. Tests pass.

**Context docs:** `brain-algorithm.md` S6, `agent-spec.md` S5.5

---

### Task 4.3: Awakening Arc System

**Description:** `AwakeningState` management. Suspicion 0.0-1.0. 5 phases with correct thresholds. Anomaly logging. Suspicion triggers with impact ranges from spec. Prompt modifiers scaling with suspicion level.

**Key files:** `packages/agent-brain/src/state/` (awakening, anomaly-tracker, prompt-modifiers), tests

**TDD:**
1. Initial: suspicion = 0.0, phase = 'unaware'
2. Triggers: env change +0.001-0.01, door investigation +0.05-0.10
3. Phase transitions at 0.15, 0.35, 0.55, 0.75
4. Anomaly log (description, severity, reaction, dismissed)
5. Prompt modifiers scale with suspicion
6. `awakening_update` events
7. Viewer-influenced obs increment suspicion
8. Deceleration when anomalies rationalized

**DoD:** All triggers from `agent-spec.md` S7.2. Phase transitions correct. Prompt modifiers scale. Persists across restarts. Tests pass.

**Context docs:** `agent-spec.md` S7, `design-spec.md` S2.3, `brain-algorithm.md` S3.3

---

### Task 4.4: Personality Evolution and System Prompt Assembly

**Description:** 5 personality traits shifting based on activities. System prompt assembler: 5 layers (core identity, backstory, current state, behavioral rules, awakening modifiers). Truman's backstory with gaps/inconsistencies. Preferences evolution.

**Key files:** `packages/agent-brain/src/state/` (personality, preferences), `packages/agent-brain/src/prompts/` (system-prompt, backstory, behavioral-rules), tests

**TDD:**
1. Personality: philosophy -> introspection+, exercise -> confidence+
2. Preferences: eating pizza 5x -> develops dislike
3. System prompt contains all 5 layers
4. Layer 5 awakening modifiers scale with suspicion
5. Layer 4 has injection resistance
6. Total prompt < 4000 tokens

**DoD:** Traits shift from activities. Preferences evolve. 5-layer prompt assembly. Backstory with awakening seeds. PG-13 + injection resistance. Tests pass.

**Context docs:** `agent-spec.md` S3-4, `design-spec.md` S2, S7, `security-spec.md` S5

---

**Stage 4 DoD:** Truman has emotions, generates reflections, tracks suspicion, evolves personality. System prompt adapts dynamically.

---

## Stage 5: Brain-Renderer Integration (Visual Agent)

**Goal:** Wire brain to renderer end-to-end. Activity execution, sleep cycle, startup orchestrator. First "living" demo — Truman autonomously lives in his room.
**Assumptions:** Stages 0-4 complete.

### Task 5.1: Activity Execution Engine

**Description:** Map 8 activity types to renderer command sequences: moveTo(object), playAnimation(state), duration timer, showBubble(). Include ~25% failure mechanic with activity-specific failures.

**Key files:** `packages/agent-brain/src/activities/` (activity-executor, activity-types, activity-outcomes, renderer-mapping), tests

**TDD:**
1. Each activity maps to correct object + animation
2. ~25% failure rate over 100 trials
3. Failure types match activity
4. Correct renderer command sequence generated
5. Completion stores observation
6. Failure triggers frustration +0.08

**DoD:** All 8 activities produce renderer sequences. Failures trigger emotions. `action_start`/`action_result` events emitted. Tests pass.

**Context docs:** `design-spec.md` S5, `visual-spec.md` S4, `brain-algorithm.md` S3.3

---

### Task 5.2: Sleep Cycle and Day/Night

**Description:** Bedtime routine (wind-down), sleep state (tick interval 300s, no LLM calls, sleeping animation), wake-up trigger, maintenance window (4am-5am = "deep sleep").

**Key files:** `packages/agent-brain/src/loop/` (sleep-cycle, day-night), `packages/agent-brain/src/activities/routines.ts`, tests

**TDD:**
1. Sleep tick interval = 300s
2. No LLM calls during sleep
3. Bedtime routine executes
4. Wake-up at correct time
5. Maintenance window keeps deep sleep
6. Sleep duration 6-8 hours

**DoD:** Full day/night cycle works. Sleep saves costs. Maintenance window integrated. Tests pass.

**Context docs:** `brain-algorithm.md` S3.4, `design-spec.md` S5.8, `visual-spec.md` S8.2

---

### Task 5.3: End-to-End Integration and Startup

**Description:** Main entry point: DB connect -> state recovery -> BullMQ workers -> renderer start -> tick loop. Graceful shutdown. Demo mode (mock LLM, no API keys). Dockerfile.

**Key files:** `packages/agent-brain/src/` (index, startup, shutdown), `packages/agent-brain/src/demo/` (mock-llm, demo-mode), Dockerfile, update `docker-compose.yml`

**TDD:**
1. Startup: DB -> state recovery -> BullMQ -> tick loop
2. Shutdown: persist state -> drain queues -> disconnect
3. Crash recovery: start with existing DB state
4. Demo mode runs without API keys

**DoD:** `npm start` runs full loop. Crash recovery works. Demo mode works. Docker builds. Brain visibly drives renderer. Tests pass.

**Context docs:** `brain-algorithm.md` S12.3, `tech-stack.md` S9

---

**Stage 5 DoD:** Launching the system shows Truman autonomously living: waking, planning, walking, doing activities, thinking, sleeping. Works in demo mode (no API keys) and real mode (OpenRouter).

---

## Stage 6: Streaming Pipeline

**Goal:** XVFB + Chromium + FFmpeg captures Phaser and streams via RTMP. Watchdog auto-recovers.
**Assumptions:** Stage 5 complete.

### Task 6.1: XVFB and Headless Chromium

**Description:** XVFB display `:99` at 1920x1080. Chromium (non-headless) on virtual display, pointing at renderer URL. Chromium recycling every 4-8h with "deep thought" narrative cover. Dockerfile with all deps.

**Key files:** `packages/stream-manager/src/` (xvfb, chromium, recycler), Dockerfile, tests

**DoD:** XVFB + Chromium run. Recycling every 4-8h. Narrative cover. Dockerfile works. Tests pass.

**Context docs:** `tech-stack.md` S5.2, S5.4, S7

---

### Task 6.2: FFmpeg Streaming Pipeline

**Description:** FFmpeg: x11grab input, H.264 veryfast zerolatency 4500kbps, AAC 160kbps 44100Hz, FLV output to RTMP. PulseAudio virtual sink. Reconnection logic.

**Key files:** `packages/stream-manager/src/` (ffmpeg, audio-mixer, rtmp, stream-config), tests

**DoD:** FFmpeg captures XVFB + PulseAudio. Encoding matches spec. Reconnection configured. Stream key from env var. Tests pass.

**Context docs:** `tech-stack.md` S7, `visual-spec.md` S2, S9.4

---

### Task 6.3: Watchdog and Stream Health

**Description:** Monitor FFmpeg (30s), Chromium (30s), XVFB (60s), memory (30s, recycle at 2GB), stream health (60s, verify RTMP). Discord webhook alerts. Main orchestrator.

**Key files:** `packages/stream-manager/src/` (watchdog, health-checks, alerts, index), tests

**DoD:** Watchdog auto-restarts crashed processes. Memory threshold triggers recycle. Discord alerts. Health endpoint reports stream status. Tests pass.

**Context docs:** `tech-stack.md` S7.3

---

**Stage 6 DoD:** XVFB + Chromium + FFmpeg pipeline streams Phaser output via RTMP. Watchdog auto-recovers. Chromium recycles periodically.

---

## Stage 7: TTS and Audio

**Goal:** Truman speaks aloud. Ambient sounds. Audio mixing.
**Assumptions:** Stage 6 complete.

### Task 7.1: TTS Service (Kokoro-82M / OpenAI)

**Description:** BullMQ worker for `agent:speak` queue. OpenAI-compatible client (Kokoro-FastAPI at localhost:8880, switchable to OpenAI). Pre-TTS output filter. PCM to PulseAudio. Cost tracking for OpenAI mode.

**Key files:** `packages/tts-service/src/` (index, tts-client, worker, output-filter, audio-output), Dockerfile, tests

**DoD:** TTS processes `agent:speak` jobs. Supports Kokoro + OpenAI (env var switch). Output filter from `security-spec.md` S4.2. PCM piped to PulseAudio. Docker + Kokoro container in compose. Tests pass.

**Context docs:** `tech-stack.md` S6, `cost-strategy.md` S2, S7.1, `security-spec.md` S4.2, `visual-spec.md` S9.1

---

### Task 7.2: Ambient Sound and Audio Mixing

**Description:** Activity-triggered sounds (cooking sizzle, typing, page turning). Weather sounds. Always-on clock ticking. Volume levels per source from spec. PulseAudio mixing.

**Key files:** `packages/tts-service/src/ambient/` (ambient-manager, sound-triggers, audio-player, mixer-config), tests

**DoD:** All ambient sounds from `visual-spec.md` S9.2 mapped. Volumes match spec. Clock always at 10%. Activity/weather sounds trigger correctly. PulseAudio mixing works. Tests pass.

**Context docs:** `visual-spec.md` S9.2-9.4

---

**Stage 7 DoD:** Truman speaks aloud for speech bubbles. Ambient sounds play. Audio mixed into RTMP stream.

---

## Stage 8: Chat & Viewer Interaction

**Goal:** Twitch + YouTube integration. Sanitizer pipeline. Voting, Channel Points, polls. Environment translation. Letters, newspaper, chaos mode.
**Assumptions:** Stages 0-7 complete. Twitch/YouTube API credentials available.

### Task 8.1: Chat Ingestion and Sanitizer Pipeline

**Description:** Twurple (Twitch chat + EventSub) + YouTube googleapis polling. Normalize to `ViewerEvent`. 3-layer sanitizer: regex blocklist, AI classification (Mistral Small 3), operator review queue. Rate limiting.

**Key files:** `packages/chat-service/src/` (index, twitch/client, youtube/client, normalize, sanitizer/{pipeline, regex-blocklist, ai-classifier, review-queue}, rate-limiter), Dockerfile, migration for `operator_review_queue`, tests

**TDD:**
1. Regex catches slurs, injection patterns, URLs, zalgo
2. AI classifier rejects injections (confidence > 0.8)
3. Pipeline processes all 3 layers in order
4. Rate limits enforced per `interaction-spec.md` S6.2
5. ViewerEvent normalization from both platforms
6. Review queue stores items for approval

**DoD:** Both platforms connected. Messages normalized. 3-layer sanitizer. Rate limiting. Operator queue. Tests pass.

**Context docs:** `security-spec.md` S3, S5, `interaction-spec.md` S5-6, `tech-stack.md` S8

---

### Task 8.2: Voting System and Polls

**Description:** Tier 1: chat votes (5-min windows). Tier 2: Channel Points (10-min cooldowns). Tier 3: hourly polls (Twitch Polls API, system-generated options). Vote aggregator, duplicate detection.

**Key files:** `packages/chat-service/src/voting/` (vote-aggregator, poll-manager, channel-points, option-generator, duplicate-detector), tests

**DoD:** All 3 tiers work. Results published to `chat:event` queue. Duplicate detection. Interaction metrics tracked. Tests pass.

**Context docs:** `interaction-spec.md` S3, S6-7, `tech-stack.md` S8

---

### Task 8.3: Environment Translation Layer

**Description:** Viewer events -> world state changes (food in fridge, weather, doorbell). Indirection principle. Mood-driven refusal rate (~30% avg). `viewer_influenced: true` on observations.

**Key files:** `packages/chat-service/src/environment/` (event-translator, world-changes), `packages/agent-brain/src/environment/` (viewer-events, resistance), tests

**TDD:**
1. Vote "cook pasta" -> food in fridge
2. Channel Points weather -> weather shifts 30 min
3. Refusal: happy ~15%, frustrated ~45%, neutral ~30%
4. `viewer_influenced: true` set
5. Significant viewer events trigger replanning

**DoD:** All event types mapped. Indirection maintained. Resistance mechanic works. Tests pass.

**Context docs:** `brain-algorithm.md` S8, `interaction-spec.md` S2-3, `design-spec.md` S5.9

---

### Task 8.4: Letters, Newspaper, Chaos Mode

**Description:** Letters (24h aggregation, AI rewrite, operator review). Newspaper (weekly). Chaos mode (modified params: 2-min votes, 15-min polls, 3-min cooldowns, ~15% refusal).

**Key files:** `packages/chat-service/src/letters/`, `packages/chat-service/src/newspaper/`, `packages/chat-service/src/chaos/`, tests

**DoD:** Letters: aggregation -> rewrite -> review -> delivery. Newspaper weekly. Chaos mode modifies params. Safety bounds maintained. Tests pass.

**Context docs:** `interaction-spec.md` S4, S7, `security-spec.md` S3.3

---

**Stage 8 DoD:** Viewers interact via votes, Channel Points, polls, letters. Inputs sanitized. Changes reach Truman as observations. Resistance mechanic works. Chaos mode toggles.

---

## Stage 9: Admin Dashboard

**Goal:** Operator monitoring + emergency controls + content review.
**Assumptions:** Stages 0-8 complete.

### Task 9.1: Admin Dashboard Backend

**Description:** API: agent state, cost tracking, event log queries, content review queue (approve/reject), emergency controls (kill switch, mute, safe mode, content freeze, force sleep). Auth: password + session.

**Key files:** `apps/admin-dashboard/src/api/` (server, routes/{state, costs, events, review, emergency}, auth), tests

**DoD:** All emergency controls work. Content review CRUD. Real-time state. Cost tracking. Auth required. Tests pass.

**Context docs:** `security-spec.md` S7, `observability-spec.md`, `cost-strategy.md` S6

---

### Task 9.2: Admin Dashboard Frontend

**Description:** React/Preact dashboard: real-time state, cost tracker (alerts at 80%/100%), event timeline, review queue, emergency panel. Dark theme. WebSocket.

**Key files:** `apps/admin-dashboard/src/ui/` (App, components/{StatePanel, CostTracker, EventTimeline, ReviewQueue, EmergencyPanel}, hooks/useWebSocket)

**DoD:** Real-time state updates. Cost alerts visual. Event timeline filterable. Review approve/reject. Emergency controls one-click. Dark theme. Responsive.

**Context docs:** `security-spec.md` S7.3

---

**Stage 9 DoD:** Operators can monitor, review content, manage costs, trigger emergency controls.

---

## Stage 10: Companion Website

**Goal:** Public second-screen: stream embed, status, voting, journal.
**Assumptions:** Stages 0-8 complete.

### Task 10.1: Companion Website Backend + Frontend

**Description:** WebSocket for real-time state. REST for journal entries + active votes. Frontend: stream embed (Twitch/YouTube), status panel, voting UI, journal, about/FAQ. Dark theme, responsive, mobile-friendly.

**Key files:** `apps/companion-web/src/server/` (index, websocket, routes/{status, journal, votes}), `apps/companion-web/src/ui/` (App, components/{StreamEmbed, StatusPanel, VotingUI, Journal, About}), Dockerfile, tests

**DoD:** Stream embed works. Status updates real-time. Voting functional. Journal displays entries. AI disclosure in about. Responsive + mobile. Docker builds.

**Context docs:** `visual-spec.md` S10

---

**Stage 10 DoD:** Companion website live with stream, voting, journal, about.

---

## Stage 11: Production Hardening

**Goal:** Monitoring, output filtering, observability export, cost enforcement, maintenance mode.
**Assumptions:** All previous stages complete.

### Task 11.1: Monitoring (Beszel + Uptime Kuma)

**Description:** Deploy Beszel + Uptime Kuma. Configure monitors for all services. Discord alerts. Verify all `/health` + `/metrics` endpoints.

**Key files:** Update `docker-compose.yml`, `config/beszel/`, `config/uptime-kuma/`, `scripts/setup-monitoring.sh`

**DoD:** Beszel monitors all containers. Uptime Kuma monitors endpoints. Discord alerts. < 60 MB RAM total. Tests pass.

**Context docs:** `tech-stack.md` S10, `observability-spec.md` S8

---

### Task 11.2: Output Filtering and Security Hardening

**Description:** Real-time output filter: regex scan, tone classifier (distress/anger), length checks, replacement behavior. Docker secrets for production.

**Key files:** `packages/agent-brain/src/safety/` (output-filter, tone-classifier, content-validator), update `docker-compose.yml`, tests

**DoD:** All generated text filtered. Blacklisted terms replaced with neutral actions. Tone classifier detects distress. Incidents logged + alerted. Docker secrets configured. Tests pass.

**Context docs:** `security-spec.md` S4, S9

---

### Task 11.3: Observability Export and Cost Protection

**Description:** 8 SQL export scripts from `observability-spec.md` S7.1. Cost enforcement: 80% -> reduce ticks, 100% -> sleep mode. Maintenance mode (4am-5am). Data retention cleanup (30-day rolling).

**Key files:** `scripts/observability/` (8 export SQL files, run-export.sh), `packages/agent-brain/src/safety/cost-enforcer.ts`, `packages/agent-brain/src/loop/maintenance-mode.ts`, tests

**DoD:** All 8 exports produce valid JSON. Total < 3.5 MB. Cost enforcer integrated with tick loop. Maintenance mode as narrative "deep sleep". 30-day retention cleanup. Tests pass.

**Context docs:** `observability-spec.md` S7, `cost-strategy.md` S6, `design-spec.md` S5.8

---

**Stage 11 DoD:** Production-hardened: monitored, alerted, cost-protected, output-filtered, observable. Feedback protocol operational.

---

## Stage 12: Launch Preparation

**Goal:** E2E tests, performance validation, platform compliance, launch.
**Assumptions:** All previous stages complete.

### Task 12.1: End-to-End Integration Tests

**Description:** E2E tests: brain -> renderer -> stream, viewer event -> sanitizer -> environment -> brain, TTS -> audio -> stream, crash recovery, 1-hour unattended soak test.

**Key files:** `tests/e2e/` (full-loop, viewer-interaction, audio-pipeline, crash-recovery, cost-tracking, 1-hour-soak)

**DoD:** Full loop E2E passes. Viewer pipeline E2E passes. Audio E2E passes. Crash recovery works. 1-hour soak: no errors, no memory leaks.

---

### Task 12.2: Performance Validation and Platform Compliance

**Description:** Validate CX32 fit (peak memory < 6 GB, peak CPU < 80%). Stream quality (1080p 30fps, < 1% dropped frames). Review Twitch/YouTube AI policies. Prepare stream metadata.

**Key files:** `scripts/perf-benchmark.sh`, `docs/platform-compliance.md`, `config/stream-metadata.json`

**DoD:** Resources within CX32 limits. Stream quality verified. Platform compliance reviewed. `[AI Character]` in titles. AI disclosure in descriptions.

---

### Task 12.3: Launch Checklist and Go-Live

**Description:** Launch checklist, seed initial state (day 1 backstory/memories), production env config, operational runbook, go-live sequence.

**Key files:** `docs/launch-checklist.md`, `docs/runbook.md`, `scripts/seed-initial-state.ts`, `config/production.env.example`

**DoD:** Checklist covers all subsystems. Initial state seeded. Production configured. Runbook documented. Go-live sequence tested in staging.

---

**Stage 12 DoD:** System passes E2E tests, fits resources, complies with platforms, has documented launch procedure. Ready to go live.

---

## Summary

| Stage | Tasks | Focus | Key Deliverable |
|-------|-------|-------|-----------------|
| 0 | 4 | Foundation | Monorepo, Docker, DB, shared types |
| 1 | 4 | Memory | Park et al. scoring, reflections, event log |
| 2 | 4 | Renderer | Phaser room, character, HUD, bubbles |
| 3 | 4 | Brain Core | Tick loop, LLM routing, planning, vocalization |
| 4 | 4 | Emotions/Awakening | 7-dim emotions, reflections, suspicion arc |
| 5 | 3 | Integration | Activities, sleep cycle, startup orchestrator |
| 6 | 3 | Streaming | XVFB, FFmpeg, watchdog |
| 7 | 2 | Audio | TTS, ambient sounds |
| 8 | 4 | Chat | Sanitizer, voting, environment translation |
| 9 | 2 | Admin | Dashboard backend + frontend |
| 10 | 1 | Website | Companion site |
| 11 | 3 | Hardening | Monitoring, filtering, exports |
| 12 | 3 | Launch | E2E tests, compliance, go-live |
| **Total** | **41** | | |
