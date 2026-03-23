# STACK_GUIDELINES.md — No True Man Show

**Data:** 2026-03-23
**Bazuje na:** `TECH_STACK.md`, `docs/tech-stack.md`, `tech-stack-research.md`

---

## Must-Have na Start

### TypeScript
- Strict mode (`"strict": true` w tsconfig)
- Path aliases: `@nts/shared`, `@nts/agent-brain`, `@nts/memory-service`, `@nts/renderer`
- Zod schemas na wszystkich granicach między pakietami (structured LLM output, event payloads, config)
- Eksportuj typy przez `package.json` `"exports"` field

### Turborepo
- `turbo build`, `turbo test`, `turbo typecheck` muszą działać od Stage 1
- Cache: domyślny local cache (bez remote na MVP)
- Pipeline: build → typecheck → test (z zależnościami `^build`)

### Phaser 3
- **ZAWSZE** `Phaser.CANVAS` lub `Phaser.WEBGL` — nigdy `Phaser.HEADLESS`
- `pixelArt: true` w game config
- 30 FPS lock (`fps: { target: 30 }`)
- Object pooling — nigdy `new Sprite()` w hot loop
- Aseprite export format dla sprite'ów i animacji

### PostgreSQL + pgvector
- Drizzle ORM — parametryzowane zapytania, zero surowego SQL ze zmiennymi
- HNSW index z `m=16, ef_construction=64`
- Migracje przez Drizzle Kit (`drizzle-kit generate`, `drizzle-kit push`)
- `vector(768)` dla nomic-embed-text embeddings

### Vercel AI SDK 6
- `generateText()` dla swobodnej generacji (myśli, mowa)
- `generateObject()` z Zod schema dla structured output (plany, emocje, klasyfikacja)
- OpenRouter jako provider — swap modeli via env var, zero code change
- Retry z exponential backoff na każdym LLM call

### BullMQ
- `maxRetriesPerRequest: null` w connection config (krytyczne dla 24/7)
- `removeOnComplete` i `removeOnFail` na każdej kolejce
- `concurrency: 1` dla agent brain (sekwencyjne myślenie)
- Typed job payloads (Zod schemas z `@nts/shared`)

### Testing (Vitest)
- Unit testy dla logiki biznesowej (emotion clamping, scoring, planning)
- Integration testy dla memory-service (prawdziwy PostgreSQL z Docker)
- Smoke testy dla renderera (dane layoutu, brak crash przy inicjalizacji)
- TDD dla backendu: test → fail → implement → pass

### Security Baseline
- `.env` w `.gitignore` — sekrety nigdy w repo
- Drizzle ORM eliminuje SQL injection
- Zod validation na LLM output — nigdy nie ufaj surowej odpowiedzi
- Rate limiting na LLM calls (cost cap per hour)
- Escapowanie tekstu przed renderowaniem w dymkach (XSS prevention)

---

## Dobrze Dodać Później

### Streaming Pipeline (post-MVP)
- XVFB + headless Chromium + FFmpeg x11grab → RTMP
- Browser recycling co 4-8h (memory leaks)
- FFmpeg auto-reconnect (`-reconnect 1 -reconnect_streamed 1`)
- Watchdog process (supervisord lub custom)

### TTS (post-MVP)
- OpenAI gpt-4o-mini-tts lub Kokoro-82M (self-hosted)
- PulseAudio virtual sink do audio mixing
- Queue: `tts:generate` w BullMQ

### Chat & Interaction (post-MVP)
- Twurple (@twurple/chat + @twurple/eventsub-ws + @twurple/api)
- googleapis dla YouTube Live Chat polling
- 3-layer sanitizer (profanity → context → injection detection)
- Vote aggregation z time window

### Observability (post-MVP, ale prepared)
- `/metrics` endpoint z prom-client od Stage 1 (gotowy na scrape)
- `/health` endpoint od Stage 1
- Beszel + Uptime Kuma jako Tier 1 monitoring
- Prometheus + Grafana gdy potrzeba custom dashboards

### Produkcja (post-MVP)
- Docker Compose z healthchecks i resource limits
- Caddy reverse proxy z auto-HTTPS
- Hetzner CPX31 (~€16/mies)
- Log rotation (json-file driver, max-size: 50m)

---

## Otwarte Decyzje

| Decyzja | Opcje | Kiedy podjąć |
|---|---|---|
| **Placeholder art vs ręczne sprite'y** | AI-generated (DALL-E/Stable Diffusion → pixel art) vs ręcznie w Aseprite | Stage 1 — potrzebne do renderowania |
| **Embedding model** | nomic-embed-text (Ollama, local) vs OpenAI text-embedding-3-small (API) | Stage 3 — przy implementacji memory |
| **Phaser CANVAS vs WEBGL** | CANVAS (prostszy, stabilniejszy) vs WEBGL (shader effects) | Stage 1 — przy konfiguracji Phaser |
| **Daily plan granularity** | Hourly blocks vs activity-level | Stage 2 — przy implementacji planowania |
| **Awakening arc aktywnie** | Tracking only (suspicion stays ~0) vs active triggers | Post-MVP |
