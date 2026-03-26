# Changelog

## [Stage J — Tool Framework + Brave Search] - 2026-03-26

### Added
- `ToolRegistry` class — registers tools with metadata, maps activities to available tools, filters by budget
- `BudgetManager` class — daily tool call budget (20 calls/day default), midnight UTC reset, hard-blocks when exceeded
- Web Search tool (Brave Search API) — real internet search via `BRAVE_SEARCH_API_KEY`, Zod-validated input/output
- Blog Post tool (placeholder) — saves draft to memory, does not publish
- Artwork tool (placeholder) — saves concept to memory, does not generate images
- `generateWithTools()` in LLMClient — Vercel AI SDK `generateText()` with tools + `stopWhen(stepCountIs(N))`
- Config extension: `tools.maxCallsPerDay`, `tools.enabledTools`, `interests` array in `truman-config.json`
- `.env.example` updated with `BRAVE_SEARCH_API_KEY`
- Tests: 28 new tests (ToolRegistry mapping, BudgetManager tracking, Zod schemas, config validation)

### Security
- `BRAVE_SEARCH_API_KEY` accessed only from env vars, never hardcoded (SJ.1)
- Zod validation on all tool inputs (SJ.2)
- Budget hard-blocks tool calls when exceeded (SJ.3)
- All tests pass (SJ.4)

## [Stage I — Reset UI + Day Counter HUD] - 2026-03-26

### Added
- HUD day counter: "Day X" text in bottom-left corner (Press Start 2P font, 10px, 70% alpha)
- ConfigPanel save stats: Day, Session #, Alive time, Last saved Xs ago (auto-refresh every 2s)
- Soft reset button (yellow): resets position to center, emotions to defaults, preserves dayCount/createdAt/memories
- Hard reset button (red): clears all save data (localStorage + DB state), requires `confirm()` dialog
- URL params: `?reset=soft` and `?reset=hard` for dev tools (no confirm dialog, page reloads)
- Save version migration: version mismatch in SaveManager.load() → discard + log warning (TI.6)
- Tests: 16 new tests covering day counter math, soft/hard reset logic, URL params, version migration, stats formatting

### Security
- Hard reset requires browser `confirm()` dialog to prevent accidental data loss (SI.1)
- All tests pass (SI.2) — pre-existing failures unchanged

## [Stage H — Recovery Integration: Restore on Startup] - 2026-03-26

### Added
- `BrainLoop.restoreState()` method — recovers tickCount, currentActivity, mood, recentActivities from save
- Renderer recovery: Truman's position and facing direction restored from save on page load
- Emotion recovery: `EmotionEngine` initialized from saved emotion state
- Offline time compensation: emotion drift toward defaults based on elapsed offline time, Truman "sleeps" if offline > 8h
- Dirty flag with position tracking: state marked dirty when Truman moves > 10px (checked every 2s)
- Save data passed through startup pipeline: `initSaveManager()` → `restoreRendererState()` → `initBrain()`
- Tests: brain state recovery (5), emotion recovery (1), offline compensation (3), dirty flag logic (1), day counter (3) — 14 new tests

### Security
- No secrets in SaveData — only game state (emotions, position, activities) persisted (SH.1)
- All tests pass (SH.2)

## [Stage G — State Persistence: SaveManager + REST API] - 2026-03-26

### Added
- `SaveData` type + Zod schema (`packages/shared/src/types/save-data.ts`) — versioned save format with emotions, position, day counter, session tracking
- REST endpoints on HealthServer: `POST /state/save` (PostgreSQL via StatePersistence), `GET /state/load/:agentId`
- `SaveManager` class (`packages/renderer/src/systems/SaveManager.ts`) — dual persistence: REST API primary, localStorage fallback, auto-detects backend
- Save triggers in browser: `visibilitychange`, `pagehide` (sendBeacon), periodic 30s, activity change
- Day counter logic: `createdAt` (first-ever run), `dayCount`, `totalTimeAliveMs`, `sessionCount`
- Tests: SaveData Zod validation (16 tests), state endpoint tests (8 tests), day counter math

### Security
- CORS on HealthServer restricted to `localhost:*` origins only (SG.1)
- Zod validation on POST /state/save rejects invalid payloads (SG.2)
- Agent ID hardcoded to "truman" — user input ignored (SG.3)

## [Stage 12 — AI Asset Pipeline: Retro Diffusion] - 2026-03-25

### Added
- Asset generation pipeline (`scripts/generate-assets.sh`) using Replicate API (Retro Diffusion models)
- 14 AI-generated room object sprites (rd-plus, transparent background, 16-32 color quantization)
- Truman walk + idle spritesheets (rd-animation) with 8 activity poses (rd-plus static)
- Phaser asset loader: `BootScene` preloads PNGs from `public/sprites/`, falls back to programmatic `generateTexture()` if missing
- Truman PNG sprite with mood face overlay switching (replaces RenderTexture approach)
- Asset prompt config (`config/asset-prompts.json`) with batch generation + retry

### Changed
- Room objects render from AI-generated PNGs instead of Graphics API shapes
- TrumanSprite uses Phaser Sprite with atlas instead of RenderTexture

### Removed
- Stage 11 (Shaders & Lighting) — removed entirely, conflicts with bright room design and FLUX baked backgrounds
- Tileset generation — room uses FLUX background PNG, not tiled floor/wall
- Normal map generation — depended on removed Stage 11

### Security
- Replicate API key (`REPLICATE_API_TOKEN`) externalized to `.env`
- Generated assets are PNG files only, no executable content

## [Stage 9 — Streaming & Production] - 2026-03-25

### Added
- FFmpeg RTMP streaming pipeline (XVFB + x11grab → Twitch/YouTube)
- Browser recycling & watchdog: Chromium restart every 4-8h, memory ceiling (>2GB → recycle)
- Twitch bot (Twurple): `!status`, `!mood`, `!activity` commands, Channel Points ("Change weather", "Send letter"), voting system with time windows
- Docker Compose production stack: app, streamer, postgres, redis, Caddy (auto-HTTPS)
- Companion website MVP: stream embed, live status, active votes, dark theme, AI disclosure
- VPS hardening script: UFW firewall (22/80/443), Fail2ban, unattended upgrades, SSH hardening

### Security
- 3-layer chat sanitizer: profanity filter → context check → injection detection
- Fixed regex `g` flag lastIndex bug in injection detection patterns
- 22 negative test cases for sanitizer (XSS, SQL injection, prompt injection, profanity variants)
- Stream keys externalized to `.env` via RTMP_URL (never in source code)
- Log masking strips sensitive URL params before logging
- All Docker containers run as non-root users
- `[AI Character]` disclosure on companion website + mandated in stream title

### Documentation
- Full AI disclosure section on companion website
- Security spec compliance verified

## [Stage 8 — Audio & Voice: Complete] - 2026-03-25

### Added
- WebAudio mixer with 3 channels: voice, ambient, music (AudioMixer)
- Ambient sounds: clock ticking, keyboard, cooking sizzle, page turn, exercise breathing
- Background music: lo-fi tracks with mood-based crossfade (happy/sad/curious)
- Audio-visual sync: mouth animation during TTS playback, speech bubble timing
- "Click to start" overlay — satisfies browser autoplay policy before game loads

### Security
- TTS API key passed via URL params only, never hardcoded (verified via grep scan)
- `.env.example` has TTS_API_KEY placeholder for server-side usage
- Audio autoplay policy handled: user click/touch required before game starts

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
