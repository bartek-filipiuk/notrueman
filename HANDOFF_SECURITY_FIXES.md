# HANDOFF_SECURITY_FIXES.md — Security Audit Remediation

**Data:** 2026-03-28
**Cel:** Naprawić 4 HIGH + 1 MEDIUM z SECURITY_AUDIT.md. Zero HIGH po fixach.
**Bazuje na:** SECURITY_AUDIT.md (audyt z 2026-03-27)

## Findings do naprawy

| ID | Severity | Problem | Fix |
|---|---|---|---|
| F1 | HIGH | `/state/save` i `/state/load` bez auth — każdy może nadpisać stan | Wymagać internal token lub ograniczyć do localhost |
| F2 | HIGH | Public feed ujawnia promptPreview, systemPreview, responsePreview | Usunąć preview fields z public feed |
| F3 | HIGH | `/api/llm-log` bez auth — DB spam, feed poisoning | Wymagać internal token |
| F4 | HIGH | API keys w URL params (?apiKey=, ?openaiKey=) | Przenieść na server-side lub .env only |
| F5 | MEDIUM | `?apiUrl=` może exfiltrować hasło admina | Usunąć override lub ograniczyć do same-origin |

---

## Stage AA: Security Fixes

- [ ] TAA.1: Lock `/state/*` endpoints — `health-server.ts`. Dodać internal token validation: header `X-Internal-Token` sprawdzany vs `INTERNAL_TOKEN` env var. SaveManager w renderer: dodać header do fetch calls. Alternatywnie: ograniczyć do requestów z localhost only (sprawdzić request.ip). (implement → test: curl bez tokena = 401)
- [ ] TAA.2: Lock `/api/llm-log` endpoint — `health-server.ts`. Ten sam internal token jak TAA.1. LLM client: dodać header `X-Internal-Token` do POST /api/llm-log. (implement → test: curl bez tokena = 401)
- [ ] TAA.3: Strip LLM previews z public feed — `health-server.ts` endpoint GET /api/public/feed. Dla llm_call items: usunąć `promptPreview`, `systemPreview`, `responsePreview`. Zostawić: model, callType, durationMs, inputTokens, outputTokens, success, createdAt. Public feed = "Truman used deepseek, 3s, 200 tokens" bez treści promptu. (implement → test: curl /api/public/feed nie zawiera preview)
- [ ] TAA.4: API keys server-side — `main.ts`. Zamiast `?apiKey=` w URL: 1) Najpierw sprawdzić `OPENROUTER_API_KEY` z .env (backend przekazuje do frontu przez endpoint). 2) Jeśli brak .env → fallback na URL param (dev mode only, z console warning). 3) Usunąć `?openaiKey=` z TTS config. Opcja: GET /api/config zwraca { hasApiKey: true } bez ujawniania klucza. LLM calls server-side (dłuższa zmiana — na później). MINIMUM na teraz: console.warn jeśli klucz w URL. (implement)
- [ ] TAA.5: Zabezpieczyć `?apiUrl=` — `companion-web/src/admin/login.ts`. Usunąć `?apiUrl=` override w production. Zostawić TYLKO jeśli origin = localhost. `const apiBase = window.location.hostname === 'localhost' ? (params.get('apiUrl') || '/api/admin') : '/api/admin'`. (implement → test)
- [ ] TAA.6: Rate limiting na public endpoints — `health-server.ts`. Dodać: max 60 req/min per IP na `/api/public/*`. Max 10 req/min na `/state/*` i `/api/llm-log`. Prosta in-memory mapa IP → count z reset co minutę. (implement)
- [ ] TAA.7: .env.example update — dodać `INTERNAL_TOKEN` (wygenerować random 32 chars). Dokumentacja w README. (implement)
- [ ] TAA.8: Testy security — dodać testy: unauthorized /state/save = 401, unauthorized /api/llm-log = 401, public feed nie zawiera promptPreview, ?apiUrl= zablokowany z external origin. `turbo test` zielone. (test)

### Security (MANDATORY):

- [ ] SAA.1: Zero HIGH findings po fixach — re-run audit scenarios z SECURITY_AUDIT.md. (verify)
- [ ] SAA.2: `turbo test` przechodzi. (verify)

### Stage Completion:

- [ ] SCAA.1: curl /state/save bez tokena = 401/403.
- [ ] SCAA.2: curl /api/llm-log bez tokena = 401/403.
- [ ] SCAA.3: curl /api/public/feed nie zawiera promptPreview/systemPreview/responsePreview.
- [ ] SCAA.4: ?apiUrl= zablokowany na non-localhost.
- [ ] SCAA.5: Rate limiting działa (>60 req/min = 429).
- [ ] SCAA.6: Testy zielone.
- [ ] SCAA.7: Zaktualizuj HANDOFF → [x].
