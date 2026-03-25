# Changelog

## [Stage 8 — Audio & Voice: Complete] - 2026-03-25

### Added
- Audio-visual sync: Truman's mouth animates (open/close at ~4Hz) during TTS playback
- Speech bubble pulsing glow indicator while TTS audio is playing
- TTSManager onSpeechStart/onSpeechEnd callbacks wired to TrumanSprite and ThoughtBubble
- TrumanSprite.setSpeaking(): toggles mouth overlay animation (works in both PNG and fallback modes)
- ThoughtBubble.setSpeaking(): pulsing blue border glow on speech bubbles during playback

### Fixed
- TrumanSprite: replaced `make.graphics({ add: false })` with `add.graphics().setVisible(false)` to fix Phaser 3.90 type error

## [Stage 13 — Room Layout PRO] - 2026-03-24

### Added
- AI-generated room background (384x216, Retro Diffusion, scaled to 960x540)
- Foreground depth gradient (dark edge at bottom for depth perception)
- Proper grounding shadows: floor objects get large ellipses, wall objects get tiny drop shadows
- Object position overhaul: floor items aligned to FLOOR_Y, wall items at y=100-200, bridging items span both

### Changed
- RoomScene.createBackground() uses AI PNG when available, programmatic fallback
- ROOM_OBJECTS positions reworked for dollhouse cutaway layout
- HUD bar color changed from cold black to warm dark brown (0x1a1008)
- Truman walks at y=420 (on the floor, not floating)

## [Stage 8 — Audio & Voice: T8.3 TTS] - 2026-03-24

### Added
- TTSClient: OpenAI gpt-4o-mini-tts API integration with mood-based emotional instructions
- TTSManager: speech queue (max 1 utterance), Web Audio API playback on AudioMixer voice channel
- Speech bubbles: pointed balloon tail (distinct from thought cloud-dots)
- ThoughtBubble.showSpeech() method with onSpeechBubbleShow callback for TTS sync
- RendererBridge routes show_bubble type "speech" to showSpeech handler
- URL params: ?tts=on, ?openaiKey=sk-..., ?voice=nova (10 voices supported)
- ConfigPanel: TTS status (enabled/disabled, voice, playing, queue size)
- 30% of AI brain thoughts become spoken-aloud speech bubbles (with TTS audio)
- tts-integration.test.ts: 18 tests for TTSClient, TTSManager, config, architecture

## [Stage 10 — Visual Pro Upgrade] - 2026-03-24

### Added
- WebGL rendering (switched from Canvas) with FX pipeline
- Press Start 2P font loaded via Google Fonts CDN
- CSS image-rendering: pixelated/crisp-edges for pixel-perfect canvas
- Camera PostFX: vignette (edge darkening) + bloom (subtle glow)
- ColorMatrix time-of-day lighting (replaces Rectangle overlay)
- Object glow PreFX on proximity (white halo when Truman nearby)
- Truman RenderTexture refactor with glow PreFX outline
- VisualFXConfig system — all effects toggleable, ?fx=off URL param
- Ambient dust particles in window light (warm-gold, ADD blend)
- CRT scanline overlay (optional, off by default)
- Depth sorting: Truman and objects sorted by Y position
- visual-pro.test.ts — config schema and rendering tests

### Changed
- Phaser config: antialias:false, roundPixels:true for pixel-perfect rendering
- Night mode reduced (was too dark with stacking vignette + ColorMatrix)
- Vignette reduced to 0.18 strength (was 0.35)
- TrumanSprite: Container+RenderTexture pattern (from Container+Graphics)
- Removed camera sine zoom breathing (caused sub-pixel shimmer)

## [Stage 7 — Visual Overhaul] - 2026-03-24

### Added
- 14 pixel art room objects (generateTexture): bed, desk, monitor, bookshelf, fridge, stove, table, easel, mat, window, clock, plant, poster, door
- Truman head-heavy sprite with 9 mood face variants, hair highlights, clothing detail
- HUD redesign: mood icons, dark top bar, pixel font
- Boot splash: fade-in title, tips, fade-out transition
- Lighting system: 5 day/night presets, corner shadows
- Window view: dynamic sky, clouds, sunset, stars, moon
- ParticleManager: Phaser emitters for activity effects (steam, sweat, sparkles, zzz)
- Camera breathing, scene fade-in

### Changed
- Warm beige walls with wallpaper pattern replacing cold purple
- Wooden plank floor with grain pattern
- Objects recognizable without text labels (labels removed)

## [Stage 6 — Post-MVP Integration] - 2026-03-24

### Added
- Brain ↔ Renderer integration: LLM (DeepSeek via OpenRouter) controls Truman's decisions in real-time
- `SceneHandler` adapter: bridges RoomScene to RendererHandler interface (`packages/renderer/src/adapters/SceneHandler.ts`)
- Browser-safe agent-brain entry point (`packages/agent-brain/src/browser.ts`) — excludes Node-only deps
- Dual mode: AI mode (with `?apiKey=` URL param) or demo mode (hardcoded activity loop)
- EmotionEngine integration: 7-dim emotions update after each tick, drive HUD mood and bubble colors
- Activity-specific emotion deltas (read→curiosity, exercise→happiness, failure→frustration)
- ConfigPanel debug overlay (toggle with `~` key): shows brain state, emotions, recent activities
- `@nts/shared/browser.ts` entry point: excludes BullMQ/ioredis for browser compatibility

### Changed
- `packages/renderer/src/main.ts` — complete rewrite: initializes BrainLoop + RendererBridge + EmotionEngine
- `packages/renderer/vite.config.ts` — Vite aliases for browser-safe @nts/shared and @nts/agent-brain
- `RoomScene` — added `getHUD()` method for SceneHandler access

## [Stage 5] - 2026-03-24

### Added
- Security audit report (docs/SECURITY.md) with threat model and implemented controls
- Security negative-case tests: LLM failure, DB down, embedding unavailable, bad config
- Edge case tests: emotion extremes, memory retrieval, cosine similarity, time boundaries
- Visual polish: smooth fade transitions, enhanced particle effects, sprite detail (shadow, shoes, collar)
- Mood-specific thought bubble styling (border radius, color, width per mood type)
- Smoke test suite for system health verification

### Changed
- HUD time display caches string to avoid redundant Phaser setText calls
- CognitiveLoop.updateRecentActivities() mutates in-place instead of creating new arrays
- Zod activity enums now derive from ACTIVITY_LIST (single source of truth)
- ThoughtBubble tracks fadeTween to prevent memory leaks on rapid show/hide
- ActivityManager catches unhandled promise rejections gracefully
- RendererBridge caps commandLog at 500 entries to prevent unbounded growth

### Fixed
- Extracted shared getTimeOfDay() and sleep() utilities to eliminate duplication
- RoomScene adds shutdown() for proper scene lifecycle cleanup

### Documentation
- Finalized README.md with architecture, extending guide, full doc index
- Updated CHANGELOG.md with Stage 5 entries
- Updated API.md with CognitiveLoop, EmotionEngine, and config interfaces
- Created SECURITY.md with full audit results

## [Stage 4] - 2026-03-24

### Added
- BullMQ queue infrastructure: agent:think, agent:action, renderer:command, log:event
- Zod job payload schemas for all queues (AgentThinkJob, AgentActionJob, RendererCommandJob, LogEventJob)
- Redis connection factory with maxRetriesPerRequest: null (24/7 critical)
- CognitiveLoop: full Observe → Retrieve → Plan → Act → Speak → Store cycle
- Day/night cycle with configurable sleep duration (4-6h), wake hour, HUD label
- Variety scoring updated: <2h=0.2x, <6h=0.5x, <12h=0.8x, >24h=1.2x bonus
- PhysicalStateEngine: energy, hunger, tiredness with activity effects and time drift
- Graceful error handling: LLM retry+fallback, memory/embedding failure tolerance
- Fastify health server: /health (JSON) and /metrics (Prometheus format)
- Config hot-reload: ConfigWatcher with fs.watch, invalid config rejected gracefully
- CostTracker: daily cost cap with 80% warning and 100% hard stop
- Endurance simulation tests (100 rapid ticks, mixed failure scenarios)
- 50+ new tests in agent-brain, 21 new queue tests in shared

## [Stage 3] - 2026-03-24

### Added
- Drizzle ORM schema: memories, reflection_sources, agent_state_snapshots tables
- Memory CRUD repository (createMemory, getMemory, updateLastAccessed, getRecentMemories)
- Embedding client with Ollama adapter (nomic-embed-text, 768 dims) and dev fallback
- Park et al. memory retrieval: score = recency * importance * relevance
- Importance scoring via classify model (1-10 scale, Zod validated)
- EmotionEngine: 7 dimensions, delta updates, time drift, mood computation
- Emotion-to-visual integration: all 9 mood types mapped to bubble styles
- Reflection generation: LLM synthesizes 1-3 insights from recent observations
- Memory-informed decisions: memories included as context in planning prompts
- Agent state persistence: save/load to PostgreSQL for restart recovery
- Added "bored" and "neutral" bubble styles
- 30+ tests in memory-service, 93 tests in agent-brain

## [Stage 2] - 2026-03-23

### Added
- Vercel AI SDK 6 + OpenRouter provider integration (dual model: DeepSeek think, Mistral classify)
- LLM client wrapper with generateText() and generateObject() methods
- Truman personality prompt (config/truman-personality.md) with dynamic loading
- Daily plan generation using DailyPlanSchema and generateObject()
- Action planning loop with anti-repetition variety scoring
- Thought generation for inner monologue (1-3 sentences, context-aware)
- Failure mechanic: ~25% activities fail (minor/comedic), LLM-generated reactions
- Brain-to-renderer bridge with command pattern (prepared for BullMQ)
- Main brain loop orchestrator with retry, fallback, and state tracking
- Config system (config/truman-config.json) with Zod validation
- Rate limiter for LLM cost control (configurable calls/minute, 80% warning)
- ActionCommandSchema for typed LLM action decisions
- 67 tests in agent-brain package

## [Stage 1] - 2026-03-23

### Added
- Phaser 3 game bootstrap with pixelArt mode (960x540, 30 FPS, CANVAS, FIT scale)
- Room scene with 14 interactive objects (bed, desk, computer, bookshelf, fridge, stove, table, easel, yoga mat, window, clock, plant, poster, door)
- Truman sprite (32x48 programmatic humanoid) with idle and walk animations
- Movement system with linear interpolation (80px/s) and `moveTo(Position)` API
- Activity renderer with 8 visual effects (sleep, eat, read, computer, exercise, think, cook, draw)
- Activity manager state machine cycling through all activities (idle -> move -> perform -> idle)
- HUD overlay: real-time 24h clock, mood display, activity label
- Thought bubble system with typewriter effect (50ms/char), mood-based colors, auto-fade
- Shared types: AgentState, EmotionState, RoomObject, ActivityType, Position, AnimationState, BubbleType
- Zod schemas: ActionCommand, EmotionDelta, ImportanceScore, DailyPlan, ActionQueue
- Docker Compose dev environment: PostgreSQL 17 + pgvector 0.8, Redis 7, Ollama
- Vite dev server with hot reload for renderer package
- 50+ tests across shared and renderer packages
