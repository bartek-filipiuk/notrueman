# No True Man Show

A 24/7 AI agent living in a pixel art room, rendered with Phaser 3 in the browser.

## Quick Start

### Prerequisites
- Node.js >= 20
- npm >= 10
- Docker & Docker Compose (for database services)

### Install & Run

```bash
# Install dependencies
npm install

# Start dev services (PostgreSQL, Redis, Ollama)
docker compose up -d

# Start the dev server
npm run dev

# Open http://localhost:5173 in your browser
```

### Build & Test

```bash
# Build all packages
npm run build

# Run all tests
npm run test

# Type check
npm run typecheck
```

## Directory Structure

```
notrueman/
  packages/
    shared/          # Shared types, schemas, constants (@nts/shared)
    renderer/        # Phaser 3 game client (@nts/renderer)
    agent-brain/     # AI agent logic (@nts/agent-brain)
    memory-service/  # Memory & embeddings (@nts/memory-service)
  apps/              # Application entry points
  docs/              # Documentation & specs
  docker-compose.yml # Dev services
  turbo.json         # Turborepo config
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and fill in required values:

```bash
cp .env.example .env
```

Key variables:
- `OPENROUTER_API_KEY` — Required for AI agent brain (get from OpenRouter)
- `POSTGRES_USER`, `POSTGRES_PASSWORD` — Database credentials (defaults: truman/truman)

### Agent Config

`config/truman-config.json` controls the brain loop:
- `tickIntervalMs` — How often the brain thinks (default: 45000ms)
- `models.think` / `models.classify` — LLM model IDs via OpenRouter
- `failureRate` — Probability of activity failure (default: 0.25)
- `emotions` — Default emotion values (7 dimensions)

`config/truman-personality.md` contains Truman's personality prompt (editable without rebuild).

## Tech Stack

- **Frontend:** Phaser 3 (CANVAS, pixelArt), Vite, TypeScript
- **AI:** Vercel AI SDK 6, OpenRouter (DeepSeek V3.2 + Mistral Small 3)
- **Backend:** Node.js, PostgreSQL 17 + pgvector, Redis 7, Ollama
- **Build:** Turborepo, npm workspaces
- **Testing:** Vitest
