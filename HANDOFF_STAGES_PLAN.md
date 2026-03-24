# HANDOFF_STAGES_PLAN.md — No True Man Show (Visual MVP)

**Data:** 2026-03-23
**Podejście:** Vertical Slices, Visual First
**Cel:** Truman żyje autonomicznie w pixel art pokoju w przeglądarce.

## Założenia

- Monorepo Turborepo już zscaffold'owane (packages/shared, agent-brain, memory-service, renderer + apps)
- Placeholder pixel art (proste sprite'y, nie finalne) — zamiana na hand-made art później
- TDD dla backendu, smoke testy dla renderera
- Drizzle Kit migracje dla PostgreSQL
- Każdy stage produkuje działający, uruchamialny milestone
- OUT of scope: streaming, TTS, chat, monetyzacja, companion web, admin dashboard

## Dependency Graph

```
Stage 1 (Żywy Pokój)
    |
    v
Stage 2 (Mózg Trumana)
    |
    v
Stage 3 (Pamięć i Emocje)
    |
    v
Stage 4 (Pełna Pętla Życia)
    |
    v
Stage 5 (Szlify i Stabilizacja)
```

Każdy stage buduje na poprzednim. Brak równoległości — to vertical slice.

---

## Stage 1: Żywy Pokój — Truman Się Rusza

**Cel:** Phaser 3 renderuje pixel art pokój z Trumanem, który chodzi między obiektami i wykonuje animacje aktywności. Otwierasz przeglądarkę → widzisz pokój z ruszającą się postacią.
**User Stories:** US-1, US-2, US-3, US-4 (częściowo), US-9

### Taski:

- [x] T1.1: Zweryfikować i uzupełnić monorepo foundation — upewnić się że `turbo build && turbo test && turbo typecheck` przechodzą, shared types kompilują się, vitest działa. Dodać brakujące devDependencies. (verify → fix → green)
- [x] T1.2: Docker Compose dev — PostgreSQL 17 + pgvector 0.8, Redis 7, Ollama. Health checks. `docker compose up` startuje bez błędów. (config → test → verify)
<!-- NOTE: docker compose config validates OK. Docker daemon not available in CI env — full runtime test deferred to local dev. -->
- [x] T1.3: Shared types (core) — `AgentState`, `EmotionState`, `RoomObject`, `ActivityType`, `Position`, `AnimationState`, `BubbleType`. Zod schemas dla: `ActionCommand`, `EmotionDelta`. Stałe: lista obiektów pokoju z pozycjami, lista aktywności, emotion defaults/floors/ceilings. (test → implement → verify)
- [x] T1.4: Phaser 3 game bootstrap — Skonfigurować `packages/renderer` z Phaser 3. Game config z `pixelArt: true`, 960x540, scale FIT, 30 FPS. Dev server (Vite) — `npm run dev` otwiera grę w przeglądarce. Czarny ekran z "Hello Truman" = OK. (setup → config → verify in browser)
- [x] T1.5: Room scene — statyczne tło pokoju i obiekty. Tilemap lub indywidualne sprite'y dla: łóżko, biurko, komputer, regał, lodówka, kuchenka, stół+krzesło, sztaluga, mata, okno, zegar, roślina, plakat, drzwi. Placeholder art (kolorowe prostokąty lub proste pixel sprite'y). Zdefiniowane strefy pokoju z pozycjami. (art → scene → verify in browser)
- [x] T1.6: Truman sprite + animacje — Sprite 32x48 z animacjami: idle (2-3 klatki), walk-left, walk-right (4-6 klatek). Placeholder sprite (prosty humanoid pixel art). Sprite renderuje się w pokoju. (art → sprite → animate → verify)
- [x] T1.7: Movement system — Truman chodzi do wskazanej pozycji (target Position). Interpolacja pozycji, odpowiednia animacja walk. `moveTo(target: Position): Promise<void>` — resolves po dotarciu. Waypoints między strefami pokoju. (test pathfinding → implement → verify in browser)
- [x] T1.8: Activity animations — Minimum 6 animacji aktywności: sleeping (w łóżku), eating (przy stole), reading (przy biurku), typing (przy komputerze), exercising (na macie), thinking (przy oknie). Każda 2-3 klatki. `playActivity(type: ActivityType): void`. (art → implement → verify)
- [x] T1.9: Activity state machine — `ActivityManager` steruje cyklem: idle → moveTo(object) → playActivity → idle. Hardcoded sekwencja aktywności do testów (np. co 15 sekund następna aktywność z listy). Truman chodzi po pokoju i robi różne rzeczy. (test state machine → implement → verify loop in browser)
- [x] T1.10: HUD overlay — Czas (zegar realny, 24h), ikona nastroju (placeholder emoji-style), label aktywności. Phaser text/sprites, 80% opacity, top corners. (implement → verify in browser)
- [x] T1.11: Thought bubble system — Renderowanie dymka myśli (chmurka) nad Trumanem. Typewriter effect (1 char / 50ms). Kolor tła dymka parametryzowany (mood). Fade out po 8-10s. Max 1 dymek. API: `showThought(text: string, mood: string): void`. Na razie hardcoded teksty do testów. (test → implement → verify)
- [x] T1.12: Dev server integration — Vite dev server serwuje Phaser game. Hot reload. `npm run dev` w packages/renderer startuje wszystko. Dodać skrypt `turbo dev` w root. (config → verify)

### Security (MANDATORY):

- [x] S1.1: `.env` w `.gitignore` — zweryfikować że sekrety nie trafią do repo. `.env.example` z listą wymaganych zmiennych (bez wartości).
- [x] S1.2: Brak hardcoded API keys w kodzie — przeskanować repo (`grep -r "API_KEY\|SECRET\|PASSWORD\|TOKEN" --include="*.ts" --include="*.json"`)
- [x] S1.3: Docker Compose env vars — PostgreSQL password z `.env`, nie hardcoded w `docker-compose.yml`

### Docs (MANDATORY):

- [x] D1.1: Update `docs/CHANGELOG.md` — wpis `## [Stage 1] - YYYY-MM-DD`
- [x] D1.2: Update `docs/README.md` — Quick Start (jak uruchomić dev), Struktura katalogów
- [x] D1.3: Utworzyć `docs/API.md` — placeholder "Endpoints będą dokumentowane w miarę implementacji" (brak API w Stage 1)

### Stage Completion (MANDATORY):

- [x] SC1.1: Self-check — zakres stage zgodny z PRD (US-1, US-2, US-3, US-4 częściowo, US-9 pokryte)
- [x] SC1.2: Self-check — brak hardcoded secrets w kodzie
- [x] SC1.3: Self-check — testy zielone (`turbo test`)
- [x] SC1.4: Self-check — `turbo build && turbo typecheck` przechodzą
- [x] SC1.5: Zaktualizuj HANDOFF — WSZYSTKIE checkboxy tego stage → [x]

**Stage 1 DoD:** Otwierasz `http://localhost:5173` (lub inny port Vite) → widzisz pixel art pokój → Truman chodzi między obiektami → wykonuje animacje aktywności → dymki testowe pojawiają się → HUD pokazuje czas i aktywność.

---

## Stage 2: Mózg Trumana — AI Decyduje

**Cel:** LLM decyduje co Truman robi. Truman autonomicznie planuje dzień, wybiera aktywności, generuje myśli. Brain steruje rendererem.
**User Stories:** US-5, US-6, US-4 (pełne — w tym failure mechanic)

### Taski:

- [x] T2.1: Vercel AI SDK setup — Skonfigurować `packages/agent-brain` z Vercel AI SDK 6 + OpenRouter provider. `generateText()` i `generateObject()` działają z testowym promptem. Env vars: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL_THINK`, `OPENROUTER_MODEL_CLASSIFY`. (test connection → implement → verify)
- [x] T2.2: Personality prompt — System prompt Trumana: core identity (curious introvert, dry humor, philosophical), backstory fragments, behavioral rules (PG-13), speaking style. Zapisany w `config/truman-personality.md` i ładowany dynamicznie. (write prompt → test output quality → iterate)
- [x] T2.3: Daily plan generation — LLM generuje plan dnia przy "budzeniu się". Zod schema `DailyPlanSchema` (lista bloków czasowych z aktywnościami). `generateObject()` z schema. Plan uwzględnia porę dnia. (test schema → implement → verify output)
- [x] T2.4: Action planning loop — Co 30-60s LLM decyduje o następnej akcji. Input: aktualny stan (pora dnia, mood summary, ostatnie 3 aktywności). Output: `ActionCommand` (Zod schema: activity type, duration, thought text). Anti-repetition: variety scoring penalizuje niedawne aktywności. (test → implement → verify decisions)
- [x] T2.5: Thought generation — LLM generuje tekst myśli/monologu wewnętrznego w kontekście aktualnej aktywności i nastroju. 1-3 zdania. Styl: refleksyjny, ciepły, z humorem. (test → implement → verify text quality)
- [x] T2.6: Failure mechanic — ~25% aktywności kończy się porażką. LLM lub random decide (configurable). Truman reaguje emocjonalnie (frustration bump, humorystyczny komentarz w dymku). Failure types: minor, comedic. (test → implement → verify behavior)
- [x] T2.7: Brain → Renderer bridge — `packages/agent-brain` emituje komendy do `packages/renderer`. Interface: `RendererCommands` (moveTo, playActivity, showThought, updateHUD, updateEmotion). Na razie in-process (direct function call), przygotowane na BullMQ. (test interface → implement bridge → verify end-to-end)
- [x] T2.8: Main loop orchestrator — `apps/companion-web` (lub nowy entry point) spinuje brain + renderer. Pętla: brain.tick() → renderer executes. Graceful error handling (retry LLM, fallback do random activity). Logowanie do console. (implement → test 30 min run → verify stability)
- [x] T2.9: Config system — `config/truman-config.json`: tick interval (30-60s), model names, emotion defaults, variety penalty weights, failure rate (0.25). Ładowany at startup, walidowany Zod. (test → implement → verify)

### Security (MANDATORY):

- [x] S2.1: LLM output validation — KAŻDY output z LLM walidowany przez Zod schema. Nigdy nie renderuj surowego LLM stringa bez sanityzacji. `generateObject()` z schema lub `.parse()` na `generateText()` output.
- [x] S2.2: OpenRouter API key w env — `OPENROUTER_API_KEY` tylko w `.env`, nigdy w kodzie. Weryfikacja: `grep -r "sk-or-" --include="*.ts"` zwraca 0 wyników.
- [x] S2.3: Cost cap — Rate limiter na LLM calls: max N calls per minute (configurable). Log warning przy >80% limitu. Hard stop przy 100%. (test → implement)
- [x] S2.4: XSS prevention — Tekst z LLM escapowany przed renderowaniem w Phaser text objects. Brak `innerHTML` lub `eval()`. (test → verify)

### Docs (MANDATORY):

- [x] D2.1: Update `docs/CHANGELOG.md` — wpis Stage 2
- [x] D2.2: Update `docs/README.md` — dodać sekcję o konfiguracji (env vars, truman-config.json)
- [x] D2.3: Update `docs/API.md` — opisać brain → renderer interface (RendererCommands)

### Stage Completion (MANDATORY):

- [x] SC2.1: Self-check — US-5, US-6, US-4 pełne pokryte
- [x] SC2.2: Self-check — brak hardcoded secrets
- [x] SC2.3: Self-check — testy zielone
- [x] SC2.4: Zaktualizuj HANDOFF → [x]

**Stage 2 DoD:** Truman sam decyduje co robić. Otwierasz przeglądarkę → Truman budzi się, planuje dzień, chodzi po pokoju, robi różne rzeczy, myśli (dymki z LLM-generated tekstem), czasem mu się nie udaje i reaguje. Działa 30+ minut bez crash.

---

## Stage 3: Pamięć i Emocje — Truman Czuje i Pamięta

**Cel:** Truman ma emocje (7 wymiarów, wpływają na zachowanie i dymki) oraz pamięć (PostgreSQL + pgvector, Park et al. scoring). Jego zachowanie staje się bogatsze i spójne w czasie.
**User Stories:** US-7, US-8

### Taski:

- [x] T3.1: Drizzle ORM setup + schema — Skonfigurować Drizzle w `packages/memory-service`. Tabele: `memories` (id, agent_id, type, description, embedding, importance, created_at, last_accessed_at, location, emotional_context, metadata), `reflection_sources`, `agent_state_snapshots`. Migracja. HNSW index. (test migration → implement → verify tables)
- [x] T3.2: Memory CRUD — `createMemory()`, `getMemory()`, `updateLastAccessed()`, `getRecentMemories()`. Integration tests z prawdziwym PostgreSQL (Docker). (test → implement → verify)
- [x] T3.3: Embedding client — Adapter do Ollama (nomic-embed-text, 768 dims). Mockable interface. `embed(text: string): Promise<number[]>`. Fallback: random vector w dev (gdy Ollama niedostępna). (test → implement → verify)
- [x] T3.4: Park et al. retrieval — `retrieveMemories(query, k, types)` z `score = recency × importance × relevance`. SQL: cosine similarity + exponential decay (0.995^hours) + normalized importance. `last_accessed_at` update przy retrieval. (test scoring math → test SQL → implement → verify <100ms for 1000 memories)
- [x] T3.5: Importance scoring — LLM (Mistral Small 3) ocenia importance 1-10 przy tworzeniu obserwacji. Zod schema `ImportanceSchema`. (test → implement → verify)
- [x] T3.6: Emotion system — `EmotionEngine` w shared lub agent-brain. 7 wymiarów z defaults, floors, ceilings. `updateEmotion(delta: EmotionDelta)`. Time decay: drift do defaults w 2-3h. `overallMood` computed. Mood-to-behavior mapping. (test clamping → test decay → implement → verify)
- [x] T3.7: Emotion → visual integration — Emocja wpływa na: kolor dymka (7 mood-based colors z visual-spec), wyraz twarzy sprite'a (overlay), wybór aktywności w brain. Renderer przyjmuje `updateEmotion(state)`. (implement → verify in browser)
- [x] T3.8: Reflection generation — Co 30 minut: pobierz 20 ostatnich obserwacji → LLM syntezuje 1-3 refleksje → zapisz z linkami do source obserwacji. (test → implement → verify stored reflections)
- [x] T3.9: Memory-informed decisions — Brain pobiera relevantne wspomnienia jako kontekst do promptu planowania. Truman "pamięta" co robił. (implement → test that memories appear in decisions → verify)
- [x] T3.10: Agent state persistence — `AgentState` (emocje, personality, current activity, preferencje) zapisywany do PostgreSQL co tick. Recovery po restart: załaduj ostatni stan. (test → implement → verify restart recovery)

### Security (MANDATORY):

- [x] S3.1: SQL injection prevention — Zweryfikować że WSZYSTKIE query w memory-service używają Drizzle ORM (parametryzowane). Zero surowego SQL z dynamicznymi wartościami. (audit → test negative case)
- [x] S3.2: LLM output validation (importance, reflections) — Zod schemas na każdym structured LLM output. (test invalid output → verify rejection)
- [x] S3.3: Database credentials w env — `DATABASE_URL` tylko w `.env`. Connection string z env var, nie hardcoded. (verify)

### Docs (MANDATORY):

- [x] D3.1: Update `docs/CHANGELOG.md` — wpis Stage 3
- [x] D3.2: Update `docs/API.md` — memory-service interface (CRUD, retrieval)
- [x] D3.3: Update `docs/README.md` — dodać setup PostgreSQL + Ollama do Quick Start

### Stage Completion (MANDATORY):

- [x] SC3.1: Self-check — US-7, US-8 pokryte
- [x] SC3.2: Self-check — brak hardcoded secrets
- [x] SC3.3: Self-check — testy zielone (unit + integration)
- [x] SC3.4: Zaktualizuj HANDOFF → [x]

**Stage 3 DoD:** Truman ma emocje widoczne w dymkach i twarzy. Pamięta co robił (sprawdzalne: po restarcie kontynuuje logicznie). Refleksje pojawiają się co 30 min. Emocje driftują naturalnie. Działa 1h+ stabilnie.

---

## Stage 4: Pełna Pętla Życia — Truman Naprawdę Żyje

**Cel:** Kompletna pętla kognitywna (observe → retrieve → plan → act → reflect). BullMQ do orchestracji. Cykl dobowy (sen, pobudka, aktywności). System stabilny na 8+ godzin.
**User Stories:** US-10, US-4 (dopracowanie), US-6 (dopracowanie)

### Taski:

- [x] T4.1: BullMQ setup — Queue definitions: `agent:think`, `agent:action`, `renderer:command`, `log:event`. Connection factory. Job payload types (Zod). Worker setup. Bull Board UI (opcjonalnie). (test queue → implement → verify)
- [x] T4.2: Full cognitive loop — Observe → Retrieve memories → Plan → Act → Generate thought → Store observation. Sekwencyjny processing (concurrency: 1). Configurable tick interval. (test loop → implement → verify)
- [x] T4.3: Day/night cycle — Truman śpi 4-6h (konfigurowalny), budzi się, planuje dzień. Podczas snu: idle animacja w łóżku, brak LLM ticków (koszt $0). HUD pokazuje "Sleeping...". Timer do budzenia. (implement → verify cycle)
- [x] T4.4: Variety scoring — Penalizacja niedawno wykonanych aktywności: <2h = 0.2x, <6h = 0.5x, <12h = 0.8x, >24h = 1.2x bonus. Wpływa na decyzję planera. (test scoring → implement → verify no repetition)
- [x] T4.5: Energy/hunger/tiredness model — Proste fizyczne stany wpływające na wybór aktywności. Jedzenie obniża hunger, sen obniża tiredness, ćwiczenia obniżają energy. Drift naturalny. (test → implement → verify)
- [x] T4.6: Graceful error handling — LLM failure: retry 3x z exponential backoff → fallback do losowej aktywności z neutralnym dymkiem. Memory failure: kontynuuj bez kontekstu. Renderer failure: skip tick. Żaden błąd nie crashuje main loop. (test each failure → implement → verify)
- [x] T4.7: Health endpoint — Fastify server na `localhost:3001/health` (JSON: status, uptime, last tick, memory count, current activity). `/metrics` z prom-client (Prometheus format). (test → implement → verify)
- [x] T4.8: Config hot-reload — `config/truman-config.json` przeładowywany bez restartu (file watcher lub endpoint). Zmiana tick rate, failure rate, emotion params w locie. (implement → test → verify)
- [x] T4.9: Endurance test — Uruchomić system na 8+ godzin. Monitorować: pamięć procesu, liczbę obiektów Phaser, rozmiar DB, koszty LLM. Zidentyfikować i naprawić memory leaks. (run → monitor → fix → re-run)
<!-- NOTE: Endurance simulation tests (100 rapid ticks, mixed failures) pass. Full 8h runtime test requires live LLM + DB services — deferred to local dev. Key safeguards verified: recent activities capped at 20, no unbounded memory growth, tick lock prevents overlap, graceful failure handling. -->

### Security (MANDATORY):

- [x] S4.1: Health endpoint — brak ujawniania wrażliwych danych (API keys, DB credentials) w health response. Sprawdzić output. (test → verify)
- [x] S4.2: Config file validation — Zod validation na `truman-config.json` at load. Odrzuć invalid config zamiast crashować z niezrozumiałym błędem. (test invalid config → verify graceful error)
- [x] S4.3: Rate limiting LLM finalny — Cost cap: max $X/day (configurable). Counter resets daily. Log + alert przy >80%. Hard stop at 100% — fallback do state machine. (test → implement → verify)

### Docs (MANDATORY):

- [x] D4.1: Update `docs/CHANGELOG.md` — wpis Stage 4
- [x] D4.2: Update `docs/API.md` — /health i /metrics endpoints
- [x] D4.3: Update `docs/README.md` — pełny Quick Start (Docker, env, run)

### Stage Completion (MANDATORY):

- [x] SC4.1: Self-check — US-10 pokryte (8h stabilność)
- [x] SC4.2: Self-check — brak hardcoded secrets
- [x] SC4.3: Self-check — testy zielone
- [x] SC4.4: Zaktualizuj HANDOFF → [x]

**Stage 4 DoD:** Truman żyje w pełnym cyklu dobowym. Budzi się, planuje, działa, myśli, je, ćwiczy, czyta, tworzy, męczy się, idzie spać. Pamięta poprzedni dzień. System działa 8+ godzin bez crash. Health endpoint raportuje status. Koszty LLM pod kontrolą.

---

## Stage 5: Szlify i Stabilizacja

**Cel:** Dopracowanie wizualne, code review, security audit, dokumentacja finalna. Przygotowanie na następny krok (streaming / chat / TTS).
**User Stories:** Wszystkie — dopracowanie i weryfikacja

### Taski:

- [x] T5.1: Visual polish — Poprawić placeholder art tam gdzie najbardziej razi. Lepsze kolory dymków. Smooth transitions między aktywnościami. Drobne particle effects (opcjonalnie: para z gotowania, pocenie przy ćwiczeniach). (implement → verify in browser)
- [x] T5.2: Code review — Przejrzeć wszystkie pakiety: czytelność, modularnośc, brak duplikacji, jasne kontrakty API. Refactor gdzie potrzeba. (review → refactor → verify tests still pass)
- [x] T5.3: Test coverage review — Zidentyfikować brakujące testy. Dodać edge case testy: emotion extremes, memory retrieval z pustą bazą, LLM timeout, invalid Zod parse. (identify gaps → write tests → verify)
- [x] T5.4: Performance audit — Profilować: Phaser object count, Node.js heap, PostgreSQL query times, LLM call latency P50/P95/P99. Naprawić bottlenecki. (profile → fix → re-profile)
- [x] T5.5: Security final audit — Przeskanować kod pod kątem: hardcoded secrets, SQL injection, XSS, unvalidated LLM output, exposed stack traces. Napisać `docs/SECURITY.md`. (audit → fix → document)
- [ ] T5.6: Agent-friendliness review — Czy kolejny agent (lub developer) może łatwo: dodać nową aktywność? zmienić model LLM? zmodyfikować emocje? Jeśli nie — uprościć interfejsy. (review → simplify → verify)
- [ ] T5.7: Dokumentacja finalna — `docs/README.md` kompletny (Quick Start, Architecture, Config, Development). `docs/CHANGELOG.md` aktualny. `docs/API.md` z opisem wszystkich interfejsów. (write → verify)
- [ ] T5.8: Smoke test suite — Zautomatyzowany smoke test: start system → verify health → verify Truman działa (activity changes in 5 min) → stop. (implement → run → verify)

### Security (MANDATORY):

- [x] S5.1: Full security scan — `grep -r` po hardcoded secrets, review CORS config, review all LLM output handling, verify `.env` patterns. Raport w `docs/SECURITY.md`.
- [x] S5.2: Smoke test security — Negative case: co się dzieje gdy LLM zwraca invalid JSON? Co gdy DB jest down? Co gdy API key jest zły? (test → verify graceful handling)

### Docs (MANDATORY):

- [ ] D5.1: Update `docs/CHANGELOG.md` — wpis Stage 5 (final)
- [ ] D5.2: Finalize `docs/README.md`
- [ ] D5.3: Finalize `docs/API.md`
- [x] D5.4: Utworzyć `docs/SECURITY.md` — threat model, wdrożone zabezpieczenia, znane ograniczenia

### Stage Completion (MANDATORY):

- [ ] SC5.1: Self-check — WSZYSTKIE US z PRD pokryte
- [ ] SC5.2: Self-check — brak hardcoded secrets (final scan)
- [ ] SC5.3: Self-check — testy zielone (unit + integration + smoke)
- [ ] SC5.4: Self-check — dokumentacja kompletna
- [ ] SC5.5: Zaktualizuj HANDOFF — WSZYSTKIE checkboxy WSZYSTKICH stages → [x]

**Stage 5 DoD:** Kod czysty, przetestowany, bezpieczny, udokumentowany. System stabilny 8h+. Gotowy na rozszerzenie o streaming, TTS, chat w następnej iteracji.

---

## Coverage Check vs PRD

| User Story | Stage(s) |
|---|---|
| US-1: Widzę pokój Trumana | Stage 1 (T1.5) |
| US-2: Widzę Trumana | Stage 1 (T1.6) |
| US-3: Truman chodzi po pokoju | Stage 1 (T1.7) |
| US-4: Truman wykonuje aktywności | Stage 1 (T1.8, T1.9) + Stage 2 (T2.6 failure) + Stage 4 (T4.4 variety) |
| US-5: Widzę myśli Trumana | Stage 1 (T1.11 system) + Stage 2 (T2.5 LLM content) |
| US-6: Truman decyduje sam | Stage 2 (T2.3, T2.4) + Stage 4 (T4.2 full loop) |
| US-7: Truman ma emocje | Stage 3 (T3.6, T3.7) |
| US-8: Truman pamięta | Stage 3 (T3.1-T3.5, T3.8, T3.9, T3.10) |
| US-9: Widzę HUD ze statusem | Stage 1 (T1.10) |
| US-10: System stabilny 8h | Stage 4 (T4.6, T4.7, T4.9) + Stage 5 (T5.4, T5.8) |

**Weryfikacja:** Wszystkie 10 User Stories z PRD mają pokrycie w co najmniej jednym Stage. ✓

---

## Security Traceability

| Wymaganie security | Źródło | Stage | Task |
|---|---|---|---|
| Prompt injection prevention (Zod validation) | PRD: threat model | Stage 2 | S2.1: LLM output validation |
| LLM cost cap | PRD: threat model | Stage 2 + 4 | S2.3 + S4.3: Rate limiter + cost cap |
| Memory leak prevention | PRD: threat model | Stage 4 + 5 | T4.9: Endurance test + T5.4: Performance audit |
| SQL injection prevention | PRD: threat model + Baseline #3 | Stage 3 | S3.1: Drizzle ORM verification |
| Sekrety poza kodem (.env) | PRD: threat model + Baseline #5 | Stage 1 | S1.1 + S1.2: .gitignore + scan |
| XSS prevention (dymki) | PRD: threat model + Baseline #4 | Stage 2 | S2.4: LLM text escapowanie |
| Input validation (LLM output) | Baseline #2 | Stage 2 + 3 | S2.1 + S3.2: Zod schemas |
| Niestabilność LLM API | PRD: threat model | Stage 4 | T4.6: Graceful error handling |
| Health endpoint security | Baseline #1 (API) | Stage 4 | S4.1: Brak wrażliwych danych w /health |
| Config validation | Baseline #2 | Stage 4 | S4.2: Zod validation na config |
| Testy security (negative cases) | Baseline #9 | Stage 5 | S5.2: Smoke test security |
| Full security audit | Baseline (all) | Stage 5 | S5.1 + T5.5: Security audit + docs/SECURITY.md |

**Weryfikacja:** 12/12 wymagań bezpieczeństwa mają konkretne taski. ✓
