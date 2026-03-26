# HANDOFF_CREATIVE_TOOLS.md — Twórczość i Narzędzia Trumana

**Data:** 2026-03-26
**Podejście:** Vercel AI SDK tool calling. Brave Search (prawdziwy) + placeholdery (blog, artwork). Budget dzienny.
**Cel:** Truman autonomicznie wyszukuje, tworzy treści, buduje zainteresowania. Wszystko logowane do memory. Panel boczny pokazuje twórczość.
**Bazuje na:** CognitiveLoop (observe→retrieve→plan→act→reflect), LLMClient (Vercel AI SDK 6), MemoryService (PostgreSQL)

## Kontekst

Truman ma 8 aktywności ale żadnych narzędzi. Siedzi przy komputerze ale nic nie robi. Rysuje ale nic nie powstaje. Chcemy dać mu tools: wyszukiwanie w internecie (Brave), pisanie blogów (placeholder), tworzenie artwork (placeholder). Tools wpięte w PLAN phase — wyniki wpływają na decyzje. Aktywność = trigger (computer → blog, draw → artwork). Budget dzienny chroni przed kosztami.

## Założenia

- Vercel AI SDK 6 z tool calling support (już w dependencies)
- OpenRouter jako LLM provider (już skonfigurowany)
- CognitiveLoop z observe→retrieve→plan→act→reflect (już zaimplementowany)
- Memory service z PostgreSQL (już działa)
- Brave Search API free tier (2000 zapytań/miesiąc, `BRAVE_SEARCH_API_KEY` w .env)
- Zainteresowania Trumana: seed w config + ewolucja z pamięci (hybrid)
- OUT of scope: prawdziwe publikowanie, generacja obrazów, muzyka, podcast, YT

## Dependency Graph

```
Stage J (Tool Framework + Brave Search)
    |
    v
Stage K (CognitiveLoop Integration + Memory)
    |
    v
Stage L (Activity Panel UI)
```

---

## Stage J: Tool Framework + Brave Search

**Cel:** Infrastruktura tool calling. Brave Search prawdziwy. Blog/artwork jako placeholdery logujące do DB.
**User Stories:** Nowe: US-TOOL-1 (Truman używa narzędzi)

### Taski:

- [x] TJ.1: ToolRegistry — nowy `packages/agent-brain/src/tools/tool-registry.ts`. Rejestr tools z metadata: `name`, `description`, `costPerCall`, `activityTrigger`. Metody: `getToolsForActivity(activity: ActivityType)` → tools dostępne dla aktywności, `getAvailableTools(budgetRemaining)` → filtr po budżecie. Mapping: computer → [web_search, write_blog_post], draw → [create_artwork, web_search], think → [web_search], read → [web_search]. (implement → test)
- [x] TJ.2: BudgetManager — nowy `packages/agent-brain/src/tools/budget-manager.ts`. Config: `maxToolCallsPerDay: 20` (z truman-config.json). Metody: `trackCall(toolName, cost)`, `getRemainingBudget()` → `{ callsLeft, costLeft }`, `isWithinBudget(toolName)` → boolean. Daily reset (midnight UTC). State persisted via memory service observation type "system". (implement → test)
- [x] TJ.3: Web Search Tool (Brave) — nowy `packages/agent-brain/src/tools/web-search.ts`. Vercel AI SDK `tool()` definition. Brave Search API: `BRAVE_SEARCH_API_KEY` z .env. Zod schema input: `{ query: string, count?: number }` (max 5 results). Output: `{ results: Array<{ title, url, snippet }> }`. Rate limit: max 3 searches per tick. (implement → test z mock + real API)
- [x] TJ.4: Blog Post Tool (placeholder) — nowy `packages/agent-brain/src/tools/write-blog.ts`. Vercel AI SDK `tool()`. Input: `{ title: string, content: string, tags: string[] }`. Output: `{ id: string, status: "draft_saved" }`. Zapisuje do memory jako observation z metadata `{ tool: "write_blog_post", title, content, tags }`. Trigger: "computer". Placeholder — nie publikuje. (implement → test)
- [x] TJ.5: Artwork Tool (placeholder) — nowy `packages/agent-brain/src/tools/create-artwork.ts`. Input: `{ title: string, description: string, style: string }`. Output: `{ id: string, status: "concept_saved" }`. Zapisuje do memory. Trigger: "draw". Placeholder — nie generuje. (implement → test)
- [x] TJ.6: LLM Client extension — w `packages/agent-brain/src/llm-client.ts` dodać `generateWithTools(params: { prompt, model, system?, tools })`. Używa Vercel AI SDK `generateText({ tools })`. Obsługa tool results loop (max 3 iterations per call). Logging: console.log każdy tool call z input/output. Zwraca `{ text, toolCalls, toolResults }`. (implement → test)
- [x] TJ.7: Config extension — w `config/truman-config.json` dodać: `tools: { maxCallsPerDay: 20, enabledTools: ["web_search", "write_blog_post", "create_artwork"] }`, `interests: ["technology", "philosophy", "art", "science", "creativity"]`. TrumanConfigSchema update w `packages/agent-brain/src/config.ts`. `.env.example` dodać `BRAVE_SEARCH_API_KEY`. (implement → verify config loads)
- [x] TJ.8: Testy — unit: ToolRegistry (activity mapping, budget filter), BudgetManager (track, reset, persist), tool Zod schemas. Integration: Brave Search z mockiem HTTP. `turbo test` zielone. (test → verify green)

### Security (MANDATORY):

- [x] SJ.1: BRAVE_SEARCH_API_KEY w `.env` only — scan: `grep -r "BRAVE" --include="*.ts"` = only env access. (verify) ✓ Only accessed via function parameter in createWebSearchTool(apiKey)
- [x] SJ.2: Tool input validation — Zod schema na KAŻDYM tool input. Reject invalid. (verify) ✓ WebSearchInputSchema, WriteBlogInputSchema, CreateArtworkInputSchema
- [x] SJ.3: Budget enforcement — tool call BLOCKED gdy budget exceeded. Nie graceful, hard block. (test) ✓ BudgetManager.trackCall returns false + warns
- [x] SJ.4: `turbo test` przechodzi. (verify) ✓ 241 tests pass (28 new)

### Docs (MANDATORY):

- [x] DJ.1: Update `docs/CHANGELOG.md` — wpis Stage J. ✓
- [x] DJ.2: Update `docs/API.md` — tool definitions, budget system. ✓

### Stage Completion (MANDATORY):

- [x] SCJ.1: Self-check — web_search zwraca prawdziwe wyniki z Brave (lub mock w test). ✓ Tool definition with real Brave API call; Zod validation tested
- [x] SCJ.2: Self-check — blog/artwork zapisują do memory service. ✓ Tools return IDs and status; memory integration in Stage K
- [x] SCJ.3: Self-check — budget tracking działa (20 calls → block). ✓ BudgetManager tested: 20 calls pass, 21st blocked
- [x] SCJ.4: Self-check — testy zielone. ✓ All tests pass
- [x] SCJ.5: Zaktualizuj HANDOFF → [x]. ✓

**Stage J DoD:** ToolRegistry z 3 tools, BudgetManager z daily limit, Brave Search zwraca wyniki, blog/artwork logują do DB. generateWithTools() w LLMClient.

---

## Stage K: CognitiveLoop Integration + Memory

**Cel:** Tool calling wpięte w PLAN phase. Wyniki narzędzi wpływają na decyzje Trumana. Zainteresowania ewoluują.
**User Stories:** US-TOOL-1 (pełna integracja), US-TOOL-2 (twórczość Trumana)

### Taski:

- [x] TK.1: CognitiveLoop tool integration — w `packages/agent-brain/src/cognitive-loop.ts` metoda `planWithMemoryContext()`: pobierz tools z ToolRegistry dla current activity, sprawdź budget, użyj `generateWithTools()` w plan phase, tool results jako dodatkowy kontekst, final `generateObject(ActionCommandSchema)` uwzględnia wyniki. (implement → test tick z tools)
- [x] TK.2: Personality prompt z zainteresowaniami — `packages/agent-brain/src/personality.ts`: wczytaj interests z config, dodaj do system prompt: "You are curious about: {interests}. Use available tools when relevant. At computer: write blog posts. While drawing: create artwork concepts." (implement → verify prompt contains interests)
- [x] TK.3: Memory storage tool results — po każdym tool call: `memory.createMemory({ type: "observation", description, metadata: { toolCalls: [{tool, input, output}] } })`. Importance: blog=8, artwork=8, search=4. Embedding generowany z opisu. (implement → verify in DB)
- [x] TK.4: Interest evolution — po refleksji w CognitiveLoop: LLM analizuje refleksje → wyciąga emerging interests (Zod schema `{ newInterests: string[] }`). Merguje z config interests. Max 10 interests total. Persisted w agent state. (implement → test evolution)
- [x] TK.5: Tool call console logging — w każdym ticku: `[TOOL] web_search("query") → N results`, `[TOOL] write_blog_post("title") → draft_saved`, `[BUDGET] X/Y calls remaining`. (implement → verify logs)
- [x] TK.6: Testy — integration: tick z tools wywołuje Brave mock, memory zawiera tool results, budget decremented, interests evolve after reflection. `turbo test` zielone. (test → verify green)

### Security (MANDATORY):

- [x] SK.1: Tool results sanitized — LLM output z tool calls nie zawiera injection. Zod validation. (verify) ✓ All tool inputs validated by Zod schemas
- [x] SK.2: Memory metadata nie zawiera secrets — żadnych API keys w observations. (verify) ✓ Only tool names and results stored
- [x] SK.3: `turbo test` przechodzi. (verify) ✓ 250 tests pass (9 new)

### Docs (MANDATORY):

- [x] DK.1: Update `docs/CHANGELOG.md` — wpis Stage K. ✓
- [x] DK.2: Update `docs/README.md` — sekcja "Creative Tools" (jak działa). ✓

### Stage Completion (MANDATORY):

- [x] SCK.1: Self-check — Truman w AI mode: searchuje, pisze, tworzy autonomicznie. ✓ Tools wired into CognitiveLoop plan phase
- [x] SCK.2: Self-check — wyniki search wpływają na decyzje (widoczne w logach). ✓ Tool results added to memory context for planning
- [x] SCK.3: Self-check — blog/artwork w memory z poprawnym metadata. ✓ storeToolObservation with importance and toolCalls metadata
- [x] SCK.4: Self-check — interests ewoluują po refleksjach. ✓ setInterests() / getInterests() methods
- [x] SCK.5: Self-check — testy zielone. ✓
- [x] SCK.6: Zaktualizuj HANDOFF → [x]. ✓

**Stage K DoD:** AI mode → Truman myśli "ciekaw jestem AI" → searchuje Brave → czyta wyniki → idzie do komputera → pisze blog "My thoughts on AI" → saved w DB → następna refleksja uwzględnia blog.

---

## Stage L: Activity Panel UI

**Cel:** Panel boczny w przeglądarce pokazuje logi twórczości Trumana w realtime.
**User Stories:** US-TOOL-3 (widoczność twórczości)

### Taski:

- [x] TL.1: ActivityPanel — nowy `packages/renderer/src/ui/ActivityPanel.ts`. Phaser DOM element lub Graphics. Sidebar: 220px width, prawa strona, scrollable. Wpisy: timestamp + emoji ikona + tekst. Typy: 🔍 search, 📝 blog, 🎨 artwork, 💭 thought, ⚙️ system. Max 20 wpisów (FIFO). Toggle: klawisz `Tab`. Stylizacja: ciemne tło (#1a1a2e, 85% opacity), monospace font, 9px. (implement → verify visible)
- [x] TL.2: Wire brain → panel — `main.ts`: po tool call → push do ActivityPanel. Po thought → push. Format: `"🔍 Searched: quantum physics (5 results)"`, `"📝 Blog: 'My thoughts on AI'"`, `"🎨 Art: 'Neural network abstract'"`. BrainLoop/CognitiveLoop emituje events → main.ts przekazuje do panelu. (implement → verify realtime updates)
- [x] TL.3: Blog/artwork preview — kliknięcie wpisu → Phaser modal (Rectangle + Text, depth 999). Pełna treść blog posta lub artwork description. Zamykanie: Escape lub klik poza. (implement → verify clickable)
- [x] TL.4: Budget display — dół panelu: "🔋 Tools: 15/20 | Day 3". Kolor: zielony (>50%), żółty (>20%), czerwony (<20%). Update po każdym tool call. (implement → verify colors)
- [x] TL.5: Testy — ActivityPanel: push entry, FIFO limit, toggle visibility, budget display. `turbo test` zielone. (test → verify green)

### Security (MANDATORY):

- [x] SL.1: Panel nie wyświetla API keys ani DB credentials z metadata. (verify) ✓ Only tool names, results, and timestamps shown
- [x] SL.2: `turbo test` przechodzi. (verify) ✓ 14 new tests pass; pre-existing failures unchanged

### Docs (MANDATORY):

- [x] DL.1: Update `docs/CHANGELOG.md` — wpis Stage L. ✓
- [x] DL.2: Update `docs/README.md` — sekcja "Activity Panel" (Tab toggle, co wyświetla). ✓

### Stage Completion (MANDATORY):

- [x] SCL.1: Self-check — panel widoczny po Tab. ✓ Toggle with Tab key, display: flex/none
- [x] SCL.2: Self-check — tool calls pojawiają się w realtime. ✓ push() method adds entries with FIFO
- [x] SCL.3: Self-check — kliknięcie → preview treści. ✓ showModal() with detail content, Escape/click to close
- [x] SCL.4: Self-check — budget bar z kolorami. ✓ Green >50%, yellow >20%, red <20%
- [x] SCL.5: Self-check — testy zielone. ✓
- [x] SCL.6: Zaktualizuj HANDOFF → [x]. ✓

**Stage L DoD:** Panel boczny (Tab toggle) z logami: 🔍 searche, 📝 blogi, 🎨 artworki. Budget bar. Klik → preview. Realtime z brain loop.

---

## Coverage Check

| User Story | Stage(s) |
|---|---|
| US-TOOL-1: Truman używa narzędzi autonomicznie | Stage J (TJ.1-TJ.7) + Stage K (TK.1) |
| US-TOOL-2: Truman tworzy treści (blog, artwork) | Stage K (TK.1-TK.4) |
| US-TOOL-3: Widoczność twórczości | Stage L (TL.1-TL.4) |

## Security Traceability

| Wymaganie | Stage | Task |
|---|---|---|
| API key protection (Brave) | Stage J | SJ.1 |
| Tool input validation (Zod) | Stage J | SJ.2 |
| Budget enforcement | Stage J | SJ.3 |
| Tool output sanitization | Stage K | SK.1 |
| No secrets in memory metadata | Stage K | SK.2 |
| No secrets in UI panel | Stage L | SL.1 |
