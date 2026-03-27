# HANDOFF_PUBLIC_DASHBOARD.md — Public Dashboard Redesign

**Data:** 2026-03-28
**Podejście:** DB polling, tabbed dashboard, full transparency (prompty, response, koszty)
**Cel:** Companion web = pełny monitoring dashboard. Feed z LLM calls + memories, timeline, galeria, emotion chart.

## Kontekst

Companion web (:4173) ma pusty game frame i minimalny mind feed. Redesign: usuwamy game frame, full-width dashboard z tabami. Dane z DB (nie WebSocket) — przetrwają refresh. Transparentność: pełne logi LLM widoczne publicznie.

## Założenia

- Backend (:3001) z PostgreSQL, tabelami memories + llm_calls
- `createLLMCallLog()` i `createMemoryRepository()` dostępne
- Companion web Vite proxy: `/api/*` → :3001
- Vanilla TS + HTML + CSS (NO React/Vue)
- Dark gaming theme (istniejący style.css jako baza)

## Dependency Graph

```
Stage W (Public API endpoints)
    |
    v
Stage X (Dashboard Redesign)
```

---

## Stage W: Public Feed API (No Auth)

**Cel:** Nowe publiczne endpointy zwracające dane z DB bez JWT. Polling co 10s.

### Taski:

- [x] TW.1: GET /api/public/feed — `health-server.ts`. Zwraca merged timeline: last 50 memories + last 50 llm_calls, sorted by created_at DESC. Response: `{ items: Array<{ source: "memory" | "llm_call", data: Record<string, unknown>, createdAt: string }> }`. Query params: `limit` (default 50), `since` (ISO timestamp for incremental). Bez auth. (implement → test curl)
- [x] TW.2: GET /api/public/stats — `health-server.ts`. Returns aggregate stats: `{ callsToday, totalTokensIn, totalTokensOut, totalCostUsd, avgDurationMs, errorCount, memoriesCount, uptime, currentMood, currentActivity, dayCount }`. Bez auth. (implement → test)
- [x] TW.3: GET /api/public/gallery — `health-server.ts`. Memories z metadata.toolCalls containing write_blog_post lub create_artwork. Returns: `{ items: Array<{ type: "blog" | "artwork", title, content, description, style, tags, createdAt }> }`. Bez auth. (implement → test)
- [x] TW.4: GET /api/public/emotions — `health-server.ts`. Last 100 memories z emotionalContext (non-null). Returns: `{ points: Array<{ timestamp: string, happiness, curiosity, anxiety, boredom, excitement, contentment, frustration }> }`. Bez auth. (implement → test)
- [x] TW.5: LLMCallLog public methods — `llm-call-log.ts`. Dodać: `getPublicRecentCalls(limit)` (bez agentId filter, returns all), `getPublicStats()`. (implement → test)
- [x] TW.6: start-backend.ts — inject memory repository do deps dla public endpoints. (implement → verify)
- [x] TW.7: Testy — curl test all 4 endpoints, data returns correctly. `turbo test` zielone. (test)

### Security (MANDATORY):
- [x] SW.1: Public endpoints NIE zwracają: system prompts (>200 chars), API keys, passwords, full prompts (max 500 chars preview). (verify)
- [x] SW.2: Rate limit: max 60 requests/min per IP na public endpoints. (implement)
- [x] SW.3: `turbo test` przechodzi. (verify)

### Stage Completion:
- [x] SCW.1: curl /api/public/feed zwraca dane.
- [x] SCW.2: curl /api/public/stats zwraca statystyki.
- [x] SCW.3: testy zielone.
- [x] SCW.4: Zaktualizuj HANDOFF → [x].

---

## Stage X: Companion Web Dashboard Redesign

**Cel:** Full-width tabbed dashboard. Dark gaming theme. DB polling co 10s. Feed, Timeline, Gallery, Emotions.

**Design:** Gaming/Twitch dark aesthetic. Dark bg #0f0f13, gradient accents purple→cyan, glassmorphism cards. Tabs pill-style. Copy buttons na entries. Responsive mobile.

### Taski:

- [x] TX.1: HTML layout — `index.html` REWRITE. Usunąć game frame. Struktura: nav (logo + badges) → stats bar → tab nav (Feed | Timeline | Gallery | Emotions) → tab content area → footer. (implement)
- [x] TX.2: Stats bar — `src/stats-bar.ts` NEW. Polling /api/public/stats co 10s. Cards: 🧠 calls | 📊 tokens | 💰 cost | 💾 memories | ⏱ uptime | 📅 day. Mood + activity badges. Kolory: green OK, yellow >80%, red errors. (implement)
- [x] TX.3: Feed tab — `src/feed.ts` NEW. Polling /api/public/feed co 10s. Entries: timestamp | type badge | content preview. Types: 🤖 LLM Call (purple), 💭 Memory (blue), 🔍 Search (amber), 📝 Blog (green), 🎨 Art (pink). LLM entries: model, duration, tokens, cost, prompt preview (100 chars). Click → detail modal z prompt_preview + response_preview + full metadata. Copy button per entry (JSON clipboard). Filtry: type dropdown, search text. Manual refresh button. (implement)
- [x] TX.4: Timeline tab — `src/timeline.ts` NEW. Polling /api/public/feed. Horizontal timeline: time axis (hours), colored blocks per activity (read=blue, cook=orange, sleep=purple, draw=pink, computer=cyan, exercise=green, think=amber, eat=red). Hover → tooltip z thought. Data grouped by hour. (implement)
- [x] TX.5: Gallery tab — `src/gallery.ts` NEW. Polling /api/public/gallery. Grid layout. Blog cards: 📝 title + preview + tags. Artwork cards: 🎨 title + description + style. Click → modal z full content. Empty state: "No creative works yet". (implement)
- [x] TX.6: Emotions tab — `src/emotions-chart.ts` NEW. Polling /api/public/emotions. Canvas line chart: 7 lines per emotion, X=time, Y=0-1. Colors per dimension (happiness=gold, curiosity=cyan, anxiety=red, boredom=grey, excitement=yellow, contentment=green, frustration=orange). Hover crosshair → tooltip. (implement)
- [x] TX.7: Tab routing — `src/main.ts` REWRITE. Hash routing: #feed (default), #timeline, #gallery, #emotions. Tab pill buttons. Active state gradient. Content area swap. Init: load stats + first tab data. (implement)
- [x] TX.8: CSS — `src/style.css` REWRITE. Remove game frame styles. Add: tab pills, stats cards, feed entries, timeline blocks, gallery grid, emotion chart container. Dark theme. Copy button. Modal. Responsive (mobile: stack tabs, full width). (implement)
- [x] TX.9: Detail modal — reuse existing modal pattern. LLM call: prompt_preview, system_preview, response_preview, model, tokens, cost, duration, error. Memory: description, type, importance, emotionalContext, metadata (toolCalls). Copy full JSON. (implement)
- [x] TX.10: Testy — tab routing, stats display, feed entries render, copy button, responsive. `turbo test` zielone. (test)

### Security (MANDATORY):
- [x] SX.1: Brak innerHTML z raw data — textContent only. XSS safe. (verify)
- [x] SX.2: Copy button copies sanitized JSON (no secrets). (verify)
- [x] SX.3: `turbo test` przechodzi. (verify)

### Stage Completion:
- [x] SCX.1: http://localhost:4173/ — stats bar z danymi, feed z logami.
- [x] SCX.2: Feed: kliknięcie → detail z prompt/response preview.
- [x] SCX.3: Timeline: kolorowe bloki aktywności.
- [x] SCX.4: Gallery: karty blog/artwork.
- [x] SCX.5: Emotions: wykres liniowy.
- [x] SCX.6: Refresh → dane nadal widoczne (DB).
- [x] SCX.7: Testy zielone.
- [x] SCX.8: Zaktualizuj HANDOFF → [x].
