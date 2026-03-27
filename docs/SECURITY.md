# Security Audit Report: No True Man Show

**Date:** 2026-03-27 (V1.0 Launch)
**Scope:** Full codebase audit — Stages M-P (V1.0 Launch)
**Auditor:** Automated + manual review
**Result:** PASS — zero CRITICAL, zero HIGH severity issues

**Previous audit:** 2026-03-24 (Stage 5)

---

## 1. Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Hardcoded secrets in repo | Low | Critical | `.gitignore` excludes `.env*`; `.env.example` has no values; verified via `grep` scan |
| SQL injection | Low | Critical | All queries use Drizzle ORM parameterized builders (`eq()`, `and()`, `desc()`) |
| XSS via LLM output | Low | High | Phaser `.setText()` renders plain text, no `innerHTML`/`dangerouslySetInnerHTML` |
| Unvalidated LLM output | Low | High | All LLM calls use `generateObject()` with Zod schema validation |
| Prompt injection via viewer input | Medium | High | 3-layer sanitizer pipeline (see `security-spec.md` S3); viewer text never enters system prompt |
| Exposed stack traces | Low | Medium | Health endpoint returns structured JSON only; test verifies no secrets leak |
| Runaway API costs | Medium | Medium | Daily cost cap (`DAILY_COST_CAP_USD`), rate limiter, cost tracker with warnings |
| Memory exhaustion | Low | Medium | Command log capped at 500 entries; recent activities capped at 20; Phaser tweens cleaned up |
| Dependency vulnerabilities | Low | Medium | 4 moderate-severity issues in dev-only deps (esbuild via drizzle-kit) |

---

## 2. Implemented Security Controls

### 2.1 Secret Management

- **No hardcoded secrets.** Full `grep -r` scan confirmed zero API keys, passwords, or tokens in source.
- `.env` files excluded by `.gitignore` (`.env`, `.env.local`, `.env.production`).
- `.env.example` documents all required variables with empty values.
- Git history contains no committed secrets.
- Health server (`/health`, `/metrics`) explicitly does NOT expose secrets — verified by test (`health-server.test.ts`).

### 2.2 Input Validation

| Boundary | Validator | Location |
|----------|-----------|----------|
| LLM action commands | `ActionCommandSchema` (Zod) | `shared/src/schemas/index.ts` |
| LLM daily plans | `DailyPlanSchema` (Zod) | `shared/src/schemas/index.ts` |
| LLM importance scores | `ImportanceScoreSchema` (Zod) | `shared/src/schemas/index.ts` |
| Queue job payloads | `AgentThinkJobSchema` et al. (Zod) | `shared/src/queue/schemas.ts` |
| Redis connection config | `QueueConnectionConfigSchema` (Zod) | `shared/src/queue/connection.ts` |
| Agent config file | `TrumanConfigSchema` (Zod) | `agent-brain/src/config.ts` |
| Memory embeddings (JSON) | `try/catch` with default fallback | `memory-service/src/memory-retrieval.ts` |

All LLM outputs go through `generateObject()` with Zod schemas — invalid responses are rejected before use.

### 2.3 SQL Injection Prevention

All database queries use Drizzle ORM's query builder (`memory-repository.ts`):
- `eq(memories.id, id)` — parameterized equality
- `and(...conditions)` — safe composition
- `desc(memories.createdAt)` — safe ordering

No raw SQL string concatenation anywhere in the codebase.

### 2.4 XSS Prevention

- Phaser game engine uses `Phaser.GameObjects.Text.setText()` — plain text rendering only.
- `ThoughtBubble` displays LLM-generated text via `.setText()`, not HTML.
- No `innerHTML`, `dangerouslySetInnerHTML`, `document.write`, or template literal HTML injection found.

### 2.5 Error Handling

- `cognitive-loop.ts`: Tick errors caught, logged with generic message, fallback to random activity.
- `memory-retrieval.ts`: Malformed embedding JSON falls back to relevance 0.5.
- `config-watcher.ts`: Invalid config rejected, previous config retained.
- `ActivityManager`: Unhandled promise rejection caught with `.catch()`, graceful recovery to idle.
- Stack traces logged internally only — never sent to health endpoint or renderer.

### 2.6 Resource Limits

| Resource | Limit | Location |
|----------|-------|----------|
| Command log | 500 entries max | `renderer-bridge.ts` |
| Recent activities | 20 entries max | `cognitive-loop.ts` |
| Memory retrieval | Configurable `k` param | `memory-retrieval.ts` |
| LLM retries | `maxRetries` config (default 3) | `cognitive-loop.ts` |
| Daily API cost | `DAILY_COST_CAP_USD` env var | `cost-tracker.ts` |
| Rate limiting | Configurable window/max | `rate-limiter.ts` |

### 2.7 Admin Panel Security (V1.0)

| Control | Implementation |
|---------|---------------|
| JWT Authentication | 24h token expiry, bcrypt password hashing (10 rounds) |
| JWT Secret | Min 32 chars, validated on startup (fail-fast) |
| Login Rate Limiting | 5 attempts/min per IP |
| Admin Endpoints | All `/api/admin/*` require `Authorization: Bearer <token>` |
| WebSocket Admin Feed | JWT required in `?token=` query parameter |
| Public Feed Filtering | `filterForPublicFeed()` strips raw prompts, costs, tool I/O, memory IDs |
| Connection Limits | 100 public + 5 admin WebSocket, 10/IP rate limit |
| WebSocket Heartbeat | 30s ping/pong, 5min idle disconnect |
| CORS Production | `CORS_ORIGIN` env var whitelist, no wildcard `*` |
| XSS Prevention | `escapeHtml()` via `textContent` in all user-facing content |
| Secrets in .env | ADMIN_PASSWORD, JWT_SECRET — never hardcoded |

### 2.8 TypeScript Strict Mode

All `tsconfig.json` files use `"strict": true`, providing compile-time null safety, type checking, and prevention of many runtime errors.

---

## 3. Dependency Audit

### 3.1 Vulnerabilities Found

| Package | Severity | Type | Impact |
|---------|----------|------|--------|
| esbuild (via drizzle-kit) | MODERATE | SSRF in dev server | Dev-only, not in production bundle |
| @esbuild-kit/esm-loader | MODERATE | Transitive | Dev-only |
| @esbuild-kit/core-utils | MODERATE | Transitive | Dev-only |

**Assessment:** All vulnerabilities are in development-time tooling (drizzle-kit migrations). They do not affect the production runtime. Risk is LOW.

**Recommendation:** Upgrade `drizzle-kit` to latest when convenient.

### 3.2 No Risky Patterns

- No `eval()`, `Function()`, or dynamic code execution
- No `child_process.exec()` with unsanitized input
- No prototype pollution-prone patterns (`Object.assign` used only on owned config objects)

---

## 4. Known Limitations

1. **No authentication on health/metrics endpoints.** The Fastify server binds to `localhost` by default, which is safe for development. In production, these endpoints should be behind a reverse proxy or VPN.

2. **Dev credentials in `.env.example`.** The default `DATABASE_URL` contains `truman:truman` — this is intentional for local development only. Production must use strong, unique credentials.

3. **No TLS between services.** Inter-service communication (agent-brain ↔ memory-service ↔ Redis) uses plain TCP on localhost. Acceptable for single-host deployment; requires TLS if services are distributed.

4. **No request signing.** Internal API calls between services are not authenticated. Acceptable for single-host; needs service mesh or mTLS for multi-host.

5. **Viewer input sanitizer not yet implemented.** The 3-layer sanitizer pipeline (described in `security-spec.md`) is designed but not coded in the current MVP. Viewer interaction features (chat, voting) are out of scope for this stage.

---

## 5. Recommendations

### Priority 1 (Before Production)
- Add authentication to health/metrics endpoints (API key or reverse proxy)
- Use strong, unique database credentials (not `truman:truman`)
- Enable TLS for PostgreSQL and Redis connections
- Implement the 3-layer input sanitizer before enabling viewer interaction

### Priority 2 (Good Practice)
- Set up automated dependency scanning in CI (e.g., `npm audit` in pipeline)
- Add git pre-commit hook for secret scanning (git-secrets or truffleHog)
- Document secret rotation procedures
- Implement rate limiting on any public-facing endpoints

### Priority 3 (Future)
- Add request signing/mTLS for inter-service communication
- Encrypt sensitive JSONB fields in database (emotional context, metadata)
- Implement audit logging for operator actions
- Add CORS configuration when companion web app is deployed

---

## 6. Audit Methodology

1. **Automated scan:** `grep -r` across all source files for patterns: API keys, passwords, tokens, `eval`, `innerHTML`, raw SQL, `process.env` leaks
2. **Manual review:** Every TypeScript source file inspected for OWASP Top 10 patterns
3. **Dependency audit:** `npm audit` for known CVEs in dependency tree
4. **Test verification:** Existing test suite confirms health endpoint doesn't leak secrets, malformed inputs are handled gracefully, emotion/memory systems handle edge cases
5. **Configuration review:** `.gitignore`, `.env.example`, `docker-compose.yml`, all `tsconfig.json`

---

## Cross-References

- Detailed security architecture: `docs/security-spec.md`
- Cost protection strategy: `docs/cost-strategy.md`
- Observability and monitoring: `docs/observability-spec.md`
