# TECH_STACK.md — No True Man Show

**Data:** 2026-03-23
**Bazuje na:** `tech-stack-research.md`, `docs/tech-stack.md`, `research/24-7-ai-livestream-research.md`

---

## Wybrane Technologie

| Warstwa | Technologia | Wersja | Uzasadnienie |
|---|---|---|---|
| **Język** | TypeScript | 5.7+ | Unified stack: renderer (Phaser) + backend + AI SDK. Type safety dla złożonego state machine agenta. |
| **Monorepo** | Turborepo | 2.7 | Najprostsze narzędzie dla małego zespołu. <10 min setup. 3x szybszy build niż Nx dla <10 pakietów. |
| **Runtime** | Node.js | 22 LTS | Async/event-driven, natywny dla Phaser i AI SDK. |
| **Agent Framework** | Vercel AI SDK | 6.x | Najdojrzalszy TS agent framework. `generateText()`, `generateObject()` z Zod schema. 25+ providerów LLM. |
| **LLM Router** | OpenRouter | - | Jeden API key, swap modeli via config. Mistral Small 3 (klasyfikacja) + DeepSeek V3.2 (generacja). |
| **2D Renderer** | Phaser 3 | 3.85.x | Built-in pixel art mode, Aseprite import, scene management, tweens, timers. 10+ lat aktywnego rozwoju. |
| **Baza danych** | PostgreSQL + pgvector | 17 + 0.8 | Jedna baza na dane relacyjne + wektory. Park et al. scoring w jednym SQL query. HNSW index. |
| **ORM** | Drizzle ORM | latest | Lekki, type-safe, SQL-first. Drizzle Kit do migracji. |
| **Embeddings** | Ollama (nomic-embed-text) | local | $0/mies, 768 wymiarów, self-hosted. Wystarczające dla pamięci agenta. |
| **Message Queue** | BullMQ + Redis | latest + 7 | TypeScript-native, exactly-once semantics, 50k+ jobs/day. Bull Board do monitoringu. |
| **Test Framework** | Vitest | latest | Szybki, natywne wsparcie TS, workspace mode dla monorepo. |
| **Linter** | ESLint (flat config) | latest | Standard dla TS ekosystemu. |
| **Health/Metrics** | prom-client + Fastify | latest | Prometheus-compatible metrics, lekki health server. |
| **Konteneryzacja** | Docker Compose | V2 | PostgreSQL + Redis + Ollama w development. |

## Rozważone Alternatywy

| Obszar | Alternatywa | Dlaczego odrzucona |
|---|---|---|
| Język | Python + asyncio | Dwa runtime'y (Python backend + JS renderer). Mniej type safety. |
| Renderer | PixiJS v8 | Udokumentowane memory leaks (issues #10586, #10877). Brak game framework — trzeba budować scene management, animacje, update loop. |
| Vector DB | Qdrant | Drugi serwis do zarządzania. Redundantny — pgvector 0.8 ma 9x szybsze query i HNSW. |
| Vector DB | ChromaDB | Single-node, mniej "ops-friendly" dla 24/7. |
| Queue | Temporal | Za ciężka infrastruktura na ten scale. |
| Queue | RabbitMQ | Java/Erlang ops burden, słabsze wsparcie TS. |
| Monorepo | Nx | 30-60 min setup, opinionated structure, overkill dla <10 pakietów. |
| Agent | LangGraph.js | Działa, ale Vercel AI SDK 6 ma prostsze API i lepszą dokumentację. |
| ORM | Prisma | Cięższy, generowany klient, wolniejszy cold start. |

## Frontend Styling

**N/A — brak klasycznego frontendu.** Renderer to Phaser 3 canvas (pixel art game), nie webowa aplikacja. Elementy UI (HUD, dymki) renderowane bezpośrednio w Phaser jako game objects.

Phaser config:
```typescript
{
  type: Phaser.CANVAS, // lub WEBGL — NIE Phaser.HEADLESS
  pixelArt: true,      // disables anti-aliasing, sets roundPixels
  width: 960,
  height: 540,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  fps: { target: 30, forceSetTimeOut: true }
}
```

## Monorepo Structure

```
no-trueman-show/
  turbo.json
  package.json
  tsconfig.base.json
  vitest.workspace.ts
  packages/
    shared/              # Typy, Zod schemas, stałe, utility
    agent-brain/         # Pętla kognitywna (Vercel AI SDK, planowanie, emocje)
    memory-service/      # PostgreSQL + pgvector CRUD, retrieval, refleksje
    renderer/            # Phaser 3 scena, sprite'y, animacje, HUD, dymki
  apps/
    companion-web/       # (placeholder na później)
    admin-dashboard/     # (placeholder na później)
  docs/                  # Specyfikacje (design, agent, visual, security, etc.)
  config/                # truman-config.json (tuneable params)
```

**Nota:** `tts-service`, `stream-manager`, `chat-service` są OUT of scope dla visual MVP. Pakiety stub istnieją w monorepo, ale nie będą implementowane w tej iteracji.

## Szacunkowy Koszt (Visual MVP)

| Pozycja | Koszt/mies |
|---|---|
| LLM (DeepSeek V3.2 + Mistral Small 3 via OpenRouter) | ~$8-12 |
| Embeddings (Ollama, self-hosted) | $0 |
| PostgreSQL (Docker, local dev) | $0 |
| Redis (Docker, local dev) | $0 |
| **Razem (development)** | **~$8-12** |
