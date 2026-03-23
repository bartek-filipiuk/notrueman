# Changelog

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
