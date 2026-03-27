# HANDOFF_ADMIN_DB.md — Admin Panel DB-Backed + LLM Call Logging

**Data:** 2026-03-27
**Podejście:** DB-backed admin zamiast WebSocket. Nowa tabela llm_calls. HTTP polling.
**Cel:** Admin widzi pełne logi z DB: memories, LLM calls (prompt/response/tokens/cost), stats, state history. Dane przetrwają refresh.

## Kontekst

Admin panel czyta dane z WebSocket ale brain działa w przeglądarce → eventy nie docierają do WebSocket reliably. Zmiana: admin dashboard odpytuje PostgreSQL przez REST API. Dodatkowa tabela `llm_calls` loguje każdy call do LLM (prompt, response, model, tokens, koszt, czas).

## Założenia

- PostgreSQL działa (docker-compose, port 5435)
- HealthServer Fastify na :3001 z admin auth (JWT)
- Memory service ma `createMemoryRepository()` i `createStatePersistence()`
- Drizzle ORM do schema + migration
- Admin pages w `apps/companion-web/src/admin/` (vanilla TS + HTML)
- Renderer proxy: `/api/*` → :3001

## Dependency Graph

```
Stage U (LLM Call Logging)
    |
    v
Stage V (Admin Dashboard DB-Backed)
```

---

## Stage U: LLM Call Logging Table + API

**Cel:** Każdy LLM call logowany do PostgreSQL z prompt/response/tokens/cost. Endpoints do query.

### Taski:

- [x] TU.1: Tabela `llm_calls` w schema — `packages/memory-service/src/db/schema.ts`. Kolumny: `id` (uuid PK), `agent_id` (text), `model` (text), `call_type` (text: "generateText"/"generateObject"/"generateWithTools"), `prompt_preview` (text, first 500 chars), `system_preview` (text, first 200 chars nullable), `response_preview` (text, first 500 chars), `input_tokens` (int nullable), `output_tokens` (int nullable), `cost_usd` (numeric nullable), `duration_ms` (int), `success` (boolean), `error` (text nullable), `created_at` (timestamp default now). Indexy: agent_id, created_at, model. Drizzle migration: `npx drizzle-kit push`. (implement → verify table exists)
- [x] TU.2: LLM call log CRUD — nowy `packages/memory-service/src/llm-call-log.ts`. Interface `LLMCallLog`: `logCall(data)` → INSERT, `getRecentCalls(agentId, limit, offset, filters?)` → SELECT ORDER BY created_at DESC, `getStats(agentId, sinceHours?)` → aggregaty (COUNT, SUM tokens, SUM cost, AVG duration, error count). Eksport z index.ts. (implement → test)
- [x] TU.3: Backend endpoint `POST /api/llm-log` — `health-server.ts`. Body: LLM call data. Bez auth (wewnętrzny, przez proxy). Inject `LLMCallLog` do deps. Validation: model required, duration required. (implement → test curl)
- [x] TU.4: Backend endpoint `GET /api/admin/llm-calls` — JWT required. Query params: `model`, `call_type`, `success` (true/false), `limit` (default 30), `offset`. Returns array z llm_calls rows. (implement → test)
- [x] TU.5: Backend endpoint `GET /api/admin/stats` — JWT required. Returns: `{ callsToday, totalTokensIn, totalTokensOut, totalCostUsd, avgDurationMs, errorCount, memoriesCount }`. Query z llm_calls + memories. (implement → test)
- [x] TU.6: Backend endpoint `GET /api/admin/state-history` — JWT required. Query params: `limit` (default 10). Returns array z agent_state_snapshots ordered by created_at DESC. (implement → test)
- [x] TU.7: LLM client logging hook — `packages/agent-brain/src/llm-client.ts`. Po każdym generateText/generateObject/generateWithTools: POST `/api/llm-log` z: model, call_type, prompt_preview (500 chars), system_preview (200 chars), response_preview (500 chars), input_tokens, output_tokens, duration_ms, success, error. Fire-and-forget (nie blokuj tick). (implement → verify logs in DB)
- [x] TU.8: Renderer proxy — `packages/renderer/vite.config.ts` już ma proxy `/api` → :3001. Verify `/api/llm-log` proxied. (verify)
- [x] TU.9: start-backend.ts update — inject `LLMCallLog` do HealthServer deps. Create `createLLMCallLog(db)` w startup. (implement → verify)
- [x] TU.10: Testy — unit: llm-call-log CRUD, stats aggregation. Integration: POST /api/llm-log → GET /api/admin/llm-calls returns data. `turbo test` zielone. (test → verify)

### Security (MANDATORY):
- [x] SU.1: POST /api/llm-log nie wymaga auth (wewnętrzny) ale CORS blokuje external. (verify)
- [x] SU.2: prompt/response PREVIEW only (500 chars) — nie pełne prompty w DB. (verify)
- [x] SU.3: `turbo test` przechodzi. (verify)

### Stage Completion:
- [x] SCU.1: Self-check — LLM calls widoczne w DB (psql query).
- [x] SCU.2: Self-check — /api/admin/stats zwraca dane.
- [x] SCU.3: Self-check — testy zielone.
- [x] SCU.4: Zaktualizuj HANDOFF → [x].

---

## Stage V: Admin Dashboard DB-Backed

**Cel:** Admin dashboard czyta z DB, nie z WebSocket. Memory browser, LLM calls browser, stats, state history.

### Taski:

- [x] TV.1: Dashboard redesign — `apps/companion-web/src/admin/dashboard.ts` rewrite. Zamiast WebSocket → HTTP polling co 10s. Sekcje: Stats bar (top), Memories list, LLM Calls list. Fetch: `/api/admin/stats`, `/api/admin/memories?limit=20`, `/api/admin/llm-calls?limit=20`. Auto-refresh co 10s. (implement → verify data loads)
- [x] TV.2: Stats bar — na górze dashboard. Karty: "Calls Today: X", "Tokens: Yin/Zout", "Cost: $X.XX", "Errors: N", "Avg: Xms", "Memories: N". Kolory: green OK, yellow >80% budget, red errors. Dane z `/api/admin/stats`. (implement → verify)
- [x] TV.3: Memory Browser — tabela z filtrami. Kolumny: timestamp, type badge (observation=blue, reflection=purple, plan=green), description (truncated 100 chars), importance (color bar 1-10), mood emoji. Filtry: type dropdown, min importance slider. Kliknięcie → detail modal: full description, emotional_context JSON, metadata JSON (toolCalls). (implement → verify clickable)
- [x] TV.4: LLM Calls Browser — tabela. Kolumny: timestamp, model badge, call_type, duration (ms), tokens (in/out), cost ($), success/fail badge. Filtry: model dropdown, success checkbox. Kliknięcie → detail modal: prompt_preview, system_preview, response_preview, error. Red row for failures. (implement → verify)
- [x] TV.5: State History — `GET /api/admin/state-history?limit=10`. Lista: timestamp, preview (day count, session, position). Kliknięcie → JSON viewer (pretty-printed, collapsible). (implement → verify)
- [x] TV.6: Log viewer update — `apps/companion-web/src/admin/log-viewer.ts` rewrite. Zamiast WebSocket-only → HTTP polling `/api/admin/memories?limit=50` + `/api/admin/llm-calls?limit=50`. Merge + sort by timestamp. Same filtry (type, search). Auto-refresh co 10s. (implement → verify)
- [x] TV.7: Navigation — admin panel tabs: Dashboard | Logs | Settings | Controls. Routing via hash. Dashboard = default. (implement → verify navigation)
- [x] TV.8: Testy — dashboard renders, polling works, filters work, modals open/close. `turbo test` zielone. (test → verify)

### Security (MANDATORY):
- [x] SV.1: Wszystkie admin endpoints wymagają JWT. (verify)
- [x] SV.2: Brak secrets (API keys, passwords) w response data. (verify)
- [x] SV.3: `turbo test` przechodzi. (verify)

### Stage Completion:
- [x] SCV.1: Self-check — admin dashboard ładuje dane z DB (nie WebSocket).
- [x] SCV.2: Self-check — memories browser z filtrami + detail modal.
- [x] SCV.3: Self-check — LLM calls browser z prompt/response preview.
- [x] SCV.4: Self-check — stats bar pokazuje dzienne statystyki.
- [x] SCV.5: Self-check — refresh → dane nadal widoczne (DB persistence).
- [x] SCV.6: Self-check — testy zielone.
- [x] SCV.7: Zaktualizuj HANDOFF → [x].
