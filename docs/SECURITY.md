# Security Audit Report — V1.0 Launch

**Date:** 2026-03-27
**Auditor:** Claude Opus 4.6 (4-phase audit: Recon, Targeted Audit, Deep Dive, Test Quality)
**Scope:** Full codebase — agent-brain, shared, memory-service, companion-web, renderer, stream-manager
**Result:** PASS — zero CRITICAL, zero HIGH (all fixed)

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | - |
| HIGH | 4 | All FIXED |
| MEDIUM | 3 | Documented, mitigated |
| LOW | 3 | Documented |

---

## Phase 1: Reconnaissance

### Attack Surface

| Endpoint | Type | Auth | Rate Limit |
|----------|------|------|------------|
| GET /health | HTTP | None | No |
| GET /metrics | HTTP | None | No |
| POST /state/save | HTTP | None | No |
| GET /state/load/:agentId | HTTP | None | No |
| POST /api/admin/login | HTTP | Password | 5/min/IP |
| GET /api/admin/* | HTTP | JWT Bearer | No |
| POST /api/admin/* | HTTP | JWT Bearer | No |
| GET /ws/mind-feed | WebSocket | None | 100 max, 10/IP |
| GET /ws/admin-feed | WebSocket | JWT query | 5 max, 10/IP |

### Secrets Management

All secrets externalized to `.env` (in `.gitignore`):
- `OPENROUTER_API_KEY`, `BRAVE_SEARCH_API_KEY`, `TTS_API_KEY`
- `TWITCH_CLIENT_SECRET`, `TWITCH_ACCESS_TOKEN`, `TWITCH_REFRESH_TOKEN`
- `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`
- `POSTGRES_PASSWORD`, `DATABASE_URL`
- `JWT_SECRET` (min 32 chars, validated on startup — fail-fast)
- `ADMIN_PASSWORD` (bcrypt hashed at runtime, 10 salt rounds)
- `CORS_ORIGIN` (production domain whitelist)

No hardcoded secrets found in source code (`grep -r` scan clean).

---

## Phase 2: Findings

### HIGH (ALL FIXED)

#### H1: No CSP Headers on Web Pages
- **Location:** `apps/companion-web/index.html`, `admin.html`
- **Risk:** XSS amplification — no browser-level content restrictions
- **Fix:** Added `Content-Security-Policy` meta tags: `script-src 'self'`, `style-src 'self' fonts.googleapis.com 'unsafe-inline'`, `connect-src 'self' ws: wss:`, `frame-src 'self'`, `font-src fonts.gstatic.com`
- **Status:** FIXED

#### H2: Database Fallback Credentials in Source
- **Location:** `packages/memory-service/drizzle.config.ts`
- **Risk:** Default credentials (`truman:truman`) hardcoded as fallback
- **Fix:** Changed to fail-fast (`throw Error`) if `DATABASE_URL` not set
- **Status:** FIXED

#### H3: No WebSocket Origin Check
- **Location:** `packages/agent-brain/src/health-server.ts` — WS handlers
- **Risk:** Cross-site WebSocket hijacking from malicious origins
- **Fix:** Added origin validation against `CORS_ORIGIN` whitelist in production mode
- **Status:** FIXED

#### H4: No WebSocket Heartbeat / Idle Disconnect
- **Location:** `packages/agent-brain/src/health-server.ts`
- **Risk:** Connection exhaustion from idle/zombie connections
- **Fix:** Ping/pong heartbeat every 30s. Auto-disconnect after 5 min idle.
- **Status:** FIXED

### MEDIUM (Documented — Mitigated)

#### M1: JWT Token in WebSocket URL Query Parameter
- **Location:** `/ws/admin-feed?token=...`
- **Risk:** Token visible in browser history, server logs, proxy logs
- **Mitigation:** Standard pattern for WebSocket auth (browsers don't support custom WS headers). Token has 24h expiry. Admin-only. HTTPS encrypts URL in transit.
- **Recommendation:** Consider post-connect auth message in v2

#### M2: JWT Stored in localStorage
- **Location:** `apps/companion-web/src/admin/login.ts`
- **Risk:** Accessible to any JS on the page (XSS vector)
- **Mitigation:** All innerHTML uses `escapeHtml()`. CSP restricts `script-src 'self'`. No `eval()`/`Function()` usage. Token cleared on logout.
- **Recommendation:** Consider httpOnly cookie for same-origin deployment

#### M3: No Rate Limiting on Admin API Endpoints
- **Location:** `/api/admin/*` (except login)
- **Risk:** Potential abuse with valid JWT
- **Mitigation:** JWT required (24h expiry). Single admin user. Connection limits in place.
- **Recommendation:** Add per-route rate limiting if exposed publicly

### LOW (Documented)

#### L1: In-Memory Login Rate Limit
- **Risk:** Resets on server restart. Acceptable for single-instance deployment.
- **Recommendation:** Redis-backed rate limiting for HA deployments

#### L2: Admin Settings No Schema Validation
- **Risk:** Arbitrary JSON accepted at `POST /api/admin/settings`
- **Mitigation:** JWT required. CognitiveLoop ignores unknown keys.
- **Recommendation:** Add Zod schema for settings updates

#### L3: Prometheus Metrics Unauthenticated
- **Risk:** Exposes operational data (tick count, uptime, memory count)
- **Mitigation:** No secrets exposed. Standard for Prometheus scraping. Bind to localhost.
- **Recommendation:** Add basic auth or network-level restriction in production

---

## Phase 3: Deep Dive

### XSS Protection
- All `innerHTML` usages reviewed — all user-derived data escaped via `escapeHtml()`
- No `eval()` or `Function()` constructor usage found
- CSP headers restrict script sources to `'self'`
- Game iframe sandboxed: `sandbox="allow-scripts allow-same-origin"`
- No `document.write`, no template literal HTML injection with raw data

### Authentication & Authorization
- bcrypt with 10 salt rounds (industry standard)
- JWT with 24h expiry, min 32-char secret (validated at startup, fail-fast)
- Login rate limit: 5 attempts/min per IP
- All `/api/admin/*` endpoints require valid JWT Bearer token (middleware hook)
- Admin WebSocket requires JWT in `?token=` query param

### Data Exposure — Public Feed Filter
- Allowlist approach via `filterForPublicFeed()`:
  - `thought` → `["text"]`
  - `mood_change` → `["mood", "prevMood"]`
  - `tool_call` → `["tool", "topic"]`
  - `activity_change` → `["activity", "prevActivity"]`
  - `blog_created` → `["title", "tags"]`
  - `artwork_created` → `["title", "style"]`
  - `reflection` → `["insight"]`
- Stripped: raw LLM prompts, tool I/O, costs, memory IDs, debug info

### CORS Configuration
- Configurable via `CORS_ORIGIN` env var (comma-separated domain whitelist)
- No wildcard `*` — exact match only
- Default (no env): localhost regex (dev mode)
- Methods restricted: GET, POST, OPTIONS
- Headers restricted: Content-Type, Authorization

### SQL Injection Prevention
- All queries use Drizzle ORM parameterized builders (`eq()`, `and()`, `desc()`)
- No raw SQL string concatenation

### Docker Security
- Non-root users in all Dockerfiles (`renderer:renderer`, `streamer:streamer`)
- Resource limits in production compose (CPU/memory)
- Log rotation (50MB max, 5 files)
- Health checks with timeouts
- Caddy reverse proxy with security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)

### Input Validation
- Zod schemas on all API boundaries (SaveDataSchema, MindFeedEventSchema, ActionCommandSchema, etc.)
- Chat sanitizer: 3-layer pipeline (context checks, profanity filter, injection detection)
- Web search input: query 1-200 chars, count 1-5

---

## Phase 4: Test Quality

### Security Tests
| Test File | Coverage |
|-----------|----------|
| `admin-auth.test.ts` | Password hashing, JWT creation/verification, rate limiting, secret validation |
| `admin-api.test.ts` | Login flow, JWT requirement, 401 on invalid/missing token, 429 rate limit |
| `security-negative.test.ts` | LLM failures, DB unavailable, embedding failures |
| `websocket-feed.test.ts` | Public/admin feed filtering, auth required, connection limits |
| `sanitizer.test.ts` | XSS, SQL injection, prompt injection detection |

### Grep Scan Results
- `grep -r "API_KEY\|SECRET\|PASSWORD" --include="*.ts"` → only env access patterns (process.env)
- No hardcoded credentials in source
- Test files use clearly marked test values (`"a".repeat(32)`, `"admin123"`)

---

## Recommendations for Future Versions

1. **Redis-backed rate limiting** for HA deployments
2. **httpOnly cookie auth** for same-origin admin panel
3. **Audit logging** — track admin actions (settings changes, resets, force-activity)
4. **CSP report-uri** — monitor policy violations in production
5. **Dependency scanning** — integrate `npm audit` in CI pipeline
6. **Manual penetration testing** of auth flows before public launch
7. **Service mesh / mTLS** if services are distributed across hosts
