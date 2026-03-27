# HANDOFF_V1_LAUNCH.md — V1.0 Launch: Mind Feed + Admin Panel + Deploy

**Data:** 2026-03-27
**Podejście:** Web app first (bez Twitch streaming). Gaming/Twitch overlay UI. WebSocket mind feed.
**Cel:** Publiczna strona z game canvas + live mind feed + admin panel. Deploy na Coolify/VPS. Security audit pass.
**Bazuje na:** 260/263 tasków done. Brain, state persistence, creative tools — gotowe. Brak: public UI, admin, deployment.

## Kontekst

Cała infrastruktura gotowa (brain, memory, emotions, tools, state persistence, 508 testów). Brakuje frontendu publicznego (mind feed z myślami Trumana), panelu admina (kontrola, logi, ustawienia) i deployment config. V1.0 = web app bez Twitch streamu.

## Założenia

- Companion web (`apps/companion-web`) istnieje — do przebudowy
- HealthServer Fastify na :3001 — dodajemy WebSocket + admin endpoints
- CognitiveLoop — dodajemy EventEmitter do emitowania eventów
- Deploy na Coolify/VPS (Docker Compose)
- ADMIN_PASSWORD w .env (JWT auth)
- OUT of scope: Twitch/YT streaming, TTS, chat bot, prawdziwe publikowanie

## Dependency Graph

```
Stage M (WebSocket Mind Feed + Events)
    |
    v
Stage N (Admin Panel)
    |
    v
Stage O (Companion Web Redesign)
    |
    v
Stage P (Security Audit + Deployment)
```

---

## Stage M: WebSocket Mind Feed + Event System

**Cel:** Brain emituje eventy → WebSocket streamuje myśli Trumana do przeglądarki w realtime.
**User Stories:** US-FEED-1 (widzowie widzą myśli Trumana live)

### Taski:

- [x] TM.1: Event types — nowy `packages/shared/src/types/mind-feed.ts`. Typy eventów: `MindFeedEvent = { type: "thought" | "mood_change" | "tool_call" | "activity_change" | "blog_created" | "artwork_created" | "reflection", timestamp: number, data: Record<string, unknown>, public: boolean }`. Zod schema. Eksport z browser.ts. (implement → test types)
- [x] TM.2: EventEmitter w CognitiveLoop — `packages/agent-brain/src/cognitive-loop.ts`. Dodać EventEmitter (Node.js native). Emit events: po generateThought → `thought`, po emotion update → `mood_change`, po tool call → `tool_call`, po activity change → `activity_change`, po blog/artwork → `blog_created`/`artwork_created`, po reflection → `reflection`. Każdy event z timestamp + dane. (implement → test emit fires)
- [x] TM.3: WebSocket server — `packages/agent-brain/src/health-server.ts`. Install `@fastify/websocket`. Dwa endpointy: `GET /ws/mind-feed` (public, auto-upgrade), `GET /ws/admin-feed` (JWT required w query param `?token=`). Broadcast do wszystkich connected clients. Max 100 connections. (implement → test WebSocket connect)
- [x] TM.4: Public feed filter — w mind-feed WebSocket: filtruj eventy z `public: true`. Przekazuj: thought text, mood name, blog/artwork title, search topic (bez query details), activity name. BEZ: raw LLM prompts, tool inputs/outputs, koszty, debug info, memory IDs. (implement → test filter)
- [x] TM.5: Admin feed — w admin-feed WebSocket: WSZYSTKO bez filtrowania. Pełne prompty, tool I/O z wartościami, koszty per call, emotion deltas (stare→nowe), memory IDs, timing per operation. Wymaga JWT token w `?token=`. (implement → test auth required)
- [x] TM.6: Client reconnect helper — nowy `apps/companion-web/src/ws-client.ts`. Auto-reconnect z exponential backoff (1s, 2s, 4s, max 30s). Parse JSON events. Callback pattern: `onEvent(event: MindFeedEvent)`. Connection status indicator. (implement → test reconnect)
- [ ] TM.7: Wire brain → WebSocket — w health-server: listen na CognitiveLoop events → broadcast do WebSocket clients. Jeśli brain nie uruchomiony → status message "brain offline". (implement → verify E2E)
- [ ] TM.8: Testy — unit: event types Zod, filter logic, reconnect backoff. Integration: WebSocket mock server, event emission → client receive. `turbo test` zielone. (test → verify green)

### Security (MANDATORY):

- [ ] SM.1: Admin feed wymaga JWT — połączenie bez tokena = disconnect. (test)
- [ ] SM.2: Public feed nie ujawnia secrets, raw LLM, kosztów. (verify filter)
- [ ] SM.3: Max connections: 100 public + 5 admin. Rate limit: max 10 connections/IP. (implement)
- [ ] SM.4: `turbo test` przechodzi. (verify)

### Docs (MANDATORY):

- [ ] DM.1: Update `docs/CHANGELOG.md` — wpis Stage M.
- [ ] DM.2: Update `docs/API.md` — WebSocket endpoints, event types.

### Stage Completion (MANDATORY):

- [ ] SCM.1: Self-check — WebSocket /ws/mind-feed streamuje thoughts.
- [ ] SCM.2: Self-check — admin feed wymaga JWT.
- [ ] SCM.3: Self-check — public feed nie zawiera secrets.
- [ ] SCM.4: Self-check — testy zielone.
- [ ] SCM.5: Zaktualizuj HANDOFF → [x].

**Stage M DoD:** Brain tick → event emitted → WebSocket broadcast → client receives thought/mood/tool event w realtime. Admin feed z pełnym debug.

---

## Stage N: Admin Panel (Auth + Dashboard + Controls)

**Cel:** Panel admina z JWT auth, live dashboard, pełne logi, edytowalne ustawienia, kontrole.
**User Stories:** US-ADMIN-1 (admin kontroluje Trumana)

### Taski:

- [ ] TN.1: JWT auth system — w `packages/agent-brain/src/health-server.ts`: `POST /api/admin/login` (body: `{ password }`, compare z `ADMIN_PASSWORD` env var, bcrypt hash). Zwraca `{ token }` (JWT, 24h expiry, secret z env `JWT_SECRET`). Middleware `verifyJWT` na `/api/admin/*` routes. Rate limit: max 5 login attempts/min. `.env.example`: dodać `ADMIN_PASSWORD`, `JWT_SECRET`. (implement → test valid/invalid/expired)
- [ ] TN.2: Admin API endpoints — w health-server.ts: `GET /api/admin/memories` (query: `{ type?, importance?, limit?, offset? }` → z memory service), `GET /api/admin/brain-state` (current emotions, activity, tick count, budget), `POST /api/admin/settings` (body: partial TrumanConfig → hot-reload), `GET /api/admin/settings` (current config), `POST /api/admin/reset` (body: `{ mode: "soft" | "hard" }` → SaveManager reset), `POST /api/admin/force-activity` (body: `{ activity: ActivityType }` → override next tick). (implement → test each endpoint)
- [ ] TN.3: Admin login page — w `apps/companion-web/src/admin/login.ts`: login form (password input, submit button), POST /api/admin/login, store JWT w localStorage, redirect do /admin dashboard. Styled: dark bg, centered form, gradient button. (implement → verify login flow)
- [ ] TN.4: Admin dashboard — `apps/companion-web/src/admin/dashboard.ts`: live status (activity, mood, day, uptime, tick count) — updated z /ws/admin-feed. Emotion radar chart (7 dims, animated). Budget usage bar (calls used/remaining, color coded). Recent memories list (last 20, clickable for detail). (implement → verify realtime updates)
- [ ] TN.5: Admin log viewer — `apps/companion-web/src/admin/log-viewer.ts`: realtime z /ws/admin-feed. Entries: timestamp + type badge + content. Filtry: type dropdown (thought/tool/emotion/memory/system), search text, min importance. Scrollable, max 200 entries, auto-scroll toggle. Color coded per type. (implement → verify filter works)
- [ ] TN.6: Admin settings panel — `apps/companion-web/src/admin/settings.ts`: editable fields: interests (tag input, add/remove), tick interval (range slider 15-120s), model names (text inputs), daily budget limit (number), personality prompt (textarea, markdown). Save button → POST /api/admin/settings. Feedback: "Saved ✓" toast. (implement → verify hot-reload)
- [ ] TN.7: Admin controls — `apps/companion-web/src/admin/controls.ts`: buttons: "Soft Reset" (yellow, preserves day), "Hard Reset" (red, confirm dialog), "Force Activity" (dropdown + go button). Visibility toggles: checkboxes for what public feed shows (thoughts, moods, tools, creativity). POST /api/admin/reset, POST /api/admin/force-activity. (implement → test each control)
- [ ] TN.8: Testy — JWT: valid login, wrong password (401), expired token (401), rate limit (429). Settings: save + reload. Reset: soft preserves day, hard clears. Force activity: override next tick. `turbo test` zielone. (test → verify green)

### Security (MANDATORY):

- [ ] SN.1: ADMIN_PASSWORD nie hardcoded — tylko .env. `grep -r "ADMIN" --include="*.ts"` = only env access. (verify)
- [ ] SN.2: JWT_SECRET nie hardcoded — generowany losowo jeśli nie ustawiony. Min 32 chars. (verify)
- [ ] SN.3: Login rate limit — 5 attempts/min per IP. Brute-force protection. (test)
- [ ] SN.4: Admin endpoints 401 bez JWT. (test)
- [ ] SN.5: `turbo test` przechodzi. (verify)

### Docs (MANDATORY):

- [ ] DN.1: Update `docs/CHANGELOG.md` — wpis Stage N.
- [ ] DN.2: Update `docs/API.md` — admin endpoints, JWT auth flow.
- [ ] DN.3: Update `docs/README.md` — sekcja "Admin Panel" (setup, first login).

### Stage Completion (MANDATORY):

- [ ] SCN.1: Self-check — login z hasłem → dashboard widoczny.
- [ ] SCN.2: Self-check — admin widzi realtime logi (thoughts, tools).
- [ ] SCN.3: Self-check — settings save → config hot-reloaded.
- [ ] SCN.4: Self-check — reset buttons działają.
- [ ] SCN.5: Self-check — testy zielone.
- [ ] SCN.6: Zaktualizuj HANDOFF → [x].

**Stage N DoD:** `/admin` → login form → dashboard z live emocjami + logami + ustawieniami. Soft/hard reset. Force activity. Visibility toggles.

---

## Stage O: Companion Web Redesign — Gaming/Twitch Style

**Cel:** Publiczna strona premium quality. Game canvas + mind feed + status. Dark mode, gaming aesthetic.
**User Stories:** US-FEED-1 (public mind feed), US-UX-1 (premium design)

**Design direction:** Gaming/Twitch overlay aesthetic. Dark bg (#0f0f13), gradient accent borders (purple→cyan), glassmorphism cards, badge/tag style, subtle glow effects. Font: Inter + monospace. Live indicators (pulsujące dots). Chat-sidebar mind feed.

### Taski:

- [ ] TO.1: Layout redesign — `apps/companion-web/index.html` + `src/style.css` przebudowa. Desktop: lewo = game canvas (iframe, 16:9, border glow purple→cyan gradient), prawo = mind feed sidebar (chat-style, dark, scrollable, 350px). Góra: nav bar z logo "No True Man Show" + status badges + "Admin" link. Dół (pod game): emotion bar + budget + day counter. (implement → verify layout)
- [ ] TO.2: Mind feed UI — `apps/companion-web/src/mind-feed.ts`. Chat-style feed (jak Twitch chat ale myśli). Karty z gradient border per type: 💭 thought (purple #9b59b6), 😊 mood (cyan #00d2ff), 🔍 search (amber #f39c12), 📝 blog (green #2ecc71), 🎨 artwork (pink #e91e63). Slide-in animation (translateX), auto-scroll z "scroll to bottom" button. Max 50 entries (FIFO). Timestamp relative ("2m ago"). (implement → verify animations)
- [ ] TO.3: Status bar — `apps/companion-web/src/status-bar.ts`. Badge style: "🟢 LIVE Day 3" (pulsujący green dot animation), "🧠 curious" (mood z ikoną), "📖 reading" (activity), "⚡ 15/20" (budget). Dark gradient bg. Updated z WebSocket events. Sticky position between game and feed. (implement → verify badges update)
- [ ] TO.4: Emotion visualization — `apps/companion-web/src/emotion-chart.ts`. Radial/spider chart (7 dims: happiness, curiosity, anxiety, boredom, excitement, contentment, frustration). CSS-only lub lightweight canvas. Neonowe kolory per dimension. Animated transitions na zmianę. Tooltip on hover. Umieszczony w sidebar pod status. (implement → verify chart renders)
- [ ] TO.5: Blog/artwork preview — kliknięcie wpisu w feed → glassmorphism modal (backdrop blur, dark bg, gradient border). Blog: title + full content + tags. Artwork: title + description + style. Close: Escape lub klik poza. Fade-in animation. (implement → verify modal)
- [ ] TO.6: Mobile responsive — breakpoint 768px: stack vertical. Game full width (aspect ratio preserved). Status bar horizontal scroll. Mind feed below game, full width. Touch-friendly cards (min 44px tap targets). No horizontal scroll. (implement → verify mobile)
- [ ] TO.7: Styling polish — `apps/companion-web/src/style.css` overhaul: CSS custom properties (--color-bg, --color-accent, etc.), transitions na hover (0.2s ease), focus states (outline glow), scrollbar styling (thin, dark), selection color. Font loading: Inter (Google Fonts) + system monospace. (implement → verify design quality)
- [ ] TO.8: Testy — layout render at desktop/mobile breakpoints, WebSocket connection + card display, badge update from events, modal open/close. `turbo test` zielone. (test → verify green)

### Security (MANDATORY):

- [ ] SO.1: Game iframe sandbox — `sandbox="allow-scripts allow-same-origin"`. Brak allow-forms, allow-popups. (verify)
- [ ] SO.2: Mind feed content escaped — brak innerHTML z raw event data. TextContent only. (verify)
- [ ] SO.3: `turbo test` przechodzi. (verify)

### Docs (MANDATORY):

- [ ] DO.1: Update `docs/CHANGELOG.md` — wpis Stage O.
- [ ] DO.2: Update `docs/README.md` — sekcja "Public Website" (URL, features).

### Stage Completion (MANDATORY):

- [ ] SCO.1: Self-check — strona desktop: game + mind feed + status wygląda premium.
- [ ] SCO.2: Self-check — mind feed streamuje thoughts w realtime.
- [ ] SCO.3: Self-check — mobile layout działa (brak horizontal scroll).
- [ ] SCO.4: Self-check — emotion chart animuje się.
- [ ] SCO.5: Self-check — testy zielone.
- [ ] SCO.6: Zaktualizuj HANDOFF → [x].

**Stage O DoD:** Otwierasz stronę → gaming dark layout z game po lewej, mind feed po prawej, status badges. Thoughts pojawiają się live z animacją slide-in. Emocje na radar chart. Mobile: stack vertical. PREMIUM feel.

---

## Stage P: Security Audit + Deployment Config

**Cel:** Security audit pass. Docker Compose production-ready. Coolify deploy.
**User Stories:** US-SEC-1 (bezpieczeństwo), US-DEPLOY-1 (deploy na VPS)

### Taski:

- [ ] TP.1: Security audit — uruchomić PROMPT_SECURITY_AUDIT.md (full 4-phase: Recon → Targeted Audit → Deep Dive → Test Quality). Fix ALL critical/high findings natychmiast. Document medium/low w `docs/SECURITY.md` z recommendations. Fazy: scan all endpoints, auth, input validation, CORS, secrets, data exposure. (audit → fix → document)
- [ ] TP.2: JWT hardening — token expiry 24h (verify), refresh token opcjonalny, rate limit login 5/min (verify), JWT_SECRET min 32 chars (validate on startup, fail-fast). httpOnly cookie opcja (jeśli same-origin). (verify → fix if needed)
- [ ] TP.3: WebSocket hardening — origin check (allowlist), max 100 public + 5 admin connections, rate limit: max 10 connections/IP, heartbeat ping/pong (30s), auto-disconnect idle (5 min). (implement → test limits)
- [ ] TP.4: CORS production — zamienić localhost na production domain w HealthServer. Env var `CORS_ORIGIN` (default localhost:5173, production: https://yourdomain.com). Brak wildcard *. (implement → verify)
- [ ] TP.5: Docker Compose production — `docker-compose.prod.yml` update: services: app (renderer + companion-web, multi-stage build, static serve), api (health-server + brain, Node.js), postgres (pgvector), redis. Resource limits (memory, CPU). Healthchecks. Log rotation (50MB max). Named volumes. `.env` template z ALL required vars. (implement → verify docker compose up)
- [ ] TP.6: Coolify config — `Dockerfile` multi-stage (build → serve). Build: npm ci + turbo build. Serve: nginx lub caddy static + Node.js API. Port mapping. Environment variables injection. Deploy script / GitHub Actions workflow (opcjonalnie). (implement → test build)
- [ ] TP.7: Smoke test script — nowy `scripts/smoke-test.sh`: 1) health check (curl /health), 2) WebSocket connect (wscat), 3) admin login (curl POST), 4) state save/load (curl), 5) wait 2 min for brain ticks, 6) verify memories in DB (curl /api/admin/memories), 7) report pass/fail. (implement → run)
- [ ] TP.8: Final test suite — `turbo build && turbo typecheck && turbo test` ALL packages green. Security grep: `grep -r "API_KEY\|SECRET\|PASSWORD" --include="*.ts" -l` = only .env access. No hardcoded secrets. (run → verify green)

### Security (MANDATORY):

- [ ] SP.1: PROMPT_SECURITY_AUDIT.md passed — zero CRITICAL, zero HIGH findings. (audit → verify)
- [ ] SP.2: All secrets in .env only. `.env` in `.gitignore`. (verify)
- [ ] SP.3: Production CORS — domain whitelist, no wildcard. (verify)
- [ ] SP.4: WebSocket rate limiting active. (test)
- [ ] SP.5: `turbo test` przechodzi finalnie. (verify)

### Docs (MANDATORY):

- [ ] DP.1: Update `docs/CHANGELOG.md` — wpis Stage P (V1.0 release).
- [ ] DP.2: Update `docs/SECURITY.md` — full audit results.
- [ ] DP.3: Update `docs/README.md` — deployment guide (Docker, Coolify, env vars).
- [ ] DP.4: Update `docs/RUNBOOK.md` — production operations (restart, logs, monitoring).

### Stage Completion (MANDATORY):

- [ ] SCP.1: Self-check — security audit: zero critical/high.
- [ ] SCP.2: Self-check — docker compose up → all services healthy.
- [ ] SCP.3: Self-check — smoke test passes.
- [ ] SCP.4: Self-check — CORS production domain configured.
- [ ] SCP.5: Self-check — testy zielone (508+ tests).
- [ ] SCP.6: Zaktualizuj HANDOFF → [x].

**Stage P DoD:** Security audit pass. Docker Compose production-ready. Smoke test green. Gotowe do deploy — ustaw klucze w .env i odpalaj.

---

## Coverage Check

| User Story | Stage(s) |
|---|---|
| US-FEED-1: Widzowie widzą myśli Trumana live | Stage M (TM.1-TM.7) + Stage O (TO.2) |
| US-ADMIN-1: Admin kontroluje Trumana | Stage N (TN.1-TN.7) |
| US-UX-1: Premium gaming/dark design | Stage O (TO.1-TO.7) |
| US-SEC-1: Security audit pass | Stage P (TP.1-TP.3) |
| US-DEPLOY-1: Deploy na Coolify/VPS | Stage P (TP.5-TP.6) |

## Security Traceability

| Wymaganie | Stage | Task |
|---|---|---|
| JWT auth (admin) | Stage N | SN.1-SN.4 |
| WebSocket security | Stage M + P | SM.1-SM.3, TP.3 |
| Public feed filtering | Stage M | SM.2 |
| CORS production | Stage P | TP.4 |
| Full security audit | Stage P | TP.1, SP.1 |
| Secrets management | Stage P | SP.2 |
| Rate limiting | Stage N + P | SN.3, SP.4 |
