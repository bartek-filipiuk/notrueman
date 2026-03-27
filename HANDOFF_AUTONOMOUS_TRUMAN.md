# HANDOFF_AUTONOMOUS_TRUMAN.md — Deep Focus + Autonomous Creative

**Data:** 2026-03-28
**Cel:** Truman zanurza się w aktywności na godziny, generuje content w trakcie, używa narzędzi, buduje narrację.

## Kontekst

Truman zmienia aktywność co 45s jak robot. Używa prostego BrainLoop (stateless, bez memory/tools). Prompt akcji to 3 linijki. Personality to 5 zdań inline zamiast 100-liniowego pliku. Zero memories w DB, zero tool calls, zero kreatywności.

## Założenia

- BrainLoop rozbudowany (nie przełączanie na CognitiveLoop)
- Tools przez backend proxy (Brave API key w .env)
- Memory via REST (POST /api/observation → INSERT memories)
- `config/truman-personality.md` istnieje i jest bogaty — tylko użyć
- Dashboard feed z DB polling — już działa

---

## Stage Y: Deep Focus + Rich Prompts

- [x] TY.1: Pełny personality prompt — `main.ts`: zamienić 5-liniowy `PERSONALITY` inline na import z `config/truman-personality.md` via Vite `?raw`. (implement)
- [x] TY.2: ActionCommand schema extension — `packages/shared/src/schemas/index.ts`: dodać do ActionCommandSchema: `continuePrevious: z.boolean().optional()`, `durationMinutes: z.number().min(1).max(300).optional()`, `toolRequest: z.object({ tool: z.string(), input: z.string() }).optional()`. (implement)
- [x] TY.3: Action planner prompt rozbudowa — `packages/agent-brain/src/action-planner.ts`: nowy prompt template z: interests, routine guidance per time of day, recent thoughts (last 3), recent memories (from parameter), continue/switch decision, tool suggestions. Prompt zachęca do deep focus i kreatywności. (implement)
- [x] TY.4: Continue/switch logic w BrainLoop — `brain-loop.ts`: dodać `currentActivityStartedAt: number` i `currentActivityDuration: number`. W tick: jeśli LLM zwraca `continuePrevious: true` → nie zmieniaj aktywności, generuj sub-content. Jeśli false → zmień jak dotychczas. (implement)
- [x] TY.5: Tick interval dynamiczny — zamiast stałe 45s: jeśli Truman jest w deep focus → tick co 90s (mniej przeszkadzania). Jeśli idle → tick co 30s (szybkie podjęcie decyzji). (implement)
- [x] TY.6: Thought generator z kontekstem — `thought-generator.ts`: dodać opcjonalne `toolResults` i `recentMemories` w ThoughtContext. Prompt: "You just searched for X and found Y" / "Your recent thoughts: A, B, C — continue your inner story." (implement)
- [x] TY.7: Testy — `turbo test` zielone. (test)

---

## Stage Z: Tool Calling + Memory via Backend Proxy

- [x] TZ.1: Backend endpoint POST /api/observation — `health-server.ts`. Body: `{ description, importance, emotionalContext, metadata }`. INSERT INTO memories. Bez auth (wewnętrzny, proxy). (implement)
- [x] TZ.2: Backend endpoint GET /api/recent-memories — `health-server.ts`. Query: `limit` (default 10). Returns last N memories ordered by created_at DESC. Bez auth. (implement)
- [x] TZ.3: Backend endpoint POST /api/tool/web-search — `health-server.ts`. Body: `{ query, count }`. Wywołuje Brave Search API z kluczem z .env. Returns results. Bez auth (wewnętrzny). (implement)
- [x] TZ.4: Brain tool calling — `main.ts` po action planning: jeśli activity = computer/draw/think i LLM toolRequest present → POST /api/tool/web-search → wyniki do thought context. (implement)
- [x] TZ.5: Memory posting — `main.ts` po każdym tick: POST /api/observation z { description: "Tick #N: [activity] — [thought]", importance: 5, emotionalContext: emotions.getState(), metadata: { toolResults, activity } }. (implement)
- [x] TZ.6: Memory retrieval — `main.ts` przed action planning: GET /api/recent-memories?limit=5 → dodaj do action planner prompt jako "Recent memories". (implement)
- [x] TZ.7: Creative output posting — jeśli LLM toolRequest = write_blog lub create_artwork → POST /api/observation z importance=8, metadata zawiera { tool, title, content/description }. Dashboard gallery je pokaże. (implement)
- [x] TZ.8: Testy — `turbo test` zielone. (test)

---

## Verification

1. `config/truman-personality.md` używany jako system prompt (widoczny w LLM call logs)
2. Action planner prompt zawiera: interests, routine, recent thoughts, recent memories
3. Truman przy kompie → zostaje 30+ min → generuje sub-content co 60-90s
4. Web search wywoływany → wyniki w DB memories
5. Blog/artwork → w memories z importance 8 → widoczne w Gallery tab
6. Dashboard feed: dziesiątki wpisów z jednej sesji komputerowej
7. memories table: > 0 wpisów po kilku minutach
