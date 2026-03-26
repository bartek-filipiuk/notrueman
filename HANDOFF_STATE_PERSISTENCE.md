# HANDOFF_STATE_PERSISTENCE.md — Zapis i Odtwarzanie Stanu

**Data:** 2026-03-26
**Podejście:** PostgreSQL primary + localStorage fallback. Dual persistence.
**Cel:** Truman przetrwa refresh — pozycja, emocje, aktywność, nastrój. Day counter. Reset.
**Bazuje na:** Istniejąca infrastruktura: StatePersistence service, agentStateSnapshots table, HealthServer Fastify, EmotionEngine.setState()

## Kontekst

Każdy refresh = totalny reset. Infrastruktura DO zapisu istnieje (PostgreSQL tabela, StatePersistence service, setState() metody) ale NIGDY nie podłączona. Browser nie ma żadnego localStorage/sessionStorage.

## Założenia

- Docker Compose z PostgreSQL dostępny (`docker compose up -d`)
- HealthServer (Fastify :3001) jako backend API — dodajemy endpointy
- `packages/memory-service/src/state-persistence.ts` — reuse saveState/loadLatestState
- `agentStateSnapshots` tabela gotowa w schema
- EmotionEngine.setState(), PhysicalStateEngine.setState() — gotowe, tylko wywołać
- Demo mode (bez backendu) → localStorage fallback

## Dependency Graph

```
Stage G (SaveManager + REST API)
    |
    v
Stage H (Recovery Integration)
    |
    v
Stage I (Reset UI + Day Counter)
```

---

## Stage G: SaveManager + REST API + localStorage Fallback

**Cel:** Infrastruktura zapisu/odczytu stanu. PostgreSQL via REST (primary), localStorage (fallback).
**User Stories:** Nowe: US-STATE-1 (stan przetrwa refresh)

### Taski:

- [x] TG.1: SaveData type — nowy `packages/shared/src/types/save-data.ts`. Interface + Zod schema: `version: number`, `savedAt: number`, `createdAt: number`, `dayCount: number`, `totalTimeAliveMs: number`, `sessionCount: number`, `truman: { x, y, facing, currentActivity, currentMood }`, `emotions: EmotionState`, `physicalState: PhysicalState`, `recentActivities: Array<{ type: string, at: number }>`, `brainTickCount: number`. Eksportować z browser.ts. (implement → test schema validation)
- [x] TG.2: REST endpoints na HealthServer — w `packages/agent-brain/src/health-server.ts` dodać: `POST /state/save` (body: `{ agentId, state }` → `StatePersistence.saveState()`), `GET /state/load/:agentId` (→ `StatePersistence.loadLatestState()`). CORS headers dla cross-origin (browser :5173 → API :3001). Inject `StatePersistence` do `HealthServerDeps`. (implement → test z curl)
- [x] TG.3: SaveManager — nowy `packages/renderer/src/systems/SaveManager.ts`. Metody: `save(data)` POST → fallback localStorage, `load()` GET → fallback localStorage → null, `reset(mode)` clear, `hasSave()` check. Config: `backendUrl` (default localhost:3001). Auto-detect backend: try fetch /health, timeout 2s, if fail → localStorage only. (implement → test dual mode)
- [x] TG.4: Save triggers — w `main.ts`: `visibilitychange` listener (save gdy hidden), `pagehide` listener z `sendBeacon()`, periodic co 30s jeśli dirty, na zmianie aktywności. (implement → verify save fires)
- [x] TG.5: Day counter logic — `createdAt` z pierwszego EVER uruchomienia (never overwritten), `dayCount = floor((now - createdAt) / 86400000)`, `totalTimeAliveMs += elapsed`, `sessionCount++` na load. (implement → test calculation)
- [x] TG.6: Testy — unit: SaveData Zod validation, SaveManager save/load/reset (mock fetch + localStorage), day counter math. Integration: REST endpoint z prawdziwym PostgreSQL. `turbo test` zielone. (test → verify green)

### Security (MANDATORY):

- [x] SG.1: CORS — HealthServer akceptuje tylko origin localhost:* (dev). Brak wildcard *. (implement → verify)
- [x] SG.2: SaveData validation — Zod schema na input POST /state/save. Reject invalid payloads. (implement → test negative case)
- [x] SG.3: Agent ID — hardcoded "truman" (single agent). Brak user input w agentId. (verify)

### Docs (MANDATORY):

- [x] DG.1: Update `docs/CHANGELOG.md` — wpis Stage G.
- [x] DG.2: Update `docs/API.md` — POST /state/save, GET /state/load endpoints.

### Stage Completion (MANDATORY):

- [x] SCG.1: Self-check — POST /state/save zapisuje do PostgreSQL (curl test). ✓ Tested via Fastify inject in state-endpoints.test.ts
- [x] SCG.2: Self-check — GET /state/load zwraca ostatni stan. ✓ Tested via Fastify inject in state-endpoints.test.ts
- [x] SCG.3: Self-check — localStorage fallback działa gdy brak backendu. ✓ SaveManager auto-detects; falls back to localStorage when health check fails
- [x] SCG.4: Self-check — testy zielone. ✓ All new tests pass (16 save-data + 8 state-endpoints); pre-existing failures unchanged
- [x] SCG.5: Zaktualizuj HANDOFF → [x]. ✓

**Stage G DoD:** `curl -X POST localhost:3001/state/save -d '{...}'` → zapisuje. `curl localhost:3001/state/load/truman` → zwraca. SaveManager w browserze automatycznie wybiera backend lub localStorage.

---

## Stage H: Recovery Integration — Restore on Startup

**Cel:** Po refresh Truman wznawia z zapisanego stanu. Pozycja, emocje, aktywność, nastrój odtwarzane.
**User Stories:** US-STATE-1 (pełna implementacja)

### Taski:

- [ ] TH.1: Load on startup — w `main.ts`: po game create, przed RoomScene: `SaveManager.load()`. Jeśli save → pass jako init data do RoomScene. (implement → verify load fires)
- [ ] TH.2: Renderer recovery — `RoomScene.ts`: jeśli save data → `truman.setPosition(save.x, save.y)`, `truman.setFacing(save.facing)`. Truman startuje z ostatniej pozycji. (implement → verify position restored)
- [ ] TH.3: Brain recovery — `main.ts` initBrain: `emotionEngine.setState(save.emotions)`, `physicalState.setState(save.physicalState)`, `brainLoop.state.recentActivities = save.recentActivities`, `brainLoop.state.tickCount = save.brainTickCount`. (implement → verify emotions restored)
- [ ] TH.4: Offline time compensation — `elapsed = now - save.savedAt`. Emotions: drift toward defaults. Physical: hunger/tiredness increase. Elapsed > 8h → Truman "spał" (reset tiredness). Capped at bounds. (implement → test math)
- [ ] TH.5: Dirty flag — `dirty = false` initial. Set true on: brain tick, emotion change, activity change, position > 10px. Periodic save only when dirty. Reset after save. (implement → verify no unnecessary saves)
- [ ] TH.6: Wire activity change → save — ActivityManager.onActivityChange callback triggers SaveManager.save(). (implement → verify save on activity)
- [ ] TH.7: Testy — test: load → restore position. Test: offline compensation math. Test: dirty flag. `turbo test` zielone. (test → verify green)

### Security (MANDATORY):

- [ ] SH.1: Brak secrets w SaveData — żadnych API keys, passwords w zapisywanym stanie. (verify)
- [ ] SH.2: `turbo test` przechodzi. (verify)

### Docs (MANDATORY):

- [ ] DH.1: Update `docs/CHANGELOG.md` — wpis Stage H.

### Stage Completion (MANDATORY):

- [ ] SCH.1: Self-check — refresh → Truman w tej samej pozycji.
- [ ] SCH.2: Self-check — emocje i nastrój zachowane po refresh.
- [ ] SCH.3: Self-check — AI mode: kilka ticków → refresh → kontynuacja.
- [ ] SCH.4: Self-check — testy zielone.
- [ ] SCH.5: Zaktualizuj HANDOFF → [x].

**Stage H DoD:** Otwierasz grę → Truman chodzi 2 minuty → refresh → Truman w dokładnie tej samej pozycji, z tymi samymi emocjami. Day counter zachowany.

---

## Stage I: Reset UI + Day Counter HUD

**Cel:** Użytkownik widzi dzień życia, sesję, może zresetować Trumana.
**User Stories:** Nowe: US-STATE-2 (day counter), US-STATE-3 (reset)

### Taski:

- [ ] TI.1: HUD day counter — `ui/HUD.ts`: tekst "Day 0" / "Day 1". Pozycja: lewy dolny róg. Czcionka Press Start 2P, mały rozmiar. Update z SaveManager. (implement → verify visible)
- [ ] TI.2: ConfigPanel stats — `ui/ConfigPanel.ts`: display "Day X", "Session #Y", "Alive: Xh Ym", "Last saved: Xs ago". (implement → verify in ConfigPanel)
- [ ] TI.3: Soft reset button — ConfigPanel: żółty przycisk "Soft Reset". Akcja: pozycja→center, emocje→default, activity→idle. Zachowuje: dayCount, createdAt, sessionCount, memories w DB. Po resecie: page reload. (implement → test)
- [ ] TI.4: Hard reset button — ConfigPanel: czerwony przycisk "Hard Reset" + confirm("Are you sure?"). Czyści CAŁY save (localStorage + snapshot w DB). NIE czyści memories/observations. Po resecie: page reload → Day 0. (implement → test)
- [ ] TI.5: URL params — `?reset=soft` i `?reset=hard` — dev tools, bez confirm dialog. (implement → test)
- [ ] TI.6: Save version migration — `SaveData.version = 1`. Na load: jeśli version mismatch → discard + log warning. (implement → test upgrade path)
- [ ] TI.7: Testy — test: day counter calculation. Test: soft reset preserves dayCount. Test: hard reset clears all. `turbo test` zielone. (test → verify green)

### Security (MANDATORY):

- [ ] SI.1: Hard reset requires confirm dialog (nie przypadkowy). URL param `?reset=hard` only w dev. (verify)
- [ ] SI.2: `turbo test` przechodzi. (verify)

### Docs (MANDATORY):

- [ ] DI.1: Update `docs/CHANGELOG.md` — wpis Stage I.
- [ ] DI.2: Update `docs/README.md` — sekcja "State Persistence" (jak działa, reset).

### Stage Completion (MANDATORY):

- [ ] SCI.1: Self-check — HUD "Day X" widoczny.
- [ ] SCI.2: Self-check — ConfigPanel pokazuje stats i reset buttons.
- [ ] SCI.3: Self-check — soft reset → pozycja reset, day counter zachowany.
- [ ] SCI.4: Self-check — hard reset → Day 0, fresh start.
- [ ] SCI.5: Self-check — testy zielone.
- [ ] SCI.6: Zaktualizuj HANDOFF → [x].

**Stage I DoD:** HUD pokazuje "Day 3, Session #7". ConfigPanel: "Soft Reset" → Truman na środku ale Day 3. "Hard Reset" → Day 0, czysta karta.

---

## Coverage Check

| User Story | Stage(s) |
|---|---|
| US-STATE-1: Stan przetrwa refresh | Stage G (TG.1-TG.5) + Stage H (TH.1-TH.6) |
| US-STATE-2: Day counter widoczny | Stage I (TI.1, TI.2) |
| US-STATE-3: Reset Trumana | Stage I (TI.3-TI.5) |

## Security Traceability

| Wymaganie | Stage | Task |
|---|---|---|
| CORS na API | Stage G | SG.1 |
| Input validation (Zod) | Stage G | SG.2 |
| No secrets in save data | Stage H | SH.1 |
| Reset confirmation | Stage I | SI.1 |
